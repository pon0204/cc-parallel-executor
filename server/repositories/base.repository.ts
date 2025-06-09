import type { PrismaClient } from '@prisma/client';

/**
 * ベースリポジトリクラス - 共通操作を提供
 */
export abstract class BaseRepository {
  protected prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * トランザクション実行のヘルパー
   */
  async transaction<T>(
    fn: (prisma: PrismaClient) => Promise<T>
  ): Promise<T> {
    return this.prisma.$transaction(fn);
  }

  /**
   * エンティティ存在チェック
   */
  protected async checkEntityExists<T>(
    findOperation: Promise<T | null>,
    entityName: string,
    id?: string
  ): Promise<T> {
    const entity = await findOperation;
    if (!entity) {
      const message = id 
        ? `${entityName} with ID '${id}' not found`
        : `${entityName} not found`;
      throw new Error(message);
    }
    return entity;
  }

  /**
   * ページネーションのヘルパー
   */
  protected buildPaginationQuery(page?: number, limit?: number) {
    if (!page || !limit) return {};
    
    const skip = (page - 1) * limit;
    return {
      skip,
      take: limit,
    };
  }

  /**
   * カウントとデータを同時取得
   */
  protected async findManyWithCount<T>(
    findManyOperation: Promise<T[]>,
    countOperation: Promise<number>
  ): Promise<{ data: T[]; count: number }> {
    const [data, count] = await Promise.all([
      findManyOperation,
      countOperation,
    ]);
    
    return { data, count };
  }
}