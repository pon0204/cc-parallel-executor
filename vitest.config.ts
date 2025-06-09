import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    // Test environment for DOM-related tests
    environment: 'happy-dom',
    
    // Global setup and teardown
    setupFiles: ['./test/setup.ts'],
    globalSetup: './test/global-setup.ts',
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData/',
        'components/ui/**', // Exclude shadcn/ui components
        '.next/',
        'mcp-server/node_modules/'
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80
      }
    },
    
    // Test execution configuration
    globals: true,
    restoreMocks: true,
    mockReset: true,
    clearMocks: true,
    
    // Parallel execution optimization
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        minThreads: 1,
        maxThreads: 4
      }
    },
    
    // Test isolation
    isolate: true,
    
    // Reporter configuration
    reporters: ['verbose'],
    outputFile: {
      junit: './test-results/junit.xml',
      json: './test-results/results.json'
    },
    
    // Performance
    testTimeout: 10000,
    hookTimeout: 10000,
    
    // Type checking
    typecheck: {
      enabled: true,
      tsconfig: './tsconfig.json'
    },
    
    // File patterns
    include: [
      '**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*',
      '**/test/builders/**',
      '**/test/mocks/**',
      '**/test/utils/**',
      '**/test/setup/**',
      '**/test/setup.ts',
      '**/test/global-setup.ts'
    ],
    
    // Watch mode configuration
    watchExclude: ['**/node_modules/**', '**/dist/**', '.next/**'],
    
    // Benchmark configuration
    benchmark: {
      include: ['**/*.bench.{js,ts}'],
      reporters: ['default', 'json'],
      outputFile: './benchmark-results/results.json'
    }
  },
  
  // Path aliases
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      '@/components': path.resolve(__dirname, './components'),
      '@/lib': path.resolve(__dirname, './lib'),
      '@/server': path.resolve(__dirname, './server'),
      '@/app': path.resolve(__dirname, './app'),
      '@/test': path.resolve(__dirname, './test')
    }
  },
  
  // Define global constants
  define: {
    'import.meta.vitest': 'undefined',
  }
});