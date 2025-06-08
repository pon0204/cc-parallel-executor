#!/usr/bin/env bun

/**
 * Claude Code Parallel MCP Server
 * 
 * This server uses STDIO mode for direct integration with Claude CLI.
 * It provides tools for managing child Claude Code instances in parallel.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { execa } from 'execa';
import path from 'path';

// Configuration
const PROJECT_SERVER_URL = process.env.PROJECT_SERVER_URL || 'http://localhost:8081';

// Tool schemas
const createChildCCSchema = {
  parentInstanceId: z.string().describe('ID of the parent Claude Code instance'),
  taskId: z.string().describe('ID of the task to execute'),
  instruction: z.string().describe('Detailed instruction for the child CC'),
  projectWorkdir: z.string().describe('Working directory of the project'),
};

const getAvailableTasksSchema = {
  projectId: z.string().describe('ID of the project'),
};

const updateTaskStatusSchema = {
  taskId: z.string().describe('ID of the task'),
  status: z.enum(['pending', 'queued', 'running', 'completed', 'failed']).describe('New status of the task'),
  result: z.string().optional().describe('Result or output of the task execution'),
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
    async ({ parentInstanceId, taskId, instruction, projectWorkdir }) => {
      try {
        const response = await fetch(`${PROJECT_SERVER_URL}/api/cc/child`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            parentInstanceId,
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
  server.tool(
    'get_available_tasks',
    getAvailableTasksSchema,
    async ({ projectId }) => {
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
    }
  );

  // Tool: update_task_status
  server.tool(
    'update_task_status',
    updateTaskStatusSchema,
    async ({ taskId, status, result }) => {
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