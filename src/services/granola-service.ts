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

export class GranolaService {
  private baseUrl = 'https://api.granola.so/v1'; // Mock URL - replace with actual
  
  constructor(private apiKey: string, private logger: Logger) {}
  
  updateApiKey(apiKey: string) {
    this.apiKey = apiKey;
  }
  
  async testConnection(): Promise<boolean> {
    try {
      // Mock implementation - replace with actual API call
      // In real implementation:
      // const response = await fetch(`${this.baseUrl}/auth/verify`, {
      //   headers: { 'Authorization': `Bearer ${this.apiKey}` }
      // });
      // return response.ok;
      
      // For now, validate API key format
      if (!InputValidator.validateApiKey(this.apiKey)) {
        return false;
      }
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Mock success for valid-looking keys
      return this.apiKey.length > 10;
    } catch (error) {
      this.logger.error('Connection test failed', error);
      return false;
    }
  }
  
  async getMeetingsSince(date: string): Promise<Meeting[]> {
    try {
      this.logger.info(`Fetching meetings since ${date}`);
      
      // Mock implementation - replace with actual API call
      // const response = await fetch(`${this.baseUrl}/meetings?since=${date}`, {
      //   headers: { 'Authorization': `Bearer ${this.apiKey}` }
      // });
      
      // For now, return empty array to make sync work
      const mockResponse: GranolaApiResponse = {
        meetings: [],
        total: 0
      };
      
      return this.transformMeetings(mockResponse.meetings);
    } catch (error) {
      this.logger.error('Failed to fetch meetings', error);
      throw new Error(`Failed to fetch meetings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  async getAllMeetings(): Promise<Meeting[]> {
    try {
      this.logger.info('Fetching all meetings');
      
      const allMeetings: GranolaApiMeeting[] = [];
      let nextPageToken: string | undefined;
      
      // Mock pagination - replace with actual API calls
      do {
        // const url = nextPageToken 
        //   ? `${this.baseUrl}/meetings?pageToken=${nextPageToken}`
        //   : `${this.baseUrl}/meetings`;
        // const response = await fetch(url, {
        //   headers: { 'Authorization': `Bearer ${this.apiKey}` }
        // });
        
        const mockResponse: GranolaApiResponse = {
          meetings: [],
          nextPageToken: undefined,
          total: 0
        };
        
        allMeetings.push(...mockResponse.meetings);
        nextPageToken = mockResponse.nextPageToken;
        
        // Simulate rate limiting
        if (nextPageToken) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } while (nextPageToken);
      
      return this.transformMeetings(allMeetings);
    } catch (error) {
      this.logger.error('Failed to fetch all meetings', error);
      throw new Error(`Failed to fetch meetings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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
}
