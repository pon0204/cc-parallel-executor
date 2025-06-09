import type { PrismaClient, Project, Prisma } from '@prisma/client';
import { BaseRepository } from './base.repository.js';

// プロジェクト関連の型定義
export interface ProjectWithCounts extends Project {
  _count: {
    tasks: number;
    requirements: number;
    features: number;
  };
}

export interface ProjectWithRelations extends Project {
  tasks: Array<{
    id: string;
    name: string;
    status: string;
    priority: number;
  }>;
  requirements: Array<{
    id: string;
    title: string;
    priority: number;
    status: string;
  }>;
  features: Array<{
    id: string;
    name: string;
    priority: number;
    status: string;
  }>;
}

export interface CreateProjectData {
  name: string;
  description?: string;
  workdir: string;
  maxParallelCc?: number;
  ultrathinkProtocol?: boolean;
}

export interface UpdateProjectData {
  name?: string;
  description?: string;
  workdir?: string;
  maxParallelCc?: number;
  ultrathinkProtocol?: boolean;
  status?: string;
}

export interface ProjectQueryOptions {
  includeArchived?: boolean;
  orderBy?: 'name' | 'createdAt' | 'updatedAt';
  orderDirection?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

/**
 * プロジェクトリポジトリのインターフェース
 * テスト時にはモック実装に置き換え可能
 */
export interface IProjectRepository {
  findAll(options?: ProjectQueryOptions): Promise<ProjectWithCounts[]>;
  findAllWithCount(options?: ProjectQueryOptions): Promise<{ data: ProjectWithCounts[]; count: number }>;
  findById(id: string): Promise<Project | null>;
  findByIdWithRelations(id: string): Promise<ProjectWithRelations | null>;
  findByIdOrThrow(id: string): Promise<Project>;
  findByName(name: string): Promise<Project | null>;
  create(data: CreateProjectData): Promise<Project>;
  update(id: string, data: UpdateProjectData): Promise<Project>;
  delete(id: string): Promise<void>;
  deleteWithCascade(id: string): Promise<void>;
  getTaskCount(projectId: string): Promise<number>;
  getRequirementCount(projectId: string): Promise<number>;
  getFeatureCount(projectId: string): Promise<number>;
  archive(id: string): Promise<Project>;
  restore(id: string): Promise<Project>;
}

/**
 * プロジェクトリポジトリの実装
 */
export class ProjectRepository extends BaseRepository implements IProjectRepository {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  async findAll(options: ProjectQueryOptions = {}): Promise<ProjectWithCounts[]> {
    const {
      includeArchived = false,
      orderBy = 'updatedAt',
      orderDirection = 'desc',
      page,
      limit
    } = options;

    const where: Prisma.ProjectWhereInput = includeArchived 
      ? {}
      : { archivedAt: null };

    const orderByClause: Prisma.ProjectOrderByWithRelationInput = {
      [orderBy]: orderDirection,
    };

    const paginationQuery = this.buildPaginationQuery(page, limit);

    return this.prisma.project.findMany({
      where,
      orderBy: orderByClause,
      include: {
        _count: {
          select: {
            tasks: true,
            requirements: true,
            features: true,
          },
        },
      },
      ...paginationQuery,
    });
  }

  async findAllWithCount(options: ProjectQueryOptions = {}): Promise<{ data: ProjectWithCounts[]; count: number }> {
    const {
      includeArchived = false,
      orderBy = 'updatedAt',
      orderDirection = 'desc',
      page,
      limit
    } = options;

    const where: Prisma.ProjectWhereInput = includeArchived 
      ? {}
      : { archivedAt: null };

    const orderByClause: Prisma.ProjectOrderByWithRelationInput = {
      [orderBy]: orderDirection,
    };

    const paginationQuery = this.buildPaginationQuery(page, limit);

    const [data, count] = await Promise.all([
      this.prisma.project.findMany({
        where,
        orderBy: orderByClause,
        include: {
          _count: {
            select: {
              tasks: true,
              requirements: true,
              features: true,
            },
          },
        },
        ...paginationQuery,
      }),
      this.prisma.project.count({ where }),
    ]);

    return { data, count };
  }

  async findById(id: string): Promise<Project | null> {
    return this.prisma.project.findUnique({
      where: { id },
    });
  }

  async findByIdWithRelations(id: string): Promise<ProjectWithRelations | null> {
    return this.prisma.project.findUnique({
      where: { id },
      include: {
        tasks: {
          select: {
            id: true,
            name: true,
            status: true,
            priority: true,
          },
          orderBy: { priority: 'desc' },
        },
        requirements: {
          select: {
            id: true,
            title: true,
            priority: true,
            status: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        features: {
          select: {
            id: true,
            name: true,
            priority: true,
            status: true,
          },
          orderBy: { priority: 'desc' },
        },
      },
    });
  }

  async findByIdOrThrow(id: string): Promise<Project> {
    return this.checkEntityExists(
      this.findById(id),
      'Project',
      id
    );
  }

  async findByName(name: string): Promise<Project | null> {
    return this.prisma.project.findFirst({
      where: { 
        name,
        archivedAt: null, // アーカイブされていないもののみ
      },
    });
  }

  async create(data: CreateProjectData): Promise<Project> {
    return this.prisma.project.create({
      data: {
        name: data.name,
        description: data.description,
        workdir: data.workdir,
        maxParallelCc: data.maxParallelCc ?? 5,
        ultrathinkProtocol: data.ultrathinkProtocol ?? true,
        status: 'active',
      },
    });
  }

  async update(id: string, data: UpdateProjectData): Promise<Project> {
    // プロジェクトの存在確認
    await this.findByIdOrThrow(id);

    return this.prisma.project.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<void> {
    // プロジェクトの存在確認
    await this.findByIdOrThrow(id);

    await this.prisma.project.delete({
      where: { id },
    });
  }

  async deleteWithCascade(id: string): Promise<void> {
    // プロジェクトの存在確認
    await this.findByIdOrThrow(id);

    await this.transaction(async (prisma) => {
      // 関連データを順序通りに削除
      await prisma.taskLog.deleteMany({
        where: { task: { projectId: id } },
      });

      await prisma.taskDependency.deleteMany({
        where: { task: { projectId: id } },
      });

      await prisma.ultrathinkMessage.deleteMany({
        where: { task: { projectId: id } },
      });

      await prisma.gitWorktree.deleteMany({
        where: { projectId: id },
      });

      await prisma.task.deleteMany({
        where: { projectId: id },
      });

      await prisma.requirement.deleteMany({
        where: { projectId: id },
      });

      await prisma.feature.deleteMany({
        where: { projectId: id },
      });

      await prisma.executionPhase.deleteMany({
        where: { projectId: id },
      });

      // 最後にプロジェクトを削除
      await prisma.project.delete({
        where: { id },
      });
    });
  }

  async getTaskCount(projectId: string): Promise<number> {
    return this.prisma.task.count({
      where: { projectId },
    });
  }

  async getRequirementCount(projectId: string): Promise<number> {
    return this.prisma.requirement.count({
      where: { projectId },
    });
  }

  async getFeatureCount(projectId: string): Promise<number> {
    return this.prisma.feature.count({
      where: { projectId },
    });
  }

  async archive(id: string): Promise<Project> {
    await this.findByIdOrThrow(id);

    return this.prisma.project.update({
      where: { id },
      data: {
        status: 'archived',
        archivedAt: new Date(),
      },
    });
  }

  async restore(id: string): Promise<Project> {
    await this.findByIdOrThrow(id);

    return this.prisma.project.update({
      where: { id },
      data: {
        status: 'active',
        archivedAt: null,
      },
    });
  }
}