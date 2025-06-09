import { describe, it, expect, beforeEach } from 'vitest';
import { ProjectRepository } from './project.repository';
import { prismaMock, mockCreate, mockFindUnique, mockFindMany, mockUpdate, mockDelete } from '@/test/mocks/prisma.mock';
import { ProjectBuilder } from '@/test/builders/project.builder';

describe('ProjectRepository', () => {
  let projectRepository: ProjectRepository;

  beforeEach(() => {
    projectRepository = new ProjectRepository(prismaMock);
  });

  describe('findById', () => {
    it('should return project when found', async () => {
      const project = new ProjectBuilder().build();
      mockFindUnique('project', project);

      const result = await projectRepository.findById(project.id);

      expect(result).toEqual(project);
      expect(prismaMock.project.findUnique).toHaveBeenCalledWith({
        where: { id: project.id }
      });
    });

    it('should return null when not found', async () => {
      mockFindUnique('project', null);

      const result = await projectRepository.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should return only active projects by default', async () => {
      const projects = [
        new ProjectBuilder().build(),
        new ProjectBuilder().withInactive().build(),
      ];
      const activeProjects = projects.filter(p => !p.archivedAt);
      mockFindMany('project', activeProjects);

      const result = await projectRepository.findAll();

      expect(result).toEqual(activeProjects);
      expect(prismaMock.project.findMany).toHaveBeenCalledWith({
        where: { archivedAt: null },
        orderBy: { updatedAt: 'desc' },
        include: {
          _count: {
            select: {
              tasks: true,
              requirements: true,
              features: true,
            },
          },
        },
      });
    });

    it('should return all projects when includeArchived is true', async () => {
      const projects = new ProjectBuilder().buildMany(3);
      mockFindMany('project', projects);

      const result = await projectRepository.findAll({ includeArchived: true });

      expect(result).toEqual(projects);
      expect(prismaMock.project.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { updatedAt: 'desc' },
        include: {
          _count: {
            select: {
              tasks: true,
              requirements: true,
              features: true,
            },
          },
        },
      });
    });
  });

  describe('create', () => {
    it('should create a project with provided data', async () => {
      const createData = {
        name: 'New Project',
        description: 'Description',
        workdir: '/tmp/projects/test',
        maxParallelCc: 5,
        ultrathinkProtocol: true,
      };
      const createdProject = new ProjectBuilder()
        .withName(createData.name)
        .withDescription(createData.description)
        .build();

      mockCreate('project', createdProject);

      const result = await projectRepository.create(createData);

      expect(result).toEqual(createdProject);
      expect(prismaMock.project.create).toHaveBeenCalledWith({
        data: {
          name: createData.name,
          description: createData.description,
          workdir: createData.workdir,
          maxParallelCc: createData.maxParallelCc,
          ultrathinkProtocol: createData.ultrathinkProtocol,
          status: 'active',
        }
      });
    });
  });

  describe('update', () => {
    it('should update project with provided data', async () => {
      const projectId = 'test-id';
      const updateData = { name: 'Updated Name', maxParallelCc: 10 };
      const updatedProject = new ProjectBuilder()
        .withId(projectId)
        .withName(updateData.name)
        .withMaxParallelCc(updateData.maxParallelCc)
        .build();

      // Mock findByIdOrThrow
      const existingProject = new ProjectBuilder().withId(projectId).build();
      prismaMock.project.findUnique.mockResolvedValue(existingProject);
      mockUpdate('project', updatedProject);

      const result = await projectRepository.update(projectId, updateData);

      expect(result).toEqual(updatedProject);
      expect(prismaMock.project.update).toHaveBeenCalledWith({
        where: { id: projectId },
        data: updateData
      });
    });
  });

  describe('deleteWithCascade', () => {
    it('should cascade delete all related entities', async () => {
      const projectId = 'test-id';

      // Mock the transaction
      prismaMock.$transaction.mockImplementation(async (fn: any) => {
        if (typeof fn === 'function') {
          return fn(prismaMock);
        }
        return Promise.all(fn);
      });

      // Mock all the deleteMany operations
      prismaMock.taskLog.deleteMany.mockResolvedValue({ count: 10 });
      prismaMock.taskDependency.deleteMany.mockResolvedValue({ count: 8 });
      prismaMock.ultrathinkMessage.deleteMany.mockResolvedValue({ count: 2 });
      prismaMock.gitWorktree.deleteMany.mockResolvedValue({ count: 1 });
      prismaMock.task.deleteMany.mockResolvedValue({ count: 5 });
      prismaMock.requirement.deleteMany.mockResolvedValue({ count: 4 });
      prismaMock.feature.deleteMany.mockResolvedValue({ count: 3 });
      prismaMock.executionPhase.deleteMany.mockResolvedValue({ count: 2 });
      // Mock findByIdOrThrow
      const project = new ProjectBuilder().withId(projectId).build();
      prismaMock.project.findUnique.mockResolvedValue(project);
      mockDelete('project', {});

      await projectRepository.deleteWithCascade(projectId);

      // Verify cascade deletion order matches the repository implementation
      expect(prismaMock.taskLog.deleteMany).toHaveBeenCalledWith({
        where: { task: { projectId } }
      });
      expect(prismaMock.taskDependency.deleteMany).toHaveBeenCalledWith({
        where: { task: { projectId } }
      });
      expect(prismaMock.ultrathinkMessage.deleteMany).toHaveBeenCalledWith({
        where: { task: { projectId } }
      });
      expect(prismaMock.gitWorktree.deleteMany).toHaveBeenCalledWith({
        where: { projectId }
      });
      expect(prismaMock.task.deleteMany).toHaveBeenCalledWith({
        where: { projectId }
      });
      expect(prismaMock.requirement.deleteMany).toHaveBeenCalledWith({
        where: { projectId }
      });
      expect(prismaMock.feature.deleteMany).toHaveBeenCalledWith({
        where: { projectId }
      });
      expect(prismaMock.executionPhase.deleteMany).toHaveBeenCalledWith({
        where: { projectId }
      });
      expect(prismaMock.project.delete).toHaveBeenCalledWith({
        where: { id: projectId }
      });
    });
  });

  describe('archive', () => {
    it('should archive project by setting status and archivedAt', async () => {
      const projectId = 'test-id';
      const archivedProject = new ProjectBuilder()
        .withId(projectId)
        .withInactive()
        .build();

      // Mock findByIdOrThrow
      const existingProject = new ProjectBuilder().withId(projectId).build();
      prismaMock.project.findUnique.mockResolvedValue(existingProject);
      mockUpdate('project', archivedProject);

      const result = await projectRepository.archive(projectId);

      expect(result).toEqual(archivedProject);
      expect(prismaMock.project.update).toHaveBeenCalledWith({
        where: { id: projectId },
        data: {
          status: 'archived',
          archivedAt: expect.any(Date)
        }
      });
    });
  });

  describe('restore', () => {
    it('should restore archived project', async () => {
      const projectId = 'test-id';
      const restoredProject = new ProjectBuilder()
        .withId(projectId)
        .build();

      // Mock findByIdOrThrow
      const archivedProject = new ProjectBuilder().withId(projectId).withArchived().build();
      prismaMock.project.findUnique.mockResolvedValue(archivedProject);
      mockUpdate('project', restoredProject);

      const result = await projectRepository.restore(projectId);

      expect(result).toEqual(restoredProject);
      expect(prismaMock.project.update).toHaveBeenCalledWith({
        where: { id: projectId },
        data: {
          status: 'active',
          archivedAt: null
        }
      });
    });
  });

  describe('findByName', () => {
    it('should find project by name', async () => {
      const name = 'Test Project';
      const project = new ProjectBuilder().withName(name).build();

      prismaMock.project.findFirst.mockResolvedValue(project);

      const result = await projectRepository.findByName(name);

      expect(result).toEqual(project);
      expect(prismaMock.project.findFirst).toHaveBeenCalledWith({
        where: { name, archivedAt: null }
      });
    });
  });

  describe('count methods', () => {
    it('should return task count', async () => {
      const projectId = 'test-id';

      prismaMock.task.count.mockResolvedValue(10);
      
      const result = await projectRepository.getTaskCount(projectId);
      
      expect(result).toBe(10);
      expect(prismaMock.task.count).toHaveBeenCalledWith({
        where: { projectId }
      });
    });

    it('should return requirement count', async () => {
      const projectId = 'test-id';

      prismaMock.requirement.count.mockResolvedValue(5);
      
      const result = await projectRepository.getRequirementCount(projectId);
      
      expect(result).toBe(5);
      expect(prismaMock.requirement.count).toHaveBeenCalledWith({
        where: { projectId }
      });
    });

    it('should return feature count', async () => {
      const projectId = 'test-id';

      prismaMock.feature.count.mockResolvedValue(3);
      
      const result = await projectRepository.getFeatureCount(projectId);
      
      expect(result).toBe(3);
      expect(prismaMock.feature.count).toHaveBeenCalledWith({
        where: { projectId }
      });
    });
  });

  describe('findByIdOrThrow', () => {
    it('should return project when found', async () => {
      const projectId = 'test-id';
      const project = new ProjectBuilder().withId(projectId).build();
      prismaMock.project.findUnique.mockResolvedValue(project);

      const result = await projectRepository.findByIdOrThrow(projectId);
      
      expect(result).toEqual(project);
    });

    it('should throw when project not found', async () => {
      const projectId = 'non-existent';
      prismaMock.project.findUnique.mockResolvedValue(null);

      await expect(projectRepository.findByIdOrThrow(projectId))
        .rejects
        .toThrow(`Project with ID 'non-existent' not found`);
    });
  });

});