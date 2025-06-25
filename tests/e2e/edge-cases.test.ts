import { TestPlugin, generateMockMeeting, mockGranolaAPI } from '../setup/test-environment';
import { InputValidator } from '../../src/utils/input-validator';

describe('Granola Sync E2E - Edge Cases', () => {
  let plugin: TestPlugin;
  
  beforeEach(async () => {
    plugin = new TestPlugin();
    await plugin.setup();
    await plugin.updateSettings({ 
      apiKey: 'test-key',
      targetFolder: 'Meetings'
    });
  });
  
  afterEach(async () => {
    await plugin.teardown();
  });
  
  describe('Special characters in titles', () => {
    test('should handle emojis in meeting titles', async () => {
      // Arrange
      const meeting = generateMockMeeting({ 
        title: 'Team Standup 🚀 Daily Check-in 📊'
      });
      mockGranolaAPI.getMeetings.mockResolvedValue([meeting]);
      
      // Act
      await plugin.plugin.syncEngine.sync();
      
      // Assert
      expect(plugin.mockApp.vault.create).toHaveBeenCalledWith(
        expect.stringContaining('Team Standup 🚀 Daily Check-in 📊'),
        expect.any(String)
      );
    });
    
    test('should sanitize path separators in titles', async () => {
      // Arrange
      const meeting = generateMockMeeting({ 
        title: 'Q1/Q2 Review: Budget & Planning'
      });
      mockGranolaAPI.getMeetings.mockResolvedValue([meeting]);
      
      // Act
      await plugin.plugin.syncEngine.sync();
      
      // Assert
      expect(plugin.mockApp.vault.create).toHaveBeenCalledWith(
        expect.stringContaining('Q1Q2 Review Budget & Planning'),
        expect.any(String)
      );
    });
    
    test('should handle Windows reserved names', async () => {
      // Arrange
      const meetings = [
        generateMockMeeting({ title: 'CON' }),
        generateMockMeeting({ title: 'PRN' }),
        generateMockMeeting({ title: 'AUX' })
      ];
      mockGranolaAPI.getMeetings.mockResolvedValue(meetings);
      
      // Act
      await plugin.plugin.syncEngine.sync();
      
      // Assert
      expect(plugin.mockApp.vault.create).toHaveBeenCalledWith(
        expect.stringContaining('_CON'),
        expect.any(String)
      );
      expect(plugin.mockApp.vault.create).toHaveBeenCalledWith(
        expect.stringContaining('_PRN'),
        expect.any(String)
      );
    });
    
    test('should handle very long titles', async () => {
      // Arrange
      const longTitle = 'A'.repeat(300); // Exceeds max length
      const meeting = generateMockMeeting({ title: longTitle });
      mockGranolaAPI.getMeetings.mockResolvedValue([meeting]);
      
      // Act
      await plugin.plugin.syncEngine.sync();
      
      // Assert
      const calls = (plugin.mockApp.vault.create as jest.Mock).mock.calls;
      const createdPath = calls[0][0];
      expect(createdPath.length).toBeLessThanOrEqual(255);
    });
  });
  
  describe('Large data sets', () => {
    test('should handle meeting with 2000+ highlights', async () => {
      // Arrange
      const highlights = Array.from({ length: 2000 }, (_, i) => 
        `Highlight ${i}: Important point discussed in the meeting`
      );
      const meeting = generateMockMeeting({ 
        title: 'Marathon Meeting',
        highlights
      });
      mockGranolaAPI.getMeetings.mockResolvedValue([meeting]);
      
      // Act
      const result = await plugin.plugin.syncEngine.sync();
      
      // Assert
      expect(result.success).toBe(true);
      expect(result.created).toBe(1);
      const content = (plugin.mockApp.vault.create as jest.Mock).mock.calls[0][1];
      expect(content).toContain('## Highlights');
      expect(content.length).toBeGreaterThan(50000); // Large content
    });
    
    test('should handle 10MB+ transcript', async () => {
      // Arrange
      const largeTranscript = 'A'.repeat(10 * 1024 * 1024); // 10MB
      const meeting = generateMockMeeting({ 
        title: 'Long Recording',
        transcript: largeTranscript
      });
      mockGranolaAPI.getMeetings.mockResolvedValue([meeting]);
      
      // Act
      const result = await plugin.plugin.syncEngine.sync();
      
      // Assert
      expect(result.success).toBe(true);
      expect(result.created).toBe(1);
    });
    
    test('should batch process large number of meetings', async () => {
      // Arrange
      const meetings = Array.from({ length: 1000 }, (_, i) => 
        generateMockMeeting({ id: `large-${i}` })
      );
      mockGranolaAPI.getMeetings.mockResolvedValue(meetings);
      
      // Track progress updates
      const progressUpdates: number[] = [];
      // TODO: Implement progress events when sync engine is ready
      // plugin.plugin.syncEngine.on('progress', (progress: any) => {
      //   progressUpdates.push(progress.current);
      // });
      
      // Act
      const result = await plugin.plugin.syncEngine.sync();
      
      // Assert
      expect(result.success).toBe(true);
      expect(result.created).toBe(1000);
      // TODO: Test progress updates when implemented
      // expect(progressUpdates.length).toBeGreaterThan(10); // Multiple progress updates
      // expect(progressUpdates[progressUpdates.length - 1]).toBe(1000);
    });
  });
  
  describe('Concurrent operations', () => {
    test('should handle user edits during sync', async () => {
      // Arrange
      const meeting = generateMockMeeting({ 
        id: 'concurrent-test',
        title: 'Original Title'
      });
      
      // Create existing file
      await plugin.createTestVault({
        'Meetings/Original Title.md': `---
granolaId: concurrent-test
---
# Original Title

User edited content here.`
      });
      
      // Simulate user edit during sync
      plugin.mockApp.vault.modify.mockImplementation(async (file: any, content: any) => {
        // User changes content while sync is happening
        return Promise.resolve();
      });
      
      mockGranolaAPI.getMeetings.mockResolvedValue([{
        ...meeting,
        title: 'Updated Title',
        summary: 'New summary from Granola'
      }]);
      
      // Act
      const result = await plugin.plugin.syncEngine.sync();
      
      // Assert
      expect(result.updated).toBe(1);
      expect(plugin.mockApp.vault.modify).toHaveBeenCalled();
    });
    
    test('should prevent multiple concurrent syncs', async () => {
      // Arrange
      const meetings = Array.from({ length: 100 }, (_, i) => 
        generateMockMeeting({ id: `concurrent-${i}` })
      );
      mockGranolaAPI.getMeetings.mockResolvedValue(meetings);
      
      // Act - Start two syncs simultaneously
      const sync1 = plugin.plugin.syncEngine.sync();
      const sync2 = plugin.plugin.syncEngine.sync();
      
      // Assert
      await expect(sync2).rejects.toThrow('Sync already in progress');
      
      const result1 = await sync1;
      expect(result1.success).toBe(true);
    });
    
    test('should handle plugin reload mid-sync', async () => {
      // Arrange
      const meetings = Array.from({ length: 50 }, (_, i) => 
        generateMockMeeting({ id: `reload-${i}` })
      );
      mockGranolaAPI.getMeetings.mockResolvedValue(meetings);
      
      // Start sync
      const syncPromise = plugin.plugin.syncEngine.sync();
      
      // Simulate plugin reload after some progress
      setTimeout(async () => {
        await plugin.plugin.onunload();
        await plugin.plugin.onload();
      }, 100);
      
      // Act & Assert
      const result = await syncPromise;
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].error).toContain('cancelled');
    });
  });
  
  describe('Time zone handling', () => {
    test('should handle meetings across date boundaries', async () => {
      // Arrange
      const meeting = generateMockMeeting({ 
        title: 'Late Night Meeting',
        date: '2024-01-15T23:30:00-05:00' // 11:30 PM EST
      });
      
      await plugin.updateSettings({
        apiKey: 'test-key',
        targetFolder: 'Meetings',
        folderOrganization: 'by-date',
        dateFolderFormat: 'daily'
      });
      
      mockGranolaAPI.getMeetings.mockResolvedValue([meeting]);
      
      // Act
      await plugin.plugin.syncEngine.sync();
      
      // Assert - Should use local date
      expect(plugin.mockApp.vault.createFolder).toHaveBeenCalledWith(
        expect.stringMatching(/2024-01-1[56]/) // Could be 15th or 16th depending on timezone
      );
    });
    
    test('should handle DST transitions', async () => {
      // Arrange
      const meetings = [
        generateMockMeeting({ 
          title: 'Before DST',
          date: '2024-03-09T10:00:00-05:00' // Day before DST
        }),
        generateMockMeeting({ 
          title: 'After DST',
          date: '2024-03-11T10:00:00-04:00' // Day after DST
        })
      ];
      
      mockGranolaAPI.getMeetings.mockResolvedValue(meetings);
      
      // Act
      await plugin.plugin.syncEngine.sync();
      
      // Assert
      expect(plugin.mockApp.vault.create).toHaveBeenCalledTimes(2);
      // Both meetings should be created successfully despite DST change
    });
  });
  
  describe('Folder organization edge cases', () => {
    test('should handle deeply nested Granola folders', async () => {
      // Arrange
      const deepPath = 'Level1/Level2/Level3/Level4/Level5/Level6/Level7/Level8/Level9/Level10';
      const meeting = generateMockMeeting({ 
        title: 'Deep Meeting',
        granolaFolder: deepPath
      });
      
      await plugin.updateSettings({
        folderOrganization: 'mirror-granola'
      });
      
      mockGranolaAPI.getMeetings.mockResolvedValue([meeting]);
      
      // Act
      await plugin.plugin.syncEngine.sync();
      
      // Assert
      expect(plugin.mockApp.vault.createFolder).toHaveBeenCalledWith(
        `Meetings/${deepPath}`
      );
    });
    
    test('should handle folder names with special characters', async () => {
      // Arrange
      const meeting = generateMockMeeting({ 
        title: 'Project Meeting',
        granolaFolder: 'Work & Personal/Q1:Q2 Planning'
      });
      
      await plugin.updateSettings({
        folderOrganization: 'mirror-granola'
      });
      
      mockGranolaAPI.getMeetings.mockResolvedValue([meeting]);
      
      // Act
      await plugin.plugin.syncEngine.sync();
      
      // Assert
      expect(plugin.mockApp.vault.createFolder).toHaveBeenCalledWith(
        'Meetings/Work & Personal/Q1Q2 Planning'
      );
    });
    
    test('should handle missing Granola folder metadata', async () => {
      // Arrange
      const meeting = generateMockMeeting({ 
        title: 'No Folder Meeting',
        granolaFolder: undefined
      });
      
      await plugin.updateSettings({
        folderOrganization: 'mirror-granola'
      });
      
      mockGranolaAPI.getMeetings.mockResolvedValue([meeting]);
      
      // Act
      await plugin.plugin.syncEngine.sync();
      
      // Assert - Should fall back to root target folder
      expect(plugin.mockApp.vault.create).toHaveBeenCalledWith(
        expect.stringMatching(/^Meetings\/[^\/]+\.md$/),
        expect.any(String)
      );
    });
  });
});