import { Plugin, TFile, TAbstractFile } from 'obsidian';
import { createHash } from 'crypto';
import { FileMetadata, ConflictDetector } from './conflict-detector';
import { Logger } from '../utils/logger';

const CURRENT_STATE_VERSION = 2;

export interface EnhancedSyncState {
  version: number;
  // Enhanced file tracking with metadata
  files: Record<string, FileMetadata>;
  // Track deleted files
  deletedIds: Set<string>;
  // Last sync timestamp
  lastSync: string;
  // State checksum for integrity
  checksum?: string;
}

export interface StateTransaction {
  id: string;
  timestamp: number;
  operations: Array<{
    type: 'add' | 'update' | 'delete';
    granolaId: string;
    data?: FileMetadata;
  }>;
  previousState?: EnhancedSyncState;
}

export class EnhancedStateManager {
  private state!: EnhancedSyncState;
  private pathToIdIndex: Record<string, string> = {};
  private saveTimeoutId: number | null = null;
  private eventRefs: any[] = [];
  private currentTransaction: StateTransaction | null = null;
  private stateBackups: EnhancedSyncState[] = [];
  private conflictDetector: ConflictDetector;
  
  constructor(
    private plugin: Plugin,
    private logger: Logger
  ) {
    this.conflictDetector = new ConflictDetector(plugin.app, logger);
  }
  
  async initialize(): Promise<void> {
    await this.loadState();
    this.registerEventHandlers();
    await this.rebuildIndex();
    await this.validateState();
  }

  private async loadState(): Promise<void> {
    const saved = await this.plugin.loadData();
    if (saved?.enhancedSyncState) {
      try {
        this.state = this.deserializeState(saved.enhancedSyncState);
        await this.migrateState();
      } catch (error) {
        this.logger.error('Failed to load state, creating new', error);
        this.state = this.createEmptyState();
      }
    } else if (saved?.syncState) {
      // Migrate from old state format
      this.state = await this.migrateFromOldFormat(saved.syncState);
    } else {
      this.state = this.createEmptyState();
    }
  }

  private createEmptyState(): EnhancedSyncState {
    return {
      version: CURRENT_STATE_VERSION,
      files: {},
      deletedIds: new Set<string>(),
      lastSync: '',
      checksum: ''
    };
  }

  private deserializeState(saved: any): EnhancedSyncState {
    return {
      version: saved.version || CURRENT_STATE_VERSION,
      files: saved.files || {},
      deletedIds: new Set(saved.deletedIds || []),
      lastSync: saved.lastSync || '',
      checksum: saved.checksum
    };
  }

  private serializeState(): any {
    const serialized = {
      version: this.state.version,
      files: this.state.files,
      deletedIds: Array.from(this.state.deletedIds),
      lastSync: this.state.lastSync,
      checksum: ''
    };
    
    // Calculate checksum
    serialized.checksum = this.calculateStateChecksum(serialized);
    
    return serialized;
  }

  private calculateStateChecksum(state: any): string {
    const hash = createHash('sha256');
    const content = JSON.stringify({
      files: state.files,
      deletedIds: state.deletedIds,
      lastSync: state.lastSync
    });
    hash.update(content);
    return hash.digest('hex');
  }

  private async migrateFromOldFormat(oldState: any): Promise<EnhancedSyncState> {
    this.logger.info('Migrating from old state format');
    
    const newState = this.createEmptyState();
    newState.lastSync = oldState.lastSync || '';
    newState.deletedIds = new Set(oldState.deletedIds || []);
    
    // Convert old fileIndex to new format with metadata
    for (const [granolaId, path] of Object.entries(oldState.fileIndex || {})) {
      const file = this.plugin.app.vault.getAbstractFileByPath(path as string);
      if (file instanceof TFile) {
        const content = await this.plugin.app.vault.read(file);
        const contentOnly = this.extractContent(content);
        const contentHash = await this.conflictDetector.calculateContentHash(contentOnly);
        
        newState.files[granolaId] = {
          granolaId,
          path: path as string,
          contentHash,
          lastModified: file.stat.mtime,
          lastSynced: Date.now(),
          syncVersion: 1
        };
      }
    }
    
    return newState;
  }

  private async migrateState(): Promise<void> {
    if (this.state.version < CURRENT_STATE_VERSION) {
      this.logger.info(`Migrating state from v${this.state.version} to v${CURRENT_STATE_VERSION}`);
      
      // Add any future migrations here
      
      this.state.version = CURRENT_STATE_VERSION;
      await this.saveState();
    }
  }

  private async validateState(): Promise<boolean> {
    if (!this.state.checksum) {
      this.logger.warn('State has no checksum, skipping validation');
      return true;
    }
    
    const calculatedChecksum = this.calculateStateChecksum({
      files: this.state.files,
      deletedIds: Array.from(this.state.deletedIds),
      lastSync: this.state.lastSync
    });
    
    if (calculatedChecksum !== this.state.checksum) {
      this.logger.error('State checksum mismatch - state may be corrupted');
      await this.attemptStateRecovery();
      return false;
    }
    
    return true;
  }

  private async attemptStateRecovery(): Promise<void> {
    this.logger.info('Attempting state recovery');
    
    // Try to use a backup
    if (this.stateBackups.length > 0) {
      this.state = this.stateBackups[this.stateBackups.length - 1];
      this.logger.info('Restored from backup');
      return;
    }
    
    // Rebuild from vault
    this.logger.info('Rebuilding state from vault');
    this.state = this.createEmptyState();
    await this.rebuildIndex();
  }

  private registerEventHandlers(): void {
    this.eventRefs.push(
      this.plugin.registerEvent(
        this.plugin.app.vault.on('rename', this.handleRename.bind(this))
      )
    );
    this.eventRefs.push(
      this.plugin.registerEvent(
        this.plugin.app.vault.on('delete', this.handleDelete.bind(this))
      )
    );
    this.eventRefs.push(
      this.plugin.registerEvent(
        this.plugin.app.vault.on('modify', this.handleModify.bind(this))
      )
    );
  }

  async rebuildIndex(): Promise<void> {
    const files = this.plugin.app.vault.getMarkdownFiles();
    const newFiles: Record<string, FileMetadata> = {};
    const newPathIndex: Record<string, string> = {};
    
    for (const file of files) {
      const cache = this.plugin.app.metadataCache.getFileCache(file);
      const granolaId = cache?.frontmatter?.granolaId;
      
      if (granolaId && typeof granolaId === 'string') {
        const content = await this.plugin.app.vault.read(file);
        const contentOnly = this.extractContent(content);
        const contentHash = await this.conflictDetector.calculateContentHash(contentOnly);
        
        const existingMetadata = this.state.files[granolaId];
        
        newFiles[granolaId] = {
          granolaId,
          path: file.path,
          contentHash,
          lastModified: file.stat.mtime,
          lastSynced: existingMetadata?.lastSynced || Date.now(),
          syncVersion: existingMetadata?.syncVersion || 1
        };
        
        newPathIndex[file.path] = granolaId;
      }
    }
    
    this.state.files = newFiles;
    this.pathToIdIndex = newPathIndex;
    await this.saveStateDebounced();
  }

  private extractContent(fullContent: string): string {
    const frontmatterRegex = /^---\n[\s\S]*?\n---\n/;
    return fullContent.replace(frontmatterRegex, '').trim();
  }

  private async handleRename(file: TAbstractFile, oldPath: string): Promise<void> {
    if (!(file instanceof TFile)) return;
    
    const granolaId = this.pathToIdIndex[oldPath];
    if (!granolaId) return;
    
    const metadata = this.state.files[granolaId];
    if (metadata) {
      metadata.path = file.path;
      metadata.lastModified = file.stat.mtime;
      
      delete this.pathToIdIndex[oldPath];
      this.pathToIdIndex[file.path] = granolaId;
      
      await this.saveStateDebounced();
    }
  }

  private async handleDelete(file: TAbstractFile): Promise<void> {
    if (!(file instanceof TFile)) return;
    
    const granolaId = this.pathToIdIndex[file.path];
    if (!granolaId) return;
    
    delete this.state.files[granolaId];
    delete this.pathToIdIndex[file.path];
    this.state.deletedIds.add(granolaId);
    
    await this.saveStateDebounced();
  }

  private async handleModify(file: TFile): Promise<void> {
    const granolaId = this.pathToIdIndex[file.path];
    if (!granolaId) return;
    
    const metadata = this.state.files[granolaId];
    if (metadata) {
      // Update modification time but not content hash
      // Content hash is only updated during sync
      metadata.lastModified = file.stat.mtime;
      await this.saveStateDebounced();
    }
  }

  // Transaction support
  beginTransaction(id: string): void {
    if (this.currentTransaction) {
      throw new Error('Transaction already in progress');
    }
    
    this.currentTransaction = {
      id,
      timestamp: Date.now(),
      operations: [],
      previousState: JSON.parse(JSON.stringify(this.state))
    };
  }

  commitTransaction(): void {
    if (!this.currentTransaction) {
      throw new Error('No transaction in progress');
    }
    
    // Add backup before committing
    if (this.stateBackups.length >= 5) {
      this.stateBackups.shift();
    }
    this.stateBackups.push(this.currentTransaction.previousState!);
    
    this.currentTransaction = null;
    this.saveState();
  }

  rollbackTransaction(): void {
    if (!this.currentTransaction) {
      throw new Error('No transaction in progress');
    }
    
    this.state = this.currentTransaction.previousState!;
    this.currentTransaction = null;
  }

  // Enhanced API
  async addOrUpdateFile(
    granolaId: string,
    path: string,
    contentHash: string,
    syncVersion: number
  ): Promise<void> {
    const file = this.plugin.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) {
      throw new Error(`File not found: ${path}`);
    }
    
    const metadata: FileMetadata = {
      granolaId,
      path,
      contentHash,
      lastModified: file.stat.mtime,
      lastSynced: Date.now(),
      syncVersion
    };
    
    // Update indexes
    const oldPath = this.state.files[granolaId]?.path;
    if (oldPath && oldPath !== path) {
      delete this.pathToIdIndex[oldPath];
    }
    
    this.state.files[granolaId] = metadata;
    this.pathToIdIndex[path] = granolaId;
    this.state.deletedIds.delete(granolaId);
    
    if (this.currentTransaction) {
      this.currentTransaction.operations.push({
        type: oldPath ? 'update' : 'add',
        granolaId,
        data: metadata
      });
    }
  }

  getFileMetadata(granolaId: string): FileMetadata | undefined {
    return this.state.files[granolaId];
  }

  getFilePath(granolaId: string): string | undefined {
    return this.state.files[granolaId]?.path;
  }

  isDeleted(granolaId: string): boolean {
    return this.state.deletedIds.has(granolaId);
  }

  clearDeletedId(granolaId: string): void {
    this.state.deletedIds.delete(granolaId);
  }

  setLastSync(timestamp: string): void {
    this.state.lastSync = timestamp;
  }

  getLastSync(): string {
    return this.state.lastSync;
  }

  getAllFiles(): Map<string, FileMetadata> {
    return new Map(Object.entries(this.state.files));
  }

  getStats(): {
    totalFiles: number;
    deletedFiles: number;
    orphanedFiles: number;
  } {
    // Count orphaned files (in state but not in vault)
    let orphanedCount = 0;
    for (const metadata of Object.values(this.state.files)) {
      const file = this.plugin.app.vault.getAbstractFileByPath(metadata.path);
      if (!file) {
        orphanedCount++;
      }
    }
    
    return {
      totalFiles: Object.keys(this.state.files).length,
      deletedFiles: this.state.deletedIds.size,
      orphanedFiles: orphanedCount
    };
  }

  async cleanupOrphanedEntries(): Promise<number> {
    let cleaned = 0;
    
    for (const [granolaId, metadata] of Object.entries(this.state.files)) {
      const file = this.plugin.app.vault.getAbstractFileByPath(metadata.path);
      if (!file) {
        delete this.state.files[granolaId];
        delete this.pathToIdIndex[metadata.path];
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      await this.saveState();
      this.logger.info(`Cleaned up ${cleaned} orphaned entries`);
    }
    
    return cleaned;
  }

  private async saveState(): Promise<void> {
    try {
      const data = await this.plugin.loadData() || {};
      data.enhancedSyncState = this.serializeState();
      await this.plugin.saveData(data);
    } catch (error) {
      this.logger.error('Failed to save state', error);
      throw error;
    }
  }

  private async saveStateDebounced(): Promise<void> {
    if (this.saveTimeoutId !== null) {
      clearTimeout(this.saveTimeoutId);
    }
    
    this.saveTimeoutId = window.setTimeout(async () => {
      this.saveTimeoutId = null;
      await this.saveState();
    }, 500);
  }

  cleanup(): void {
    if (this.saveTimeoutId !== null) {
      clearTimeout(this.saveTimeoutId);
      this.saveTimeoutId = null;
    }
  }
}