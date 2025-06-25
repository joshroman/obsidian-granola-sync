import { SyncStateManager } from './sync-state-manager';
import { GranolaService } from './granola-service';
import { PathGenerator } from '../utils/path-generator';
import { FileManager } from '../utils/file-manager';
import { MarkdownBuilder } from '../utils/markdown-builder';
import { SyncResult, SyncProgress, Meeting, SyncError } from '../types';
import { Plugin } from 'obsidian';
import { Logger } from '../utils/logger';
import { ChunkedContentProcessor } from '../utils/chunked-processor';
import { ErrorHandler } from '../utils/error-handler';

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
  
  constructor(
    private stateManager: SyncStateManager,
    private granolaService: GranolaService,
    private pathGenerator: PathGenerator,
    private plugin: Plugin,
    private logger: Logger
  ) {
    this.fileManager = new FileManager(plugin, logger);
    this.contentProcessor = new ChunkedContentProcessor(logger);
    this.errorHandler = new ErrorHandler(logger);
  }
  
  async sync(): Promise<SyncResult> {
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
    
    return this.performSync();
  }
  
  private async performSync(): Promise<SyncResult> {
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
      const lastSync = this.stateManager.getLastSync();
      const meetings = lastSync 
        ? await this.granolaService.getMeetingsSince(lastSync)
        : await this.granolaService.getAllMeetings();
      
      if (meetings.length === 0) {
        this.logger.info('No meetings to sync');
        return {
          ...result,
          duration: Date.now() - startTime
        };
      }
      
      this.logger.info(`Found ${meetings.length} meetings to process`);
      
      // Process in batches with adaptive sizing
      let batchSize = this.getOptimalBatchSize(meetings.length);
      for (let i = 0; i < meetings.length; i += batchSize) {
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
        
        const batch = meetings.slice(i, i + batchSize);
        const batchStartTime = Date.now();
        
        await this.processBatch(batch, i, meetings.length, result);
        
        // Adapt batch size based on processing time
        const batchDuration = Date.now() - batchStartTime;
        batchSize = this.adaptBatchSize(batchSize, batchDuration, batch.length);
      }
      
      // Update last sync time
      if (result.success) {
        this.stateManager.setLastSync(new Date().toISOString());
        await this.stateManager.saveState();
      }
      
      result.duration = Date.now() - startTime;
      this.updateProgress(meetings.length, meetings.length, 'Sync complete');
      
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
    this.logger.info('Sync cancelled');
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
    for (let i = 0; i < meetings.length; i++) {
      const meeting = meetings[i];
      const currentIndex = startIndex + i;
      
      try {
        this.updateProgress(
          currentIndex + 1, 
          totalMeetings, 
          `Processing: ${meeting.title}`
        );
        
        // Check if user deleted this file
        if (this.stateManager.isDeleted(meeting.id)) {
          this.logger.debug(`Skipping deleted meeting: ${meeting.title}`);
          result.skipped++;
          continue;
        }
        
        // Generate file path
        const filePath = this.pathGenerator.generatePath(meeting);
        const existingPath = this.stateManager.getFilePath(meeting.id);
        
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
          content = MarkdownBuilder.buildMeetingNote(meeting);
        }
        
        // Create or update file
        const { created } = await this.fileManager.createOrUpdateFile(
          filePath,
          content,
          meeting
        );
        
        // Update state
        this.stateManager.addFile(meeting.id, filePath);
        
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
}
