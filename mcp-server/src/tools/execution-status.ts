import type { Task, CCInstance } from '../types.js';

export interface ExecutionStatus {
  projectId: string;
  phases: PhaseStatus[];
  summary: {
    totalTasks: number;
    completedTasks: number;
    runningTasks: number;
    failedTasks: number;
    pendingTasks: number;
  };
  activeInstances: CCInstanceStatus[];
}

export interface PhaseStatus {
  phaseNumber: number;
  name: string;
  tasks: TaskStatus[];
  status: 'pending' | 'running' | 'completed' | 'partial';
}

export interface TaskStatus {
  id: string;
  name: string;
  status: string;
  assignedTo?: string;
  startedAt?: Date;
  completedAt?: Date;
  lastQualityCheck?: {
    lint?: boolean;
    build?: boolean;
    test?: boolean;
    checkedAt?: Date;
  };
}

export interface CCInstanceStatus {
  instanceId: string;
  taskId: string;
  taskName: string;
  status: string;
  worktreePath: string;
  startedAt?: Date;
}

export class ExecutionStatusManager {
  private readonly projectServerUrl: string;

  constructor(projectServerUrl = 'http://localhost:8081') {
    this.projectServerUrl = projectServerUrl;
  }

  /**
   * プロジェクトの並列実行状況を取得
   */
  async getExecutionStatus(projectId: string): Promise<ExecutionStatus> {
    try {
      // プロジェクトの全タスクを取得
      const tasksResponse = await fetch(`${this.projectServerUrl}/api/projects/${projectId}/tasks`);
      if (!tasksResponse.ok) {
        throw new Error('Failed to fetch tasks');
      }
      const tasks = await tasksResponse.json();

      // アクティブな子CCインスタンスを取得
      const instancesResponse = await fetch(`${this.projectServerUrl}/api/cc/active`);
      const instances = instancesResponse.ok ? await instancesResponse.json() : [];

      // タスクをステータスごとに分類
      const tasksByStatus = this.groupTasksByStatus(tasks);
      
      // フェーズごとのタスクを整理
      const phases = this.organizeTasksByPhase(tasks);

      // アクティブなインスタンスの詳細
      const activeInstances = instances
        .filter((instance: any) => instance.type === 'CHILD')
        .map((instance: any) => {
          const task = tasks.find((t: any) => t.id === instance.assignedTaskId);
          return {
            instanceId: instance.id,
            taskId: task?.id,
            taskName: task?.name || 'Unknown',
            status: instance.status,
            worktreePath: instance.worktreePath,
            startedAt: instance.startedAt,
          };
        });

      return {
        projectId,
        phases,
        summary: {
          totalTasks: tasks.length,
          completedTasks: tasksByStatus.completed.length,
          runningTasks: tasksByStatus.running.length,
          failedTasks: tasksByStatus.failed.length,
          pendingTasks: tasksByStatus.pending.length,
        },
        activeInstances,
      };
    } catch (error) {
      throw new Error(`Failed to get execution status: ${error}`);
    }
  }

  /**
   * タスクをステータスごとにグループ化
   */
  private groupTasksByStatus(tasks: any[]): Record<string, any[]> {
    const groups: Record<string, any[]> = {
      pending: [],
      running: [],
      completed: [],
      failed: [],
    };

    tasks.forEach(task => {
      const status = task.status.toLowerCase();
      if (status === 'pending' || status === 'queued') {
        groups.pending.push(task);
      } else if (status === 'running') {
        groups.running.push(task);
      } else if (status === 'completed') {
        groups.completed.push(task);
      } else if (status === 'failed') {
        groups.failed.push(task);
      }
    });

    return groups;
  }

  /**
   * タスクをフェーズごとに整理
   */
  private organizeTasksByPhase(tasks: any[]): PhaseStatus[] {
    // タスクタイプに基づいてフェーズを推定
    const phaseMap: Record<string, number> = {
      setup: 0,
      database: 1,
      backend: 2,
      frontend: 2, // backendと同じフェーズ（並列実行可能）
      test: 3,
      deploy: 4,
    };

    const phaseNames = ['Setup', 'Database', 'Development', 'Testing', 'Deploy'];
    const phases: PhaseStatus[] = [];

    // 各フェーズのタスクを収集
    for (let i = 0; i < phaseNames.length; i++) {
      const phaseTasks = tasks.filter(task => {
        const taskPhase = phaseMap[task.taskType] ?? -1;
        return taskPhase === i || (i === 2 && (task.taskType === 'backend' || task.taskType === 'frontend'));
      });

      if (phaseTasks.length > 0) {
        const phaseStatus = this.determinePhaseStatus(phaseTasks);
        
        phases.push({
          phaseNumber: i,
          name: phaseNames[i],
          status: phaseStatus,
          tasks: phaseTasks.map(task => ({
            id: task.id,
            name: task.name,
            status: task.status,
            assignedTo: task.assignedTo,
            startedAt: task.startedAt,
            completedAt: task.completedAt,
            lastQualityCheck: task.lastLintResult !== null ? {
              lint: task.lastLintResult,
              build: task.lastBuildResult,
              test: task.lastTestResult,
              checkedAt: task.qualityCheckAt,
            } : undefined,
          })),
        });
      }
    }

    return phases;
  }

  /**
   * フェーズのステータスを判定
   */
  private determinePhaseStatus(tasks: any[]): 'pending' | 'running' | 'completed' | 'partial' {
    const statuses = tasks.map(t => t.status.toLowerCase());
    
    if (statuses.every(s => s === 'completed')) {
      return 'completed';
    } else if (statuses.every(s => s === 'pending' || s === 'queued')) {
      return 'pending';
    } else if (statuses.some(s => s === 'running')) {
      return 'running';
    } else {
      return 'partial';
    }
  }

  /**
   * 実行状況を人間が読みやすい形式にフォーマット
   */
  formatExecutionStatus(status: ExecutionStatus): string {
    const lines: string[] = [
      `プロジェクト並列実行状況:`,
      ``,
      `概要:`,
      `  総タスク数: ${status.summary.totalTasks}`,
      `  完了: ${status.summary.completedTasks}`,
      `  実行中: ${status.summary.runningTasks}`,
      `  失敗: ${status.summary.failedTasks}`,
      `  未実行: ${status.summary.pendingTasks}`,
      ``,
      `フェーズ別状況:`,
    ];

    status.phases.forEach(phase => {
      lines.push(`\nフェーズ ${phase.phaseNumber + 1}: ${phase.name} [${phase.status}]`);
      phase.tasks.forEach(task => {
        const statusIcon = this.getStatusIcon(task.status);
        let line = `  ${statusIcon} ${task.name}`;
        
        if (task.lastQualityCheck) {
          const qc = task.lastQualityCheck;
          const checks = [];
          if (qc.lint !== undefined) checks.push(`lint:${qc.lint ? '✅' : '❌'}`);
          if (qc.build !== undefined) checks.push(`build:${qc.build ? '✅' : '❌'}`);
          if (qc.test !== undefined) checks.push(`test:${qc.test ? '✅' : '❌'}`);
          if (checks.length > 0) {
            line += ` (${checks.join(', ')})`;
          }
        }
        
        lines.push(line);
      });
    });

    if (status.activeInstances.length > 0) {
      lines.push(`\nアクティブな子CCインスタンス:`);
      status.activeInstances.forEach(instance => {
        lines.push(`  - ${instance.instanceId}: ${instance.taskName} [${instance.status}]`);
      });
    }

    return lines.join('\n');
  }

  private getStatusIcon(status: string): string {
    const s = status.toLowerCase();
    if (s === 'completed') return '✅';
    if (s === 'running') return '🔄';
    if (s === 'failed') return '❌';
    if (s === 'queued') return '⏳';
    return '⭕';
  }
}