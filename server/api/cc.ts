import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { logger } from '../utils/logger.js';
import { validateRequest } from '../utils/validation.js';
import type { Request, Response } from 'express';

export const ccRouter = Router();

// Schemas
const CreateParentCCSchema = z.object({
  projectId: z.string(),
  name: z.string().optional(),
});

const CreateChildCCSchema = z.object({
  projectId: z.string(),
  parentInstanceId: z.string(),
  taskId: z.string(),
  instruction: z.string(),
  name: z.string().optional(),
});

// Get all CC instances
ccRouter.get('/', async (req: Request, res: Response) => {
  try {
    const instances = await prisma.cCInstance.findMany({
      include: {
        parentInstance: true,
        childInstances: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(instances);
  } catch (error) {
    logger.error('Failed to fetch CC instances:', error);
    res.status(500).json({ error: 'Failed to fetch CC instances' });
  }
});

// Get CC instance by ID
ccRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const instance = await prisma.cCInstance.findUnique({
      where: { id: req.params.id },
      include: {
        parentInstance: true,
        childInstances: true,
        logs: {
          orderBy: { createdAt: 'desc' },
          take: 100,
        },
      },
    });

    if (!instance) {
      return res.status(404).json({ error: 'CC instance not found' });
    }

    res.json(instance);
  } catch (error) {
    logger.error('Failed to fetch CC instance:', error);
    res.status(500).json({ error: 'Failed to fetch CC instance' });
  }
});

// Create parent CC
ccRouter.post('/parent', validateRequest(CreateParentCCSchema), async (req: Request, res: Response) => {
  try {
    const { projectId, name } = req.body as z.infer<typeof CreateParentCCSchema>;

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check if parent CC already exists for this project
    const existingParent = await prisma.cCInstance.findFirst({
      where: {
        type: 'parent',
        status: { in: ['idle', 'running'] },
        // We'll need to add projectId to CCInstance model or track it differently
      },
    });

    if (existingParent) {
      return res.status(400).json({ 
        error: 'Active parent CC already exists for this project' 
      });
    }

    const instance = await prisma.cCInstance.create({
      data: {
        name: name || `Parent CC - ${project.name}`,
        type: 'parent',
        status: 'idle',
      },
    });

    logger.info('Parent CC created:', { 
      instanceId: instance.id, 
      projectId 
    });

    res.status(201).json(instance);
  } catch (error) {
    logger.error('Failed to create parent CC:', error);
    res.status(500).json({ error: 'Failed to create parent CC' });
  }
});

// Create child CC (via MCP)
ccRouter.post('/child', validateRequest(CreateChildCCSchema), async (req: Request, res: Response) => {
  try {
    const { 
      projectId,
      parentInstanceId, 
      taskId, 
      instruction, 
      name 
    } = req.body as z.infer<typeof CreateChildCCSchema>;

    const sessionId = req.headers['x-session-id'] as string;

    // Verify parent exists and is active
    const parent = await prisma.cCInstance.findUnique({
      where: { id: parentInstanceId },
    });

    if (!parent || parent.type !== 'parent') {
      return res.status(404).json({ error: 'Parent CC not found' });
    }

    // Verify project and task exist
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Set task status to running
    await prisma.task.update({
      where: { id: taskId },
      data: { 
        status: 'running',
        startedAt: new Date(),
      },
    });

    // Generate worktree name
    const worktreeName = `worktree-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const worktreePath = `${project.workdir}/../${worktreeName}`;

    // Create CC instance record
    const instance = await prisma.cCInstance.create({
      data: {
        name: name || `Child CC - ${task.name}`,
        type: 'child',
        status: 'running',
        parentInstanceId,
        worktreePath,
      },
    });

    // Update task assignment
    await prisma.task.update({
      where: { id: taskId },
      data: { 
        assignedTo: instance.id,
        worktreePath: instance.worktreePath,
      },
    });

    logger.info('Child CC creation started:', { 
      instanceId: instance.id, 
      parentInstanceId,
      taskId,
      projectId,
      sessionId,
    });

    // Start actual child CC process (this would trigger git worktree creation and claude startup)
    const ccModule = await import('../services/cc.service.js');
    const ccService = new ccModule.CCService((global as any).io);
    
    // This will run asynchronously and send progress via SSE if sessionId is provided
    ccService.startChildCC({
      instanceId: instance.id,
      parentInstanceId,
      taskId,
      instruction,
      projectWorkdir: project.workdir,
      worktreeName,
      sessionId,
    }).catch(error => {
      logger.error('Child CC startup failed:', error);
      // Update status to error
      prisma.cCInstance.update({
        where: { id: instance.id },
        data: { status: 'error' },
      });
      prisma.task.update({
        where: { id: taskId },
        data: { status: 'failed' },
      });
    });

    res.status(201).json({
      instanceId: instance.id,
      worktreePath: instance.worktreePath,
      status: 'created',
      message: `Child CC ${instance.id} creation started`,
      streaming: !!sessionId,
    });

  } catch (error) {
    logger.error('Failed to create child CC:', error);
    res.status(500).json({ error: 'Failed to create child CC' });
  }
});

// Update CC status
ccRouter.patch('/:id/status', async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    const validStatuses = ['idle', 'running', 'stopped', 'error'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
      });
    }

    const instance = await prisma.cCInstance.update({
      where: { id: req.params.id },
      data: { 
        status,
        lastHeartbeat: new Date(),
      },
    });

    logger.info('CC status updated:', { 
      instanceId: instance.id, 
      status 
    });

    res.json(instance);
  } catch (error) {
    logger.error('Failed to update CC status:', error);
    res.status(500).json({ error: 'Failed to update CC status' });
  }
});

// Heartbeat endpoint
ccRouter.post('/:id/heartbeat', async (req: Request, res: Response) => {
  try {
    const instance = await prisma.cCInstance.update({
      where: { id: req.params.id },
      data: { lastHeartbeat: new Date() },
    });

    res.json({ success: true, lastHeartbeat: instance.lastHeartbeat });
  } catch (error) {
    logger.error('Failed to update heartbeat:', error);
    res.status(500).json({ error: 'Failed to update heartbeat' });
  }
});

// Delete CC instance
ccRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const instance = await prisma.cCInstance.findUnique({
      where: { id: req.params.id },
    });

    if (!instance) {
      return res.status(404).json({ error: 'CC instance not found' });
    }

    // Delete child instances first if this is a parent
    if (instance.type === 'parent') {
      await prisma.cCInstance.deleteMany({
        where: { parentInstanceId: instance.id },
      });
    }

    await prisma.cCInstance.delete({
      where: { id: req.params.id },
    });

    logger.info('CC instance deleted:', { instanceId: req.params.id });
    res.status(204).send();
  } catch (error) {
    logger.error('Failed to delete CC instance:', error);
    res.status(500).json({ error: 'Failed to delete CC instance' });
  }
});