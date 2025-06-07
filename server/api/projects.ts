import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { logger } from '../utils/logger.js';
import { validateRequest } from '../utils/validation.js';
import type { Request, Response } from 'express';

export const projectRouter = Router();

// Schemas
const CreateProjectSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  workdir: z.string().min(1),
});

const UpdateProjectSchema = CreateProjectSchema.partial();

// Get all projects
projectRouter.get('/', async (req: Request, res: Response) => {
  try {
    const projects = await prisma.project.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: {
          select: {
            tasks: true,
            requirements: true,
            features: true,
          },
        },
      },
    });
    res.json(projects);
  } catch (error) {
    logger.error('Failed to fetch projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// Get project by ID
projectRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: {
        tasks: {
          orderBy: { priority: 'desc' },
        },
        requirements: {
          orderBy: { createdAt: 'desc' },
        },
        features: {
          orderBy: { priority: 'desc' },
        },
      },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json(project);
  } catch (error) {
    logger.error('Failed to fetch project:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// Create new project
projectRouter.post('/', validateRequest(CreateProjectSchema), async (req: Request, res: Response) => {
  try {
    const data = req.body as z.infer<typeof CreateProjectSchema>;
    
    // Verify workdir exists
    const fs = await import('fs/promises');
    try {
      await fs.access(data.workdir);
    } catch {
      return res.status(400).json({ error: 'Working directory does not exist' });
    }

    const project = await prisma.project.create({
      data: {
        name: data.name,
        description: data.description,
        workdir: data.workdir,
      },
    });

    logger.info('Project created:', { projectId: project.id, name: project.name });
    res.status(201).json(project);
  } catch (error) {
    logger.error('Failed to create project:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// Update project
projectRouter.patch('/:id', validateRequest(UpdateProjectSchema), async (req: Request, res: Response) => {
  try {
    const data = req.body as z.infer<typeof UpdateProjectSchema>;

    // If workdir is being updated, verify it exists
    if (data.workdir) {
      const fs = await import('fs/promises');
      try {
        await fs.access(data.workdir);
      } catch {
        return res.status(400).json({ error: 'Working directory does not exist' });
      }
    }

    const project = await prisma.project.update({
      where: { id: req.params.id },
      data,
    });

    logger.info('Project updated:', { projectId: project.id });
    res.json(project);
  } catch (error) {
    logger.error('Failed to update project:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// Delete project
projectRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    // Check if project has tasks
    const taskCount = await prisma.task.count({
      where: { projectId: req.params.id },
    });

    if (taskCount > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete project with existing tasks. Please delete all tasks first.' 
      });
    }

    await prisma.project.delete({
      where: { id: req.params.id },
    });

    logger.info('Project deleted:', { projectId: req.params.id });
    res.status(204).send();
  } catch (error) {
    logger.error('Failed to delete project:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});