import type { Task } from '../types.js';

export interface TaskDependency {
  taskId: string;
  dependsOn: string[];
}

export interface ParallelExecutionPlan {
  phases: Array<{
    phase: number;
    tasks: Task[];
    canRunInParallel: boolean;
  }>;
  totalTasks: number;
  estimatedPhases: number;
}

export class ParallelExecutionPlanner {
  /**
   * タスクの依存関係を解析して並列実行計画を作成
   */
  static createExecutionPlan(tasks: Task[], dependencies: TaskDependency[]): ParallelExecutionPlan {
    const taskMap = new Map(tasks.map((t) => [t.id, t]));
    const dependencyMap = new Map(dependencies.map((d) => [d.taskId, d.dependsOn]));

    // トポロジカルソートによる実行順序の決定
    const visited = new Set<string>();
    const phases: Map<string, number> = new Map();

    // 各タスクの実行フェーズを計算
    const calculatePhase = (taskId: string): number => {
      if (phases.has(taskId)) {
        return phases.get(taskId)!;
      }

      visited.add(taskId);
      const deps = dependencyMap.get(taskId) || [];

      let maxDepPhase = -1;
      for (const depId of deps) {
        if (!visited.has(depId)) {
          maxDepPhase = Math.max(maxDepPhase, calculatePhase(depId));
        } else {
          maxDepPhase = Math.max(maxDepPhase, phases.get(depId) || -1);
        }
      }

      const phase = maxDepPhase + 1;
      phases.set(taskId, phase);
      return phase;
    };

    // すべてのタスクのフェーズを計算
    tasks.forEach((task) => calculatePhase(task.id));

    // フェーズごとにタスクをグループ化
    const phaseGroups = new Map<number, Task[]>();
    phases.forEach((phase, taskId) => {
      const task = taskMap.get(taskId);
      if (task) {
        if (!phaseGroups.has(phase)) {
          phaseGroups.set(phase, []);
        }
        phaseGroups.get(phase)!.push(task);
      }
    });

    // 実行計画を作成
    const plan: ParallelExecutionPlan = {
      phases: [],
      totalTasks: tasks.length,
      estimatedPhases: phaseGroups.size,
    };

    Array.from(phaseGroups.entries())
      .sort(([a], [b]) => a - b)
      .forEach(([phase, phaseTasks]) => {
        plan.phases.push({
          phase,
          tasks: phaseTasks,
          canRunInParallel: true, // 同じフェーズのタスクは並列実行可能
        });
      });

    return plan;
  }

  /**
   * タスクの依存関係を自動推定
   * (タスク名、説明、タイプから推定)
   */
  static estimateDependencies(tasks: Task[]): TaskDependency[] {
    const dependencies: TaskDependency[] = [];

    // タスクタイプによる依存関係の推定
    const typeOrder = ['setup', 'backend', 'frontend', 'test', 'deploy'];

    tasks.forEach((task) => {
      const deps: string[] = [];
      const taskTypeIndex = typeOrder.indexOf(task.taskType || 'general');

      if (taskTypeIndex > 0) {
        // 前のタイプのタスクに依存
        const prevType = typeOrder[taskTypeIndex - 1];
        const prevTypeTasks = tasks.filter((t) => t.taskType === prevType);
        deps.push(...prevTypeTasks.map((t) => t.id));
      }

      // 名前によるヒューリスティック
      if (task.name.toLowerCase().includes('test')) {
        // テストは実装タスクに依存
        const implTasks = tasks.filter(
          (t) =>
            t.id !== task.id &&
            !t.name.toLowerCase().includes('test') &&
            (t.taskType === 'backend' || t.taskType === 'frontend')
        );
        deps.push(...implTasks.map((t) => t.id));
      }

      if (deps.length > 0) {
        dependencies.push({
          taskId: task.id,
          dependsOn: Array.from(new Set(deps)),
        });
      }
    });

    return dependencies;
  }

  /**
   * 実行計画を人間が読める形式に変換
   */
  static formatExecutionPlan(plan: ParallelExecutionPlan): string {
    let output = `並列実行計画:\n`;
    output += `総タスク数: ${plan.totalTasks}\n`;
    output += `実行フェーズ数: ${plan.estimatedPhases}\n\n`;

    plan.phases.forEach((phase) => {
      output += `フェーズ ${phase.phase + 1}:\n`;
      phase.tasks.forEach((task) => {
        output += `  - ${task.name} (ID: ${task.id}, 優先度: ${task.priority})\n`;
      });
      if (phase.canRunInParallel) {
        output += `  → これらのタスクは並列実行可能です\n`;
      }
      output += '\n';
    });

    return output;
  }
}
