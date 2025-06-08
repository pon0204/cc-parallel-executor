import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { logger } from '../utils/logger.js';
import { validateRequest } from '../utils/validation.js';
import type { Request, Response } from 'express';

export const requirementRouter = Router();

// Schemas
const CreateRequirementSchema = z.object({
  projectId: z.string().min(1),
  type: z.string().min(1).max(50),
  title: z.string().min(1).max(255),
  content: z.string().min(1),
  priority: z.number().int().min(1).max(10).default(5),
  status: z.string().default('draft'),
});

const UpdateRequirementSchema = CreateRequirementSchema.omit({ projectId: true }).partial();

// Get all requirements for a project
requirementRouter.get('/project/:projectId', async (req: Request, res: Response) => {
  try {
    const requirements = await prisma.requirement.findMany({
      where: { projectId: req.params.projectId },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' },
      ],
    });
    res.json(requirements);
  } catch (error) {
    logger.error('Failed to fetch requirements:', error);
    res.status(500).json({ error: 'Failed to fetch requirements' });
  }
});

// Get requirement by ID
requirementRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const requirement = await prisma.requirement.findUnique({
      where: { id: req.params.id },
      include: {
        project: true,
      },
    });

    if (!requirement) {
      return res.status(404).json({ error: 'Requirement not found' });
    }

    res.json(requirement);
  } catch (error) {
    logger.error('Failed to fetch requirement:', error);
    res.status(500).json({ error: 'Failed to fetch requirement' });
  }
});

// Create new requirement
requirementRouter.post('/', validateRequest(CreateRequirementSchema), async (req: Request, res: Response) => {
  try {
    const data = req.body as z.infer<typeof CreateRequirementSchema>;
    
    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: data.projectId },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const requirement = await prisma.requirement.create({
      data: {
        projectId: data.projectId,
        type: data.type,
        title: data.title,
        content: data.content,
        priority: data.priority,
        status: data.status,
      },
    });

    logger.info('Requirement created:', { requirementId: requirement.id, projectId: data.projectId });
    res.status(201).json(requirement);
  } catch (error) {
    logger.error('Failed to create requirement:', error);
    res.status(500).json({ error: 'Failed to create requirement' });
  }
});

// Update requirement
requirementRouter.put('/:id', validateRequest(UpdateRequirementSchema), async (req: Request, res: Response) => {
  try {
    const data = req.body as z.infer<typeof UpdateRequirementSchema>;

    const requirement = await prisma.requirement.update({
      where: { id: req.params.id },
      data,
    });

    logger.info('Requirement updated:', { requirementId: requirement.id });
    res.json(requirement);
  } catch (error) {
    logger.error('Failed to update requirement:', error);
    res.status(500).json({ error: 'Failed to update requirement' });
  }
});

// Delete requirement
requirementRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    await prisma.requirement.delete({
      where: { id: req.params.id },
    });

    logger.info('Requirement deleted:', { requirementId: req.params.id });
    res.status(204).send();
  } catch (error) {
    logger.error('Failed to delete requirement:', error);
    res.status(500).json({ error: 'Failed to delete requirement' });
  }
});

// Bulk create requirements
requirementRouter.post('/bulk', async (req: Request, res: Response) => {
  try {
    const { projectId, requirements } = req.body;

    if (!projectId || !Array.isArray(requirements)) {
      return res.status(400).json({ error: 'projectId and requirements array are required' });
    }

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Validate each requirement
    const validatedRequirements = requirements.map(req => 
      CreateRequirementSchema.parse({ ...req, projectId })
    );

    // Create all requirements
    const created = await prisma.requirement.createMany({
      data: validatedRequirements,
    });

    logger.info('Bulk requirements created:', { count: created.count, projectId });
    res.status(201).json({ 
      message: 'Requirements created successfully',
      count: created.count 
    });
  } catch (error) {
    logger.error('Failed to bulk create requirements:', error);
    res.status(500).json({ error: 'Failed to create requirements' });
  }
});