import { TFile, Notice } from 'obsidian';
import GranolaSyncPlugin from '../main';
import { Meeting, SyncResult, SyncError } from '../types';
import { EnhancedStateManager } from './enhanced-state-manager';
import { ConflictDetector, Conflict, ConflictResolution } from './conflict-detector';
import { DataValidator } from '../utils/data-validator';
import { PathGenerator } from './path-generator';
import { FileManager } from '../utils/file-manager';
import { MarkdownBuilder } from '../utils/markdown-builder';
import { ContentProcessor } from './content-processor';
import { ConflictResolutionModal } from '../ui/conflict-modal';
import { Logger } from '../utils/logger';
import { ErrorHandler } from '../utils/error-handler';

export interface EnhancedSyncOptions {
  showConflictModal?: boolean;
  autoResolveStrategy?: 'local' | 'remote' | 'backup';
  validateData?: boolean;
  dryRun?: boolean;
}

export class EnhancedSyncEngine {
  private stateManager: EnhancedStateManager;
  private conflictDetector: ConflictDetector;
  private dataValidator: DataValidator;
  private pathGenerator: PathGenerator;
  private fileManager: FileManager;
  private contentProcessor: ContentProcessor;
  private logger: Logger;
  private errorHandler: ErrorHandler;
  
  private isSyncing = false;
  private isCancelled = false;
  private currentProgress = {
    current: 0,
    total: 0,
    message: '',
    phase: 'idle' as 'idle' | 'fetching' | 'processing' | 'complete'
  };
  
  constructor(
    private plugin: GranolaSyncPlugin,
    private granolaService: any
  ) {
    this.logger = new Logger('EnhancedSyncEngine', plugin.settings);
    this.errorHandler = new ErrorHandler(this.logger);
    this.stateManager = new EnhancedStateManager(plugin, this.logger);
    this.conflictDetector = new ConflictDetector(plugin.app, this.logger);
    this.dataValidator = new DataValidator(this.logger);
    this.pathGenerator = new PathGenerator(plugin.app, plugin.settings);
    this.fileManager = new FileManager(plugin.app);
    this.contentProcessor = new ContentProcessor();
  }

  async initialize(): Promise<void> {
    await this.stateManager.initialize();
  }

  async sync(options: EnhancedSyncOptions = {}): Promise<SyncResult> {
    if (this.isSyncing) {
      throw new Error('Sync already in progress');
    }

    this.isSyncing = true;
    this.isCancelled = false;
    
    const result: SyncResult = {
      success: true,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [],
      duration: 0
    };

    const startTime = Date.now();
    
    try {
      // Begin transaction
      this.stateManager.beginTransaction(`sync-${Date.now()}`);
      
      // Test connection
      this.updateProgress(0, 0, 'Testing connection...');
      const isConnected = await this.granolaService.testConnection();
      if (!isConnected) {
        throw new Error('Failed to connect to Granola. Please check your API key.');
      }
      
      // Fetch meetings
      this.updateProgress(0, 0, 'Fetching meetings...');
      const lastSync = this.stateManager.getLastSync();
      const meetings = lastSync 
        ? await this.granolaService.getMeetingsSince(lastSync)
        : await this.granolaService.getAllMeetings();
      
      if (meetings.length === 0) {
        this.logger.info('No meetings to sync');
        this.stateManager.commitTransaction();
        return {
          ...result,
          duration: Date.now() - startTime
        };
      }
      
      this.logger.info(`Found ${meetings.length} meetings to process`);
      
      // Validate and sanitize meetings if requested
      const validMeetings: Meeting[] = [];
      if (options.validateData) {
        for (const meeting of meetings) {
          const validation = this.dataValidator.validateMeeting(meeting);
          if (validation.isValid) {
            const sanitized = this.dataValidator.sanitizeMeeting(meeting);
            validMeetings.push(sanitized);
          } else {
            this.logger.warn(`Invalid meeting data: ${meeting.id}`, validation.errors);
            result.errors.push({
              meetingId: meeting.id,
              meetingTitle: meeting.title || 'Unknown',
              error: 'Invalid meeting data',
              timestamp: new Date()
            });
          }
        }
      } else {
        validMeetings.push(...meetings);
      }
      
      // Detect conflicts
      const allConflicts = await this.detectAllConflicts(validMeetings);
      
      // Handle conflicts
      let conflictResolutions: Map<string, ConflictResolution> = new Map();
      if (allConflicts.length > 0) {
        if (options.showConflictModal && !options.dryRun) {
          conflictResolutions = await this.showConflictModal(allConflicts);
        } else {
          // Auto-resolve based on strategy
          allConflicts.forEach(conflict => {
            const resolution = this.getAutoResolution(conflict, options.autoResolveStrategy);
            conflictResolutions.set(conflict.granolaId, resolution);
          });
        }
      }
      
      // Process meetings
      for (let i = 0; i < validMeetings.length; i++) {
        if (this.isCancelled) {
          this.stateManager.rollbackTransaction();
          result.success = false;
          result.errors.push({
            meetingId: '',
            meetingTitle: '',
            error: 'Sync cancelled by user',
            timestamp: new Date()
          });
          break;
        }
        
        const meeting = validMeetings[i];
        this.updateProgress(i + 1, validMeetings.length, `Processing: ${meeting.title}`);
        
        try {
          const processed = await this.processMeetingWithConflicts(
            meeting,
            conflictResolutions.get(meeting.id),
            options.dryRun || false
          );
          
          if (processed.created) result.created++;
          else if (processed.updated) result.updated++;
          else if (processed.skipped) result.skipped++;
          
        } catch (error) {
          const syncError = this.errorHandler.handleError(error, `Meeting: ${meeting.title}`);
          syncError.meetingId = meeting.id;
          syncError.meetingTitle = meeting.title;
          result.errors.push(syncError);
        }
      }
      
      // Cleanup orphaned entries
      if (!options.dryRun) {
        const cleaned = await this.stateManager.cleanupOrphanedEntries();
        if (cleaned > 0) {
          this.logger.info(`Cleaned up ${cleaned} orphaned entries`);
        }
      }
      
      // Update last sync time and commit
      if (result.success && !options.dryRun) {
        this.stateManager.setLastSync(new Date().toISOString());
        this.stateManager.commitTransaction();
        await this.stateManager.saveState();
      } else if (!result.success) {
        this.stateManager.rollbackTransaction();
      }
      
      result.duration = Date.now() - startTime;
      this.updateProgress(validMeetings.length, validMeetings.length, 'Sync complete');
      
      return result;
      
    } catch (error) {
      this.stateManager.rollbackTransaction();
      const syncError = this.errorHandler.handleError(error, 'Sync operation');
      result.success = false;
      result.errors.push(syncError);
      result.duration = Date.now() - startTime;
      
      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  private async detectAllConflicts(meetings: Meeting[]): Promise<Conflict[]> {
    const allConflicts: Conflict[] = [];
    const existingFiles = new Map<string, TFile>();
    
    // Build file map
    this.plugin.app.vault.getMarkdownFiles().forEach(file => {
      existingFiles.set(file.path, file);
    });
    
    for (const meeting of meetings) {
      const metadata = this.stateManager.getFileMetadata(meeting.id);
      const remotePath = await this.pathGenerator.generatePath(meeting);
      const remoteModifiedTime = meeting.date.getTime();
      
      const conflicts = await this.conflictDetector.detectConflicts(
        meeting.id,
        remotePath,
        remoteModifiedTime,
        metadata,
        existingFiles
      );
      
      allConflicts.push(...conflicts);
    }
    
    return allConflicts;
  }

  private async showConflictModal(conflicts: Conflict[]): Promise<Map<string, ConflictResolution>> {
    return new Promise((resolve) => {
      const modal = new ConflictResolutionModal(
        this.plugin.app,
        conflicts,
        (result) => {
          const resolutions = new Map<string, ConflictResolution>();
          result.conflicts.forEach(({ conflict, resolution }) => {
            resolutions.set(conflict.granolaId, resolution);
          });
          resolve(resolutions);
        }
      );
      modal.open();
    });
  }

  private getAutoResolution(
    conflict: Conflict,
    strategy?: 'local' | 'remote' | 'backup'
  ): ConflictResolution {
    if (strategy === 'local') {
      return ConflictResolution.KEEP_LOCAL;
    } else if (strategy === 'remote') {
      return ConflictResolution.KEEP_REMOTE;
    } else if (strategy === 'backup') {
      return ConflictResolution.BACKUP_AND_UPDATE;
    }
    
    // Default strategy based on conflict type
    return this.conflictDetector.suggestResolution(conflict);
  }

  private async processMeetingWithConflicts(
    meeting: Meeting,
    resolution: ConflictResolution | undefined,
    dryRun: boolean
  ): Promise<{ created: boolean; updated: boolean; skipped: boolean }> {
    const metadata = this.stateManager.getFileMetadata(meeting.id);
    const targetPath = await this.pathGenerator.generatePath(meeting);
    
    // Handle based on resolution
    if (resolution === ConflictResolution.SKIP) {
      this.logger.info(`Skipping meeting due to conflict resolution: ${meeting.title}`);
      return { created: false, updated: false, skipped: true };
    }
    
    if (resolution === ConflictResolution.KEEP_LOCAL) {
      this.logger.info(`Keeping local version: ${meeting.title}`);
      // Still update metadata for tracking
      if (!dryRun && metadata) {
        const content = await this.plugin.app.vault.read(
          this.plugin.app.vault.getAbstractFileByPath(metadata.path) as TFile
        );
        const contentHash = await this.conflictDetector.calculateContentHash(
          this.extractContent(content)
        );
        await this.stateManager.addOrUpdateFile(
          meeting.id,
          metadata.path,
          contentHash,
          metadata.syncVersion + 1
        );
      }
      return { created: false, updated: false, skipped: true };
    }
    
    // Handle file operations
    let existingFile: TFile | undefined;
    if (metadata) {
      const file = this.plugin.app.vault.getAbstractFileByPath(metadata.path);
      if (file instanceof TFile) {
        existingFile = file;
      }
    }
    
    // Backup if needed
    if (resolution === ConflictResolution.BACKUP_AND_UPDATE && existingFile && !dryRun) {
      await this.conflictDetector.createBackup(existingFile);
    }
    
    // Generate content
    let content: string;
    if (resolution === ConflictResolution.MERGE && existingFile) {
      content = await this.conflictDetector.mergeContent(
        existingFile,
        MarkdownBuilder.buildMeetingNote(meeting)
      );
    } else {
      content = MarkdownBuilder.buildMeetingNote(meeting);
    }
    
    // Create or update file
    if (!dryRun) {
      const { created } = await this.fileManager.createOrUpdateFile(
        targetPath,
        content,
        meeting
      );
      
      // Update state
      const contentHash = await this.conflictDetector.calculateContentHash(
        this.extractContent(content)
      );
      await this.stateManager.addOrUpdateFile(
        meeting.id,
        targetPath,
        contentHash,
        (metadata?.syncVersion || 0) + 1
      );
      
      return { created, updated: !created, skipped: false };
    }
    
    return { created: !existingFile, updated: !!existingFile, skipped: false };
  }

  private extractContent(fullContent: string): string {
    const frontmatterRegex = /^---\n[\s\S]*?\n---\n/;
    return fullContent.replace(frontmatterRegex, '').trim();
  }

  private updateProgress(current: number, total: number, message: string): void {
    this.currentProgress = {
      current,
      total,
      message,
      phase: current === 0 ? 'fetching' : current === total ? 'complete' : 'processing'
    };
    this.logger.debug(`Progress: ${current}/${total} - ${message}`);
  }

  getProgress() {
    return { ...this.currentProgress };
  }

  cancelSync(): void {
    this.isCancelled = true;
  }

  getStateManager(): EnhancedStateManager {
    return this.stateManager;
  }
}