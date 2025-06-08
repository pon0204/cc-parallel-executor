import path from 'path';
import { execa } from 'execa';
import fs from 'fs/promises';
import { logger } from '../utils/logger.js';

export class WorktreeService {
  private worktreeBasePath: string;

  constructor() {
    this.worktreeBasePath = process.env.GIT_WORKTREE_BASE_PATH || './worktrees';
  }

  async createWorktree(projectPath: string, worktreeName: string): Promise<string> {
    try {
      // Ensure the project is a git repository
      await execa('git', ['rev-parse', '--git-dir'], { cwd: projectPath });

      // Create worktrees directory if it doesn't exist
      const worktreesDir = path.join(projectPath, this.worktreeBasePath);
      await fs.mkdir(worktreesDir, { recursive: true });

      // Create worktree path
      const worktreePath = path.join(worktreesDir, worktreeName);

      // Check if worktree already exists
      try {
        await fs.access(worktreePath);
        logger.warn('Worktree already exists, removing it first:', { worktreePath });
        await this.removeWorktree(projectPath, worktreeName);
      } catch {
        // Worktree doesn't exist, which is good
      }

      // Get current branch
      const { stdout: currentBranch } = await execa('git', ['branch', '--show-current'], {
        cwd: projectPath,
      });

      // Create a unique branch name for this worktree
      const branchName = `${worktreeName}-branch`;

      // Create new worktree with a new branch based on current branch
      await execa(
        'git',
        ['worktree', 'add', '-b', branchName, worktreePath, currentBranch.trim()],
        {
          cwd: projectPath,
        }
      );

      logger.info('Worktree created:', {
        projectPath,
        worktreeName,
        worktreePath,
        branch: branchName,
        baseBranch: currentBranch.trim(),
      });

      return worktreePath;
    } catch (error) {
      logger.error('Failed to create worktree:', error);
      throw new Error(
        `Failed to create worktree: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async removeWorktree(projectPath: string, worktreeName: string): Promise<void> {
    try {
      const worktreePath = path.join(projectPath, this.worktreeBasePath, worktreeName);
      const branchName = `${worktreeName}-branch`;

      // Remove worktree
      await execa('git', ['worktree', 'remove', worktreePath, '--force'], {
        cwd: projectPath,
      });

      // Delete the associated branch
      try {
        await execa('git', ['branch', '-D', branchName], {
          cwd: projectPath,
        });
      } catch (branchError) {
        logger.warn('Failed to delete branch (may not exist):', { branchName, error: branchError });
      }

      logger.info('Worktree removed:', { projectPath, worktreeName, branchName });
    } catch (error) {
      logger.error('Failed to remove worktree:', error);
      // Don't throw error for cleanup operations
    }
  }

  async listWorktrees(
    projectPath: string
  ): Promise<Array<{ path: string; branch: string; commit: string }>> {
    try {
      const { stdout } = await execa('git', ['worktree', 'list', '--porcelain'], {
        cwd: projectPath,
      });

      const worktrees: Array<{ path: string; branch: string; commit: string }> = [];
      const lines = stdout.split('\n');

      let currentWorktree: any = {};
      for (const line of lines) {
        if (line.startsWith('worktree ')) {
          if (currentWorktree.path) {
            worktrees.push(currentWorktree);
          }
          currentWorktree = { path: line.substring(9) };
        } else if (line.startsWith('HEAD ')) {
          currentWorktree.commit = line.substring(5);
        } else if (line.startsWith('branch ')) {
          currentWorktree.branch = line.substring(7);
        }
      }

      if (currentWorktree.path) {
        worktrees.push(currentWorktree);
      }

      return worktrees;
    } catch (error) {
      logger.error('Failed to list worktrees:', error);
      return [];
    }
  }

  async pruneWorktrees(projectPath: string): Promise<void> {
    try {
      // Prune worktrees that no longer exist
      await execa('git', ['worktree', 'prune'], {
        cwd: projectPath,
      });

      logger.info('Worktrees pruned:', { projectPath });
    } catch (error) {
      logger.error('Failed to prune worktrees:', error);
    }
  }
}
