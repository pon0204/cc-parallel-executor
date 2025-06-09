import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TaskService } from './task.service';
import { ITaskRepository } from '../repositories/task.repository';
import { IProjectRepository } from '../repositories/project.repository';
import { ErrorFactory } from '../utils/errors';
import { TaskBuilder, createParallelExecutionTasks } from '@/test/builders/task.builder';
import { ProjectBuilder } from '@/test/builders/project.builder';
import { mockDeep } from 'vitest-mock-extended';

describe('TaskService', () => {
  let taskService: TaskService;
  let mockTaskRepository: ITaskRepository;
  let mockProjectRepository: IProjectRepository;

  beforeEach(() => {
    mockTaskRepository = mockDeep<ITaskRepository>();
    mockProjectRepository = mockDeep<IProjectRepository>();
    taskService = new TaskService(mockTaskRepository, mockProjectRepository);
    vi.clearAllMocks();
  });

  describe('getTaskById', () => {
    it('should return a task when it exists', async () => {
      const task = new TaskBuilder().build();
      mockTaskRepository.findById.mockResolvedValue(task);

      const result = await taskService.getTaskById(task.id);

      expect(result).toEqual(task);
      expect(mockTaskRepository.findById).toHaveBeenCalledWith(task.id);
    });

    it('should throw NotFoundError when task does not exist', async () => {
      const taskId = 'non-existent-id';
      mockTaskRepository.findById.mockResolvedValue(null);

      await expect(taskService.getTaskById(taskId))
        .rejects
        .toThrow(ErrorFactory.notFound('Task', taskId));
    });
  });

  describe('getTasksByProjectId', () => {
    it('should return tasks for existing project', async () => {
      const projectId = 'project-id';
      const project = new ProjectBuilder().withId(projectId).build();
      const tasks = new TaskBuilder().withProjectId(projectId).buildMany(5);

      mockProjectRepository.findById.mockResolvedValue(project);
      mockTaskRepository.findByProjectId.mockResolvedValue(tasks);

      const result = await taskService.getTasksByProjectId(projectId);

      expect(result).toEqual(tasks);
      expect(mockTaskRepository.findByProjectId).toHaveBeenCalledWith(projectId);
    });

    it('should throw error for non-existent project', async () => {
      const projectId = 'non-existent';
      mockProjectRepository.findById.mockResolvedValue(null);

      await expect(taskService.getTasksByProjectId(projectId))
        .rejects
        .toThrow(ErrorFactory.notFound('Project', projectId));
    });
  });

  describe('createTask', () => {
    it('should create task with valid data', async () => {
      const project = new ProjectBuilder().build();
      const createData = {
        name: 'Test Task',
        description: 'Test Description',
        projectId: project.id,
        taskType: 'backend',
        priority: 10,
        instruction: 'Build API endpoints',
      };

      const expectedTask = new TaskBuilder()
        .withProjectId(project.id)
        .withName(createData.name)
        .withTaskType(createData.taskType)
        .build();

      mockProjectRepository.findById.mockResolvedValue(project);
      mockTaskRepository.create.mockResolvedValue(expectedTask);

      const result = await taskService.createTask(createData);

      expect(result).toEqual(expectedTask);
      expect(mockTaskRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ...createData,
          status: 'PENDING',
          assignedTo: null,
          outputData: null,
          worktreePath: null,
        })
      );
    });

    it('should validate parent task exists and belongs to same project', async () => {
      const project = new ProjectBuilder().build();
      const parentTask = new TaskBuilder()
        .withId('parent-id')
        .withProjectId(project.id)
        .build();

      const createData = {
        name: 'Child Task',
        projectId: project.id,
        parentTaskId: parentTask.id,
        taskType: 'backend',
        priority: 5,
      };

      mockProjectRepository.findById.mockResolvedValue(project);
      mockTaskRepository.findById.mockResolvedValue(parentTask);
      mockTaskRepository.create.mockResolvedValue(new TaskBuilder().build());

      await taskService.createTask(createData);

      expect(mockTaskRepository.findById).toHaveBeenCalledWith(parentTask.id);
    });

    it('should reject parent from different project', async () => {
      const project = new ProjectBuilder().build();
      const differentProject = new ProjectBuilder().build();
      const parentTask = new TaskBuilder()
        .withProjectId(differentProject.id)
        .build();

      const createData = {
        name: 'Child Task',
        projectId: project.id,
        parentTaskId: parentTask.id,
        taskType: 'backend',
        priority: 5,
      };

      mockProjectRepository.findById.mockResolvedValue(project);
      mockTaskRepository.findById.mockResolvedValue(parentTask);

      await expect(taskService.createTask(createData))
        .rejects
        .toThrow('Parent task must belong to the same project');
    });
  });

  describe('updateTaskStatus', () => {
    it('should update status with valid transition', async () => {
      const task = new TaskBuilder()
        .withStatus('PENDING')
        .build();

      const updatedTask = { ...task, status: 'RUNNING' as const };

      mockTaskRepository.findById.mockResolvedValue(task);
      mockTaskRepository.updateStatus.mockResolvedValue(updatedTask);

      const result = await taskService.updateTaskStatus(task.id, 'RUNNING');

      expect(result).toEqual(updatedTask);
      expect(mockTaskRepository.updateStatus).toHaveBeenCalledWith(task.id, 'RUNNING');
    });

    it('should reject invalid status transition', async () => {
      const task = new TaskBuilder()
        .withStatus('PENDING')
        .build();

      mockTaskRepository.findById.mockResolvedValue(task);

      await expect(taskService.updateTaskStatus(task.id, 'COMPLETED'))
        .rejects
        .toThrow('Invalid status transition');
    });
  });

  describe('updateTaskProgress', () => {
    it('should update progress within valid range', async () => {
      const task = new TaskBuilder().build();
      const progress = 75;

      mockTaskRepository.updateProgress.mockResolvedValue({ ...task, progress });

      const result = await taskService.updateTaskProgress(task.id, progress);

      expect(result.progress).toBe(progress);
      expect(mockTaskRepository.updateProgress).toHaveBeenCalledWith(task.id, progress);
    });

    it('should reject invalid progress values', async () => {
      await expect(taskService.updateTaskProgress('task-id', -10))
        .rejects
        .toThrow('Progress must be between 0 and 100');

      await expect(taskService.updateTaskProgress('task-id', 150))
        .rejects
        .toThrow('Progress must be between 0 and 100');
    });
  });

  describe('analyzeTaskDependencies', () => {
    it('should analyze tasks and create execution phases', async () => {
      const projectId = 'project-id';
      const tasks = createParallelExecutionTasks(projectId);

      mockProjectRepository.findById.mockResolvedValue(new ProjectBuilder().withId(projectId).build());
      mockTaskRepository.findByProjectId.mockResolvedValue(tasks);
      mockTaskRepository.updateExecutionPhase.mockResolvedValue(undefined);

      const result = await taskService.analyzeTaskDependencies(projectId);

      expect(result.totalPhases).toBeGreaterThan(0);
      expect(result.parallelizable).toBe(true);
      expect(result.phases).toHaveLength(4); // Based on createParallelExecutionTasks

      // Verify phase assignment calls
      expect(mockTaskRepository.updateExecutionPhase).toHaveBeenCalled();
    });

    it('should handle projects with no tasks', async () => {
      const projectId = 'empty-project';

      mockProjectRepository.findById.mockResolvedValue(new ProjectBuilder().withId(projectId).build());
      mockTaskRepository.findByProjectId.mockResolvedValue([]);

      const result = await taskService.analyzeTaskDependencies(projectId);

      expect(result).toEqual({
        phases: [],
        totalPhases: 0,
        parallelizable: false,
      });
    });
  });

  describe('getAvailableTasksForExecution', () => {
    it('should return tasks ready for execution', async () => {
      const projectId = 'project-id';
      const availableTasks = [
        new TaskBuilder().withStatus('PENDING').build(),
        new TaskBuilder().withStatus('QUEUED').build(),
      ];

      mockProjectRepository.findById.mockResolvedValue(new ProjectBuilder().withId(projectId).build());
      mockTaskRepository.findAvailableTasksForExecution.mockResolvedValue(availableTasks);

      const result = await taskService.getAvailableTasksForExecution(projectId);

      expect(result).toEqual(availableTasks);
    });
  });

  describe('deleteTask', () => {
    it('should soft delete by default', async () => {
      const task = new TaskBuilder().build();

      mockTaskRepository.findById.mockResolvedValue(task);
      mockTaskRepository.findByParentId.mockResolvedValue([]);
      mockTaskRepository.softDelete.mockResolvedValue({ ...task, deletedAt: new Date() });

      await taskService.deleteTask(task.id);

      expect(mockTaskRepository.softDelete).toHaveBeenCalledWith(task.id);
      expect(mockTaskRepository.delete).not.toHaveBeenCalled();
    });

    it('should prevent hard delete of task with children', async () => {
      const parentTask = new TaskBuilder().build();
      const childTasks = new TaskBuilder().buildMany(2);

      mockTaskRepository.findById.mockResolvedValue(parentTask);
      mockTaskRepository.findByParentId.mockResolvedValue(childTasks);

      await expect(taskService.deleteTask(parentTask.id, false))
        .rejects
        .toThrow('Cannot hard delete task with child tasks');
    });
  });

  describe('circular dependency detection', () => {
    it('should detect circular dependencies', async () => {
      const projectId = 'test-project';
      const taskA = new TaskBuilder().withId('A').withProjectId(projectId).build();
      const taskB = new TaskBuilder().withId('B').withProjectId(projectId).withParentTaskId('A').build();
      const taskC = new TaskBuilder().withId('C').withProjectId(projectId).withParentTaskId('B').build();

      // Try to make A parent of C (creating circle: A -> B -> C -> A)
      mockTaskRepository.findById
        .mockResolvedValueOnce(taskA) // getTaskById
        .mockResolvedValueOnce(taskC) // Parent lookup
        .mockResolvedValueOnce(taskB) // Parent of C
        .mockResolvedValueOnce(taskA); // Parent of B

      await expect(taskService.updateTask('A', { parentTaskId: 'C' }))
        .rejects
        .toThrow('Cannot create circular dependency');
    });
  });
});

describe('TaskService - Performance Tests', () => {
  it('should handle large task hierarchies efficiently', async () => {
    const mockTaskRepository = mockDeep<ITaskRepository>();
    const mockProjectRepository = mockDeep<IProjectRepository>();
    const service = new TaskService(mockTaskRepository, mockProjectRepository);

    const projectId = 'perf-test-project';
    const largeTasks = new TaskBuilder().withProjectId(projectId).buildMany(1000);

    mockProjectRepository.findById.mockResolvedValue(new ProjectBuilder().withId(projectId).build());
    mockTaskRepository.findByProjectId.mockResolvedValue(largeTasks);
    mockTaskRepository.updateExecutionPhase.mockResolvedValue(undefined);

    const start = performance.now();
    await service.analyzeTaskDependencies(projectId);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(1000); // Should complete within 1 second
  });
});