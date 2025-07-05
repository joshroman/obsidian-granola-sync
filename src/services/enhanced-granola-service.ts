import { Meeting, DocumentPanel, DocumentPanelsResponse, TranscriptSegment, PeopleResponse, FeatureFlagsResponse, NotionIntegrationResponse, SubscriptionsResponse, FeatureFlag } from '../types';
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
  private loggedMeetingData = false;
  
  constructor(
    config: APIConfig,
    private logger: StructuredLogger,
    private performanceMonitor: PerformanceMonitor,
    private errorTracker: ErrorTracker
  ) {
    this.config = {
      apiKey: config.apiKey,
      baseUrl: config.baseUrl || 'https://api.granola.ai',
      timeout: config.timeout || 30000,
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 1000,
      headers: config.headers || {},
      granolaVersion: config.granolaVersion || '6.4.0'
    } as Required<APIConfig>;
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
      this.logger.debug('Testing connection', {
        baseUrl: this.config.baseUrl,
        hasApiKey: !!this.config.apiKey,
        granolaVersion: this.config.granolaVersion
      });
      
      // Use get-feature-flags endpoint for connection test - it's lightweight and takes no params
      const response = await this.makeRequest('/v1/get-feature-flags', {
        method: 'POST',  // All Granola API endpoints use POST
        skipQueue: true  // Skip queue for connection test
        // Note: No body property at all - this will pass undefined for body
      });
      
      this.logger.debug('Connection test successful', {
        responseReceived: !!response,
        responseType: typeof response
      });
      
      this.performanceMonitor.endOperation(operationId, { success: true });
      // If we get here without throwing, the connection works
      return true;
    } catch (error) {
      this.logger.warn('Connection test failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
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
        
        this.logger.debug('Starting getAllMeetings operation');
        
        try {
          while (hasMore) {
          // Build filters object - only include cursor if we have one
          const filters: any = { limit: 100 };
          if (cursor) {
            filters.cursor = cursor;
          }
          
          this.logger.debug('Making documents request', {
            hasFilters: !!filters,
            limit: filters?.limit,
            hasCursor: !!filters?.cursor
          });
          
          // Use the correct Granola endpoint - documents not meetings
          const response = await this.makeRequest('/v2/get-documents', {
            method: 'POST',
            body: filters  // Pass the filters object
          });
          
          this.logger.debug('Documents response received', {
            hasData: !!response,
            docsLength: response?.docs?.length || 0,
            hasNextCursor: !!(response && response.next_cursor)
          });
          
          if (response && response.docs && Array.isArray(response.docs)) {
            this.logger.debug('Processing documents batch', {
              documentCount: response.docs.length
            });
            const transformedMeetings = await Promise.all(
              response.docs.map((m: any) => this.transformMeeting(m))
            );
            meetings.push(...transformedMeetings);
            this.logger.debug('Progress update', {
              totalMeetings: meetings.length
            });
          } else {
            this.logger.debug('No documents in response or invalid format');
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
        
        this.logger.info('Completed getAllMeetings operation', {
          totalMeetings: meetings.length
        });
        return meetings;
        } catch (error) {
          this.logger.error('Error in getAllMeetings operation', 
            error instanceof Error ? error : new Error('Unknown error'));
          throw error;
        }
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
        
        this.logger.info('Completed getMeetingsSince operation', {
          sinceDate: since,
          meetingCount: meetings.length
        });
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
  
  async debugMeetingData(): Promise<void> {
    // Fetch just a few meetings to see their full data structure
    const response = await this.makeRequest('/v2/get-documents', {
      method: 'POST',
      body: { limit: 3 }
    });
    
    if (response && response.docs && response.docs.length > 0) {
      const doc = response.docs[0];
      this.logger.debug('Document structure analysis', {
        type: doc.type,
        hasChapters: !!doc.chapters,
        hasPeople: !!doc.people,
        hasNotes: !!doc.notes,
        fieldCount: Object.keys(doc).length
      });
      
      // Log summary info about specific fields without exposing sensitive data
      if (doc.chapters) {
        this.logger.debug('Chapters found', { chapterCount: doc.chapters.length || 0 });
      }
      if (doc.people) {
        this.logger.debug('People found', { peopleCount: doc.people.length || 0 });
      }
    }
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
          
          this.logger.debug('Panels response received', {
            hasData: !!response,
            responseType: typeof response,
            isArray: Array.isArray(response),
            panelsLength: response?.panels?.length || (Array.isArray(response) ? response.length : 0)
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
          
          this.logger.debug('Transcript response received', {
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

  /**
   * Retrieve people data from Granola API.
   * @returns Array of people in the user's network
   * @example
   * ```ts
   * const people = await service.getPeople();
   * logger.info(`Found ${people.length} people`);
   * for (const person of people) {
   *   logger.info(`${person.name} (${person.email}) - ${person.company_name || 'No company'}`);
   * }
   * ```
   */
  async getPeople(): Promise<PeopleResponse> {
    return this.performanceMonitor.measureAsync(
      'fetch-people',
      async () => {
        try {
          this.logger.debug('Fetching people data');
          
          const response = await this.makeRequest('/v1/get-people', {
            method: 'POST'
          });
          
          this.logger.debug('People response received', {
            hasData: !!response,
            isArray: Array.isArray(response),
            peopleCount: Array.isArray(response) ? response.length : 0
          });
          
          if (Array.isArray(response)) {
            this.logger.info('Retrieved people data', { 
              peopleCount: response.length
            });
            return response as PeopleResponse;
          }
          
          return [];
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          this.logger.warn('Failed to fetch people data', { 
            error: errorMessage
          });
          this.errorTracker.trackError(
            error instanceof Error ? error : new Error('Unknown error'),
            'fetch-people'
          );
          // Return empty array on failure - graceful degradation
          return [];
        }
      }
    );
  }

  /**
   * Retrieve feature flags for the user.
   * @returns Array of feature flag settings
   * @example
   * ```ts
   * const featureFlags = await service.getFeatureFlags();
   * const newFeature = featureFlags.find(f => f.feature === 'newFeature');
   * if (newFeature && newFeature.value) {
   *   // Use new feature
   * }
   * ```
   */
  async getFeatureFlags(): Promise<FeatureFlagsResponse> {
    return this.performanceMonitor.measureAsync(
      'fetch-feature-flags',
      async () => {
        try {
          this.logger.debug('Fetching feature flags');
          
          const response = await this.makeRequest('/v1/get-feature-flags', {
            method: 'POST'
          });
          
          this.logger.debug('Feature flags response received', {
            hasData: !!response,
            isArray: Array.isArray(response),
            flagCount: Array.isArray(response) ? response.length : 0
          });
          
          if (Array.isArray(response)) {
            this.logger.info('Retrieved feature flags', { 
              flagCount: response.length
            });
            return response as FeatureFlagsResponse;
          }
          
          return [];
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          this.logger.warn('Failed to fetch feature flags', { 
            error: errorMessage
          });
          this.errorTracker.trackError(
            error instanceof Error ? error : new Error('Unknown error'),
            'fetch-feature-flags'
          );
          // Return empty array on failure - graceful degradation
          return [];
        }
      }
    );
  }

  /**
   * Retrieve feature flags as a map (legacy format for backward compatibility).
   * @returns Object with feature names as keys and values as flags
   * @example
   * ```ts
   * const flagsMap = await service.getFeatureFlagsMap();
   * if (flagsMap.newFeature) {
   *   // Use new feature
   * }
   * ```
   */
  async getFeatureFlagsMap(): Promise<Record<string, boolean | string | number | object>> {
    const flags = await this.getFeatureFlags();
    return Object.fromEntries(flags.map(f => [f.feature, f.value]));
  }

  /**
   * Retrieve Notion integration details.
   * @returns Information about the user's Notion integration
   * @example
   * ```ts
   * const notion = await service.getNotionIntegration();
   * if (notion.isConnected) {
   *   logger.info('Notion is connected');
   *   logger.info('Workspaces:', Object.values(notion.integrations).map(i => i.workspace_name));
   * }
   * ```
   */
  async getNotionIntegration(): Promise<NotionIntegrationResponse | null> {
    return this.performanceMonitor.measureAsync(
      'fetch-notion-integration',
      async () => {
        try {
          this.logger.debug('Fetching Notion integration details');
          
          const response = await this.makeRequest('/v1/get-notion-integration', {
            method: 'POST'
          });
          
          this.logger.debug('Notion integration response received', {
            hasData: !!response,
            isConnected: response?.isConnected,
            canIntegrate: response?.canIntegrate,
            integrationCount: response?.integrations ? Object.keys(response.integrations).length : 0
          });
          
          if (response && typeof response === 'object') {
            this.logger.info('Retrieved Notion integration details', { 
              isConnected: response.isConnected,
              canIntegrate: response.canIntegrate
            });
            return response as NotionIntegrationResponse;
          }
          
          return null;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          this.logger.warn('Failed to fetch Notion integration details', { 
            error: errorMessage
          });
          this.errorTracker.trackError(
            error instanceof Error ? error : new Error('Unknown error'),
            'fetch-notion-integration'
          );
          // Return null on failure
          return null;
        }
      }
    );
  }

  /**
   * Retrieve subscription information for the user.
   * @returns Details about the user's subscription plans
   * @example
   * ```ts
   * const subscriptions = await service.getSubscriptions();
   * logger.info(`Active plan: ${subscriptions.active_plan_id}`);
   * for (const plan of subscriptions.subscription_plans) {
   *   logger.info(`Available plan: ${plan.display_name} (${plan.type}) - $${plan.price.monthly}/month`);
   * }
   * ```
   */
  async getSubscriptions(): Promise<SubscriptionsResponse | null> {
    return this.performanceMonitor.measureAsync(
      'fetch-subscriptions',
      async () => {
        try {
          this.logger.debug('Fetching subscription information');
          
          const response = await this.makeRequest('/v1/get-subscriptions', {
            method: 'POST'
          });
          
          this.logger.debug('Subscriptions response received', {
            hasData: !!response,
            hasActivePlan: !!response?.active_plan_id,
            planCount: response?.subscription_plans ? response.subscription_plans.length : 0
          });
          
          if (response && typeof response === 'object' && response.active_plan_id) {
            this.logger.info('Retrieved subscription information', { 
              activePlanId: response.active_plan_id,
              planCount: response.subscription_plans?.length || 0
            });
            return response as SubscriptionsResponse;
          }
          
          return null;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          this.logger.warn('Failed to fetch subscription information', { 
            error: errorMessage
          });
          this.errorTracker.trackError(
            error instanceof Error ? error : new Error('Unknown error'),
            'fetch-subscriptions'
          );
          // Return null on failure
          return null;
        }
      }
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
    
    this.logger.debug('Making API request', {
      url: url.replace(/Bearer [^&]+/g, 'Bearer [REDACTED]'),
      method,
      hasBody: body !== undefined,
      hasAuthHeader: !!headers.Authorization
    });
    
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        // Use Obsidian's requestUrl instead of fetch for CORS compliance
        const requestOptions: RequestUrlParam = {
          url,
          method,
          headers,
          throw: false, // Don't throw on HTTP errors, we'll handle them
          contentType: undefined // Important: Don't let Obsidian guess charset to avoid buffer corruption
        };
        
        // Only add body if it's explicitly provided (not undefined)
        // This matches how granola-automation-client handles it
        if (body !== undefined) {
          requestOptions.body = JSON.stringify(body);
        }
        
        this.logger.debug('Sending request with Obsidian requestUrl');
        
        let response;
        try {
          response = await requestUrl(requestOptions);
        } catch (requestError) {
          this.logger.error('RequestUrl threw an error',
            requestError instanceof Error ? requestError : new Error('Unknown error'),
            {
              url: url.replace(/Bearer [^&]+/g, 'Bearer [REDACTED]'),
              method
            });
          throw requestError;
        }
        
        this.logger.debug('Response received', {
          status: response.status,
          hasHeaders: !!response.headers,
          contentType: response.headers?.['content-type']
        });
        
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
            this.logger.warn('Failed to parse error response', {
              error: parseError instanceof Error ? parseError.message : 'Unknown error'
            });
          }
          
          this.logger.warn('API error encountered', {
            status: response.status,
            message: errorMessage,
            url: url.replace(/Bearer [^&]+/g, 'Bearer [REDACTED]'),
            method
          });
          
          throw new Error(errorMessage);
        }
        
        // Parse successful response using helper methods
        try {
          return await this.parseApiResponse(response);
        } catch (e) {
          this.logger.error('Failed to parse response',
            e instanceof Error ? e : new Error('Unknown error'),
            {
              hasJson: !!response.json,
              hasText: !!response.text,
              hasArrayBuffer: !!response.arrayBuffer,
              status: response.status
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

  /**
   * Parse API response handling various content encodings and formats
   */
  private async parseApiResponse(response: any): Promise<any> {
    const contentEncoding = response.headers['content-encoding'] || response.headers['Content-Encoding'];
    
    this.logger.debug('Processing response', {
      contentEncoding: contentEncoding || 'none'
    });
    
    if (contentEncoding === 'gzip') {
      return this.parseGzippedResponse(response);
    }
    
    return this.parseUncompressedResponse(response);
  }

  /**
   * Handle gzipped response parsing with fallback strategies
   */
  private parseGzippedResponse(response: any): any {
    this.logger.debug('Response has gzip encoding header');
    
    // First, try to parse response.json directly (Obsidian may have already decompressed)
    if (response.json && typeof response.json === 'object') {
      this.logger.debug('Obsidian already decompressed the response');
      return response.json;
    }
    
    // If not, try manual decompression
    return this.manuallyDecompressResponse(response);
  }

  /**
   * Manually decompress gzipped response data
   */
  private manuallyDecompressResponse(response: any): any {
    this.logger.debug('Attempting manual decompression');
    
    if (!response.arrayBuffer) {
      throw new Error('No arrayBuffer available - Obsidian API might be outdated (requires 0.13.25+)');
    }
    
    this.logger.debug('Processing response buffer', {
      bufferSize: response.arrayBuffer.byteLength
    });
    
    const uint8Array = new Uint8Array(response.arrayBuffer);
    
    // Check if data is already decompressed JSON
    if (this.isAlreadyDecompressed(uint8Array)) {
      return this.parseDecompressedBuffer(uint8Array);
    }
    
    // Try gzip decompression
    return this.attemptGzipDecompression(uint8Array);
  }

  /**
   * Check if buffer data appears to already be decompressed JSON
   */
  private isAlreadyDecompressed(uint8Array: Uint8Array): boolean {
    const firstChar = String.fromCharCode(uint8Array[0]);
    return firstChar === '{' || firstChar === '[';
  }

  /**
   * Parse buffer that's already decompressed JSON
   */
  private parseDecompressedBuffer(uint8Array: Uint8Array): any {
    this.logger.debug('Data appears to be already decompressed JSON');
    const textDecoder = new TextDecoder();
    const jsonString = textDecoder.decode(uint8Array);
    return JSON.parse(jsonString);
  }

  /**
   * Attempt gzip decompression with fallback to plain text
   */
  private attemptGzipDecompression(uint8Array: Uint8Array): any {
    try {
      const decompressed = pako.ungzip(uint8Array, { to: 'string' });
      
      this.logger.debug('Manual decompression successful', {
        decompressedLength: decompressed.length
      });
      
      this.validateDecompressedContent(decompressed);
      
      const jsonData = JSON.parse(decompressed);
      this.logger.debug('Successfully parsed JSON data');
      return jsonData;
    } catch (decompressError) {
      this.logger.warn('Manual decompression failed', {
        error: decompressError instanceof Error ? decompressError.message : 'Unknown error'
      });
      
      return this.fallbackToPlainText(uint8Array, decompressError);
    }
  }

  /**
   * Validate that decompressed content is not HTML
   */
  private validateDecompressedContent(decompressed: string): void {
    const trimmed = decompressed.trim();
    const isHtml = trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html');
    
    this.logger.debug('Decompressed content analysis', {
      contentLength: decompressed.length,
      isHtml
    });
    
    if (isHtml) {
      this.logger.error('Response is HTML, not JSON - possible authentication or endpoint issue');
      throw new Error('API returned HTML instead of JSON - possible authentication or endpoint issue');
    }
  }

  /**
   * Fallback to plain text decoding when gzip fails
   */
  private fallbackToPlainText(uint8Array: Uint8Array, originalError: any): any {
    try {
      const textDecoder = new TextDecoder();
      const text = textDecoder.decode(uint8Array);
      
      this.logger.debug('Trying plain text decode fallback', {
        textLength: text.length
      });
      
      return JSON.parse(text);
    } catch (textError) {
      this.logger.error('Plain text decode also failed',
        textError instanceof Error ? textError : new Error('Unknown error'));
      
      const errorMessage = originalError instanceof Error ? originalError.message : String(originalError);
      throw new Error(`Failed to process response: ${errorMessage}`);
    }
  }

  /**
   * Parse uncompressed response (normal JSON or text/plain)
   */
  private parseUncompressedResponse(response: any): any {
    if (response.json) {
      this.logger.debug('Using response.json (not gzipped)');
      
      if (typeof response.json === 'object' && response.json !== null) {
        return response.json;
      } else {
        this.logger.error('response.json is not an object', undefined, {
          responseType: typeof response.json
        });
        throw new Error('Response is not valid JSON');
      }
    }
    
    if (response.text) {
      return this.parseTextResponse(response.text);
    }
    
    throw new Error('No valid response data available');
  }

  /**
   * Parse text/plain response that contains JSON (Granola API fix)
   */
  private parseTextResponse(text: string): any {
    this.logger.debug('Attempting to parse text response as JSON');
    
    try {
      const parsedJson = JSON.parse(text);
      this.logger.debug('Successfully parsed text as JSON');
      return parsedJson;
    } catch (parseError) {
      this.logger.error('Failed to parse text as JSON',
        parseError instanceof Error ? parseError : new Error('Unknown error'));
      
      const errorMessage = parseError instanceof Error ? parseError.message : String(parseError);
      throw new Error(`Invalid JSON in text response: ${errorMessage}`);
    }
  }

  private transformMeeting(data: any, panels?: DocumentPanel[]): Meeting {
    // Log only for the first few meetings to understand the data structure
    if (!this.loggedMeetingData) {
      this.loggedMeetingData = true;
      this.logger.debug('Sample document structure analysis', {
        id: data.id,
        hasTitle: !!data.title,
        hasWorkspace: !!(data.workspace_id || data.workspace_name),
        type: data.type,
        hasChapters: !!data.chapters,
        hasPeople: !!data.people,
        fieldCount: Object.keys(data).length
      });
    }
    
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
      // Log workspace data to debug folder organization
      granolaFolder: (() => {
        const folder = data.workspace_id || data.workspace_name || data.workspace || data.folder || '';
        if (!folder && this.loggedMeetingData) {
          this.logger.debug('No workspace/folder data found', {
            fieldCount: Object.keys(data).length
          });
        }
        return folder ? this.formatWorkspaceName(folder) : '';
      })(),
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

  public isMeetingComplete(meeting: Meeting): boolean {
    // Temporarily always return true to debug the sync issue
    // TODO: Revert this after debugging
    
    this.logger.debug(`Meeting "${meeting.title}" completion check - temporarily returning true for all meetings`);
    
    return true;
    
    // Original logic commented out for debugging:
    // Granola applies the automatic default template when a meeting is marked as complete
    // If the meeting has a summary or notes, it means Granola has processed it
    // This is a more reliable indicator than checking calendar end times
    
    // const hasContent = !!(meeting.summary && meeting.summary.trim().length > 0);
    
    // this.logger.debug(`Meeting "${meeting.title}" completion check`, {
    //   hasContent,
    //   summaryLength: meeting.summary?.length || 0,
    //   hasSummary: !!meeting.summary
    // });
    
    // If the meeting has content (summary/notes), Granola has processed it as complete
    // return hasContent;
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
  
  private formatWorkspaceName(workspaceId: string): string {
    // Convert workspace ID to a more user-friendly folder name
    // e.g., "workspace-123" -> "Workspace 123", "my-workspace" -> "My Workspace"
    return workspaceId
      .split(/[-_]/)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
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