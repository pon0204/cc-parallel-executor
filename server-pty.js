const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { spawn } = require('child_process');
const os = require('os');

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const sessions = new Map();

// PTYの代替実装
class PseudoPTY {
  constructor(shell, args = [], options = {}) {
    this.shell = shell;
    this.cols = options.cols || 80;
    this.rows = options.rows || 24;
    
    // 環境変数を設定
    const env = {
      ...process.env,
      TERM: 'xterm-256color',
      COLUMNS: this.cols.toString(),
      LINES: this.rows.toString(),
      // Claudeが適切に動作するための追加の環境変数
      FORCE_COLOR: '1',
      COLORTERM: 'truecolor',
      TERM_PROGRAM: 'claude-code-terminal'
    };
    
    // PTYモードをシミュレート
    this.process = spawn(shell, args, {
      ...options,
      env,
      shell: true,
      detached: false,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    // stdinを生のモードに設定（可能な場合）
    if (this.process.stdin.setRawMode) {
      this.process.stdin.setRawMode(true);
    }
    
    // Unbuffer output
    this.process.stdout.setEncoding('utf8');
    this.process.stderr.setEncoding('utf8');
  }
  
  write(data) {
    if (this.process.stdin.writable) {
      this.process.stdin.write(data);
    }
  }
  
  resize(cols, rows) {
    this.cols = cols;
    this.rows = rows;
    
    // Try to send window size change signal
    if (this.process.pid && process.platform !== 'win32') {
      try {
        process.kill(this.process.pid, 'SIGWINCH');
      } catch (e) {
        console.error('Failed to send SIGWINCH:', e);
      }
    }
  }
  
  kill() {
    if (this.process && !this.process.killed) {
      this.process.kill('SIGTERM');
      setTimeout(() => {
        if (!this.process.killed) {
          this.process.kill('SIGKILL');
        }
      }, 1000);
    }
  }
}

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  let pty = null;
  
  socket.on('create-terminal', (options = {}) => {
    console.log('Creating new terminal session with options:', options);
    
    const shell = process.platform === 'win32' ? 'cmd.exe' : '/bin/bash';
    
    try {
      pty = new PseudoPTY(shell, [], {
        cwd: process.cwd(),
        cols: options.cols || 80,
        rows: options.rows || 24
      });
      
      const sessionId = `session-${Date.now()}`;
      sessions.set(sessionId, pty);
      socket.data.sessionId = sessionId;
      
      // ptyの出力をクライアントに送信
      pty.process.stdout.on('data', (data) => {
        socket.emit('data', data);
      });
      
      pty.process.stderr.on('data', (data) => {
        socket.emit('data', data);
      });
      
      pty.process.on('exit', (code) => {
        console.log(`Session ${sessionId} exited with code ${code}`);
        socket.emit('exit', code);
        sessions.delete(sessionId);
      });
      
      socket.emit('terminal-ready', sessionId);
      
      // 初期設定を送信
      setTimeout(() => {
        // bashの初期化を待つ
        pty.write('echo "Terminal Ready"\n');
      }, 200);
      
    } catch (error) {
      console.error('Failed to create terminal:', error);
      socket.emit('error', error.message);
    }
  });
  
  socket.on('data', (data) => {
    if (pty) {
      pty.write(data);
    }
  });
  
  socket.on('resize', ({ cols, rows }) => {
    if (pty) {
      console.log(`Resizing terminal to ${cols}x${rows}`);
      pty.resize(cols, rows);
    }
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    if (pty) {
      pty.kill();
      sessions.delete(socket.data.sessionId);
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`PTY server running on port ${PORT}`);
});