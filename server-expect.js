import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const sessions = new Map();

// expectスクリプトを作成
const createExpectScript = (cols, rows) => {
  const scriptContent = `#!/usr/bin/expect -f
set timeout -1
set cols ${cols}
set rows ${rows}

# ターミナルサイズを設定
exec stty cols $cols rows $rows

# 環境変数を設定
set env(TERM) "xterm-256color"
set env(COLUMNS) $cols
set env(LINES) $rows
set env(FORCE_COLOR) "1"
set env(COLORTERM) "truecolor"

# bashを起動
spawn -noecho /bin/bash -i

# ターミナルサイズを送信
send "stty cols $cols rows $rows\\r"
send "export TERM=xterm-256color\\r"
send "export COLUMNS=$cols\\r"
send "export LINES=$rows\\r"
send "clear\\r"

# 入力を処理
interact
`;
  
  const tmpFile = path.join(os.tmpdir(), `terminal-${Date.now()}.exp`);
  fs.writeFileSync(tmpFile, scriptContent);
  fs.chmodSync(tmpFile, '755');
  return tmpFile;
};

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  let proc = null;
  let sessionId = null;
  let expectScript = null;
  
  socket.on('create-terminal', (options = {}) => {
    console.log('Creating new terminal session with options:', options);
    
    try {
      const cols = options.cols || 80;
      const rows = options.rows || 24;
      
      // expectスクリプトを作成
      expectScript = createExpectScript(cols, rows);
      
      // expectでターミナルを起動
      proc = spawn('expect', ['-f', expectScript], {
        env: {
          ...process.env,
          TERM: 'xterm-256color',
          COLUMNS: cols.toString(),
          LINES: rows.toString(),
        },
        cwd: process.cwd()
      });
      
      sessionId = `session-${Date.now()}`;
      sessions.set(sessionId, { proc, expectScript });
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
        
        // クリーンアップ
        if (expectScript && fs.existsSync(expectScript)) {
          fs.unlinkSync(expectScript);
        }
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
      
      // sttyコマンドでサイズを設定
      if (proc.stdin.writable) {
        proc.stdin.write(`\x1b[8;${rows};${cols}t`);
        proc.stdin.write(`stty cols ${cols} rows ${rows}\n`);
      }
      
      // SIGWINCHシグナルを送信
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
    const session = sessions.get(sessionId);
    if (session) {
      if (session.proc && !session.proc.killed) {
        session.proc.kill('SIGTERM');
      }
      if (session.expectScript && fs.existsSync(session.expectScript)) {
        fs.unlinkSync(session.expectScript);
      }
      sessions.delete(sessionId);
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Bun PTY server (expect version) running on port ${PORT}`);
});