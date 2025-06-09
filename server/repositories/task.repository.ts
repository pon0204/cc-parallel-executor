import { Task, TaskStatus as PrismaTaskStatus, TaskType, Priority } from '@prisma/client';
import { BaseRepository } from './base.repository';
import { TaskStatus } from '../utils/constants';

export interface ITaskRepository {
  findById(id: string): Promise<Task | null>;
  findByProjectId(projectId: string): Promise<Task[]>;
  findByStatus(status: PrismaTaskStatus): Promise<Task[]>;
  findByParentId(parentId: string): Promise<Task[]>;
  findRootTasks(projectId: string): Promise<Task[]>;
  findDependentTasks(taskId: string): Promise<Task[]>;
  create(data: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<Task>;
  update(id: string, data: Partial<Omit<Task, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Task>;
  updateStatus(id: string, status: PrismaTaskStatus): Promise<Task>;
  updateProgress(id: string, progress: number): Promise<Task>;
  delete(id: string): Promise<void>;
  softDelete(id: string): Promise<Task>;
  findTaskWithDependencies(taskId: string): Promise<Task & { dependencies: Task[], dependents: Task[] } | null>;
}

export class TaskRepository extends BaseRepository implements ITaskRepository {
  async findById(id: string): Promise<Task | null> {
    return this.prisma.task.findUnique({
      where: { id }
    });
  }

  async findByProjectId(projectId: string): Promise<Task[]> {
    return this.prisma.task.findMany({
      where: { 
        projectId,
        deletedAt: null
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'asc' }
      ]
    });
  }

  async findByStatus(status: PrismaTaskStatus): Promise<Task[]> {
    return this.prisma.task.findMany({
      where: { 
        status,
        deletedAt: null
      },
      orderBy: { updatedAt: 'desc' }
    });
  }

  async findByParentId(parentId: string): Promise<Task[]> {
    return this.prisma.task.findMany({
      where: { 
        parentId,
        deletedAt: null
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'asc' }
      ]
    });
  }

  async findRootTasks(projectId: string): Promise<Task[]> {
    return this.prisma.task.findMany({
      where: {
        projectId,
        parentId: null,
        deletedAt: null
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'asc' }
      ]
    });
  }

  async findDependentTasks(taskId: string): Promise<Task[]> {
    // Find tasks that depend on this task
    return this.prisma.task.findMany({
      where: {
        dependencies: {
          some: {
            id: taskId
          }
        },
        deletedAt: null
      },
      orderBy: { priority: 'desc' }
    });
  }

  async create(data: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<Task> {
    // Validate parent task exists if parentId is provided
    if (data.parentId) {
      await this.ensureExists('task', data.parentId);
    }

    // Validate project exists
    await this.ensureExists('project', data.projectId);

    return this.prisma.task.create({
      data: {
        ...data,
        progress: data.progress || 0,
      }
    });
  }

  async update(id: string, data: Partial<Omit<Task, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Task> {
    await this.ensureExists('task', id);

    // Validate parent task exists if parentId is being updated
    if (data.parentId) {
      await this.ensureExists('task', data.parentId);
    }

    return this.prisma.task.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date()
      }
    });
  }

  async updateStatus(id: string, status: PrismaTaskStatus): Promise<Task> {
    await this.ensureExists('task', id);

    const updateData: any = {
      status,
      updatedAt: new Date()
    };

    // Auto-set progress based on status
    switch (status) {
      case TaskStatus.PENDING:
      case TaskStatus.QUEUED:
        updateData.progress = 0;
        break;
      case TaskStatus.RUNNING:
        // Keep current progress if already set, otherwise set to minimal progress
        break;
      case TaskStatus.COMPLETED:
        updateData.progress = 100;
        updateData.completedAt = new Date();
        break;
      case TaskStatus.FAILED:
        updateData.failedAt = new Date();
        break;
    }

    return this.prisma.task.update({
      where: { id },
      data: updateData
    });
  }

  async updateProgress(id: string, progress: number): Promise<Task> {
    await this.ensureExists('task', id);

    // Validate progress is between 0 and 100
    if (progress < 0 || progress > 100) {
      throw new Error('Progress must be between 0 and 100');
    }

    const updateData: any = {
      progress,
      updatedAt: new Date()
    };

    // Auto-update status based on progress
    if (progress === 0) {
      updateData.status = TaskStatus.PENDING;
    } else if (progress === 100) {
      updateData.status = TaskStatus.COMPLETED;
      updateData.completedAt = new Date();
    } else if (progress > 0) {
      updateData.status = TaskStatus.RUNNING;
    }

    return this.prisma.task.update({
      where: { id },
      data: updateData
    });
  }

  async delete(id: string): Promise<void> {
    await this.ensureExists('task', id);

    // Check if task has children
    const childTasks = await this.findByParentId(id);
    if (childTasks.length > 0) {
      throw new Error('Cannot delete task with child tasks. Delete children first or use soft delete.');
    }

    await this.prisma.task.delete({
      where: { id }
    });
  }

  async softDelete(id: string): Promise<Task> {
    await this.ensureExists('task', id);

    return this.prisma.task.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        updatedAt: new Date()
      }
    });
  }

  async findTaskWithDependencies(taskId: string): Promise<Task & { dependencies: Task[], dependents: Task[] } | null> {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        dependencies: {
          where: { deletedAt: null }
        },
        dependents: {
          where: { deletedAt: null }
        }
      }
    });

    return task;
  }

  // Additional utility methods for parallel execution
  async findAvailableTasksForExecution(projectId: string): Promise<Task[]> {
    // Find tasks that are PENDING or QUEUED and have no incomplete dependencies
    return this.prisma.task.findMany({
      where: {
        projectId,
        status: {
          in: [TaskStatus.PENDING, TaskStatus.QUEUED]
        },
        deletedAt: null,
        // Only include tasks where all dependencies are completed
        dependencies: {
          every: {
            status: TaskStatus.COMPLETED
          }
        }
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'asc' }
      ]
    });
  }

  async findTasksByExecutionPhase(projectId: string, phase: number): Promise<Task[]> {
    return this.prisma.task.findMany({
      where: {
        projectId,
        executionPhase: phase,
        deletedAt: null
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'asc' }
      ]
    });
  }

  async updateExecutionPhase(taskIds: string[], phase: number): Promise<void> {
    await this.prisma.task.updateMany({
      where: {
        id: {
          in: taskIds
        }
      },
      data: {
        executionPhase: phase,
        updatedAt: new Date()
      }
    });
  }
}