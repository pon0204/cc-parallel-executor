import { Router } from 'express';
import { z } from 'zod';
import YAML from 'yaml';
import { prisma } from '../utils/prisma.js';
import { logger } from '../utils/logger.js';
import { validateRequest } from '../utils/validation.js';
import type { Request, Response } from 'express';

export const taskRouter = Router();

// Schemas
const TaskSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  type: z.string(),
  priority: z.number().min(1).max(10).default(5),
  dependencies: z.array(z.string()).optional(),
  instruction: z.string().optional(),
  config: z.record(z.any()).optional(),
  input: z.record(z.any()).optional(),
  output: z.record(z.any()).optional(),
});

const TaskDefinitionSchema = z.object({
  project: z.object({
    id: z.string(),
    name: z.string(),
  }),
  settings: z.object({
    max_parallel_cc: z.number().default(5),
    default_timeout: z.number().default(300),
  }).optional(),
  tasks: z.array(TaskSchema),
});

const CreateTaskSchema = z.object({
  projectId: z.string().min(1),
  parentTaskId: z.string().optional(),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  status: z.string().default('pending'),
  priority: z.number().int().min(1).max(10).default(5),
  taskType: z.string().default('general'),
  instruction: z.string().optional(),
  inputData: z.record(z.any()).optional(),
  outputData: z.record(z.any()).optional(),
  mcpEnabled: z.boolean().default(true),
  ultrathinkProtocol: z.boolean().default(true),
  estimatedDurationMinutes: z.number().int().optional(),
});

const UpdateTaskSchema = CreateTaskSchema.omit({ projectId: true }).partial();

// Upload task definition YAML
taskRouter.post('/upload/:projectId', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const yamlContent = req.body.content;

    if (!yamlContent) {
      return res.status(400).json({ error: 'YAML content is required' });
    }

    // Parse and validate YAML
    let taskDefinition;
    try {
      const parsed = YAML.parse(yamlContent);
      taskDefinition = TaskDefinitionSchema.parse(parsed);
    } catch (error) {
      logger.warn('Invalid task definition:', error);
      return res.status(400).json({ 
        error: 'Invalid task definition format',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Create tasks with dependencies
    const taskMap = new Map<string, string>(); // taskId in YAML -> taskId in DB

    // First pass: create all tasks
    for (const taskDef of taskDefinition.tasks) {
      const task = await prisma.task.create({
        data: {
          projectId,
          name: taskDef.name,
          description: taskDef.description,
          taskType: taskDef.type,
          priority: taskDef.priority,
          instruction: taskDef.instruction,
          inputData: taskDef.input ? JSON.stringify(taskDef.input) : null,
          outputData: taskDef.output ? JSON.stringify(taskDef.output) : null,
        },
      });
      taskMap.set(taskDef.id, task.id);
    }

    // Second pass: create dependencies
    for (const taskDef of taskDefinition.tasks) {
      if (taskDef.dependencies && taskDef.dependencies.length > 0) {
        const taskId = taskMap.get(taskDef.id)!;
        
        for (const depId of taskDef.dependencies) {
          const dependsOnId = taskMap.get(depId);
          if (dependsOnId) {
            await prisma.taskDependency.create({
              data: {
                taskId: taskId,
                dependencyTaskId: dependsOnId,
                dependencyType: 'depends_on',
              },
            });
          }
        }
      }
    }

    logger.info('Tasks uploaded:', { 
      projectId, 
      taskCount: taskDefinition.tasks.length 
    });

    res.json({ 
      message: 'Tasks uploaded successfully',
      taskCount: taskDefinition.tasks.length,
    });
  } catch (error) {
    logger.error('Failed to upload tasks:', error);
    res.status(500).json({ error: 'Failed to upload tasks' });
  }
});

// Get tasks for a project
taskRouter.get('/project/:projectId', async (req: Request, res: Response) => {
  try {
    const tasks = await prisma.task.findMany({
      where: { projectId: req.params.projectId },
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
      orderBy: [
        { status: 'asc' },
        { priority: 'desc' },
      ],
    });

    res.json(tasks);
  } catch (error) {
    logger.error('Failed to fetch tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// Get task by ID
taskRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const task = await prisma.task.findUnique({
      where: { id: req.params.id },
      include: {
        project: true,
        dependencies: {
          include: {
            dependencyTask: true,
          },
        },
        logs: {
          orderBy: { createdAt: 'desc' },
          take: 100,
        },
      },
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json(task);
  } catch (error) {
    logger.error('Failed to fetch task:', error);
    res.status(500).json({ error: 'Failed to fetch task' });
  }
});

// Update task status
taskRouter.patch('/:id/status', async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'queued', 'running', 'completed', 'failed'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
      });
    }

    const updateData: any = { status };

    // Set timestamps based on status
    if (status === 'running' && !req.body.startedAt) {
      updateData.startedAt = new Date();
    } else if ((status === 'completed' || status === 'failed') && !req.body.completedAt) {
      updateData.completedAt = new Date();
    }

    const task = await prisma.task.update({
      where: { id: req.params.id },
      data: updateData,
    });

    logger.info('Task status updated:', { taskId: task.id, status });
    res.json(task);
  } catch (error) {
    logger.error('Failed to update task status:', error);
    res.status(500).json({ error: 'Failed to update task status' });
  }
});

// Get ready tasks (no pending dependencies)
taskRouter.get('/ready/:projectId', async (req: Request, res: Response) => {
  try {
    // Get all pending tasks
    const pendingTasks = await prisma.task.findMany({
      where: {
        projectId: req.params.projectId,
        status: 'pending',
      },
      include: {
        dependencies: {
          include: {
            dependencyTask: true,
          },
        },
      },
    });

    // Filter tasks that have no pending dependencies
    const readyTasks = pendingTasks.filter(task => {
      return task.dependencies.every(dep => 
        dep.dependencyTask.status === 'completed'
      );
    });

    res.json(readyTasks);
  } catch (error) {
    logger.error('Failed to fetch ready tasks:', error);
    res.status(500).json({ error: 'Failed to fetch ready tasks' });
  }
});

// Create new task
taskRouter.post('/', validateRequest(CreateTaskSchema), async (req: Request, res: Response) => {
  try {
    const data = req.body as z.infer<typeof CreateTaskSchema>;
    
    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: data.projectId },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Verify parent task exists if specified
    if (data.parentTaskId) {
      const parentTask = await prisma.task.findUnique({
        where: { id: data.parentTaskId },
      });

      if (!parentTask) {
        return res.status(404).json({ error: 'Parent task not found' });
      }
    }

    const task = await prisma.task.create({
      data: {
        projectId: data.projectId,
        parentTaskId: data.parentTaskId,
        name: data.name,
        description: data.description,
        status: data.status.toUpperCase(),
        priority: data.priority,
        taskType: data.taskType,
        instruction: data.instruction,
        inputData: data.inputData ? JSON.stringify(data.inputData) : null,
        outputData: data.outputData ? JSON.stringify(data.outputData) : null,
        mcpEnabled: data.mcpEnabled,
        ultrathinkProtocol: data.ultrathinkProtocol,
        estimatedDurationMinutes: data.estimatedDurationMinutes,
      },
      include: {
        project: true,
        parentTask: true,
      },
    });

    logger.info('Task created:', { taskId: task.id, projectId: data.projectId });
    res.status(201).json(task);
  } catch (error) {
    logger.error('Failed to create task:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// Update task
taskRouter.put('/:id', validateRequest(UpdateTaskSchema), async (req: Request, res: Response) => {
  try {
    const data = req.body as z.infer<typeof UpdateTaskSchema>;
    
    // Format data for update
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.status !== undefined) updateData.status = data.status.toUpperCase();
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.taskType !== undefined) updateData.taskType = data.taskType;
    if (data.instruction !== undefined) updateData.instruction = data.instruction;
    if (data.inputData !== undefined) updateData.inputData = JSON.stringify(data.inputData);
    if (data.outputData !== undefined) updateData.outputData = JSON.stringify(data.outputData);
    if (data.mcpEnabled !== undefined) updateData.mcpEnabled = data.mcpEnabled;
    if (data.ultrathinkProtocol !== undefined) updateData.ultrathinkProtocol = data.ultrathinkProtocol;
    if (data.estimatedDurationMinutes !== undefined) updateData.estimatedDurationMinutes = data.estimatedDurationMinutes;

    const task = await prisma.task.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        project: true,
        dependencies: {
          include: {
            dependencyTask: true,
          },
        },
      },
    });

    logger.info('Task updated:', { taskId: task.id });
    res.json(task);
  } catch (error) {
    logger.error('Failed to update task:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// Delete task
taskRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    // Check if task has child tasks
    const childTaskCount = await prisma.task.count({
      where: { parentTaskId: req.params.id },
    });

    if (childTaskCount > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete task with child tasks. Please delete child tasks first.' 
      });
    }

    // Delete dependencies first
    await prisma.taskDependency.deleteMany({
      where: {
        OR: [
          { taskId: req.params.id },
          { dependencyTaskId: req.params.id },
        ],
      },
    });

    // Delete the task
    await prisma.task.delete({
      where: { id: req.params.id },
    });

    logger.info('Task deleted:', { taskId: req.params.id });
    res.status(204).send();
  } catch (error) {
    logger.error('Failed to delete task:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// Add task dependency
taskRouter.post('/:id/dependencies', async (req: Request, res: Response) => {
  try {
    const { dependencyTaskId, dependencyType = 'depends_on' } = req.body;

    if (!dependencyTaskId) {
      return res.status(400).json({ error: 'dependencyTaskId is required' });
    }

    // Verify both tasks exist
    const [task, dependencyTask] = await Promise.all([
      prisma.task.findUnique({ where: { id: req.params.id } }),
      prisma.task.findUnique({ where: { id: dependencyTaskId } }),
    ]);

    if (!task || !dependencyTask) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Check if dependency already exists
    const existing = await prisma.taskDependency.findFirst({
      where: {
        taskId: req.params.id,
        dependencyTaskId,
      },
    });

    if (existing) {
      return res.status(400).json({ error: 'Dependency already exists' });
    }

    const dependency = await prisma.taskDependency.create({
      data: {
        taskId: req.params.id,
        dependencyTaskId,
        dependencyType,
      },
      include: {
        task: true,
        dependencyTask: true,
      },
    });

    logger.info('Task dependency created:', { taskId: req.params.id, dependencyTaskId });
    res.status(201).json(dependency);
  } catch (error) {
    logger.error('Failed to create task dependency:', error);
    res.status(500).json({ error: 'Failed to create task dependency' });
  }
});

// Remove task dependency
taskRouter.delete('/:id/dependencies/:depId', async (req: Request, res: Response) => {
  try {
    await prisma.taskDependency.delete({
      where: {
        id: req.params.depId,
      },
    });

    logger.info('Task dependency removed:', { taskId: req.params.id, dependencyId: req.params.depId });
    res.status(204).send();
  } catch (error) {
    logger.error('Failed to remove task dependency:', error);
    res.status(500).json({ error: 'Failed to remove task dependency' });
  }
});