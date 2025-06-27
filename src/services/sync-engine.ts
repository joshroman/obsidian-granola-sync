import { EnhancedStateManager } from './enhanced-state-manager';
import { EnhancedGranolaService } from './enhanced-granola-service';
import { PathGenerator } from '../utils/path-generator';
import { FileManager } from '../utils/file-manager';
import { MarkdownBuilder } from '../utils/markdown-builder';
import { SyncResult, SyncProgress, Meeting, SyncError, DocumentPanel, PluginSettings } from '../types';
import { Plugin, TFile } from 'obsidian';
import { Logger } from '../utils/logger';
import { ChunkedContentProcessor } from '../utils/chunked-processor';
import { ErrorHandler } from '../utils/error-handler';
import { PanelProcessor } from './panel-processor';
import { ConflictDetector, ConflictType, Conflict, ConflictResolution } from './conflict-detector';
import { ConflictResolutionModal } from '../ui/conflict-modal';
import GranolaSyncPlugin from '../main';

export class SyncEngine {
  private isCancelled: boolean = false;
  private syncLock: boolean = false;
  private syncQueue: (() => Promise<SyncResult>)[] = [];
  private readonly MAX_QUEUE_SIZE = 10;
  private currentProgress: SyncProgress = { current: 0, total: 0, message: 'Idle' };
  private fileManager: FileManager;
  private contentProcessor: ChunkedContentProcessor;
  private errorHandler: ErrorHandler;
  private batchStartTimes: number[] = [];
  private lastSyncResult: SyncResult | null = null;
  private panelProcessor: PanelProcessor;
  private conflictDetector: ConflictDetector;
  private enableConflictDetection: boolean = true; // Can be controlled via settings
  
  constructor(
    private stateManager: EnhancedStateManager,
    private granolaService: EnhancedGranolaService,
    private pathGenerator: PathGenerator,
    private plugin: Plugin & { settings: PluginSettings },
    private logger: Logger
  ) {
    this.fileManager = new FileManager(plugin, logger);
    this.contentProcessor = new ChunkedContentProcessor(logger);
    this.errorHandler = new ErrorHandler(logger);
    this.conflictDetector = new ConflictDetector(plugin.app, logger);
    // Get the panel processor from the plugin instance
    this.panelProcessor = (plugin as GranolaSyncPlugin).panelProcessor;
  }
  
  /**
   * Enable or disable conflict detection
   */
  setConflictDetection(enabled: boolean): void {
    this.enableConflictDetection = enabled;
    this.logger.info(`Conflict detection ${enabled ? 'enabled' : 'disabled'}`);
  }
  
  async sync(forceAll: boolean = false): Promise<SyncResult> {
    // Queue sync request if one is already in progress
    if (this.syncLock) {
      // Check queue size limit
      if (this.syncQueue.length >= this.MAX_QUEUE_SIZE) {
        throw new Error('Sync queue is full. Please try again later.');
      }
      
      return new Promise<SyncResult>((resolve, reject) => {
        this.syncQueue.push(async () => {
          try {
            const result = await this.performSync();
            resolve(result);
            return result;
          } catch (error) {
            reject(error);
            throw error;
          }
        });
        this.logger.info(`Sync request queued. Position in queue: ${this.syncQueue.length}`);
      });
    }
    
    return this.performSync(forceAll);
  }
  
  private async performSync(forceAll: boolean = false): Promise<SyncResult> {
    this.syncLock = true;
    this.isCancelled = false;
    const startTime = Date.now();
    
    const result: SyncResult = {
      success: true,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [],
      duration: 0
    };
    
    try {
      this.updateProgress(0, 0, 'Connecting to Granola...');
      
      // Test connection first
      const isConnected = await this.granolaService.testConnection();
      if (!isConnected) {
        throw new Error('Failed to connect to Granola. Please check your API key.');
      }
      
      // Fetch meetings
      this.updateProgress(0, 0, 'Fetching meetings...');
      const lastSync = forceAll ? null : this.stateManager.getLastSync();
      this.logger.info(`Last sync timestamp: ${lastSync || 'none (will fetch all meetings)'}`);
      this.logger.info(`Force all sync: ${forceAll}`);
      const meetings = lastSync 
        ? await this.granolaService.getMeetingsSince(lastSync)
        : await this.granolaService.getAllMeetings();
      
      this.logger.info(`Fetched ${meetings.length} meetings from Granola API`);
      if (meetings.length === 0) {
        this.logger.warn('No meetings returned from Granola API. Possible causes:', {
          hasApiKey: !!this.plugin.settings.apiKey,
          lastSync: lastSync,
          forceAll: forceAll
        });
      }
      
      // Log current sync settings for debugging
      this.logger.info('Current sync settings:', {
        onlyCompletedMeetings: this.plugin.settings.onlyCompletedMeetings,
        templateFilterEnabled: this.plugin.settings.templateFilterEnabled,
        templateFilterName: this.plugin.settings.templateFilterName || 'none',
        folderOrganization: this.plugin.settings.folderOrganization,
        includeDateInFilename: this.plugin.settings.includeDateInFilename,
        targetFolder: this.plugin.settings.targetFolder,
        dateFolderFormat: this.plugin.settings.dateFolderFormat
      });
      
      // Optionally filter out in-progress meetings
      let completedMeetings = meetings;
      if (this.plugin.settings.onlyCompletedMeetings) {
        this.logger.warn(`Meeting completion filter is ENABLED - checking each meeting...`);
        completedMeetings = meetings.filter(meeting => {
          const isComplete = this.granolaService.isMeetingComplete(meeting);
          if (!isComplete) {
            this.logger.warn(`FILTER REASON: Meeting marked as incomplete`, {
              meetingId: meeting.id,
              meetingTitle: meeting.title,
              hasSummary: !!meeting.summary,
              summaryLength: meeting.summary?.length || 0
            });
          }
          return isComplete;
        });
        
        const inProgressCount = meetings.length - completedMeetings.length;
        if (inProgressCount > 0) {
          this.logger.warn(`FILTERED OUT ${inProgressCount} meetings as incomplete`);
        }
      } else {
        this.logger.info(`Meeting completion filter is DISABLED - processing all meetings`);
      }
      
      if (completedMeetings.length === 0) {
        this.logger.info('No completed meetings to sync');
        return {
          ...result,
          duration: Date.now() - startTime
        };
      }
      
      this.logger.info(`Found ${completedMeetings.length} completed meetings to process`);
      
      // Process in batches with adaptive sizing
      let batchSize = this.getOptimalBatchSize(completedMeetings.length);
      let processedCount = 0;
      
      while (processedCount < completedMeetings.length) {
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
        
        const batch = completedMeetings.slice(processedCount, processedCount + batchSize);
        const batchStartTime = Date.now();
        
        await this.processBatch(batch, processedCount, completedMeetings.length, result);
        
        // Track actual processed count
        processedCount += batch.length;
        
        // Adapt batch size based on processing time
        const batchDuration = Date.now() - batchStartTime;
        batchSize = this.adaptBatchSize(batchSize, batchDuration, batch.length);
      }
      
      // Update last sync time
      if (result.success) {
        this.stateManager.setLastSync(new Date().toISOString());
        // saveState is handled internally by EnhancedStateManager
      }
      
      result.duration = Date.now() - startTime;
      this.updateProgress(completedMeetings.length, completedMeetings.length, 'Sync complete');
      
      // Log final results for debugging
      this.logger.info('Sync complete - Final results:', {
        totalMeetings: meetings.length,
        completedMeetings: completedMeetings.length,
        created: result.created,
        updated: result.updated,
        skipped: result.skipped,
        errors: result.errors.length,
        duration: result.duration
      });
      
      this.lastSyncResult = result;
      return result;
    } catch (error) {
      const syncError = this.errorHandler.handleError(error, 'Sync operation');
      result.success = false;
      result.errors.push(syncError);
      result.duration = Date.now() - startTime;
      return result;
    } finally {
      this.syncLock = false;
      
      // Process queued sync requests
      if (this.syncQueue.length > 0) {
        const nextSync = this.syncQueue.shift()!;
        // Process next sync after a short delay
        setTimeout(() => nextSync(), 100);
      }
    }
  }
  
  cancelSync() {
    this.isCancelled = true;
    if (this.logger) {
      this.logger.info('Sync cancelled');
    }
  }
  
  getProgress(): SyncProgress {
    return { ...this.currentProgress };
  }
  
  private async processBatch(
    meetings: Meeting[], 
    startIndex: number, 
    totalMeetings: number,
    result: SyncResult
  ): Promise<void> {
    // Fetch panels for all meetings in batch first
    const panelMap = await this.fetchPanelsForBatch(meetings);
    
    // Fetch transcripts for all meetings in batch if enabled
    const transcriptMap = await this.fetchTranscriptsForBatch(meetings);
    
    for (let i = 0; i < meetings.length; i++) {
      const meeting = meetings[i];
      const currentIndex = startIndex + i;
      let filePath: string | undefined;
      
      try {
        this.updateProgress(
          currentIndex + 1, 
          totalMeetings, 
          `Processing: ${meeting.title}`
        );
        
        // Check if user deleted this file
        if (this.stateManager.isDeleted(meeting.id)) {
          this.logger.warn(`SKIP REASON: Meeting marked as deleted in state manager`, {
            meetingId: meeting.id,
            meetingTitle: meeting.title
          });
          result.skipped++;
          continue;
        }
        
        // Check for conflicts if enabled
        let isAppendMode = false;
        if (this.enableConflictDetection) {
          const conflict = await this.detectConflict(meeting);
          if (conflict) {
            const resolution = await this.resolveConflict(conflict, meeting);
            if (resolution === ConflictResolution.SKIP) {
              this.logger.warn(`SKIP REASON: Conflict resolution chose to skip`, {
                meetingId: meeting.id,
                meetingTitle: meeting.title,
                conflictType: conflict.type
              });
              result.skipped++;
              continue;
            }
            if (resolution === ConflictResolution.KEEP_LOCAL) {
              // Mark for append mode
              isAppendMode = true;
              this.logger.info(`Will append new content for locally modified file: ${meeting.title}`);
            }
            // Apply other resolutions as needed
            await this.applyConflictResolution(conflict, resolution, meeting);
          }
        }
        
        // Add panels from pre-fetched map
        let panels = panelMap.get(meeting.id) || [];
        
        // Apply template filtering if enabled
        if (this.plugin.settings.templateFilterEnabled && this.plugin.settings.templateFilterName) {
          const originalCount = panels.length;
          panels = panels.filter(panel => {
            // For now, filter by panel title containing the template name
            // In the future, we might need to fetch template metadata
            const matches = panel.title.toLowerCase().includes(this.plugin.settings.templateFilterName.toLowerCase());
            if (!matches) {
              this.logger.debug(`Filtering out panel "${panel.title}" - doesn't match template filter "${this.plugin.settings.templateFilterName}"`);
            }
            return matches;
          });
          
          if (originalCount > 0 && panels.length === 0) {
            this.logger.warn(`All ${originalCount} panels filtered out for meeting: ${meeting.title}`);
          }
        }
        
        if (panels && panels.length > 0) {
          meeting.panels = panels;
          this.logger.info(`Added ${panels.length} panels to meeting: ${meeting.title}`, {
            panelTitles: panels.map(p => p.title),
            panelIds: panels.map(p => p.panel_template_id)
          });
        } else {
          this.logger.info(`No panels found for meeting: ${meeting.title}`, {
            meetingId: meeting.id
          });
        }
        
        // Add transcript if available
        const transcript = transcriptMap.get(meeting.id);
        if (transcript) {
          meeting.transcript = transcript;
          this.logger.info(`Added transcript to meeting: ${meeting.title}`, {
            transcriptLength: transcript.length
          });
        }
        
        // Generate file path
        filePath = this.pathGenerator.generatePath(meeting);
        const existingPath = this.stateManager.getFilePath(meeting.id);
        
        this.logger.info(`Processing meeting: ${meeting.title} (ID: ${meeting.id})`);
        this.logger.info(`Generated path: ${filePath}`);
        this.logger.info(`Existing path: ${existingPath || 'none'}`);
        
        // Validate the path
        if (!filePath || filePath.includes('undefined')) {
          this.logger.warn(`SKIP REASON: Invalid path generated`, {
            meetingId: meeting.id,
            meetingTitle: meeting.title,
            generatedPath: filePath,
            pathIncludesUndefined: filePath ? filePath.includes('undefined') : 'null path',
            granolaFolder: meeting.granolaFolder || 'none'
          });
          result.skipped++;
          continue;
        }
        
        // Check if file needs to be moved
        if (existingPath && existingPath !== filePath) {
          await this.handleFileMove(existingPath, filePath, meeting);
        }
        
        // Generate content with streaming for large transcripts
        let content: string;
        
        if (this.isLargeMeeting(meeting)) {
          // Use chunked processing for large meetings
          content = await this.contentProcessor.processLargeMeeting(meeting, async (chunk) => {
            // Progress callback for streaming
            this.updateProgress(
              currentIndex + 0.5, // Show partial progress
              totalMeetings,
              `Processing large meeting: ${meeting.title}`
            );
          });
        } else {
          // Use regular processing for normal meetings
          content = MarkdownBuilder.buildMeetingNote(meeting, undefined, this.panelProcessor);
        }
        
        // Create or update file
        const { created, file } = await this.fileManager.createOrUpdateFile(
          filePath,
          content,
          meeting,
          isAppendMode
        );
        
        // Update state with content hash and sync version
        const contentHash = this.calculateContentHash(content);
        // Use a version number - could be timestamp-based or incremental
        const syncVersion = Date.now();
        
        // Make sure file exists before updating state
        if (file) {
          await this.stateManager.addOrUpdateFile(meeting.id, filePath, contentHash, syncVersion);
        } else {
          this.logger.warn(`File creation succeeded but file object not returned for: ${filePath}`);
        }
        
        if (created) {
          result.created++;
          this.logger.info(`Created: ${filePath}`);
        } else {
          result.updated++;
          this.logger.info(`Updated: ${filePath}`);
        }
      } catch (error) {
        const syncError = this.errorHandler.handleError(error, `Meeting: ${meeting.title}`);
        syncError.meetingId = meeting.id;
        syncError.meetingTitle = meeting.title;
        result.errors.push(syncError);
        
        // Count file creation failures as skipped
        result.skipped++;
        this.logger.warn(`SKIP REASON: Failed to process meeting (caught exception)`, {
          meetingId: meeting.id,
          meetingTitle: meeting.title,
          error: error instanceof Error ? error.message : String(error),
          errorType: error instanceof Error ? error.constructor.name : typeof error,
          filePath: filePath
        });
      }
    }
  }
  
  private async handleFileMove(
    oldPath: string, 
    newPath: string, 
    meeting: Meeting
  ): Promise<void> {
    try {
      const oldFile = await this.fileManager.getFileByPath(oldPath);
      if (oldFile) {
        await this.plugin.app.vault.rename(oldFile, newPath);
        this.logger.info(`Moved file from ${oldPath} to ${newPath}`);
      }
    } catch (error) {
      this.logger.warn(`Failed to move file from ${oldPath} to ${newPath}:`, error);
    }
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
  
  /**
   * Determines if a meeting has large content that needs streaming
   */
  private isLargeMeeting(meeting: Meeting): boolean {
    const transcriptSize = meeting.transcript?.length || 0;
    const summarySize = meeting.summary?.length || 0;
    const highlightsSize = (meeting.highlights?.join('').length || 0);
    
    const totalSize = transcriptSize + summarySize + highlightsSize;
    
    // Consider large if over 1MB
    return totalSize > 1024 * 1024;
  }
  
  /**
   * Determine optimal batch size based on meeting count
   */
  private getOptimalBatchSize(totalMeetings: number): number {
    const defaultSize = (this.plugin as any).settings?.batchSize || 10;
    
    // For small syncs, use smaller batches for better progress feedback
    if (totalMeetings < 20) {
      return Math.min(5, defaultSize);
    }
    
    // For large syncs, allow larger batches but cap at 50
    if (totalMeetings > 100) {
      return Math.min(50, defaultSize * 2);
    }
    
    return defaultSize;
  }
  
  /**
   * Adapt batch size based on processing performance
   */
  private adaptBatchSize(currentSize: number, duration: number, processed: number): number {
    if (processed === 0) return currentSize;
    
    const timePerMeeting = duration / processed;
    const targetBatchTime = 3000; // Target 3 seconds per batch
    
    // Calculate ideal batch size
    const idealSize = Math.floor(targetBatchTime / timePerMeeting);
    
    // Apply constraints
    const minSize = 5;
    const maxSize = 50;
    const maxChange = 10; // Don't change by more than 10 at a time
    
    let newSize = Math.max(minSize, Math.min(maxSize, idealSize));
    
    // Limit change rate
    if (Math.abs(newSize - currentSize) > maxChange) {
      newSize = currentSize + (newSize > currentSize ? maxChange : -maxChange);
    }
    
    if (newSize !== currentSize) {
      this.logger.debug(`Adapted batch size from ${currentSize} to ${newSize} based on performance`);
    }
    
    return newSize;
  }
  
  getLastSyncResult(): SyncResult | null {
    return this.lastSyncResult;
  }
  
  /**
   * Fetch panels for a batch of meetings concurrently with rate limiting
   */
  private async fetchPanelsForBatch(meetings: Meeting[]): Promise<Map<string, DocumentPanel[]>> {
    const panelMap = new Map<string, DocumentPanel[]>();
    
    // Fetch panels concurrently with controlled concurrency
    const CONCURRENT_LIMIT = 5;
    for (let i = 0; i < meetings.length; i += CONCURRENT_LIMIT) {
      const batch = meetings.slice(i, i + CONCURRENT_LIMIT);
      const promises = batch.map(async (meeting) => {
        try {
          const panels = await this.granolaService.getDocumentPanels(meeting.id);
          return { id: meeting.id, panels };
        } catch (error) {
          this.logger.warn(`Failed to fetch panels for ${meeting.id}`, error);
          return { id: meeting.id, panels: [] };
        }
      });
      
      const results = await Promise.all(promises);
      results.forEach(({ id, panels }) => panelMap.set(id, panels));
    }
    
    return panelMap;
  }

  /**
   * Fetch transcripts for a batch of meetings if enabled
   */
  private async fetchTranscriptsForBatch(meetings: Meeting[]): Promise<Map<string, string>> {
    const transcriptMap = new Map<string, string>();
    
    // Only fetch if transcripts are enabled
    if (!this.plugin.settings.includeTranscripts) {
      return transcriptMap;
    }
    
    // Import transcript processor
    const { TranscriptProcessor } = await import('./transcript-processor');
    const transcriptProcessor = new TranscriptProcessor(this.logger);
    
    // Fetch transcripts concurrently with controlled concurrency
    const CONCURRENT_LIMIT = 3; // Lower limit for transcripts as they're larger
    for (let i = 0; i < meetings.length; i += CONCURRENT_LIMIT) {
      const batch = meetings.slice(i, i + CONCURRENT_LIMIT);
      const promises = batch.map(async (meeting) => {
        try {
          const segments = await this.granolaService.getDocumentTranscript(meeting.id);
          if (segments && segments.length > 0) {
            // Process segments with speaker identification
            const processedSegments = transcriptProcessor.processTranscript(
              segments,
              meeting.id,
              true, // deduplicate
              0.68, // similarity threshold
              4.5   // time window seconds
            );
            
            // Format as markdown
            const formattedTranscript = transcriptProcessor.formatTranscriptMarkdown(processedSegments);
            return { id: meeting.id, transcript: formattedTranscript };
          }
          return { id: meeting.id, transcript: '' };
        } catch (error) {
          this.logger.warn(`Failed to fetch transcript for ${meeting.id}`, error);
          return { id: meeting.id, transcript: '' };
        }
      });
      
      const results = await Promise.all(promises);
      results.forEach(({ id, transcript }) => {
        if (transcript) {
          transcriptMap.set(id, transcript);
        }
      });
    }
    
    return transcriptMap;
  }
  
  /**
   * Calculate content hash for state tracking
   * Compatible with EnhancedStateManager's hash calculation
   */
  private calculateContentHash(content: string): string {
    // Simple hash calculation - in production, this should match
    // the algorithm used by EnhancedStateManager
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }
  
  /**
   * Detect conflicts for a meeting
   */
  private async detectConflict(meeting: Meeting): Promise<Conflict | null> {
    const existingPath = this.stateManager.getFilePath(meeting.id);
    if (!existingPath) return null;
    
    const file = this.plugin.app.vault.getAbstractFileByPath(existingPath);
    if (!file || !(file instanceof TFile)) {
      // File was deleted locally
      return {
        type: ConflictType.FILE_MISSING,
        granolaId: meeting.id,
        localPath: existingPath,
        description: 'Local file has been deleted',
        remoteModifiedTime: new Date(meeting.updatedAt || meeting.date).getTime()
      };
    }
    
    // Check if file was modified locally
    const metadata = this.stateManager.getFileMetadata(meeting.id);
    if (metadata && file.stat.mtime > metadata.lastSynced) {
      // File was modified locally since last sync
      return {
        type: ConflictType.USER_MODIFIED,
        granolaId: meeting.id,
        localPath: existingPath,
        description: 'Local file has been modified since last sync',
        userModifiedTime: file.stat.mtime,
        remoteModifiedTime: new Date(meeting.updatedAt || meeting.date).getTime()
      };
    }
    
    return null;
  }
  
  /**
   * Resolve a conflict - either automatically or via user interaction
   */
  private async resolveConflict(conflict: Conflict, meeting: Meeting): Promise<ConflictResolution> {
    // For now, use simple automatic resolution
    // TODO: Add user preference for automatic vs interactive resolution
    
    if (conflict.type === ConflictType.FILE_MISSING) {
      // File was deleted - skip by default
      return ConflictResolution.SKIP;
    }
    
    if (conflict.type === ConflictType.USER_MODIFIED) {
      // File was modified - keep local (we'll append new content)
      return ConflictResolution.KEEP_LOCAL;
    }
    
    // Default to keeping remote
    return ConflictResolution.KEEP_REMOTE;
  }
  
  /**
   * Apply the chosen conflict resolution
   */
  private async applyConflictResolution(
    conflict: Conflict, 
    resolution: ConflictResolution, 
    meeting: Meeting
  ): Promise<void> {
    // No longer creating backup files
    // Resolution will be handled by the normal sync process
    this.logger.info(`Applying resolution ${resolution} for conflict: ${conflict.description}`);
  }
}
