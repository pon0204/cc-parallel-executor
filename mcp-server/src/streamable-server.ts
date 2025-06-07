import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import type { ChildCCOptions, ChildCCResult, Task } from './types.js';

interface MCPRequest {
  jsonrpc: '2.0';
  id?: string | number;
  method: string;
  params?: any;
}

interface MCPResponse {
  jsonrpc: '2.0';
  id?: string | number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

interface MCPNotification {
  jsonrpc: '2.0';
  method: string;
  params?: any;
}

export class StreamableMCPServer {
  private app: express.Application;
  private activeConnections: Map<string, express.Response> = new Map();
  private projectServerUrl: string;

  constructor(port: number = 3002, projectServerUrl: string = 'http://localhost:3001') {
    this.app = express();
    this.projectServerUrl = projectServerUrl;
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware() {
    this.app.use(cors({
      origin: ['http://localhost:3000', 'http://localhost:3001'],
      credentials: true,
    }));
    this.app.use(express.json());
  }

  private setupRoutes() {
    // メイン MCP エンドポイント
    this.app.post('/mcp', this.handleMCPRequest.bind(this));
    this.app.get('/mcp', this.handleMCPStream.bind(this));
    
    // ヘルスチェック
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });
  }

  private async handleMCPRequest(req: express.Request, res: express.Response) {
    const request: MCPRequest = req.body;
    
    try {
      console.log('MCP Request received:', request.method);
      
      switch (request.method) {
        case 'initialize':
          return this.handleInitialize(request, res);
        
        case 'tools/list':
          return this.handleToolsList(request, res);
        
        case 'tools/call':
          return this.handleToolCall(request, res, req);
        
        default:
          return this.sendError(res, request.id, -32601, `Method not found: ${request.method}`);
      }
    } catch (error) {
      console.error('MCP Request error:', error);
      return this.sendError(res, request.id, -32603, 'Internal error');
    }
  }

  private async handleMCPStream(req: express.Request, res: express.Response) {
    const sessionId = req.headers['mcp-session-id'] as string || uuidv4();
    
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Mcp-Session-Id': sessionId,
    });

    this.activeConnections.set(sessionId, res);
    
    res.on('close', () => {
      console.log(`SSE connection closed: ${sessionId}`);
      this.activeConnections.delete(sessionId);
    });

    // 接続確認メッセージ
    this.sendSSEMessage(res, {
      jsonrpc: '2.0',
      method: 'notification/connected',
      params: { sessionId, timestamp: new Date().toISOString() }
    });
  }

  private handleInitialize(request: MCPRequest, res: express.Response) {
    const sessionId = uuidv4();
    
    const response: MCPResponse = {
      jsonrpc: '2.0',
      id: request.id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {},
          notifications: true,
        },
        serverInfo: {
          name: 'claude-code-mcp-server',
          version: '1.0.0',
        },
      },
    };

    res.set('Mcp-Session-Id', sessionId);
    res.json(response);
  }

  private handleToolsList(request: MCPRequest, res: express.Response) {
    const response: MCPResponse = {
      jsonrpc: '2.0',
      id: request.id,
      result: {
        tools: [
          {
            name: 'create_child_cc',
            description: 'Create a new child Claude Code instance to execute a task in parallel',
            inputSchema: {
              type: 'object',
              properties: {
                parentInstanceId: {
                  type: 'string',
                  description: 'ID of the parent Claude Code instance',
                },
                taskId: {
                  type: 'string',
                  description: 'ID of the task to execute',
                },
                instruction: {
                  type: 'string',
                  description: 'Detailed instruction for the task execution',
                },
                projectWorkdir: {
                  type: 'string',
                  description: 'Working directory of the project',
                },
              },
              required: ['parentInstanceId', 'taskId', 'instruction', 'projectWorkdir'],
            },
          },
          {
            name: 'get_available_tasks',
            description: 'Get list of available tasks for a project',
            inputSchema: {
              type: 'object',
              properties: {
                projectId: {
                  type: 'string',
                  description: 'ID of the project',
                },
              },
              required: ['projectId'],
            },
          },
          {
            name: 'update_task_status',
            description: 'Update the status of a task',
            inputSchema: {
              type: 'object',
              properties: {
                taskId: {
                  type: 'string',
                  description: 'ID of the task',
                },
                status: {
                  type: 'string',
                  enum: ['pending', 'queued', 'running', 'completed', 'failed'],
                  description: 'New status of the task',
                },
                result: {
                  type: 'string',
                  description: 'Optional result or output data',
                },
              },
              required: ['taskId', 'status'],
            },
          },
        ],
      },
    };

    res.json(response);
  }

  private async handleToolCall(request: MCPRequest, res: express.Response, req: express.Request) {
    const { name, arguments: args } = request.params;
    const sessionId = req.headers['mcp-session-id'] as string;

    try {
      switch (name) {
        case 'create_child_cc':
          return await this.handleCreateChildCC(request, res, args, sessionId);
        
        case 'get_available_tasks':
          return await this.handleGetAvailableTasks(request, res, args);
        
        case 'update_task_status':
          return await this.handleUpdateTaskStatus(request, res, args, sessionId);
        
        default:
          return this.sendError(res, request.id, -32601, `Unknown tool: ${name}`);
      }
    } catch (error) {
      console.error(`Tool call error (${name}):`, error);
      return this.sendError(res, request.id, -32603, 'Tool execution failed');
    }
  }

  private async handleCreateChildCC(
    request: MCPRequest, 
    res: express.Response, 
    args: ChildCCOptions,
    sessionId?: string
  ) {
    // Streamable レスポンス用にSSEに切り替え
    if (sessionId && this.activeConnections.has(sessionId)) {
      const sseRes = this.activeConnections.get(sessionId)!;
      
      // プロセス開始通知
      this.sendSSEMessage(sseRes, {
        jsonrpc: '2.0',
        method: 'notification/progress',
        params: {
          taskId: args.taskId,
          stage: 'starting',
          message: 'Creating child CC instance...',
        },
      });

      // PJサーバーへリクエスト送信（streamable）
      const result = await this.forwardToProjectServer('/api/cc/child', 'POST', args, sessionId);
      
      // 最終結果を返す
      this.sendSSEMessage(sseRes, {
        jsonrpc: '2.0',
        id: request.id,
        result,
      });

      res.json({ jsonrpc: '2.0', id: request.id, result: { streaming: true, sessionId } });
    } else {
      // 通常のHTTPレスポンス
      const result = await this.forwardToProjectServer('/api/cc/child', 'POST', args);
      res.json({ jsonrpc: '2.0', id: request.id, result });
    }
  }

  private async handleGetAvailableTasks(request: MCPRequest, res: express.Response, args: any) {
    const { projectId } = args;
    const tasks = await this.forwardToProjectServer(`/api/tasks/ready/${projectId}`, 'GET');
    
    res.json({
      jsonrpc: '2.0',
      id: request.id,
      result: { tasks },
    });
  }

  private async handleUpdateTaskStatus(
    request: MCPRequest, 
    res: express.Response, 
    args: any,
    sessionId?: string
  ) {
    const { taskId, status, result: taskResult } = args;
    
    const updateResult = await this.forwardToProjectServer(
      `/api/tasks/${taskId}/status`, 
      'PATCH', 
      { status, result: taskResult }
    );

    // SSE接続があれば進捗通知
    if (sessionId && this.activeConnections.has(sessionId)) {
      const sseRes = this.activeConnections.get(sessionId)!;
      this.sendSSEMessage(sseRes, {
        jsonrpc: '2.0',
        method: 'notification/task_updated',
        params: { taskId, status, result: taskResult },
      });
    }

    res.json({
      jsonrpc: '2.0',
      id: request.id,
      result: updateResult,
    });
  }

  private async forwardToProjectServer(
    endpoint: string, 
    method: 'GET' | 'POST' | 'PATCH' = 'GET', 
    data?: any,
    sessionId?: string
  ): Promise<any> {
    const url = `${this.projectServerUrl}${endpoint}`;
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(sessionId && { 'X-Session-Id': sessionId }),
      },
    };

    if (data && method !== 'GET') {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);
    
    if (!response.ok) {
      throw new Error(`Project server request failed: ${response.statusText}`);
    }

    return response.json();
  }

  private sendSSEMessage(res: express.Response, message: MCPResponse | MCPNotification) {
    const data = JSON.stringify(message);
    res.write(`data: ${data}\n\n`);
  }

  private sendError(res: express.Response, id: any, code: number, message: string, data?: any) {
    const response: MCPResponse = {
      jsonrpc: '2.0',
      id,
      error: { code, message, data },
    };
    res.json(response);
  }

  start(port: number = 3002) {
    this.app.listen(port, () => {
      console.log(`Streamable MCP Server running on port ${port}`);
      console.log(`Endpoint: http://localhost:${port}/mcp`);
    });
  }
}