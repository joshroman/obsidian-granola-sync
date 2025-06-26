import { Logger } from './logger';

export interface LockInfo {
  id: string;
  filePath: string;
  timestamp: number;
  operation: string;
}

/**
 * File Lock Manager - Prevents race conditions in concurrent file operations
 * Uses a simple in-memory lock mechanism suitable for single-process Obsidian plugins
 */
export class FileLockManager {
  private locks: Map<string, LockInfo> = new Map();
  private readonly lockTimeout = 30000; // 30 seconds timeout
  private readonly maxRetries = 10;
  private readonly retryDelay = 100; // 100ms
  private cleanupInterval: number | null = null;
  
  constructor(private logger: Logger) {
    // Periodically clean up stale locks
    if (typeof window !== 'undefined') {
      this.cleanupInterval = window.setInterval(() => this.cleanupStaleLocks(), 60000); // Every minute
    }
  }
  
  /**
   * Acquire a lock for a file path
   * @returns lock ID if successful, null if failed
   */
  async acquireLock(filePath: string, operation: string): Promise<string | null> {
    const normalizedPath = this.normalizePath(filePath);
    
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      // Check if lock exists and is still valid
      const existingLock = this.locks.get(normalizedPath);
      if (existingLock) {
        // Check if lock is stale
        if (Date.now() - existingLock.timestamp > this.lockTimeout) {
          this.logger.warn(`Removing stale lock for ${normalizedPath}`);
          this.locks.delete(normalizedPath);
        } else {
          // Lock is held by another operation
          this.logger.debug(`Lock held for ${normalizedPath}, attempt ${attempt + 1}/${this.maxRetries}`);
          await this.delay(this.retryDelay);
          continue;
        }
      }
      
      // Try to acquire lock
      const lockId = this.generateLockId();
      const lockInfo: LockInfo = {
        id: lockId,
        filePath: normalizedPath,
        timestamp: Date.now(),
        operation
      };
      
      // Double-check no one else grabbed it
      if (!this.locks.has(normalizedPath)) {
        this.locks.set(normalizedPath, lockInfo);
        this.logger.debug(`Lock acquired for ${normalizedPath}: ${lockId}`);
        return lockId;
      }
    }
    
    this.logger.error(`Failed to acquire lock for ${normalizedPath} after ${this.maxRetries} attempts`);
    return null;
  }
  
  /**
   * Release a lock
   */
  releaseLock(lockId: string): boolean {
    for (const [path, lock] of this.locks.entries()) {
      if (lock.id === lockId) {
        this.locks.delete(path);
        this.logger.debug(`Lock released for ${path}: ${lockId}`);
        return true;
      }
    }
    
    this.logger.warn(`Attempted to release non-existent lock: ${lockId}`);
    return false;
  }
  
  /**
   * Execute an operation with file locking
   */
  async withLock<T>(
    filePath: string, 
    operation: string, 
    callback: () => Promise<T>
  ): Promise<T> {
    const lockId = await this.acquireLock(filePath, operation);
    if (!lockId) {
      throw new Error(`Failed to acquire lock for ${filePath}`);
    }
    
    try {
      return await callback();
    } finally {
      this.releaseLock(lockId);
    }
  }
  
  /**
   * Check if a file is locked
   */
  isLocked(filePath: string): boolean {
    const normalizedPath = this.normalizePath(filePath);
    const lock = this.locks.get(normalizedPath);
    
    if (!lock) return false;
    
    // Check if lock is stale
    if (Date.now() - lock.timestamp > this.lockTimeout) {
      this.locks.delete(normalizedPath);
      return false;
    }
    
    return true;
  }
  
  /**
   * Get current lock info for a file
   */
  getLockInfo(filePath: string): LockInfo | null {
    const normalizedPath = this.normalizePath(filePath);
    return this.locks.get(normalizedPath) || null;
  }
  
  /**
   * Clean up stale locks
   */
  private cleanupStaleLocks(): void {
    const now = Date.now();
    const staleLocks: string[] = [];
    
    for (const [path, lock] of this.locks.entries()) {
      if (now - lock.timestamp > this.lockTimeout) {
        staleLocks.push(path);
      }
    }
    
    for (const path of staleLocks) {
      this.locks.delete(path);
      this.logger.debug(`Cleaned up stale lock for ${path}`);
    }
    
    if (staleLocks.length > 0) {
      this.logger.info(`Cleaned up ${staleLocks.length} stale locks`);
    }
  }
  
  /**
   * Normalize file path for consistent locking
   */
  private normalizePath(filePath: string): string {
    return filePath.toLowerCase().replace(/\\/g, '/');
  }
  
  /**
   * Generate unique lock ID
   */
  private generateLockId(): string {
    return `lock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Clean up all locks (for shutdown)
   */
  cleanup(): void {
    if (this.cleanupInterval !== null && typeof window !== 'undefined') {
      window.clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.locks.clear();
    this.logger.info('All file locks released');
  }
}