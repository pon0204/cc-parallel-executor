import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { logger } from '../utils/logger.js';
import { prisma } from '../utils/prisma.js';
import { validateRequest } from '../utils/validation.js';
import { ErrorFactory, asyncHandler } from '../utils/errors.js';

export const projectRouterRefactored = Router();

// Schemas
const CreateProjectSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  workdir: z.string().min(1),
});

const UpdateProjectSchema = CreateProjectSchema.partial();

// Get all projects
projectRouterRefactored.get('/', asyncHandler(async (req: Request, res: Response) => {
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
}));

// Get project by ID
projectRouterRefactored.get('/:id', asyncHandler(async (req: Request, res: Response) => {
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
    throw ErrorFactory.notFound('Project', req.params.id);
  }

  res.json(project);
}));

// Create new project
projectRouterRefactored.post(
  '/',
  validateRequest(CreateProjectSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const data = req.body as z.infer<typeof CreateProjectSchema>;

    // Verify workdir exists
    const fs = await import('fs/promises');
    try {
      await fs.access(data.workdir);
    } catch {
      throw ErrorFactory.badRequest('Working directory does not exist', {
        workdir: data.workdir,
      });
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
  })
);

// Update project
projectRouterRefactored.patch(
  '/:id',
  validateRequest(UpdateProjectSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const data = req.body as z.infer<typeof UpdateProjectSchema>;

    // If workdir is being updated, verify it exists
    if (data.workdir) {
      const fs = await import('fs/promises');
      try {
        await fs.access(data.workdir);
      } catch {
        throw ErrorFactory.badRequest('Working directory does not exist', {
          workdir: data.workdir,
        });
      }
    }

    const project = await prisma.project.update({
      where: { id: req.params.id },
      data,
    });

    logger.info('Project updated:', { projectId: project.id });
    res.json(project);
  })
);

// Get tasks for a project
projectRouterRefactored.get('/:id/tasks', asyncHandler(async (req: Request, res: Response) => {
  // First verify the project exists
  const project = await prisma.project.findUnique({
    where: { id: req.params.id },
  });

  if (!project) {
    throw ErrorFactory.notFound('Project', req.params.id);
  }

  const tasks = await prisma.task.findMany({
    where: { projectId: req.params.id },
    include: {
      dependencies: {
        include: {
          dependencyTask: true,
        },
      },
      dependents: {
        include: {
          task: true,
        },
      },
    },
    orderBy: [{ status: 'asc' }, { priority: 'desc' }],
  });

  res.json(tasks);
}));

// Delete project
projectRouterRefactored.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { force } = req.query;

  // Check if project exists
  const project = await prisma.project.findUnique({
    where: { id: req.params.id },
  });

  if (!project) {
    throw ErrorFactory.notFound('Project', req.params.id);
  }

  // Check if project has tasks
  const taskCount = await prisma.task.count({
    where: { projectId: req.params.id },
  });

  if (taskCount > 0 && !force) {
    throw ErrorFactory.badRequest(
      'Cannot delete project with existing tasks. Please delete all tasks first or use ?force=true.',
      { taskCount }
    );
  }

  if (force === 'true') {
    // Delete all related data in order
    await prisma.taskLog.deleteMany({
      where: { task: { projectId: req.params.id } },
    });

    await prisma.taskDependency.deleteMany({
      where: { task: { projectId: req.params.id } },
    });

    await prisma.ultrathinkMessage.deleteMany({
      where: { task: { projectId: req.params.id } },
    });

    await prisma.gitWorktree.deleteMany({
      where: { projectId: req.params.id },
    });

    await prisma.task.deleteMany({
      where: { projectId: req.params.id },
    });

    await prisma.requirement.deleteMany({
      where: { projectId: req.params.id },
    });

    await prisma.feature.deleteMany({
      where: { projectId: req.params.id },
    });
  }

  await prisma.project.delete({
    where: { id: req.params.id },
  });

  logger.info('Project deleted:', { projectId: req.params.id, force: !!force });
  res.status(204).send();
}));

// Get requirements for a project
projectRouterRefactored.get('/:id/requirements', asyncHandler(async (req: Request, res: Response) => {
  // First verify the project exists
  const project = await prisma.project.findUnique({
    where: { id: req.params.id },
  });

  if (!project) {
    throw ErrorFactory.notFound('Project', req.params.id);
  }

  const requirements = await prisma.requirement.findMany({
    where: { projectId: req.params.id },
    orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
  });

  res.json(requirements);
}));

// Get features for a project
projectRouterRefactored.get('/:id/features', asyncHandler(async (req: Request, res: Response) => {
  // First verify the project exists
  const project = await prisma.project.findUnique({
    where: { id: req.params.id },
  });

  if (!project) {
    throw ErrorFactory.notFound('Project', req.params.id);
  }

  const features = await prisma.feature.findMany({
    where: { projectId: req.params.id },
    orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
  });

  res.json(features);
}));