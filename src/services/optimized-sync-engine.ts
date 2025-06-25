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
import { StructuredLogger } from '../utils/structured-logger';
import { ErrorHandler } from '../utils/error-handler';
import { PerformanceMonitor } from '../utils/performance-monitor';
import { ErrorTracker } from '../utils/error-tracker';
import { AdaptiveBatcher } from '../utils/adaptive-batcher';

export interface OptimizedSyncOptions {
  showConflictModal?: boolean;
  autoResolveStrategy?: 'local' | 'remote' | 'backup';
  validateData?: boolean;
  dryRun?: boolean;
  adaptiveBatching?: boolean;
  performanceTracking?: boolean;
}

export class OptimizedSyncEngine {
  private stateManager: EnhancedStateManager;
  private conflictDetector: ConflictDetector;
  private dataValidator: DataValidator;
  private pathGenerator: PathGenerator;
  private fileManager: FileManager;
  private contentProcessor: ContentProcessor;
  private logger: StructuredLogger;
  private errorHandler: ErrorHandler;
  private performanceMonitor: PerformanceMonitor;
  private errorTracker: ErrorTracker;
  private adaptiveBatcher: AdaptiveBatcher<Meeting>;
  
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
    this.logger = new StructuredLogger('OptimizedSyncEngine', plugin);
    this.errorHandler = new ErrorHandler(this.logger);
    this.performanceMonitor = new PerformanceMonitor(this.logger);
    this.errorTracker = new ErrorTracker(this.logger);
    this.stateManager = new EnhancedStateManager(plugin, this.logger);
    this.conflictDetector = new ConflictDetector(plugin.app, this.logger);
    this.dataValidator = new DataValidator(this.logger);
    this.pathGenerator = new PathGenerator(plugin.app, plugin.settings);
    this.fileManager = new FileManager(plugin.app);
    this.contentProcessor = new ContentProcessor();
    
    // Initialize adaptive batcher with performance-based config
    this.adaptiveBatcher = new AdaptiveBatcher(
      this.logger,
      this.performanceMonitor,
      {
        minSize: 5,
        maxSize: 50,
        targetDurationMs: 500,
        adjustmentFactor: 0.25
      }
    );
  }

  async initialize(): Promise<void> {
    const operationId = this.logger.startOperation('engine-initialization');
    
    try {
      await this.stateManager.initialize();
      this.logger.endOperation(operationId, true);
    } catch (error) {
      this.logger.endOperation(operationId, false, { error: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    }
  }

  async sync(options: OptimizedSyncOptions = {}): Promise<SyncResult> {
    if (this.isSyncing) {
      throw new Error('Sync already in progress');
    }

    const syncOperationId = this.logger.startOperation('sync', { options });
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
      
      // Test connection with performance tracking
      this.updateProgress(0, 0, 'Testing connection...');
      const connectionTest = await this.performanceMonitor.measureAsync(
        'test-connection',
        () => this.granolaService.testConnection()
      );
      
      if (!connectionTest) {
        throw new Error('Failed to connect to Granola. Please check your API key.');
      }
      
      // Fetch meetings with performance tracking
      this.updateProgress(0, 0, 'Fetching meetings...');
      const lastSync = this.stateManager.getLastSync();
      
      const meetings = await this.performanceMonitor.measureAsync(
        'fetch-meetings',
        async () => {
          if (lastSync) {
            return await this.granolaService.getMeetingsSince(lastSync);
          } else {
            return await this.granolaService.getAllMeetings();
          }
        },
        { lastSync: !!lastSync }
      );
      
      if (meetings.length === 0) {
        this.logger.info('No meetings to sync');
        this.stateManager.commitTransaction();
        this.logger.endOperation(syncOperationId, true, { meetingCount: 0 });
        return {
          ...result,
          duration: Date.now() - startTime
        };
      }
      
      this.logger.info('Found meetings to process', { count: meetings.length });
      
      // Validate and sanitize meetings if requested
      const validMeetings = await this.validateMeetings(meetings, options, result);
      
      // Detect conflicts
      const allConflicts = await this.performanceMonitor.measureAsync(
        'detect-conflicts',
        () => this.detectAllConflicts(validMeetings),
        { meetingCount: validMeetings.length }
      );
      
      // Handle conflicts
      const conflictResolutions = await this.handleConflicts(allConflicts, options);
      
      // Process meetings with adaptive batching
      if (options.adaptiveBatching !== false) {
        await this.processMeetingsAdaptive(validMeetings, conflictResolutions, options, result);
      } else {
        await this.processMeetingsSequential(validMeetings, conflictResolutions, options, result);
      }
      
      // Cleanup orphaned entries
      if (!options.dryRun) {
        const cleaned = await this.stateManager.cleanupOrphanedEntries();
        if (cleaned > 0) {
          this.logger.info('Cleaned up orphaned entries', { count: cleaned });
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
      
      // Log performance report
      if (options.performanceTracking !== false) {
        this.performanceMonitor.logReport();
      }
      
      // Log error report if there were errors
      if (result.errors.length > 0) {
        this.errorTracker.logReport();
      }
      
      this.logger.endOperation(syncOperationId, result.success, {
        created: result.created,
        updated: result.updated,
        skipped: result.skipped,
        errors: result.errors.length,
        duration: result.duration
      });
      
      return result;
      
    } catch (error) {
      this.stateManager.rollbackTransaction();
      const trackedErrorId = this.errorTracker.trackError(
        error instanceof Error ? error : new Error('Unknown error'),
        'sync',
        { phase: this.currentProgress.phase }
      );
      
      const syncError = this.errorHandler.handleError(error, 'Sync operation');
      result.success = false;
      result.errors.push(syncError);
      result.duration = Date.now() - startTime;
      
      this.logger.endOperation(syncOperationId, false, {
        error: syncError.error,
        errorId: trackedErrorId
      });
      
      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  private async validateMeetings(
    meetings: Meeting[],
    options: OptimizedSyncOptions,
    result: SyncResult
  ): Promise<Meeting[]> {
    if (!options.validateData) {
      return meetings;
    }
    
    return await this.performanceMonitor.measureAsync(
      'validate-meetings',
      async () => {
        const validMeetings: Meeting[] = [];
        
        for (const meeting of meetings) {
          const validation = this.dataValidator.validateMeeting(meeting);
          if (validation.isValid) {
            const sanitized = this.dataValidator.sanitizeMeeting(meeting);
            validMeetings.push(sanitized);
          } else {
            this.logger.warn('Invalid meeting data', {
              meetingId: meeting.id,
              errors: validation.errors
            });
            
            const errorId = this.errorTracker.trackError(
              new Error('Invalid meeting data'),
              'validation',
              { meetingId: meeting.id, validationErrors: validation.errors }
            );
            
            result.errors.push({
              meetingId: meeting.id,
              meetingTitle: meeting.title || 'Unknown',
              error: 'Invalid meeting data',
              timestamp: new Date()
            });
          }
        }
        
        return validMeetings;
      },
      { totalMeetings: meetings.length }
    );
  }

  private async processMeetingsAdaptive(
    meetings: Meeting[],
    conflictResolutions: Map<string, ConflictResolution>,
    options: OptimizedSyncOptions,
    result: SyncResult
  ): Promise<void> {
    const processor = async (batch: Meeting[]) => {
      const batchResults: Array<{ created: boolean; updated: boolean; skipped: boolean }> = [];
      
      for (const meeting of batch) {
        if (this.isCancelled) {
          throw new Error('Sync cancelled by user');
        }
        
        try {
          const processed = await this.processMeetingWithConflicts(
            meeting,
            conflictResolutions.get(meeting.id),
            options.dryRun || false
          );
          
          batchResults.push(processed);
          
          if (processed.created) result.created++;
          else if (processed.updated) result.updated++;
          else if (processed.skipped) result.skipped++;
          
        } catch (error) {
          const errorId = this.errorTracker.trackError(
            error instanceof Error ? error : new Error('Unknown error'),
            'meeting-processing',
            { meetingId: meeting.id, meetingTitle: meeting.title }
          );
          
          const syncError = this.errorHandler.handleError(error, `Meeting: ${meeting.title}`);
          syncError.meetingId = meeting.id;
          syncError.meetingTitle = meeting.title;
          result.errors.push(syncError);
          
          throw error; // Re-throw to trigger batch retry with smaller size
        }
      }
      
      return batchResults;
    };
    
    const onProgress = (processed: number, total: number) => {
      this.updateProgress(processed, total, 'Processing meetings...');
    };
    
    await this.adaptiveBatcher.processBatches(meetings, processor, onProgress);
  }

  private async processMeetingsSequential(
    meetings: Meeting[],
    conflictResolutions: Map<string, ConflictResolution>,
    options: OptimizedSyncOptions,
    result: SyncResult
  ): Promise<void> {
    for (let i = 0; i < meetings.length; i++) {
      if (this.isCancelled) {
        result.success = false;
        result.errors.push({
          meetingId: '',
          meetingTitle: '',
          error: 'Sync cancelled by user',
          timestamp: new Date()
        });
        break;
      }
      
      const meeting = meetings[i];
      this.updateProgress(i + 1, meetings.length, `Processing: ${meeting.title}`);
      
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
        const errorId = this.errorTracker.trackError(
          error instanceof Error ? error : new Error('Unknown error'),
          'meeting-processing',
          { meetingId: meeting.id, meetingTitle: meeting.title }
        );
        
        const syncError = this.errorHandler.handleError(error, `Meeting: ${meeting.title}`);
        syncError.meetingId = meeting.id;
        syncError.meetingTitle = meeting.title;
        result.errors.push(syncError);
      }
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

  private async handleConflicts(
    conflicts: Conflict[],
    options: OptimizedSyncOptions
  ): Promise<Map<string, ConflictResolution>> {
    const resolutions = new Map<string, ConflictResolution>();
    
    if (conflicts.length === 0) {
      return resolutions;
    }
    
    this.logger.info('Detected conflicts', {
      count: conflicts.length,
      types: conflicts.reduce((acc, c) => {
        acc[c.type] = (acc[c.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    });
    
    if (options.showConflictModal && !options.dryRun) {
      const modalResolutions = await this.showConflictModal(conflicts);
      modalResolutions.forEach((resolution, id) => {
        resolutions.set(id, resolution);
      });
    } else {
      // Auto-resolve based on strategy
      conflicts.forEach(conflict => {
        const resolution = this.getAutoResolution(conflict, options.autoResolveStrategy);
        resolutions.set(conflict.granolaId, resolution);
      });
    }
    
    return resolutions;
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
    return await this.performanceMonitor.measureAsync(
      'process-meeting',
      async () => {
        const metadata = this.stateManager.getFileMetadata(meeting.id);
        const targetPath = await this.pathGenerator.generatePath(meeting);
        
        // Handle based on resolution
        if (resolution === ConflictResolution.SKIP) {
          this.logger.info('Skipping meeting due to conflict resolution', {
            meetingId: meeting.id,
            meetingTitle: meeting.title
          });
          return { created: false, updated: false, skipped: true };
        }
        
        if (resolution === ConflictResolution.KEEP_LOCAL) {
          this.logger.info('Keeping local version', {
            meetingId: meeting.id,
            meetingTitle: meeting.title
          });
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
      },
      { meetingId: meeting.id }
    );
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
    this.logger.debug('Progress update', this.currentProgress);
  }

  getProgress() {
    return { ...this.currentProgress };
  }

  cancelSync(): void {
    this.isCancelled = true;
    this.logger.info('Sync cancelled by user');
  }

  getStateManager(): EnhancedStateManager {
    return this.stateManager;
  }
  
  getPerformanceReport() {
    return this.performanceMonitor.getReport();
  }
  
  getErrorReport() {
    return this.errorTracker.getStats();
  }
  
  getLogExport() {
    return this.logger.exportLogs();
  }
}