import { SyncStateManager } from './sync-state-manager';
import { GranolaService } from './granola-service';
import { PathGenerator } from '../utils/path-generator';
import { FileManager } from '../utils/file-manager';
import { MarkdownBuilder } from '../utils/markdown-builder';
import { SyncResult, SyncProgress, Meeting, SyncError } from '../types';
import { Plugin } from 'obsidian';
import { Logger } from '../utils/logger';

export class SyncEngine {
  private isCancelled: boolean = false;
  private syncLock: boolean = false;
  private currentProgress: SyncProgress = { current: 0, total: 0, message: 'Idle' };
  private fileManager: FileManager;
  
  constructor(
    private stateManager: SyncStateManager,
    private granolaService: GranolaService,
    private pathGenerator: PathGenerator,
    private plugin: Plugin,
    private logger: Logger
  ) {
    this.fileManager = new FileManager(plugin, logger);
  }
  
  async sync(): Promise<SyncResult> {
    if (this.syncLock) {
      throw new Error('Sync already in progress');
    }
    
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
      
      // Process in batches
      const batchSize = (this.plugin as any).settings?.batchSize || 10;
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
        await this.processBatch(batch, i, meetings.length, result);
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
      this.logger.error('Sync failed', error);
      result.success = false;
      result.errors.push({
        meetingId: '',
        meetingTitle: '',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      });
      result.duration = Date.now() - startTime;
      return result;
    } finally {
      this.syncLock = false;
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
        
        // Generate content
        const content = MarkdownBuilder.buildMeetingNote(meeting);
        
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
        this.logger.error(`Failed to process meeting ${meeting.id}:`, error);
        result.errors.push({
          meetingId: meeting.id,
          meetingTitle: meeting.title,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date()
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
}
