import { FileLockManager } from '../../src/utils/file-lock-manager';
import { Logger } from '../../src/utils/logger';

describe('FileLockManager - Fixed Tests', () => {
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
  });

  afterEach(() => {
    lockManager.cleanup();
  });

  it('should acquire and release locks successfully', async () => {
    const lockId = await lockManager.acquireLock('/test/file.md', 'write');
    expect(lockId).toBeTruthy();
    
    const released = lockManager.releaseLock(lockId!);
    expect(released).toBe(true);
  });

  it('should handle double release gracefully', async () => {
    const lockId = await lockManager.acquireLock('/test/file.md', 'write');
    expect(lockId).toBeTruthy();
    
    // First release should succeed
    const released1 = lockManager.releaseLock(lockId!);
    expect(released1).toBe(true);
    
    // Second release should fail gracefully
    const released2 = lockManager.releaseLock(lockId!);
    expect(released2).toBe(false);
  });

  it('should allow multiple locks on different files', async () => {
    const lockId1 = await lockManager.acquireLock('/test/file1.md', 'write');
    const lockId2 = await lockManager.acquireLock('/test/file2.md', 'write');
    
    expect(lockId1).toBeTruthy();
    expect(lockId2).toBeTruthy();
    expect(lockId1).not.toBe(lockId2);
    
    lockManager.releaseLock(lockId1!);
    lockManager.releaseLock(lockId2!);
  });

  it('should execute operations with locking', async () => {
    let executed = false;
    
    await lockManager.withLock('/test/file.md', 'test', async () => {
      executed = true;
    });
    
    expect(executed).toBe(true);
  });

  it('should handle errors in locked operations', async () => {
    await expect(
      lockManager.withLock('/test/file.md', 'error-test', async () => {
        throw new Error('Test error');
      })
    ).rejects.toThrow('Test error');
    
    // Lock should be released even after error
    const lockId = await lockManager.acquireLock('/test/file.md', 'write');
    expect(lockId).toBeTruthy();
    lockManager.releaseLock(lockId!);
  });
});