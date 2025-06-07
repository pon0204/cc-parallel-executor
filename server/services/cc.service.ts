import type { Server as SocketIOServer, Socket } from 'socket.io';
import { execa } from 'execa';
import { logger } from '../utils/logger.js';
import { prisma } from '../utils/prisma.js';
import { TerminalService } from './terminal.service.js';
import { WorktreeService } from './worktree.service.js';
import path from 'path';

interface CCSession {
  instanceId: string;
  socketId: string;
  projectId?: string;
  taskId?: string;
  type: 'parent' | 'child';
  worktreePath?: string;
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

  async createParentCC(socket: Socket, data: {
    instanceId: string;
    projectId: string;
    workdir: string;
    options?: { cols?: number; rows?: number; };
  }) {
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
        socketId: socket.id
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

  async createChildCC(socket: Socket, data: {
    parentInstanceId: string;
    taskId: string;
    instruction: string;
  }) {
    try {
      // Get parent CC session
      const parentSession = Array.from(this.sessions.values()).find(
        s => s.instanceId === data.parentInstanceId
      );

      if (!parentSession) {
        socket.emit('cc:error', { message: 'Parent CC not found' });
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
          parentInstanceId: data.parentInstanceId,
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
          CC_PARENT_ID: data.parentInstanceId,
        },
      });

      // Auto-launch Claude with ultrathink instruction
      setTimeout(() => {
        this.terminalService.sendData(socket.id, 'claude\n');
        
        // Send ultrathink instruction after Claude starts
        setTimeout(() => {
          const ultrathinkInstruction = this.formatUltrathinkInstruction(
            data.instruction,
            task,
            worktreePath
          );
          this.terminalService.sendData(socket.id, ultrathinkInstruction);
        }, 3000); // Give Claude more time to start
      }, 1000);

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

      // Log task start
      await prisma.taskLog.create({
        data: {
          taskId: task.id,
          ccInstanceId: instance.id,
          logLevel: 'info',
          message: 'Task started',
          metadata: JSON.stringify({ worktreePath }),
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

  private prepareParentContext(project: any): string {
    const taskSummary = project.tasks
      .map((task: any, index: number) => 
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
  private formatUltrathinkInstruction(instruction: string, task: any, worktreePath: string): string {
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
   * Send ultrathink message from parent to child CC
   */
  async sendUltrathinkMessage(childInstanceId: string, message: string): Promise<void> {
    const childSession = Array.from(this.sessions.values()).find(
      s => s.instanceId === childInstanceId && s.type === 'child'
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
      messageLength: message.length 
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
      responseLength: response.length
    });

    // Find parent CC and relay the response
    const parentSession = Array.from(this.sessions.values()).find(
      s => s.type === 'parent' && s.projectId === session.projectId
    );

    if (parentSession) {
      const relayMessage = `[Child CC ${session.instanceId}]: ${response}`;
      this.terminalService.sendData(parentSession.socketId, relayMessage);
    }
  }

  /**
   * Start child CC via MCP protocol
   * This method is called from the API endpoint and handles async child CC creation
   */
  async startChildCC(options: {
    instanceId: string;
    parentInstanceId: string;
    taskId: string;
    instruction: string;
    projectWorkdir: string;
    worktreeName: string;
    sessionId?: string;
  }): Promise<void> {
    try {
      const { instanceId, taskId, instruction, projectWorkdir, worktreeName, sessionId } = options;

      // Get task details
      const task = await prisma.task.findUnique({
        where: { id: taskId },
        include: { project: true },
      });

      if (!task) {
        throw new Error('Task not found');
      }

      // Send progress update via MCP SSE if sessionId provided
      if (sessionId) {
        // This would be sent via MCP server SSE connection
        logger.info(`[MCP:${sessionId}] Creating git worktree...`);
      }

      // Create worktree
      const worktreePath = await this.worktreeService.createWorktree(
        projectWorkdir,
        worktreeName
      );

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

      if (sessionId) {
        logger.info(`[MCP:${sessionId}] Starting Claude Code in worktree...`);
      }

      // Start Claude Code process in worktree
      const claudeProcess = execa('claude', [], {
        cwd: worktreePath,
        stdio: 'pipe',
        env: {
          ...process.env,
          CC_INSTANCE_ID: instanceId,
          CC_TYPE: 'child',
          CC_TASK_ID: taskId,
          CC_PARENT_ID: options.parentInstanceId,
        },
      });

      // Send ultrathink instruction after a delay
      setTimeout(() => {
        const ultrathinkInstruction = this.formatUltrathinkInstruction(
          instruction,
          task,
          worktreePath
        );
        claudeProcess.stdin?.write(ultrathinkInstruction);
        claudeProcess.stdin?.end();
      }, 3000);

      // Log process output
      claudeProcess.stdout?.on('data', (data) => {
        logger.info(`[Child CC ${instanceId}] ${data.toString()}`);
      });

      claudeProcess.stderr?.on('data', (data) => {
        logger.error(`[Child CC ${instanceId}] ${data.toString()}`);
      });

      claudeProcess.on('exit', async (code) => {
        logger.info(`Child CC process exited with code ${code}:`, { instanceId });
        
        // Update status based on exit code
        await prisma.cCInstance.update({
          where: { id: instanceId },
          data: { status: code === 0 ? 'stopped' : 'error' },
        });

        await prisma.task.update({
          where: { id: taskId },
          data: { 
            status: code === 0 ? 'completed' : 'failed',
            completedAt: new Date(),
          },
        });
      });

      logger.info('Child CC started successfully:', { 
        instanceId, 
        taskId,
        worktreePath,
      });

      if (sessionId) {
        logger.info(`[MCP:${sessionId}] Child CC ${instanceId} started successfully`);
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
}

export default new CCService(global.io);