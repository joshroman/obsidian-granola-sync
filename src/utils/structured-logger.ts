import { Plugin } from 'obsidian';
import { PluginSettings } from '../types';

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export interface LogContext {
  [key: string]: any;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  component: string;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

export interface LogMetrics {
  totalLogs: number;
  errorCount: number;
  warnCount: number;
  infoCount: number;
  debugCount: number;
  components: Record<string, number>;
}

export class StructuredLogger {
  private static instance: StructuredLogger;
  private logBuffer: LogEntry[] = [];
  private metrics: LogMetrics = {
    totalLogs: 0,
    errorCount: 0,
    warnCount: 0,
    infoCount: 0,
    debugCount: 0,
    components: {}
  };
  
  constructor(
    private component: string,
    private plugin: Plugin & { settings: PluginSettings }
  ) {}
  
  static getInstance(component: string, plugin: Plugin & { settings: PluginSettings }): StructuredLogger {
    if (!StructuredLogger.instance) {
      StructuredLogger.instance = new StructuredLogger(component, plugin);
    }
    return new StructuredLogger(component, plugin);
  }
  
  private shouldLog(level: LogLevel): boolean {
    if (!this.plugin?.settings?.debugMode) {
      return level === 'error';
    }
    
    const levels: LogLevel[] = ['error', 'warn', 'info', 'debug'];
    const configuredLevel = levels.indexOf(this.plugin.settings.logLevel as LogLevel);
    const messageLevel = levels.indexOf(level);
    
    return messageLevel <= configuredLevel;
  }
  
  private createLogEntry(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      component: this.component,
      message,
      context
    };
    
    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack
      };
    }
    
    return entry;
  }
  
  private updateMetrics(level: LogLevel): void {
    this.metrics.totalLogs++;
    this.metrics[`${level}Count` as keyof LogMetrics]++;
    this.metrics.components[this.component] = (this.metrics.components[this.component] || 0) + 1;
  }
  
  private formatForConsole(entry: LogEntry): string {
    const parts = [
      `[${entry.timestamp}]`,
      `[${entry.component}]`,
      `[${entry.level.toUpperCase()}]`,
      entry.message
    ];
    
    if (entry.context && Object.keys(entry.context).length > 0) {
      parts.push(`| Context: ${JSON.stringify(entry.context)}`);
    }
    
    return parts.join(' ');
  }
  
  private log(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
    if (!this.shouldLog(level)) {
      return;
    }
    
    const entry = this.createLogEntry(level, message, context, error);
    this.logBuffer.push(entry);
    this.updateMetrics(level);
    
    // Keep buffer size manageable
    if (this.logBuffer.length > 1000) {
      this.logBuffer = this.logBuffer.slice(-500);
    }
    
    // Output to console
    const formatted = this.formatForConsole(entry);
    
    switch (level) {
      case 'error':
        console.error(formatted, error);
        break;
      case 'warn':
        console.warn(formatted);
        break;
      default:
        console.log(formatted);
    }
  }
  
  error(message: string, error?: Error, context?: LogContext): void {
    this.log('error', message, context, error);
  }
  
  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }
  
  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }
  
  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }
  
  // Performance logging
  time(label: string): void {
    if (this.shouldLog('debug')) {
      console.time(`[${this.component}] ${label}`);
    }
  }
  
  timeEnd(label: string): void {
    if (this.shouldLog('debug')) {
      console.timeEnd(`[${this.component}] ${label}`);
    }
  }
  
  // Structured operation logging
  startOperation(operation: string, context?: LogContext): string {
    const operationId = `${operation}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.info(`Starting operation: ${operation}`, { ...context, operationId });
    return operationId;
  }
  
  endOperation(operationId: string, success: boolean, context?: LogContext): void {
    const message = success ? `Operation completed: ${operationId}` : `Operation failed: ${operationId}`;
    const level = success ? 'info' : 'error';
    this.log(level as LogLevel, message, { ...context, operationId, success });
  }
  
  // Get metrics
  getMetrics(): LogMetrics {
    return { ...this.metrics };
  }
  
  // Get recent logs
  getRecentLogs(count: number = 100): LogEntry[] {
    return this.logBuffer.slice(-count);
  }
  
  // Export logs
  exportLogs(): string {
    return this.logBuffer.map(entry => JSON.stringify(entry)).join('\n');
  }
  
  // Clear logs
  clearLogs(): void {
    this.logBuffer = [];
    this.metrics = {
      totalLogs: 0,
      errorCount: 0,
      warnCount: 0,
      infoCount: 0,
      debugCount: 0,
      components: {}
    };
  }
}

// Backward compatibility wrapper
export class Logger extends StructuredLogger {
  constructor(componentOrPlugin: string | (Plugin & { settings: PluginSettings }), settingsOrPlugin?: PluginSettings | (Plugin & { settings: PluginSettings })) {
    // Handle multiple constructor signatures for backward compatibility
    if (typeof componentOrPlugin === 'string') {
      // New signature: Logger(component, plugin)
      const component = componentOrPlugin;
      const plugin = settingsOrPlugin as Plugin & { settings: PluginSettings };
      super(component, plugin);
    } else {
      // Old signature: Logger(plugin)
      const plugin = componentOrPlugin;
      super('GranolaSyncPlugin', plugin);
    }
  }
  
  // Override old methods for backward compatibility
  error(message: string, error?: any): void {
    if (error instanceof Error) {
      super.error(message, error);
    } else if (error) {
      super.error(message, undefined, { error });
    } else {
      super.error(message);
    }
  }
  
  warn(message: string, ...args: any[]): void {
    if (args.length > 0) {
      super.warn(message, { args });
    } else {
      super.warn(message);
    }
  }
  
  info(message: string, ...args: any[]): void {
    if (args.length > 0) {
      super.info(message, { args });
    } else {
      super.info(message);
    }
  }
  
  debug(message: string, ...args: any[]): void {
    if (args.length > 0) {
      super.debug(message, { args });
    } else {
      super.debug(message);
    }
  }
}