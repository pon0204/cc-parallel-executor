import { faker } from '@faker-js/faker';
import { CCInstance, CCInstanceStatus, CCInstanceType } from '@prisma/client';

export class CCInstanceBuilder {
  private instance: CCInstance;

  constructor() {
    const now = new Date();
    
    this.instance = {
      id: faker.string.uuid(),
      projectId: faker.string.uuid(),
      parentInstanceId: null,
      taskId: null,
      type: 'PARENT' as CCInstanceType,
      status: 'STARTING' as CCInstanceStatus,
      instruction: faker.lorem.paragraph(),
      worktreePath: `/tmp/worktrees/${faker.string.alphanumeric(8)}`,
      maxParallel: faker.number.int({ min: 1, max: 10 }),
      progress: 0,
      pid: null,
      startedAt: null,
      finishedAt: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
  }

  withId(id: string): this {
    this.instance.id = id;
    return this;
  }

  withProjectId(projectId: string): this {
    this.instance.projectId = projectId;
    return this;
  }

  withParentInstanceId(parentInstanceId: string | null): this {
    this.instance.parentInstanceId = parentInstanceId;
    return this;
  }

  withTaskId(taskId: string | null): this {
    this.instance.taskId = taskId;
    return this;
  }

  withType(type: CCInstanceType): this {
    this.instance.type = type;
    return this;
  }

  withStatus(status: CCInstanceStatus): this {
    this.instance.status = status;
    return this;
  }

  withInstruction(instruction: string): this {
    this.instance.instruction = instruction;
    return this;
  }

  withWorktreePath(path: string): this {
    this.instance.worktreePath = path;
    return this;
  }

  withMaxParallel(maxParallel: number): this {
    this.instance.maxParallel = maxParallel;
    return this;
  }

  withProgress(progress: number): this {
    this.instance.progress = Math.min(100, Math.max(0, progress));
    return this;
  }

  withPid(pid: number): this {
    this.instance.pid = pid;
    return this;
  }

  withRunning(): this {
    this.instance.status = 'RUNNING';
    this.instance.startedAt = new Date();
    this.instance.pid = faker.number.int({ min: 1000, max: 99999 });
    return this;
  }

  withCompleted(): this {
    this.instance.status = 'COMPLETED';
    this.instance.progress = 100;
    this.instance.startedAt = faker.date.recent();
    this.instance.finishedAt = new Date();
    return this;
  }

  withFailed(): this {
    this.instance.status = 'FAILED';
    this.instance.startedAt = faker.date.recent();
    this.instance.finishedAt = new Date();
    return this;
  }

  withDeleted(): this {
    this.instance.deletedAt = new Date();
    return this;
  }

  build(): CCInstance {
    return { ...this.instance };
  }

  buildMany(count: number): CCInstance[] {
    return Array.from({ length: count }, () => new CCInstanceBuilder().build());
  }
}

// Factory functions for quick creation
export const createCCInstance = (overrides?: Partial<CCInstance>): CCInstance => {
  const builder = new CCInstanceBuilder();
  
  if (overrides) {
    Object.entries(overrides).forEach(([key, value]) => {
      const methodName = `with${key.charAt(0).toUpperCase()}${key.slice(1)}` as keyof CCInstanceBuilder;
      if (typeof builder[methodName] === 'function') {
        (builder[methodName] as any)(value);
      }
    });
  }
  
  return builder.build();
};

// Preset builders for common scenarios
export const createParentInstance = (projectId: string) => 
  new CCInstanceBuilder()
    .withProjectId(projectId)
    .withType('PARENT')
    .withMaxParallel(5)
    .build();

export const createChildInstance = (projectId: string, parentId: string, taskId: string) => 
  new CCInstanceBuilder()
    .withProjectId(projectId)
    .withParentInstanceId(parentId)
    .withTaskId(taskId)
    .withType('CHILD')
    .build();

export const createRunningInstance = (projectId: string) => 
  new CCInstanceBuilder()
    .withProjectId(projectId)
    .withRunning()
    .build();

export const createCompletedInstance = (projectId: string) => 
  new CCInstanceBuilder()
    .withProjectId(projectId)
    .withCompleted()
    .build();

export const createFailedInstance = (projectId: string) => 
  new CCInstanceBuilder()
    .withProjectId(projectId)
    .withFailed()
    .build();

// Create parent-child instance hierarchy
export const createInstanceHierarchy = (projectId: string, childCount: number = 3): CCInstance[] => {
  const instances: CCInstance[] = [];
  
  // Create parent instance
  const parent = new CCInstanceBuilder()
    .withProjectId(projectId)
    .withType('PARENT')
    .withMaxParallel(childCount)
    .withRunning()
    .build();
  instances.push(parent);
  
  // Create child instances
  for (let i = 0; i < childCount; i++) {
    const child = new CCInstanceBuilder()
      .withProjectId(projectId)
      .withParentInstanceId(parent.id)
      .withType('CHILD')
      .withTaskId(faker.string.uuid())
      .withWorktreePath(`/tmp/worktrees/${projectId}-child-${i}`)
      .build();
    
    // Vary the status of children
    if (i === 0) {
      child.status = 'COMPLETED';
      child.progress = 100;
    } else if (i === 1) {
      child.status = 'RUNNING';
      child.progress = 50;
    }
    
    instances.push(child);
  }
  
  return instances;
};

// Create instances for parallel execution testing
export const createParallelExecutionInstances = (projectId: string): CCInstance[] => {
  const instances: CCInstance[] = [];
  
  // Parent coordinator instance
  const parent = new CCInstanceBuilder()
    .withProjectId(projectId)
    .withType('PARENT')
    .withMaxParallel(5)
    .withInstruction('Coordinate parallel task execution')
    .withRunning()
    .build();
  instances.push(parent);
  
  // Phase 1 instances (can run in parallel)
  instances.push(
    new CCInstanceBuilder()
      .withProjectId(projectId)
      .withParentInstanceId(parent.id)
      .withType('CHILD')
      .withTaskId('task-db-setup')
      .withInstruction('Setup database schema and initial data')
      .withCompleted()
      .build(),
    new CCInstanceBuilder()
      .withProjectId(projectId)
      .withParentInstanceId(parent.id)
      .withType('CHILD')
      .withTaskId('task-env-config')
      .withInstruction('Configure environment variables')
      .withCompleted()
      .build()
  );
  
  // Phase 2 instances (running)
  instances.push(
    new CCInstanceBuilder()
      .withProjectId(projectId)
      .withParentInstanceId(parent.id)
      .withType('CHILD')
      .withTaskId('task-backend-api')
      .withInstruction('Develop backend API endpoints')
      .withRunning()
      .withProgress(75)
      .build(),
    new CCInstanceBuilder()
      .withProjectId(projectId)
      .withParentInstanceId(parent.id)
      .withType('CHILD')
      .withTaskId('task-frontend-ui')
      .withInstruction('Build frontend user interface')
      .withRunning()
      .withProgress(60)
      .build()
  );
  
  // Phase 3 instance (waiting)
  instances.push(
    new CCInstanceBuilder()
      .withProjectId(projectId)
      .withParentInstanceId(parent.id)
      .withType('CHILD')
      .withTaskId('task-integration-test')
      .withInstruction('Run integration tests')
      .withStatus('WAITING')
      .build()
  );
  
  return instances;
};

// Create instances with various statuses for testing
export const createInstancesWithAllStatuses = (projectId: string): CCInstance[] => {
  const statuses: CCInstanceStatus[] = ['STARTING', 'RUNNING', 'WAITING', 'COMPLETED', 'FAILED', 'TERMINATED'];
  
  return statuses.map((status, index) => 
    new CCInstanceBuilder()
      .withProjectId(projectId)
      .withStatus(status)
      .withProgress(status === 'COMPLETED' ? 100 : index * 20)
      .build()
  );
};