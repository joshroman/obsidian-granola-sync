import { Meeting } from '../types';
import { InputValidator } from '../utils/input-validator';
import { Logger } from '../utils/logger';

// Mock API response types (will be replaced with actual API types)
interface GranolaApiMeeting {
  id: string;
  title?: string;
  date: string;
  transcript?: string;
  summary?: string;
  highlights?: string[];
  attendees?: string[];
  duration?: number;
  folder?: string;
  tags?: string[];
  attachments?: Array<{
    id: string;
    name: string;
    url: string;
    type: string;
    size: number;
  }>;
}

interface GranolaApiResponse {
  meetings: GranolaApiMeeting[];
  nextPageToken?: string;
  total?: number;
}

interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
}

export class GranolaService {
  private baseUrl = 'https://api.granola.so/v1'; // Mock URL - replace with actual
  private rateLimiter: RateLimiter;
  private defaultRetryOptions: RetryOptions = {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 30000,
    backoffFactor: 2
  };
  
  constructor(private apiKey: string, private logger: Logger) {
    // Initialize rate limiter: 100 requests per minute
    this.rateLimiter = new RateLimiter(100, 60 * 1000);
  }
  
  updateApiKey(apiKey: string) {
    this.apiKey = apiKey;
  }
  
  async testConnection(): Promise<boolean> {
    return this.withRetry(async () => {
      await this.rateLimiter.waitForSlot();
      
      // Mock implementation - replace with actual API call
      // In real implementation:
      // const response = await fetch(`${this.baseUrl}/auth/verify`, {
      //   headers: { 'Authorization': `Bearer ${this.apiKey}` }
      // });
      // return response.ok;
      
      // For now, validate API key format
      if (!InputValidator.validateApiKey(this.apiKey)) {
        throw new Error('Invalid API key format');
      }
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Mock success for valid-looking keys
      if (this.apiKey.length <= 10) {
        throw new Error('Invalid API key');
      }
      
      return true;
    }, { maxRetries: 1 }); // Only retry once for connection test
  }
  
  async getMeetingsSince(date: string): Promise<Meeting[]> {
    return this.withRetry(async () => {
      await this.rateLimiter.waitForSlot();
      
      this.logger.info(`Fetching meetings since ${date}`);
      
      // Mock implementation - replace with actual API call
      // const response = await fetch(`${this.baseUrl}/meetings?since=${date}`, {
      //   headers: { 'Authorization': `Bearer ${this.apiKey}` }
      // });
      // if (!response.ok) {
      //   throw new ApiError(response.status, await response.text());
      // }
      
      // For now, return empty array to make sync work
      const mockResponse: GranolaApiResponse = {
        meetings: [],
        total: 0
      };
      
      return this.transformMeetings(mockResponse.meetings);
    });
  }
  
  async getAllMeetings(): Promise<Meeting[]> {
    return this.withRetry(async () => {
      this.logger.info('Fetching all meetings');
      
      const allMeetings: GranolaApiMeeting[] = [];
      let nextPageToken: string | undefined;
      let pageCount = 0;
      
      // Mock pagination - replace with actual API calls
      do {
        await this.rateLimiter.waitForSlot();
        
        // const url = nextPageToken 
        //   ? `${this.baseUrl}/meetings?pageToken=${nextPageToken}`
        //   : `${this.baseUrl}/meetings`;
        // const response = await fetch(url, {
        //   headers: { 'Authorization': `Bearer ${this.apiKey}` }
        // });
        // if (!response.ok) {
        //   throw new ApiError(response.status, await response.text());
        // }
        
        const mockResponse: GranolaApiResponse = {
          meetings: [],
          nextPageToken: undefined,
          total: 0
        };
        
        allMeetings.push(...mockResponse.meetings);
        nextPageToken = mockResponse.nextPageToken;
        pageCount++;
        
        // Log progress for large datasets
        if (pageCount % 10 === 0) {
          this.logger.info(`Fetched ${pageCount} pages, ${allMeetings.length} meetings so far`);
        }
      } while (nextPageToken);
      
      return this.transformMeetings(allMeetings);
    });
  }
  
  private transformMeetings(apiMeetings: GranolaApiMeeting[]): Meeting[] {
    const meetings: Meeting[] = [];
    
    for (const apiMeeting of apiMeetings) {
      try {
        // Transform API response to our Meeting type
        const meeting: Meeting = {
          id: apiMeeting.id,
          title: apiMeeting.title || 'Untitled Meeting',
          date: new Date(apiMeeting.date),
          transcript: apiMeeting.transcript,
          summary: apiMeeting.summary,
          highlights: apiMeeting.highlights,
          attendees: apiMeeting.attendees,
          duration: apiMeeting.duration,
          granolaFolder: apiMeeting.folder,
          tags: apiMeeting.tags,
          attachments: apiMeeting.attachments
        };
        
        // Validate the transformed meeting
        const validatedMeeting = InputValidator.validateMeetingData(meeting);
        meetings.push(validatedMeeting);
      } catch (error) {
        this.logger.warn(`Skipping invalid meeting ${apiMeeting.id}:`, error);
      }
    }
    
    return meetings;
  }
  
  /**
   * Executes a function with exponential backoff retry logic
   */
  private async withRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    const opts = { ...this.defaultRetryOptions, ...options };
    let lastError: Error | undefined;
    
    for (let attempt = 0; attempt <= opts.maxRetries!; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Don't retry on certain errors
        if (this.isNonRetryableError(lastError)) {
          throw lastError;
        }
        
        if (attempt < opts.maxRetries!) {
          const delay = Math.min(
            opts.initialDelay! * Math.pow(opts.backoffFactor!, attempt),
            opts.maxDelay!
          );
          
          this.logger.warn(
            `Request failed (attempt ${attempt + 1}/${opts.maxRetries! + 1}), ` +
            `retrying in ${delay}ms: ${lastError.message}`
          );
          
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError || new Error('Request failed after retries');
  }
  
  /**
   * Determines if an error should not be retried
   */
  private isNonRetryableError(error: Error): boolean {
    // Don't retry authentication errors or client errors
    if (error.message.includes('401') || error.message.includes('403')) {
      return true;
    }
    
    // Don't retry validation errors
    if (error.message.includes('Invalid') || error.message.includes('validation')) {
      return true;
    }
    
    return false;
  }
}

/**
 * Simple rate limiter using sliding window
 */
class RateLimiter {
  private requests: number[] = [];
  
  constructor(
    private maxRequests: number,
    private windowMs: number
  ) {}
  
  async waitForSlot(): Promise<void> {
    const deadline = Date.now() + 60000; // 1 minute max wait
    
    while (Date.now() < deadline) {
      const now = Date.now();
      
      // Remove old requests outside the window
      this.requests = this.requests.filter(time => now - time < this.windowMs);
      
      // If we have a slot, use it
      if (this.requests.length < this.maxRequests) {
        this.requests.push(now);
        return;
      }
      
      // Calculate wait time until next slot opens
      const oldestRequest = this.requests[0];
      const waitTime = Math.min(
        (oldestRequest + this.windowMs) - now + 100, // Time until slot opens
        1000 // Max 1 second wait per iteration
      );
      
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    
    throw new Error('Rate limit timeout: waited more than 60 seconds for available slot');
  }
}

/**
 * Custom error class for API errors
 */
class ApiError extends Error {
  constructor(
    public statusCode: number,
    public response: string
  ) {
    super(`API error (${statusCode}): ${response}`);
    this.name = 'ApiError';
  }
}
