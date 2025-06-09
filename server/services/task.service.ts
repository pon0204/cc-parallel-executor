import { Task, TaskStatus as PrismaTaskStatus, TaskType, Priority } from '@prisma/client';
import { ITaskRepository } from '../repositories/task.repository';
import { IProjectRepository } from '../repositories/project.repository';
import { AppError, ErrorFactory } from '../utils/errors';
import { TaskStatus, TaskType as TaskTypeConstants, Priority as PriorityConstants } from '../utils/constants';

export interface CreateTaskData {
  title: string;
  description?: string;
  projectId: string;
  parentId?: string;
  type: TaskType;
  priority: Priority;
  estimatedMinutes?: number;
  tags?: string[];
  yamlContent?: string;
}

export interface UpdateTaskData {
  title?: string;
  description?: string;
  type?: TaskType;
  priority?: Priority;
  estimatedMinutes?: number;
  tags?: string[];
  yamlContent?: string;
  parentId?: string;
}

export interface TaskWithRelations extends Task {
  dependencies?: Task[];
  dependents?: Task[];
  children?: Task[];
  parent?: Task;
}

export class TaskService {
  constructor(
    private taskRepository: ITaskRepository,
    private projectRepository: IProjectRepository
  ) {}

  async getTaskById(id: string): Promise<Task> {
    const task = await this.taskRepository.findById(id);
    if (!task) {
      throw ErrorFactory.notFound('Task', id);
    }
    return task;
  }

  async getTasksByProjectId(projectId: string): Promise<Task[]> {
    // Validate project exists
    await this.projectRepository.findById(projectId);
    if (!await this.projectRepository.findById(projectId)) {
      throw ErrorFactory.notFound('Project', projectId);
    }

    return this.taskRepository.findByProjectId(projectId);
  }

  async getTasksByStatus(status: PrismaTaskStatus): Promise<Task[]> {
    // Validate status
    if (!Object.values(TaskStatus).includes(status as any)) {
      throw ErrorFactory.validation('Invalid task status', { status, validStatuses: Object.values(TaskStatus) });
    }

    return this.taskRepository.findByStatus(status);
  }

  async getRootTasks(projectId: string): Promise<Task[]> {
    // Validate project exists
    if (!await this.projectRepository.findById(projectId)) {
      throw ErrorFactory.notFound('Project', projectId);
    }

    return this.taskRepository.findRootTasks(projectId);
  }

  async getChildTasks(parentId: string): Promise<Task[]> {
    // Validate parent task exists
    await this.getTaskById(parentId);

    return this.taskRepository.findByParentId(parentId);
  }

  async createTask(data: CreateTaskData): Promise<Task> {
    // Validate project exists
    if (!await this.projectRepository.findById(data.projectId)) {
      throw ErrorFactory.notFound('Project', data.projectId);
    }

    // Validate parent task exists if provided
    if (data.parentId) {
      const parentTask = await this.taskRepository.findById(data.parentId);
      if (!parentTask) {
        throw ErrorFactory.notFound('Parent task', data.parentId);
      }

      // Validate parent belongs to same project
      if (parentTask.projectId !== data.projectId) {
        throw ErrorFactory.validation('Parent task must belong to the same project');
      }
    }

    // Validate task type
    if (!Object.values(TaskTypeConstants).includes(data.type as any)) {
      throw ErrorFactory.validation('Invalid task type', { 
        type: data.type, 
        validTypes: Object.values(TaskTypeConstants) 
      });
    }

    // Validate priority
    if (!Object.values(PriorityConstants).includes(data.priority as any)) {
      throw ErrorFactory.validation('Invalid priority', { 
        priority: data.priority, 
        validPriorities: Object.values(PriorityConstants) 
      });
    }

    // Validate estimated minutes
    if (data.estimatedMinutes !== undefined && data.estimatedMinutes < 0) {
      throw ErrorFactory.validation('Estimated minutes must be non-negative');
    }

    const taskData = {
      ...data,
      status: TaskStatus.PENDING as PrismaTaskStatus,
      progress: 0,
      tags: data.tags || [],
      estimatedMinutes: data.estimatedMinutes || null,
      yamlContent: data.yamlContent || null,
      deletedAt: null
    };

    return this.taskRepository.create(taskData);
  }

  async updateTask(id: string, data: UpdateTaskData): Promise<Task> {
    const existingTask = await this.getTaskById(id);

    // Validate parent task if being updated
    if (data.parentId !== undefined) {
      if (data.parentId === id) {
        throw ErrorFactory.validation('Task cannot be its own parent');
      }

      if (data.parentId) {
        const parentTask = await this.taskRepository.findById(data.parentId);
        if (!parentTask) {
          throw ErrorFactory.notFound('Parent task', data.parentId);
        }

        // Validate parent belongs to same project
        if (parentTask.projectId !== existingTask.projectId) {
          throw ErrorFactory.validation('Parent task must belong to the same project');
        }

        // Prevent circular dependencies
        if (await this.wouldCreateCircularDependency(id, data.parentId)) {
          throw ErrorFactory.validation('Cannot create circular dependency');
        }
      }
    }

    // Validate task type if being updated
    if (data.type && !Object.values(TaskTypeConstants).includes(data.type as any)) {
      throw ErrorFactory.validation('Invalid task type', { 
        type: data.type, 
        validTypes: Object.values(TaskTypeConstants) 
      });
    }

    // Validate priority if being updated
    if (data.priority && !Object.values(PriorityConstants).includes(data.priority as any)) {
      throw ErrorFactory.validation('Invalid priority', { 
        priority: data.priority, 
        validPriorities: Object.values(PriorityConstants) 
      });
    }

    // Validate estimated minutes if being updated
    if (data.estimatedMinutes !== undefined && data.estimatedMinutes < 0) {
      throw ErrorFactory.validation('Estimated minutes must be non-negative');
    }

    return this.taskRepository.update(id, data);
  }

  async updateTaskStatus(id: string, status: PrismaTaskStatus): Promise<Task> {
    // Validate status
    if (!Object.values(TaskStatus).includes(status as any)) {
      throw ErrorFactory.validation('Invalid task status', { 
        status, 
        validStatuses: Object.values(TaskStatus) 
      });
    }

    const task = await this.getTaskById(id);

    // Business logic for status transitions
    await this.validateStatusTransition(task.status, status);

    return this.taskRepository.updateStatus(id, status);
  }

  async updateTaskProgress(id: string, progress: number): Promise<Task> {
    if (progress < 0 || progress > 100) {
      throw ErrorFactory.validation('Progress must be between 0 and 100', { progress });
    }

    return this.taskRepository.updateProgress(id, progress);
  }

  async deleteTask(id: string, soft: boolean = true): Promise<void> {
    const task = await this.getTaskById(id);

    // Check if task has children
    const childTasks = await this.taskRepository.findByParentId(id);
    if (childTasks.length > 0 && !soft) {
      throw ErrorFactory.validation('Cannot hard delete task with child tasks. Use soft delete or delete children first.');
    }

    if (soft) {
      await this.taskRepository.softDelete(id);
    } else {
      await this.taskRepository.delete(id);
    }
  }

  async getTaskWithDependencies(id: string): Promise<TaskWithRelations> {
    const task = await this.taskRepository.findTaskWithDependencies(id);
    if (!task) {
      throw ErrorFactory.notFound('Task', id);
    }
    return task;
  }

  async getAvailableTasksForExecution(projectId: string): Promise<Task[]> {
    // Validate project exists
    if (!await this.projectRepository.findById(projectId)) {
      throw ErrorFactory.notFound('Project', projectId);
    }

    return this.taskRepository.findAvailableTasksForExecution(projectId);
  }

  async analyzeTaskDependencies(projectId: string): Promise<{
    phases: { phase: number; tasks: Task[] }[];
    totalPhases: number;
    parallelizable: boolean;
  }> {
    const tasks = await this.taskRepository.findByProjectId(projectId);
    
    if (tasks.length === 0) {
      return { phases: [], totalPhases: 0, parallelizable: false };
    }

    // Simple dependency analysis based on task types and names
    const phases: { phase: number; tasks: Task[] }[] = [];
    const assignedTasks = new Set<string>();
    let currentPhase = 1;

    // Phase 1: Infrastructure tasks (DATABASE, ENVIRONMENT, SETUP)
    const phase1Tasks = tasks.filter(task => 
      !assignedTasks.has(task.id) &&
      (task.type === 'DATABASE' || 
       task.type === 'ENVIRONMENT' ||
       task.title.toLowerCase().includes('setup') ||
       task.title.toLowerCase().includes('config'))
    );
    if (phase1Tasks.length > 0) {
      phases.push({ phase: currentPhase++, tasks: phase1Tasks });
      phase1Tasks.forEach(task => assignedTasks.add(task.id));
    }

    // Phase 2: Backend and Frontend development
    const phase2Tasks = tasks.filter(task => 
      !assignedTasks.has(task.id) &&
      (task.type === 'BACKEND' || 
       task.type === 'FRONTEND' ||
       task.type === 'API')
    );
    if (phase2Tasks.length > 0) {
      phases.push({ phase: currentPhase++, tasks: phase2Tasks });
      phase2Tasks.forEach(task => assignedTasks.add(task.id));
    }

    // Phase 3: Testing and Integration
    const phase3Tasks = tasks.filter(task => 
      !assignedTasks.has(task.id) &&
      (task.type === 'TESTING' || 
       task.title.toLowerCase().includes('test') ||
       task.title.toLowerCase().includes('integration'))
    );
    if (phase3Tasks.length > 0) {
      phases.push({ phase: currentPhase++, tasks: phase3Tasks });
      phase3Tasks.forEach(task => assignedTasks.add(task.id));
    }

    // Phase 4: Deployment and Documentation
    const phase4Tasks = tasks.filter(task => 
      !assignedTasks.has(task.id) &&
      (task.type === 'DEPLOYMENT' || 
       task.type === 'DOCUMENTATION' ||
       task.title.toLowerCase().includes('deploy') ||
       task.title.toLowerCase().includes('doc'))
    );
    if (phase4Tasks.length > 0) {
      phases.push({ phase: currentPhase++, tasks: phase4Tasks });
      phase4Tasks.forEach(task => assignedTasks.add(task.id));
    }

    // Remaining tasks in final phase
    const remainingTasks = tasks.filter(task => !assignedTasks.has(task.id));
    if (remainingTasks.length > 0) {
      phases.push({ phase: currentPhase, tasks: remainingTasks });
    }

    // Update execution phases in database
    for (const phaseData of phases) {
      const taskIds = phaseData.tasks.map(task => task.id);
      await this.taskRepository.updateExecutionPhase(taskIds, phaseData.phase);
    }

    return {
      phases,
      totalPhases: phases.length,
      parallelizable: phases.some(phase => phase.tasks.length > 1)
    };
  }

  // Private helper methods
  private async validateStatusTransition(currentStatus: PrismaTaskStatus, newStatus: PrismaTaskStatus): Promise<void> {
    const validTransitions: Record<string, string[]> = {
      [TaskStatus.PENDING]: [TaskStatus.QUEUED, TaskStatus.RUNNING, TaskStatus.FAILED],
      [TaskStatus.QUEUED]: [TaskStatus.RUNNING, TaskStatus.FAILED, TaskStatus.PENDING],
      [TaskStatus.RUNNING]: [TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.PENDING],
      [TaskStatus.COMPLETED]: [TaskStatus.RUNNING], // Allow re-running completed tasks
      [TaskStatus.FAILED]: [TaskStatus.PENDING, TaskStatus.QUEUED, TaskStatus.RUNNING]
    };

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      throw ErrorFactory.validation(
        `Invalid status transition from ${currentStatus} to ${newStatus}`,
        { currentStatus, newStatus, validTransitions: validTransitions[currentStatus] }
      );
    }
  }

  private async wouldCreateCircularDependency(taskId: string, parentId: string): Promise<boolean> {
    // Simple check: traverse up the parent chain to see if we encounter taskId
    let currentParentId = parentId;
    const visited = new Set<string>();

    while (currentParentId && !visited.has(currentParentId)) {
      if (currentParentId === taskId) {
        return true; // Circular dependency detected
      }

      visited.add(currentParentId);
      const parentTask = await this.taskRepository.findById(currentParentId);
      currentParentId = parentTask?.parentId || null;
    }

    return false;
  }
}