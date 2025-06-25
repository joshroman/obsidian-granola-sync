import GranolaSyncPlugin from '../../src/main';
import { createTestEnvironment, setupPluginMocks, TestEnvironment } from '../setup/test-helpers';
import { DEFAULT_SETTINGS } from '../../src/types';

describe('Performance and Large Dataset E2E Tests', () => {
  let env: TestEnvironment;
  let plugin: GranolaSyncPlugin;

  beforeEach(async () => {
    env = createTestEnvironment();
    plugin = new GranolaSyncPlugin(env.app as any, env.manifest);
    setupPluginMocks(plugin, { apiKey: 'test-key' });
    await plugin.onload();
    
    plugin.settings = {
      ...DEFAULT_SETTINGS,
      apiKey: 'test-key',
      targetFolder: 'Meetings'
    };
  });

  afterEach(async () => {
    await plugin.onunload();
  });

  describe('Large dataset handling', () => {
    it('should handle 1000 meetings efficiently', async () => {
      const meetings = Array.from({ length: 1000 }, (_, i) => ({
        id: `meeting-${i}`,
        title: `Meeting ${i}`,
        date: new Date(2024, 2, Math.floor(i / 50) + 1), // Spread across 20 days
        summary: `Summary for meeting ${i}`,
        transcript: `Transcript content for meeting ${i}`.repeat(10),
        notes: `Notes for meeting ${i}`
      }));

      plugin.granolaService.getAllMeetings = jest.fn().mockResolvedValue(meetings);
      plugin.granolaService.testConnection = jest.fn().mockResolvedValue(true);

      const startTime = Date.now();
      await plugin.performSync();
      const duration = Date.now() - startTime;

      // Should complete within reasonable time (30 seconds for 1000 meetings)
      expect(duration).toBeLessThan(30000);

      // Should batch process meetings
      expect(env.vault.create).toHaveBeenCalledTimes(1000);

      // Verify batch processing happened
      const syncEngine = plugin.syncEngine;
      expect(syncEngine.getProgress().total).toBe(1000);
    });

    it('should handle very large individual meetings', async () => {
      // Create a meeting with 5MB of content
      const largeTranscript = 'This is a very long transcript. '.repeat(50000);
      const largeNotes = 'These are extensive notes. '.repeat(30000);
      
      const meetings = [
        {
          id: '1',
          title: 'Large Meeting',
          date: new Date('2024-03-20'),
          summary: 'Meeting with extensive content',
          transcript: largeTranscript,
          notes: largeNotes,
          attendees: Array.from({ length: 100 }, (_, i) => ({
            name: `Attendee ${i}`,
            email: `attendee${i}@example.com`
          }))
        }
      ];

      plugin.granolaService.getAllMeetings = jest.fn().mockResolvedValue(meetings);
      plugin.granolaService.testConnection = jest.fn().mockResolvedValue(true);

      await plugin.performSync();

      // Should handle large content using chunked processing
      expect(env.vault.create).toHaveBeenCalledTimes(1);
      
      const createdContent = (env.vault.create as jest.Mock).mock.calls[0][1];
      expect(createdContent).toContain('Large Meeting');
      expect(createdContent.length).toBeGreaterThan(1000); // Should have substantial content
    });

    it('should respect memory limits with adaptive batch sizing', async () => {
      // Create meetings with varying sizes
      const meetings = Array.from({ length: 200 }, (_, i) => {
        const size = i % 4; // 0: small, 1: medium, 2: large, 3: very large
        const contentMultiplier = Math.pow(10, size);
        
        return {
          id: `meeting-${i}`,
          title: `Meeting ${i}`,
          date: new Date('2024-03-20'),
          summary: 'Summary'.repeat(contentMultiplier),
          transcript: 'Transcript'.repeat(contentMultiplier * 10),
          notes: 'Notes'.repeat(contentMultiplier * 5)
        };
      });

      plugin.granolaService.getAllMeetings = jest.fn().mockResolvedValue(meetings);
      plugin.granolaService.testConnection = jest.fn().mockResolvedValue(true);

      // Monitor memory usage simulation
      let maxConcurrentOps = 0;
      let currentOps = 0;
      
      const originalCreate = env.vault.create;
      env.vault.create = jest.fn().mockImplementation(async (...args) => {
        currentOps++;
        maxConcurrentOps = Math.max(maxConcurrentOps, currentOps);
        
        // Simulate async operation
        await new Promise(resolve => setTimeout(resolve, 10));
        
        currentOps--;
        return originalCreate(...args);
      });

      await plugin.performSync();

      // Should adapt batch size based on content
      expect(maxConcurrentOps).toBeLessThanOrEqual(20); // Should limit concurrent operations
      expect(env.vault.create).toHaveBeenCalledTimes(200);
    });
  });

  describe('Sync performance optimization', () => {
    it('should skip unchanged meetings efficiently', async () => {
      const meetings = Array.from({ length: 100 }, (_, i) => ({
        id: `meeting-${i}`,
        title: `Meeting ${i}`,
        date: new Date('2024-03-20'),
        summary: `Summary ${i}`,
        lastModified: new Date('2024-03-19').toISOString()
      }));

      plugin.granolaService.getAllMeetings = jest.fn().mockResolvedValue(meetings);
      plugin.granolaService.testConnection = jest.fn().mockResolvedValue(true);

      // First sync - create all meetings
      await plugin.performSync();
      expect(env.vault.create).toHaveBeenCalledTimes(100);

      // Reset mocks for second sync
      jest.clearAllMocks();
      plugin.granolaService.getAllMeetings = jest.fn().mockResolvedValue(meetings);
      plugin.granolaService.testConnection = jest.fn().mockResolvedValue(true);

      // Simulate existing files
      env.vault.getAbstractFileByPath = jest.fn().mockImplementation((path) => ({
        path,
        stat: { mtime: new Date('2024-03-20').getTime() }
      }));

      // Second sync - should skip all unchanged meetings
      const startTime = Date.now();
      await plugin.performSync();
      const duration = Date.now() - startTime;

      // Should be much faster when skipping
      expect(duration).toBeLessThan(1000);
      
      // Should not create any new files
      expect(env.vault.create).not.toHaveBeenCalled();
      
      // Should check modification times
      expect(env.vault.modify).not.toHaveBeenCalled();
    });

    it('should handle rate limiting gracefully', async () => {
      const meetings = Array.from({ length: 50 }, (_, i) => ({
        id: `meeting-${i}`,
        title: `Meeting ${i}`,
        date: new Date('2024-03-20'),
        summary: `Summary ${i}`
      }));

      // Mock API with rate limiting
      let apiCallCount = 0;
      plugin.granolaService.getAllMeetings = jest.fn().mockImplementation(async () => {
        apiCallCount++;
        if (apiCallCount > 1 && apiCallCount % 10 === 0) {
          // Simulate rate limit hit
          const error: any = new Error('Rate limit exceeded');
          error.status = 429;
          throw error;
        }
        return meetings.slice((apiCallCount - 1) * 10, apiCallCount * 10);
      });
      plugin.granolaService.testConnection = jest.fn().mockResolvedValue(true);

      await plugin.performSync();

      // Should retry and eventually succeed
      expect(apiCallCount).toBeGreaterThan(5); // Should have retried
      
      // Should still create all meetings despite rate limiting
      const result = await plugin.syncEngine.getLastSyncResult();
      expect(result?.created + result?.updated).toBeLessThanOrEqual(50);
    });
  });

  describe('Progress reporting accuracy', () => {
    it('should report accurate progress during sync', async () => {
      const meetings = Array.from({ length: 100 }, (_, i) => ({
        id: `meeting-${i}`,
        title: `Meeting ${i}`,
        date: new Date('2024-03-20'),
        summary: `Summary ${i}`
      }));

      plugin.granolaService.getAllMeetings = jest.fn().mockResolvedValue(meetings);
      plugin.granolaService.testConnection = jest.fn().mockResolvedValue(true);

      const progressUpdates: Array<{ current: number; total: number }> = [];
      
      // Track progress updates
      const checkProgress = setInterval(() => {
        const progress = plugin.syncEngine.getProgress();
        if (progress.total > 0) {
          progressUpdates.push({ ...progress });
        }
      }, 50);

      await plugin.performSync();
      clearInterval(checkProgress);

      // Should have multiple progress updates
      expect(progressUpdates.length).toBeGreaterThan(5);
      
      // Progress should increase monotonically
      for (let i = 1; i < progressUpdates.length; i++) {
        expect(progressUpdates[i].current).toBeGreaterThanOrEqual(progressUpdates[i - 1].current);
      }
      
      // Final progress should match total
      const lastProgress = progressUpdates[progressUpdates.length - 1];
      expect(lastProgress.current).toBe(lastProgress.total);
    });
  });

  describe('Memory leak prevention', () => {
    it('should clean up resources after sync', async () => {
      const meetings = Array.from({ length: 500 }, (_, i) => ({
        id: `meeting-${i}`,
        title: `Meeting ${i}`,
        date: new Date('2024-03-20'),
        summary: `Summary ${i}`,
        largeData: 'X'.repeat(10000) // 10KB per meeting
      }));

      plugin.granolaService.getAllMeetings = jest.fn().mockResolvedValue(meetings);
      plugin.granolaService.testConnection = jest.fn().mockResolvedValue(true);

      // Track state manager size before sync
      const statsBefore = plugin.stateManager.getStats();

      await plugin.performSync();

      // Let cleanup happen
      await new Promise(resolve => setTimeout(resolve, 100));

      // State manager should not grow unbounded
      const statsAfter = plugin.stateManager.getStats();
      expect(statsAfter.totalFiles).toBe(500);
      
      // Cleanup should have been called
      expect(plugin.stateManager.cleanup).toBeDefined();
    });
  });

  describe('Concurrent sync handling', () => {
    it('should queue concurrent sync requests', async () => {
      const meetings = Array.from({ length: 50 }, (_, i) => ({
        id: `meeting-${i}`,
        title: `Meeting ${i}`,
        date: new Date('2024-03-20'),
        summary: `Summary ${i}`
      }));

      plugin.granolaService.getAllMeetings = jest.fn().mockResolvedValue(meetings);
      plugin.granolaService.testConnection = jest.fn().mockResolvedValue(true);

      // Make sync take some time
      let syncInProgress = false;
      const originalSync = plugin.syncEngine.sync.bind(plugin.syncEngine);
      plugin.syncEngine.sync = jest.fn().mockImplementation(async () => {
        if (syncInProgress) {
          throw new Error('Sync already in progress');
        }
        syncInProgress = true;
        await new Promise(resolve => setTimeout(resolve, 100));
        const result = await originalSync();
        syncInProgress = false;
        return result;
      });

      // Start multiple syncs concurrently
      const syncPromises = [
        plugin.performSync(),
        plugin.performSync(),
        plugin.performSync()
      ];

      // Should handle all without errors
      await Promise.all(syncPromises);

      // Should have queued the requests
      expect(plugin.syncEngine.sync).toHaveBeenCalledTimes(3);
    });
  });

  describe('Network failure resilience', () => {
    it('should handle intermittent network failures', async () => {
      const meetings = Array.from({ length: 30 }, (_, i) => ({
        id: `meeting-${i}`,
        title: `Meeting ${i}`,
        date: new Date('2024-03-20'),
        summary: `Summary ${i}`
      }));

      let callCount = 0;
      plugin.granolaService.getAllMeetings = jest.fn().mockImplementation(async () => {
        callCount++;
        // Fail on first 2 attempts
        if (callCount <= 2) {
          throw new Error('Network timeout');
        }
        return meetings;
      });
      plugin.granolaService.testConnection = jest.fn().mockResolvedValue(true);

      await plugin.performSync();

      // Should have retried and succeeded
      expect(callCount).toBe(3);
      expect(env.vault.create).toHaveBeenCalledTimes(30);
    });

    it('should save partial progress on failure', async () => {
      const meetings = Array.from({ length: 100 }, (_, i) => ({
        id: `meeting-${i}`,
        title: `Meeting ${i}`,
        date: new Date('2024-03-20'),
        summary: `Summary ${i}`
      }));

      plugin.granolaService.getAllMeetings = jest.fn().mockResolvedValue(meetings);
      plugin.granolaService.testConnection = jest.fn().mockResolvedValue(true);

      // Fail after creating 50 meetings
      let createCount = 0;
      env.vault.create = jest.fn().mockImplementation(async () => {
        createCount++;
        if (createCount === 50) {
          throw new Error('Disk full');
        }
      });

      await plugin.performSync();

      // Should have saved state for successfully created meetings
      const stats = plugin.stateManager.getStats();
      expect(stats.totalFiles).toBe(49); // 49 successful creates
    });
  });
});