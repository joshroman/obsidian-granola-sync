import { TFile, App } from 'obsidian';
import { createHash } from 'crypto';
import { Logger } from '../utils/logger';

export interface FileMetadata {
  granolaId: string;
  path: string;
  contentHash: string;
  lastModified: number;
  lastSynced: number;
  syncVersion: number;
}

export enum ConflictType {
  USER_MODIFIED = 'user_modified',
  BOTH_MODIFIED = 'both_modified',
  FILE_MISSING = 'file_missing',
  DUPLICATE_ID = 'duplicate_id',
  METADATA_CORRUPTED = 'metadata_corrupted',
  PATH_CONFLICT = 'path_conflict'
}

export interface Conflict {
  type: ConflictType;
  granolaId: string;
  localPath?: string;
  remotePath?: string;
  description: string;
  userModifiedTime?: number;
  remoteModifiedTime?: number;
  resolution?: ConflictResolution;
}

export enum ConflictResolution {
  KEEP_LOCAL = 'keep_local',
  KEEP_REMOTE = 'keep_remote',
  MERGE = 'merge',
  BACKUP_AND_UPDATE = 'backup_and_update',
  CREATE_DUPLICATE = 'create_duplicate',
  SKIP = 'skip'
}

export class ConflictDetector {
  constructor(
    private app: App,
    private logger: Logger
  ) {}

  /**
   * Calculate SHA-256 hash of file content
   */
  async calculateContentHash(content: string): Promise<string> {
    const hash = createHash('sha256');
    hash.update(content);
    return hash.digest('hex');
  }

  /**
   * Extract content without frontmatter for comparison
   */
  private extractContent(fullContent: string): string {
    const frontmatterRegex = /^---\n[\s\S]*?\n---\n/;
    return fullContent.replace(frontmatterRegex, '').trim();
  }

  /**
   * Detect if user has modified the file since last sync
   */
  async detectUserModification(
    file: TFile,
    metadata: FileMetadata
  ): Promise<boolean> {
    try {
      const currentContent = await this.app.vault.read(file);
      const contentOnly = this.extractContent(currentContent);
      const currentHash = await this.calculateContentHash(contentOnly);
      
      // Check if content hash has changed
      if (currentHash !== metadata.contentHash) {
        // Also verify modification time is after last sync
        const stats = file.stat;
        return stats.mtime > metadata.lastSynced;
      }
      
      return false;
    } catch (error) {
      this.logger.error('Error detecting user modification', error);
      return false;
    }
  }

  /**
   * Detect all types of conflicts for a meeting
   */
  async detectConflicts(
    granolaId: string,
    remotePath: string,
    remoteModifiedTime: number,
    metadata: FileMetadata | undefined,
    existingFiles: Map<string, TFile>
  ): Promise<Conflict[]> {
    const conflicts: Conflict[] = [];

    // Case 1: No local metadata (new file or corrupted state)
    if (!metadata) {
      // Check if file exists with this granolaId
      const filesWithId = await this.findFilesWithGranolaId(granolaId);
      
      if (filesWithId.length > 1) {
        conflicts.push({
          type: ConflictType.DUPLICATE_ID,
          granolaId,
          localPath: filesWithId[0].path,
          remotePath,
          description: `Multiple files found with Granola ID ${granolaId}`
        });
      } else if (filesWithId.length === 1) {
        // File exists but not in state - metadata corrupted
        conflicts.push({
          type: ConflictType.METADATA_CORRUPTED,
          granolaId,
          localPath: filesWithId[0].path,
          remotePath,
          description: 'File exists but not tracked in sync state'
        });
      }
      return conflicts;
    }

    // Case 2: File is missing
    const localFile = existingFiles.get(metadata.path);
    if (!localFile) {
      conflicts.push({
        type: ConflictType.FILE_MISSING,
        granolaId,
        localPath: metadata.path,
        remotePath,
        description: 'Local file has been deleted or moved'
      });
      return conflicts;
    }

    // Case 3: Path conflict (file at expected path has different ID)
    const cache = this.app.metadataCache.getFileCache(localFile);
    const currentGranolaId = cache?.frontmatter?.granolaId;
    if (currentGranolaId && currentGranolaId !== granolaId) {
      conflicts.push({
        type: ConflictType.PATH_CONFLICT,
        granolaId,
        localPath: metadata.path,
        remotePath,
        description: `File at ${metadata.path} has different Granola ID: ${currentGranolaId}`
      });
      return conflicts;
    }

    // Case 4: Check for user modifications
    const isUserModified = await this.detectUserModification(localFile, metadata);
    const isRemoteModified = remoteModifiedTime > metadata.lastSynced;

    if (isUserModified && isRemoteModified) {
      conflicts.push({
        type: ConflictType.BOTH_MODIFIED,
        granolaId,
        localPath: metadata.path,
        remotePath,
        description: 'Both local and remote versions have been modified',
        userModifiedTime: localFile.stat.mtime,
        remoteModifiedTime
      });
    } else if (isUserModified && !isRemoteModified) {
      conflicts.push({
        type: ConflictType.USER_MODIFIED,
        granolaId,
        localPath: metadata.path,
        remotePath,
        description: 'User has modified the local file',
        userModifiedTime: localFile.stat.mtime
      });
    }

    return conflicts;
  }

  /**
   * Find all files with a specific Granola ID
   */
  private async findFilesWithGranolaId(granolaId: string): Promise<TFile[]> {
    const files: TFile[] = [];
    const allFiles = this.app.vault.getMarkdownFiles();
    
    for (const file of allFiles) {
      const cache = this.app.metadataCache.getFileCache(file);
      if (cache?.frontmatter?.granolaId === granolaId) {
        files.push(file);
      }
    }
    
    return files;
  }

  /**
   * Suggest resolution based on conflict type and user preferences
   */
  suggestResolution(
    conflict: Conflict,
    preferLocalChanges: boolean = true
  ): ConflictResolution {
    switch (conflict.type) {
      case ConflictType.USER_MODIFIED:
        return preferLocalChanges 
          ? ConflictResolution.KEEP_LOCAL 
          : ConflictResolution.BACKUP_AND_UPDATE;
          
      case ConflictType.BOTH_MODIFIED:
        return ConflictResolution.BACKUP_AND_UPDATE;
        
      case ConflictType.FILE_MISSING:
        return ConflictResolution.KEEP_REMOTE;
        
      case ConflictType.DUPLICATE_ID:
        return ConflictResolution.CREATE_DUPLICATE;
        
      case ConflictType.METADATA_CORRUPTED:
        return ConflictResolution.KEEP_REMOTE;
        
      case ConflictType.PATH_CONFLICT:
        return ConflictResolution.CREATE_DUPLICATE;
        
      default:
        return ConflictResolution.SKIP;
    }
  }

  /**
   * Create a backup of a file before resolving conflict
   */
  async createBackup(file: TFile): Promise<string> {
    const backupName = `${file.basename}.backup-${Date.now()}.md`;
    const backupPath = file.parent ? `${file.parent.path}/${backupName}` : backupName;
    
    const content = await this.app.vault.read(file);
    await this.app.vault.create(backupPath, content);
    
    this.logger.info(`Created backup: ${backupPath}`);
    return backupPath;
  }

  /**
   * Merge local and remote content intelligently
   */
  async mergeContent(
    localFile: TFile,
    remoteContent: string
  ): Promise<string> {
    const localContent = await this.app.vault.read(localFile);
    
    // Extract parts
    const localFrontmatter = this.extractFrontmatter(localContent);
    const localBody = this.extractContent(localContent);
    
    const remoteFrontmatter = this.extractFrontmatter(remoteContent);
    const remoteBody = this.extractContent(remoteContent);
    
    // Merge strategy: 
    // - Use remote frontmatter (source of truth for metadata)
    // - Keep local body if it has more content, otherwise use remote
    const mergedBody = localBody.length > remoteBody.length ? localBody : remoteBody;
    
    // Add merge conflict markers if content differs significantly
    if (localBody !== remoteBody && localBody.length > 0 && remoteBody.length > 0) {
      const conflictMarker = `

<!-- MERGE CONFLICT: Original remote content below -->
<!--
${remoteBody}
-->
`;
      return `${remoteFrontmatter}\n${mergedBody}${conflictMarker}`;
    }
    
    return `${remoteFrontmatter}\n${mergedBody}`;
  }

  /**
   * Extract frontmatter from content
   */
  private extractFrontmatter(content: string): string {
    const match = content.match(/^---\n[\s\S]*?\n---\n/);
    return match ? match[0] : '';
  }
}