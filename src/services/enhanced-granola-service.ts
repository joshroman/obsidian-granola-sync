import { Meeting, DocumentPanel, DocumentPanelsResponse } from '../types';
import { StructuredLogger } from '../utils/structured-logger';
import { PerformanceMonitor } from '../utils/performance-monitor';
import { ErrorTracker } from '../utils/error-tracker';
import { requestUrl, RequestUrlParam } from 'obsidian';
import * as os from 'os';
import pako from 'pako';

export interface APIConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  headers?: Record<string, string>;
  granolaVersion?: string; // Version detected from token file
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
      baseUrl: 'https://api.granola.ai',
      timeout: 30000,
      maxRetries: 3,
      retryDelay: 1000,
      headers: {},
      ...config
    };
  }

  /**
   * Update service configuration without recreating the instance
   * Prevents memory leaks from service recreation
   */
  updateConfig(newConfig: Partial<APIConfig>): void {
    this.config = {
      ...this.config,
      ...newConfig
    };
    this.logger.info('Updated Granola service configuration', {
      hasApiKey: !!this.config.apiKey,
      granolaVersion: this.config.granolaVersion
    });
  }

  async testConnection(): Promise<boolean> {
    const operationId = this.performanceMonitor.startOperation('test-connection');
    
    try {
      console.log('[Granola Plugin Debug] Testing connection with config:', {
        baseUrl: this.config.baseUrl,
        hasApiKey: !!this.config.apiKey,
        apiKeyLength: this.config.apiKey?.length,
        granolaVersion: this.config.granolaVersion
      });
      
      // Use get-feature-flags endpoint for connection test - it's lightweight and takes no params
      const response = await this.makeRequest('/v1/get-feature-flags', {
        method: 'POST',  // All Granola API endpoints use POST
        skipQueue: true  // Skip queue for connection test
        // Note: No body property at all - this will pass undefined for body
      });
      
      console.log('[Granola Plugin Debug] Connection test response:', response);
      
      this.performanceMonitor.endOperation(operationId, { success: true });
      // If we get here without throwing, the connection works
      return true;
    } catch (error) {
      console.error('[Granola Plugin Debug] Test connection error:', error);
      this.performanceMonitor.endOperation(operationId, { success: false });
      this.errorTracker.trackError(
        error instanceof Error ? error : new Error('Unknown error'),
        'api-connection-test',
        { endpoint: '/v1/get-feature-flags' }
      );
      return false;
    }
  }

  async getAllMeetings(): Promise<Meeting[]> {
    return this.performanceMonitor.measureAsync(
      'fetch-all-meetings',
      async () => {
        const meetings: Meeting[] = [];
        let cursor: string | undefined = undefined;
        let hasMore = true;
        
        while (hasMore) {
          // Build filters object - only include cursor if we have one
          const filters: any = { limit: 100 };
          if (cursor) {
            filters.cursor = cursor;
          }
          
          // Use the correct Granola endpoint - documents not meetings
          const response = await this.makeRequest('/v2/get-documents', {
            method: 'POST',
            body: filters  // Pass the filters object
          });
          
          console.log('[Granola Plugin Debug] Documents response:', {
            hasData: !!response,
            hasDocs: !!(response && response.docs),
            docsLength: response?.docs?.length || 0,
            hasNextCursor: !!(response && response.next_cursor)
          });
          
          if (response && response.docs && Array.isArray(response.docs)) {
            const transformedMeetings = await Promise.all(
              response.docs.map((m: any) => this.transformMeeting(m))
            );
            meetings.push(...transformedMeetings);
          }
          
          // Update cursor for next page
          cursor = response?.next_cursor;
          hasMore = !!cursor;
          
          // Safety check to prevent infinite loops
          if (meetings.length > 10000) {
            this.logger.warn('Reached maximum document limit while fetching');
            break;
          }
        }
        
        console.log('[Granola Plugin Debug] Total meetings fetched:', meetings.length);
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
        let cursor: string | undefined = undefined;
        let hasMore = true;
        const sinceDate = new Date(since);
        
        while (hasMore) {
          // Build filters object
          const filters: any = { limit: 100 };
          if (cursor) {
            filters.cursor = cursor;
          }
          
          // Use the correct Granola endpoint with POST method
          const response = await this.makeRequest('/v2/get-documents', {
            method: 'POST',
            body: filters
          });
          
          if (response && response.docs && Array.isArray(response.docs)) {
            // Filter by date on client side since API might not support date filtering
            const filteredDocs = response.docs.filter((doc: any) => {
              const docDate = new Date(doc.created_at || doc.updated_at);
              return docDate >= sinceDate;
            });
            const transformedMeetings = await Promise.all(
              filteredDocs.map((m: any) => this.transformMeeting(m))
            );
            meetings.push(...transformedMeetings);
          }
          
          // Update cursor for next page
          cursor = response?.next_cursor;
          hasMore = !!cursor;
          
          // If we're filtering by date and haven't found any recent docs in this batch,
          // we might want to stop early to avoid fetching old documents
          if (response && response.docs && response.docs.length > 0) {
            const oldestDoc = response.docs[response.docs.length - 1];
            const oldestDate = new Date(oldestDoc.created_at || oldestDoc.updated_at);
            if (oldestDate < sinceDate && meetings.length > 0) {
              // We've gone past our date range and found some meetings
              hasMore = false;
            }
          }
          
          if (meetings.length > 10000) {
            this.logger.warn('Reached maximum document limit while fetching');
            break;
          }
        }
        
        console.log('[Granola Plugin Debug] Meetings since', since, ':', meetings.length);
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
          // Granola doesn't have a single document endpoint
          // For now, we'll return null and log a warning
          // In the future, we might cache documents or implement a different strategy
          this.logger.warn('getMeeting called but Granola API has no single document endpoint', { id });
          
          // Option 1: Return null (fastest, but might break some functionality)
          return null;
          
          // Option 2: Fetch all and filter (commented out for performance reasons)
          // const allDocs = await this.getAllMeetings();
          // const meeting = allDocs.find(m => m.id === id);
          // return meeting || null;
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

  async getDocumentPanels(documentId: string): Promise<DocumentPanel[]> {
    return this.performanceMonitor.measureAsync(
      'fetch-document-panels',
      async () => {
        try {
          this.logger.debug('Fetching panels for document', { documentId });
          
          // Follow the exact same pattern as granola-automation-client
          const response = await this.makeRequest('/v1/get-document-panels', {
            method: 'POST',
            body: { document_id: documentId }
          });
          
          console.log('[Granola Plugin Debug] Panels response:', {
            hasData: !!response,
            responseType: typeof response,
            isArray: Array.isArray(response),
            hasPanels: !!(response && response.panels),
            panelsLength: response?.panels?.length || Array.isArray(response) ? response.length : 0
          });
          
          // The API might return the panels array directly or wrapped in an object
          if (Array.isArray(response)) {
            this.logger.info('Retrieved panels array for document', { 
              documentId, 
              panelCount: response.length,
              panelTitles: response.map((p: DocumentPanel) => p.title)
            });
            return response;
          } else if (response && response.panels && Array.isArray(response.panels)) {
            this.logger.info('Retrieved panels for document', { 
              documentId, 
              panelCount: response.panels.length,
              panelTitles: response.panels.map((p: DocumentPanel) => p.title)
            });
            return response.panels;
          }
          
          return [];
        } catch (error) {
          this.logger.warn('Failed to fetch document panels', { 
            documentId, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
          this.errorTracker.trackError(
            error instanceof Error ? error : new Error('Unknown error'),
            'fetch-document-panels',
            { documentId }
          );
          // Return empty array on failure - graceful degradation
          return [];
        }
      },
      { documentId }
    );
  }

  async getDocumentTranscript(documentId: string): Promise<TranscriptSegment[]> {
    return this.performanceMonitor.measureAsync(
      'fetch-document-transcript',
      async () => {
        try {
          this.logger.debug('Fetching transcript for document', { documentId });
          
          // Follow the exact same pattern as granola-automation-client
          const response = await this.makeRequest('/v1/get-document-transcript', {
            method: 'POST',
            body: { document_id: documentId }
          });
          
          console.log('[Granola Plugin Debug] Transcript response:', {
            hasData: !!response,
            isArray: Array.isArray(response),
            segmentCount: Array.isArray(response) ? response.length : 0
          });
          
          if (Array.isArray(response)) {
            this.logger.info('Retrieved transcript segments for document', { 
              documentId, 
              segmentCount: response.length
            });
            return response as TranscriptSegment[];
          }
          
          return [];
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          this.logger.warn('Failed to fetch document transcript', { 
            documentId, 
            error: errorMessage
          });
          // Return empty array on failure - graceful degradation
          return [];
        }
      },
      { documentId }
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
    // Default to POST for Granola API (all endpoints use POST)
    const { method = 'POST', params, body, skipQueue = false } = options;
    
    // Queue request if not skipping and we have rate limit concerns
    if (!skipQueue && this.shouldQueueRequest()) {
      return this.queueRequest(() => this.makeRequest(path, options));
    }
    
    // For POST requests, params should be in the body, not the URL
    const url = method === 'POST' ? this.buildUrl(path) : this.buildUrl(path, params);
    const headers = {
      'Authorization': `Bearer ${this.config.apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      // Don't set Accept-Encoding - let Obsidian handle it
      'User-Agent': this.getUserAgent(),
      'X-App-Version': this.getGranolaVersion(),
      'X-Client-Type': 'electron',
      'X-Client-Platform': this.getPlatform(),
      'X-Client-Architecture': this.getArchitecture(),
      'X-Client-Id': `granola-${this.config.headers?.['X-Client-Type'] || 'electron'}-${this.getGranolaVersion()}`,
      ...this.config.headers
    };
    
    console.log('[Granola Plugin Debug] EnhancedGranolaService making request to:', url);
    console.log('[Granola Plugin Debug] Method:', method);
    console.log('[Granola Plugin Debug] Body:', body);
    console.log('[Granola Plugin Debug] Request headers:', headers);
    
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        // Use Obsidian's requestUrl instead of fetch for CORS compliance
        const requestOptions: RequestUrlParam = {
          url,
          method,
          headers,
          throw: false, // Don't throw on HTTP errors, we'll handle them
          contentType: null // Important: Don't let Obsidian guess charset to avoid buffer corruption
        };
        
        // Only add body if it's explicitly provided (not undefined)
        // This matches how granola-automation-client handles it
        if (body !== undefined) {
          requestOptions.body = JSON.stringify(body);
        }
        
        console.log('[Granola Plugin Debug] Sending request with Obsidian requestUrl');
        
        let response;
        try {
          response = await requestUrl(requestOptions);
        } catch (requestError) {
          console.error('[Granola Plugin Debug] requestUrl threw an error:', requestError);
          console.error('[Granola Plugin Debug] Request options were:', requestOptions);
          throw requestError;
        }
        
        console.log('[Granola Plugin Debug] Response status:', response.status);
        console.log('[Granola Plugin Debug] Response headers:', response.headers);
        
        // Convert Obsidian's plain object headers to standard Headers instance
        const standardHeaders = new Headers(response.headers as Record<string, string>);
        
        // Update rate limit info
        this.updateRateLimitInfo(standardHeaders);
        
        // Handle rate limiting
        if (response.status === 429) {
          const retryAfter = this.getRetryAfter(standardHeaders);
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
        if (response.status >= 400) {
          let errorMessage = `API error: ${response.status}`;
          let errorDetails = null;
          
          // Try to parse error response body
          try {
            // Check if response is gzipped
            const contentEncoding = response.headers['content-encoding'] || response.headers['Content-Encoding'];
            
            if (contentEncoding === 'gzip' && response.arrayBuffer) {
              // Decompress gzipped error response
              const compressed = new Uint8Array(response.arrayBuffer);
              const decompressed = pako.ungzip(compressed, { to: 'string' });
              errorDetails = JSON.parse(decompressed);
            } else if (response.json && typeof response.json === 'object') {
              errorDetails = response.json;
            } else if (response.text) {
              // Try to parse as JSON first
              try {
                errorDetails = JSON.parse(response.text);
              } catch {
                errorDetails = { message: response.text };
              }
            }
            
            if (errorDetails) {
              if (errorDetails.message) {
                errorMessage = `API error ${response.status}: ${errorDetails.message}`;
              } else if (errorDetails.error) {
                errorMessage = `API error ${response.status}: ${errorDetails.error}`;
              } else {
                errorMessage = `API error ${response.status}: ${JSON.stringify(errorDetails)}`;
              }
            }
          } catch (parseError) {
            console.error('[Granola Plugin Debug] Failed to parse error response:', parseError);
          }
          
          console.error('[Granola Plugin Debug] API error:', {
            status: response.status,
            message: errorMessage,
            errorDetails: errorDetails,
            url: url,
            method: method,
            body: body,
            headers: response.headers
          });
          
          throw new Error(errorMessage);
        }
        
        // Parse successful response
        try {
          // Check if response is gzipped
          const contentEncoding = response.headers['content-encoding'] || response.headers['Content-Encoding'];
          console.log('[Granola Plugin Debug] Content-Encoding:', contentEncoding);
          
          if (contentEncoding === 'gzip') {
            // Response says it's gzipped, but Obsidian might have already decompressed it
            console.log('[Granola Plugin Debug] Response has gzip encoding header');
            
            // First, try to parse response.json directly (Obsidian may have already decompressed)
            if (response.json && typeof response.json === 'object') {
              console.log('[Granola Plugin Debug] Obsidian already decompressed the response');
              return response.json;
            }
            
            // If not, try manual decompression
            console.log('[Granola Plugin Debug] Attempting manual decompression...');
            
            // CRITICAL: Use arrayBuffer directly - do NOT touch response.text!
            if (!response.arrayBuffer) {
              throw new Error('No arrayBuffer available - Obsidian API might be outdated (requires 0.13.25+)');
            }
            
            console.log('[Granola Plugin Debug] ArrayBuffer size:', response.arrayBuffer.byteLength);
            
            // Check if the data looks like it's already JSON (starts with { or [)
            const uint8Array = new Uint8Array(response.arrayBuffer);
            const firstChar = String.fromCharCode(uint8Array[0]);
            
            if (firstChar === '{' || firstChar === '[') {
              console.log('[Granola Plugin Debug] Data appears to be already decompressed JSON');
              const textDecoder = new TextDecoder();
              const jsonString = textDecoder.decode(uint8Array);
              return JSON.parse(jsonString);
            }
            
            // Try gzip decompression
            try {
              const decompressed = pako.ungzip(uint8Array, { to: 'string' });
              console.log('[Granola Plugin Debug] Manual decompression successful, length:', decompressed.length);
              
              // Log first 500 chars to see what we got
              console.log('[Granola Plugin Debug] Decompressed content preview:', decompressed.substring(0, 500));
              
              // Check if it's HTML
              if (decompressed.trim().startsWith('<!DOCTYPE') || decompressed.trim().startsWith('<html')) {
                console.error('[Granola Plugin Debug] Response is HTML, not JSON!');
                throw new Error('API returned HTML instead of JSON - possible authentication or endpoint issue');
              }
              
              // Parse the decompressed JSON
              const jsonData = JSON.parse(decompressed);
              console.log('[Granola Plugin Debug] Successfully parsed JSON data');
              return jsonData;
            } catch (decompressError) {
              console.error('[Granola Plugin Debug] Manual decompression failed:', decompressError);
              
              // Last resort: try to decode as plain text
              try {
                const textDecoder = new TextDecoder();
                const text = textDecoder.decode(uint8Array);
                console.log('[Granola Plugin Debug] Trying plain text decode, preview:', text.substring(0, 200));
                return JSON.parse(text);
              } catch (textError) {
                console.error('[Granola Plugin Debug] Plain text decode also failed:', textError);
                throw new Error(`Failed to process response: ${decompressError.message}`);
              }
            }
          }
          
          // Not gzipped - use normal parsing
          if (response.json) {
            console.log('[Granola Plugin Debug] Using response.json (not gzipped)');
            // Check if response.json is actually JSON or if it's HTML
            if (typeof response.json === 'object' && response.json !== null) {
              return response.json;
            } else {
              console.error('[Granola Plugin Debug] response.json is not an object:', typeof response.json);
              console.error('[Granola Plugin Debug] response.json value:', response.json);
              throw new Error('Response is not valid JSON');
            }
          } else {
            throw new Error('No valid response data available');
          }
        } catch (e) {
          console.error('[Granola Plugin Debug] Failed to parse response:', e);
          console.error('[Granola Plugin Debug] Response object:', {
            hasJson: !!response.json,
            hasText: !!response.text,
            hasArrayBuffer: !!response.arrayBuffer,
            status: response.status,
            headers: response.headers
          });
          throw new Error('Invalid response from API');
        }
        
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


  private transformMeeting(data: any, panels?: DocumentPanel[]): Meeting {
    // Transform Granola document structure to our Meeting interface
    const meeting: Meeting = {
      id: data.id,
      title: data.title || 'Untitled Meeting',
      date: new Date(data.created_at),
      // Use notes_plain for summary if available
      summary: data.notes_plain || data.overview || '',
      // Granola doesn't expose transcript directly in document list
      transcript: '',
      // Extract highlights from notes if available
      highlights: this.extractHighlights(data.notes),
      // Extract attendees from google_calendar_event if available
      attendees: this.extractAttendees(data.google_calendar_event),
      // Duration from google_calendar_event
      duration: this.extractDuration(data.google_calendar_event),
      // Granola uses workspace instead of folder
      granolaFolder: data.workspace_id,
      tags: Array.isArray(data.tags) ? data.tags : [],
      attachments: Array.isArray(data.attachments) ? data.attachments : [],
      updatedAt: data.updated_at ? new Date(data.updated_at) : undefined
    };

    // Extract end time from calendar event
    if (data.google_calendar_event?.end) {
      meeting.endTime = new Date(data.google_calendar_event.end.dateTime || data.google_calendar_event.end.date);
    }

    // Add panels if provided
    if (panels) {
      meeting.panels = panels;
    }

    return meeting;
  }

  private extractHighlights(notes: any): string[] {
    if (!notes || !notes.content) return [];
    // TODO: Parse notes structure to extract highlights
    return [];
  }

  private extractAttendees(event: any): string[] {
    if (!event || !event.attendees) return [];
    return event.attendees.map((a: any) => a.email || a.name || '').filter(Boolean);
  }

  private extractDuration(event: any): number | undefined {
    if (!event || !event.start || !event.end) return undefined;
    const start = new Date(event.start.dateTime || event.start.date);
    const end = new Date(event.end.dateTime || event.end.date);
    return Math.round((end.getTime() - start.getTime()) / 60000); // Duration in minutes
  }

  public isMeetingComplete(meeting: Meeting, graceMinutes: number = 5): boolean {
    // If no end time, consider it complete (ad-hoc meeting)
    if (!meeting.endTime) {
      return true;
    }

    // Check if meeting ended at least graceMinutes ago
    const now = new Date();
    const gracePeriodMs = graceMinutes * 60 * 1000;
    return (now.getTime() - meeting.endTime.getTime()) > gracePeriodMs;
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

  private getGranolaVersion(): string {
    // Use detected version from token file if available, otherwise use known working version
    return this.config.granolaVersion || '6.4.0';
  }

  private getUserAgent(): string {
    // Mimic Granola's Electron user agent exactly
    // The OS version and build are hardcoded to match the working client
    return `Granola/${this.getGranolaVersion()} Electron/33.4.5 Chrome/130.0.6723.191 Node/20.18.3 (macOS 15.3.1 24D70)`;
  }

  private getPlatform(): string {
    const platform = process.platform;
    return platform === 'win32' ? 'win32' : platform;
  }

  private getArchitecture(): string {
    const arch = process.arch;
    return arch === 'x64' ? 'x64' : 'arm64';
  }

  private getOSName(): string {
    const platform = process.platform;
    switch (platform) {
      case 'darwin':
        return 'macOS';
      case 'win32':
        return 'Windows';
      case 'linux':
        return 'Linux';
      default:
        return platform;
    }
  }
}