import path from 'path';
import { execa } from 'execa';
import type { Socket, Server as SocketIOServer } from 'socket.io';
import { logger } from '../utils/logger.js';
import { prisma } from '../utils/prisma.js';
import { ClaudeState } from './claude-output-analyzer.js';
import { TerminalService } from './terminal.service.js';
import { WorktreeService } from './worktree.service.js';

interface CCSession {
  instanceId: string;
  socketId: string;
  projectId?: string;
  taskId?: string;
  type: 'parent' | 'child';
  worktreePath?: string;
  pendingInstruction?: string;
  claudeStarted?: boolean;
}

export class CCService {
  private sessions: Map<string, CCSession> = new Map();
  private io: SocketIOServer;
  private terminalService: TerminalService;
  private worktreeService: WorktreeService;

  constructor(io: SocketIOServer) {
    this.io = io;
    this.terminalService = new TerminalService(io);
    this.worktreeService = new WorktreeService();
  }

  async createParentCC(
    socket: Socket,
    data: {
      instanceId: string;
      projectId: string;
      workdir: string;
      options?: { cols?: number; rows?: number };
    }
  ) {
    try {
      const { instanceId, projectId, workdir, options } = data;

      // Get project details
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: {
          tasks: {
            orderBy: { priority: 'desc' },
          },
          requirements: true,
        },
      });

      if (!project) {
        socket.emit('cc:error', { message: 'Project not found' });
        return;
      }

      // Update existing instance or create new one
      let instance;
      try {
        instance = await prisma.cCInstance.update({
          where: { id: instanceId },
          data: {
            status: 'running',
            socketId: socket.id,
          },
        });
      } catch {
        instance = await prisma.cCInstance.create({
          data: {
            id: instanceId,
            name: `Parent CC - ${project.name}`,
            type: 'parent',
            status: 'running',
            socketId: socket.id,
          },
        });
      }

      // Store session
      const session: CCSession = {
        instanceId: instance.id,
        socketId: socket.id,
        projectId,
        type: 'parent',
      };
      this.sessions.set(socket.id, session);

      // Create terminal for parent CC
      await this.terminalService.createTerminal(socket, {
        workdir: workdir,
        cols: options?.cols || 120,
        rows: options?.rows || 30,
        env: {
          CC_INSTANCE_ID: instance.id,
          CC_TYPE: 'parent',
          CC_PROJECT_ID: projectId,
        },
      });

      // Send success event
      socket.emit('cc:parent-ready', {
        instanceId: instance.id,
        sessionId: `session-${Date.now()}`,
        projectId,
      });

      logger.info('Parent CC created successfully:', {
        instanceId: instance.id,
        projectId,
        workdir,
      });

      logger.info('Parent CC created, waiting for frontend to start Claude Code:', {
        instanceId: instance.id,
        socketId: socket.id,
      });

      socket.emit('cc:parent-ready', {
        instanceId: instance.id,
        project,
      });
    } catch (error) {
      logger.error('Failed to create parent CC:', error);
      socket.emit('cc:error', {
        message: 'Failed to create parent CC',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async createChildCC(
    socket: Socket,
    data: {
      projectId: string;
      taskId: string;
      instruction: string;
    }
  ) {
    try {
      // Verify project exists
      const project = await prisma.project.findUnique({
        where: { id: data.projectId },
      });

      if (!project) {
        socket.emit('cc:error', { message: 'Project not found' });
        return;
      }

      // Get task details
      const task = await prisma.task.findUnique({
        where: { id: data.taskId },
        include: { project: true },
      });

      if (!task) {
        socket.emit('cc:error', { message: 'Task not found' });
        return;
      }

      // Create worktree for child CC
      const worktreePath = await this.worktreeService.createWorktree(
        task.project.workdir,
        `task-${task.id}-${task.name.toLowerCase().replace(/\s+/g, '-')}`
      );

      // Create CC instance in database
      const instance = await prisma.cCInstance.create({
        data: {
          name: `Child CC - ${task.name}`,
          type: 'child',
          status: 'running',
          socketId: socket.id,
          projectId: data.projectId,
          worktreePath,
        },
      });

      // Update task assignment
      await prisma.task.update({
        where: { id: task.id },
        data: {
          assignedTo: instance.id,
          status: 'running',
          startedAt: new Date(),
          worktreePath,
        },
      });

      // Store session
      const session: CCSession = {
        instanceId: instance.id,
        socketId: socket.id,
        projectId: data.projectId,
        taskId: task.id,
        type: 'child',
        worktreePath,
      };
      this.sessions.set(socket.id, session);

      // Create terminal for child CC
      await this.terminalService.createTerminal(socket, {
        workdir: worktreePath,
        env: {
          CC_INSTANCE_ID: instance.id,
          CC_TYPE: 'child',
          CC_TASK_ID: task.id,
          CC_PROJECT_ID: data.projectId,
        },
      });

      // Store initial instruction for when Claude is ready
      session.pendingInstruction = this.formatUltrathinkInstruction(
        data.instruction,
        task,
        worktreePath
      );
      
      // Setup listener for Claude readiness
      this.setupClaudeReadyListener(socket, session);

      logger.info('Child CC created:', {
        instanceId: instance.id,
        taskId: task.id,
        worktreePath,
      });

      socket.emit('cc:child-ready', {
        instanceId: instance.id,
        task,
        worktreePath,
      });

      // 子CC監視のセットアップ
      this.setupChildCCMonitoring(socket, instance.id);

      // Log task start
      await prisma.taskLog.create({
        data: {
          taskId: task.id,
          ccInstanceId: instance.id,
          logLevel: 'info',
          phase: 'start',
          message: 'Task started',
        },
      });
    } catch (error) {
      logger.error('Failed to create child CC:', error);
      socket.emit('cc:error', {
        message: 'Failed to create child CC',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async destroyCC(socketId: string) {
    const session = this.sessions.get(socketId);
    if (!session) return;

    try {
      // Update instance status
      await prisma.cCInstance.update({
        where: { id: session.instanceId },
        data: { status: 'stopped' },
      });

      // If child CC, update task status
      if (session.type === 'child' && session.taskId) {
        await prisma.task.update({
          where: { id: session.taskId },
          data: {
            status: 'completed',
            completedAt: new Date(),
          },
        });

        // Log task completion
        await prisma.taskLog.create({
          data: {
            taskId: session.taskId,
            ccInstanceId: session.instanceId,
            logLevel: 'info',
            phase: 'complete',
            message: 'Task completed',
          },
        });

        // Optionally clean up worktree
        if (session.worktreePath && process.env.AUTO_CLEANUP_WORKTREE === 'true') {
          await this.worktreeService.removeWorktree(
            path.dirname(session.worktreePath),
            path.basename(session.worktreePath)
          );
        }
      }

      this.sessions.delete(socketId);
      logger.info('CC destroyed:', {
        instanceId: session.instanceId,
        type: session.type,
      });
    } catch (error) {
      logger.error('Failed to destroy CC:', error);
    }
  }

  /**
   * 子CCの状態を監視し、親やダッシュボードに通知
   */
  setupChildCCMonitoring(socket: Socket, instanceId: string) {
    // Claude状態変化イベントをリッスン
    socket.on('claude:waiting-for-input', async (data) => {
      logger.info('Child CC waiting for input:', data);

      // 親に通知
      const session = this.sessions.get(socket.id);
      if (session && session.type === 'child') {
        const parentSession = Array.from(this.sessions.values()).find(
          (s) => s.type === 'parent' && s.projectId === session.projectId
        );

        if (parentSession) {
          this.io.to(parentSession.socketId).emit('child-cc:waiting-for-input', {
            childInstanceId: instanceId,
            taskId: session.taskId,
            context: data.context,
            timestamp: data.timestamp,
          });
        }
      }

      // ダッシュボードに通知（ブロードキャスト）
      this.io.emit('dashboard:child-cc-needs-input', {
        instanceId,
        taskId: session?.taskId,
        context: data.context,
      });
    });

    socket.on('claude:response-complete', async (data) => {
      logger.info('Child CC response complete:', data);

      const session = this.sessions.get(socket.id);
      if (session && session.type === 'child') {
        // アクションが必要かチェック
        if (data.actionNeeded?.needed) {
          // 親に通知
          const parentSession = Array.from(this.sessions.values()).find(
            (s) => s.type === 'parent' && s.projectId === session.projectId
          );

          if (parentSession) {
            this.io.to(parentSession.socketId).emit('child-cc:action-required', {
              childInstanceId: instanceId,
              taskId: session.taskId,
              actionType: data.actionNeeded.type,
              confidence: data.actionNeeded.confidence,
              context: data.context,
            });
          }

          // ダッシュボードに通知
          this.io.emit('dashboard:child-cc-action-required', {
            instanceId,
            taskId: session.taskId,
            actionType: data.actionNeeded.type,
            context: data.context,
          });
        }
      }
    });
  }

  private prepareParentContext(project: any): string {
    const taskSummary = project.tasks
      .map(
        (task: any, index: number) =>
          `${index + 1}. ${task.name} (優先度: ${task.priority}, タイプ: ${task.taskType})`
      )
      .join('\n');

    return `プロジェクト「${project.name}」の管理を開始します。

プロジェクト情報:
- 名前: ${project.name}
- 説明: ${project.description || 'なし'}
- 作業ディレクトリ: ${project.workdir}

利用可能なタスク:
${taskSummary}

要件定義数: ${project.requirements.length}

どのタスクを並列実行しますか？タスクの詳細を確認したい場合は、タスク番号を教えてください。
`;
  }

  getSession(socketId: string): CCSession | undefined {
    return this.sessions.get(socketId);
  }

  getAllSessions(): CCSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Format ultrathink instruction for child CC
   * All parent-to-child instructions must start with "ultrathink"
   */
  private formatUltrathinkInstruction(
    instruction: string,
    task: any,
    worktreePath: string
  ): string {
    return `ultrathink

Task Assignment: ${task.name}

Task Details:
- ID: ${task.id}
- Type: ${task.taskType}
- Priority: ${task.priority}
- Description: ${task.description || 'No description provided'}
- Worktree: ${worktreePath}

Original Instruction:
${instruction}

Please execute this task in the assigned worktree. Report your progress and any issues back to the parent CC.
`;
  }
  
  /**
   * Setup listener for Claude CLI readiness
   */
  private setupClaudeReadyListener(socket: Socket, session: CCSession) {
    // Claude CLI特有の起動パターンを検出
    const claudeStartPatterns = [
      /Welcome to Claude!/,
      /Claude Code v\d+/,
      /Type .* for help/,
      /\? for shortcuts/,
      />\s*$/  // プロンプト
    ];
    
    const checkOutput = (data: string) => {
      // Claude CLIの起動を検出
      const isClaudeReady = claudeStartPatterns.some(pattern => pattern.test(data));
      
      if (isClaudeReady && !session.claudeStarted && session.pendingInstruction) {
        session.claudeStarted = true;
        logger.info('Claude CLI is ready, sending ultrathink instruction:', { 
          instanceId: session.instanceId 
        });
        
        // 少し遅延を入れて確実に送信
        setTimeout(() => {
          this.terminalService.sendData(socket.id, session.pendingInstruction + '\n');
          delete session.pendingInstruction;
        }, 500);
      }
    };
    
    // TerminalServiceから出力を監視
    socket.on('output', checkOutput);
    socket.on('data', checkOutput);
  }

  /**
   * Send ultrathink message from parent to child CC
   */
  async sendUltrathinkMessage(childInstanceId: string, message: string): Promise<void> {
    const childSession = Array.from(this.sessions.values()).find(
      (s) => s.instanceId === childInstanceId && s.type === 'child'
    );

    if (!childSession) {
      logger.warn('Child CC session not found:', { childInstanceId });
      return;
    }

    const ultrathinkMessage = `ultrathink

${message}
`;

    this.terminalService.sendData(childSession.socketId, ultrathinkMessage);
    logger.info('Ultrathink message sent to child CC:', {
      childInstanceId,
      messageLength: message.length,
    });
  }

  /**
   * Handle ultrathink response from child CC
   */
  async handleUltrathinkResponse(socket: Socket, response: string): Promise<void> {
    const session = this.sessions.get(socket.id);
    if (!session || session.type !== 'child') {
      return;
    }

    // Log the response and potentially relay it to parent CC
    logger.info('Ultrathink response from child CC:', {
      instanceId: session.instanceId,
      responseLength: response.length,
    });

    // Find parent CC and relay the response
    const parentSession = Array.from(this.sessions.values()).find(
      (s) => s.type === 'parent' && s.projectId === session.projectId
    );

    if (parentSession) {
      const relayMessage = `[Child CC ${session.instanceId}]: ${response}`;
      this.terminalService.sendData(parentSession.socketId, relayMessage);
    }
  }

  /**
   * Start child CC via MCP protocol (simplified)
   * This method updates the database but the actual Claude process is handled via terminal
   */
  async startChildCC(options: {
    instanceId: string;
    projectId: string;
    taskId: string;
    instruction: string;
    projectWorkdir: string;
    worktreeName: string;
    sessionId?: string;
  }): Promise<void> {
    try {
      const { instanceId, taskId, projectWorkdir, worktreeName, sessionId } = options;

      // Get task details
      const task = await prisma.task.findUnique({
        where: { id: taskId },
        include: { project: true },
      });

      if (!task) {
        throw new Error('Task not found');
      }

      if (sessionId) {
        logger.info(`[MCP:${sessionId}] Creating git worktree...`);
      }

      // Create worktree
      const worktreePath = await this.worktreeService.createWorktree(projectWorkdir, worktreeName);

      // Update CC instance with worktree path
      await prisma.cCInstance.update({
        where: { id: instanceId },
        data: {
          worktreePath,
          status: 'running',
        },
      });

      // Update task worktree path
      await prisma.task.update({
        where: { id: taskId },
        data: { worktreePath },
      });

      logger.info('Child CC setup completed:', {
        instanceId,
        taskId,
        worktreePath,
      });

      if (sessionId) {
        logger.info(`[MCP:${sessionId}] Child CC ${instanceId} setup completed`);
      }
    } catch (error) {
      logger.error('Failed to start child CC:', error);

      // Update instance status to error
      await prisma.cCInstance.update({
        where: { id: options.instanceId },
        data: { status: 'error' },
      });

      await prisma.task.update({
        where: { id: options.taskId },
        data: { status: 'failed' },
      });

      throw error;
    }
  }
  /**
   * 子CCの現在の状態を取得
   */
  getChildCCState(instanceId: string): ClaudeState | undefined {
    return this.terminalService.getClaudeStateByInstanceId(instanceId);
  }

  /**
   * すべての子CCの状態を取得
   */
  getAllChildCCStates(): Array<{ instanceId: string; state: ClaudeState }> {
    return Array.from(this.sessions.values())
      .filter((s) => s.type === 'child')
      .map((s) => ({
        instanceId: s.instanceId,
        state: this.terminalService.getClaudeStateByInstanceId(s.instanceId) || ClaudeState.IDLE,
      }));
  }

  /**
   * タスクに関連するCCインスタンスを停止
   */
  async stopCCForTask(taskId: string): Promise<void> {
    try {
      // Find all sessions related to this task
      const taskSessions = Array.from(this.sessions.entries()).filter(
        ([_, session]) => session.taskId === taskId
      );

      for (const [socketId, session] of taskSessions) {
        logger.info('Stopping CC instance for task:', {
          taskId,
          instanceId: session.instanceId,
          socketId,
        });

        // Destroy the terminal
        this.terminalService.destroyTerminal(socketId);

        // Remove from sessions
        this.sessions.delete(socketId);

        // Update database
        await prisma.cCInstance.update({
          where: { id: session.instanceId },
          data: { status: 'stopped' },
        });

        // Clean up worktree if configured
        if (session.worktreePath && process.env.AUTO_CLEANUP_WORKTREE === 'true') {
          await this.worktreeService.removeWorktree(
            path.dirname(session.worktreePath),
            path.basename(session.worktreePath)
          );
        }
      }
    } catch (error) {
      logger.error('Failed to stop CC for task:', error);
      throw error;
    }
  }
}
