import { faker } from '@faker-js/faker';

export class TaskBuilder {
  private task: any;

  constructor() {
    const now = new Date();
    
    this.task = {
      id: faker.string.uuid(),
      projectId: faker.string.uuid(),
      parentTaskId: null,
      name: faker.hacker.phrase(),
      description: faker.lorem.paragraph(),
      status: 'PENDING',
      priority: faker.number.int({ min: 1, max: 10 }),
      taskType: faker.helpers.arrayElement(['setup', 'database', 'backend', 'frontend', 'test', 'deploy', 'general']),
      assignedTo: null,
      instruction: null,
      inputData: null,
      outputData: null,
      worktreePath: null,
      lastLintResult: null,
      lastBuildResult: null,
      lastTestResult: null,
      qualityCheckAt: null,
      createdAt: now,
      updatedAt: now,
      queuedAt: null,
      startedAt: null,
      completedAt: null,
    };
  }

  withId(id: string): this {
    this.task.id = id;
    return this;
  }

  withName(name: string): this {
    this.task.name = name;
    return this;
  }

  withDescription(description: string): this {
    this.task.description = description;
    return this;
  }

  withProjectId(projectId: string): this {
    this.task.projectId = projectId;
    return this;
  }

  withParentTaskId(parentTaskId: string | null): this {
    this.task.parentTaskId = parentTaskId;
    return this;
  }

  withTaskType(taskType: string): this {
    this.task.taskType = taskType;
    return this;
  }

  withStatus(status: string): this {
    this.task.status = status;
    return this;
  }

  withPriority(priority: number): this {
    this.task.priority = priority;
    return this;
  }

  withAssignedTo(assignedTo: string | null): this {
    this.task.assignedTo = assignedTo;
    return this;
  }

  withInstruction(instruction: string | null): this {
    this.task.instruction = instruction;
    return this;
  }

  withInputData(inputData: string | null): this {
    this.task.inputData = inputData;
    return this;
  }

  withOutputData(outputData: string | null): this {
    this.task.outputData = outputData;
    return this;
  }

  withWorktreePath(worktreePath: string | null): this {
    this.task.worktreePath = worktreePath;
    return this;
  }

  withCompleted(): this {
    this.task.status = 'COMPLETED';
    this.task.completedAt = new Date();
    return this;
  }

  withFailed(): this {
    this.task.status = 'FAILED';
    return this;
  }

  withQueued(): this {
    this.task.status = 'QUEUED';
    this.task.queuedAt = new Date();
    return this;
  }

  withRunning(): this {
    this.task.status = 'RUNNING';
    this.task.startedAt = new Date();
    return this;
  }

  build(): any {
    return { ...this.task };
  }

  buildMany(count: number): any[] {
    return Array.from({ length: count }, () => new TaskBuilder().build());
  }
}

// Factory functions for quick creation
export const createTask = (overrides?: Partial<any>): any => {
  const builder = new TaskBuilder();
  
  if (overrides) {
    Object.entries(overrides).forEach(([key, value]) => {
      const methodName = `with${key.charAt(0).toUpperCase()}${key.slice(1)}` as keyof TaskBuilder;
      if (typeof builder[methodName] === 'function') {
        (builder[methodName] as any)(value);
      }
    });
  }
  
  return builder.build();
};

// Preset builders for common scenarios
export const createPendingTask = (projectId: string) => 
  new TaskBuilder().withProjectId(projectId).withStatus('PENDING').build();

export const createRunningTask = (projectId: string) => 
  new TaskBuilder().withProjectId(projectId).withRunning().build();

export const createCompletedTask = (projectId: string) => 
  new TaskBuilder().withProjectId(projectId).withCompleted().build();

export const createFailedTask = (projectId: string) => 
  new TaskBuilder().withProjectId(projectId).withFailed().build();

export const createHighPriorityTask = (projectId: string) => 
  new TaskBuilder().withProjectId(projectId).withPriority(10).build();

export const createSubTask = (projectId: string, parentTaskId: string) => 
  new TaskBuilder().withProjectId(projectId).withParentTaskId(parentTaskId).build();

// Create task hierarchy
export const createTaskHierarchy = (projectId: string, depth: number = 2): any[] => {
  const tasks: any[] = [];
  const rootTask = new TaskBuilder().withProjectId(projectId).withName('Root Task').build();
  tasks.push(rootTask);
  
  let parentTasks = [rootTask];
  
  for (let level = 1; level < depth; level++) {
    const newParentTasks: any[] = [];
    
    for (const parent of parentTasks) {
      const childCount = faker.number.int({ min: 1, max: 3 });
      for (let i = 0; i < childCount; i++) {
        const childTask = new TaskBuilder()
          .withProjectId(projectId)
          .withParentTaskId(parent.id)
          .withName(`Level ${level} - Task ${i + 1}`)
          .build();
        tasks.push(childTask);
        newParentTasks.push(childTask);
      }
    }
    
    parentTasks = newParentTasks;
  }
  
  return tasks;
};

// Create tasks with dependencies for parallel execution testing
export const createParallelExecutionTasks = (projectId: string): any[] => {
  const tasks: any[] = [];
  
  // Phase 1: Infrastructure tasks
  tasks.push(
    new TaskBuilder()
      .withProjectId(projectId)
      .withName('Database Setup')
      .withTaskType('database')
      .withPriority(10)
      .build(),
    new TaskBuilder()
      .withProjectId(projectId)
      .withName('Environment Configuration')
      .withTaskType('setup')
      .withPriority(10)
      .build()
  );
  
  // Phase 2: Development tasks
  tasks.push(
    new TaskBuilder()
      .withProjectId(projectId)
      .withName('Backend API Development')
      .withTaskType('backend')
      .withPriority(8)
      .build(),
    new TaskBuilder()
      .withProjectId(projectId)
      .withName('Frontend UI Development')
      .withTaskType('frontend')
      .withPriority(8)
      .build()
  );
  
  // Phase 3: Testing and deployment
  tasks.push(
    new TaskBuilder()
      .withProjectId(projectId)
      .withName('Integration Testing')
      .withTaskType('test')
      .withPriority(5)
      .build(),
    new TaskBuilder()
      .withProjectId(projectId)
      .withName('Production Deployment')
      .withTaskType('deploy')
      .withPriority(3)
      .build()
  );
  
  return tasks;
};