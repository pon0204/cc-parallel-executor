import type { Server as SocketIOServer, Socket } from 'socket.io';
import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import { logger } from '../utils/logger.js';
import { platform } from 'os';
import { ClaudeOutputAnalyzer, ClaudeState } from './claude-output-analyzer.js';

interface TerminalSession {
  proc: ChildProcessWithoutNullStreams;
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
      const cwd = options?.workdir || process.cwd();
      
      // Check if unbuffer is available
      const checkUnbuffer = spawn('which', ['unbuffer']);
      
      checkUnbuffer.on('close', (code) => {
        let proc: ChildProcessWithoutNullStreams;
        
        if (code === 0) {
          // unbuffer is available
          logger.info('Using unbuffer for PTY emulation');
          proc = spawn('unbuffer', ['-p', shell, '-i'], {
            cwd,
            env: {
              ...process.env,
              ...options?.env,
              TERM: 'xterm-256color',
              COLUMNS: (options?.cols || 80).toString(),
              LINES: (options?.rows || 24).toString(),
              FORCE_COLOR: '1',
              COLORTERM: 'truecolor',
              PS1: '\\[\\033[01;32m\\]\\u@\\h\\[\\033[00m\\]:\\[\\033[01;34m\\]\\w\\[\\033[00m\\]\\$ '
            }
          });
        } else {
          // unbuffer not available, try stdbuf
          logger.info('unbuffer not found, trying stdbuf');
          proc = spawn('stdbuf', ['-o0', '-e0', shell, '-i'], {
            cwd,
            env: {
              ...process.env,
              ...options?.env,
              TERM: 'xterm-256color',
              COLUMNS: (options?.cols || 80).toString(),
              LINES: (options?.rows || 24).toString(),
              FORCE_COLOR: '1',
              COLORTERM: 'truecolor',
              PS1: '\\[\\033[01;32m\\]\\u@\\h\\[\\033[00m\\]:\\[\\033[01;34m\\]\\w\\[\\033[00m\\]\\$ '
            }
          });
        }

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

        // Handle stdout
        proc.stdout.on('data', (data) => {
          const output = data.toString();
          socket.emit('output', output);

          // Analyzerに出力を送信
          if (session.analyzer) {
            session.analyzer.processOutput(output);
          }
        });

        // Handle stderr
        proc.stderr.on('data', (data) => {
          socket.emit('output', data.toString());
        });

        // Handle exit
        proc.on('exit', (code, signal) => {
          logger.info('Terminal exited:', { sessionId, code, signal });
          
          // Analyzerをクリーンアップ
          if (session.analyzer) {
            session.analyzer.stop();
          }
          
          socket.emit('session-closed', sessionId);
          this.sessions.delete(sessionId);
          this.socketToSession.delete(socket.id);
        });

        proc.on('error', (error) => {
          logger.error('Process error:', error);
          socket.emit('error', error.message);
        });

        // Send session created event
        socket.emit('session-created', sessionId);

        // Set up initial shell after a delay
        setTimeout(() => {
          if (proc.stdin && proc.stdin.writable) {
            proc.stdin.write('export TERM=xterm-256color\n');
            proc.stdin.write('clear\n');
          }
        }, 200);

        logger.info('Terminal created:', { 
          sessionId,
          socketId: socket.id, 
          pid: proc.pid,
          workdir: cwd,
        });

        // Emit terminal ready event
        logger.info('Emitting session-created event:', { sessionId, socketId: socket.id });
        socket.emit('session-created', { sessionId });
      });
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
    if (session && session.proc.stdin.writable) {
      logger.info('Sending data to terminal:', { 
        socketId, 
        sessionId, 
        dataLength: data.length,
        preview: data.slice(0, 50) + (data.length > 50 ? '...' : '')
      });
      session.proc.stdin.write(data);
    } else {
      logger.warn('No terminal session found or not writable:', { 
        sessionId, 
        socketId,
        sessionExists: !!session,
        procWritable: session?.proc.stdin.writable
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
    if (session && session.proc.stdin.writable) {
      // Send resize command via stdin
      session.proc.stdin.write(`stty cols ${dimensions.cols} rows ${dimensions.rows}\n`);
      
      // Send SIGWINCH signal on Unix systems
      if (platform() !== 'win32') {
        try {
          process.kill(session.proc.pid!, 'SIGWINCH');
        } catch (e) {
          logger.error('Failed to send SIGWINCH:', e);
        }
      }
      
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