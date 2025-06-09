import '@testing-library/jest-dom';
import { expect, vi } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
import { cleanup } from '@testing-library/react';

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers);

// Global test setup
beforeAll(() => {
  // Mock console methods to reduce noise in tests
  global.console = {
    ...console,
    log: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  // Mock window.matchMedia
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  // Mock IntersectionObserver
  global.IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));

  // Mock ResizeObserver
  global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));
});

// Cleanup after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Global error handler for unhandled promise rejections
process.on('unhandledRejection', (reason: any) => {
  console.error('Unhandled Promise Rejection:', reason);
});

// Custom matchers
expect.extend({
  toBeValidUUID(received: string) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const pass = uuidRegex.test(received);
    
    return {
      pass,
      message: () => pass
        ? `expected ${received} not to be a valid UUID`
        : `expected ${received} to be a valid UUID`,
    };
  },
  
  toHaveBeenCalledWithPartial(received: any, expected: any) {
    const calls = received.mock.calls;
    const pass = calls.some((call: any[]) => 
      call.some(arg => 
        Object.keys(expected).every(key => 
          JSON.stringify(arg[key]) === JSON.stringify(expected[key])
        )
      )
    );
    
    return {
      pass,
      message: () => pass
        ? `expected function not to have been called with partial object ${JSON.stringify(expected)}`
        : `expected function to have been called with partial object ${JSON.stringify(expected)}`,
    };
  },
  
  toMatchSchema(received: any, schema: any) {
    try {
      const result = schema.parse(received);
      return {
        pass: true,
        message: () => `expected ${JSON.stringify(received)} not to match schema`,
      };
    } catch (error) {
      return {
        pass: false,
        message: () => `expected ${JSON.stringify(received)} to match schema. Error: ${error}`,
      };
    }
  }
});

// Type augmentation for custom matchers
declare module 'vitest' {
  interface Assertion {
    toBeValidUUID(): void;
    toHaveBeenCalledWithPartial(expected: any): void;
    toMatchSchema(schema: any): void;
  }
}

// Setup test environment
import { setupAllMocks } from './setup/test-env';

// Apply all mocks globally
setupAllMocks();