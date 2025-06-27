import { TestPlugin, generateMockMeeting } from '../setup/test-environment';

describe('Sync Engine E2E Tests', () => {
  let plugin: TestPlugin;
  
  beforeEach(async () => {
    plugin = new TestPlugin();
    await plugin.setup();
  });
  
  afterEach(async () => {
    await plugin.teardown();
  });
  
  test('syncs new meetings without creating duplicates', async () => {
    // Arrange: Create existing meeting in vault
    const meetingDate = new Date('2024-03-20T10:00:00.000Z');
    const meeting = generateMockMeeting({
      id: 'test-meeting-123',
      title: 'Important Meeting',
      date: meetingDate
    });
    
    await plugin.createTestVault({
      'Meetings/2024-03-20 Important Meeting.md': `---
granolaId: test-meeting-123
title: Important Meeting
date: 2024-03-20T10:00:00.000Z
---

# Important Meeting

Meeting content here.`
    });
    
    // Reset the create mock after test vault setup
    (plugin.mockApp.vault.create as jest.Mock).mockClear();
    
    // Update state manager to know about the existing file
    await plugin.plugin.stateManager.rebuildIndex();
    
    // Debug: Check what the state manager knows
    const filePath = plugin.plugin.stateManager.getFilePath('test-meeting-123');
    console.log('State manager file path for test-meeting-123:', filePath);
    
    // Disable conflict detection for this test
    plugin.plugin.syncEngine.setConflictDetection(false);
    
    // Mock API to return same meeting
    plugin.plugin.granolaService.getAllMeetings = jest.fn().mockResolvedValue([meeting]);
    plugin.plugin.granolaService.getMeetingsSince = jest.fn().mockResolvedValue([meeting]);
    plugin.plugin.granolaService.testConnection = jest.fn().mockResolvedValue(true);
    
    // Act: Run the sync operation
    const syncPromise = plugin.plugin.performSync();
    
    // Advance timers to process any pending operations
    jest.advanceTimersByTime(1000);
    
    await syncPromise;
    
    // Assert: Verify no duplicate was created
    const files = plugin.mockApp.vault.getMarkdownFiles();
    expect(files).toHaveLength(1);
    expect(files[0].path).toMatch(/^Meetings\/2024-03-20 Important Meeting/); // Allow for unique suffix
    
    // Verify vault.create was not called (file already exists)
    expect(plugin.mockApp.vault.create).not.toHaveBeenCalled();
  });
  
  test('handles API connection errors gracefully', async () => {
    // Arrange: Mock API to return network error
    const networkError = new Error('Failed to connect to Granola API');
    plugin.plugin.granolaService.testConnection = jest.fn().mockRejectedValue(networkError);
    plugin.plugin.granolaService.getAllMeetings = jest.fn().mockRejectedValue(networkError);
    plugin.plugin.granolaService.getMeetingsSince = jest.fn().mockRejectedValue(networkError);
    
    // Act: Attempt sync
    const result = await plugin.plugin.performSync();
    
    // Advance timers
    jest.advanceTimersByTime(1000);
    
    // Assert: Verify error is handled
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].error).toContain('API error');
    
    // Verify no files were created
    const files = plugin.mockApp.vault.getMarkdownFiles();
    expect(files).toHaveLength(0);
  });
  
  test('respects user file deletions', async () => {
    // Arrange: Create meeting, then mark it as deleted
    const meeting = generateMockMeeting({
      id: 'deleted-meeting-123',
      title: 'Deleted Meeting'
    });
    
    // Initialize state manager first
    await plugin.plugin.stateManager.initialize();
    
    // Add meeting to deleted set without creating file
    // This simulates a file that was previously created and then deleted by user
    (plugin.plugin.stateManager as any).state.deletedIds.add('deleted-meeting-123');
    
    // Mock API to return the deleted meeting
    plugin.plugin.granolaService.getAllMeetings = jest.fn().mockResolvedValue([meeting]);
    plugin.plugin.granolaService.getMeetingsSince = jest.fn().mockResolvedValue([meeting]);
    plugin.plugin.granolaService.testConnection = jest.fn().mockResolvedValue(true);
    
    // Act: Run sync with same meeting from API
    const syncPromise = plugin.plugin.performSync();
    
    // Advance timers to process any pending operations
    jest.advanceTimersByTime(1000);
    
    await syncPromise;
    
    // Assert: Verify meeting is not recreated
    const files = plugin.mockApp.vault.getMarkdownFiles();
    expect(files).toHaveLength(0);
    
    // Verify vault.create was not called
    expect(plugin.mockApp.vault.create).not.toHaveBeenCalled();
    
    // Verify the meeting ID is still in deleted set
    expect(plugin.plugin.stateManager.isDeleted('deleted-meeting-123')).toBe(true);
  });
});
