import type { ChildCCOptions, ChildCCResult, Task } from '../types.js';

export class ChildCCManager {
  private readonly projectRoot: string;
  private readonly ccServiceUrl: string;

  constructor(projectRoot: string, ccServiceUrl = 'http://localhost:8081') {
    this.projectRoot = projectRoot;
    this.ccServiceUrl = ccServiceUrl;
  }

  /**
   * 子CCインスタンスを起動する
   */
  async createChildCC(options: ChildCCOptions): Promise<ChildCCResult> {
    try {
      console.log('Creating child CC with options:', options);

      // CCサービスのAPIを使用して子CCを作成
      const response = await fetch(`${this.ccServiceUrl}/api/cc/child`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId: options.projectId,
          taskId: options.taskId,
          instruction: options.instruction,
          projectWorkdir: options.projectWorkdir,
          name: options.name || `Child CC - Task ${options.taskId}`,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to create child CC: ${error}`);
      }

      const result = await response.json();
      
      return {
        instanceId: result.instanceId,
        worktreePath: result.worktreePath,
        status: result.status,
        message: result.message,
      };
    } catch (error) {
      console.error('Failed to create child CC:', error);
      return {
        instanceId: 'unknown',
        worktreePath: 'unknown',
        status: 'failed',
        message: `Failed to create child CC: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * タスクを取得する
   */
  async getTask(taskId: string): Promise<Task | null> {
    try {
      const response = await fetch(`${this.ccServiceUrl}/api/tasks/${taskId}`);
      if (!response.ok) {
        return null;
      }
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch task:', error);
      return null;
    }
  }

  /**
   * プロジェクトの利用可能なタスクを取得する
   */
  async getAvailableTasks(projectId: string): Promise<Task[]> {
    try {
      const response = await fetch(`${this.ccServiceUrl}/api/tasks/ready/${projectId}`);
      if (!response.ok) {
        return [];
      }
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch available tasks:', error);
      return [];
    }
  }
}
