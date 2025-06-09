import { faker } from '@faker-js/faker';
import { Requirement, RequirementStatus, RequirementType, Priority } from '@prisma/client';

export class RequirementBuilder {
  private requirement: Requirement;

  constructor() {
    const now = new Date();
    
    this.requirement = {
      id: faker.string.uuid(),
      title: faker.company.catchPhrase(),
      description: faker.lorem.paragraph(),
      projectId: faker.string.uuid(),
      parentId: null,
      type: faker.helpers.arrayElement(['FUNCTIONAL', 'NON_FUNCTIONAL', 'BUSINESS', 'TECHNICAL', 'USER_STORY', 'CONSTRAINT']) as RequirementType,
      status: 'DRAFT' as RequirementStatus,
      priority: faker.helpers.arrayElement(['LOW', 'MEDIUM', 'HIGH']) as Priority,
      acceptanceCriteria: faker.helpers.arrayElements([
        'Given a valid input, when processed, then output is generated',
        'System responds within 2 seconds',
        'User can complete the workflow',
        'Data is persisted correctly',
      ], { min: 1, max: 3 }),
      tags: faker.helpers.arrayElements(['mvp', 'phase1', 'critical', 'nice-to-have', 'security'], { min: 0, max: 2 }),
      estimatedHours: faker.number.int({ min: 8, max: 80 }),
      businessValue: faker.lorem.sentence(),
      completedAt: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
  }

  withId(id: string): this {
    this.requirement.id = id;
    return this;
  }

  withTitle(title: string): this {
    this.requirement.title = title;
    return this;
  }

  withDescription(description: string): this {
    this.requirement.description = description;
    return this;
  }

  withProjectId(projectId: string): this {
    this.requirement.projectId = projectId;
    return this;
  }

  withParentId(parentId: string | null): this {
    this.requirement.parentId = parentId;
    return this;
  }

  withType(type: RequirementType): this {
    this.requirement.type = type;
    return this;
  }

  withStatus(status: RequirementStatus): this {
    this.requirement.status = status;
    return this;
  }

  withPriority(priority: Priority): this {
    this.requirement.priority = priority;
    return this;
  }

  withAcceptanceCriteria(criteria: string[]): this {
    this.requirement.acceptanceCriteria = criteria;
    return this;
  }

  withTags(tags: string[]): this {
    this.requirement.tags = tags;
    return this;
  }

  withEstimatedHours(hours: number): this {
    this.requirement.estimatedHours = hours;
    return this;
  }

  withBusinessValue(value: string): this {
    this.requirement.businessValue = value;
    return this;
  }

  withCompleted(): this {
    this.requirement.status = 'COMPLETED';
    this.requirement.completedAt = new Date();
    return this;
  }

  withApproved(): this {
    this.requirement.status = 'APPROVED';
    return this;
  }

  withDeleted(): this {
    this.requirement.deletedAt = new Date();
    return this;
  }

  build(): Requirement {
    return { ...this.requirement };
  }

  buildMany(count: number): Requirement[] {
    return Array.from({ length: count }, () => new RequirementBuilder().build());
  }
}

// Factory functions for quick creation
export const createRequirement = (overrides?: Partial<Requirement>): Requirement => {
  const builder = new RequirementBuilder();
  
  if (overrides) {
    Object.entries(overrides).forEach(([key, value]) => {
      const methodName = `with${key.charAt(0).toUpperCase()}${key.slice(1)}` as keyof RequirementBuilder;
      if (typeof builder[methodName] === 'function') {
        (builder[methodName] as any)(value);
      }
    });
  }
  
  return builder.build();
};

// Preset builders for common scenarios
export const createDraftRequirement = (projectId: string) => 
  new RequirementBuilder().withProjectId(projectId).withStatus('DRAFT').build();

export const createApprovedRequirement = (projectId: string) => 
  new RequirementBuilder().withProjectId(projectId).withApproved().build();

export const createHighPriorityRequirement = (projectId: string) => 
  new RequirementBuilder().withProjectId(projectId).withPriority('HIGH').build();

export const createUserStory = (projectId: string) => 
  new RequirementBuilder()
    .withProjectId(projectId)
    .withType('USER_STORY')
    .withTitle(`As a user, I want to ${faker.hacker.verb()} so that ${faker.company.catchPhrase()}`)
    .build();

export const createFunctionalRequirement = (projectId: string) => 
  new RequirementBuilder()
    .withProjectId(projectId)
    .withType('FUNCTIONAL')
    .withAcceptanceCriteria([
      'System shall perform the specified function',
      'Response time shall be under 2 seconds',
      'Error handling shall provide clear feedback'
    ])
    .build();

// Create requirement hierarchy
export const createRequirementHierarchy = (projectId: string, depth: number = 2): Requirement[] => {
  const requirements: Requirement[] = [];
  
  // Create epic
  const epic = new RequirementBuilder()
    .withProjectId(projectId)
    .withTitle('Epic: ' + faker.company.catchPhrase())
    .withType('BUSINESS')
    .withPriority('HIGH')
    .build();
  requirements.push(epic);
  
  // Create features under epic
  for (let i = 0; i < 3; i++) {
    const feature = new RequirementBuilder()
      .withProjectId(projectId)
      .withParentId(epic.id)
      .withTitle(`Feature ${i + 1}: ${faker.hacker.phrase()}`)
      .withType('FUNCTIONAL')
      .build();
    requirements.push(feature);
    
    // Create user stories under features
    if (depth > 1) {
      for (let j = 0; j < 2; j++) {
        const userStory = new RequirementBuilder()
          .withProjectId(projectId)
          .withParentId(feature.id)
          .withTitle(`As a user, I want to ${faker.hacker.verb()}`)
          .withType('USER_STORY')
          .build();
        requirements.push(userStory);
      }
    }
  }
  
  return requirements;
};

// Create requirements for different project phases
export const createProjectRequirements = (projectId: string): Requirement[] => {
  const requirements: Requirement[] = [];
  
  // Phase 1: Core functionality
  requirements.push(
    new RequirementBuilder()
      .withProjectId(projectId)
      .withTitle('User Authentication')
      .withType('FUNCTIONAL')
      .withPriority('HIGH')
      .withTags(['phase1', 'security', 'mvp'])
      .build(),
    new RequirementBuilder()
      .withProjectId(projectId)
      .withTitle('Data Persistence')
      .withType('TECHNICAL')
      .withPriority('HIGH')
      .withTags(['phase1', 'infrastructure'])
      .build()
  );
  
  // Phase 2: Enhanced features
  requirements.push(
    new RequirementBuilder()
      .withProjectId(projectId)
      .withTitle('Real-time Notifications')
      .withType('FUNCTIONAL')
      .withPriority('MEDIUM')
      .withTags(['phase2', 'enhancement'])
      .build(),
    new RequirementBuilder()
      .withProjectId(projectId)
      .withTitle('Performance Optimization')
      .withType('NON_FUNCTIONAL')
      .withPriority('MEDIUM')
      .withTags(['phase2', 'performance'])
      .build()
  );
  
  // Constraints
  requirements.push(
    new RequirementBuilder()
      .withProjectId(projectId)
      .withTitle('GDPR Compliance')
      .withType('CONSTRAINT')
      .withPriority('HIGH')
      .withTags(['legal', 'security'])
      .build()
  );
  
  return requirements;
};