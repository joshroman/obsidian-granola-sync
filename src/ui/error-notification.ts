import { Notice, App, ButtonComponent } from 'obsidian';
import { SyncError } from '../types';
import { StructuredLogger } from '../utils/structured-logger';

export interface ErrorNotificationOptions {
  duration?: number;
  showDetails?: boolean;
  actions?: Array<{
    label: string;
    callback: () => void;
    primary?: boolean;
  }>;
}

export class ErrorNotificationManager {
  private app: App;
  private logger: StructuredLogger;
  private errorQueue: Array<{ error: SyncError; options: ErrorNotificationOptions }> = [];
  private isShowingError = false;
  
  constructor(app: App, logger: StructuredLogger) {
    this.app = app;
    this.logger = logger;
  }

  /**
   * Show an error notification
   */
  showError(error: SyncError, options: ErrorNotificationOptions = {}): void {
    this.errorQueue.push({ error, options });
    this.processQueue();
  }

  /**
   * Show multiple errors in a summary
   */
  showErrorSummary(errors: SyncError[], title: string = 'Sync Errors'): void {
    if (errors.length === 0) return;
    
    if (errors.length === 1) {
      this.showError(errors[0], { showDetails: true });
      return;
    }
    
    // Create summary notification
    const container = document.createElement('div');
    container.addClass('granola-error-summary');
    
    // Title
    const titleEl = container.createEl('div', { 
      text: `${title} (${errors.length} errors)`,
      cls: 'error-summary-title'
    });
    
    // Error list
    const listEl = container.createEl('ul', { cls: 'error-summary-list' });
    
    // Group errors by type
    const errorGroups = this.groupErrorsByType(errors);
    
    errorGroups.forEach(group => {
      const itemEl = listEl.createEl('li');
      itemEl.createSpan({ 
        text: `${group.type}: `,
        cls: 'error-type'
      });
      itemEl.createSpan({ 
        text: `${group.count} error${group.count > 1 ? 's' : ''}`,
        cls: 'error-count'
      });
      
      if (group.examples.length > 0) {
        const exampleEl = itemEl.createDiv({ cls: 'error-examples' });
        group.examples.slice(0, 2).forEach(example => {
          exampleEl.createDiv({ 
            text: `• ${example.meetingTitle || 'Unknown'}`,
            cls: 'error-example'
          });
        });
        if (group.count > 2) {
          exampleEl.createDiv({ 
            text: `• and ${group.count - 2} more...`,
            cls: 'error-example-more'
          });
        }
      }
    });
    
    // Actions
    const actionsEl = container.createDiv({ cls: 'error-summary-actions' });
    
    new ButtonComponent(actionsEl)
      .setButtonText('View Details')
      .onClick(() => {
        this.showDetailedErrorModal(errors);
      });
    
    new ButtonComponent(actionsEl)
      .setButtonText('Dismiss')
      .onClick(() => {
        // Notice will auto-dismiss
      });
    
    // Show notice
    new Notice(container, 0); // 0 = no auto-dismiss
  }

  /**
   * Show a success notification with optional details
   */
  showSuccess(message: string, details?: { created: number; updated: number; skipped: number }): void {
    if (!details) {
      new Notice(message);
      return;
    }
    
    const container = document.createElement('div');
    container.addClass('granola-success-notification');
    
    // Main message
    container.createEl('div', { 
      text: message,
      cls: 'success-message'
    });
    
    // Details
    if (details.created > 0 || details.updated > 0 || details.skipped > 0) {
      const detailsEl = container.createEl('div', { cls: 'success-details' });
      
      if (details.created > 0) {
        detailsEl.createSpan({ 
          text: `✨ ${details.created} created`,
          cls: 'success-stat'
        });
      }
      
      if (details.updated > 0) {
        detailsEl.createSpan({ 
          text: `🔄 ${details.updated} updated`,
          cls: 'success-stat'
        });
      }
      
      if (details.skipped > 0) {
        detailsEl.createSpan({ 
          text: `⏭️ ${details.skipped} skipped`,
          cls: 'success-stat'
        });
      }
    }
    
    new Notice(container, 5000);
  }

  /**
   * Process the error queue
   */
  private async processQueue(): Promise<void> {
    if (this.isShowingError || this.errorQueue.length === 0) {
      return;
    }
    
    this.isShowingError = true;
    
    const { error, options } = this.errorQueue.shift()!;
    await this.showErrorNotification(error, options);
    
    this.isShowingError = false;
    
    // Process next error after a delay
    if (this.errorQueue.length > 0) {
      setTimeout(() => this.processQueue(), 500);
    }
  }

  /**
   * Show individual error notification
   */
  private async showErrorNotification(
    error: SyncError,
    options: ErrorNotificationOptions
  ): Promise<void> {
    const container = document.createElement('div');
    container.addClass('granola-error-notification');
    
    // Error type icon
    const icon = this.getErrorIcon(error.error);
    
    // Header
    const headerEl = container.createDiv({ cls: 'error-header' });
    headerEl.createSpan({ text: icon, cls: 'error-icon' });
    headerEl.createSpan({ 
      text: this.getErrorTitle(error),
      cls: 'error-title'
    });
    
    // Message
    container.createDiv({ 
      text: error.error,
      cls: 'error-message'
    });
    
    // Details (if requested)
    if (options.showDetails && (error.meetingTitle || error.details)) {
      const detailsEl = container.createDiv({ cls: 'error-details' });
      
      if (error.meetingTitle) {
        detailsEl.createDiv({ 
          text: `Meeting: ${error.meetingTitle}`,
          cls: 'error-detail'
        });
      }
      
      if (error.details) {
        detailsEl.createDiv({ 
          text: error.details,
          cls: 'error-detail'
        });
      }
    }
    
    // Actions
    if (options.actions && options.actions.length > 0) {
      const actionsEl = container.createDiv({ cls: 'error-actions' });
      
      options.actions.forEach(action => {
        const btn = new ButtonComponent(actionsEl)
          .setButtonText(action.label)
          .onClick(() => {
            action.callback();
          });
        
        if (action.primary) {
          btn.setCta();
        }
      });
    }
    
    // Show notice
    const duration = options.duration ?? (options.actions ? 0 : 8000);
    new Notice(container, duration);
    
    // Log the error
    this.logger.info('Error notification shown', {
      errorType: error.error,
      meetingId: error.meetingId,
      hasActions: !!(options.actions?.length)
    });
  }

  /**
   * Group errors by type for summary
   */
  private groupErrorsByType(errors: SyncError[]): Array<{
    type: string;
    count: number;
    examples: SyncError[];
  }> {
    const groups = new Map<string, SyncError[]>();
    
    errors.forEach(error => {
      const type = this.categorizeError(error);
      if (!groups.has(type)) {
        groups.set(type, []);
      }
      groups.get(type)!.push(error);
    });
    
    return Array.from(groups.entries())
      .map(([type, errors]) => ({
        type,
        count: errors.length,
        examples: errors
      }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Categorize error for grouping
   */
  private categorizeError(error: SyncError): string {
    const message = error.error.toLowerCase();
    
    if (message.includes('api') || message.includes('connection')) {
      return 'Connection errors';
    } else if (message.includes('file') || message.includes('path')) {
      return 'File system errors';
    } else if (message.includes('permission') || message.includes('access')) {
      return 'Permission errors';
    } else if (message.includes('conflict')) {
      return 'Conflict errors';
    } else if (message.includes('validation') || message.includes('invalid')) {
      return 'Validation errors';
    } else {
      return 'Other errors';
    }
  }

  /**
   * Get appropriate icon for error type
   */
  private getErrorIcon(errorMessage: string): string {
    const message = errorMessage.toLowerCase();
    
    if (message.includes('api') || message.includes('connection')) {
      return '🔌';
    } else if (message.includes('file') || message.includes('path')) {
      return '📁';
    } else if (message.includes('permission') || message.includes('access')) {
      return '🔒';
    } else if (message.includes('conflict')) {
      return '⚠️';
    } else {
      return '❌';
    }
  }

  /**
   * Get error title based on type
   */
  private getErrorTitle(error: SyncError): string {
    const message = error.error.toLowerCase();
    
    if (message.includes('api')) {
      return 'API Error';
    } else if (message.includes('connection')) {
      return 'Connection Error';
    } else if (message.includes('file')) {
      return 'File Error';
    } else if (message.includes('permission')) {
      return 'Permission Error';
    } else if (message.includes('conflict')) {
      return 'Sync Conflict';
    } else {
      return 'Sync Error';
    }
  }

  /**
   * Show detailed error modal
   */
  private showDetailedErrorModal(errors: SyncError[]): void {
    // This would open a modal with full error details
    // For now, we'll log to console
    console.group('Sync Error Details');
    errors.forEach((error, index) => {
      console.group(`Error ${index + 1}`);
      console.error('Message:', error.error);
      console.log('Meeting:', error.meetingTitle || 'Unknown');
      console.log('Meeting ID:', error.meetingId || 'N/A');
      console.log('Timestamp:', error.timestamp);
      if (error.details) {
        console.log('Details:', error.details);
      }
      console.groupEnd();
    });
    console.groupEnd();
    
    new Notice('Error details logged to console');
  }
}