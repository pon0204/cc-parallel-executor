import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { spawn } from 'child_process';
import { v4 as uuidv4 } from 'uuid';

const app = express();
app.use(express.json());

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// セッション管理
const sessions = new Map();

// PTYプロセスを作成する関数
const createPTYProcess = (sessionId, cols = 80, rows = 24) => {
  const shell = process.platform === 'win32' ? 'cmd.exe' : '/bin/bash';
  
  // unbufferを使用してPTYを作成
  const proc = spawn('unbuffer', ['-p', shell], {
    env: {
      ...process.env,
      TERM: 'xterm-256color',
      COLUMNS: cols.toString(),
      LINES: rows.toString(),
      FORCE_COLOR: '1',
      COLORTERM: 'truecolor',
    },
    cwd: process.cwd()
  });
  
  // 初期化
  setTimeout(() => {
    if (proc.stdin.writable) {
      proc.stdin.write(`stty cols ${cols} rows ${rows}\n`);
      proc.stdin.write('export TERM=xterm-256color\n');
      proc.stdin.write(`export COLUMNS=${cols}\n`);
      proc.stdin.write(`export LINES=${rows}\n`);
      proc.stdin.write('clear\n');
    }
  }, 200);
  
  return proc;
};

// REST API エンドポイント
// 新しいClaude Codeセッションを作成
app.post('/api/sessions', async (req, res) => {
  const { prompt, cols = 80, rows = 24 } = req.body;
  const sessionId = uuidv4();
  
  try {
    const proc = createPTYProcess(sessionId, cols, rows);
    
    const session = {
      id: sessionId,
      process: proc,
      output: [],
      status: 'initializing',
      createdAt: new Date()
    };
    
    sessions.set(sessionId, session);
    
    // 出力をキャプチャ
    proc.stdout.on('data', (data) => {
      session.output.push({
        type: 'stdout',
        data: data.toString(),
        timestamp: new Date()
      });
      
      // WebSocketで接続しているクライアントに送信
      io.to(`session-${sessionId}`).emit('output', data.toString());
    });
    
    proc.stderr.on('data', (data) => {
      session.output.push({
        type: 'stderr',
        data: data.toString(),
        timestamp: new Date()
      });
      
      io.to(`session-${sessionId}`).emit('output', data.toString());
    });
    
    proc.on('exit', (code) => {
      session.status = 'exited';
      session.exitCode = code;
      session.endedAt = new Date();
    });
    
    // Claude Codeを起動
    setTimeout(() => {
      session.status = 'starting-claude';
      proc.stdin.write('claude\n');
      
      // プロンプトを送信
      if (prompt) {
        setTimeout(() => {
          session.status = 'running';
          proc.stdin.write(prompt + '\n');
        }, 3000);
      }
    }, 1000);
    
    res.json({
      sessionId,
      status: 'created',
      message: 'Session created successfully'
    });
    
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

// セッションの状態を取得
app.get('/api/sessions/:id', (req, res) => {
  const session = sessions.get(req.params.id);
  
  if (!session) {
    return res.status(404).json({
      error: 'Session not found'
    });
  }
  
  res.json({
    id: session.id,
    status: session.status,
    createdAt: session.createdAt,
    endedAt: session.endedAt,
    exitCode: session.exitCode,
    outputLength: session.output.length
  });
});

// セッションの出力を取得
app.get('/api/sessions/:id/output', (req, res) => {
  const session = sessions.get(req.params.id);
  
  if (!session) {
    return res.status(404).json({
      error: 'Session not found'
    });
  }
  
  // クエリパラメータで出力の範囲を指定可能
  const { start = 0, limit = 100 } = req.query;
  const startIdx = parseInt(start);
  const limitNum = parseInt(limit);
  
  res.json({
    id: session.id,
    output: session.output.slice(startIdx, startIdx + limitNum),
    totalLines: session.output.length
  });
});

// セッションにコマンドを送信
app.post('/api/sessions/:id/input', (req, res) => {
  const session = sessions.get(req.params.id);
  
  if (!session) {
    return res.status(404).json({
      error: 'Session not found'
    });
  }
  
  const { input } = req.body;
  
  if (!input) {
    return res.status(400).json({
      error: 'Input is required'
    });
  }
  
  if (session.process.stdin.writable) {
    session.process.stdin.write(input);
    res.json({
      success: true,
      message: 'Input sent successfully'
    });
  } else {
    res.status(400).json({
      error: 'Session is not accepting input'
    });
  }
});

// セッションを終了
app.delete('/api/sessions/:id', (req, res) => {
  const session = sessions.get(req.params.id);
  
  if (!session) {
    return res.status(404).json({
      error: 'Session not found'
    });
  }
  
  session.process.kill('SIGTERM');
  sessions.delete(req.params.id);
  
  res.json({
    success: true,
    message: 'Session terminated'
  });
});

// すべてのセッションをリスト
app.get('/api/sessions', (req, res) => {
  const sessionList = Array.from(sessions.values()).map(session => ({
    id: session.id,
    status: session.status,
    createdAt: session.createdAt,
    endedAt: session.endedAt
  }));
  
  res.json({
    sessions: sessionList,
    total: sessionList.length
  });
});

// 並列実行用のバッチAPI
app.post('/api/batch', async (req, res) => {
  const { tasks } = req.body;
  
  if (!tasks || !Array.isArray(tasks)) {
    return res.status(400).json({
      error: 'Tasks array is required'
    });
  }
  
  const results = [];
  
  for (const task of tasks) {
    const sessionId = uuidv4();
    try {
      const proc = createPTYProcess(sessionId);
      
      const session = {
        id: sessionId,
        taskId: task.id,
        process: proc,
        output: [],
        status: 'initializing',
        createdAt: new Date()
      };
      
      sessions.set(sessionId, session);
      
      // 出力をキャプチャ
      proc.stdout.on('data', (data) => {
        session.output.push({
          type: 'stdout',
          data: data.toString(),
          timestamp: new Date()
        });
      });
      
      proc.stderr.on('data', (data) => {
        session.output.push({
          type: 'stderr',
          data: data.toString(),
          timestamp: new Date()
        });
      });
      
      proc.on('exit', (code) => {
        session.status = 'exited';
        session.exitCode = code;
        session.endedAt = new Date();
      });
      
      // Claude Codeを起動してプロンプトを送信
      setTimeout(() => {
        proc.stdin.write('claude\n');
        setTimeout(() => {
          proc.stdin.write(task.prompt + '\n');
          session.status = 'running';
        }, 3000);
      }, 1000);
      
      results.push({
        taskId: task.id,
        sessionId,
        status: 'created'
      });
      
    } catch (error) {
      results.push({
        taskId: task.id,
        error: error.message
      });
    }
  }
  
  res.json({
    results,
    total: results.length
  });
});

// WebSocket接続も維持（オプション）
io.on('connection', (socket) => {
  console.log('WebSocket client connected:', socket.id);
  
  socket.on('join-session', (sessionId) => {
    socket.join(`session-${sessionId}`);
  });
  
  socket.on('leave-session', (sessionId) => {
    socket.leave(`session-${sessionId}`);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Claude Code API Server running on port ${PORT}`);
  console.log(`API endpoints available at http://localhost:${PORT}/api`);
});