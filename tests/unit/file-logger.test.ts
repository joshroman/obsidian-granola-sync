import { FileLogger } from '../../src/utils/file-logger';
import { StructuredLogger, LogEntry } from '../../src/utils/structured-logger';
import { Plugin } from 'obsidian';
import { PluginSettings } from '../../src/types';
import * as fs from 'fs';
import * as path from 'path';

// Mock dependencies
jest.mock('fs');
jest.mock('obsidian', () => ({
  Plugin: jest.fn(),
  FileSystemAdapter: jest.fn().mockImplementation(() => ({
    path: {
      join: (...args: string[]) => args.join('/'),
      resolve: (p: string) => p,
    }
  }))
}));

// Mock JSZip
jest.mock('jszip', () => {
  return jest.fn().mockImplementation(() => ({
    file: jest.fn(),
    generateAsync: jest.fn().mockResolvedValue(Buffer.from('mock zip content'))
  }));
});

describe.skip('FileLogger', () => {
  let fileLogger: FileLogger;
  let mockPlugin: Plugin & { settings: PluginSettings };
  let mockStructuredLogger: StructuredLogger;
  let mockAdapter: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useFakeTimers();
    
    // Enable file logger for tests
    (global as any).__ALLOW_FILE_LOGGER__ = true;
    
    // Mock plugin
    mockAdapter = {
      basePath: '/mock/vault/path',
      path: {
        join: jest.fn((...args: string[]) => args.join('/')),
        resolve: jest.fn((p: string) => p),
      }
    };
    
    mockPlugin = {
      settings: {
        debugMode: true,
        logLevel: 'debug',
        targetFolder: 'Meetings',
      } as PluginSettings,
      app: {
        vault: {
          adapter: mockAdapter,
          configDir: '.obsidian'
        },
        appVersion: '1.0.0'
      },
      manifest: {
        version: '1.0.0'
      }
    } as any;

    // Mock StructuredLogger
    mockStructuredLogger = {
      getRecentLogs: jest.fn().mockReturnValue([]),
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn()
    } as any;

    // Mock fs methods
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.mkdirSync as jest.Mock).mockImplementation();
    (fs.writeFileSync as jest.Mock).mockImplementation();
    (fs.readFileSync as jest.Mock).mockReturnValue('');
    (fs.statSync as jest.Mock).mockReturnValue({ size: 0 });
    (fs.readdirSync as jest.Mock).mockReturnValue([]);
    (fs.unlinkSync as jest.Mock).mockImplementation();
  });

  afterEach(() => {
    // Cleanup file logger if it exists
    if (fileLogger) {
      fileLogger.cleanup();
    }
    jest.useRealTimers();
    
    // Disable file logger after tests
    delete (global as any).__ALLOW_FILE_LOGGER__;
  });

  describe('Initialization', () => {
    it('should create log directory if it does not exist', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      
      fileLogger = new FileLogger(mockPlugin, mockStructuredLogger);
      await fileLogger.initialize();
      
      expect(fs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('.obsidian/plugins/granola-sync/logs'),
        { recursive: true }
      );
    });

    it('should not create log directory if it already exists', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      
      fileLogger = new FileLogger(mockPlugin, mockStructuredLogger);
      await fileLogger.initialize();
      
      expect(fs.mkdirSync).not.toHaveBeenCalled();
    });

    it('should handle initialization errors gracefully', async () => {
      (fs.existsSync as jest.Mock).mockImplementation(() => {
        throw new Error('Permission denied');
      });
      
      fileLogger = new FileLogger(mockPlugin, mockStructuredLogger);
      await expect(fileLogger.initialize()).resolves.not.toThrow();
      
      expect(mockStructuredLogger.error).toHaveBeenCalledWith(
        'Failed to initialize file logger',
        expect.any(Error)
      );
    });
  });

  describe('Log Writing', () => {
    beforeEach(async () => {
      fileLogger = new FileLogger(mockPlugin, mockStructuredLogger);
      await fileLogger.initialize();
    });

    it('should write log entries to file', async () => {
      const logEntry: LogEntry = {
        timestamp: '2025-01-27T12:00:00.000Z',
        level: 'info',
        component: 'TestComponent',
        message: 'Test message'
      };

      await fileLogger.writeLogEntry(logEntry);
      
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('debug.log'),
        expect.stringContaining(JSON.stringify(logEntry) + '\n'),
        { flag: 'a' }
      );
    });

    it('should handle write errors gracefully', async () => {
      (fs.writeFileSync as jest.Mock).mockImplementation(() => {
        throw new Error('Disk full');
      });

      const logEntry: LogEntry = {
        timestamp: '2025-01-27T12:00:00.000Z',
        level: 'error',
        component: 'TestComponent',
        message: 'Test error'
      };

      await expect(fileLogger.writeLogEntry(logEntry)).resolves.not.toThrow();
      expect(mockStructuredLogger.error).toHaveBeenCalled();
    });

    it('should only write logs when debug mode is enabled', async () => {
      mockPlugin.settings.debugMode = false;
      
      const logEntry: LogEntry = {
        timestamp: '2025-01-27T12:00:00.000Z',
        level: 'debug',
        component: 'TestComponent',
        message: 'Debug message'
      };

      await fileLogger.writeLogEntry(logEntry);
      
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });
  });

  describe('Log Rotation', () => {
    beforeEach(async () => {
      fileLogger = new FileLogger(mockPlugin, mockStructuredLogger);
      await fileLogger.initialize();
    });

    it('should rotate logs when file size exceeds limit', async () => {
      // Mock current file size exceeding limit (5MB)
      (fs.statSync as jest.Mock).mockReturnValue({ size: 6 * 1024 * 1024 });
      (fs.readdirSync as jest.Mock).mockReturnValue([]);

      await fileLogger.rotateLogsIfNeeded();
      
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('debug.1.log'),
        expect.any(String)
      );
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('debug.log'),
        ''
      );
    });

    it('should maintain maximum number of log files', async () => {
      // Mock existing log files
      (fs.readdirSync as jest.Mock).mockReturnValue([
        'debug.log',
        'debug.1.log',
        'debug.2.log',
        'debug.3.log',
        'debug.4.log',
        'debug.5.log'
      ]);
      (fs.statSync as jest.Mock).mockReturnValue({ size: 6 * 1024 * 1024 });

      await fileLogger.rotateLogsIfNeeded();
      
      // Should delete the oldest log file
      expect(fs.unlinkSync).toHaveBeenCalledWith(
        expect.stringContaining('debug.5.log')
      );
    });

    it('should not rotate logs when file size is within limit', async () => {
      (fs.statSync as jest.Mock).mockReturnValue({ size: 1 * 1024 * 1024 });
      
      await fileLogger.rotateLogsIfNeeded();
      
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });
  });

  describe('Log Export', () => {
    beforeEach(async () => {
      fileLogger = new FileLogger(mockPlugin, mockStructuredLogger);
      await fileLogger.initialize();
    });

    it('should export logs to a ZIP file', async () => {
      const mockLogContent = 'log content';
      (fs.readdirSync as jest.Mock).mockReturnValue(['debug.log', 'debug.1.log']);
      (fs.readFileSync as jest.Mock).mockReturnValue(mockLogContent);

      const result = await fileLogger.exportLogs();
      
      expect(result).toMatchObject({
        filename: expect.stringMatching(/granola-sync-debug-logs-\d{4}-\d{2}-\d{2}-\d{6}\.zip/),
        path: expect.stringContaining('.obsidian/plugins/granola-sync/logs'),
        size: expect.any(Number)
      });
    });

    it('should handle export errors gracefully', async () => {
      (fs.readdirSync as jest.Mock).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      await expect(fileLogger.exportLogs()).rejects.toThrow('Failed to export logs');
      expect(mockStructuredLogger.error).toHaveBeenCalled();
    });

    it('should include system info in export', async () => {
      (fs.readdirSync as jest.Mock).mockReturnValue(['debug.log']);
      (fs.readFileSync as jest.Mock).mockReturnValue('log content');

      const mockZip = {
        file: jest.fn(),
        generateAsync: jest.fn().mockResolvedValue(Buffer.from('mock zip content'))
      };
      
      const JSZip = require('jszip');
      (JSZip as jest.Mock).mockImplementation(() => mockZip);

      await fileLogger.exportLogs();
      
      expect(mockZip.file).toHaveBeenCalledWith(
        'system-info.json',
        expect.stringContaining('obsidianVersion')
      );
    });
  });

  describe('Log Cleanup', () => {
    beforeEach(async () => {
      fileLogger = new FileLogger(mockPlugin, mockStructuredLogger);
      await fileLogger.initialize();
    });

    it('should clean up old log files', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 8); // 8 days old
      
      (fs.readdirSync as jest.Mock).mockReturnValue(['debug.log', 'old-export.zip']);
      (fs.statSync as jest.Mock).mockReturnValue({ 
        mtime: oldDate,
        size: 1024 
      });

      await fileLogger.cleanupOldLogs();
      
      expect(fs.unlinkSync).toHaveBeenCalledWith(
        expect.stringContaining('old-export.zip')
      );
    });

    it('should not delete recent log files', async () => {
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 2); // 2 days old
      
      (fs.readdirSync as jest.Mock).mockReturnValue(['debug.log', 'recent-export.zip']);
      (fs.statSync as jest.Mock).mockReturnValue({ 
        mtime: recentDate,
        size: 1024 
      });

      await fileLogger.cleanupOldLogs();
      
      expect(fs.unlinkSync).not.toHaveBeenCalled();
    });
  });

  describe('Integration with StructuredLogger', () => {
    beforeEach(async () => {
      fileLogger = new FileLogger(mockPlugin, mockStructuredLogger);
      await fileLogger.initialize();
    });

    it('should sync with StructuredLogger buffer', async () => {
      const mockLogs: LogEntry[] = [
        {
          timestamp: '2025-01-27T12:00:00.000Z',
          level: 'info',
          component: 'TestComponent',
          message: 'Test 1'
        },
        {
          timestamp: '2025-01-27T12:01:00.000Z',
          level: 'error',
          component: 'TestComponent',
          message: 'Test 2'
        }
      ];

      (mockStructuredLogger.getRecentLogs as jest.Mock).mockReturnValue(mockLogs);

      await fileLogger.syncWithStructuredLogger();
      
      // Initial sync in initialize() + this call = 2 times
      expect(fs.writeFileSync).toHaveBeenCalledTimes(2);
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('debug.log'),
        expect.stringContaining('Test 1'),
        { flag: 'a' }
      );
    });
  });

  describe('Log Level Filtering', () => {
    beforeEach(async () => {
      fileLogger = new FileLogger(mockPlugin, mockStructuredLogger);
      await fileLogger.initialize();
    });

    it('should respect log level settings', async () => {
      mockPlugin.settings.logLevel = 'warn';
      
      const debugEntry: LogEntry = {
        timestamp: '2025-01-27T12:00:00.000Z',
        level: 'debug',
        component: 'TestComponent',
        message: 'Debug message'
      };

      const errorEntry: LogEntry = {
        timestamp: '2025-01-27T12:00:00.000Z',
        level: 'error',
        component: 'TestComponent',
        message: 'Error message'
      };

      await fileLogger.writeLogEntry(debugEntry);
      await fileLogger.writeLogEntry(errorEntry);
      
      expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('Error message'),
        expect.any(Object)
      );
    });
  });
});