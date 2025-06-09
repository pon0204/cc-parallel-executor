import { execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

export default async function globalSetup() {
  console.log('\n🚀 Starting global test setup...\n');

  // Create test database
  const testDbPath = path.join(process.cwd(), 'prisma', 'test.db');
  
  try {
    // Remove existing test database
    await fs.unlink(testDbPath).catch(() => {});
    await fs.unlink(`${testDbPath}-journal`).catch(() => {});
    
    console.log('📦 Setting up test database...');
    
    // Run Prisma migrations for test database
    execSync('npx prisma db push --skip-generate', {
      env: {
        ...process.env,
        DATABASE_URL: 'file:./test.db'
      }
    });
    
    console.log('✅ Test database ready\n');
  } catch (error) {
    console.error('❌ Failed to setup test database:', error);
    throw error;
  }

  // Create test directories
  const testDirs = [
    'test-results',
    'benchmark-results',
    'coverage',
    'logs/test'
  ];

  for (const dir of testDirs) {
    await fs.mkdir(dir, { recursive: true }).catch(() => {});
  }

  // Set up test environment variables
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error';
  process.env.PORT = '0'; // Use random port for tests
  
  return async () => {
    console.log('\n🧹 Cleaning up test environment...\n');
    
    // Cleanup test database
    try {
      await fs.unlink(testDbPath).catch(() => {});
      await fs.unlink(`${testDbPath}-journal`).catch(() => {});
    } catch (error) {
      console.warn('Failed to cleanup test database:', error);
    }
  };
}