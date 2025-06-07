import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import { logger } from './utils/logger.js';
import { prisma } from './utils/prisma.js';
import { apiRouter } from './api/index.js';
import { TerminalService } from './services/terminal.service.js';
import { CCService } from './services/cc.service.js';

const app = express();
const server = createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: 'http://localhost:3000',
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

// Socket.IO connection handling
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);

  // Terminal-related events (matching server-unbuffer.cjs protocol)
  socket.on('create-session', async (options) => {
    await terminalService.createTerminal(socket, options);
  });

  socket.on('input', (data) => {
    logger.info('Received input data:', { 
      socketId: socket.id, 
      dataLength: data.length,
      preview: data.slice(0, 50) + (data.length > 50 ? '...' : '')
    });
    terminalService.sendData(socket.id, data);
  });

  socket.on('resize', (dimensions) => {
    terminalService.resizeTerminal(socket.id, dimensions);
  });

  // CC-related events
  socket.on('cc:create-parent', async (...args: any[]) => {
    console.log('=== CC CREATE PARENT EVENT ===');
    console.log('Arguments count:', args.length);
    for (let i = 0; i < args.length; i++) {
      console.log(`Arg[${i}]:`, args[i]);
      console.log(`Arg[${i}] type:`, typeof args[i]);
      console.log(`Arg[${i}] JSON:`, JSON.stringify(args[i]));
    }
    
    const data = args[0];
    if (!data || typeof data !== 'object') {
      console.error('Invalid data received:', data);
      socket.emit('cc:error', { message: 'Invalid data format' });
      return;
    }
    
    console.log('Processing CC creation with valid data:', data);
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

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

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
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});