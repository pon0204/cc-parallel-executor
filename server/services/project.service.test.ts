import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProjectService } from './project.service';
import { IProjectRepository } from '../repositories/project.repository';
import { ErrorFactory } from '../utils/errors';
import { ProjectBuilder } from '@/test/builders/project.builder';
import { mockDeep } from 'vitest-mock-extended';

// Mock fs/promises at the top level
vi.mock('fs/promises', () => ({
  default: {
    access: vi.fn(),
    mkdir: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
  },
  access: vi.fn(),
  mkdir: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));

// Import fs after mocking
import * as fs from 'fs/promises';

describe('ProjectService', () => {
  let projectService: ProjectService;
  let mockProjectRepository: IProjectRepository;

  beforeEach(() => {
    mockProjectRepository = mockDeep<IProjectRepository>();
    projectService = new ProjectService(mockProjectRepository);
    vi.clearAllMocks();
  });

  describe('getProjectById', () => {
    it('should return a project when it exists', async () => {
      const project = new ProjectBuilder().build();
      const projectWithRelations = {
        ...project,
        tasks: [],
        requirements: [],
        features: [],
      };
      mockProjectRepository.findByIdWithRelations.mockResolvedValue(projectWithRelations);

      const result = await projectService.getProjectById(project.id);

      expect(result).toEqual(projectWithRelations);
      expect(mockProjectRepository.findByIdWithRelations).toHaveBeenCalledWith(project.id);
    });

    it('should throw NotFoundError when project does not exist', async () => {
      const projectId = 'non-existent-id';
      mockProjectRepository.findByIdWithRelations.mockResolvedValue(null);

      await expect(projectService.getProjectById(projectId))
        .rejects
        .toThrow(ErrorFactory.notFound('Project', projectId));
    });
  });

  describe('getProjects', () => {
    it('should return all active projects', async () => {
      const projects = new ProjectBuilder().buildMany(3).map(p => ({
        ...p,
        _count: { tasks: 0, requirements: 0, features: 0 }
      }));
      mockProjectRepository.findAll.mockResolvedValue(projects);

      const result = await projectService.getProjects();

      expect(result).toEqual(projects);
      expect(mockProjectRepository.findAll).toHaveBeenCalledWith(undefined);
    });

    it('should return filtered projects when options provided', async () => {
      const projects = new ProjectBuilder().buildMany(3).map(p => ({
        ...p,
        _count: { tasks: 0, requirements: 0, features: 0 }
      }));
      const options = { includeArchived: true };
      mockProjectRepository.findAll.mockResolvedValue(projects);

      const result = await projectService.getProjects(options);

      expect(result).toEqual(projects);
      expect(mockProjectRepository.findAll).toHaveBeenCalledWith(options);
    });
  });

  describe('createProject', () => {
    it('should create a project with valid data', async () => {
      const createData = {
        name: 'Test Project',
        description: 'Test Description',
        workdir: '/tmp/projects/test',
        maxParallelCc: 5,
      };
      const expectedProject = new ProjectBuilder()
        .withName(createData.name)
        .withDescription(createData.description)
        .withWorkdir(createData.workdir)
        .withMaxParallelCc(createData.maxParallelCc)
        .build();

      // Mock fs.access to succeed (directory exists)
      vi.mocked(fs.access).mockResolvedValue(undefined);
      mockProjectRepository.create.mockResolvedValue(expectedProject);
      mockProjectRepository.findByName.mockResolvedValue(null);

      const result = await projectService.createProject(createData);

      expect(result).toMatchObject({
        ...expectedProject,
        _count: { tasks: 0, requirements: 0, features: 0 }
      });
      expect(mockProjectRepository.create).toHaveBeenCalledWith(createData);
    });

    it('should validate unique project name', async () => {
      const createData = {
        name: 'Duplicate Project',
        workdir: '/tmp/projects/test',
      };
      
      // Mock fs.access to succeed first
      vi.mocked(fs.access).mockResolvedValue(undefined);
      const existingProject = new ProjectBuilder().withName(createData.name).build();
      mockProjectRepository.findByName.mockResolvedValue(existingProject);

      await expect(projectService.createProject(createData))
        .rejects
        .toThrow('already exists');
    });

    it('should validate workdir does not exist', async () => {
      const createData = {
        name: 'Test Project',
        workdir: '/invalid/path',
      };

      mockProjectRepository.findByName.mockResolvedValue(null);
      
      // Mock fs.access to fail (directory doesn't exist)
      vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'));

      await expect(projectService.createProject(createData))
        .rejects
        .toThrow('does not exist');
    });
  });

  describe('updateProject', () => {
    it('should update a project with valid data', async () => {
      const projectId = 'test-id';
      const existingProject = new ProjectBuilder().withId(projectId).build();
      const updateData = {
        name: 'Updated Name',
        maxParallelCc: 10,
      };
      const updatedProject = { ...existingProject, ...updateData };

      mockProjectRepository.update.mockResolvedValue(updatedProject);
      mockProjectRepository.findByName.mockResolvedValue(null);
      mockProjectRepository.getTaskCount.mockResolvedValue(5);
      mockProjectRepository.getRequirementCount.mockResolvedValue(3);
      mockProjectRepository.getFeatureCount.mockResolvedValue(2);

      const result = await projectService.updateProject(projectId, updateData);

      expect(result).toMatchObject({
        ...updatedProject,
        _count: { tasks: 5, requirements: 3, features: 2 }
      });
      expect(mockProjectRepository.update).toHaveBeenCalledWith(projectId, updateData);
    });

    it('should validate unique name when updating', async () => {
      const projectId = 'test-id';
      const updateData = { name: 'Duplicate Name' };
      
      const existingProject = new ProjectBuilder()
        .withId('other-id')
        .withName(updateData.name)
        .build();
      mockProjectRepository.findByName.mockResolvedValue(existingProject);

      await expect(projectService.updateProject(projectId, updateData))
        .rejects
        .toThrow('already exists');
    });
  });

  describe('archiveProject', () => {
    it('should archive project', async () => {
      const projectId = 'test-id';
      const project = new ProjectBuilder().withId(projectId).build();
      const archivedProject = { ...project, archivedAt: new Date() };

      mockProjectRepository.archive.mockResolvedValue(archivedProject);

      await projectService.archiveProject(projectId);

      expect(mockProjectRepository.archive).toHaveBeenCalledWith(projectId);
    });
  });

  describe('deleteProject', () => {
    it('should reject deletion if project has tasks', async () => {
      const projectId = 'test-id';

      mockProjectRepository.getTaskCount.mockResolvedValue(5);

      await expect(projectService.deleteProject(projectId))
        .rejects
        .toThrow('Cannot delete project with existing tasks');
    });

    it('should allow archiving when project has no tasks', async () => {
      const projectId = 'test-id';
      const project = new ProjectBuilder().withId(projectId).build();
      const archivedProject = { ...project, archivedAt: new Date() };

      mockProjectRepository.getTaskCount.mockResolvedValue(0);
      mockProjectRepository.archive.mockResolvedValue(archivedProject);

      await projectService.archiveProject(projectId);

      expect(mockProjectRepository.archive).toHaveBeenCalledWith(projectId);
    });

    it('should permanently delete when force is true', async () => {
      const projectId = 'test-id';

      mockProjectRepository.deleteWithCascade.mockResolvedValue(undefined);

      await projectService.deleteProject(projectId, true);

      expect(mockProjectRepository.deleteWithCascade).toHaveBeenCalledWith(projectId);
    });
  });

  describe('getProjectStats', () => {
    it('should return aggregated project statistics', async () => {
      const projects = [
        { ...new ProjectBuilder().build(), _count: { tasks: 5, requirements: 3, features: 2 } },
        { ...new ProjectBuilder().build(), _count: { tasks: 10, requirements: 7, features: 4 } },
        { ...new ProjectBuilder().withArchived().build(), _count: { tasks: 2, requirements: 1, features: 1 } },
      ];
      
      mockProjectRepository.findAll.mockResolvedValue(projects);

      const result = await projectService.getProjectStats();

      expect(result).toEqual({
        totalProjects: 3,
        activeProjects: 2, // Only 2 are active
        archivedProjects: 1, // 1 is archived
        totalTasks: 17, // 5 + 10 + 2
        totalRequirements: 11, // 3 + 7 + 1
      });
    });
  });

  describe('getProjectsWithPagination', () => {
    it('should return paginated projects', async () => {
      const projects = new ProjectBuilder().buildMany(5).map(p => ({
        ...p,
        _count: { tasks: 0, requirements: 0, features: 0 }
      }));
      
      mockProjectRepository.findAllWithCount.mockResolvedValue({
        data: projects,
        count: 50
      });

      const result = await projectService.getProjectsWithPagination({ page: 1, limit: 5 });

      expect(result).toEqual({
        projects,
        pagination: {
          page: 1,
          limit: 5,
          total: 50,
          totalPages: 10
        }
      });
    });
  });
});

describe('ProjectService - Error Handling', () => {
  let projectService: ProjectService;
  let mockProjectRepository: IProjectRepository;

  beforeEach(() => {
    mockProjectRepository = mockDeep<IProjectRepository>();
    projectService = new ProjectService(mockProjectRepository);
    vi.clearAllMocks();
  });

  it('should handle repository errors gracefully', async () => {
    mockProjectRepository.findByIdWithRelations.mockRejectedValue(new Error('Database connection lost'));

    await expect(projectService.getProjectById('test-id'))
      .rejects
      .toThrow('Failed to fetch project');
  });

  it('should pass through not found errors', async () => {
    const notFoundError = new Error('Project not found');
    mockProjectRepository.findByIdWithRelations.mockRejectedValue(notFoundError);

    await expect(projectService.getProjectById('test-id'))
      .rejects
      .toThrow(notFoundError);
  });
});

describe('ProjectService - Concurrent Operations', () => {
  let projectService: ProjectService;
  let mockProjectRepository: IProjectRepository;

  beforeEach(() => {
    mockProjectRepository = mockDeep<IProjectRepository>();
    projectService = new ProjectService(mockProjectRepository);
  });

  it('should handle concurrent project operations', async () => {
    const projects = new ProjectBuilder().buildMany(5).map(p => ({
      ...p,
      _count: { tasks: 0, requirements: 0, features: 0 }
    }));
    mockProjectRepository.findAll.mockResolvedValue(projects);

    // Simulate concurrent operations
    const operations = [
      projectService.getProjects(),
      projectService.getProjects(), 
      projectService.getProjects(),
    ];

    const results = await Promise.all(operations);

    expect(results).toHaveLength(3);
    expect(results[0]).toEqual(projects);
    expect(mockProjectRepository.findAll).toHaveBeenCalledTimes(3);
  });
});