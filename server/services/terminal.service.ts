import type { Server as SocketIOServer, Socket } from 'socket.io';
import { logger } from '../utils/logger.js';
import { platform } from 'os';
import { ClaudeOutputAnalyzer, ClaudeState } from './claude-output-analyzer.js';
import { prisma } from '../utils/prisma.js';
import { spawn as ptySpawn, type IPty } from 'node-pty';

interface TerminalSession {
  proc: IPty;
  socketId: string;
  sessionId: string;
  workdir?: string;
  ccInstanceId?: string;
  analyzer?: ClaudeOutputAnalyzer;
}

export class TerminalService {
  private sessions: Map<string, TerminalSession> = new Map(); // sessionId -> session
  private socketToSession: Map<string, string> = new Map(); // socketId -> sessionId
  private io: SocketIOServer;

  constructor(io: SocketIOServer) {
    this.io = io;
  }

  async createTerminal(socket: Socket, options?: {
    workdir?: string;
    cols?: number;
    rows?: number;
    env?: Record<string, string>;
  }) {
    try {
      const shell = platform() === 'win32' ? 'cmd.exe' : '/bin/bash';
      let cwd = options?.workdir || process.cwd();
      
      // For child CC instances, lookup the worktree path from database
      if (options?.env?.CC_INSTANCE_ID && options?.env?.CC_TYPE === 'child') {
        try {
          const ccInstance = await prisma.cCInstance.findUnique({
            where: { id: options.env.CC_INSTANCE_ID },
            select: { worktreePath: true },
          });
          
          if (ccInstance?.worktreePath) {
            cwd = ccInstance.worktreePath;
            logger.info('Using worktree path for child CC:', { 
              instanceId: options.env.CC_INSTANCE_ID, 
              worktreePath: cwd 
            });
          }
        } catch (error) {
          logger.error('Failed to lookup worktree path for child CC:', error);
        }
      }

      // Use node-pty for proper PTY support (essential for Claude Code)
      logger.info('Creating terminal with node-pty for full PTY support');
      const proc = ptySpawn(shell, ['-i'], {
        name: 'xterm-256color',
        cols: options?.cols || 80,
        rows: options?.rows || 24,
        cwd,
        env: {
          ...process.env,
          ...options?.env,
          // Essential PTY environment variables for Claude Code
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor',
          FORCE_COLOR: '1',
          // Shell settings for interactive behavior
          SHELL: shell,
          PS1: '\\[\\033[01;32m\\]\\u@\\h\\[\\033[00m\\]:\\[\\033[01;34m\\]\\w\\[\\033[00m\\]\\$ ',
          // Ink/React compatibility for Claude Code
          CI: undefined, // Remove CI flag that disables interactive mode
          FORCE_INTERACTIVE: '1',
        }
      });

      const sessionId = `session-${Date.now()}`;
      const session: TerminalSession = {
        proc,
        socketId: socket.id,
        sessionId,
        workdir: cwd,
        ccInstanceId: options?.env?.CC_INSTANCE_ID,
      };

      // Claude Output Analyzerを初期化（CCインスタンスの場合のみ）
      if (options?.env?.CC_INSTANCE_ID) {
        session.analyzer = new ClaudeOutputAnalyzer(options.env.CC_INSTANCE_ID, {
          idleTimeoutMs: 3000,
          checkIntervalMs: 500
        });

        // 状態変化のハンドラー
        session.analyzer.start((event) => {
          logger.info('Claude state changed:', event);

          // 状態に応じてイベントを発行
          if (event.to === ClaudeState.WAITING_INPUT) {
            socket.emit('claude:waiting-for-input', {
              instanceId: event.instanceId,
              timestamp: event.timestamp,
              context: session.analyzer?.getLastOutput(500)
            });
          } else if (event.from === ClaudeState.RESPONDING && event.to === ClaudeState.IDLE) {
            const actionCheck = session.analyzer?.detectActionNeeded();
            socket.emit('claude:response-complete', {
              instanceId: event.instanceId,
              timestamp: event.timestamp,
              actionNeeded: actionCheck,
              context: session.analyzer?.getLastOutput(500)
            });
          }
        });
      }

      this.sessions.set(sessionId, session);
      this.socketToSession.set(socket.id, sessionId);

      // Handle output (node-pty combines stdout and stderr)
      proc.onData((data: string) => {
        socket.emit('output', data);

        // Analyzerに出力を送信
        if (session.analyzer) {
          session.analyzer.processOutput(data);
        }
      });

      // Handle exit
      proc.onExit((exitEvent: { exitCode: number; signal?: number }) => {
        logger.info('Terminal exited:', { sessionId, exitCode: exitEvent.exitCode, signal: exitEvent.signal });
        
        // Analyzerをクリーンアップ
        if (session.analyzer) {
          session.analyzer.stop();
        }
        
        socket.emit('session-closed', sessionId);
        this.sessions.delete(sessionId);
        this.socketToSession.delete(socket.id);
      });

      logger.info('Enhanced terminal created:', { 
        sessionId,
        socketId: socket.id, 
        pid: proc.pid,
        workdir: cwd,
        method: 'node-pty'
      });

      // Send session created event
      socket.emit('session-created', { sessionId });

      // Set up initial environment
      setTimeout(() => {
        // Initialize terminal with proper settings
        proc.write('export TERM=xterm-256color\n');
        proc.write('clear\n');
        
        // For child CC instances, automatically start Claude
        if (options?.env?.CC_TYPE === 'child') {
          setTimeout(() => {
            logger.info('Auto-starting Claude for child CC:', { instanceId: options?.env?.CC_INSTANCE_ID });
            proc.write('claude\n');
            
            // Send a test message after Claude should be ready
            setTimeout(() => {
              logger.info('Sending test prompt to Claude:', { instanceId: options?.env?.CC_INSTANCE_ID });
              proc.write('\n'); // Send newline to potentially trigger prompt
            }, 3000);
          }, 2000);
        }
      }, 500);

    } catch (error) {
      logger.error('Failed to create terminal:', error);
      socket.emit('error', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  sendData(socketId: string, data: string) {
    const sessionId = this.socketToSession.get(socketId);
    if (!sessionId) {
      logger.warn('No session found for socket:', { socketId });
      return;
    }
    
    const session = this.sessions.get(sessionId);
    if (session) {
      // Use node-pty write method
      session.proc.write(data);
    } else {
      logger.warn('No terminal session found:', { 
        sessionId, 
        socketId
      });
    }
  }

  resizeTerminal(socketId: string, dimensions: { cols: number; rows: number }) {
    const sessionId = this.socketToSession.get(socketId);
    if (!sessionId) {
      logger.warn('No session found for socket resize:', { socketId });
      return;
    }
    
    const session = this.sessions.get(sessionId);
    if (session) {
      // Use node-pty resize method
      session.proc.resize(dimensions.cols, dimensions.rows);
      
      logger.debug('Terminal resized:', { sessionId, socketId, ...dimensions });
    } else {
      logger.warn('No terminal session found for resize:', { sessionId, socketId });
    }
  }

  destroyTerminal(socketId: string) {
    const sessionId = this.socketToSession.get(socketId);
    if (!sessionId) {
      logger.warn('No session found for socket destroy:', { socketId });
      return;
    }
    
    const session = this.sessions.get(sessionId);
    if (session) {
      try {
        // Analyzerをクリーンアップ
        if (session.analyzer) {
          session.analyzer.stop();
        }
        
        // Use node-pty kill method
        session.proc.kill('SIGTERM');
        this.sessions.delete(sessionId);
        this.socketToSession.delete(socketId);
        logger.info('Terminal destroyed:', { sessionId, socketId });
      } catch (error) {
        logger.error('Failed to destroy terminal:', error);
      }
    }
  }

  getSession(socketId: string): TerminalSession | undefined {
    const sessionId = this.socketToSession.get(socketId);
    return sessionId ? this.sessions.get(sessionId) : undefined;
  }

  getAllSessions(): TerminalSession[] {
    return Array.from(this.sessions.values());
  }

  // Claude状態を取得
  getClaudeState(socketId: string): ClaudeState | undefined {
    const session = this.getSession(socketId);
    return session?.analyzer?.getState();
  }

  // インスタンスIDで状態を取得
  getClaudeStateByInstanceId(instanceId: string): ClaudeState | undefined {
    const session = Array.from(this.sessions.values()).find(
      s => s.ccInstanceId === instanceId
    );
    return session?.analyzer?.getState();
  }
}