import { describe, it, expect } from 'vitest';
import { ProjectBuilder } from './builders/project.builder';
import { TaskBuilder } from './builders/task.builder';

describe('Vitest Environment Test', () => {
  it('should run a simple test', () => {
    expect(1 + 1).toBe(2);
  });

  it('should use custom matchers', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    expect(uuid).toBeValidUUID();
  });

  it('should create test data with builders', () => {
    const project = new ProjectBuilder()
      .withName('Test Project')
      .withMaxParallelCc(5)
      .build();

    expect(project.name).toBe('Test Project');
    expect(project.maxParallelCc).toBe(5);
    expect(project.id).toBeValidUUID();
  });

  it('should create multiple test objects', () => {
    const tasks = new TaskBuilder().buildMany(5);
    
    expect(tasks).toHaveLength(5);
    tasks.forEach(task => {
      expect(task.id).toBeValidUUID();
      expect(task.status).toBe('PENDING');
    });
  });

  describe('async tests', () => {
    it('should handle async operations', async () => {
      const promise = Promise.resolve('test-value');
      await expect(promise).resolves.toBe('test-value');
    });

    it('should handle async errors', async () => {
      const promise = Promise.reject(new Error('test error'));
      await expect(promise).rejects.toThrow('test error');
    });
  });
});