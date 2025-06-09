import { vi } from 'vitest';
import path from 'path';
import fs from 'fs/promises';

// Mock environment variables for testing
export const setupTestEnvironment = () => {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'file:./test.db';
  process.env.AUTO_CLEANUP_WORKTREE = 'false';
  process.env.CLAUDE_PATH = '/usr/local/bin/claude';
  process.env.LOG_LEVEL = 'error';
  process.env.PROJECTS_BASE_DIR = '/tmp/test-projects';
};

// Mock file system operations
export const mockFileSystem = () => {
  vi.mock('fs/promises', () => ({
    access: vi.fn().mockResolvedValue(undefined),
    mkdir: vi.fn().mockResolvedValue(undefined),
    rm: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue('{}'),
    writeFile: vi.fn().mockResolvedValue(undefined),
    stat: vi.fn().mockResolvedValue({ isDirectory: () => true }),
  }));
};

// Mock execa for git operations
export const mockExeca = () => {
  vi.mock('execa', () => ({
    execa: vi.fn().mockResolvedValue({
      stdout: 'Mocked command output',
      stderr: '',
      exitCode: 0,
    }),
  }));
};

// Setup all mocks
export const setupAllMocks = () => {
  setupTestEnvironment();
  mockFileSystem();
  mockExeca();
};