import { Plugin, TFile, TAbstractFile } from 'obsidian';

// Version for migration support
const CURRENT_STATE_VERSION = 1;

export interface SyncState {
  // Version for migration support
  version: number;
  // Map of granolaId -> current file path
  fileIndex: Record<string, string>;
  // Track deleted files to prevent recreation
  deletedIds: Set<string>;
  // Last sync timestamp
  lastSync: string;
}

export class SyncStateManager {
  private state!: SyncState;
  private pathToIdIndex: Record<string, string> = {};
  private saveTimeoutId: number | null = null;
  private eventRefs: any[] = [];
  
  constructor(private plugin: Plugin) {}
  
  async initialize(): Promise<void> {
    // Load state from plugin data
    const saved = await this.plugin.loadData();
    if (saved?.syncState) {
      this.state = this.deserializeState(saved.syncState);
      await this.validateAndMigrateState();
    } else {
      this.state = this.createEmptyState();
    }
    
    // Register vault event listeners
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
    
    // Build initial index from vault
    await this.rebuildIndex();
  }
  
  private createEmptyState(): SyncState {
    return {
      version: CURRENT_STATE_VERSION,
      fileIndex: {},
      deletedIds: new Set<string>(),
      lastSync: ''
    };
  }
  
  private deserializeState(saved: any): SyncState {
    try {
      return {
        version: saved.version || 1,
        fileIndex: saved.fileIndex || {},
        deletedIds: new Set(saved.deletedIds || []),
        lastSync: saved.lastSync || ''
      };
    } catch (error) {
      console.error('Failed to deserialize state, using empty state', error);
      return this.createEmptyState();
    }
  }
  
  private serializeState(): any {
    return {
      version: this.state.version,
      fileIndex: this.state.fileIndex,
      deletedIds: Array.from(this.state.deletedIds),
      lastSync: this.state.lastSync
    };
  }
  
  private async validateAndMigrateState(): Promise<void> {
    // Future migration logic would go here
    if (this.state.version < CURRENT_STATE_VERSION) {
      console.log(`Migrating sync state from version ${this.state.version} to ${CURRENT_STATE_VERSION}`);
      // Perform migrations based on version
      this.state.version = CURRENT_STATE_VERSION;
      await this.saveState();
    }
  }
  
  async rebuildIndex(): Promise<void> {
    const files = this.plugin.app.vault.getMarkdownFiles();
    const newIndex: Record<string, string> = {};
    const newPathIndex: Record<string, string> = {};
    
    for (const file of files) {
      const cache = this.plugin.app.metadataCache.getFileCache(file);
      const granolaId = cache?.frontmatter?.granolaId;
      if (granolaId && typeof granolaId === 'string') {
        newIndex[granolaId] = file.path;
        newPathIndex[file.path] = granolaId;
      }
    }
    
    this.state.fileIndex = newIndex;
    this.pathToIdIndex = newPathIndex;
    await this.saveStateDebounced();
  }
  
  private async handleRename(file: TAbstractFile, oldPath: string): Promise<void> {
    if (file instanceof TFile) {
      const cache = this.plugin.app.metadataCache.getFileCache(file);
      const granolaId = cache?.frontmatter?.granolaId;
      if (granolaId && typeof granolaId === 'string') {
        // Update both indexes
        delete this.pathToIdIndex[oldPath];
        this.state.fileIndex[granolaId] = file.path;
        this.pathToIdIndex[file.path] = granolaId;
        await this.saveStateDebounced();
      }
    }
  }
  
  private async handleDelete(file: TAbstractFile): Promise<void> {
    if (file instanceof TFile) {
      // Use O(1) lookup with path index
      const granolaId = this.pathToIdIndex[file.path];
      if (granolaId) {
        delete this.state.fileIndex[granolaId];
        delete this.pathToIdIndex[file.path];
        this.state.deletedIds.add(granolaId);
        await this.saveStateDebounced();
      }
    }
  }
  
  async saveState(): Promise<void> {
    try {
      const data = await this.plugin.loadData() || {};
      data.syncState = this.serializeState();
      await this.plugin.saveData(data);
    } catch (error) {
      console.error('Failed to save sync state', error);
      throw error; // Re-throw to notify caller
    }
  }
  
  private async saveStateDebounced(): Promise<void> {
    // Cancel any pending save
    if (this.saveTimeoutId !== null) {
      clearTimeout(this.saveTimeoutId);
    }
    
    // Schedule new save
    this.saveTimeoutId = window.setTimeout(async () => {
      this.saveTimeoutId = null;
      await this.saveState();
    }, 500);
  }
  
  getFilePath(granolaId: string): string | undefined {
    return this.state.fileIndex[granolaId];
  }
  
  isDeleted(granolaId: string): boolean {
    return this.state.deletedIds.has(granolaId);
  }
  
  addFile(granolaId: string, path: string): void {
    // Update both indexes
    const oldPath = this.state.fileIndex[granolaId];
    if (oldPath) {
      delete this.pathToIdIndex[oldPath];
    }
    this.state.fileIndex[granolaId] = path;
    this.pathToIdIndex[path] = granolaId;
    // If it was previously deleted, remove from deleted set
    this.state.deletedIds.delete(granolaId);
  }
  
  updatePath(granolaId: string, newPath: string): void {
    const oldPath = this.state.fileIndex[granolaId];
    if (oldPath) {
      delete this.pathToIdIndex[oldPath];
    }
    this.state.fileIndex[granolaId] = newPath;
    this.pathToIdIndex[newPath] = granolaId;
  }
  
  setLastSync(timestamp: string): void {
    this.state.lastSync = timestamp;
  }
  
  getLastSync(): string {
    return this.state.lastSync;
  }
  
  clearDeletedId(granolaId: string): void {
    this.state.deletedIds.delete(granolaId);
  }
  
  getStats(): { totalFiles: number; deletedFiles: number } {
    return {
      totalFiles: Object.keys(this.state.fileIndex).length,
      deletedFiles: this.state.deletedIds.size
    };
  }
  
  cleanup(): void {
    // Clear any pending save timeout
    if (this.saveTimeoutId !== null) {
      clearTimeout(this.saveTimeoutId);
      this.saveTimeoutId = null;
    }
    // Note: Event refs are automatically cleaned up by Obsidian
    // when the plugin unloads, but we track them for completeness
  }
}