import { TFile, Notice } from 'obsidian';
import GranolaSyncPlugin from '../main';
import { Meeting, SyncResult, SyncError } from '../types';
import { EnhancedStateManager } from './enhanced-state-manager';
import { ConflictDetector, Conflict, ConflictResolution } from './conflict-detector';
import { DataValidator } from '../utils/data-validator';
import { PathGenerator } from './path-generator';
import { FileManager } from '../utils/file-manager';
import { MarkdownBuilder } from '../utils/markdown-builder';
import { ConflictResolutionModal } from '../ui/conflict-modal';
import { StructuredLogger } from '../utils/structured-logger';
import { ErrorHandler } from '../utils/error-handler';
import { PerformanceMonitor } from '../utils/performance-monitor';
import { ErrorTracker } from '../utils/error-tracker';
import { AdaptiveBatcher } from '../utils/adaptive-batcher';
import { EnhancedGranolaService } from './enhanced-granola-service';
import { LargeDatasetHandler } from './large-dataset-handler';
import { RecoveryManager } from './recovery-manager';

export interface HardenedSyncOptions {
  showConflictModal?: boolean;
  autoResolveStrategy?: 'local' | 'remote' | 'backup';
  validateData?: boolean;
  dryRun?: boolean;
  adaptiveBatching?: boolean;
  performanceTracking?: boolean;
  enableRecovery?: boolean;
  maxMeetings?: number;
}

export class HardenedSyncEngine {
  private stateManager: EnhancedStateManager;
  private conflictDetector: ConflictDetector;
  private dataValidator: DataValidator;
  private pathGenerator: PathGenerator;
  private fileManager: FileManager;
  private logger: StructuredLogger;
  private errorHandler: ErrorHandler;
  private performanceMonitor: PerformanceMonitor;
  private errorTracker: ErrorTracker;
  private adaptiveBatcher: AdaptiveBatcher<Meeting>;
  private granolaService: EnhancedGranolaService;
  private largeDatasetHandler: LargeDatasetHandler;
  private recoveryManager: RecoveryManager;
  
  private isSyncing = false;
  private isCancelled = false;
  private abortController: AbortController | null = null;
  private currentProgress = {
    current: 0,
    total: 0,
    message: '',
    phase: 'idle' as 'idle' | 'fetching' | 'processing' | 'complete',
    startTime: 0,
    estimatedTimeRemaining: 0
  };
  
  constructor(
    private plugin: GranolaSyncPlugin,
    apiKey: string
  ) {
    this.logger = new StructuredLogger('HardenedSyncEngine', plugin);
    this.errorHandler = new ErrorHandler(this.logger);
    this.performanceMonitor = new PerformanceMonitor(this.logger);
    this.errorTracker = new ErrorTracker(this.logger);
    
    this.granolaService = new EnhancedGranolaService(
      { apiKey },
      this.logger,
      this.performanceMonitor,
      this.errorTracker
    );
    
    this.stateManager = new EnhancedStateManager(plugin, this.logger);
    this.conflictDetector = new ConflictDetector(plugin.app, this.logger);
    this.dataValidator = new DataValidator(this.logger);
    this.pathGenerator = new PathGenerator(plugin.app, plugin.settings);
    this.fileManager = new FileManager(plugin.app);
    this.largeDatasetHandler = new LargeDatasetHandler(this.logger, this.performanceMonitor);
    this.recoveryManager = new RecoveryManager(plugin, this.stateManager, this.logger);
    
    // Initialize adaptive batcher
    this.adaptiveBatcher = new AdaptiveBatcher(
      this.logger,
      this.performanceMonitor,
      {
        minSize: 10,
        maxSize: 100,
        targetDurationMs: 500,
        adjustmentFactor: 0.3
      }
    );
  }

  async initialize(): Promise<void> {
    const operationId = this.logger.startOperation('engine-initialization');
    
    try {
      await this.stateManager.initialize();
      
      // Check for pending recovery
      const recoveryPoint = await this.recoveryManager.checkRecovery();
      if (recoveryPoint) {
        new Notice('Found incomplete sync. Would you like to resume?');
        this.logger.info('Pending recovery found', {
          recoveryId: recoveryPoint.id,
          phase: recoveryPoint.phase,
          progress: recoveryPoint.progress
        });
      }
      
      this.logger.endOperation(operationId, true);
    } catch (error) {
      this.logger.endOperation(operationId, false, { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  async sync(options: HardenedSyncOptions = {}): Promise<SyncResult> {
    if (this.isSyncing) {
      throw new Error('Sync already in progress');
    }

    const syncOperationId = this.logger.startOperation('sync', { options });
    this.isSyncing = true;
    this.isCancelled = false;
    this.abortController = new AbortController();
    
    const result: SyncResult = {
      success: true,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [],
      duration: 0
    };

    const startTime = Date.now();
    this.currentProgress.startTime = startTime;
    
    let recoveryId: string | undefined;
    
    try {
      // Begin transaction
      this.stateManager.beginTransaction(`sync-${Date.now()}`);
      
      // Test connection
      this.updateProgress(0, 0, 'Testing connection...', 'fetching');
      const connectionTest = await this.performanceMonitor.measureAsync(
        'test-connection',
        () => this.granolaService.testConnection()
      );
      
      if (!connectionTest) {
        throw new Error('Failed to connect to Granola. Please check your API key.');
      }
      
      // Check for pending recovery
      if (options.enableRecovery !== false) {
        const recoveryPoint = await this.recoveryManager.checkRecovery();
        if (recoveryPoint) {
          const recovered = await this.recoveryManager.attemptRecovery(recoveryPoint);
          if (recovered) {
            this.logger.info('Resumed from recovery point');
          }
        }
      }
      
      // Fetch meetings with streaming support
      this.updateProgress(0, 0, 'Fetching meetings...', 'fetching');
      const meetings = await this.fetchMeetingsWithProgress(options);
      
      if (meetings.length === 0) {
        this.logger.info('No meetings to sync');
        this.stateManager.commitTransaction();
        this.logger.endOperation(syncOperationId, true, { meetingCount: 0 });
        return {
          ...result,
          duration: Date.now() - startTime
        };
      }
      
      // Start recovery tracking
      if (options.enableRecovery !== false) {
        recoveryId = await this.recoveryManager.startRecoveryTracking(meetings.length);
      }
      
      this.logger.info('Found meetings to process', { count: meetings.length });
      
      // Validate and sanitize meetings
      const validMeetings = await this.validateMeetings(meetings, options, result);
      
      // Split by size for optimal processing
      const { small, medium, large } = this.largeDatasetHandler.splitMeetingsBySize(validMeetings);
      
      this.logger.info('Meetings categorized by size', {
        small: small.length,
        medium: medium.length,
        large: large.length
      });
      
      // Detect conflicts
      const allConflicts = await this.performanceMonitor.measureAsync(
        'detect-conflicts',
        () => this.detectAllConflicts(validMeetings),
        { meetingCount: validMeetings.length }
      );
      
      // Handle conflicts
      const conflictResolutions = await this.handleConflicts(allConflicts, options);
      
      // Process meetings by size category
      await this.processMeetingsBySize(
        { small, medium, large },
        conflictResolutions,
        options,
        result,
        recoveryId
      );
      
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
      this.updateProgress(validMeetings.length, validMeetings.length, 'Sync complete', 'complete');
      
      // Complete recovery tracking
      if (recoveryId) {
        await this.recoveryManager.completeRecovery(result);
      }
      
      // Generate reports
      this.generateSyncReports(result, options);
      
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
      
      // Handle recovery
      if (recoveryId && error instanceof Error) {
        await this.recoveryManager.handleFailure(error);
      }
      
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
      this.abortController = null;
    }
  }

  private async fetchMeetingsWithProgress(options: HardenedSyncOptions): Promise<Meeting[]> {
    const lastSync = this.stateManager.getLastSync();
    const meetings: Meeting[] = [];
    
    // Create batched API generator
    const generator = this.largeDatasetHandler.createBatchedApiGenerator(
      async (page) => {
        if (lastSync) {
          return this.granolaService.getMeetingsSince(lastSync);
        } else {
          return this.granolaService.getAllMeetings();
        }
      }
    );
    
    // Process with streaming
    let batchCount = 0;
    for await (const batch of generator) {
      meetings.push(...batch);
      batchCount++;
      
      this.updateProgress(0, meetings.length, `Fetched ${meetings.length} meetings...`, 'fetching');
      
      // Check max meetings limit
      if (options.maxMeetings && meetings.length >= options.maxMeetings) {
        this.logger.info('Reached maximum meetings limit', {
          limit: options.maxMeetings,
          fetched: meetings.length
        });
        break;
      }
      
      // Check cancellation
      if (this.abortController?.signal.aborted) {
        throw new Error('Sync cancelled during fetch');
      }
    }
    
    return meetings.slice(0, options.maxMeetings);
  }

  private async processMeetingsBySize(
    categorized: { small: Meeting[]; medium: Meeting[]; large: Meeting[] },
    conflictResolutions: Map<string, ConflictResolution>,
    options: HardenedSyncOptions,
    result: SyncResult,
    recoveryId?: string
  ): Promise<void> {
    const allMeetings = [...categorized.large, ...categorized.medium, ...categorized.small];
    const total = allMeetings.length;
    
    // Process large meetings individually
    if (categorized.large.length > 0) {
      this.logger.info('Processing large meetings individually');
      for (const meeting of categorized.large) {
        await this.processSingleMeeting(
          meeting,
          conflictResolutions.get(meeting.id),
          options,
          result,
          recoveryId
        );
      }
    }
    
    // Process medium meetings in small batches
    if (categorized.medium.length > 0) {
      this.logger.info('Processing medium meetings in batches');
      await this.largeDatasetHandler.processInChunks(
        categorized.medium,
        async (batch) => {
          const results = [];
          for (const meeting of batch) {
            const processed = await this.processSingleMeeting(
              meeting,
              conflictResolutions.get(meeting.id),
              options,
              result,
              recoveryId
            );
            results.push(processed);
          }
          return results;
        },
        {
          chunkSize: 10,
          maxConcurrency: 1,
          onProgress: (processed, _) => {
            const totalProcessed = categorized.large.length + processed;
            this.updateProgress(totalProcessed, total, 'Processing meetings...', 'processing');
          },
          abortSignal: this.abortController?.signal
        }
      );
    }
    
    // Process small meetings in larger batches with adaptive sizing
    if (categorized.small.length > 0) {
      this.logger.info('Processing small meetings with adaptive batching');
      await this.adaptiveBatcher.processBatches(
        categorized.small,
        async (batch) => {
          const results = [];
          for (const meeting of batch) {
            const processed = await this.processSingleMeeting(
              meeting,
              conflictResolutions.get(meeting.id),
              options,
              result,
              recoveryId
            );
            results.push(processed);
          }
          return results;
        },
        (processed, _) => {
          const totalProcessed = categorized.large.length + categorized.medium.length + processed;
          this.updateProgress(totalProcessed, total, 'Processing meetings...', 'processing');
        }
      );
    }
  }

  private async processSingleMeeting(
    meeting: Meeting,
    resolution: ConflictResolution | undefined,
    options: HardenedSyncOptions,
    result: SyncResult,
    recoveryId?: string
  ): Promise<{ created: boolean; updated: boolean; skipped: boolean }> {
    try {
      const processed = await this.processMeetingWithConflicts(
        meeting,
        resolution,
        options.dryRun || false
      );
      
      if (processed.created) result.created++;
      else if (processed.updated) result.updated++;
      else if (processed.skipped) result.skipped++;
      
      // Update recovery progress
      if (recoveryId) {
        await this.recoveryManager.updateProgress(
          result.created + result.updated + result.skipped,
          meeting.id,
          result
        );
      }
      
      return processed;
      
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
      
      return { created: false, updated: false, skipped: false };
    }
  }

  private async validateMeetings(
    meetings: Meeting[],
    options: HardenedSyncOptions,
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
              errors: validation.errors,
              warnings: validation.warnings
            });
            
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
    options: HardenedSyncOptions
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

  private updateProgress(
    current: number,
    total: number,
    message: string,
    phase: 'idle' | 'fetching' | 'processing' | 'complete'
  ): void {
    this.currentProgress = {
      current,
      total,
      message,
      phase,
      startTime: this.currentProgress.startTime,
      estimatedTimeRemaining: this.calculateTimeRemaining(current, total)
    };
    
    this.logger.debug('Progress update', this.currentProgress);
  }

  private calculateTimeRemaining(current: number, total: number): number {
    if (current === 0 || total === 0) {
      return 0;
    }
    
    const elapsed = Date.now() - this.currentProgress.startTime;
    const rate = current / elapsed;
    const remaining = total - current;
    
    return remaining / rate;
  }

  private generateSyncReports(result: SyncResult, options: HardenedSyncOptions): void {
    // Log performance report
    if (options.performanceTracking !== false) {
      const perfReport = this.performanceMonitor.getReport();
      this.logger.info('Performance Report', perfReport);
      
      // Log slow operations
      const slowOps = this.performanceMonitor.getSlowOperations(1000);
      if (slowOps.length > 0) {
        this.logger.warn('Slow operations detected', {
          count: slowOps.length,
          operations: slowOps.slice(0, 5).map(op => ({
            name: op.name,
            duration: op.duration,
            metadata: op.metadata
          }))
        });
      }
    }
    
    // Log error report if there were errors
    if (result.errors.length > 0) {
      const errorStats = this.errorTracker.getStats();
      this.logger.info('Error Report', errorStats);
      
      // Log frequent errors
      const frequentErrors = this.errorTracker.getFrequentErrors();
      if (frequentErrors.length > 0) {
        this.logger.warn('Frequent error patterns', {
          patterns: frequentErrors.map(({ key, pattern }) => ({
            key,
            count: pattern.count,
            lastOccurrence: pattern.lastOccurrence
          }))
        });
      }
    }
    
    // Log API rate limit status
    const rateLimitInfo = this.granolaService.getRateLimitInfo();
    if (rateLimitInfo) {
      this.logger.info('API Rate Limit Status', rateLimitInfo);
    }
  }

  getProgress() {
    return { ...this.currentProgress };
  }

  cancelSync(): void {
    this.isCancelled = true;
    this.abortController?.abort();
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
  
  getRecoveryStats() {
    return this.recoveryManager.getRecoveryStats();
  }
  
  async cleanup(): Promise<void> {
    this.recoveryManager.cleanup();
    this.cancelSync();
  }
}