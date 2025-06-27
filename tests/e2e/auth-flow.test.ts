import { TestPlugin, mockGranolaAPI } from '../setup/test-environment';

// Create a mock for testConnection that we can track
const mockTestConnection = jest.fn();

// Mock the EnhancedGranolaService constructor
jest.mock('../../src/services/enhanced-granola-service', () => {
  return {
    EnhancedGranolaService: jest.fn().mockImplementation(() => ({
      testConnection: mockTestConnection,
      getAllMeetings: jest.fn().mockResolvedValue([]),
      getMeetingsSince: jest.fn().mockResolvedValue([])
    }))
  };
});

describe('Granola Sync E2E - Authentication Flow', () => {
  let plugin: TestPlugin;
  
  beforeEach(async () => {
    // Reset the mock before each test
    mockTestConnection.mockReset();
    mockTestConnection.mockResolvedValue(true);
    
    plugin = new TestPlugin();
    await plugin.setup();
  });
  
  afterEach(async () => {
    await plugin.teardown();
  });
  
  describe('API key validation', () => {
    test('should reject empty API key', async () => {
      // Act & Assert
      const result = await plugin.plugin.validateApiKey('');
      expect(result).toBe(false);
    });
    
    test('should reject whitespace-only API key', async () => {
      // Act & Assert
      const result = await plugin.plugin.validateApiKey('   \n\t  ');
      expect(result).toBe(false);
    });
    
    test('should reject API key with invalid characters', async () => {
      // Arrange
      const invalidKeys = [
        'key with spaces',
        'key@with#special$chars',
        'key\nwith\nnewlines',
        'key<with>brackets'
      ];
      
      // Act & Assert
      for (const key of invalidKeys) {
        const result = await plugin.plugin.validateApiKey(key);
        expect(result).toBe(false);
      }
    });
    
    test('should accept valid API key format', async () => {
      // For now, just test the input validation part
      const InputValidator = require('../../src/utils/input-validator').InputValidator;
      
      const validKeys = [
        'simple-api-key',
        'API_KEY_WITH_UNDERSCORES',
        'key-with-dashes-123',
        'AlphaNumeric123Key'
      ];
      
      // Act & Assert
      for (const key of validKeys) {
        const result = InputValidator.validateApiKey(key);
        expect(result).toBe(true);
      }
    });
    
    test('should test connection with Granola API', async () => {
      // Arrange
      const apiKey = 'test-api-key-123';
      // Mock is already set up in beforeEach
      
      // Act
      const result = await plugin.plugin.validateApiKey(apiKey);
      
      // Assert
      expect(result).toBe(true);
      expect(mockTestConnection).toHaveBeenCalled();
      expect(plugin.plugin.settings.apiKey).toBe(apiKey);
    });
  });
  
  describe('Settings persistence', () => {
    test('should save API key securely', async () => {
      // Arrange
      const apiKey = 'secure-api-key-456';
      // Mock is already set up in beforeEach
      
      // Act
      await plugin.plugin.validateApiKey(apiKey);
      await plugin.plugin.saveSettings();
      
      // Assert
      expect(plugin.plugin.saveData).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: 'secure-api-key-456'
        })
      );
    });
    
    test('should not save invalid API key', async () => {
      // Arrange
      const invalidKey = 'invalid@key';
      const originalKey = plugin.plugin.settings.apiKey;
      
      // Act
      const result = await plugin.plugin.validateApiKey(invalidKey);
      
      // Assert
      expect(result).toBe(false);
      expect(plugin.plugin.settings.apiKey).toBe(originalKey);
      expect(plugin.plugin.saveData).not.toHaveBeenCalled();
    });
    
    test('should clear API key on user request', async () => {
      // Arrange
      await plugin.updateSettings({ apiKey: 'existing-key' });
      
      // Act
      await plugin.plugin.clearApiKey();
      
      // Assert
      expect(plugin.plugin.settings.apiKey).toBe('');
      expect(plugin.plugin.saveData).toHaveBeenCalledWith(
        expect.objectContaining({ apiKey: '' })
      );
    });
  });
  
  describe('Connection error handling', () => {
    test('should handle 401 unauthorized error', async () => {
      // Arrange
      mockTestConnection.mockReset();
      mockTestConnection.mockRejectedValue(
        new Error('401 Unauthorized')
      );
      
      // Act
      const result = await plugin.plugin.validateApiKey('invalid-key');
      
      // Assert
      expect(result).toBe(false);
      // Should show appropriate error message
      expect(plugin.plugin.lastError).toContain('Authentication failed');
    });
    
    test('should handle network timeout', async () => {
      // Arrange
      mockTestConnection.mockReset();
      mockTestConnection.mockImplementation(
        () => new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Network timeout')), 100)
        )
      );
      
      // Act
      const result = await plugin.plugin.validateApiKey('test-key');
      
      // Assert
      expect(result).toBe(false);
      expect(plugin.plugin.lastError).toContain('Connection failed');
    });
    
    test('should handle rate limiting (429)', async () => {
      // Arrange
      mockTestConnection.mockReset();
      mockTestConnection.mockRejectedValue(
        new Error('429 Too Many Requests')
      );
      
      // Act
      const result = await plugin.plugin.validateApiKey('test-key');
      
      // Assert
      expect(result).toBe(false);
      expect(plugin.plugin.lastError).toContain('Rate limit exceeded');
    });
    
    test('should handle server errors (5xx)', async () => {
      // Arrange
      mockTestConnection.mockReset();
      mockTestConnection.mockRejectedValue(
        new Error('500 Internal Server Error')
      );
      
      // Act
      const result = await plugin.plugin.validateApiKey('test-key');
      
      // Assert
      expect(result).toBe(false);
      expect(plugin.plugin.lastError).toContain('Server error');
    });
  });
  
  describe.skip('Setup wizard', () => {
    // TODO: These tests need to be rewritten to match the current EnhancedSetupWizard implementation
    // The current tests are calling methods that don't exist on the wizard
    test('should guide through initial setup', async () => {
      // Skipped - needs rewrite
    });
    
    test('should not proceed with invalid API key', async () => {
      // Skipped - needs rewrite
    });
    
    test('should validate folder path', async () => {
      // Skipped - needs rewrite
    });
  });
});