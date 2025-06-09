import { faker } from '@faker-js/faker';
import { Project } from '@prisma/client';

export class ProjectBuilder {
  private project: any;

  constructor() {
    const now = new Date();
    
    this.project = {
      id: faker.string.uuid(),
      name: faker.company.name() + ' Project',
      description: faker.lorem.paragraph(),
      workdir: `/tmp/projects/${faker.string.alphanumeric(8)}`,
      maxParallelCc: faker.number.int({ min: 1, max: 10 }),
      ultrathinkProtocol: true,
      status: 'active',
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
    };
  }

  withId(id: string): this {
    this.project.id = id;
    return this;
  }

  withName(name: string): this {
    this.project.name = name;
    return this;
  }

  withDescription(description: string): this {
    this.project.description = description;
    return this;
  }

  withWorkdir(workdir: string): this {
    this.project.workdir = workdir;
    return this;
  }

  withMaxParallelCc(maxParallelCc: number): this {
    this.project.maxParallelCc = maxParallelCc;
    return this;
  }

  withUltrathinkProtocol(enabled: boolean): this {
    this.project.ultrathinkProtocol = enabled;
    return this;
  }

  withArchived(): this {
    this.project.archivedAt = new Date();
    this.project.status = 'archived';
    return this;
  }

  withStatus(status: string): this {
    this.project.status = status;
    return this;
  }

  withCreatedAt(date: Date): this {
    this.project.createdAt = date;
    return this;
  }

  withUpdatedAt(date: Date): this {
    this.project.updatedAt = date;
    return this;
  }

  withInactive(): this {
    return this.withArchived();
  }

  build(): any {
    return { ...this.project };
  }

  buildMany(count: number): any[] {
    return Array.from({ length: count }, () => new ProjectBuilder().build());
  }

  buildWithCounts(): any {
    return {
      ...this.project,
      _count: {
        tasks: 0,
        requirements: 0,
        features: 0,
      }
    };
  }
}

// Factory function for quick creation
export const createProject = (overrides?: Partial<any>): any => {
  const builder = new ProjectBuilder();
  
  if (overrides) {
    Object.entries(overrides).forEach(([key, value]) => {
      const methodName = `with${key.charAt(0).toUpperCase()}${key.slice(1)}` as keyof ProjectBuilder;
      if (typeof builder[methodName] === 'function') {
        (builder[methodName] as any)(value);
      }
    });
  }
  
  return builder.build();
};

// Preset builders for common scenarios
export const createActiveProject = () => new ProjectBuilder().build();
export const createArchivedProject = () => new ProjectBuilder().withArchived().build();
export const createProjectWithHighParallelism = () => new ProjectBuilder().withMaxParallelCc(20).build();