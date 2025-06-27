import { Plugin } from 'obsidian';
import { Meeting, SyncResult } from '../types';
import { StructuredLogger } from '../utils/structured-logger';
import { EnhancedStateManager } from './enhanced-state-manager';

export interface RecoveryPoint {
  id: string;
  timestamp: Date;
  phase: 'fetching' | 'processing' | 'finalizing';
  progress: {
    total: number;
    processed: number;
    lastProcessedId?: string;
  };
  partialResult: Partial<SyncResult>;
  metadata: Record<string, any>;
}

export interface RecoveryStrategy {
  canRecover: (point: RecoveryPoint) => boolean;
  recover: (point: RecoveryPoint) => Promise<void>;
  priority: number;
}

export class RecoveryManager {
  private currentRecoveryPoint: RecoveryPoint | null = null;
  private recoveryHistory: RecoveryPoint[] = [];
  private strategies: RecoveryStrategy[] = [];
  private autoSaveInterval: number | null = null;
  
  constructor(
    private plugin: Plugin,
    private stateManager: EnhancedStateManager,
    private logger: StructuredLogger
  ) {
    this.initializeStrategies();
  }

  /**
   * Initialize recovery strategies
   */
  private initializeStrategies(): void {
    // Strategy 1: Resume from last processed meeting
    this.strategies.push({
      canRecover: (point) => point.phase === 'processing' && !!point.progress.lastProcessedId,
      recover: async (point) => {
        this.logger.info('Recovering from last processed meeting', {
          lastProcessedId: point.progress.lastProcessedId,
          processed: point.progress.processed,
          total: point.progress.total
        });
        
        // Recovery logic would be implemented by the sync engine
        await this.plugin.saveData({
          ...await this.plugin.loadData(),
          pendingRecovery: point
        });
      },
      priority: 1
    });
    
    // Strategy 2: Retry entire sync with cached data
    this.strategies.push({
      canRecover: (point) => point.phase === 'fetching' && point.progress.processed === 0,
      recover: async (point) => {
        this.logger.info('Recovering by retrying entire sync', {
          timestamp: point.timestamp
        });
        
        await this.plugin.saveData({
          ...await this.plugin.loadData(),
          pendingRecovery: null
        });
      },
      priority: 2
    });
    
    // Strategy 3: Complete partial sync
    this.strategies.push({
      canRecover: (point) => point.phase === 'finalizing',
      recover: async (point) => {
        this.logger.info('Recovering by completing partial sync', {
          partialResult: point.partialResult
        });
        
        // Mark as recovered
        await this.plugin.saveData({
          ...await this.plugin.loadData(),
          lastRecoveredSync: point.id
        });
      },
      priority: 0
    });
    
    // Sort strategies by priority
    this.strategies.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Start tracking a new sync operation
   */
  async startRecoveryTracking(totalItems: number): Promise<string> {
    const recoveryId = `recovery-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    this.currentRecoveryPoint = {
      id: recoveryId,
      timestamp: new Date(),
      phase: 'fetching',
      progress: {
        total: totalItems,
        processed: 0
      },
      partialResult: {
        success: false,
        created: 0,
        updated: 0,
        skipped: 0,
        errors: []
      },
      metadata: {}
    };
    
    await this.saveRecoveryPoint();
    
    // Start auto-save
    this.startAutoSave();
    
    this.logger.info('Started recovery tracking', {
      recoveryId,
      totalItems
    });
    
    return recoveryId;
  }

  /**
   * Update recovery point with progress
   */
  async updateProgress(
    processed: number,
    lastProcessedId?: string,
    partialResult?: Partial<SyncResult>
  ): Promise<void> {
    if (!this.currentRecoveryPoint) {
      return;
    }
    
    this.currentRecoveryPoint.progress.processed = processed;
    
    if (lastProcessedId) {
      this.currentRecoveryPoint.progress.lastProcessedId = lastProcessedId;
    }
    
    if (partialResult) {
      this.currentRecoveryPoint.partialResult = {
        ...this.currentRecoveryPoint.partialResult,
        ...partialResult
      };
    }
    
    // Update phase based on progress
    if (processed > 0 && this.currentRecoveryPoint.phase === 'fetching') {
      this.currentRecoveryPoint.phase = 'processing';
    }
    
    if (processed >= this.currentRecoveryPoint.progress.total) {
      this.currentRecoveryPoint.phase = 'finalizing';
    }
  }

  /**
   * Mark sync as completed successfully
   */
  async completeRecovery(result: SyncResult): Promise<void> {
    if (!this.currentRecoveryPoint) {
      return;
    }
    
    this.stopAutoSave();
    
    // Add to history
    this.recoveryHistory.push({
      ...this.currentRecoveryPoint,
      partialResult: result
    });
    
    // Keep history manageable
    if (this.recoveryHistory.length > 10) {
      this.recoveryHistory = this.recoveryHistory.slice(-5);
    }
    
    // Clear current recovery point
    this.currentRecoveryPoint = null;
    await this.clearRecoveryPoint();
    
    this.logger.info('Recovery tracking completed', {
      result: {
        created: result.created,
        updated: result.updated,
        skipped: result.skipped,
        errors: result.errors.length
      }
    });
  }

  /**
   * Handle sync failure and prepare for recovery
   */
  async handleFailure(error: Error): Promise<void> {
    if (!this.currentRecoveryPoint) {
      return;
    }
    
    this.stopAutoSave();
    
    this.currentRecoveryPoint.metadata.error = {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    };
    
    await this.saveRecoveryPoint();
    
    this.logger.error('Sync failed, recovery point saved', error, {
      recoveryId: this.currentRecoveryPoint.id,
      phase: this.currentRecoveryPoint.phase,
      progress: this.currentRecoveryPoint.progress
    });
  }

  /**
   * Check if recovery is possible from a previous failure
   */
  async checkRecovery(): Promise<RecoveryPoint | null> {
    const data = await this.plugin.loadData();
    const pendingRecovery = data?.pendingRecovery;
    
    if (!pendingRecovery) {
      return null;
    }
    
    // Check if recovery is still valid (not too old)
    const recoveryAge = Date.now() - new Date(pendingRecovery.timestamp).getTime();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    if (recoveryAge > maxAge) {
      this.logger.info('Recovery point too old, discarding', {
        age: recoveryAge,
        maxAge
      });
      await this.clearRecoveryPoint();
      return null;
    }
    
    return pendingRecovery;
  }

  /**
   * Attempt to recover from a recovery point
   */
  async attemptRecovery(point: RecoveryPoint): Promise<boolean> {
    this.logger.info('Attempting recovery', {
      recoveryId: point.id,
      phase: point.phase,
      progress: point.progress
    });
    
    // Find applicable strategy
    for (const strategy of this.strategies) {
      if (strategy.canRecover(point)) {
        try {
          await strategy.recover(point);
          this.logger.info('Recovery successful with strategy', {
            priority: strategy.priority
          });
          return true;
        } catch (error) {
          this.logger.error('Recovery strategy failed', error instanceof Error ? error : new Error('Unknown error'), {
            priority: strategy.priority
          });
        }
      }
    }
    
    this.logger.warn('No recovery strategy available');
    return false;
  }

  /**
   * Save current recovery point to storage
   */
  private async saveRecoveryPoint(): Promise<void> {
    if (!this.currentRecoveryPoint) {
      return;
    }
    
    const data = await this.plugin.loadData();
    await this.plugin.saveData({
      ...data,
      pendingRecovery: this.currentRecoveryPoint
    });
  }

  /**
   * Clear recovery point from storage
   */
  private async clearRecoveryPoint(): Promise<void> {
    const data = await this.plugin.loadData();
    delete data.pendingRecovery;
    await this.plugin.saveData(data);
  }

  /**
   * Start auto-saving recovery point
   */
  private startAutoSave(): void {
    this.stopAutoSave();
    
    this.autoSaveInterval = window.setInterval(async () => {
      await this.saveRecoveryPoint();
    }, 5000); // Save every 5 seconds
  }

  /**
   * Stop auto-saving
   */
  private stopAutoSave(): void {
    if (this.autoSaveInterval !== null) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
  }

  /**
   * Get recovery statistics
   */
  getRecoveryStats(): {
    hasActiveRecovery: boolean;
    recoveryHistory: number;
    lastRecovery?: Date;
  } {
    const lastRecovery = this.recoveryHistory.length > 0
      ? this.recoveryHistory[this.recoveryHistory.length - 1].timestamp
      : undefined;
    
    return {
      hasActiveRecovery: this.currentRecoveryPoint !== null,
      recoveryHistory: this.recoveryHistory.length,
      lastRecovery
    };
  }

  /**
   * Export recovery data for debugging
   */
  exportRecoveryData(): string {
    return JSON.stringify({
      current: this.currentRecoveryPoint,
      history: this.recoveryHistory
    }, null, 2);
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    this.stopAutoSave();
  }
}