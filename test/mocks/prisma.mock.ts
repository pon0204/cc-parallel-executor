import { PrismaClient } from '@prisma/client';
import { mockDeep, mockReset, DeepMockProxy } from 'vitest-mock-extended';
import { vi } from 'vitest';

// Create a deep mock of PrismaClient
export const prismaMock = mockDeep<PrismaClient>() as unknown as DeepMockProxy<PrismaClient>;

// Mock the prisma module
vi.mock('@/server/utils/prisma', () => ({
  prisma: prismaMock,
}));

// Reset mock before each test
beforeEach(() => {
  mockReset(prismaMock);
});

// Utility functions for common mock scenarios
export const mockTransaction = (fn: (tx: any) => Promise<any>) => {
  prismaMock.$transaction.mockImplementation(async (arg: any) => {
    if (typeof arg === 'function') {
      return arg(prismaMock);
    }
    return Promise.all(arg);
  });
};

export const mockCount = (model: keyof PrismaClient, count: number) => {
  (prismaMock[model] as any).count.mockResolvedValue(count);
};

export const mockFindMany = <T>(model: keyof PrismaClient, data: T[]) => {
  (prismaMock[model] as any).findMany.mockResolvedValue(data);
};

export const mockFindUnique = <T>(model: keyof PrismaClient, data: T | null) => {
  (prismaMock[model] as any).findUnique.mockResolvedValue(data);
};

export const mockFindFirst = <T>(model: keyof PrismaClient, data: T | null) => {
  (prismaMock[model] as any).findFirst.mockResolvedValue(data);
};

export const mockCreate = <T>(model: keyof PrismaClient, data: T) => {
  (prismaMock[model] as any).create.mockResolvedValue(data);
};

export const mockUpdate = <T>(model: keyof PrismaClient, data: T) => {
  (prismaMock[model] as any).update.mockResolvedValue(data);
};

export const mockDelete = <T>(model: keyof PrismaClient, data: T) => {
  (prismaMock[model] as any).delete.mockResolvedValue(data);
};

export const mockUpdateMany = (model: keyof PrismaClient, count: number) => {
  (prismaMock[model] as any).updateMany.mockResolvedValue({ count });
};

export const mockDeleteMany = (model: keyof PrismaClient, count: number) => {
  (prismaMock[model] as any).deleteMany.mockResolvedValue({ count });
};

// Mock Prisma errors
export class PrismaClientKnownRequestError extends Error {
  code: string;
  meta?: Record<string, unknown>;
  
  constructor(message: string, code: string, meta?: Record<string, unknown>) {
    super(message);
    this.name = 'PrismaClientKnownRequestError';
    this.code = code;
    this.meta = meta;
  }
}

export const mockPrismaError = (code: string, meta?: Record<string, unknown>) => {
  return new PrismaClientKnownRequestError('Mock Prisma Error', code, meta);
};