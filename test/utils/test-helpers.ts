import { vi, MockedFunction } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { Socket } from 'socket.io';

// Mock Express request/response objects
export const createMockRequest = (overrides?: Partial<Request>): Request => {
  const req: Partial<Request> = {
    params: {},
    query: {},
    body: {},
    headers: {},
    method: 'GET',
    url: '/',
    path: '/',
    get: vi.fn(),
    header: vi.fn(),
    ...overrides,
  };
  
  return req as Request;
};

export const createMockResponse = (): Response & {
  _getData: () => any;
  _getStatusCode: () => number;
  _getHeaders: () => Record<string, any>;
} => {
  let statusCode = 200;
  let data: any;
  let headers: Record<string, any> = {};
  
  const res: any = {
    status: vi.fn().mockImplementation((code: number) => {
      statusCode = code;
      return res;
    }),
    json: vi.fn().mockImplementation((body: any) => {
      data = body;
      return res;
    }),
    send: vi.fn().mockImplementation((body: any) => {
      data = body;
      return res;
    }),
    setHeader: vi.fn().mockImplementation((key: string, value: any) => {
      headers[key] = value;
      return res;
    }),
    end: vi.fn(),
    _getData: () => data,
    _getStatusCode: () => statusCode,
    _getHeaders: () => headers,
  };
  
  return res;
};

export const createMockNext = (): NextFunction => vi.fn();

// Mock Socket.IO socket
export const createMockSocket = (overrides?: Partial<Socket>): Socket => {
  const socket: Partial<Socket> = {
    id: 'mock-socket-id',
    emit: vi.fn(),
    on: vi.fn(),
    once: vi.fn(),
    off: vi.fn(),
    disconnect: vi.fn(),
    join: vi.fn(),
    leave: vi.fn(),
    broadcast: {
      emit: vi.fn(),
      to: vi.fn().mockReturnThis(),
    } as any,
    to: vi.fn().mockReturnThis(),
    ...overrides,
  };
  
  return socket as Socket;
};

// Wait for async operations
export const waitFor = async (
  callback: () => boolean | Promise<boolean>,
  options: { timeout?: number; interval?: number } = {}
): Promise<void> => {
  const { timeout = 5000, interval = 50 } = options;
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    if (await callback()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  throw new Error(`waitFor timeout after ${timeout}ms`);
};

// Test async errors
export const expectAsync = async (
  asyncFn: () => Promise<any>
): Promise<{
  toThrow: (error?: any) => Promise<void>;
  toResolve: () => Promise<any>;
  toReject: () => Promise<void>;
}> => {
  return {
    toThrow: async (expectedError?: any) => {
      try {
        await asyncFn();
        throw new Error('Expected function to throw');
      } catch (error) {
        if (expectedError) {
          expect(error).toEqual(expectedError);
        }
      }
    },
    toResolve: async () => {
      return await asyncFn();
    },
    toReject: async () => {
      await expect(asyncFn()).rejects.toBeTruthy();
    },
  };
};

// Mock timers utilities
export const advanceTimersByTime = async (ms: number) => {
  vi.advanceTimersByTime(ms);
  await Promise.resolve(); // Allow microtasks to run
};

export const runAllTimers = async () => {
  vi.runAllTimers();
  await Promise.resolve(); // Allow microtasks to run
};

// Database transaction helper
export const withTransaction = async <T>(
  fn: () => Promise<T>,
  options: { shouldRollback?: boolean } = {}
): Promise<T> => {
  const { shouldRollback = true } = options;
  
  try {
    const result = await fn();
    if (shouldRollback) {
      // In tests, we typically want to rollback to keep the database clean
      throw new Error('Rolling back transaction');
    }
    return result;
  } catch (error) {
    if (error instanceof Error && error.message === 'Rolling back transaction') {
      throw error;
    }
    throw error;
  }
};

// Performance testing helper
export const measurePerformance = async (
  name: string,
  fn: () => Promise<void>,
  options: { runs?: number; warmup?: number } = {}
): Promise<{
  name: string;
  runs: number;
  average: number;
  min: number;
  max: number;
  median: number;
}> => {
  const { runs = 10, warmup = 2 } = options;
  
  // Warmup runs
  for (let i = 0; i < warmup; i++) {
    await fn();
  }
  
  // Measured runs
  const times: number[] = [];
  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    await fn();
    const end = performance.now();
    times.push(end - start);
  }
  
  times.sort((a, b) => a - b);
  
  return {
    name,
    runs,
    average: times.reduce((sum, time) => sum + time, 0) / times.length,
    min: times[0],
    max: times[times.length - 1],
    median: times[Math.floor(times.length / 2)],
  };
};

// Mock environment variables
export const withEnv = async (
  envVars: Record<string, string>,
  fn: () => Promise<void>
): Promise<void> => {
  const originalEnv = { ...process.env };
  
  try {
    Object.assign(process.env, envVars);
    await fn();
  } finally {
    process.env = originalEnv;
  }
};

// Test data cleanup tracker
export class TestDataTracker {
  private cleanupFns: Array<() => Promise<void>> = [];
  
  register(cleanupFn: () => Promise<void>): void {
    this.cleanupFns.push(cleanupFn);
  }
  
  async cleanup(): Promise<void> {
    for (const fn of this.cleanupFns.reverse()) {
      await fn();
    }
    this.cleanupFns = [];
  }
}

// Snapshot testing utilities
export const createSnapshot = (data: any, name?: string): string => {
  const snapshot = JSON.stringify(data, null, 2);
  if (name) {
    return `// Snapshot: ${name}\n${snapshot}`;
  }
  return snapshot;
};

// Type-safe mock function creator
export const createMockFn = <T extends (...args: any[]) => any>(
  implementation?: T
): MockedFunction<T> => {
  return vi.fn(implementation) as MockedFunction<T>;
};