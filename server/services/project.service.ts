import { promises as fs } from 'fs';
import type { 
  IProjectRepository, 
  ProjectWithCounts, 
  ProjectWithRelations,
  CreateProjectData,
  UpdateProjectData,
  ProjectQueryOptions
} from '../repositories/project.repository.js';
import { ErrorFactory } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export interface ProjectStats {
  totalProjects: number;
  activeProjects: number;
  archivedProjects: number;
  totalTasks: number;
  totalRequirements: number;
}

/**
 * プロジェクトサービス - ビジネスロジックを含む
 * リポジトリパターンを使用してデータアクセスを抽象化
 */
export class ProjectService {
  constructor(
    private readonly projectRepository: IProjectRepository
  ) {}

  /**
   * プロジェクト一覧取得
   */
  async getProjects(options?: ProjectQueryOptions): Promise<ProjectWithCounts[]> {
    try {
      return await this.projectRepository.findAll(options);
    } catch (error) {
      logger.error('Failed to fetch projects:', error);
      throw ErrorFactory.internal('Failed to fetch projects');
    }
  }

  /**
   * ページネーション対応のプロジェクト一覧取得
   */
  async getProjectsWithPagination(options?: ProjectQueryOptions): Promise<{
    projects: ProjectWithCounts[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    try {
      const { page = 1, limit = 10 } = options || {};
      const { data: projects, count: total } = await this.projectRepository.findAllWithCount({
        ...options,
        page,
        limit,
      });

      return {
        projects,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error('Failed to fetch projects with pagination:', error);
      throw ErrorFactory.internal('Failed to fetch projects');
    }
  }

  /**
   * プロジェクト詳細取得
   */
  async getProjectById(id: string): Promise<ProjectWithRelations> {
    try {
      const project = await this.projectRepository.findByIdWithRelations(id);
      if (!project) {
        throw ErrorFactory.notFound('Project', id);
      }
      return project;
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        throw error;
      }
      logger.error('Failed to fetch project:', error);
      throw ErrorFactory.internal('Failed to fetch project');
    }
  }

  /**
   * プロジェクト作成
   */
  async createProject(data: CreateProjectData): Promise<ProjectWithCounts> {
    try {
      // ワーキングディレクトリの存在確認
      await this.validateWorkingDirectory(data.workdir);

      // 同名プロジェクトの存在確認
      await this.validateUniqueProjectName(data.name);

      // プロジェクト作成
      const project = await this.projectRepository.create(data);

      logger.info('Project created successfully:', {
        projectId: project.id,
        name: project.name,
        workdir: project.workdir,
      });

      // カウント情報付きで返す
      return {
        ...project,
        _count: {
          tasks: 0,
          requirements: 0,
          features: 0,
        },
      };
    } catch (error) {
      if (error instanceof Error && (
        error.message.includes('not found') || 
        error.message.includes('already exists') ||
        error.message.includes('does not exist')
      )) {
        throw error;
      }
      logger.error('Failed to create project:', error);
      throw ErrorFactory.internal('Failed to create project');
    }
  }

  /**
   * プロジェクト更新
   */
  async updateProject(id: string, data: UpdateProjectData): Promise<ProjectWithCounts> {
    try {
      // ワーキングディレクトリが変更される場合は検証
      if (data.workdir) {
        await this.validateWorkingDirectory(data.workdir);
      }

      // 名前が変更される場合は重複チェック
      if (data.name) {
        await this.validateUniqueProjectName(data.name, id);
      }

      const updatedProject = await this.projectRepository.update(id, data);

      logger.info('Project updated successfully:', {
        projectId: updatedProject.id,
        changes: Object.keys(data),
      });

      // カウント情報を取得して返す
      const [taskCount, requirementCount, featureCount] = await Promise.all([
        this.projectRepository.getTaskCount(id),
        this.projectRepository.getRequirementCount(id),
        this.projectRepository.getFeatureCount(id),
      ]);

      return {
        ...updatedProject,
        _count: {
          tasks: taskCount,
          requirements: requirementCount,
          features: featureCount,
        },
      };
    } catch (error) {
      if (error instanceof Error && (
        error.message.includes('not found') || 
        error.message.includes('already exists') ||
        error.message.includes('does not exist')
      )) {
        throw error;
      }
      logger.error('Failed to update project:', error);
      throw ErrorFactory.internal('Failed to update project');
    }
  }

  /**
   * プロジェクト削除
   */
  async deleteProject(id: string, force: boolean = false): Promise<void> {
    try {
      if (force) {
        await this.projectRepository.deleteWithCascade(id);
        logger.info('Project deleted with cascade:', { projectId: id });
      } else {
        // タスクが存在する場合は削除を拒否
        const taskCount = await this.projectRepository.getTaskCount(id);
        if (taskCount > 0) {
          throw ErrorFactory.badRequest(
            'Cannot delete project with existing tasks. Please delete all tasks first or use force=true.',
            { taskCount }
          );
        }

        await this.projectRepository.delete(id);
        logger.info('Project deleted:', { projectId: id });
      }
    } catch (error) {
      if (error instanceof Error && (
        error.message.includes('not found') || 
        error.message.includes('Cannot delete project')
      )) {
        throw error;
      }
      logger.error('Failed to delete project:', error);
      throw ErrorFactory.internal('Failed to delete project');
    }
  }

  /**
   * プロジェクトアーカイブ
   */
  async archiveProject(id: string): Promise<ProjectWithCounts> {
    try {
      const archivedProject = await this.projectRepository.archive(id);

      logger.info('Project archived:', { projectId: id });

      // カウント情報を取得して返す
      const [taskCount, requirementCount, featureCount] = await Promise.all([
        this.projectRepository.getTaskCount(id),
        this.projectRepository.getRequirementCount(id),
        this.projectRepository.getFeatureCount(id),
      ]);

      return {
        ...archivedProject,
        _count: {
          tasks: taskCount,
          requirements: requirementCount,
          features: featureCount,
        },
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        throw error;
      }
      logger.error('Failed to archive project:', error);
      throw ErrorFactory.internal('Failed to archive project');
    }
  }

  /**
   * プロジェクト復元
   */
  async restoreProject(id: string): Promise<ProjectWithCounts> {
    try {
      const restoredProject = await this.projectRepository.restore(id);

      logger.info('Project restored:', { projectId: id });

      // カウント情報を取得して返す
      const [taskCount, requirementCount, featureCount] = await Promise.all([
        this.projectRepository.getTaskCount(id),
        this.projectRepository.getRequirementCount(id),
        this.projectRepository.getFeatureCount(id),
      ]);

      return {
        ...restoredProject,
        _count: {
          tasks: taskCount,
          requirements: requirementCount,
          features: featureCount,
        },
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        throw error;
      }
      logger.error('Failed to restore project:', error);
      throw ErrorFactory.internal('Failed to restore project');
    }
  }

  /**
   * プロジェクト統計情報取得
   */
  async getProjectStats(): Promise<ProjectStats> {
    try {
      const [allProjects, archivedProjects] = await Promise.all([
        this.projectRepository.findAll({ includeArchived: true }),
        this.projectRepository.findAll({ includeArchived: true, orderBy: 'archivedAt' }),
      ]);

      const activeProjects = allProjects.filter(p => p.status === 'active');
      const archived = archivedProjects.filter(p => p.archivedAt !== null);

      const totalTasks = allProjects.reduce((sum, p) => sum + p._count.tasks, 0);
      const totalRequirements = allProjects.reduce((sum, p) => sum + p._count.requirements, 0);

      return {
        totalProjects: allProjects.length,
        activeProjects: activeProjects.length,
        archivedProjects: archived.length,
        totalTasks,
        totalRequirements,
      };
    } catch (error) {
      logger.error('Failed to fetch project stats:', error);
      throw ErrorFactory.internal('Failed to fetch project statistics');
    }
  }

  /**
   * ワーキングディレクトリの存在確認
   */
  private async validateWorkingDirectory(workdir: string): Promise<void> {
    try {
      await fs.access(workdir);
    } catch {
      throw ErrorFactory.badRequest('Working directory does not exist', {
        workdir,
      });
    }
  }

  /**
   * プロジェクト名の重複チェック
   */
  private async validateUniqueProjectName(name: string, excludeId?: string): Promise<void> {
    const existingProject = await this.projectRepository.findByName(name);
    
    if (existingProject && existingProject.id !== excludeId) {
      throw ErrorFactory.conflict('Project with this name already exists', {
        name,
        existingProjectId: existingProject.id,
      });
    }
  }
}