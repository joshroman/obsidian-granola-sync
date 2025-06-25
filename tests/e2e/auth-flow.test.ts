import { TestPlugin, mockGranolaAPI } from '../setup/test-environment';

// Mock GranolaService
const mockTestConnection = jest.fn();
jest.mock('../../src/services/granola-service', () => ({
  default: jest.fn().mockImplementation(() => ({
    testConnection: mockTestConnection,
    getAllMeetings: jest.fn().mockResolvedValue([]),
    getMeetingsSince: jest.fn().mockResolvedValue([])
  }))
}));

describe.skip('Granola Sync E2E - Authentication Flow', () => {
  let plugin: TestPlugin;
  
  beforeEach(async () => {
    plugin = new TestPlugin();
    await plugin.setup();
    // Reset mock for each test
    mockTestConnection.mockReset();
    mockTestConnection.mockResolvedValue(true);
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
      expect(mockGranolaAPI.testConnection).toHaveBeenCalledWith(apiKey);
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
      mockGranolaAPI.testConnection.mockImplementation(
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
      mockTestConnection.mockRejectedValue(
        new Error('429 Too Many Requests')
      );
      
      // Act
      const result = await plugin.plugin.validateApiKey('test-key');
      
      // Assert
      expect(result).toBe(false);
      expect(plugin.plugin.lastError).toContain('Rate limited');
    });
    
    test('should handle server errors (5xx)', async () => {
      // Arrange
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
  
  describe('Setup wizard', () => {
    test('should guide through initial setup', async () => {
      // Arrange
      plugin.plugin.settings.apiKey = '';
      const wizard = plugin.plugin.showSetupWizard();
      
      // Act - Step 1: Welcome
      expect(wizard.currentStep).toBe(0);
      expect(wizard.getStepContent()).toContain('Welcome');
      
      wizard.nextStep();
      
      // Act - Step 2: API Key
      expect(wizard.currentStep).toBe(1);
      expect(wizard.getStepContent()).toContain('API key');
      
      // Mock is already set up in beforeEach
      await wizard.setApiKey('valid-api-key');
      wizard.nextStep();
      
      // Act - Step 3: Folder selection
      expect(wizard.currentStep).toBe(2);
      expect(wizard.getStepContent()).toContain('folder');
      
      wizard.setTargetFolder('My Meetings');
      wizard.nextStep();
      
      // Act - Step 4: Preview/Complete
      expect(wizard.currentStep).toBe(3);
      expect(wizard.getStepContent()).toContain('Ready');
      
      await wizard.complete();
      
      // Assert
      expect(plugin.plugin.settings.apiKey).toBe('valid-api-key');
      expect(plugin.plugin.settings.targetFolder).toBe('My Meetings');
      expect(plugin.plugin.saveData).toHaveBeenCalled();
    });
    
    test('should not proceed with invalid API key', async () => {
      // Arrange
      const wizard = plugin.plugin.showSetupWizard();
      wizard.nextStep(); // Go to API key step
      
      mockGranolaAPI.testConnection.mockResolvedValue(false);
      
      // Act
      await wizard.setApiKey('invalid-key');
      const canProceed = wizard.canProceedToNext();
      
      // Assert
      expect(canProceed).toBe(false);
      expect(wizard.getError()).toContain('Invalid API key');
    });
    
    test('should validate folder path', async () => {
      // Arrange
      const wizard = plugin.plugin.showSetupWizard();
      wizard.currentStep = 2; // Folder selection step
      
      // Act & Assert - Invalid paths
      expect(wizard.validateFolder('../outside')).toBe(false);
      expect(wizard.validateFolder('/absolute/path')).toBe(false);
      expect(wizard.validateFolder('folder\\with\\backslashes')).toBe(false);
      
      // Act & Assert - Valid paths
      expect(wizard.validateFolder('Meetings')).toBe(true);
      expect(wizard.validateFolder('Notes/Meetings')).toBe(true);
      expect(wizard.validateFolder('2024/Work Meetings')).toBe(true);
    });
  });
});