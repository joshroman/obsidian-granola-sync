import { Meeting } from '../types';
import { StructuredLogger } from '../utils/structured-logger';
import { PerformanceMonitor } from '../utils/performance-monitor';

export interface ChunkProcessor<T, R> {
  (items: T[]): Promise<R[]>;
}

export interface StreamOptions {
  chunkSize?: number;
  maxConcurrency?: number;
  onProgress?: (processed: number, total: number) => void;
  abortSignal?: AbortSignal;
}

export interface MemoryMonitor {
  checkMemory(): MemoryInfo;
  shouldPauseProcessing(): boolean;
  waitForMemory(): Promise<void>;
}

export interface MemoryInfo {
  used: number;
  total: number;
  percentage: number;
}

export class LargeDatasetHandler {
  private memoryThreshold = 0.8; // 80% memory usage threshold
  private pauseThreshold = 0.9; // 90% pause processing
  
  constructor(
    private logger: StructuredLogger,
    private performanceMonitor: PerformanceMonitor
  ) {}

  /**
   * Process large dataset in chunks with memory management
   */
  async processInChunks<T, R>(
    items: T[],
    processor: ChunkProcessor<T, R>,
    options: StreamOptions = {}
  ): Promise<R[]> {
    const {
      chunkSize = 100,
      maxConcurrency = 3,
      onProgress,
      abortSignal
    } = options;
    
    const operationId = this.performanceMonitor.startOperation('process-large-dataset', {
      totalItems: items.length,
      chunkSize,
      maxConcurrency
    });
    
    try {
      const results: R[] = [];
      const chunks = this.createChunks(items, chunkSize);
      let processedCount = 0;
      
      // Process chunks with concurrency control
      const concurrentProcessor = this.createConcurrentProcessor(maxConcurrency);
      
      for (const chunk of chunks) {
        // Check abort signal
        if (abortSignal?.aborted) {
          throw new Error('Processing aborted');
        }
        
        // Check memory usage
        await this.checkMemoryUsage();
        
        // Process chunk
        const chunkResults = await concurrentProcessor(async () => {
          const operationId = this.performanceMonitor.startOperation('process-chunk', {
            chunkSize: chunk.length
          });
          
          try {
            const result = await processor(chunk);
            this.performanceMonitor.endOperation(operationId, { success: true });
            return result;
          } catch (error) {
            this.performanceMonitor.endOperation(operationId, { 
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
          }
        });
        
        results.push(...chunkResults);
        processedCount += chunk.length;
        
        if (onProgress) {
          onProgress(processedCount, items.length);
        }
        
        // Log progress periodically
        if (processedCount % (chunkSize * 10) === 0 || processedCount === items.length) {
          this.logger.info('Large dataset processing progress', {
            processed: processedCount,
            total: items.length,
            percentage: Math.round((processedCount / items.length) * 100)
          });
        }
      }
      
      this.performanceMonitor.endOperation(operationId, {
        success: true,
        processedItems: processedCount
      });
      
      return results;
      
    } catch (error) {
      this.performanceMonitor.endOperation(operationId, {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Stream process items without loading all into memory
   */
  async *streamProcess<T, R>(
    itemGenerator: AsyncGenerator<T[]>,
    processor: ChunkProcessor<T, R>,
    options: StreamOptions = {}
  ): AsyncGenerator<R[], void, unknown> {
    const { onProgress, abortSignal } = options;
    let processedCount = 0;
    
    for await (const items of itemGenerator) {
      // Check abort signal
      if (abortSignal?.aborted) {
        throw new Error('Processing aborted');
      }
      
      // Check memory usage
      await this.checkMemoryUsage();
      
      // Process items
      const results = await processor(items);
      processedCount += items.length;
      
      if (onProgress) {
        onProgress(processedCount, -1); // Total unknown in streaming
      }
      
      yield results;
    }
  }

  /**
   * Create chunks from array
   */
  private createChunks<T>(items: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    
    for (let i = 0; i < items.length; i += chunkSize) {
      chunks.push(items.slice(i, i + chunkSize));
    }
    
    return chunks;
  }

  /**
   * Create a concurrent processor with concurrency limit
   */
  private createConcurrentProcessor(maxConcurrency: number) {
    const queue: Array<() => Promise<any>> = [];
    let running = 0;
    
    const processNext = async (): Promise<void> => {
      if (queue.length === 0 || running >= maxConcurrency) {
        return;
      }
      
      running++;
      const task = queue.shift()!;
      
      try {
        await task();
      } finally {
        running--;
        processNext();
      }
    };
    
    return async <T>(task: () => Promise<T>): Promise<T> => {
      return new Promise((resolve, reject) => {
        queue.push(async () => {
          try {
            const result = await task();
            resolve(result);
          } catch (error) {
            reject(error);
          }
        });
        
        processNext();
      });
    };
  }

  /**
   * Check memory usage and pause if necessary
   */
  private async checkMemoryUsage(): Promise<void> {
    // In a real implementation, this would check actual memory usage
    // For now, we'll simulate with a simple check
    const memoryInfo = this.getMemoryInfo();
    
    if (memoryInfo.percentage > this.pauseThreshold) {
      this.logger.warn('High memory usage detected, pausing processing', memoryInfo);
      
      // Wait for memory to be available
      await this.waitForMemory();
    } else if (memoryInfo.percentage > this.memoryThreshold) {
      this.logger.warn('Memory usage approaching threshold', memoryInfo);
    }
  }

  /**
   * Get current memory information
   */
  private getMemoryInfo(): MemoryInfo {
    // Simulated memory info - in real implementation would use process.memoryUsage()
    // or performance.memory in browser environment
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage();
      return {
        used: usage.heapUsed,
        total: usage.heapTotal,
        percentage: usage.heapUsed / usage.heapTotal
      };
    }
    
    // Browser environment fallback
    return {
      used: 100 * 1024 * 1024, // 100MB
      total: 500 * 1024 * 1024, // 500MB
      percentage: 0.2
    };
  }

  /**
   * Wait for memory to become available
   */
  private async waitForMemory(): Promise<void> {
    const maxWaitTime = 30000; // 30 seconds
    const checkInterval = 1000; // 1 second
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      const memoryInfo = this.getMemoryInfo();
      
      if (memoryInfo.percentage < this.memoryThreshold) {
        this.logger.info('Memory usage normalized', memoryInfo);
        return;
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }
    
    throw new Error('Memory wait timeout - unable to free sufficient memory');
  }

  /**
   * Split meetings by size for optimal processing
   */
  splitMeetingsBySize(meetings: Meeting[]): {
    small: Meeting[];
    medium: Meeting[];
    large: Meeting[];
  } {
    const small: Meeting[] = [];
    const medium: Meeting[] = [];
    const large: Meeting[] = [];
    
    for (const meeting of meetings) {
      const size = this.estimateMeetingSize(meeting);
      
      if (size < 10 * 1024) { // < 10KB
        small.push(meeting);
      } else if (size < 100 * 1024) { // < 100KB
        medium.push(meeting);
      } else {
        large.push(meeting);
      }
    }
    
    return { small, medium, large };
  }

  /**
   * Estimate meeting size in bytes
   */
  private estimateMeetingSize(meeting: Meeting): number {
    let size = 0;
    
    // Estimate string sizes
    size += (meeting.title || '').length * 2; // UTF-16
    size += (meeting.summary || '').length * 2;
    size += (meeting.transcript || '').length * 2;
    
    // Arrays
    size += (meeting.highlights || []).reduce((sum, h) => sum + h.length * 2, 0);
    size += (meeting.attendees || []).reduce((sum, a) => sum + a.length * 2, 0);
    size += (meeting.tags || []).reduce((sum, t) => sum + t.length * 2, 0);
    
    // Metadata overhead
    size += 1024; // Approximate overhead for object structure
    
    return size;
  }

  /**
   * Create an async generator for batched API calls
   */
  async *createBatchedApiGenerator<T>(
    fetchBatch: (page: number) => Promise<{ data: T[]; hasMore: boolean }>,
    maxPages: number = 1000
  ): AsyncGenerator<T[], void, unknown> {
    let page = 1;
    let hasMore = true;
    
    while (hasMore && page <= maxPages) {
      const operationId = this.performanceMonitor.startOperation('fetch-batch', { page });
      
      try {
        const result = await fetchBatch(page);
        this.performanceMonitor.endOperation(operationId, { 
          success: true,
          itemCount: result.data.length 
        });
        
        yield result.data;
        
        hasMore = result.hasMore;
        page++;
        
      } catch (error) {
        this.performanceMonitor.endOperation(operationId, { 
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        throw error;
      }
    }
    
    if (page > maxPages) {
      this.logger.warn('Reached maximum page limit', { maxPages });
    }
  }
}