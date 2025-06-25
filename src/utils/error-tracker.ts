import { StructuredLogger } from './structured-logger';

export interface TrackedError {
  id: string;
  timestamp: Date;
  error: Error;
  context: Record<string, any>;
  component: string;
  userId?: string;
  sessionId?: string;
  handled: boolean;
  reportSent: boolean;
}

export interface ErrorStats {
  totalErrors: number;
  errorsByType: Record<string, number>;
  errorsByComponent: Record<string, number>;
  recentErrors: TrackedError[];
  criticalErrors: TrackedError[];
}

export interface ErrorPattern {
  pattern: RegExp;
  count: number;
  lastOccurrence: Date;
  contexts: Record<string, any>[];
}

export class ErrorTracker {
  private errors: TrackedError[] = [];
  private errorPatterns: Map<string, ErrorPattern> = new Map();
  private logger: StructuredLogger;
  private sessionId: string;
  
  constructor(logger: StructuredLogger) {
    this.logger = logger;
    this.sessionId = this.generateSessionId();
  }
  
  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private generateErrorId(): string {
    return `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  trackError(
    error: Error,
    component: string,
    context: Record<string, any> = {},
    handled: boolean = true
  ): string {
    const errorId = this.generateErrorId();
    
    const trackedError: TrackedError = {
      id: errorId,
      timestamp: new Date(),
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      } as Error,
      context,
      component,
      sessionId: this.sessionId,
      handled,
      reportSent: false
    };
    
    this.errors.push(trackedError);
    this.updateErrorPatterns(error, context);
    
    // Keep errors list manageable
    if (this.errors.length > 500) {
      this.errors = this.errors.slice(-250);
    }
    
    // Log the error
    this.logger.error(`Tracked error in ${component}`, error, {
      errorId,
      handled,
      ...context
    });
    
    return errorId;
  }
  
  private updateErrorPatterns(error: Error, context: Record<string, any>): void {
    const key = `${error.name}:${error.message}`;
    const pattern = this.errorPatterns.get(key);
    
    if (pattern) {
      pattern.count++;
      pattern.lastOccurrence = new Date();
      pattern.contexts.push(context);
      
      // Keep context history manageable
      if (pattern.contexts.length > 10) {
        pattern.contexts = pattern.contexts.slice(-5);
      }
    } else {
      this.errorPatterns.set(key, {
        pattern: new RegExp(error.message.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
        count: 1,
        lastOccurrence: new Date(),
        contexts: [context]
      });
    }
  }
  
  getError(errorId: string): TrackedError | undefined {
    return this.errors.find(e => e.id === errorId);
  }
  
  getRecentErrors(count: number = 10): TrackedError[] {
    return this.errors.slice(-count);
  }
  
  getCriticalErrors(): TrackedError[] {
    return this.errors.filter(e => 
      !e.handled || 
      e.error.name === 'TypeError' || 
      e.error.name === 'ReferenceError'
    );
  }
  
  getErrorsByComponent(component: string): TrackedError[] {
    return this.errors.filter(e => e.component === component);
  }
  
  getStats(): ErrorStats {
    const errorsByType: Record<string, number> = {};
    const errorsByComponent: Record<string, number> = {};
    
    for (const error of this.errors) {
      // Count by type
      errorsByType[error.error.name] = (errorsByType[error.error.name] || 0) + 1;
      
      // Count by component
      errorsByComponent[error.component] = (errorsByComponent[error.component] || 0) + 1;
    }
    
    return {
      totalErrors: this.errors.length,
      errorsByType,
      errorsByComponent,
      recentErrors: this.getRecentErrors(),
      criticalErrors: this.getCriticalErrors()
    };
  }
  
  getFrequentErrors(threshold: number = 5): Array<{ key: string; pattern: ErrorPattern }> {
    const frequent: Array<{ key: string; pattern: ErrorPattern }> = [];
    
    this.errorPatterns.forEach((pattern, key) => {
      if (pattern.count >= threshold) {
        frequent.push({ key, pattern });
      }
    });
    
    return frequent.sort((a, b) => b.pattern.count - a.pattern.count);
  }
  
  // Create error report for debugging
  generateReport(): string {
    const stats = this.getStats();
    const frequent = this.getFrequentErrors();
    
    const report = [
      '=== Error Report ===',
      `Session ID: ${this.sessionId}`,
      `Total Errors: ${stats.totalErrors}`,
      `Critical Errors: ${stats.criticalErrors.length}`,
      '',
      '=== Errors by Type ===',
      ...Object.entries(stats.errorsByType)
        .sort((a, b) => b[1] - a[1])
        .map(([type, count]) => `${type}: ${count}`),
      '',
      '=== Errors by Component ===',
      ...Object.entries(stats.errorsByComponent)
        .sort((a, b) => b[1] - a[1])
        .map(([component, count]) => `${component}: ${count}`),
      '',
      '=== Frequent Error Patterns ===',
      ...frequent.map(({ key, pattern }) => 
        `${key} (${pattern.count} occurrences, last: ${pattern.lastOccurrence.toISOString()})`
      ),
      '',
      '=== Recent Critical Errors ===',
      ...stats.criticalErrors.slice(-5).map(e => 
        `[${e.timestamp.toISOString()}] ${e.component}: ${e.error.name} - ${e.error.message}`
      )
    ];
    
    return report.join('\n');
  }
  
  logReport(): void {
    this.logger.info('Error Tracking Report', {
      report: this.generateReport()
    });
  }
  
  clearErrors(): void {
    this.errors = [];
    this.errorPatterns.clear();
  }
  
  // Mark error as reported
  markAsReported(errorId: string): void {
    const error = this.errors.find(e => e.id === errorId);
    if (error) {
      error.reportSent = true;
    }
  }
  
  // Export errors for external analysis
  exportErrors(): string {
    return JSON.stringify(this.errors, null, 2);
  }
}