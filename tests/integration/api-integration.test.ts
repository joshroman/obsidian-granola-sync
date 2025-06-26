import { EnhancedGranolaService } from '../../src/services/enhanced-granola-service';
import { SyncEngine } from '../../src/services/sync-engine';
import { SyncStateManager } from '../../src/services/sync-state-manager';
import { PathGenerator } from '../../src/utils/path-generator';
import { StructuredLogger } from '../../src/utils/structured-logger';
import { PerformanceMonitor } from '../../src/utils/performance-monitor';
import { ErrorTracker } from '../../src/utils/error-tracker';
import { Logger } from '../../src/utils/logger';
import { TokenRetrievalService } from '../../src/services/token-retrieval-service';
import { TokenManager } from '../../src/services/token-manager';
import pako from 'pako';

// Mock Obsidian's requestUrl
const mockRequestUrl = jest.fn();
jest.mock('obsidian', () => ({
  requestUrl: mockRequestUrl,
  Plugin: class Plugin {},
  TFile: class TFile {},
  Notice: class Notice {},
}));

describe('Granola API Integration Tests', () => {
  let granolaService: EnhancedGranolaService;
  let mockPlugin: any;
  let mockLogger: StructuredLogger;
  let mockPerformanceMonitor: PerformanceMonitor;
  let mockErrorTracker: ErrorTracker;

  beforeEach(() => {
    // Reset mocks
    mockRequestUrl.mockReset();
    
    // Create mock plugin
    mockPlugin = {
      app: {
        vault: {
          create: jest.fn(),
          modify: jest.fn(),
          getAbstractFileByPath: jest.fn(),
        }
      },
      manifest: { version: '1.0.0' },
      saveData: jest.fn(),
      loadData: jest.fn(),
    };

    // Create mock services
    mockLogger = new StructuredLogger('test', mockPlugin);
    mockPerformanceMonitor = new PerformanceMonitor(mockLogger);
    mockErrorTracker = new ErrorTracker(mockLogger);

    // Spy on console methods
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Gzip Response Handling', () => {
    it('should correctly decompress gzipped API responses', async () => {
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

      // Mock the API response
      mockRequestUrl.mockResolvedValueOnce({
        status: 200,
        headers: {
          'content-encoding': 'gzip',
          'content-type': 'application/json'
        },
        arrayBuffer: compressed.buffer,
        json: undefined, // Gzipped responses don't have json
        text: undefined  // or text properties
      });

      // Create service and test
      granolaService = new EnhancedGranolaService(
        { apiKey: 'test-api-key' },
        mockLogger,
        mockPerformanceMonitor,
        mockErrorTracker
      );

      const result = await granolaService.getAllMeetings();

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
      mockRequestUrl.mockResolvedValueOnce({
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
      mockRequestUrl.mockResolvedValueOnce({
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
        tags: ['planning', 'roadmap']
      };

      const testData = {
        docs: [testMeeting],
        next_cursor: null
      };

      // Compress the response
      const compressed = pako.gzip(JSON.stringify(testData));

      // Mock API response
      mockRequestUrl.mockResolvedValueOnce({
        status: 200,
        headers: {
          'content-encoding': 'gzip',
          'content-type': 'application/json'
        },
        arrayBuffer: compressed.buffer
      });

      // Create services
      granolaService = new EnhancedGranolaService(
        { apiKey: 'test-api-key' },
        mockLogger,
        mockPerformanceMonitor,
        mockErrorTracker
      );

      const stateManager = new SyncStateManager(mockPlugin);
      await stateManager.initialize();

      const pathGenerator = new PathGenerator(() => ({
        targetFolder: 'Meetings',
        fileNamingFormat: 'date-meeting-name',
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

      // Run sync
      const result = await syncEngine.sync();

      // Verify sync completed successfully
      expect(result.success).toBe(true);
      expect(result.created).toBe(1);
      expect(result.errors).toHaveLength(0);

      // Verify file was created with correct path
      expect(mockPlugin.app.vault.create).toHaveBeenCalledWith(
        'Meetings/2025-06-25 Important Team Sync.md',
        expect.stringContaining('# Important Team Sync')
      );

      // Verify markdown content includes key information
      const createdContent = mockPlugin.app.vault.create.mock.calls[0][1];
      expect(createdContent).toContain('Discussion about project roadmap');
      expect(createdContent).toContain('John Doe');
      expect(createdContent).toContain('Jane Smith');
      expect(createdContent).toContain('Duration: 60 minutes');
      expect(createdContent).toContain('#planning');
      expect(createdContent).toContain('#roadmap');
    });
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

      jest.doMock('fs', () => mockFs);
      jest.doMock('os', () => mockOs);

      // Re-import to get mocked version
      const { TokenRetrievalService } = require('../../src/services/token-retrieval-service');
      const tokenService = new TokenRetrievalService(mockPlugin, new Logger(mockPlugin));
      
      const result = await tokenService.retrieveToken();
      
      expect(result.success).toBe(true);
      expect(result.token).toBe('auto-retrieved-token');
      expect(result.metadata?.userEmail).toBe('test@example.com');
    });
  });
});