import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { logger } from '../utils/logger.js';
import { prisma } from '../utils/prisma.js';
import { validateRequest } from '../utils/validation.js';

export const executionPhasesRouter = Router();

// Schemas
const CreateExecutionPhaseSchema = z.object({
  projectId: z.string(),
  phaseNumber: z.number().int().positive(),
  name: z.string(),
  status: z.enum(['pending', 'running', 'completed', 'failed']).optional(),
});

const UpdateExecutionPhaseSchema = z.object({
  status: z.enum(['pending', 'running', 'completed', 'failed']).optional(),
  qualityCheckPassed: z.boolean().optional(),
  qualityCheckResult: z.string().optional(),
});

// Get all execution phases for a project
executionPhasesRouter.get('/project/:projectId', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;

    const phases = await prisma.executionPhase.findMany({
      where: { projectId },
      orderBy: { phaseNumber: 'asc' },
    });

    res.json(phases);
  } catch (error) {
    logger.error('Failed to fetch execution phases:', error);
    res.status(500).json({ error: 'Failed to fetch execution phases' });
  }
});

// Get execution phase by ID
executionPhasesRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const phase = await prisma.executionPhase.findUnique({
      where: { id: req.params.id },
      include: {
        project: true,
      },
    });

    if (!phase) {
      return res.status(404).json({ error: 'Execution phase not found' });
    }

    res.json(phase);
  } catch (error) {
    logger.error('Failed to fetch execution phase:', error);
    res.status(500).json({ error: 'Failed to fetch execution phase' });
  }
});

// Create execution phase
executionPhasesRouter.post(
  '/',
  validateRequest(CreateExecutionPhaseSchema),
  async (req: Request, res: Response) => {
    try {
      const { projectId, phaseNumber, name, status } = req.body as z.infer<
        typeof CreateExecutionPhaseSchema
      >;

      // Verify project exists
      const project = await prisma.project.findUnique({
        where: { id: projectId },
      });

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // Check if phase number already exists
      const existingPhase = await prisma.executionPhase.findFirst({
        where: {
          projectId,
          phaseNumber,
        },
      });

      if (existingPhase) {
        return res.status(400).json({
          error: `Phase number ${phaseNumber} already exists for this project`,
        });
      }

      const phase = await prisma.executionPhase.create({
        data: {
          projectId,
          phaseNumber,
          name,
          status: status || 'pending',
        },
      });

      logger.info('Execution phase created:', {
        phaseId: phase.id,
        projectId,
        phaseNumber,
        name,
      });

      res.status(201).json(phase);
    } catch (error) {
      logger.error('Failed to create execution phase:', error);
      res.status(500).json({ error: 'Failed to create execution phase' });
    }
  }
);

// Update execution phase
executionPhasesRouter.patch(
  '/:id',
  validateRequest(UpdateExecutionPhaseSchema),
  async (req: Request, res: Response) => {
    try {
      const { status, qualityCheckPassed, qualityCheckResult } = req.body as z.infer<
        typeof UpdateExecutionPhaseSchema
      >;

      const updateData: any = {};

      if (status !== undefined) {
        updateData.status = status;
        
        // Set timestamps based on status
        if (status === 'running' && !updateData.startedAt) {
          updateData.startedAt = new Date();
        } else if ((status === 'completed' || status === 'failed') && !updateData.completedAt) {
          updateData.completedAt = new Date();
        }
      }

      if (qualityCheckPassed !== undefined) {
        updateData.qualityCheckPassed = qualityCheckPassed;
        updateData.qualityCheckAt = new Date();
      }

      if (qualityCheckResult !== undefined) {
        updateData.qualityCheckResult = qualityCheckResult;
      }

      const phase = await prisma.executionPhase.update({
        where: { id: req.params.id },
        data: updateData,
      });

      logger.info('Execution phase updated:', {
        phaseId: phase.id,
        updates: updateData,
      });

      res.json(phase);
    } catch (error) {
      logger.error('Failed to update execution phase:', error);
      res.status(500).json({ error: 'Failed to update execution phase' });
    }
  }
);

// Delete execution phase
executionPhasesRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    await prisma.executionPhase.delete({
      where: { id: req.params.id },
    });

    logger.info('Execution phase deleted:', { phaseId: req.params.id });
    res.status(204).send();
  } catch (error) {
    logger.error('Failed to delete execution phase:', error);
    res.status(500).json({ error: 'Failed to delete execution phase' });
  }
});

// Start phase (transition to running)
executionPhasesRouter.post('/:id/start', async (req: Request, res: Response) => {
  try {
    const phase = await prisma.executionPhase.findUnique({
      where: { id: req.params.id },
    });

    if (!phase) {
      return res.status(404).json({ error: 'Execution phase not found' });
    }

    if (phase.status !== 'pending') {
      return res.status(400).json({
        error: `Cannot start phase in ${phase.status} status`,
      });
    }

    const updatedPhase = await prisma.executionPhase.update({
      where: { id: req.params.id },
      data: {
        status: 'running',
        startedAt: new Date(),
      },
    });

    logger.info('Execution phase started:', {
      phaseId: updatedPhase.id,
      name: updatedPhase.name,
    });

    res.json(updatedPhase);
  } catch (error) {
    logger.error('Failed to start execution phase:', error);
    res.status(500).json({ error: 'Failed to start execution phase' });
  }
});

// Complete phase (transition to completed)
executionPhasesRouter.post('/:id/complete', async (req: Request, res: Response) => {
  try {
    const phase = await prisma.executionPhase.findUnique({
      where: { id: req.params.id },
    });

    if (!phase) {
      return res.status(404).json({ error: 'Execution phase not found' });
    }

    if (phase.status !== 'running') {
      return res.status(400).json({
        error: `Cannot complete phase in ${phase.status} status`,
      });
    }

    const updatedPhase = await prisma.executionPhase.update({
      where: { id: req.params.id },
      data: {
        status: 'completed',
        completedAt: new Date(),
      },
    });

    logger.info('Execution phase completed:', {
      phaseId: updatedPhase.id,
      name: updatedPhase.name,
    });

    res.json(updatedPhase);
  } catch (error) {
    logger.error('Failed to complete execution phase:', error);
    res.status(500).json({ error: 'Failed to complete execution phase' });
  }
});

// Get phase tasks
executionPhasesRouter.get('/:id/tasks', async (req: Request, res: Response) => {
  try {
    const phase = await prisma.executionPhase.findUnique({
      where: { id: req.params.id },
    });

    if (!phase) {
      return res.status(404).json({ error: 'Execution phase not found' });
    }

    // Get tasks based on phase name/type mapping
    const taskTypeMapping: Record<string, string[]> = {
      'Setup': ['setup'],
      'Database': ['database'],
      'Development': ['backend', 'frontend'],
      'Testing': ['test'],
      'Deploy': ['deploy'],
    };

    const taskTypes = taskTypeMapping[phase.name] || [];

    const tasks = await prisma.task.findMany({
      where: {
        projectId: phase.projectId,
        taskType: { in: taskTypes },
      },
      include: {
        assignedCCInstance: true,
        dependencies: true,
      },
      orderBy: { priority: 'desc' },
    });

    res.json(tasks);
  } catch (error) {
    logger.error('Failed to fetch phase tasks:', error);
    res.status(500).json({ error: 'Failed to fetch phase tasks' });
  }
});