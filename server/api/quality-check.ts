import { Router } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import { prisma } from '../utils/prisma.js';
import { logger } from '../utils/logger.js';
import path from 'path';

const execAsync = promisify(exec);
export const qualityCheckRouter = Router();

// タスクの品質チェックを実行
qualityCheckRouter.post('/tasks/:taskId/check', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { checkType = 'all' } = req.body; // 'lint', 'build', 'test', 'all'

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { project: true }
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const workdir = task.worktreePath || task.project.workdir;
    const results: {
      taskId: string;
      timestamp: Date;
      checks: Record<string, {
        passed: boolean;
        output?: string;
        errors?: string;
      }>;
    } = {
      taskId,
      timestamp: new Date(),
      checks: {}
    };

    // Lint チェック
    if (checkType === 'lint' || checkType === 'all') {
      try {
        const { stdout, stderr } = await execAsync('npm run lint', { cwd: workdir });
        results.checks.lint = {
          passed: true,
          output: stdout,
          errors: stderr
        };
      } catch (error: any) {
        results.checks.lint = {
          passed: false,
          output: error.stdout || '',
          errors: error.stderr || error.message
        };
      }
    }

    // Build チェック
    if (checkType === 'build' || checkType === 'all') {
      try {
        const { stdout, stderr } = await execAsync('npm run build', { cwd: workdir });
        results.checks.build = {
          passed: true,
          output: stdout,
          errors: stderr
        };
      } catch (error: any) {
        results.checks.build = {
          passed: false,
          output: error.stdout || '',
          errors: error.stderr || error.message
        };
      }
    }

    // Test チェック (タスクタイプに応じて)
    if (checkType === 'test' || checkType === 'all') {
      let testCommand = 'npm test';
      
      // タスクタイプに応じてテストコマンドを調整
      if (task.taskType === 'backend') {
        testCommand = 'npm run test:backend || npm test';
      } else if (task.taskType === 'frontend') {
        testCommand = 'npm run test:frontend || npm test';
      } else if (task.taskType === 'test') {
        testCommand = 'npm run test:e2e || npm test';
      }

      try {
        const { stdout, stderr } = await execAsync(testCommand, { cwd: workdir });
        results.checks.test = {
          passed: true,
          output: stdout,
          errors: stderr
        };
      } catch (error: any) {
        results.checks.test = {
          passed: false,
          output: error.stdout || '',
          errors: error.stderr || error.message
        };
      }
    }

    // 結果をDBに保存
    await prisma.task.update({
      where: { id: taskId },
      data: {
        lastLintResult: results.checks.lint?.passed,
        lastBuildResult: results.checks.build?.passed,
        lastTestResult: results.checks.test?.passed,
        qualityCheckAt: new Date()
      }
    });

    logger.info('Quality check completed', { taskId, results });
    res.json(results);

  } catch (error) {
    logger.error('Quality check failed', { error, taskId: req.params.taskId });
    res.status(500).json({ error: 'Quality check failed', details: error });
  }
});

// フェーズ完了時の品質チェック
qualityCheckRouter.post('/phases/:phaseId/check', async (req, res) => {
  try {
    const { phaseId } = req.params;

    const phase = await prisma.executionPhase.findUnique({
      where: { id: phaseId },
      include: { project: true }
    });

    if (!phase) {
      return res.status(404).json({ error: 'Phase not found' });
    }

    const workdir = phase.project.workdir;
    const phaseChecks: any = {};

    // フェーズに応じた品質チェック
    switch (phase.name.toLowerCase()) {
      case 'setup':
        // 環境セットアップの確認
        try {
          await execAsync('test -f package-lock.json', { cwd: workdir });
          await execAsync('test -f .env || test -f .env.local', { cwd: workdir });
          phaseChecks.environment = { passed: true };
        } catch {
          phaseChecks.environment = { passed: false, error: 'Missing setup files' };
        }
        break;

      case 'database':
        // データベース/スキーマの確認
        try {
          await execAsync('test -f prisma/schema.prisma', { cwd: workdir });
          await execAsync('npm run db:generate', { cwd: workdir });
          phaseChecks.database = { passed: true };
        } catch (error: any) {
          phaseChecks.database = { passed: false, error: error.message };
        }
        break;

      case 'development':
        // 開発フェーズの品質チェック
        try {
          const { stdout: lintOut } = await execAsync('npm run lint', { cwd: workdir });
          const { stdout: buildOut } = await execAsync('npm run build', { cwd: workdir });
          phaseChecks.development = { 
            passed: true, 
            lint: 'passed',
            build: 'passed'
          };
        } catch (error: any) {
          phaseChecks.development = { 
            passed: false, 
            error: error.message 
          };
        }
        break;

      case 'testing':
        // テストフェーズ
        try {
          await execAsync('npm run test:e2e || npm test', { cwd: workdir });
          phaseChecks.testing = { passed: true };
        } catch (error: any) {
          phaseChecks.testing = { passed: false, error: error.message };
        }
        break;

      default:
        phaseChecks.general = { passed: true };
    }

    const allPassed = Object.values(phaseChecks).every((check: any) => check.passed);

    // フェーズの品質チェック結果を更新
    await prisma.executionPhase.update({
      where: { id: phaseId },
      data: {
        qualityCheckPassed: allPassed,
        qualityCheckAt: new Date(),
        qualityCheckResult: JSON.stringify(phaseChecks)
      }
    });

    logger.info('Phase quality check completed', { phaseId, phase: phase.name, passed: allPassed });
    res.json({
      phaseId,
      phaseName: phase.name,
      passed: allPassed,
      checks: phaseChecks
    });

  } catch (error) {
    logger.error('Phase quality check failed', { error, phaseId: req.params.phaseId });
    res.status(500).json({ error: 'Phase quality check failed', details: error });
  }
});

// プロジェクト全体の品質状況を取得
qualityCheckRouter.get('/projects/:projectId/status', async (req, res) => {
  try {
    const { projectId } = req.params;

    const tasks = await prisma.task.findMany({
      where: { projectId },
      select: {
        id: true,
        name: true,
        taskType: true,
        status: true,
        lastLintResult: true,
        lastBuildResult: true,
        lastTestResult: true,
        qualityCheckAt: true
      }
    });

    const phases = await prisma.executionPhase.findMany({
      where: { projectId },
      orderBy: { phaseNumber: 'asc' }
    });

    const summary = {
      totalTasks: tasks.length,
      tasksWithQualityCheck: tasks.filter(t => t.qualityCheckAt).length,
      passedLint: tasks.filter(t => t.lastLintResult === true).length,
      passedBuild: tasks.filter(t => t.lastBuildResult === true).length,
      passedTest: tasks.filter(t => t.lastTestResult === true).length,
      phases: phases.map(p => ({
        name: p.name,
        status: p.status,
        qualityPassed: p.qualityCheckPassed,
        checkedAt: p.qualityCheckAt
      }))
    };

    res.json({
      projectId,
      summary,
      tasks,
      phases
    });

  } catch (error) {
    logger.error('Failed to get quality status', { error, projectId: req.params.projectId });
    res.status(500).json({ error: 'Failed to get quality status' });
  }
});