export class MockLogger {
  error = jest.fn((message: string, error?: any) => {
    console.error(`[MockLogger] ERROR: ${message}`, error);
  });
  
  warn = jest.fn((message: string, ...args: any[]) => {
    console.warn(`[MockLogger] WARN: ${message}`, ...args);
  });
  
  info = jest.fn((message: string, ...args: any[]) => {
    console.log(`[MockLogger] INFO: ${message}`, ...args);
  });
  
  debug = jest.fn((message: string, context?: any) => {
    // Silently ignore debug messages in tests unless needed
  });
  
  time = jest.fn();
  timeEnd = jest.fn();
  startOperation = jest.fn((operation: string) => `op-${operation}-${Date.now()}`);
  endOperation = jest.fn();
  getMetrics = jest.fn(() => ({
    totalLogs: 0,
    errorCount: 0,
    warnCount: 0,
    infoCount: 0,
    debugCount: 0,
    components: {}
  }));
  getRecentLogs = jest.fn(() => []);
  exportLogs = jest.fn(() => '');
  clearLogs = jest.fn();
}