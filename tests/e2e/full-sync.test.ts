import { TestPlugin, generateMockMeeting, mockGranolaAPI } from '../setup/test-environment';
import { Meeting } from '../../src/types';

describe('Granola Sync E2E - Full Sync Workflow', () => {
  let plugin: TestPlugin;
  
  beforeEach(async () => {
    plugin = new TestPlugin();
    await plugin.setup();
    jest.clearAllMocks();
  });
  
  afterEach(async () => {
    await plugin.teardown();
  });
  
  describe('First-time setup', () => {
    test('should show setup wizard on first run without API key', async () => {
      // Arrange
      await plugin.updateSettings({ apiKey: '' });
      
      // Act
      const setupWizard = plugin.plugin.showSetupWizard();
      
      // Assert
      expect(setupWizard).toBeDefined();
      expect(plugin.plugin.settings.apiKey).toBe('');
    });
    
    test('should validate API key before saving', async () => {
      // Arrange
      const invalidKey = 'invalid';
      const validKey = 'valid-api-key-12345';
      mockGranolaAPI.testConnection.mockResolvedValueOnce(false);
      mockGranolaAPI.testConnection.mockResolvedValueOnce(true);
      
      // Act & Assert - Invalid key
      const result1 = await plugin.plugin.validateApiKey(invalidKey);
      expect(result1).toBe(false);
      expect(plugin.plugin.settings.apiKey).toBe('');
      
      // Act & Assert - Valid key
      const result2 = await plugin.plugin.validateApiKey(validKey);
      expect(result2).toBe(true);
    });
  });
  
  describe('Sync operations', () => {
    beforeEach(async () => {
      await plugin.updateSettings({ 
        apiKey: 'test-key',
        targetFolder: 'Meetings'
      });
    });
    
    test('should sync 100 meetings successfully', async () => {
      // Arrange
      const meetings: Meeting[] = Array.from({ length: 100 }, (_, i) => 
        generateMockMeeting({
          id: `meeting-${i}`,
          title: `Meeting ${i}`,
          date: new Date(2024, 0, i + 1).toISOString()
        })
      );
      mockGranolaAPI.getMeetings.mockResolvedValue(meetings);
      
      // Act
      const startTime = Date.now();
      const result = await plugin.plugin.syncEngine.sync();
      const duration = Date.now() - startTime;
      
      // Assert
      expect(result.success).toBe(true);
      expect(result.created).toBe(100);
      expect(result.updated).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(duration).toBeLessThan(10000); // Should complete in under 10 seconds
      
      // Verify files were created
      const files = plugin.mockApp.vault.getMarkdownFiles();
      expect(files).toHaveLength(100);
    });
    
    test('should handle network interruption gracefully', async () => {
      // Arrange
      const meetings = Array.from({ length: 50 }, (_, i) => 
        generateMockMeeting({ id: `meeting-${i}` })
      );
      
      // Mock network failure after 25 meetings
      let callCount = 0;
      mockGranolaAPI.getMeetings.mockImplementation(async () => {
        if (callCount++ === 0) {
          return meetings.slice(0, 25);
        }
        throw new Error('Network error');
      });
      
      // Act - First sync (partial)
      const result1 = await plugin.plugin.syncEngine.sync();
      
      // Assert partial sync
      expect(result1.success).toBe(false);
      expect(result1.created).toBe(25);
      expect(result1.errors.length).toBeGreaterThan(0);
      
      // Act - Resume sync
      mockGranolaAPI.getMeetings.mockResolvedValue(meetings);
      const result2 = await plugin.plugin.syncEngine.sync();
      
      // Assert completed sync
      expect(result2.success).toBe(true);
      expect(result2.created).toBe(25); // Only new ones
      expect(result2.updated).toBe(25); // Previously synced ones checked
    });
    
    test('should prevent duplicate meetings', async () => {
      // Arrange
      const meeting = generateMockMeeting({ 
        id: 'test-123',
        title: 'Important Meeting'
      });
      
      // Create existing file with same granola ID
      await plugin.createTestVault({
        'Meetings/2024-01-01 Important Meeting.md': `---
granolaId: test-123
date: 2024-01-01
---

# Important Meeting

Existing content that should not be duplicated.`
      });
      
      mockGranolaAPI.getMeetings.mockResolvedValue([meeting]);
      
      // Act
      const result = await plugin.plugin.syncEngine.sync();
      
      // Assert
      expect(result.created).toBe(0);
      expect(result.updated).toBe(0);
      expect(result.skipped).toBe(1);
      
      const files = plugin.mockApp.vault.getMarkdownFiles();
      expect(files).toHaveLength(1);
    });
    
    test('should respect user deletions', async () => {
      // Arrange
      const meeting = generateMockMeeting({ id: 'deleted-meeting' });
      
      // Simulate user deleted a previously synced meeting
      plugin.plugin.stateManager.addFile('deleted-meeting', 'Meetings/Deleted Meeting.md');
      plugin.plugin.stateManager.isDeleted = jest.fn().mockReturnValue(true);
      
      mockGranolaAPI.getMeetings.mockResolvedValue([meeting]);
      
      // Act
      const result = await plugin.plugin.syncEngine.sync();
      
      // Assert
      expect(result.created).toBe(0);
      expect(result.skipped).toBe(1);
      expect(plugin.mockApp.vault.create).not.toHaveBeenCalled();
    });
  });
  
  describe('Folder organization', () => {
    test('should organize files in flat structure', async () => {
      // Arrange
      await plugin.updateSettings({
        apiKey: 'test-key',
        targetFolder: 'Meetings',
        folderOrganization: 'flat'
      });
      
      const meetings = [
        generateMockMeeting({ title: 'Meeting 1', date: '2024-01-01' }),
        generateMockMeeting({ title: 'Meeting 2', date: '2024-02-15' })
      ];
      mockGranolaAPI.getMeetings.mockResolvedValue(meetings);
      
      // Act
      await plugin.plugin.syncEngine.sync();
      
      // Assert
      expect(plugin.mockApp.vault.create).toHaveBeenCalledWith(
        'Meetings/2024-01-01 Meeting 1.md',
        expect.any(String)
      );
      expect(plugin.mockApp.vault.create).toHaveBeenCalledWith(
        'Meetings/2024-02-15 Meeting 2.md',
        expect.any(String)
      );
    });
    
    test('should organize files by date (daily)', async () => {
      // Arrange
      await plugin.updateSettings({
        apiKey: 'test-key',
        targetFolder: 'Meetings',
        folderOrganization: 'by-date',
        dateFolderFormat: 'daily'
      });
      
      const meetings = [
        generateMockMeeting({ title: 'Morning Standup', date: '2024-01-15' }),
        generateMockMeeting({ title: 'Afternoon Review', date: '2024-01-15' }),
        generateMockMeeting({ title: 'Next Day Meeting', date: '2024-01-16' })
      ];
      mockGranolaAPI.getMeetings.mockResolvedValue(meetings);
      
      // Act
      await plugin.plugin.syncEngine.sync();
      
      // Assert
      expect(plugin.mockApp.vault.createFolder).toHaveBeenCalledWith('Meetings/2024-01-15');
      expect(plugin.mockApp.vault.createFolder).toHaveBeenCalledWith('Meetings/2024-01-16');
      expect(plugin.mockApp.vault.create).toHaveBeenCalledWith(
        'Meetings/2024-01-15/2024-01-15 Morning Standup.md',
        expect.any(String)
      );
    });
    
    test('should organize files by date (weekly)', async () => {
      // Arrange
      await plugin.updateSettings({
        apiKey: 'test-key',
        targetFolder: 'Meetings',
        folderOrganization: 'by-date',
        dateFolderFormat: 'weekly'
      });
      
      const meetings = [
        generateMockMeeting({ title: 'Week 3 Planning', date: '2024-01-15' }), // Week 3
        generateMockMeeting({ title: 'Week 4 Retro', date: '2024-01-22' })    // Week 4
      ];
      mockGranolaAPI.getMeetings.mockResolvedValue(meetings);
      
      // Act
      await plugin.plugin.syncEngine.sync();
      
      // Assert
      expect(plugin.mockApp.vault.createFolder).toHaveBeenCalledWith('Meetings/2024-W03');
      expect(plugin.mockApp.vault.createFolder).toHaveBeenCalledWith('Meetings/2024-W04');
    });
    
    test('should mirror Granola folder structure', async () => {
      // Arrange
      await plugin.updateSettings({
        apiKey: 'test-key',
        targetFolder: 'Meetings',
        folderOrganization: 'mirror-granola'
      });
      
      const meetings = [
        generateMockMeeting({ 
          title: 'Project Planning',
          granolaFolder: 'Work/ProjectX'
        }),
        generateMockMeeting({ 
          title: 'Team Standup',
          granolaFolder: 'Work/Daily'
        })
      ];
      mockGranolaAPI.getMeetings.mockResolvedValue(meetings);
      
      // Act
      await plugin.plugin.syncEngine.sync();
      
      // Assert
      expect(plugin.mockApp.vault.createFolder).toHaveBeenCalledWith('Meetings/Work/ProjectX');
      expect(plugin.mockApp.vault.createFolder).toHaveBeenCalledWith('Meetings/Work/Daily');
      expect(plugin.mockApp.vault.create).toHaveBeenCalledWith(
        expect.stringContaining('Work/ProjectX'),
        expect.any(String)
      );
    });
  });
  
  describe('File naming', () => {
    test('should name files with meeting name only', async () => {
      // Arrange
      await plugin.updateSettings({
        apiKey: 'test-key',
        fileNamingFormat: 'meeting-name'
      });
      
      const meeting = generateMockMeeting({ 
        title: 'Quarterly Review',
        date: '2024-03-15'
      });
      mockGranolaAPI.getMeetings.mockResolvedValue([meeting]);
      
      // Act
      await plugin.plugin.syncEngine.sync();
      
      // Assert
      expect(plugin.mockApp.vault.create).toHaveBeenCalledWith(
        'Meetings/Quarterly Review.md',
        expect.any(String)
      );
    });
    
    test('should name files with date prefix', async () => {
      // Arrange
      await plugin.updateSettings({
        apiKey: 'test-key',
        fileNamingFormat: 'date-meeting-name',
        dateFormat: 'yyyy-MM-dd'
      });
      
      const meeting = generateMockMeeting({ 
        title: 'Budget Planning',
        date: '2024-03-15'
      });
      mockGranolaAPI.getMeetings.mockResolvedValue([meeting]);
      
      // Act
      await plugin.plugin.syncEngine.sync();
      
      // Assert
      expect(plugin.mockApp.vault.create).toHaveBeenCalledWith(
        'Meetings/2024-03-15 Budget Planning.md',
        expect.any(String)
      );
    });
  });
});