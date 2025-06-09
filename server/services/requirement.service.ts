import { Requirement, RequirementStatus as PrismaRequirementStatus, RequirementType, Priority } from '@prisma/client';
import { IRequirementRepository } from '../repositories/requirement.repository';
import { IProjectRepository } from '../repositories/project.repository';
import { AppError, ErrorFactory } from '../utils/errors';
import { RequirementStatus, RequirementType as RequirementTypeConstants, Priority as PriorityConstants } from '../utils/constants';

export interface CreateRequirementData {
  title: string;
  description?: string;
  projectId: string;
  parentId?: string;
  type: RequirementType;
  priority: Priority;
  acceptanceCriteria?: string[];
  tags?: string[];
  estimatedHours?: number;
  businessValue?: string;
}

export interface UpdateRequirementData {
  title?: string;
  description?: string;
  type?: RequirementType;
  priority?: Priority;
  acceptanceCriteria?: string[];
  tags?: string[];
  estimatedHours?: number;
  businessValue?: string;
  parentId?: string;
}

export interface RequirementWithChildren extends Requirement {
  children?: Requirement[];
  parent?: Requirement;
}

export interface RequirementStatistics {
  total: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  byPriority: Record<string, number>;
  completionRate: number;
}

export class RequirementService {
  constructor(
    private requirementRepository: IRequirementRepository,
    private projectRepository: IProjectRepository
  ) {}

  async getRequirementById(id: string): Promise<Requirement> {
    const requirement = await this.requirementRepository.findById(id);
    if (!requirement) {
      throw ErrorFactory.notFound('Requirement', id);
    }
    return requirement;
  }

  async getRequirementsByProjectId(projectId: string): Promise<Requirement[]> {
    // Validate project exists
    if (!await this.projectRepository.findById(projectId)) {
      throw ErrorFactory.notFound('Project', projectId);
    }

    return this.requirementRepository.findByProjectId(projectId);
  }

  async getRequirementsByStatus(status: PrismaRequirementStatus): Promise<Requirement[]> {
    // Validate status
    if (!Object.values(RequirementStatus).includes(status as any)) {
      throw ErrorFactory.validation('Invalid requirement status', { 
        status, 
        validStatuses: Object.values(RequirementStatus) 
      });
    }

    return this.requirementRepository.findByStatus(status);
  }

  async getRequirementsByType(type: RequirementType): Promise<Requirement[]> {
    // Validate type
    if (!Object.values(RequirementTypeConstants).includes(type as any)) {
      throw ErrorFactory.validation('Invalid requirement type', { 
        type, 
        validTypes: Object.values(RequirementTypeConstants) 
      });
    }

    return this.requirementRepository.findByType(type);
  }

  async getRootRequirements(projectId: string): Promise<Requirement[]> {
    // Validate project exists
    if (!await this.projectRepository.findById(projectId)) {
      throw ErrorFactory.notFound('Project', projectId);
    }

    return this.requirementRepository.findRootRequirements(projectId);
  }

  async getChildRequirements(parentId: string): Promise<Requirement[]> {
    // Validate parent requirement exists
    await this.getRequirementById(parentId);

    return this.requirementRepository.findByParentId(parentId);
  }

  async createRequirement(data: CreateRequirementData): Promise<Requirement> {
    // Validate project exists
    if (!await this.projectRepository.findById(data.projectId)) {
      throw ErrorFactory.notFound('Project', data.projectId);
    }

    // Validate parent requirement exists if provided
    if (data.parentId) {
      const parentRequirement = await this.requirementRepository.findById(data.parentId);
      if (!parentRequirement) {
        throw ErrorFactory.notFound('Parent requirement', data.parentId);
      }

      // Validate parent belongs to same project
      if (parentRequirement.projectId !== data.projectId) {
        throw ErrorFactory.validation('Parent requirement must belong to the same project');
      }
    }

    // Validate requirement type
    if (!Object.values(RequirementTypeConstants).includes(data.type as any)) {
      throw ErrorFactory.validation('Invalid requirement type', { 
        type: data.type, 
        validTypes: Object.values(RequirementTypeConstants) 
      });
    }

    // Validate priority
    if (!Object.values(PriorityConstants).includes(data.priority as any)) {
      throw ErrorFactory.validation('Invalid priority', { 
        priority: data.priority, 
        validPriorities: Object.values(PriorityConstants) 
      });
    }

    // Validate estimated hours
    if (data.estimatedHours !== undefined && data.estimatedHours < 0) {
      throw ErrorFactory.validation('Estimated hours must be non-negative');
    }

    // Validate acceptance criteria
    if (data.acceptanceCriteria && data.acceptanceCriteria.length === 0) {
      throw ErrorFactory.validation('Acceptance criteria cannot be empty array');
    }

    const requirementData = {
      ...data,
      status: RequirementStatus.DRAFT as PrismaRequirementStatus,
      acceptanceCriteria: data.acceptanceCriteria || [],
      tags: data.tags || [],
      estimatedHours: data.estimatedHours || null,
      businessValue: data.businessValue || null,
      completedAt: null,
      deletedAt: null
    };

    return this.requirementRepository.create(requirementData);
  }

  async updateRequirement(id: string, data: UpdateRequirementData): Promise<Requirement> {
    const existingRequirement = await this.getRequirementById(id);

    // Validate parent requirement if being updated
    if (data.parentId !== undefined) {
      if (data.parentId === id) {
        throw ErrorFactory.validation('Requirement cannot be its own parent');
      }

      if (data.parentId) {
        const parentRequirement = await this.requirementRepository.findById(data.parentId);
        if (!parentRequirement) {
          throw ErrorFactory.notFound('Parent requirement', data.parentId);
        }

        // Validate parent belongs to same project
        if (parentRequirement.projectId !== existingRequirement.projectId) {
          throw ErrorFactory.validation('Parent requirement must belong to the same project');
        }

        // Prevent circular dependencies
        if (await this.wouldCreateCircularDependency(id, data.parentId)) {
          throw ErrorFactory.validation('Cannot create circular dependency');
        }
      }
    }

    // Validate requirement type if being updated
    if (data.type && !Object.values(RequirementTypeConstants).includes(data.type as any)) {
      throw ErrorFactory.validation('Invalid requirement type', { 
        type: data.type, 
        validTypes: Object.values(RequirementTypeConstants) 
      });
    }

    // Validate priority if being updated
    if (data.priority && !Object.values(PriorityConstants).includes(data.priority as any)) {
      throw ErrorFactory.validation('Invalid priority', { 
        priority: data.priority, 
        validPriorities: Object.values(PriorityConstants) 
      });
    }

    // Validate estimated hours if being updated
    if (data.estimatedHours !== undefined && data.estimatedHours < 0) {
      throw ErrorFactory.validation('Estimated hours must be non-negative');
    }

    // Validate acceptance criteria if being updated
    if (data.acceptanceCriteria && data.acceptanceCriteria.length === 0) {
      throw ErrorFactory.validation('Acceptance criteria cannot be empty array');
    }

    return this.requirementRepository.update(id, data);
  }

  async updateRequirementStatus(id: string, status: PrismaRequirementStatus): Promise<Requirement> {
    // Validate status
    if (!Object.values(RequirementStatus).includes(status as any)) {
      throw ErrorFactory.validation('Invalid requirement status', { 
        status, 
        validStatuses: Object.values(RequirementStatus) 
      });
    }

    const requirement = await this.getRequirementById(id);

    // Business logic for status transitions
    await this.validateStatusTransition(requirement.status, status);

    return this.requirementRepository.updateStatus(id, status);
  }

  async deleteRequirement(id: string, soft: boolean = true): Promise<void> {
    const requirement = await this.getRequirementById(id);

    // Check if requirement has children
    const childRequirements = await this.requirementRepository.findByParentId(id);
    if (childRequirements.length > 0 && !soft) {
      throw ErrorFactory.validation('Cannot hard delete requirement with child requirements. Use soft delete or delete children first.');
    }

    if (soft) {
      await this.requirementRepository.softDelete(id);
    } else {
      await this.requirementRepository.delete(id);
    }
  }

  async getRequirementWithChildren(id: string): Promise<RequirementWithChildren> {
    const requirement = await this.requirementRepository.findRequirementWithChildren(id);
    if (!requirement) {
      throw ErrorFactory.notFound('Requirement', id);
    }
    return requirement;
  }

  async getRequirementsByTag(projectId: string, tag: string): Promise<Requirement[]> {
    // Validate project exists
    if (!await this.projectRepository.findById(projectId)) {
      throw ErrorFactory.notFound('Project', projectId);
    }

    if (!tag || tag.trim().length === 0) {
      throw ErrorFactory.validation('Tag cannot be empty');
    }

    return this.requirementRepository.findRequirementsByTag(projectId, tag.trim());
  }

  async getRequirementStatistics(projectId: string): Promise<RequirementStatistics> {
    // Validate project exists
    if (!await this.projectRepository.findById(projectId)) {
      throw ErrorFactory.notFound('Project', projectId);
    }

    return this.requirementRepository.getRequirementStatistics(projectId);
  }

  async getBlockingRequirements(projectId: string): Promise<Requirement[]> {
    // Validate project exists
    if (!await this.projectRepository.findById(projectId)) {
      throw ErrorFactory.notFound('Project', projectId);
    }

    return this.requirementRepository.findBlockingRequirements(projectId);
  }

  async getRequirementsReadyForImplementation(projectId: string): Promise<Requirement[]> {
    // Validate project exists
    if (!await this.projectRepository.findById(projectId)) {
      throw ErrorFactory.notFound('Project', projectId);
    }

    return this.requirementRepository.findRequirementsReadyForImplementation(projectId);
  }

  async analyzeRequirementProgress(projectId: string): Promise<{
    overview: RequirementStatistics;
    blocking: Requirement[];
    readyForImplementation: Requirement[];
    recommendations: string[];
  }> {
    const [overview, blocking, readyForImplementation] = await Promise.all([
      this.getRequirementStatistics(projectId),
      this.getBlockingRequirements(projectId),
      this.getRequirementsReadyForImplementation(projectId)
    ]);

    const recommendations: string[] = [];

    // Generate recommendations based on analysis
    if (blocking.length > 0) {
      recommendations.push(`${blocking.length} high-priority requirements are blocking progress`);
    }

    if (readyForImplementation.length > 5) {
      recommendations.push(`${readyForImplementation.length} requirements are ready for implementation - consider parallel development`);
    }

    if (overview.completionRate < 30) {
      recommendations.push('Low completion rate - focus on requirement approval and implementation');
    } else if (overview.completionRate > 80) {
      recommendations.push('High completion rate - consider adding new requirements or moving to next phase');
    }

    const draftCount = overview.byStatus[RequirementStatus.DRAFT] || 0;
    if (draftCount > overview.total * 0.5) {
      recommendations.push('Many requirements are still in draft - prioritize requirement review and approval');
    }

    return {
      overview,
      blocking,
      readyForImplementation,
      recommendations
    };
  }

  // Private helper methods
  private async validateStatusTransition(currentStatus: PrismaRequirementStatus, newStatus: PrismaRequirementStatus): Promise<void> {
    const validTransitions: Record<string, string[]> = {
      [RequirementStatus.DRAFT]: [RequirementStatus.REVIEW, RequirementStatus.REJECTED],
      [RequirementStatus.REVIEW]: [RequirementStatus.APPROVED, RequirementStatus.REJECTED, RequirementStatus.DRAFT],
      [RequirementStatus.APPROVED]: [RequirementStatus.IN_PROGRESS, RequirementStatus.REVIEW],
      [RequirementStatus.IN_PROGRESS]: [RequirementStatus.COMPLETED, RequirementStatus.ON_HOLD, RequirementStatus.APPROVED],
      [RequirementStatus.ON_HOLD]: [RequirementStatus.IN_PROGRESS, RequirementStatus.APPROVED],
      [RequirementStatus.COMPLETED]: [RequirementStatus.IN_PROGRESS], // Allow reopening completed requirements
      [RequirementStatus.REJECTED]: [RequirementStatus.DRAFT, RequirementStatus.REVIEW]
    };

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      throw ErrorFactory.validation(
        `Invalid status transition from ${currentStatus} to ${newStatus}`,
        { 
          currentStatus, 
          newStatus, 
          validTransitions: validTransitions[currentStatus] 
        }
      );
    }
  }

  private async wouldCreateCircularDependency(requirementId: string, parentId: string): Promise<boolean> {
    // Simple check: traverse up the parent chain to see if we encounter requirementId
    let currentParentId = parentId;
    const visited = new Set<string>();

    while (currentParentId && !visited.has(currentParentId)) {
      if (currentParentId === requirementId) {
        return true; // Circular dependency detected
      }

      visited.add(currentParentId);
      const parentRequirement = await this.requirementRepository.findById(currentParentId);
      currentParentId = parentRequirement?.parentId || null;
    }

    return false;
  }
}