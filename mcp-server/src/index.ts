#!/usr/bin/env bun

/**
 * Claude Code Parallel MCP Server
 *
 * This server uses STDIO mode for direct integration with Claude CLI.
 * It provides tools for managing child Claude Code instances in parallel.
 */

import path from 'path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { execa } from 'execa';
import { z } from 'zod';
import { ParallelExecutionPlanner } from './tools/parallel-execution.js';
import { ExecutionStatusManager } from './tools/execution-status.js';

// Configuration
const PROJECT_SERVER_URL = process.env.PROJECT_SERVER_URL || 'http://localhost:8081';

// Tool schemas
const createChildCCSchema = {
  projectId: z.string().describe('ID of the project'),
  taskId: z.string().describe('ID of the task to execute'),
  instruction: z.string().describe('Detailed instruction for the child CC'),
  projectWorkdir: z.string().describe('Working directory of the project'),
};

const getAvailableTasksSchema = {
  projectId: z.string().describe('ID of the project'),
};

const updateTaskStatusSchema = {
  taskId: z.string().describe('ID of the task'),
  status: z
    .enum(['PENDING', 'QUEUED', 'RUNNING', 'COMPLETED', 'FAILED'])
    .describe('New status of the task'),
  result: z.string().optional().describe('Result or output of the task execution'),
};

// Project CRUD schemas
const createProjectSchema = {
  name: z.string().describe('Name of the project'),
  description: z.string().optional().describe('Description of the project'),
  workdir: z.string().describe('Working directory of the project'),
};

const updateProjectSchema = {
  projectId: z.string().describe('ID of the project to update'),
  name: z.string().optional().describe('New name of the project'),
  description: z.string().optional().describe('New description'),
  workdir: z.string().optional().describe('New working directory'),
};

const deleteProjectSchema = {
  projectId: z.string().describe('ID of the project to delete'),
  force: z.boolean().optional().describe('Force delete even if project has tasks'),
};

// Task CRUD schemas
const createTaskSchema = {
  projectId: z.string().describe('ID of the project'),
  name: z.string().describe('Name of the task'),
  description: z.string().optional().describe('Description of the task'),
  priority: z.number().int().min(1).max(10).optional().describe('Priority (1-10)'),
  taskType: z.string().optional().describe('Type of the task'),
  instruction: z.string().optional().describe('Instruction for execution'),
};

const updateTaskSchema = {
  taskId: z.string().describe('ID of the task to update'),
  name: z.string().optional().describe('New name'),
  description: z.string().optional().describe('New description'),
  priority: z.number().int().min(1).max(10).optional().describe('New priority'),
  instruction: z.string().optional().describe('New instruction'),
};

const deleteTaskSchema = {
  taskId: z.string().describe('ID of the task to delete'),
};

// Requirements CRUD schemas
const createRequirementSchema = {
  projectId: z.string().describe('ID of the project'),
  type: z.string().describe('Type of requirement'),
  title: z.string().describe('Title of the requirement'),
  content: z.string().describe('Content of the requirement'),
  priority: z.number().int().min(1).max(10).optional().describe('Priority (1-10)'),
  status: z.string().optional().describe('Status of the requirement'),
};

const updateRequirementSchema = {
  requirementId: z.string().describe('ID of the requirement to update'),
  type: z.string().optional().describe('New type'),
  title: z.string().optional().describe('New title'),
  content: z.string().optional().describe('New content'),
  priority: z.number().int().min(1).max(10).optional().describe('New priority'),
  status: z.string().optional().describe('New status'),
};

const deleteRequirementSchema = {
  requirementId: z.string().describe('ID of the requirement to delete'),
};

const getProjectSchema = {
  projectId: z.string().describe('ID of the project'),
};

const getRequirementsSchema = {
  projectId: z.string().describe('ID of the project'),
};

// Parallel execution schema
const createParallelChildCCsSchema = {
  projectId: z.string().describe('ID of the project'),
  maxParallel: z
    .number()
    .int()
    .min(1)
    .max(10)
    .optional()
    .describe('Maximum number of child CCs to run in parallel (default: 5)'),
  analyzeDependencies: z
    .boolean()
    .optional()
    .describe('Whether to automatically analyze task dependencies (default: true)'),
};

const getParallelExecutionStatusSchema = {
  projectId: z.string().describe('ID of the project'),
};

// Create MCP server with tools
function createMCPServer() {
  const server = new McpServer({
    name: 'claude-code-parallel',
    version: '1.0.0',
  });

  // Tool: create_child_cc
  server.tool(
    'create_child_cc',
    createChildCCSchema,
    async ({ projectId, taskId, instruction, projectWorkdir }) => {
      try {
        const response = await fetch(`${PROJECT_SERVER_URL}/api/cc/child`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            projectId,
            taskId,
            instruction,
            projectWorkdir,
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to create child CC: ${response.statusText}`);
        }

        const result = await response.json();

        // Create Git worktree
        const worktreePath = path.join(projectWorkdir, `worktree-${taskId}`);
        try {
          await execa('git', ['worktree', 'add', worktreePath], {
            cwd: projectWorkdir,
          });
        } catch (error) {
          console.error('Failed to create git worktree:', error);
        }

        return {
          content: [
            {
              type: 'text',
              text: `子CCインスタンスを作成しました:\n\nインスタンスID: ${result.instanceId}\nタスクID: ${taskId}\nWorktree: ${worktreePath}\n\nultrathinkプロトコルで指示を送信してください。`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `エラー: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool: get_available_tasks
  server.tool('get_available_tasks', getAvailableTasksSchema, async ({ projectId }) => {
    try {
      const response = await fetch(`${PROJECT_SERVER_URL}/api/projects/${projectId}/tasks`);

      if (!response.ok) {
        throw new Error(`Failed to fetch tasks: ${response.statusText}`);
      }

      const tasks = await response.json();
      const availableTasks = tasks.filter((t: any) =>
        ['pending', 'queued', 'PENDING', 'QUEUED'].includes(t.status)
      );

      return {
        content: [
          {
            type: 'text',
            text: `利用可能なタスク (${availableTasks.length}/${tasks.length}):\n\n${availableTasks
              .map(
                (t: any) =>
                  `📋 ${t.id}\n   名前: ${t.name}\n   優先度: ${t.priority}\n   タイプ: ${t.taskType || 'general'}`
              )
              .join('\n\n')}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `エラー: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  });

  // Tool: update_task_status
  server.tool('update_task_status', updateTaskStatusSchema, async ({ taskId, status, result }) => {
    try {
      const response = await fetch(`${PROJECT_SERVER_URL}/api/tasks/${taskId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: status.toUpperCase(),
          outputData: result,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update task status: ${response.statusText}`);
      }

      const task = await response.json();

      return {
        content: [
          {
            type: 'text',
            text: `タスクステータスを更新しました:\n\nタスクID: ${task.id}\n新しいステータス: ${task.status}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `エラー: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  });

  // Tool: create_project
  server.tool('create_project', createProjectSchema, async ({ name, description, workdir }) => {
    try {
      const response = await fetch(`${PROJECT_SERVER_URL}/api/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, description, workdir }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create project: ${response.statusText}`);
      }

      const project = await response.json();

      return {
        content: [
          {
            type: 'text',
            text: `プロジェクトを作成しました:\n\nID: ${project.id}\n名前: ${project.name}\n説明: ${project.description || 'なし'}\n作業ディレクトリ: ${project.workdir}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `エラー: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  });

  // Tool: update_project
  server.tool(
    'update_project',
    updateProjectSchema,
    async ({ projectId, name, description, workdir }) => {
      try {
        const updateData: any = {};
        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (workdir !== undefined) updateData.workdir = workdir;

        const response = await fetch(`${PROJECT_SERVER_URL}/api/projects/${projectId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updateData),
        });

        if (!response.ok) {
          throw new Error(`Failed to update project: ${response.statusText}`);
        }

        const project = await response.json();

        return {
          content: [
            {
              type: 'text',
              text: `プロジェクトを更新しました:\n\nID: ${project.id}\n名前: ${project.name}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `エラー: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool: delete_project
  server.tool('delete_project', deleteProjectSchema, async ({ projectId, force }) => {
    try {
      const url = force
        ? `${PROJECT_SERVER_URL}/api/projects/${projectId}?force=true`
        : `${PROJECT_SERVER_URL}/api/projects/${projectId}`;

      const response = await fetch(url, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`Failed to delete project: ${response.statusText}`);
      }

      return {
        content: [
          {
            type: 'text',
            text: `プロジェクトを削除しました: ${projectId}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `エラー: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  });

  // Tool: get_project
  server.tool('get_project', getProjectSchema, async ({ projectId }) => {
    try {
      const response = await fetch(`${PROJECT_SERVER_URL}/api/projects/${projectId}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch project: ${response.statusText}`);
      }

      const project = await response.json();

      return {
        content: [
          {
            type: 'text',
            text: `プロジェクト詳細:\n\nID: ${project.id}\n名前: ${project.name}\n説明: ${project.description || 'なし'}\n作業ディレクトリ: ${project.workdir}\nタスク数: ${project.tasks?.length || 0}\n要件数: ${project.requirements?.length || 0}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `エラー: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  });

  // Tool: create_task
  server.tool(
    'create_task',
    createTaskSchema,
    async ({ projectId, name, description, priority, taskType, instruction }) => {
      try {
        const response = await fetch(`${PROJECT_SERVER_URL}/api/tasks`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            projectId,
            name,
            description,
            status: 'PENDING',
            priority: priority || 5,
            taskType: taskType || 'general',
            instruction,
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to create task: ${response.statusText}`);
        }

        const task = await response.json();

        return {
          content: [
            {
              type: 'text',
              text: `タスクを作成しました:\n\nID: ${task.id}\n名前: ${task.name}\n優先度: ${task.priority}\nタイプ: ${task.taskType}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `エラー: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool: update_task
  server.tool(
    'update_task',
    updateTaskSchema,
    async ({ taskId, name, description, priority, instruction }) => {
      try {
        const updateData: any = {};
        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (priority !== undefined) updateData.priority = priority;
        if (instruction !== undefined) updateData.instruction = instruction;

        const response = await fetch(`${PROJECT_SERVER_URL}/api/tasks/${taskId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updateData),
        });

        if (!response.ok) {
          throw new Error(`Failed to update task: ${response.statusText}`);
        }

        const task = await response.json();

        return {
          content: [
            {
              type: 'text',
              text: `タスクを更新しました:\n\nID: ${task.id}\n名前: ${task.name}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `エラー: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool: delete_task
  server.tool('delete_task', deleteTaskSchema, async ({ taskId }) => {
    try {
      const response = await fetch(`${PROJECT_SERVER_URL}/api/tasks/${taskId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`Failed to delete task: ${response.statusText}`);
      }

      return {
        content: [
          {
            type: 'text',
            text: `タスクを削除しました: ${taskId}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `エラー: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  });

  // Tool: create_requirement
  server.tool(
    'create_requirement',
    createRequirementSchema,
    async ({ projectId, type, title, content, priority, status }) => {
      try {
        const response = await fetch(`${PROJECT_SERVER_URL}/api/requirements`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            projectId,
            type,
            title,
            content,
            priority: priority || 5,
            status: status || 'draft',
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to create requirement: ${response.statusText}`);
        }

        const requirement = await response.json();

        return {
          content: [
            {
              type: 'text',
              text: `要件を作成しました:\n\nID: ${requirement.id}\nタイトル: ${requirement.title}\nタイプ: ${requirement.type}\n優先度: ${requirement.priority}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `エラー: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool: update_requirement
  server.tool(
    'update_requirement',
    updateRequirementSchema,
    async ({ requirementId, type, title, content, priority, status }) => {
      try {
        const updateData: any = {};
        if (type !== undefined) updateData.type = type;
        if (title !== undefined) updateData.title = title;
        if (content !== undefined) updateData.content = content;
        if (priority !== undefined) updateData.priority = priority;
        if (status !== undefined) updateData.status = status;

        const response = await fetch(`${PROJECT_SERVER_URL}/api/requirements/${requirementId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updateData),
        });

        if (!response.ok) {
          throw new Error(`Failed to update requirement: ${response.statusText}`);
        }

        const requirement = await response.json();

        return {
          content: [
            {
              type: 'text',
              text: `要件を更新しました:\n\nID: ${requirement.id}\nタイトル: ${requirement.title}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `エラー: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool: delete_requirement
  server.tool('delete_requirement', deleteRequirementSchema, async ({ requirementId }) => {
    try {
      const response = await fetch(`${PROJECT_SERVER_URL}/api/requirements/${requirementId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`Failed to delete requirement: ${response.statusText}`);
      }

      return {
        content: [
          {
            type: 'text',
            text: `要件を削除しました: ${requirementId}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `エラー: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  });

  // Tool: get_requirements
  server.tool('get_requirements', getRequirementsSchema, async ({ projectId }) => {
    try {
      const response = await fetch(`${PROJECT_SERVER_URL}/api/projects/${projectId}/requirements`);

      if (!response.ok) {
        throw new Error(`Failed to fetch requirements: ${response.statusText}`);
      }

      const requirements = await response.json();

      return {
        content: [
          {
            type: 'text',
            text: `プロジェクトの要件 (${requirements.length}件):\n\n${requirements
              .map(
                (r: any) =>
                  `📋 ${r.id}\n   タイトル: ${r.title}\n   タイプ: ${r.type}\n   優先度: ${r.priority}\n   ステータス: ${r.status}`
              )
              .join('\n\n')}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `エラー: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  });

  // Tool: get_parallel_execution_status
  server.tool(
    'get_parallel_execution_status',
    getParallelExecutionStatusSchema,
    async ({ projectId }) => {
      try {
        const statusManager = new ExecutionStatusManager(PROJECT_SERVER_URL);
        const executionStatus = await statusManager.getExecutionStatus(projectId);
        const formattedStatus = statusManager.formatExecutionStatus(executionStatus);
        return {
          content: [
            {
              type: 'text',
              text: formattedStatus,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `エラー: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool: create_parallel_child_ccs
  server.tool(
    'create_parallel_child_ccs',
    createParallelChildCCsSchema,
    async ({ projectId, maxParallel = 5, analyzeDependencies = true }) => {
      try {
        console.error(`[MCP] Starting parallel execution for project ${projectId}`);

        // 1. プロジェクトの詳細を取得
        const projectResponse = await fetch(`${PROJECT_SERVER_URL}/api/projects/${projectId}`);
        if (!projectResponse.ok) {
          throw new Error(`Failed to fetch project: ${projectResponse.statusText}`);
        }
        const project = await projectResponse.json();

        // 2. 未実行のタスクを取得
        const tasksResponse = await fetch(`${PROJECT_SERVER_URL}/api/projects/${projectId}/tasks`);
        if (!tasksResponse.ok) {
          throw new Error(`Failed to fetch tasks: ${tasksResponse.statusText}`);
        }
        const allTasks = await tasksResponse.json();

        const pendingTasks = allTasks.filter((task: any) =>
          ['PENDING', 'QUEUED'].includes(task.status)
        );

        if (pendingTasks.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: '実行可能なタスクがありません。すべてのタスクが完了済みまたは実行中です。',
              },
            ],
          };
        }

        // 3. 依存関係を分析して実行計画を作成
        let dependencies = [];
        if (analyzeDependencies) {
          dependencies = ParallelExecutionPlanner.estimateDependencies(pendingTasks);
        }

        const executionPlan = ParallelExecutionPlanner.createExecutionPlan(
          pendingTasks,
          dependencies
        );
        const planSummary = ParallelExecutionPlanner.formatExecutionPlan(executionPlan);

        console.error('[MCP] Execution plan created:', planSummary);

        // 4. 最初のフェーズのみ実行（ユーザーが確認してから次のフェーズへ）
        const results: string[] = [];
        const createdInstances: string[] = [];

        // 実行可能なフェーズを見つける（前のフェーズが完了しているもの）
        let executablePhase = null;
        for (const phase of executionPlan.phases) {
          const phaseTaskStatuses = phase.tasks.map(t => t.status.toLowerCase());
          
          if (phaseTaskStatuses.every(s => s === 'pending' || s === 'queued')) {
            // このフェーズはまだ開始されていない
            executablePhase = phase;
            break;
          } else if (phaseTaskStatuses.some(s => s === 'running')) {
            // このフェーズは実行中
            results.push(`フェーズ ${phase.phase + 1} は既に実行中です。完了を待ってください。`);
            break;
          }
          // フェーズが完了している場合は次のフェーズをチェック
        }

        if (!executablePhase) {
          return {
            content: [
              {
                type: 'text',
                text: '実行可能なフェーズがありません。現在のフェーズの完了を待つか、get_parallel_execution_statusで状況を確認してください。',
              },
            ],
          };
        }

        results.push(`\nフェーズ ${executablePhase.phase + 1} の実行 (${executablePhase.tasks.length}タスク):`);

        // このフェーズのタスクを並列で起動（maxParallelの制限付き）
        const tasksInThisPhase = executablePhase.tasks.slice(0, maxParallel);
        const createPromises = tasksInThisPhase.map(async (task) => {
            try {
              // 子CCを作成
              const createResponse = await fetch(`${PROJECT_SERVER_URL}/api/cc/child`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  projectId,
                  taskId: task.id,
                  instruction:
                    task.instruction ||
                    `Task: ${task.name}\n\n${task.description || 'No description provided.'}`,
                  projectWorkdir: project.workdir,
                }),
              });

              if (!createResponse.ok) {
                throw new Error(
                  `Failed to create child CC for task ${task.id}: ${createResponse.statusText}`
                );
              }

              const result = await createResponse.json();

              // タスクステータスを更新
              await fetch(`${PROJECT_SERVER_URL}/api/tasks/${task.id}/status`, {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  status: 'QUEUED',
                }),
              });

              createdInstances.push(result.instanceId);
              return `✅ ${task.name} (ID: ${task.id}) - 子CC ${result.instanceId} を起動しました`;
            } catch (error) {
              return `❌ ${task.name} (ID: ${task.id}) - エラー: ${error instanceof Error ? error.message : 'Unknown error'}`;
            }
          });

          const phaseResults = await Promise.all(createPromises);
          results.push(...phaseResults);

        // 5. 結果をまとめて返す
        const summary = [
          '並列実行を開始しました:',
          '',
          planSummary,
          '',
          '実行結果:',
          ...results,
          '',
          `合計 ${createdInstances.length} 個の子CCインスタンスを起動しました。`,
          '',
          'ultrathinkプロトコルで各子CCに初期指示が自動送信されます。',
          '',
          '💡 次のフェーズを実行するには:',
          '1. get_parallel_execution_status でタスクの完了を確認',
          '2. 再度 create_parallel_child_ccs を実行',
        ].join('\n');

        return {
          content: [
            {
              type: 'text',
              text: summary,
            },
          ],
        };
      } catch (error) {
        console.error('[MCP] Failed to create parallel child CCs:', error);
        return {
          content: [
            {
              type: 'text',
              text: `エラー: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  return server;
}

// Main function
async function main() {
  console.error('Claude Code Parallel MCP Server (STDIO) starting...');

  const server = createMCPServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('MCP Server running in STDIO mode');
}

// Start the server
main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
