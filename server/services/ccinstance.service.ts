import { CCInstance, CCInstanceStatus, CCInstanceType } from '@prisma/client';
import { ICCInstanceRepository } from '../repositories/ccinstance.repository';
import { IProjectRepository } from '../repositories/project.repository';
import { ITaskRepository } from '../repositories/task.repository';
import { AppError, ErrorFactory } from '../utils/errors';
import { CCInstanceStatus as CCInstanceStatusConstants, CCInstanceType as CCInstanceTypeConstants } from '../utils/constants';

export interface CreateCCInstanceData {
  projectId: string;
  parentInstanceId?: string;
  taskId?: string;
  type: CCInstanceType;
  instruction?: string;
  worktreePath?: string;
  maxParallel?: number;
}

export interface UpdateCCInstanceData {
  instruction?: string;
  worktreePath?: string;
  maxParallel?: number;
  pid?: number;
}

export interface CCInstanceWithRelations extends CCInstance {
  children?: CCInstance[];
  parent?: CCInstance;
  task?: any;
}

export interface ParallelExecutionPlan {
  totalTasks: number;
  phases: {
    phase: number;
    tasks: any[];
    instances: string[];
  }[];
  estimatedDuration: number;
  maxParallelInstances: number;
}

export interface ExecutionStatistics {
  total: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  activeCount: number;
  maxParallelReached: boolean;
  avgExecutionTime: number;
}

export class CCInstanceService {
  constructor(
    private ccInstanceRepository: ICCInstanceRepository,
    private projectRepository: IProjectRepository,
    private taskRepository: ITaskRepository
  ) {}

  async getCCInstanceById(id: string): Promise<CCInstance> {
    const instance = await this.ccInstanceRepository.findById(id);
    if (!instance) {
      throw ErrorFactory.notFound('CC Instance', id);
    }
    return instance;
  }

  async getCCInstancesByProjectId(projectId: string): Promise<CCInstance[]> {
    // Validate project exists
    if (!await this.projectRepository.findById(projectId)) {
      throw ErrorFactory.notFound('Project', projectId);
    }

    return this.ccInstanceRepository.findByProjectId(projectId);
  }

  async getActiveCCInstances(projectId?: string): Promise<CCInstance[]> {
    if (projectId && !await this.projectRepository.findById(projectId)) {
      throw ErrorFactory.notFound('Project', projectId);
    }

    return this.ccInstanceRepository.findActiveInstances(projectId);
  }

  async getChildInstances(parentId: string): Promise<CCInstance[]> {
    // Validate parent instance exists
    await this.getCCInstanceById(parentId);

    return this.ccInstanceRepository.findByParentId(parentId);
  }

  async createCCInstance(data: CreateCCInstanceData): Promise<CCInstance> {
    // Validate project exists
    const project = await this.projectRepository.findById(data.projectId);
    if (!project) {
      throw ErrorFactory.notFound('Project', data.projectId);
    }

    // Validate parent instance exists if provided
    if (data.parentInstanceId) {
      const parentInstance = await this.ccInstanceRepository.findById(data.parentInstanceId);
      if (!parentInstance) {
        throw ErrorFactory.notFound('Parent CC Instance', data.parentInstanceId);
      }

      // Validate parent belongs to same project
      if (parentInstance.projectId !== data.projectId) {
        throw ErrorFactory.badRequest('Parent instance must belong to the same project');
      }
    }

    // Validate task exists if provided
    if (data.taskId) {
      const task = await this.taskRepository.findById(data.taskId);
      if (!task) {
        throw ErrorFactory.notFound('Task', data.taskId);
      }

      // Validate task belongs to same project
      if (task.projectId !== data.projectId) {
        throw ErrorFactory.badRequest('Task must belong to the same project');
      }

      // Check if task already has an active instance
      const existingInstance = await this.ccInstanceRepository.findByTaskId(data.taskId);
      if (existingInstance && [CCInstanceStatusConstants.STARTING, CCInstanceStatusConstants.RUNNING, CCInstanceStatusConstants.WAITING].includes(existingInstance.status)) {
        throw ErrorFactory.badRequest('Task already has an active CC instance', { 
          taskId: data.taskId, 
          existingInstanceId: existingInstance.id 
        });
      }
    }

    // Validate instance type
    if (!Object.values(CCInstanceTypeConstants).includes(data.type as any)) {
      throw ErrorFactory.badRequest('Invalid CC instance type', { 
        type: data.type, 
        validTypes: Object.values(CCInstanceTypeConstants) 
      });
    }

    // Check parallel execution limits
    const activeInstances = await this.ccInstanceRepository.findActiveInstances(data.projectId);
    const maxParallel = project.maxParallelCCs || 5;
    
    if (activeInstances.length >= maxParallel) {
      throw ErrorFactory.badRequest(`Maximum parallel CC instances limit reached (${maxParallel})`, {
        currentActive: activeInstances.length,
        maxParallel
      });
    }

    // Validate worktree path uniqueness if provided
    if (data.worktreePath) {
      const existingWorktree = await this.ccInstanceRepository.findByWorktreePath(data.worktreePath);
      if (existingWorktree) {
        throw ErrorFactory.badRequest('Worktree path already in use', { 
          worktreePath: data.worktreePath, 
          existingInstanceId: existingWorktree.id 
        });
      }
    }

    const instanceData = {
      ...data,
      status: CCInstanceStatusConstants.STARTING as CCInstanceStatus,
      progress: 0,
      instruction: data.instruction || null,
      worktreePath: data.worktreePath || null,
      maxParallel: data.maxParallel || null,
      pid: null,
      startedAt: null,
      finishedAt: null,
      deletedAt: null
    };

    return this.ccInstanceRepository.create(instanceData);
  }

  async updateCCInstance(id: string, data: UpdateCCInstanceData): Promise<CCInstance> {
    const existingInstance = await this.getCCInstanceById(id);

    // Validate worktree path uniqueness if being updated
    if (data.worktreePath && data.worktreePath !== existingInstance.worktreePath) {
      const existingWorktree = await this.ccInstanceRepository.findByWorktreePath(data.worktreePath);
      if (existingWorktree && existingWorktree.id !== id) {
        throw ErrorFactory.badRequest('Worktree path already in use', { 
          worktreePath: data.worktreePath, 
          existingInstanceId: existingWorktree.id 
        });
      }
    }

    return this.ccInstanceRepository.update(id, data);
  }

  async updateCCInstanceStatus(id: string, status: CCInstanceStatus): Promise<CCInstance> {
    // Validate status
    if (!Object.values(CCInstanceStatusConstants).includes(status as any)) {
      throw ErrorFactory.badRequest('Invalid CC instance status', { 
        status, 
        validStatuses: Object.values(CCInstanceStatusConstants) 
      });
    }

    const instance = await this.getCCInstanceById(id);

    // Business logic for status transitions
    await this.validateStatusTransition(instance.status, status);

    return this.ccInstanceRepository.updateStatus(id, status);
  }

  async updateCCInstanceProgress(id: string, progress: number): Promise<CCInstance> {
    if (progress < 0 || progress > 100) {
      throw ErrorFactory.badRequest('Progress must be between 0 and 100', { progress });
    }

    return this.ccInstanceRepository.updateProgress(id, progress);
  }

  async terminateCCInstance(id: string, force: boolean = false): Promise<CCInstance> {
    const instance = await this.getCCInstanceById(id);

    // Check if instance has active children
    const childInstances = await this.ccInstanceRepository.findByParentId(id);
    const activeChildren = childInstances.filter(child => 
      [CCInstanceStatusConstants.STARTING, CCInstanceStatusConstants.RUNNING, CCInstanceStatusConstants.WAITING].includes(child.status)
    );

    if (activeChildren.length > 0 && !force) {
      throw ErrorFactory.badRequest('Cannot terminate instance with active children. Use force=true to terminate all.', {
        activeChildren: activeChildren.length
      });
    }

    // Terminate children first if force is enabled
    if (force && activeChildren.length > 0) {
      await Promise.all(
        activeChildren.map(child => this.ccInstanceRepository.updateStatus(child.id, CCInstanceStatusConstants.TERMINATED))
      );
    }

    return this.ccInstanceRepository.updateStatus(id, CCInstanceStatusConstants.TERMINATED);
  }

  async deleteCCInstance(id: string, soft: boolean = true): Promise<void> {
    const instance = await this.getCCInstanceById(id);

    // Check if instance has children
    const childInstances = await this.ccInstanceRepository.findByParentId(id);
    if (childInstances.length > 0 && !soft) {
      throw ErrorFactory.badRequest('Cannot hard delete instance with child instances. Use soft delete or delete children first.');
    }

    if (soft) {
      await this.ccInstanceRepository.softDelete(id);
    } else {
      await this.ccInstanceRepository.delete(id);
    }
  }

  async getCCInstanceWithRelations(id: string): Promise<CCInstanceWithRelations> {
    const instance = await this.ccInstanceRepository.findInstanceWithRelations(id);
    if (!instance) {
      throw ErrorFactory.notFound('CC Instance', id);
    }
    return instance;
  }

  async createParallelExecutionPlan(projectId: string, maxParallel: number = 5): Promise<ParallelExecutionPlan> {
    // Validate project exists
    if (!await this.projectRepository.findById(projectId)) {
      throw ErrorFactory.notFound('Project', projectId);
    }

    // Get available tasks for execution
    const availableTasks = await this.taskRepository.findAvailableTasksForExecution(projectId);

    if (availableTasks.length === 0) {
      return {
        totalTasks: 0,
        phases: [],
        estimatedDuration: 0,
        maxParallelInstances: maxParallel
      };
    }

    // Analyze task dependencies and create execution phases
    const dependencyAnalysis = await this.taskRepository.analyzeTaskDependencies?.(projectId) || {
      phases: [{ phase: 1, tasks: availableTasks }],
      totalPhases: 1,
      parallelizable: availableTasks.length > 1
    };

    const phases = dependencyAnalysis.phases.map(phaseData => ({
      phase: phaseData.phase,
      tasks: phaseData.tasks,
      instances: [] as string[] // Will be populated when instances are created
    }));

    // Estimate duration based on task complexity and parallel execution
    const totalEstimatedMinutes = availableTasks.reduce((sum, task) => sum + (task.estimatedMinutes || 30), 0);
    const parallelEfficiency = Math.min(maxParallel, availableTasks.length) / availableTasks.length;
    const estimatedDuration = totalEstimatedMinutes * (1 - parallelEfficiency * 0.7); // 70% efficiency gain from parallelization

    return {
      totalTasks: availableTasks.length,
      phases,
      estimatedDuration,
      maxParallelInstances: maxParallel
    };
  }

  async executeParallelPlan(plan: ParallelExecutionPlan, projectId: string, parentInstanceId: string): Promise<{
    createdInstances: CCInstance[];
    errors: { phase: number; taskId: string; error: string }[];
  }> {
    const createdInstances: CCInstance[] = [];
    const errors: { phase: number; taskId: string; error: string }[] = [];

    for (const phase of plan.phases) {
      const phaseInstances: CCInstance[] = [];

      // Create instances for all tasks in this phase (they can run in parallel)
      for (const task of phase.tasks) {
        try {
          const instanceData: CreateCCInstanceData = {
            projectId,
            parentInstanceId,
            taskId: task.id,
            type: CCInstanceTypeConstants.CHILD,
            instruction: `Execute task: ${task.title}\n\nDescription: ${task.description || 'No description'}\n\nTask Type: ${task.type}\nPriority: ${task.priority}`,
            worktreePath: `${projectId}-task-${task.id}-${Date.now()}`
          };

          const instance = await this.createCCInstance(instanceData);
          phaseInstances.push(instance);
          createdInstances.push(instance);
          
          // Update the phase with the created instance ID
          phase.instances.push(instance.id);

        } catch (error) {
          errors.push({
            phase: phase.phase,
            taskId: task.id,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      // Wait for all instances in this phase to complete before moving to next phase
      // This is a simplified approach - in a real implementation, you'd use events/webhooks
      // await this.waitForPhaseCompletion(phaseInstances);
    }

    return { createdInstances, errors };
  }

  async getExecutionStatistics(projectId: string): Promise<ExecutionStatistics> {
    // Validate project exists
    if (!await this.projectRepository.findById(projectId)) {
      throw ErrorFactory.notFound('Project', projectId);
    }

    return this.ccInstanceRepository.getParallelExecutionStatistics(projectId);
  }

  async cleanupOldInstances(projectId?: string, maxAgeHours: number = 24): Promise<number> {
    if (projectId && !await this.projectRepository.findById(projectId)) {
      throw ErrorFactory.notFound('Project', projectId);
    }

    return this.ccInstanceRepository.cleanup(maxAgeHours);
  }

  async findStaleInstances(maxIdleMinutes: number = 30): Promise<CCInstance[]> {
    return this.ccInstanceRepository.findStaleInstances(maxIdleMinutes);
  }

  async updateLastActivity(id: string): Promise<CCInstance> {
    return this.ccInstanceRepository.updateLastActivity(id);
  }

  async getInstancesByWorktreePattern(pattern: string): Promise<CCInstance[]> {
    if (!pattern || pattern.trim().length === 0) {
      throw ErrorFactory.badRequest('Worktree pattern cannot be empty');
    }

    return this.ccInstanceRepository.findInstancesByWorktreePattern(pattern.trim());
  }

  // Private helper methods
  private async validateStatusTransition(currentStatus: CCInstanceStatus, newStatus: CCInstanceStatus): Promise<void> {
    const validTransitions: Record<string, string[]> = {
      [CCInstanceStatusConstants.STARTING]: [CCInstanceStatusConstants.RUNNING, CCInstanceStatusConstants.FAILED, CCInstanceStatusConstants.TERMINATED],
      [CCInstanceStatusConstants.RUNNING]: [CCInstanceStatusConstants.WAITING, CCInstanceStatusConstants.COMPLETED, CCInstanceStatusConstants.FAILED, CCInstanceStatusConstants.TERMINATED],
      [CCInstanceStatusConstants.WAITING]: [CCInstanceStatusConstants.RUNNING, CCInstanceStatusConstants.FAILED, CCInstanceStatusConstants.TERMINATED],
      [CCInstanceStatusConstants.COMPLETED]: [CCInstanceStatusConstants.RUNNING], // Allow restarting completed instances
      [CCInstanceStatusConstants.FAILED]: [CCInstanceStatusConstants.STARTING, CCInstanceStatusConstants.RUNNING], // Allow restarting failed instances
      [CCInstanceStatusConstants.TERMINATED]: [CCInstanceStatusConstants.STARTING] // Allow restarting terminated instances
    };

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      throw ErrorFactory.badRequest(
        `Invalid status transition from ${currentStatus} to ${newStatus}`,
        { 
          currentStatus, 
          newStatus, 
          validTransitions: validTransitions[currentStatus] 
        }
      );
    }
  }

  private async waitForPhaseCompletion(instances: CCInstance[]): Promise<void> {
    // This is a placeholder for phase completion waiting logic
    // In a real implementation, this would:
    // 1. Monitor instance status changes via WebSocket/SSE
    // 2. Wait for all instances to reach COMPLETED, FAILED, or TERMINATED status
    // 3. Handle timeouts and error cases
    // 4. Provide progress updates to the parent instance
    
    // For now, we'll just add a delay to simulate processing time
    return new Promise(resolve => {
      setTimeout(resolve, 1000); // 1 second delay
    });
  }
}