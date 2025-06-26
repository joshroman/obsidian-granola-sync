import { setupTestEnvironment } from './test-environment';
import '@testing-library/jest-dom';

// Mock the structured logger module
jest.mock('../../src/utils/structured-logger', () => {
  const MockLogger = {
    error: jest.fn((msg, err) => console.error(`[Mock] ERROR: ${msg}`, err)),
    warn: jest.fn((msg, ...args) => console.warn(`[Mock] WARN: ${msg}`, ...args)),
    info: jest.fn((msg, ...args) => console.log(`[Mock] INFO: ${msg}`, ...args)),
    debug: jest.fn(), // Silently ignore debug messages
    time: jest.fn(),
    timeEnd: jest.fn(),
    startOperation: jest.fn((op) => `op-${op}-${Date.now()}`),
    endOperation: jest.fn(),
    getMetrics: jest.fn(() => ({
      totalLogs: 0,
      errorCount: 0,
      warnCount: 0,
      infoCount: 0,
      debugCount: 0,
      components: {}
    })),
    getRecentLogs: jest.fn(() => []),
    exportLogs: jest.fn(() => ''),
    clearLogs: jest.fn()
  };

  return {
    StructuredLogger: jest.fn().mockImplementation(() => MockLogger),
    Logger: jest.fn().mockImplementation(() => MockLogger),
    LogLevel: {},
    LogContext: {},
    LogEntry: {},
    LogMetrics: {}
  };
});

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

// Set up fake timers with legacy mode to avoid issues
beforeAll(() => {
  jest.useFakeTimers({
    legacyFakeTimers: true
  });
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
  
  // Advance timers if needed
  jest.runOnlyPendingTimers();
});

afterEach(() => {
  // Clean up any remaining timers
  jest.clearAllTimers();
});