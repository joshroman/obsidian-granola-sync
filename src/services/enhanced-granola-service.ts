import { Meeting } from '../types';
import { StructuredLogger } from '../utils/structured-logger';
import { PerformanceMonitor } from '../utils/performance-monitor';
import { ErrorTracker } from '../utils/error-tracker';

export interface APIConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  headers?: Record<string, string>;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: Date;
}

export class EnhancedGranolaService {
  private config: Required<APIConfig>;
  private rateLimitInfo: RateLimitInfo | null = null;
  private requestQueue: Array<() => Promise<any>> = [];
  private isProcessingQueue = false;
  
  constructor(
    config: APIConfig,
    private logger: StructuredLogger,
    private performanceMonitor: PerformanceMonitor,
    private errorTracker: ErrorTracker
  ) {
    this.config = {
      baseUrl: 'https://api.granola.so/v1',
      timeout: 30000,
      maxRetries: 3,
      retryDelay: 1000,
      headers: {},
      ...config
    };
  }

  async testConnection(): Promise<boolean> {
    const operationId = this.performanceMonitor.startOperation('test-connection');
    
    try {
      const response = await this.makeRequest('/health', {
        method: 'GET',
        skipQueue: true // Health checks bypass queue
      });
      
      this.performanceMonitor.endOperation(operationId, { success: true });
      return response.status === 'ok';
    } catch (error) {
      this.performanceMonitor.endOperation(operationId, { success: false });
      this.errorTracker.trackError(
        error instanceof Error ? error : new Error('Unknown error'),
        'api-connection-test',
        { endpoint: '/health' }
      );
      return false;
    }
  }

  async getAllMeetings(): Promise<Meeting[]> {
    return this.performanceMonitor.measureAsync(
      'fetch-all-meetings',
      async () => {
        const meetings: Meeting[] = [];
        let page = 1;
        let hasMore = true;
        
        while (hasMore) {
          const response = await this.makeRequest('/meetings', {
            params: { page, limit: 100 }
          });
          
          if (response.data && Array.isArray(response.data)) {
            meetings.push(...response.data.map((m: any) => this.transformMeeting(m)));
          }
          
          hasMore = response.hasMore || false;
          page++;
          
          // Safety check to prevent infinite loops
          if (page > 100) {
            this.logger.warn('Reached maximum page limit while fetching meetings');
            break;
          }
        }
        
        return meetings;
      },
      { type: 'all' }
    );
  }

  async getMeetingsSince(since: string): Promise<Meeting[]> {
    return this.performanceMonitor.measureAsync(
      'fetch-meetings-since',
      async () => {
        const meetings: Meeting[] = [];
        let page = 1;
        let hasMore = true;
        
        while (hasMore) {
          const response = await this.makeRequest('/meetings', {
            params: { 
              since,
              page, 
              limit: 100 
            }
          });
          
          if (response.data && Array.isArray(response.data)) {
            meetings.push(...response.data.map((m: any) => this.transformMeeting(m)));
          }
          
          hasMore = response.hasMore || false;
          page++;
          
          if (page > 100) {
            this.logger.warn('Reached maximum page limit while fetching meetings');
            break;
          }
        }
        
        return meetings;
      },
      { type: 'incremental', since }
    );
  }

  async getMeeting(id: string): Promise<Meeting | null> {
    return this.performanceMonitor.measureAsync(
      'fetch-single-meeting',
      async () => {
        try {
          const response = await this.makeRequest(`/meetings/${id}`);
          return response.data ? this.transformMeeting(response.data) : null;
        } catch (error) {
          if (this.isNotFoundError(error)) {
            return null;
          }
          throw error;
        }
      },
      { meetingId: id }
    );
  }

  private async makeRequest(
    path: string,
    options: {
      method?: string;
      params?: Record<string, any>;
      body?: any;
      skipQueue?: boolean;
    } = {}
  ): Promise<any> {
    const { method = 'GET', params, body, skipQueue = false } = options;
    
    // Queue request if not skipping and we have rate limit concerns
    if (!skipQueue && this.shouldQueueRequest()) {
      return this.queueRequest(() => this.makeRequest(path, options));
    }
    
    const url = this.buildUrl(path, params);
    const headers = {
      'Authorization': `Bearer ${this.config.apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'ObsidianGranolaSync/1.0',
      ...this.config.headers
    };
    
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);
        
        const response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        // Update rate limit info
        this.updateRateLimitInfo(response.headers);
        
        // Handle rate limiting
        if (response.status === 429) {
          const retryAfter = this.getRetryAfter(response.headers);
          this.logger.warn('Rate limited by API', {
            retryAfter,
            endpoint: path
          });
          
          if (attempt < this.config.maxRetries) {
            await this.delay(retryAfter);
            continue;
          }
        }
        
        // Handle errors
        if (!response.ok) {
          const errorData = await this.parseErrorResponse(response);
          throw new Error(errorData.message || `API error: ${response.status}`);
        }
        
        // Parse successful response
        return await response.json();
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        // Don't retry on client errors (4xx except 429)
        if (this.isClientError(lastError) && !this.isRateLimitError(lastError)) {
          throw lastError;
        }
        
        // Log retry attempt
        if (attempt < this.config.maxRetries) {
          this.logger.warn('API request failed, retrying', {
            attempt: attempt + 1,
            maxRetries: this.config.maxRetries,
            error: lastError.message,
            endpoint: path
          });
          
          await this.delay(this.config.retryDelay * Math.pow(2, attempt));
        }
      }
    }
    
    // All retries exhausted
    const finalError = lastError || new Error('Max retries exceeded');
    this.errorTracker.trackError(
      finalError,
      'api-request-failed',
      {
        endpoint: path,
        method,
        retriesExhausted: true
      }
    );
    
    throw finalError;
  }

  private buildUrl(path: string, params?: Record<string, any>): string {
    const url = new URL(path, this.config.baseUrl);
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }
    
    return url.toString();
  }

  private updateRateLimitInfo(headers: Headers): void {
    const limit = headers.get('X-RateLimit-Limit');
    const remaining = headers.get('X-RateLimit-Remaining');
    const reset = headers.get('X-RateLimit-Reset');
    
    if (limit && remaining && reset) {
      this.rateLimitInfo = {
        limit: parseInt(limit, 10),
        remaining: parseInt(remaining, 10),
        reset: new Date(parseInt(reset, 10) * 1000)
      };
      
      this.logger.debug('Rate limit updated', this.rateLimitInfo);
    }
  }

  private getRetryAfter(headers: Headers): number {
    const retryAfter = headers.get('Retry-After');
    if (!retryAfter) {
      return this.config.retryDelay;
    }
    
    // Check if it's a number (seconds) or date
    const seconds = parseInt(retryAfter, 10);
    if (!isNaN(seconds)) {
      return seconds * 1000;
    }
    
    // Try to parse as date
    const date = new Date(retryAfter);
    if (!isNaN(date.getTime())) {
      return Math.max(0, date.getTime() - Date.now());
    }
    
    return this.config.retryDelay;
  }

  private shouldQueueRequest(): boolean {
    if (!this.rateLimitInfo) {
      return false;
    }
    
    // Queue if we're close to the limit
    const threshold = Math.max(1, Math.floor(this.rateLimitInfo.limit * 0.1));
    return this.rateLimitInfo.remaining <= threshold;
  }

  private async queueRequest<T>(request: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          const result = await request();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      
      if (!this.isProcessingQueue) {
        this.processQueue();
      }
    });
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }
    
    this.isProcessingQueue = true;
    
    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift();
      if (request) {
        await request();
        
        // Add delay between queued requests
        if (this.requestQueue.length > 0) {
          await this.delay(100);
        }
      }
    }
    
    this.isProcessingQueue = false;
  }

  private async parseErrorResponse(response: Response): Promise<any> {
    try {
      const text = await response.text();
      return JSON.parse(text);
    } catch {
      return {
        message: `HTTP ${response.status}: ${response.statusText}`,
        status: response.status
      };
    }
  }

  private transformMeeting(data: any): Meeting {
    return {
      id: data.id,
      title: data.title || 'Untitled Meeting',
      date: new Date(data.date || data.created_at),
      summary: data.summary || '',
      transcript: data.transcript || '',
      highlights: Array.isArray(data.highlights) ? data.highlights : [],
      attendees: Array.isArray(data.attendees) ? data.attendees : [],
      duration: data.duration,
      granolaFolder: data.folder,
      tags: Array.isArray(data.tags) ? data.tags : [],
      attachments: Array.isArray(data.attachments) ? data.attachments : []
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private isNotFoundError(error: any): boolean {
    return error instanceof Error && 
           (error.message.includes('404') || error.message.includes('not found'));
  }

  private isClientError(error: Error): boolean {
    return error.message.includes('4') && 
           !error.message.includes('429');
  }

  private isRateLimitError(error: Error): boolean {
    return error.message.includes('429') || 
           error.message.toLowerCase().includes('rate limit');
  }

  getRateLimitInfo(): RateLimitInfo | null {
    return this.rateLimitInfo;
  }

  clearRateLimitInfo(): void {
    this.rateLimitInfo = null;
  }
}