import { EnhancedGranolaService } from '../../src/services/enhanced-granola-service';
import { SyncEngine } from '../../src/services/sync-engine';
import { EnhancedStateManager } from '../../src/services/enhanced-state-manager';
import { PathGenerator } from '../../src/utils/path-generator';
import { StructuredLogger } from '../../src/utils/structured-logger';
import { PerformanceMonitor } from '../../src/utils/performance-monitor';
import { ErrorTracker } from '../../src/utils/error-tracker';
import { Logger } from '../../src/utils/logger';
import { TokenRetrievalService } from '../../src/services/token-retrieval-service';
import { TokenManager } from '../../src/services/token-manager';
import pako from 'pako';
import { requestUrl } from 'obsidian';

describe('Granola API Integration Tests', () => {
  let granolaService: EnhancedGranolaService;
  let mockPlugin: any;
  let mockLogger: StructuredLogger;
  let mockPerformanceMonitor: PerformanceMonitor;
  let mockErrorTracker: ErrorTracker;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Create mock plugin
    mockPlugin = {
      app: {
        vault: {
          create: jest.fn(),
          modify: jest.fn(),
          createFolder: jest.fn(),
          getAbstractFileByPath: jest.fn(),
          getMarkdownFiles: jest.fn(() => []),
          on: jest.fn((event, handler) => ({ 
            event, 
            handler,
            unload: jest.fn(),
            ctx: { app: mockPlugin.app }
          })),
          off: jest.fn(),
          offref: jest.fn(),
        },
        metadataCache: {
          getFileCache: jest.fn(),
          on: jest.fn((event, handler) => ({ event, handler })),
          off: jest.fn()
        }
      },
      manifest: { version: '1.0.0' },
      saveData: jest.fn(),
      loadData: jest.fn().mockResolvedValue({}),
      registerEvent: jest.fn((ref) => ref),
      settings: {
        debugMode: true,
        logLevel: 'debug'
      }
    };

    // Create mock services
    mockLogger = new StructuredLogger('test', mockPlugin);
    mockPerformanceMonitor = new PerformanceMonitor(mockLogger);
    mockErrorTracker = new ErrorTracker(mockLogger);

    // Spy on console methods - Comment out to see logs
    // jest.spyOn(console, 'log').mockImplementation();
    // jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Gzip Response Handling', () => {
    it('should correctly decompress gzipped API responses', async () => {
      console.log('=== TEST STARTING: should correctly decompress gzipped API responses ===');
      
      // Create test data
      const testData = {
        docs: [
          {
            id: 'test-meeting-1',
            title: 'Test Meeting',
            created_at: '2025-06-25T10:00:00Z',
            notes_plain: 'Test meeting notes',
            workspace_id: 'test-workspace'
          }
        ],
        next_cursor: null
      };

      // Compress the test data
      const jsonString = JSON.stringify(testData);
      const compressed = pako.gzip(jsonString);

      // Mock the API response for the correct endpoint
      (requestUrl as jest.Mock).mockClear();
      (requestUrl as jest.Mock).mockImplementation((options) => {
        console.log('Test mock called with options:', options);
        if (options && options.url && options.url.includes('/v2/get-documents')) {
          console.log('Returning gzipped response');
          return Promise.resolve({
            status: 200,
            headers: {
              'content-encoding': 'gzip',
              'content-type': 'application/json'
            },
            arrayBuffer: compressed.buffer,
            json: testData, // Obsidian might have already decompressed
            text: JSON.stringify(testData)
          });
        }
        console.log('URL not matched, returning error');
        return Promise.reject(new Error('Unexpected URL: ' + (options ? options.url : 'no options')));
      });

      // Create service and test
      console.log('About to create service, requestUrl mock calls:', (requestUrl as jest.Mock).mock.calls.length);
      granolaService = new EnhancedGranolaService(
        { apiKey: 'test-api-key' },
        mockLogger,
        mockPerformanceMonitor,
        mockErrorTracker
      );

      console.log('About to call getAllMeetings');
      let result;
      try {
        result = await granolaService.getAllMeetings();
      } catch (error) {
        console.error('getAllMeetings error:', error);
        throw error;
      }
      console.log('getAllMeetings returned');

      // Debug output
      console.log('API result:', result);
      console.log('requestUrl calls:', (requestUrl as jest.Mock).mock.calls.length);
      if ((requestUrl as jest.Mock).mock.calls.length > 0) {
        console.log('requestUrl call:', (requestUrl as jest.Mock).mock.calls[0]);
      }

      // Verify the response was decompressed correctly
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('test-meeting-1');
      expect(result[0].title).toBe('Test Meeting');
      expect(result[0].summary).toBe('Test meeting notes');
    });

    it('should handle non-gzipped responses as fallback', async () => {
      const testData = {
        docs: [
          {
            id: 'test-meeting-2',
            title: 'Non-compressed Meeting',
            created_at: '2025-06-25T11:00:00Z',
          }
        ],
        next_cursor: null
      };

      // Mock non-gzipped response
      (requestUrl as jest.Mock).mockResolvedValueOnce({
        status: 200,
        headers: {
          'content-type': 'application/json'
        },
        json: testData,
        text: JSON.stringify(testData),
        arrayBuffer: null
      });

      granolaService = new EnhancedGranolaService(
        { apiKey: 'test-api-key' },
        mockLogger,
        mockPerformanceMonitor,
        mockErrorTracker
      );

      const result = await granolaService.getAllMeetings();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('test-meeting-2');
    });

    it('should handle malformed gzip data gracefully', async () => {
      // Mock response with invalid gzip data
      (requestUrl as jest.Mock).mockResolvedValueOnce({
        status: 200,
        headers: {
          'content-encoding': 'gzip',
        },
        arrayBuffer: new ArrayBuffer(10), // Invalid gzip data
        json: { docs: [], next_cursor: null }, // Fallback data
        text: '{"docs":[],"next_cursor":null}'
      });

      granolaService = new EnhancedGranolaService(
        { apiKey: 'test-api-key' },
        mockLogger,
        mockPerformanceMonitor,
        mockErrorTracker
      );

      const result = await granolaService.getAllMeetings();
      
      // Should fall back to json parsing
      expect(result).toHaveLength(0);
    });
  });

  describe('Full Sync Flow Integration', () => {
    it('should successfully sync a meeting to Obsidian vault', async () => {
      // Create comprehensive test meeting data
      const testMeeting = {
        id: 'full-test-meeting',
        title: 'Important Team Sync',
        created_at: '2025-06-25T14:00:00Z',
        updated_at: '2025-06-25T15:00:00Z',
        notes_plain: 'Discussion about project roadmap',
        notes: {
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Project roadmap discussion' }]
            }
          ]
        },
        google_calendar_event: {
          attendees: [
            { email: 'john@example.com', name: 'John Doe' },
            { email: 'jane@example.com', name: 'Jane Smith' }
          ],
          start: { dateTime: '2025-06-25T14:00:00Z' },
          end: { dateTime: '2025-06-25T15:00:00Z' }
        },
        workspace_id: 'team-workspace',
        tags: ['planning', 'roadmap'],
        // Add fields that might be required by sync engine
        summary: 'Meeting summary about project roadmap planning',
        completed: true, // Mark as completed to ensure it's processed
        template_name: null // Not a template
      };

      const testData = {
        docs: [testMeeting],
        next_cursor: null
      };

      // Compress the response
      const compressed = pako.gzip(JSON.stringify(testData));

      // Clear any previous mocks and set up our specific response
      (requestUrl as jest.Mock).mockClear();
      (requestUrl as jest.Mock).mockImplementation(async (options: any) => {
        console.log('Test mock requestUrl called with:', options.url);
        
        // Return our test data for the get-documents endpoint
        if (options.url && options.url.includes('get-documents')) {
          return {
            status: 200,
            headers: {
              'content-encoding': 'gzip',
              'content-type': 'application/json'
            },
            arrayBuffer: compressed.buffer,
            json: testData,
            text: JSON.stringify(testData)
          };
        }
        
        // Mock response for get-document-panels
        if (options.url && options.url.includes('get-document-panels')) {
          return {
            status: 200,
            headers: { 'content-type': 'application/json' },
            json: { panels: [] },
            text: JSON.stringify({ panels: [] })
          };
        }
        
        // Mock response for get-document-transcript
        if (options.url && options.url.includes('get-document-transcript')) {
          return {
            status: 200,
            headers: { 'content-type': 'application/json' },
            json: { segments: [] },
            text: JSON.stringify({ segments: [] })
          };
        }
        
        // Default response for other endpoints
        return {
          status: 200,
          headers: { 'content-type': 'application/json' },
          json: {},
          text: '{}'
        };
      });

      // Create services
      granolaService = new EnhancedGranolaService(
        { apiKey: 'test-api-key' },
        mockLogger,
        mockPerformanceMonitor,
        mockErrorTracker
      );

      const stateManager = new EnhancedStateManager(mockPlugin, mockLogger);
      await stateManager.initialize();

      const pathGenerator = new PathGenerator(() => ({
        targetFolder: 'Meetings',
        includeDateInFilename: true,
        dateFormat: 'yyyy-MM-dd',
        folderOrganization: 'flat'
      }));

      const syncEngine = new SyncEngine(
        stateManager,
        granolaService,
        pathGenerator,
        mockPlugin,
        new Logger(mockPlugin)
      );

      // Mock vault operations
      mockPlugin.app.vault.getAbstractFileByPath.mockReturnValue(null); // File doesn't exist
      mockPlugin.app.vault.create.mockResolvedValue({});
      mockPlugin.app.vault.createFolder.mockResolvedValue({});

      // Run sync
      const result = await syncEngine.sync();

      // Verify sync completed successfully
      expect(result.success).toBe(true);
      expect(result.created).toBe(1);
      expect(result.errors).toHaveLength(0);

      // Verify file was created
      expect(mockPlugin.app.vault.create).toHaveBeenCalled();
      const createCalls = mockPlugin.app.vault.create.mock.calls;
      
      // The actual path may include a suffix to prevent duplicates
      const createdPath = createCalls[0][0];
      expect(createdPath).toMatch(/^Meetings\/2025-06-25 Important Team Sync/);
      expect(createdPath).toMatch(/\.md$/);
      
      // Check content
      expect(createCalls[0][1]).toContain('# Important Team Sync');

      // Verify markdown content includes key information
      const createdContent = mockPlugin.app.vault.create.mock.calls[0][1];
      expect(createdContent).toContain('Important Team Sync');
      expect(createdContent).toContain('Discussion about project roadmap');
      expect(createdContent).toContain('granolaId: "full-test-meeting"');
    }, 30000); // 30 second timeout
  });

  describe('Automatic Token Retrieval', () => {
    it('should retrieve token from local Granola app', async () => {
      // Mock file system for token file
      const mockFs = {
        existsSync: jest.fn().mockReturnValue(true),
        readFileSync: jest.fn().mockReturnValue(JSON.stringify({
          cognito_tokens: JSON.stringify({
            access_token: 'auto-retrieved-token',
            expires_in: 86400
          }),
          user_info: JSON.stringify({
            email: 'test@example.com'
          })
        }))
      };

      // Mock os.homedir
      const mockOs = {
        homedir: jest.fn().mockReturnValue('/home/test')
      };

      // Clear module cache to ensure fresh imports
      jest.resetModules();
      
      jest.doMock('fs', () => mockFs);
      jest.doMock('os', () => mockOs);

      // Re-import to get mocked version
      const { TokenRetrievalService } = require('../../src/services/token-retrieval-service');
      
      const result = TokenRetrievalService.getTokenInfo();
      
      expect(result).not.toBeNull();
      expect(result?.accessToken).toBe('auto-retrieved-token');
      expect(result?.refreshToken).toBeDefined();
    }, 15000); // 15 second timeout
  });
});