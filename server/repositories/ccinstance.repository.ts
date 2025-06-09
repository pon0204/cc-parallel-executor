import { CCInstance, CCInstanceStatus, CCInstanceType } from '@prisma/client';
import { BaseRepository } from './base.repository';
import { CCInstanceStatus as CCInstanceStatusConstants, CCInstanceType as CCInstanceTypeConstants } from '../utils/constants';

export interface ICCInstanceRepository {
  findById(id: string): Promise<CCInstance | null>;
  findByProjectId(projectId: string): Promise<CCInstance[]>;
  findByStatus(status: CCInstanceStatus): Promise<CCInstance[]>;
  findByType(type: CCInstanceType): Promise<CCInstance[]>;
  findByParentId(parentId: string): Promise<CCInstance[]>;
  findActiveInstances(projectId?: string): Promise<CCInstance[]>;
  findByTaskId(taskId: string): Promise<CCInstance | null>;
  findByWorktreePath(worktreePath: string): Promise<CCInstance | null>;
  create(data: Omit<CCInstance, 'id' | 'createdAt' | 'updatedAt'>): Promise<CCInstance>;
  update(id: string, data: Partial<Omit<CCInstance, 'id' | 'createdAt' | 'updatedAt'>>): Promise<CCInstance>;
  updateStatus(id: string, status: CCInstanceStatus): Promise<CCInstance>;
  updateProgress(id: string, progress: number): Promise<CCInstance>;
  delete(id: string): Promise<void>;
  softDelete(id: string): Promise<CCInstance>;
  findInstanceWithRelations(instanceId: string): Promise<CCInstance & { 
    children: CCInstance[], 
    parent: CCInstance | null,
    task: any | null
  } | null>;
  cleanup(maxAgeHours?: number): Promise<number>;
}

export class CCInstanceRepository extends BaseRepository implements ICCInstanceRepository {
  async findById(id: string): Promise<CCInstance | null> {
    return this.prisma.cCInstance.findUnique({
      where: { id }
    });
  }

  async findByProjectId(projectId: string): Promise<CCInstance[]> {
    return this.prisma.cCInstance.findMany({
      where: { 
        projectId,
        deletedAt: null
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findByStatus(status: CCInstanceStatus): Promise<CCInstance[]> {
    return this.prisma.cCInstance.findMany({
      where: { 
        status,
        deletedAt: null
      },
      orderBy: { updatedAt: 'desc' }
    });
  }

  async findByType(type: CCInstanceType): Promise<CCInstance[]> {
    return this.prisma.cCInstance.findMany({
      where: { 
        type,
        deletedAt: null
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findByParentId(parentId: string): Promise<CCInstance[]> {
    return this.prisma.cCInstance.findMany({
      where: { 
        parentInstanceId: parentId,
        deletedAt: null
      },
      orderBy: { createdAt: 'asc' }
    });
  }

  async findActiveInstances(projectId?: string): Promise<CCInstance[]> {
    const where: any = {
      status: {
        in: [
          CCInstanceStatusConstants.STARTING,
          CCInstanceStatusConstants.RUNNING,
          CCInstanceStatusConstants.WAITING
        ]
      },
      deletedAt: null
    };

    if (projectId) {
      where.projectId = projectId;
    }

    return this.prisma.cCInstance.findMany({
      where,
      orderBy: { createdAt: 'asc' }
    });
  }

  async findByTaskId(taskId: string): Promise<CCInstance | null> {
    return this.prisma.cCInstance.findFirst({
      where: { 
        taskId,
        deletedAt: null
      },
      orderBy: { createdAt: 'desc' } // Get the most recent instance for this task
    });
  }

  async findByWorktreePath(worktreePath: string): Promise<CCInstance | null> {
    return this.prisma.cCInstance.findFirst({
      where: { 
        worktreePath,
        deletedAt: null
      }
    });
  }

  async create(data: Omit<CCInstance, 'id' | 'createdAt' | 'updatedAt'>): Promise<CCInstance> {
    // Validate project exists
    await this.ensureExists('project', data.projectId);

    // Validate parent instance exists if parentInstanceId is provided
    if (data.parentInstanceId) {
      await this.ensureExists('cCInstance', data.parentInstanceId);
    }

    // Validate task exists if taskId is provided
    if (data.taskId) {
      await this.ensureExists('task', data.taskId);
    }

    return this.prisma.cCInstance.create({
      data: {
        ...data,
        progress: data.progress || 0,
      }
    });
  }

  async update(id: string, data: Partial<Omit<CCInstance, 'id' | 'createdAt' | 'updatedAt'>>): Promise<CCInstance> {
    await this.ensureExists('cCInstance', id);

    // Validate parent instance exists if parentInstanceId is being updated
    if (data.parentInstanceId) {
      await this.ensureExists('cCInstance', data.parentInstanceId);
    }

    // Validate task exists if taskId is being updated
    if (data.taskId) {
      await this.ensureExists('task', data.taskId);
    }

    return this.prisma.cCInstance.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date()
      }
    });
  }

  async updateStatus(id: string, status: CCInstanceStatus): Promise<CCInstance> {
    await this.ensureExists('cCInstance', id);

    const updateData: any = {
      status,
      updatedAt: new Date()
    };

    // Auto-set timestamps based on status
    switch (status) {
      case CCInstanceStatusConstants.STARTING:
        updateData.startedAt = new Date();
        break;
      case CCInstanceStatusConstants.RUNNING:
        if (!updateData.startedAt) {
          updateData.startedAt = new Date();
        }
        break;
      case CCInstanceStatusConstants.COMPLETED:
        updateData.progress = 100;
        updateData.finishedAt = new Date();
        break;
      case CCInstanceStatusConstants.FAILED:
      case CCInstanceStatusConstants.TERMINATED:
        updateData.finishedAt = new Date();
        break;
    }

    return this.prisma.cCInstance.update({
      where: { id },
      data: updateData
    });
  }

  async updateProgress(id: string, progress: number): Promise<CCInstance> {
    await this.ensureExists('cCInstance', id);

    // Validate progress is between 0 and 100
    if (progress < 0 || progress > 100) {
      throw new Error('Progress must be between 0 and 100');
    }

    const updateData: any = {
      progress,
      updatedAt: new Date()
    };

    // Auto-update status based on progress
    if (progress === 100) {
      updateData.status = CCInstanceStatusConstants.COMPLETED;
      updateData.finishedAt = new Date();
    } else if (progress > 0) {
      updateData.status = CCInstanceStatusConstants.RUNNING;
      if (!updateData.startedAt) {
        updateData.startedAt = new Date();
      }
    }

    return this.prisma.cCInstance.update({
      where: { id },
      data: updateData
    });
  }

  async delete(id: string): Promise<void> {
    await this.ensureExists('cCInstance', id);

    // Check if instance has children
    const childInstances = await this.findByParentId(id);
    if (childInstances.length > 0) {
      throw new Error('Cannot delete CC instance with child instances. Terminate children first or use soft delete.');
    }

    await this.prisma.cCInstance.delete({
      where: { id }
    });
  }

  async softDelete(id: string): Promise<CCInstance> {
    await this.ensureExists('cCInstance', id);

    return this.prisma.cCInstance.update({
      where: { id },
      data: {
        status: CCInstanceStatusConstants.TERMINATED,
        deletedAt: new Date(),
        finishedAt: new Date(),
        updatedAt: new Date()
      }
    });
  }

  async findInstanceWithRelations(instanceId: string): Promise<CCInstance & { 
    children: CCInstance[], 
    parent: CCInstance | null,
    task: any | null
  } | null> {
    const instance = await this.prisma.cCInstance.findUnique({
      where: { id: instanceId },
      include: {
        children: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' }
        },
        parent: true,
        task: true
      }
    });

    return instance;
  }

  async cleanup(maxAgeHours: number = 24): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - maxAgeHours);

    // Find old instances that are not active
    const instancesToCleanup = await this.prisma.cCInstance.findMany({
      where: {
        createdAt: {
          lt: cutoffDate
        },
        status: {
          in: [
            CCInstanceStatusConstants.COMPLETED,
            CCInstanceStatusConstants.FAILED,
            CCInstanceStatusConstants.TERMINATED
          ]
        },
        deletedAt: null
      }
    });

    // Soft delete old instances
    if (instancesToCleanup.length > 0) {
      await this.prisma.cCInstance.updateMany({
        where: {
          id: {
            in: instancesToCleanup.map(instance => instance.id)
          }
        },
        data: {
          deletedAt: new Date(),
          updatedAt: new Date()
        }
      });
    }

    return instancesToCleanup.length;
  }

  // Additional utility methods for CC instance management
  async getParallelExecutionStatistics(projectId: string): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byType: Record<string, number>;
    activeCount: number;
    maxParallelReached: boolean;
    avgExecutionTime: number;
  }> {
    const instances = await this.findByProjectId(projectId);
    
    const stats = {
      total: instances.length,
      byStatus: {} as Record<string, number>,
      byType: {} as Record<string, number>,
      activeCount: 0,
      maxParallelReached: false,
      avgExecutionTime: 0
    };

    let totalExecutionTime = 0;
    let completedCount = 0;

    // Calculate statistics
    instances.forEach(instance => {
      // Status distribution
      stats.byStatus[instance.status] = (stats.byStatus[instance.status] || 0) + 1;
      
      // Type distribution
      stats.byType[instance.type] = (stats.byType[instance.type] || 0) + 1;
      
      // Count active instances
      if ([CCInstanceStatusConstants.STARTING, CCInstanceStatusConstants.RUNNING, CCInstanceStatusConstants.WAITING].includes(instance.status)) {
        stats.activeCount++;
      }

      // Calculate execution time for completed instances
      if (instance.status === CCInstanceStatusConstants.COMPLETED && instance.startedAt && instance.finishedAt) {
        const executionTime = instance.finishedAt.getTime() - instance.startedAt.getTime();
        totalExecutionTime += executionTime;
        completedCount++;
      }
    });

    // Calculate average execution time in minutes
    stats.avgExecutionTime = completedCount > 0 ? (totalExecutionTime / completedCount) / (1000 * 60) : 0;

    return stats;
  }

  async findStaleInstances(maxIdleMinutes: number = 30): Promise<CCInstance[]> {
    const cutoffDate = new Date();
    cutoffDate.setMinutes(cutoffDate.getMinutes() - maxIdleMinutes);

    return this.prisma.cCInstance.findMany({
      where: {
        status: {
          in: [
            CCInstanceStatusConstants.STARTING,
            CCInstanceStatusConstants.RUNNING,
            CCInstanceStatusConstants.WAITING
          ]
        },
        updatedAt: {
          lt: cutoffDate
        },
        deletedAt: null
      },
      orderBy: { updatedAt: 'asc' }
    });
  }

  async findInstancesByWorktreePattern(pattern: string): Promise<CCInstance[]> {
    return this.prisma.cCInstance.findMany({
      where: {
        worktreePath: {
          contains: pattern
        },
        deletedAt: null
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async updateLastActivity(id: string): Promise<CCInstance> {
    await this.ensureExists('cCInstance', id);

    return this.prisma.cCInstance.update({
      where: { id },
      data: {
        updatedAt: new Date()
      }
    });
  }
}