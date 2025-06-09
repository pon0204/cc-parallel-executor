import 'dotenv/config';
import { createServer } from 'http';
import cors from 'cors';
import express from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { apiRouter } from './api/index.js';
import { CCService } from './services/cc.service.js';
import { TerminalService } from './services/terminal.service.js';
import { logger } from './utils/logger.js';
import { prisma } from './utils/prisma.js';
import { errorHandler, notFoundHandler } from './utils/errors.js';

const app = express();
const server = createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: `http://localhost:${process.env.NEXT_PORT || 8080}`,
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api', apiRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Initialize services
const terminalService = new TerminalService(io);
const ccService = new CCService(io);

// Make services available to API routes
app.set('io', io);
app.set('terminalService', terminalService);
app.set('ccService', ccService);

// Socket.IO connection handling
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);

  // Terminal-related events (matching server-unbuffer.cjs protocol)
  socket.on('create-session', async (options) => {
    await terminalService.createTerminal(socket, options);
  });

  socket.on('input', (data) => {
    terminalService.sendData(socket.id, data);
  });

  socket.on('resize', (dimensions) => {
    terminalService.resizeTerminal(socket.id, dimensions);
  });

  // CC-related events
  socket.on('cc:create-parent', async (data) => {
    if (!data || typeof data !== 'object') {
      socket.emit('cc:error', { message: 'Invalid data format' });
      return;
    }
    await ccService.createParentCC(socket, data);
  });

  socket.on('cc:create-child', async (data) => {
    await ccService.createChildCC(socket, data);
  });

  // Ultrathink protocol events
  socket.on('ultrathink:send', async (data: { childInstanceId: string; message: string }) => {
    await ccService.sendUltrathinkMessage(data.childInstanceId, data.message);
  });

  socket.on('ultrathink:response', async (data: { response: string }) => {
    await ccService.handleUltrathinkResponse(socket, data.response);
  });

  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
    terminalService.destroyTerminal(socket.id);
    ccService.destroyCC(socket.id);
  });
});

// 404 handler (must come after all routes)
app.use(notFoundHandler);

// Global error handling middleware (must be last)
app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await prisma.$disconnect();
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

// Start server
const PORT = process.env.PROJECT_SERVER_PORT || 8081;
server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});
