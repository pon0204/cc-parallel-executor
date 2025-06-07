const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { spawn } = require('child_process');

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
  
  socket.on('create-session', () => {
    console.log('Creating new shell session...');
    
    // Spawn a shell session
    const shell = process.platform === 'win32' ? 'cmd.exe' : '/bin/bash';
    const proc = spawn(shell, [], {
      env: {
        ...process.env,
        TERM: 'xterm-256color',
      },
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    const sessionId = `session-${Date.now()}`;
    sessions.set(sessionId, proc);
    
    // Send session ID to client
    socket.emit('session-created', sessionId);
    
    // Send initial prompt
    socket.emit('output', '$ ');
    
    // Handle stdout
    proc.stdout.on('data', (data) => {
      console.log('stdout:', data.toString());
      socket.emit('output', data.toString());
    });
    
    // Handle stderr  
    proc.stderr.on('data', (data) => {
      console.log('stderr:', data.toString());
      socket.emit('output', data.toString());
    });
    
    // Handle exit
    proc.on('exit', (code) => {
      console.log(`Session ${sessionId} exited with code ${code}`);
      socket.emit('session-closed', sessionId);
      sessions.delete(sessionId);
    });
    
    // Handle errors
    proc.on('error', (err) => {
      console.error('Process error:', err);
      socket.emit('output', `Error: ${err.message}\n`);
    });
    
    // Store session ID on socket
    socket.data.sessionId = sessionId;
  });
  
  socket.on('input', (data) => {
    const sessionId = socket.data.sessionId;
    const proc = sessions.get(sessionId);
    
    console.log(`Input for session ${sessionId}: "${data.trim()}"`);
    
    if (proc && proc.stdin && !proc.killed) {
      try {
        proc.stdin.write(data);
        console.log('Input written to process');
      } catch (err) {
        console.error('Error writing to stdin:', err);
        socket.emit('output', `Error: ${err.message}\n`);
      }
    } else {
      console.log('No active process for session');
    }
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    const sessionId = socket.data.sessionId;
    const proc = sessions.get(sessionId);
    
    if (proc && !proc.killed) {
      proc.kill();
      sessions.delete(sessionId);
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Socket.IO server running on port ${PORT}`);
});