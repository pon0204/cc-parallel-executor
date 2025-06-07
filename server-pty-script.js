const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
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

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  let proc = null;
  let sessionId = null;
  
  socket.on('create-terminal', (options = {}) => {
    console.log('Creating new terminal session with options:', options);
    
    const shell = process.platform === 'win32' ? 'cmd.exe' : '/bin/bash';
    
    try {
      // macOSでscriptコマンドを使用してPTYを作成
      if (process.platform === 'darwin') {
        // 一時ファイルを作成（scriptコマンドの出力用）
        const tmpFile = path.join(os.tmpdir(), `terminal-${Date.now()}.log`);
        
        // scriptコマンドでbashを起動
        // -q: quiet mode
        // -F: flush output after each write
        proc = spawn('script', ['-q', '-F', tmpFile, shell], {
          env: {
            ...process.env,
            TERM: 'xterm-256color',
            COLUMNS: (options.cols || 80).toString(),
            LINES: (options.rows || 24).toString(),
            FORCE_COLOR: '1',
            COLORTERM: 'truecolor'
          },
          cwd: process.cwd()
        });
      } else {
        // 他のプラットフォームでは通常のspawnを使用
        proc = spawn(shell, [], {
          env: {
            ...process.env,
            TERM: 'xterm-256color',
            COLUMNS: (options.cols || 80).toString(),
            LINES: (options.rows || 24).toString(),
          },
          cwd: process.cwd(),
          stdio: ['pipe', 'pipe', 'pipe']
        });
      }
      
      sessionId = `session-${Date.now()}`;
      sessions.set(sessionId, proc);
      socket.data.sessionId = sessionId;
      
      // 出力をクライアントに送信
      proc.stdout.on('data', (data) => {
        socket.emit('data', data.toString());
      });
      
      proc.stderr.on('data', (data) => {
        socket.emit('data', data.toString());
      });
      
      proc.on('exit', (code) => {
        console.log(`Session ${sessionId} exited with code ${code}`);
        socket.emit('exit', code);
        sessions.delete(sessionId);
      });
      
      proc.on('error', (err) => {
        console.error('Process error:', err);
        socket.emit('error', err.message);
      });
      
      socket.emit('terminal-ready', sessionId);
      
    } catch (error) {
      console.error('Failed to create terminal:', error);
      socket.emit('error', error.message);
    }
  });
  
  socket.on('data', (data) => {
    if (proc && proc.stdin && proc.stdin.writable) {
      proc.stdin.write(data);
    }
  });
  
  socket.on('resize', ({ cols, rows }) => {
    if (proc && proc.pid) {
      console.log(`Resizing terminal to ${cols}x${rows}`);
      
      // ANSIエスケープシーケンスを送信してターミナルサイズを変更
      if (proc.stdin.writable) {
        proc.stdin.write(`\x1b[8;${rows};${cols}t`);
      }
      
      // 環境変数を更新
      process.env.COLUMNS = cols.toString();
      process.env.LINES = rows.toString();
      
      // SIGWINCHシグナルを送信（Unix系のみ）
      if (process.platform !== 'win32') {
        try {
          process.kill(proc.pid, 'SIGWINCH');
        } catch (e) {
          console.error('Failed to send SIGWINCH:', e);
        }
      }
    }
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    if (proc && !proc.killed) {
      proc.kill('SIGTERM');
      sessions.delete(sessionId);
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`PTY server (script version) running on port ${PORT}`);
});