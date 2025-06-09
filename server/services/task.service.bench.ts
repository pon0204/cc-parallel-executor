import { bench, describe } from 'vitest';
import { TaskService } from './task.service';
import { TaskBuilder, createParallelExecutionTasks } from '@/test/builders/task.builder';
import { ProjectBuilder } from '@/test/builders/project.builder';
import { mockDeep } from 'vitest-mock-extended';
import { ITaskRepository } from '../repositories/task.repository';
import { IProjectRepository } from '../repositories/project.repository';

describe('TaskService Performance Benchmarks', () => {
  const mockTaskRepository = mockDeep<ITaskRepository>();
  const mockProjectRepository = mockDeep<IProjectRepository>();
  const taskService = new TaskService(mockTaskRepository, mockProjectRepository);

  // Setup mock data
  const projectId = 'bench-project';
  const project = new ProjectBuilder().withId(projectId).build();
  
  bench('analyzeTaskDependencies - small project (10 tasks)', async () => {
    const tasks = new TaskBuilder().withProjectId(projectId).buildMany(10);
    
    mockProjectRepository.findById.mockResolvedValue(project);
    mockTaskRepository.findByProjectId.mockResolvedValue(tasks);
    mockTaskRepository.updateExecutionPhase.mockResolvedValue(undefined);

    await taskService.analyzeTaskDependencies(projectId);
  });

  bench('analyzeTaskDependencies - medium project (100 tasks)', async () => {
    const tasks = new TaskBuilder().withProjectId(projectId).buildMany(100);
    
    mockProjectRepository.findById.mockResolvedValue(project);
    mockTaskRepository.findByProjectId.mockResolvedValue(tasks);
    mockTaskRepository.updateExecutionPhase.mockResolvedValue(undefined);

    await taskService.analyzeTaskDependencies(projectId);
  });

  bench('analyzeTaskDependencies - large project (1000 tasks)', async () => {
    const tasks = new TaskBuilder().withProjectId(projectId).buildMany(1000);
    
    mockProjectRepository.findById.mockResolvedValue(project);
    mockTaskRepository.findByProjectId.mockResolvedValue(tasks);
    mockTaskRepository.updateExecutionPhase.mockResolvedValue(undefined);

    await taskService.analyzeTaskDependencies(projectId);
  });

  bench('createTask - single task creation', async () => {
    const createData = {
      title: 'Benchmark Task',
      projectId,
      type: 'BACKEND' as const,
      priority: 'HIGH' as const,
    };
    
    mockProjectRepository.findById.mockResolvedValue(project);
    mockTaskRepository.create.mockResolvedValue(new TaskBuilder().build());

    await taskService.createTask(createData);
  });

  bench('getTasksByProjectId - retrieve tasks', async () => {
    const tasks = new TaskBuilder().withProjectId(projectId).buildMany(50);
    
    mockProjectRepository.findById.mockResolvedValue(project);
    mockTaskRepository.findByProjectId.mockResolvedValue(tasks);

    await taskService.getTasksByProjectId(projectId);
  });

  bench('parallel task execution analysis', async () => {
    const tasks = createParallelExecutionTasks(projectId);
    
    mockProjectRepository.findById.mockResolvedValue(project);
    mockTaskRepository.findByProjectId.mockResolvedValue(tasks);
    mockTaskRepository.updateExecutionPhase.mockResolvedValue(undefined);

    await taskService.analyzeTaskDependencies(projectId);
  });

  bench('circular dependency detection', async () => {
    const taskA = new TaskBuilder().withId('A').build();
    const taskB = new TaskBuilder().withId('B').withParentId('A').build();
    const taskC = new TaskBuilder().withId('C').withParentId('B').build();

    mockTaskRepository.findById
      .mockResolvedValueOnce(taskA)
      .mockResolvedValueOnce(taskC)
      .mockResolvedValueOnce(taskB)
      .mockResolvedValueOnce(taskA);

    try {
      await taskService.updateTask('A', { parentId: 'C' });
    } catch {
      // Expected to throw
    }
  });
});

describe('Repository Performance Benchmarks', () => {
  bench('bulk task insertion simulation', () => {
    const tasks = new TaskBuilder().buildMany(1000);
    // Measure the time to generate and prepare bulk data
    const prepared = tasks.map(task => ({
      ...task,
      tags: JSON.stringify(task.tags),
    }));
    return prepared.length;
  });

  bench('complex query building', () => {
    // Simulate building complex where clauses
    const conditions = [];
    for (let i = 0; i < 100; i++) {
      conditions.push({
        OR: [
          { status: 'PENDING', priority: 'HIGH' },
          { status: 'RUNNING', progress: { gte: 50 } },
        ],
      });
    }
    return conditions.length;
  });
});