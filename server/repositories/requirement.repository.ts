import { Requirement, RequirementStatus as PrismaRequirementStatus, RequirementType, Priority } from '@prisma/client';
import { BaseRepository } from './base.repository';
import { RequirementStatus } from '../utils/constants';

export interface IRequirementRepository {
  findById(id: string): Promise<Requirement | null>;
  findByProjectId(projectId: string): Promise<Requirement[]>;
  findByStatus(status: PrismaRequirementStatus): Promise<Requirement[]>;
  findByType(type: RequirementType): Promise<Requirement[]>;
  findByPriority(priority: Priority): Promise<Requirement[]>;
  findByParentId(parentId: string): Promise<Requirement[]>;
  findRootRequirements(projectId: string): Promise<Requirement[]>;
  create(data: Omit<Requirement, 'id' | 'createdAt' | 'updatedAt'>): Promise<Requirement>;
  update(id: string, data: Partial<Omit<Requirement, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Requirement>;
  updateStatus(id: string, status: PrismaRequirementStatus): Promise<Requirement>;
  delete(id: string): Promise<void>;
  softDelete(id: string): Promise<Requirement>;
  findRequirementWithChildren(requirementId: string): Promise<Requirement & { children: Requirement[] } | null>;
  findRequirementsByTag(projectId: string, tag: string): Promise<Requirement[]>;
}

export class RequirementRepository extends BaseRepository implements IRequirementRepository {
  async findById(id: string): Promise<Requirement | null> {
    return this.prisma.requirement.findUnique({
      where: { id }
    });
  }

  async findByProjectId(projectId: string): Promise<Requirement[]> {
    return this.prisma.requirement.findMany({
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

  async findByStatus(status: PrismaRequirementStatus): Promise<Requirement[]> {
    return this.prisma.requirement.findMany({
      where: { 
        status,
        deletedAt: null
      },
      orderBy: { updatedAt: 'desc' }
    });
  }

  async findByType(type: RequirementType): Promise<Requirement[]> {
    return this.prisma.requirement.findMany({
      where: { 
        type,
        deletedAt: null
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'asc' }
      ]
    });
  }

  async findByPriority(priority: Priority): Promise<Requirement[]> {
    return this.prisma.requirement.findMany({
      where: { 
        priority,
        deletedAt: null
      },
      orderBy: { createdAt: 'asc' }
    });
  }

  async findByParentId(parentId: string): Promise<Requirement[]> {
    return this.prisma.requirement.findMany({
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

  async findRootRequirements(projectId: string): Promise<Requirement[]> {
    return this.prisma.requirement.findMany({
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

  async create(data: Omit<Requirement, 'id' | 'createdAt' | 'updatedAt'>): Promise<Requirement> {
    // Validate parent requirement exists if parentId is provided
    if (data.parentId) {
      await this.ensureExists('requirement', data.parentId);
    }

    // Validate project exists
    await this.ensureExists('project', data.projectId);

    return this.prisma.requirement.create({
      data
    });
  }

  async update(id: string, data: Partial<Omit<Requirement, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Requirement> {
    await this.ensureExists('requirement', id);

    // Validate parent requirement exists if parentId is being updated
    if (data.parentId) {
      await this.ensureExists('requirement', data.parentId);
    }

    return this.prisma.requirement.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date()
      }
    });
  }

  async updateStatus(id: string, status: PrismaRequirementStatus): Promise<Requirement> {
    await this.ensureExists('requirement', id);

    const updateData: any = {
      status,
      updatedAt: new Date()
    };

    // Set completion date when status changes to COMPLETED
    if (status === RequirementStatus.COMPLETED) {
      updateData.completedAt = new Date();
    } else if (status !== RequirementStatus.COMPLETED) {
      // Clear completion date if status changes away from COMPLETED
      updateData.completedAt = null;
    }

    return this.prisma.requirement.update({
      where: { id },
      data: updateData
    });
  }

  async delete(id: string): Promise<void> {
    await this.ensureExists('requirement', id);

    // Check if requirement has children
    const childRequirements = await this.findByParentId(id);
    if (childRequirements.length > 0) {
      throw new Error('Cannot delete requirement with child requirements. Delete children first or use soft delete.');
    }

    await this.prisma.requirement.delete({
      where: { id }
    });
  }

  async softDelete(id: string): Promise<Requirement> {
    await this.ensureExists('requirement', id);

    return this.prisma.requirement.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        updatedAt: new Date()
      }
    });
  }

  async findRequirementWithChildren(requirementId: string): Promise<Requirement & { children: Requirement[] } | null> {
    const requirement = await this.prisma.requirement.findUnique({
      where: { id: requirementId },
      include: {
        children: {
          where: { deletedAt: null },
          orderBy: [
            { priority: 'desc' },
            { createdAt: 'asc' }
          ]
        }
      }
    });

    return requirement;
  }

  async findRequirementsByTag(projectId: string, tag: string): Promise<Requirement[]> {
    return this.prisma.requirement.findMany({
      where: {
        projectId,
        tags: {
          has: tag
        },
        deletedAt: null
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'asc' }
      ]
    });
  }

  // Additional utility methods for requirement analysis
  async getRequirementStatistics(projectId: string): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byType: Record<string, number>;
    byPriority: Record<string, number>;
    completionRate: number;
  }> {
    const requirements = await this.findByProjectId(projectId);
    
    const stats = {
      total: requirements.length,
      byStatus: {} as Record<string, number>,
      byType: {} as Record<string, number>,
      byPriority: {} as Record<string, number>,
      completionRate: 0
    };

    // Calculate statistics
    requirements.forEach(req => {
      // Status distribution
      stats.byStatus[req.status] = (stats.byStatus[req.status] || 0) + 1;
      
      // Type distribution
      stats.byType[req.type] = (stats.byType[req.type] || 0) + 1;
      
      // Priority distribution
      stats.byPriority[req.priority] = (stats.byPriority[req.priority] || 0) + 1;
    });

    // Calculate completion rate
    const completedCount = stats.byStatus[RequirementStatus.COMPLETED] || 0;
    stats.completionRate = requirements.length > 0 ? (completedCount / requirements.length) * 100 : 0;

    return stats;
  }

  async findBlockingRequirements(projectId: string): Promise<Requirement[]> {
    // Find high priority requirements that are not completed
    return this.prisma.requirement.findMany({
      where: {
        projectId,
        priority: 'HIGH',
        status: {
          not: RequirementStatus.COMPLETED
        },
        deletedAt: null
      },
      orderBy: { createdAt: 'asc' }
    });
  }

  async findRequirementsReadyForImplementation(projectId: string): Promise<Requirement[]> {
    // Find requirements that are approved but not yet in progress
    return this.prisma.requirement.findMany({
      where: {
        projectId,
        status: RequirementStatus.APPROVED,
        deletedAt: null
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'asc' }
      ]
    });
  }
}