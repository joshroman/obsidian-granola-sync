import { setupTestEnvironment } from './test-environment';
import '@testing-library/jest-dom';

// Set timezone to UTC for consistent tests
process.env.TZ = 'UTC';

// Mock Date.now() to return a fixed timestamp
const FIXED_DATE = new Date('2024-03-20T10:00:00Z');
const originalDate = Date;

global.Date = class extends originalDate {
  constructor(...args: any[]) {
    if (args.length === 0) {
      super(FIXED_DATE.getTime());
    } else {
      super(...args);
    }
  }
  
  static now() {
    return FIXED_DATE.getTime();
  }
} as any;

// Set up fake timers
beforeAll(() => {
  jest.useFakeTimers();
  jest.setSystemTime(FIXED_DATE);
});

afterAll(() => {
  jest.useRealTimers();
});

// Mock window object for Obsidian compatibility
(global as any).window = {
  setTimeout: global.setTimeout,
  clearTimeout: global.clearTimeout,
  setInterval: global.setInterval,
  clearInterval: global.clearInterval
};

// Set up the test environment before all tests
setupTestEnvironment();

// Global test utilities
beforeEach(() => {
  // Clear all mocks before each test
  jest.clearAllMocks();
  
  // Reset modules to ensure clean state
  jest.resetModules();
  
  // Reset fake timers
  jest.setSystemTime(FIXED_DATE);
});

afterEach(() => {
  // Clean up any remaining timers
  jest.clearAllTimers();
});