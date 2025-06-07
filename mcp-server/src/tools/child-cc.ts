import { spawn } from 'node:child_process';
import { v4 as uuidv4 } from 'uuid';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { ChildCCOptions, ChildCCResult, Task } from '../types.js';

export class ChildCCManager {
  private readonly projectRoot: string;
  private readonly ccServiceUrl: string;

  constructor(projectRoot: string, ccServiceUrl = 'http://localhost:3001') {
    this.projectRoot = projectRoot;
    this.ccServiceUrl = ccServiceUrl;
  }

  /**
   * 子CCインスタンスを起動する
   */
  async createChildCC(options: ChildCCOptions): Promise<ChildCCResult> {
    const instanceId = `child-cc-${uuidv4()}`;
    const worktreeName = options.worktreeName || `worktree-${instanceId}`;
    const worktreePath = path.join(options.projectWorkdir, '..', worktreeName);

    try {
      console.log('Creating child CC with options:', options);

      // 1. Git worktreeを作成
      await this.createGitWorktree(options.projectWorkdir, worktreePath, worktreeName);

      // 2. 子CCプロセスを起動
      await this.startChildCCProcess(instanceId, worktreePath, options);

      // 3. CCサービスに登録
      await this.registerCCInstance(instanceId, {
        name: `Child CC - Task ${options.taskId}`,
        type: 'child',
        status: 'running',
        worktreePath,
        parentInstanceId: options.parentInstanceId,
      });

      return {
        instanceId,
        worktreePath,
        status: 'created',
        message: `Child CC ${instanceId} created successfully at ${worktreePath}`,
      };

    } catch (error) {
      console.error('Failed to create child CC:', error);
      return {
        instanceId,
        worktreePath,
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

  private async createGitWorktree(projectWorkdir: string, worktreePath: string, worktreeName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const gitProcess = spawn('git', ['worktree', 'add', worktreePath, 'HEAD'], {
        cwd: projectWorkdir,
        stdio: 'pipe',
      });

      let stdout = '';
      let stderr = '';

      gitProcess.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      gitProcess.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      gitProcess.on('close', (code) => {
        if (code === 0) {
          console.log(`Git worktree created: ${worktreePath}`);
          resolve();
        } else {
          reject(new Error(`Git worktree creation failed: ${stderr || stdout}`));
        }
      });
    });
  }

  private async startChildCCProcess(instanceId: string, worktreePath: string, options: ChildCCOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      // Claude Codeを起動するコマンド
      const ccProcess = spawn('claude', [], {
        cwd: worktreePath,
        stdio: 'pipe',
        env: {
          ...process.env,
          CC_INSTANCE_ID: instanceId,
          CC_PARENT_ID: options.parentInstanceId,
          CC_TASK_ID: options.taskId,
        },
      });

      // プロセス起動の確認
      ccProcess.on('spawn', () => {
        console.log(`Child CC process started: ${instanceId}`);
        
        // ultrathinkプロトコルでタスク指示を送信
        const ultrathinkInstruction = this.formatUltrathinkInstruction(options);
        ccProcess.stdin?.write(ultrathinkInstruction);
        ccProcess.stdin?.end();
        
        resolve();
      });

      ccProcess.on('error', (error) => {
        reject(new Error(`Failed to start child CC process: ${error.message}`));
      });

      // プロセス出力をログに記録
      ccProcess.stdout?.on('data', (data) => {
        console.log(`[${instanceId}] ${data.toString()}`);
      });

      ccProcess.stderr?.on('data', (data) => {
        console.error(`[${instanceId}] ${data.toString()}`);
      });
    });
  }

  private formatUltrathinkInstruction(options: ChildCCOptions): string {
    return `ultrathink

タスク実行指示:

タスクID: ${options.taskId}
親CCインスタンス: ${options.parentInstanceId}

作業指示:
${options.instruction}

このworktreeで独立してタスクを実行し、完了後は結果を報告してください。
`;
  }

  private async registerCCInstance(instanceId: string, data: any): Promise<void> {
    try {
      const response = await fetch(`${this.ccServiceUrl}/api/cc`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: instanceId,
          ...data,
          createdAt: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to register CC instance: ${response.statusText}`);
      }

      console.log(`CC instance registered: ${instanceId}`);
    } catch (error) {
      console.error('Failed to register CC instance:', error);
      // 登録失敗はログのみで続行
    }
  }
}