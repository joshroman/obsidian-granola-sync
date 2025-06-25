import { StructuredLogger } from './structured-logger';

export interface PerformanceMetric {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, any>;
}

export interface PerformanceReport {
  totalOperations: number;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  operationsByType: Record<string, {
    count: number;
    totalDuration: number;
    averageDuration: number;
  }>;
}

export class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetric> = new Map();
  private completedMetrics: PerformanceMetric[] = [];
  private logger: StructuredLogger;
  
  constructor(logger: StructuredLogger) {
    this.logger = logger;
  }
  
  startOperation(name: string, metadata?: Record<string, any>): string {
    const id = `${name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    this.metrics.set(id, {
      name,
      startTime: performance.now(),
      metadata
    });
    
    this.logger.debug(`Performance: Started ${name}`, { operationId: id, ...metadata });
    
    return id;
  }
  
  endOperation(id: string, additionalMetadata?: Record<string, any>): number | null {
    const metric = this.metrics.get(id);
    if (!metric) {
      this.logger.warn(`Performance: Unknown operation ${id}`);
      return null;
    }
    
    metric.endTime = performance.now();
    metric.duration = metric.endTime - metric.startTime;
    
    if (additionalMetadata) {
      metric.metadata = { ...metric.metadata, ...additionalMetadata };
    }
    
    this.completedMetrics.push(metric);
    this.metrics.delete(id);
    
    this.logger.debug(`Performance: Completed ${metric.name}`, {
      operationId: id,
      duration: `${metric.duration.toFixed(2)}ms`,
      ...metric.metadata
    });
    
    // Keep completed metrics list manageable
    if (this.completedMetrics.length > 1000) {
      this.completedMetrics = this.completedMetrics.slice(-500);
    }
    
    return metric.duration;
  }
  
  measureSync<T>(name: string, fn: () => T, metadata?: Record<string, any>): T {
    const id = this.startOperation(name, metadata);
    try {
      const result = fn();
      this.endOperation(id, { success: true });
      return result;
    } catch (error) {
      this.endOperation(id, { success: false, error: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    }
  }
  
  async measureAsync<T>(name: string, fn: () => Promise<T>, metadata?: Record<string, any>): Promise<T> {
    const id = this.startOperation(name, metadata);
    try {
      const result = await fn();
      this.endOperation(id, { success: true });
      return result;
    } catch (error) {
      this.endOperation(id, { success: false, error: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    }
  }
  
  getReport(): PerformanceReport {
    if (this.completedMetrics.length === 0) {
      return {
        totalOperations: 0,
        averageDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        operationsByType: {}
      };
    }
    
    const durations = this.completedMetrics
      .filter(m => m.duration !== undefined)
      .map(m => m.duration!);
    
    const operationsByType: Record<string, { count: number; totalDuration: number; averageDuration: number }> = {};
    
    for (const metric of this.completedMetrics) {
      if (metric.duration === undefined) continue;
      
      if (!operationsByType[metric.name]) {
        operationsByType[metric.name] = {
          count: 0,
          totalDuration: 0,
          averageDuration: 0
        };
      }
      
      operationsByType[metric.name].count++;
      operationsByType[metric.name].totalDuration += metric.duration;
    }
    
    // Calculate averages
    for (const type in operationsByType) {
      const data = operationsByType[type];
      data.averageDuration = data.totalDuration / data.count;
    }
    
    return {
      totalOperations: this.completedMetrics.length,
      averageDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      operationsByType
    };
  }
  
  logReport(): void {
    const report = this.getReport();
    this.logger.info('Performance Report', report);
  }
  
  clear(): void {
    this.metrics.clear();
    this.completedMetrics = [];
  }
  
  // Get slow operations
  getSlowOperations(thresholdMs: number): PerformanceMetric[] {
    return this.completedMetrics
      .filter(m => m.duration !== undefined && m.duration > thresholdMs)
      .sort((a, b) => (b.duration || 0) - (a.duration || 0));
  }
}