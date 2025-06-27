import { FileLockManager } from '../../src/utils/file-lock-manager';
import { Logger } from '../../src/utils/logger';

describe('FileLockManager - Simple Tests', () => {
  let lockManager: FileLockManager;
  let mockLogger: Logger;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    } as any;

    lockManager = new FileLockManager(mockLogger);
    // Configure for fast testing - these are private properties, so might not work
    // Instead we'll just accept the default timing in tests
  });

  afterEach(() => {
    lockManager.cleanup();
  });

  it('should acquire and release locks', async () => {
    const lockId = await lockManager.acquireLock('/test/file.md', 'write');
    expect(lockId).toBeTruthy();
    
    const released = lockManager.releaseLock(lockId!);
    expect(released).toBe(true);
  });

  it('should prevent concurrent access to same file', async () => {
    const lockId1 = await lockManager.acquireLock('/test/file.md', 'write');
    expect(lockId1).toBeTruthy();
    
    // This should fail after retrying (with default settings: 10 retries * 100ms = 1 second)
    const lockId2 = await lockManager.acquireLock('/test/file.md', 'read');
    expect(lockId2).toBeNull();
    
    // Clean up
    lockManager.releaseLock(lockId1!);
  }, 10000); // 10 second timeout to account for retry delays

  it('should handle file path normalization', async () => {
    const lockId1 = await lockManager.acquireLock('/Test/File.MD', 'write');
    expect(lockId1).toBeTruthy();
    
    // Should be blocked because it's the same file (path normalizes to lowercase)
    const lockId2 = await lockManager.acquireLock('/test/file.md', 'read');
    expect(lockId2).toBeNull();
    
    // Clean up
    lockManager.releaseLock(lockId1!);
  }, 10000); // 10 second timeout

  it('should execute operations with locking', async () => {
    let executed = false;
    
    await lockManager.withLock('/test/file.md', 'test', async () => {
      executed = true;
    });
    
    expect(executed).toBe(true);
  });

  it('should serialize concurrent operations', async () => {
    const order: number[] = [];
    
    // Create two operations that will run sequentially
    const op1 = lockManager.withLock('/test/file.md', 'op1', async () => {
      order.push(1);
      // Small delay to ensure op2 tries to acquire lock while op1 is running
      await new Promise(resolve => setTimeout(resolve, 50));
      order.push(2);
    });
    
    const op2 = lockManager.withLock('/test/file.md', 'op2', async () => {
      order.push(3);
    });
    
    // Start both operations concurrently
    await Promise.all([op1, op2]);
    
    // op2 should only run after op1 completes
    expect(order).toEqual([1, 2, 3]);
  }, 10000); // 10 second timeout

  it('should handle errors gracefully', async () => {
    await expect(
      lockManager.withLock('/test/file.md', 'error-test', async () => {
        throw new Error('Test error');
      })
    ).rejects.toThrow('Test error');
    
    // Lock should be released, so we can acquire it again
    const lockId = await lockManager.acquireLock('/test/file.md', 'write');
    expect(lockId).toBeTruthy();
    lockManager.releaseLock(lockId!);
  });
});