import { Notice } from 'obsidian';
import { Logger } from './logger';
import { SyncError } from '../types';

export enum ErrorType {
  NETWORK = 'NETWORK',
  API = 'API',
  VALIDATION = 'VALIDATION',
  FILE_SYSTEM = 'FILE_SYSTEM',
  UNKNOWN = 'UNKNOWN'
}

export class ErrorHandler {
  constructor(private logger: Logger) {}
  
  /**
   * Handle an error and return a user-friendly message
   */
  handleError(error: unknown, context: string): SyncError {
    const errorInfo = this.parseError(error);
    
    // Only log if we have a valid logger
    if (this.logger && typeof this.logger.error === 'function') {
      this.logger.error(`Error in ${context}:`, errorInfo);
    }
    
    const userMessage = this.getUserMessage(errorInfo.type, errorInfo.message);
    
    return {
      meetingId: '',
      meetingTitle: context,
      error: userMessage,
      timestamp: new Date(),
      details: errorInfo
    };
  }
  
  /**
   * Show error notification to user
   */
  showError(error: unknown, context: string): void {
    const errorInfo = this.handleError(error, context);
    new Notice(`❌ ${errorInfo.error}`);
  }
  
  /**
   * Parse error to extract useful information
   */
  private parseError(error: unknown): {
    type: ErrorType;
    message: string;
    code?: string | number;
    stack?: string;
  } {
    // Handle null or undefined
    if (!error) {
      return {
        type: ErrorType.UNKNOWN,
        message: 'Unknown error occurred'
      };
    }
    
    if (error instanceof Error) {
      // Network errors
      if (error.message.includes('fetch') || 
          error.message.includes('network') ||
          error.message.includes('ECONNREFUSED')) {
        return {
          type: ErrorType.NETWORK,
          message: error.message,
          stack: error.stack || ''
        };
      }
      
      // API errors
      if (error.message.includes('401') || 
          error.message.includes('403') ||
          error.message.includes('API')) {
        return {
          type: ErrorType.API,
          message: error.message,
          code: this.extractStatusCode(error.message),
          stack: error.stack || ''
        };
      }
      
      // Validation errors
      if (error.message.includes('Invalid') || 
          error.message.includes('validation')) {
        return {
          type: ErrorType.VALIDATION,
          message: error.message,
          stack: error.stack || ''
        };
      }
      
      // File system errors
      if (error.message.includes('ENOENT') || 
          error.message.includes('EACCES') ||
          error.message.includes('file') ||
          error.message.includes('folder')) {
        return {
          type: ErrorType.FILE_SYSTEM,
          message: error.message,
          stack: error.stack || ''
        };
      }
      
      // Default error
      return {
        type: ErrorType.UNKNOWN,
        message: error.message,
        stack: error.stack || ''
      };
    }
    
    // Non-Error objects
    return {
      type: ErrorType.UNKNOWN,
      message: String(error)
    };
  }
  
  /**
   * Extract status code from error message
   */
  private extractStatusCode(message: string): number | undefined {
    const match = message.match(/\b(4\d{2}|5\d{2})\b/);
    return match ? parseInt(match[1]) : undefined;
  }
  
  /**
   * Get user-friendly error message
   */
  private getUserMessage(type: ErrorType, originalMessage: string): string {
    switch (type) {
      case ErrorType.NETWORK:
        return 'Connection failed. Please check your internet connection and try again.';
        
      case ErrorType.API:
        if (originalMessage.includes('401')) {
          return 'Authentication failed. Please check your API key.';
        }
        if (originalMessage.includes('403')) {
          return 'Access denied. Please check your permissions.';
        }
        if (originalMessage.includes('429')) {
          return 'Rate limit exceeded. Please try again later.';
        }
        if (originalMessage.includes('500') || originalMessage.includes('502') || originalMessage.includes('503')) {
          return 'Server error. Please try again later.';
        }
        return 'API error. Please check your settings and try again.';
        
      case ErrorType.VALIDATION:
        if (originalMessage.includes('API key')) {
          return 'Invalid API key format. Please check your API key.';
        }
        if (originalMessage.includes('path')) {
          return 'Invalid file path. Please check your folder settings.';
        }
        return 'Invalid input. Please check your settings.';
        
      case ErrorType.FILE_SYSTEM:
        if (originalMessage.includes('ENOENT')) {
          return 'File or folder not found. Please check your vault structure.';
        }
        if (originalMessage.includes('EACCES')) {
          return 'Permission denied. Please check file permissions.';
        }
        if (originalMessage.includes('already exists')) {
          return 'File already exists. Enable overwrite in settings to update.';
        }
        return 'File system error. Please check your vault settings.';
        
      default:
        // Include some of the original message for unknown errors
        const shortMessage = originalMessage.substring(0, 100);
        return `Unexpected error: ${shortMessage}${originalMessage.length > 100 ? '...' : ''}`;
    }
  }
  
  /**
   * Check if an error is retryable
   */
  isRetryableError(error: unknown): boolean {
    const errorInfo = this.parseError(error);
    
    switch (errorInfo.type) {
      case ErrorType.NETWORK:
        return true;
        
      case ErrorType.API:
        // Don't retry auth errors
        if (errorInfo.code === 401 || errorInfo.code === 403) {
          return false;
        }
        // Retry server errors and rate limits
        return errorInfo.code === 429 || (errorInfo.code && errorInfo.code >= 500);
        
      case ErrorType.VALIDATION:
        return false;
        
      case ErrorType.FILE_SYSTEM:
        // Only retry permission errors (might be temporary)
        return errorInfo.message.includes('EACCES');
        
      default:
        return false;
    }
  }
}