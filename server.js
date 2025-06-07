const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const pty = require('node-pty');
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
    console.log('Creating new Claude Code session...');
    
    // Create PTY instance
    const ptyProcess = pty.spawn('claude', [], {
      name: 'xterm-256color',
      cols: 80,
      rows: 30,
      cwd: process.cwd(),
      env: process.env
    });
    
    const sessionId = `session-${Date.now()}`;
    sessions.set(sessionId, ptyProcess);
    
    // Send session ID to client
    socket.emit('session-created', sessionId);
    
    // Handle PTY output
    ptyProcess.onData((data) => {
      socket.emit('output', data);
    });
    
    // Handle PTY exit
    ptyProcess.onExit(({ exitCode }) => {
      console.log(`Session ${sessionId} exited with code ${exitCode}`);
      socket.emit('session-closed', sessionId);
      sessions.delete(sessionId);
    });
    
    // Store session ID on socket
    socket.data.sessionId = sessionId;
  });
  
  socket.on('input', (data) => {
    const sessionId = socket.data.sessionId;
    const ptyProcess = sessions.get(sessionId);
    
    if (ptyProcess) {
      ptyProcess.write(data);
    }
  });
  
  socket.on('resize', ({ cols, rows }) => {
    const sessionId = socket.data.sessionId;
    const ptyProcess = sessions.get(sessionId);
    
    if (ptyProcess) {
      ptyProcess.resize(cols, rows);
    }
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    const sessionId = socket.data.sessionId;
    const ptyProcess = sessions.get(sessionId);
    
    if (ptyProcess) {
      ptyProcess.kill();
      sessions.delete(sessionId);
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Socket.IO server running on port ${PORT}`);
});