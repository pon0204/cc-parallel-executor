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

    // 開発フローに基づいた依存関係の定義
    const findTasksByKeywords = (keywords: string[], taskType?: string) => {
      return tasks.filter((t) => {
        const nameMatch = keywords.some(kw => 
          t.name.toLowerCase().includes(kw.toLowerCase()) ||
          (t.description && t.description.toLowerCase().includes(kw.toLowerCase()))
        );
        const typeMatch = !taskType || t.taskType === taskType;
        return nameMatch && typeMatch;
      });
    };

    tasks.forEach((task) => {
      const deps: string[] = [];
      const taskName = task.name.toLowerCase();
      const taskDesc = (task.description || '').toLowerCase();

      // 1. Setup/環境構築タスクは依存なし（最初に実行）
      if (task.taskType === 'setup' || 
          taskName.includes('setup') || 
          taskName.includes('環境') ||
          taskName.includes('install')) {
        // 依存なし
      }
      
      // 2. DB/Schema関連タスクはSetupに依存
      else if (task.taskType === 'database' ||
               taskName.includes('database') ||
               taskName.includes('db') ||
               taskName.includes('migration') ||
               taskName.includes('schema') ||
               taskName.includes('prisma')) {
        const setupTasks = findTasksByKeywords(['setup', '環境', 'install'], 'setup');
        deps.push(...setupTasks.map(t => t.id));
      }
      
      // 3. Backend/Frontend実装タスクはDB/Schemaに依存
      else if (task.taskType === 'backend' || task.taskType === 'frontend') {
        const dbTasks = findTasksByKeywords(['database', 'db', 'migration', 'schema', 'prisma'], 'database');
        deps.push(...dbTasks.map(t => t.id));
        
        // TDD: バックエンドのテスト作成タスクは実装タスクより先
        if (task.taskType === 'backend' && !taskName.includes('test')) {
          const backendTestTasks = tasks.filter(t => 
            t.taskType === 'backend' && 
            (t.name.toLowerCase().includes('test') || t.name.toLowerCase().includes('tdd'))
          );
          deps.push(...backendTestTasks.map(t => t.id));
        }
      }
      
      // 4. E2EテストはBackend/Frontend実装に依存
      else if (task.taskType === 'test' || 
               taskName.includes('e2e') ||
               taskName.includes('integration')) {
        const backendTasks = tasks.filter(t => t.taskType === 'backend' && !t.name.toLowerCase().includes('test'));
        const frontendTasks = tasks.filter(t => t.taskType === 'frontend');
        deps.push(...backendTasks.map(t => t.id));
        deps.push(...frontendTasks.map(t => t.id));
      }
      
      // 5. デプロイはE2Eテストに依存
      else if (task.taskType === 'deploy' ||
               taskName.includes('deploy') ||
               taskName.includes('release')) {
        const e2eTasks = findTasksByKeywords(['e2e', 'integration', 'test'], 'test');
        deps.push(...e2eTasks.map(t => t.id));
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
