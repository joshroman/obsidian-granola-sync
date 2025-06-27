import { StructuredLogger } from './structured-logger';
import { PerformanceMonitor } from './performance-monitor';

export interface BatchConfig {
  minSize: number;
  maxSize: number;
  targetDurationMs: number;
  adjustmentFactor: number;
}

export interface BatchResult<T> {
  items: T[];
  duration: number;
  success: boolean;
  error?: Error;
}

export interface BatchStats {
  totalBatches: number;
  totalItems: number;
  averageBatchSize: number;
  averageDuration: number;
  currentBatchSize: number;
  successRate: number;
}

export class AdaptiveBatcher<T> {
  private currentBatchSize: number;
  private batchHistory: Array<{
    size: number;
    duration: number;
    success: boolean;
  }> = [];
  
  private config: BatchConfig = {
    minSize: 1,
    maxSize: 100,
    targetDurationMs: 1000,
    adjustmentFactor: 0.2
  };
  
  constructor(
    private logger: StructuredLogger,
    private performanceMonitor: PerformanceMonitor,
    config?: Partial<BatchConfig>
  ) {
    this.config = { ...this.config, ...config };
    this.currentBatchSize = Math.floor((this.config.minSize + this.config.maxSize) / 2);
  }
  
  async processBatches<R>(
    items: T[],
    processor: (batch: T[]) => Promise<R[]>,
    onProgress?: (processed: number, total: number) => void
  ): Promise<R[]> {
    const results: R[] = [];
    let processedCount = 0;
    
    this.logger.info('Starting adaptive batch processing', {
      totalItems: items.length,
      initialBatchSize: this.currentBatchSize
    });
    
    while (processedCount < items.length) {
      const batchStart = processedCount;
      const batchEnd = Math.min(processedCount + this.currentBatchSize, items.length);
      const batch = items.slice(batchStart, batchEnd);
      
      const batchResult = await this.processBatch(batch, processor);
      
      if (batchResult.success) {
        results.push(...(batchResult.items as R[]));
        processedCount = batchEnd;
        
        if (onProgress) {
          onProgress(processedCount, items.length);
        }
        
        // Adjust batch size based on performance
        this.adjustBatchSize(batchResult.duration);
      } else {
        // On error, try smaller batches
        if (this.currentBatchSize > this.config.minSize) {
          this.currentBatchSize = Math.max(
            this.config.minSize,
            Math.floor(this.currentBatchSize / 2)
          );
          
          this.logger.warn('Batch processing failed, reducing batch size', {
            newSize: this.currentBatchSize,
            error: batchResult.error?.message
          });
        } else {
          // Skip this batch if we're at minimum size
          this.logger.error('Failed to process batch at minimum size', batchResult.error, {
            batchStart,
            batchEnd
          });
          processedCount = batchEnd;
        }
      }
    }
    
    this.logStats();
    
    return results;
  }
  
  private async processBatch<R>(
    batch: T[],
    processor: (batch: T[]) => Promise<R[]>
  ): Promise<BatchResult<R>> {
    const operationId = this.performanceMonitor.startOperation('batch-processing', {
      batchSize: batch.length
    });
    
    try {
      const items = await processor(batch);
      const duration = this.performanceMonitor.endOperation(operationId) || 0;
      
      const result: BatchResult<R> = {
        items,
        duration,
        success: true
      };
      
      this.recordBatch(batch.length, duration, true);
      
      return result;
    } catch (error) {
      const duration = this.performanceMonitor.endOperation(operationId) || 0;
      
      const result: BatchResult<R> = {
        items: [],
        duration,
        success: false,
        error: error instanceof Error ? error : new Error('Unknown error')
      };
      
      this.recordBatch(batch.length, duration, false);
      
      return result;
    }
  }
  
  private recordBatch(size: number, duration: number, success: boolean): void {
    this.batchHistory.push({ size, duration, success });
    
    // Keep history manageable
    if (this.batchHistory.length > 100) {
      this.batchHistory = this.batchHistory.slice(-50);
    }
  }
  
  private adjustBatchSize(lastDuration: number): void {
    const ratio = lastDuration / this.config.targetDurationMs;
    
    if (ratio < 0.8) {
      // Processing was fast, increase batch size
      const increase = Math.ceil(this.currentBatchSize * this.config.adjustmentFactor);
      this.currentBatchSize = Math.min(
        this.currentBatchSize + increase,
        this.config.maxSize
      );
      
      this.logger.debug('Increasing batch size', {
        newSize: this.currentBatchSize,
        duration: lastDuration,
        targetDuration: this.config.targetDurationMs
      });
    } else if (ratio > 1.2) {
      // Processing was slow, decrease batch size
      const decrease = Math.ceil(this.currentBatchSize * this.config.adjustmentFactor);
      this.currentBatchSize = Math.max(
        this.currentBatchSize - decrease,
        this.config.minSize
      );
      
      this.logger.debug('Decreasing batch size', {
        newSize: this.currentBatchSize,
        duration: lastDuration,
        targetDuration: this.config.targetDurationMs
      });
    }
  }
  
  getStats(): BatchStats {
    const successfulBatches = this.batchHistory.filter(b => b.success);
    const totalItems = this.batchHistory.reduce((sum, b) => sum + b.size, 0);
    const totalDuration = successfulBatches.reduce((sum, b) => sum + b.duration, 0);
    
    return {
      totalBatches: this.batchHistory.length,
      totalItems,
      averageBatchSize: totalItems / (this.batchHistory.length || 1),
      averageDuration: totalDuration / (successfulBatches.length || 1),
      currentBatchSize: this.currentBatchSize,
      successRate: successfulBatches.length / (this.batchHistory.length || 1)
    };
  }
  
  private logStats(): void {
    const stats = this.getStats();
    this.logger.info('Batch processing statistics', stats);
  }
  
  reset(): void {
    this.currentBatchSize = Math.floor((this.config.minSize + this.config.maxSize) / 2);
    this.batchHistory = [];
  }
  
  // Get optimal batch size based on history
  getOptimalBatchSize(): number {
    const recentSuccessful = this.batchHistory
      .filter(b => b.success)
      .slice(-20);
    
    if (recentSuccessful.length === 0) {
      return this.currentBatchSize;
    }
    
    // Find batch sizes that performed closest to target duration
    const scored = recentSuccessful.map(b => ({
      size: b.size,
      score: Math.abs(1 - (b.duration / this.config.targetDurationMs))
    }));
    
    scored.sort((a, b) => a.score - b.score);
    
    // Return the best performing size
    return scored[0].size;
  }
}