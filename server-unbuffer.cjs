const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { spawn } = require('child_process');
const os = require('os');

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const sessions = new Map();

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  let proc = null;
  let sessionId = null;
  
  socket.on('create-session', (options = {}) => {
    console.log('Creating new terminal session with options:', options);
    
    try {
      // unbufferコマンドを試す（Homebrewでインストール: brew install expect）
      // unbufferはexpectパッケージに含まれています
      const shell = process.platform === 'win32' ? 'cmd.exe' : '/bin/bash';
      
      // まずunbufferが利用可能か確認
      const testUnbuffer = spawn('which', ['unbuffer']);
      
      testUnbuffer.on('close', (code) => {
        if (code === 0) {
          // unbufferが利用可能
          console.log('Using unbuffer for PTY emulation');
          proc = spawn('unbuffer', ['-p', shell, '-i'], {
            env: {
              ...process.env,
              TERM: 'xterm-256color',
              COLUMNS: (options.cols || 80).toString(),
              LINES: (options.rows || 24).toString(),
              FORCE_COLOR: '1',
              COLORTERM: 'truecolor',
              PS1: '\\[\\033[01;32m\\]\\u@\\h\\[\\033[00m\\]:\\[\\033[01;34m\\]\\w\\[\\033[00m\\]\\$ '
            },
            cwd: process.cwd()
          });
        } else {
          // unbufferが利用できない場合は、stdbufを試す
          console.log('unbuffer not found, trying stdbuf');
          proc = spawn('stdbuf', ['-o0', '-e0', shell, '-i'], {
            env: {
              ...process.env,
              TERM: 'xterm-256color',
              COLUMNS: (options.cols || 80).toString(),
              LINES: (options.rows || 24).toString(),
              FORCE_COLOR: '1',
              COLORTERM: 'truecolor',
              PS1: '\\[\\033[01;32m\\]\\u@\\h\\[\\033[00m\\]:\\[\\033[01;34m\\]\\w\\[\\033[00m\\]\\$ '
            },
            cwd: process.cwd()
          });
        }
        
        setupTerminal();
      });
      
      const setupTerminal = () => {
        if (!proc) return;
        
        sessionId = `session-${Date.now()}`;
        sessions.set(sessionId, proc);
        socket.data.sessionId = sessionId;
        
        // 出力をクライアントに送信
        proc.stdout.on('data', (data) => {
          socket.emit('output', data.toString());
        });
        
        proc.stderr.on('data', (data) => {
          socket.emit('output', data.toString());
        });
        
        proc.on('exit', (code) => {
          console.log(`Session ${sessionId} exited with code ${code}`);
          socket.emit('session-closed', sessionId);
          sessions.delete(sessionId);
        });
        
        proc.on('error', (err) => {
          console.error('Process error:', err);
          socket.emit('error', err.message);
        });
        
        socket.emit('session-created', sessionId);
        
        // 初期化コマンドを送信
        setTimeout(() => {
          if (proc.stdin && proc.stdin.writable) {
            proc.stdin.write('export TERM=xterm-256color\n');
            proc.stdin.write('clear\n');
          }
        }, 200);
      };
      
    } catch (error) {
      console.error('Failed to create terminal:', error);
      socket.emit('error', error.message);
    }
  });
  
  socket.on('input', (data) => {
    if (proc && proc.stdin && proc.stdin.writable) {
      proc.stdin.write(data);
    }
  });
  
  socket.on('resize', ({ cols, rows }) => {
    if (proc && proc.pid) {
      console.log(`Resizing terminal to ${cols}x${rows}`);
      
      // sttyコマンドでサイズを設定
      if (proc.stdin && proc.stdin.writable) {
        proc.stdin.write(`stty cols ${cols} rows ${rows}\n`);
      }
      
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
      if (sessionId) {
        sessions.delete(sessionId);
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`PTY server (unbuffer version) running on port ${PORT}`);
});