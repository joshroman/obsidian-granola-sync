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
  private state: SyncState;
  private stateFile = '.granola-sync-state.json';
  
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
    this.plugin.registerEvent(
      this.plugin.app.vault.on('rename', this.handleRename.bind(this))
    );
    this.plugin.registerEvent(
      this.plugin.app.vault.on('delete', this.handleDelete.bind(this))
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
    return {
      version: saved.version || 1,
      fileIndex: saved.fileIndex || {},
      deletedIds: new Set(saved.deletedIds || []),
      lastSync: saved.lastSync || ''
    };
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
    
    for (const file of files) {
      const cache = this.plugin.app.metadataCache.getFileCache(file);
      const granolaId = cache?.frontmatter?.granolaId;
      if (granolaId && typeof granolaId === 'string') {
        newIndex[granolaId] = file.path;
      }
    }
    
    this.state.fileIndex = newIndex;
    await this.saveState();
  }
  
  private async handleRename(file: TAbstractFile, oldPath: string): Promise<void> {
    if (file instanceof TFile) {
      const cache = this.plugin.app.metadataCache.getFileCache(file);
      const granolaId = cache?.frontmatter?.granolaId;
      if (granolaId && typeof granolaId === 'string') {
        this.state.fileIndex[granolaId] = file.path;
        await this.saveState();
      }
    }
  }
  
  private async handleDelete(file: TAbstractFile): Promise<void> {
    if (file instanceof TFile) {
      // Find granolaId from our index
      for (const [id, path] of Object.entries(this.state.fileIndex)) {
        if (path === file.path) {
          delete this.state.fileIndex[id];
          this.state.deletedIds.add(id);
          await this.saveState();
          break;
        }
      }
    }
  }
  
  async saveState(): Promise<void> {
    const data = await this.plugin.loadData() || {};
    data.syncState = this.serializeState();
    await this.plugin.saveData(data);
  }
  
  getFilePath(granolaId: string): string | undefined {
    return this.state.fileIndex[granolaId];
  }
  
  isDeleted(granolaId: string): boolean {
    return this.state.deletedIds.has(granolaId);
  }
  
  addFile(granolaId: string, path: string): void {
    this.state.fileIndex[granolaId] = path;
    // If it was previously deleted, remove from deleted set
    this.state.deletedIds.delete(granolaId);
  }
  
  updatePath(granolaId: string, newPath: string): void {
    this.state.fileIndex[granolaId] = newPath;
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
}