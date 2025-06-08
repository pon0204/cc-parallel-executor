import { PrismaClient } from '@prisma/client';
import { logger } from './logger.js';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: [
    {
      emit: 'event',
      level: 'query',
    },
    {
      emit: 'event',
      level: 'error',
    },
    {
      emit: 'event',
      level: 'info',
    },
    {
      emit: 'event',
      level: 'warn',
    },
  ],
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Type-safe event handlers
const prismWithEvents = prisma as PrismaClient & {
  $on(event: 'query', cb: (e: any) => void): void;
  $on(event: 'error', cb: (e: any) => void): void;
  $on(event: 'info', cb: (e: any) => void): void;
  $on(event: 'warn', cb: (e: any) => void): void;
};

// Logging configuration
if (process.env.LOG_LEVEL === 'debug') {
  prismWithEvents.$on('query', (e) => {
    logger.debug('Query:', {
      query: e.query,
      params: e.params,
      duration: e.duration,
    });
  });
}

prismWithEvents.$on('error', (e) => {
  logger.error('Prisma error:', e);
});

prismWithEvents.$on('info', (e) => {
  logger.info('Prisma info:', e);
});

prismWithEvents.$on('warn', (e) => {
  logger.warn('Prisma warning:', e);
});