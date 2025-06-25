import { Plugin } from 'obsidian';
import { PluginSettings } from '../types';

export class Logger {
  private plugin: Plugin & { settings: PluginSettings };
  
  constructor(plugin: Plugin & { settings: PluginSettings }) {
    this.plugin = plugin;
  }
  
  private shouldLog(level: 'error' | 'warn' | 'info' | 'debug'): boolean {
    if (!this.plugin.settings.debugMode) {
      return level === 'error';
    }
    
    const levels = ['error', 'warn', 'info', 'debug'];
    const configuredLevel = levels.indexOf(this.plugin.settings.logLevel);
    const messageLevel = levels.indexOf(level);
    
    return messageLevel <= configuredLevel;
  }
  
  private formatMessage(level: string, message: string, ...args: any[]): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [Granola Sync] [${level.toUpperCase()}] ${message}`;
  }
  
  error(message: string, error?: any) {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message), error);
    }
  }
  
  warn(message: string, ...args: any[]) {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message), ...args);
    }
  }
  
  info(message: string, ...args: any[]) {
    if (this.shouldLog('info')) {
      console.log(this.formatMessage('info', message), ...args);
    }
  }
  
  debug(message: string, ...args: any[]) {
    if (this.shouldLog('debug')) {
      console.log(this.formatMessage('debug', message), ...args);
    }
  }
}