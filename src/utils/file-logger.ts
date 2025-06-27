import { Plugin } from 'obsidian';
import { PluginSettings } from '../types';
import { StructuredLogger, LogEntry, LogLevel } from './structured-logger';
import * as fs from 'fs';
import * as path from 'path';
import { promises as fsPromises } from 'fs';

export interface FileLoggerConfig {
  maxFileSize: number; // in MB
  maxFiles: number;
  exportRetentionDays: number;
}

export interface LogExportResult {
  filename: string;
  path: string;
  size: number;
}

export class FileLogger {
  private logDir: string;
  private currentLogFile: string;
  private config: FileLoggerConfig = {
    maxFileSize: 5, // 5MB
    maxFiles: 5,
    exportRetentionDays: 7
  };
  private lastSyncTime: number = 0;
  private syncInterval: number = 5000; // 5 seconds

  constructor(
    private plugin: Plugin & { settings: PluginSettings },
    private structuredLogger: StructuredLogger
  ) {
    const vaultPath = (this.plugin.app.vault.adapter as any).basePath || '';
    this.logDir = path.join(vaultPath, '.obsidian', 'plugins', 'granola-sync', 'logs');
    this.currentLogFile = path.join(this.logDir, 'debug.log');
  }

  async initialize(): Promise<void> {
    try {
      // Skip initialization in test environment
      if (process.env.NODE_ENV === 'test' && !(global as any).__ALLOW_FILE_LOGGER__) {
        return;
      }
      
      // Create log directory if it doesn't exist
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }

      // Start periodic sync with StructuredLogger
      const intervalId = setInterval(() => {
        this.syncWithStructuredLogger().catch(err => {
          console.error('Failed to sync with StructuredLogger:', err);
        });
      }, this.syncInterval);
      
      // Store interval ID for cleanup
      (this as any).intervalId = intervalId;

      // Initial sync
      await this.syncWithStructuredLogger();
    } catch (error) {
      this.structuredLogger.error('Failed to initialize file logger', error as Error);
    }
  }

  async writeLogEntry(entry: LogEntry): Promise<void> {
    // Skip in test environment unless explicitly allowed
    if (process.env.NODE_ENV === 'test' && !(global as any).__ALLOW_FILE_LOGGER__) {
      return;
    }
    
    // Only write logs if debug mode is enabled
    if (!this.plugin.settings.debugMode) {
      return;
    }

    // Check if log level should be written
    if (!this.shouldLog(entry.level)) {
      return;
    }

    try {
      // Rotate logs if needed
      await this.rotateLogsIfNeeded();

      // Write log entry
      const logLine = JSON.stringify(entry) + '\n';
      fs.writeFileSync(this.currentLogFile, logLine, { flag: 'a' });
    } catch (error) {
      this.structuredLogger.error('Failed to write log entry', error as Error);
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['error', 'warn', 'info', 'debug'];
    const configuredLevel = levels.indexOf(this.plugin.settings.logLevel);
    const messageLevel = levels.indexOf(level);
    
    return messageLevel <= configuredLevel;
  }

  async rotateLogsIfNeeded(): Promise<void> {
    try {
      if (!fs.existsSync(this.currentLogFile)) {
        return;
      }

      const stats = fs.statSync(this.currentLogFile);
      const maxSizeBytes = this.config.maxFileSize * 1024 * 1024;

      if (stats.size >= maxSizeBytes) {
        // Get existing rotated log files (debug.1.log, debug.2.log, etc)
        const rotatedFiles = fs.readdirSync(this.logDir)
          .filter(f => f.match(/^debug\.(\d+)\.log$/))
          .sort((a, b) => {
            const aNum = parseInt(a.match(/\.(\d+)\./)?.[1] || '0');
            const bNum = parseInt(b.match(/\.(\d+)\./)?.[1] || '0');
            return bNum - aNum; // Sort descending to process from highest to lowest
          });

        // Delete oldest if we're at max
        if (rotatedFiles.length >= this.config.maxFiles - 1) {
          const oldestFile = rotatedFiles[0]; // First in descending order is the highest number
          fs.unlinkSync(path.join(this.logDir, oldestFile));
          rotatedFiles.shift(); // Remove from array
        }

        // Rename existing rotated files (increment their numbers)
        for (const file of rotatedFiles) {
          const currentNum = parseInt(file.match(/\.(\d+)\./)?.[1] || '0');
          const newNum = currentNum + 1;
          const oldPath = path.join(this.logDir, file);
          const newPath = path.join(this.logDir, `debug.${newNum}.log`);
          
          if (fs.existsSync(oldPath)) {
            const content = fs.readFileSync(oldPath, 'utf-8');
            fs.writeFileSync(newPath, content);
            fs.unlinkSync(oldPath);
          }
        }

        // Move current log to debug.1.log
        const currentContent = fs.readFileSync(this.currentLogFile, 'utf-8');
        fs.writeFileSync(path.join(this.logDir, 'debug.1.log'), currentContent);
        
        // Clear current log file
        fs.writeFileSync(this.currentLogFile, '');
      }
    } catch (error) {
      this.structuredLogger.error('Failed to rotate logs', error as Error);
    }
  }

  async syncWithStructuredLogger(): Promise<void> {
    try {
      const recentLogs = this.structuredLogger.getRecentLogs(1000);
      
      // Only sync new logs since last sync
      const newLogs = recentLogs.filter(log => {
        const logTime = new Date(log.timestamp).getTime();
        return logTime > this.lastSyncTime;
      });

      if (newLogs.length > 0) {
        for (const log of newLogs) {
          await this.writeLogEntry(log);
        }
        
        // Update last sync time
        const lastLog = newLogs[newLogs.length - 1];
        this.lastSyncTime = new Date(lastLog.timestamp).getTime();
      }
    } catch (error) {
      this.structuredLogger.error('Failed to sync with StructuredLogger', error as Error);
    }
  }

  async exportLogs(): Promise<LogExportResult> {
    try {
      const JSZip = require('jszip');
      const zip = new JSZip();

      // Add all log files to zip
      const logFiles = fs.readdirSync(this.logDir)
        .filter(f => f.endsWith('.log'));

      for (const file of logFiles) {
        const content = fs.readFileSync(path.join(this.logDir, file), 'utf-8');
        zip.file(file, content);
      }

      // Add system info
      const systemInfo = {
        exportDate: new Date().toISOString(),
        obsidianVersion: (this.plugin.app as any).appVersion || 'Unknown',
        pluginVersion: this.plugin.manifest?.version || 'Unknown',
        platform: process.platform,
        debugMode: this.plugin.settings.debugMode,
        logLevel: this.plugin.settings.logLevel,
        settings: {
          targetFolder: this.plugin.settings.targetFolder,
          folderOrganization: this.plugin.settings.folderOrganization,
          autoSync: this.plugin.settings.autoSync,
          batchSize: this.plugin.settings.batchSize
        }
      };

      zip.file('system-info.json', JSON.stringify(systemInfo, null, 2));

      // Generate zip
      const content = await zip.generateAsync({ type: 'nodebuffer' });
      
      // Save zip file
      const now = new Date();
      const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
      const filename = `granola-sync-debug-logs-${timestamp}.zip`;
      const exportPath = path.join(this.logDir, filename);
      
      fs.writeFileSync(exportPath, content);

      // Clean up old exports
      await this.cleanupOldLogs();

      return {
        filename,
        path: exportPath,
        size: content.length
      };
    } catch (error) {
      this.structuredLogger.error('Failed to export logs', error as Error);
      throw new Error('Failed to export logs: ' + (error as Error).message);
    }
  }

  async cleanupOldLogs(): Promise<void> {
    try {
      const files = fs.readdirSync(this.logDir);
      const now = Date.now();
      const maxAge = this.config.exportRetentionDays * 24 * 60 * 60 * 1000;

      for (const file of files) {
        if (file.endsWith('.zip')) {
          const filePath = path.join(this.logDir, file);
          const stats = fs.statSync(filePath);
          const age = now - stats.mtime.getTime();

          if (age > maxAge) {
            fs.unlinkSync(filePath);
          }
        }
      }
    } catch (error) {
      this.structuredLogger.error('Failed to cleanup old logs', error as Error);
    }
  }

  cleanup(): void {
    // Clear the interval if it exists
    if ((this as any).intervalId) {
      clearInterval((this as any).intervalId);
    }
  }
}