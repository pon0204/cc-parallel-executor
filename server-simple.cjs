const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { spawn } = require('child_process');
const path = require('path');

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
  
  socket.on('create-session', () => {
    console.log('Creating new shell session...');
    
    // Spawn a shell session so user can type any command
    const shell = process.platform === 'win32' ? 'cmd.exe' : '/bin/bash';
    const proc = spawn(shell, [], {
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        PS1: '\\$ ',  // Simple prompt
      },
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    // Send initial commands to set up the shell
    proc.stdin.write('export PS1="$ "\n');
    proc.stdin.write('clear\n');
    
    const sessionId = `session-${Date.now()}`;
    sessions.set(sessionId, proc);
    
    // Send session ID to client
    socket.emit('session-created', sessionId);
    
    // Handle stdout
    proc.stdout.on('data', (data) => {
      console.log('stdout:', data.toString());
      socket.emit('output', data.toString());
    });
    
    // Handle stderr
    proc.stderr.on('data', (data) => {
      socket.emit('output', `[ERROR] ${data.toString()}`);
    });
    
    // Handle exit
    proc.on('exit', (code) => {
      console.log(`Session ${sessionId} exited with code ${code}`);
      socket.emit('session-closed', sessionId);
      sessions.delete(sessionId);
    });
    
    // Store session ID on socket
    socket.data.sessionId = sessionId;
  });
  
  socket.on('input', (data) => {
    const sessionId = socket.data.sessionId;
    const proc = sessions.get(sessionId);
    
    console.log(`Received input for session ${sessionId}: ${data.trim()}`);
    
    if (proc && proc.stdin) {
      proc.stdin.write(data);
      console.log('Input sent to process');
    } else {
      console.log('No process found or stdin not available');
    }
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    const sessionId = socket.data.sessionId;
    const proc = sessions.get(sessionId);
    
    if (proc) {
      proc.kill();
      sessions.delete(sessionId);
    }
    
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Socket.IO server running on port ${PORT}`);
});