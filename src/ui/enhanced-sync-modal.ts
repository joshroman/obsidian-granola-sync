import { Modal, App, ProgressBarComponent, ButtonComponent } from 'obsidian';
import { HardenedSyncEngine } from '../services/hardened-sync-engine';

export interface SyncProgress {
  current: number;
  total: number;
  message: string;
  phase: 'idle' | 'fetching' | 'processing' | 'complete';
  startTime: number;
  estimatedTimeRemaining: number;
}

export class EnhancedSyncProgressModal extends Modal {
  private syncEngine: HardenedSyncEngine;
  private progressBar: ProgressBarComponent | null = null;
  private statusEl: HTMLElement | null = null;
  private statsEl: HTMLElement | null = null;
  private detailsEl: HTMLElement | null = null;
  private cancelButton: ButtonComponent | null = null;
  private updateInterval: number | null = null;
  private startTime: number = Date.now();
  private phaseStartTimes: Record<string, number> = {};
  
  constructor(app: App, syncEngine: HardenedSyncEngine) {
    super(app);
    this.syncEngine = syncEngine;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('granola-sync-modal');
    
    // Title
    contentEl.createEl('h2', { text: 'Syncing Meeting Notes' });
    
    // Progress bar
    const progressContainer = contentEl.createDiv('sync-progress-container');
    this.progressBar = new ProgressBarComponent(progressContainer);
    
    // Status message
    this.statusEl = contentEl.createDiv('sync-status');
    this.statusEl.setText('Initializing sync...');
    
    // Statistics
    this.statsEl = contentEl.createDiv('sync-stats');
    
    // Details section (collapsible)
    const detailsContainer = contentEl.createDiv('sync-details-container');
    const detailsHeader = detailsContainer.createDiv('details-header');
    detailsHeader.createSpan({ text: '▶ Details', cls: 'details-toggle' });
    detailsHeader.addEventListener('click', () => {
      const isExpanded = detailsContainer.hasClass('expanded');
      if (isExpanded) {
        detailsContainer.removeClass('expanded');
        detailsHeader.querySelector('.details-toggle')!.textContent = '▶ Details';
      } else {
        detailsContainer.addClass('expanded');
        detailsHeader.querySelector('.details-toggle')!.textContent = '▼ Details';
      }
    });
    
    this.detailsEl = detailsContainer.createDiv('sync-details');
    
    // Footer with cancel button
    const footer = contentEl.createDiv('sync-modal-footer');
    this.cancelButton = new ButtonComponent(footer)
      .setButtonText('Cancel')
      .onClick(() => {
        this.syncEngine.cancelSync();
        this.close();
      });
    
    // Start update loop
    this.startUpdateLoop();
  }

  private startUpdateLoop(): void {
    this.updateProgress();
    this.updateInterval = window.setInterval(() => {
      this.updateProgress();
    }, 100);
  }

  private updateProgress(): void {
    const progress = this.syncEngine.getProgress();
    
    // Update progress bar
    if (this.progressBar && progress.total > 0) {
      const percentage = (progress.current / progress.total) * 100;
      this.progressBar.setValue(percentage);
    }
    
    // Update phase timing
    if (!this.phaseStartTimes[progress.phase]) {
      this.phaseStartTimes[progress.phase] = Date.now();
    }
    
    // Update status
    if (this.statusEl) {
      this.statusEl.setText(progress.message);
      this.statusEl.className = `sync-status phase-${progress.phase}`;
    }
    
    // Update statistics
    if (this.statsEl) {
      this.updateStats(progress);
    }
    
    // Update details
    if (this.detailsEl) {
      this.updateDetails(progress);
    }
    
    // Handle completion
    if (progress.phase === 'complete') {
      this.handleComplete();
    }
  }

  private updateStats(progress: SyncProgress): void {
    if (!this.statsEl) return;
    
    this.statsEl.empty();
    
    const stats = this.statsEl.createDiv('stats-grid');
    
    // Progress
    if (progress.total > 0) {
      const progressStat = stats.createDiv('stat-item');
      progressStat.createDiv({ text: 'Progress', cls: 'stat-label' });
      progressStat.createDiv({ 
        text: `${progress.current} / ${progress.total}`,
        cls: 'stat-value'
      });
    }
    
    // Time elapsed
    const elapsed = Date.now() - this.startTime;
    const elapsedStat = stats.createDiv('stat-item');
    elapsedStat.createDiv({ text: 'Time Elapsed', cls: 'stat-label' });
    elapsedStat.createDiv({ 
      text: this.formatDuration(elapsed),
      cls: 'stat-value'
    });
    
    // Estimated time remaining
    if (progress.estimatedTimeRemaining > 0) {
      const remainingStat = stats.createDiv('stat-item');
      remainingStat.createDiv({ text: 'Time Remaining', cls: 'stat-label' });
      remainingStat.createDiv({ 
        text: this.formatDuration(progress.estimatedTimeRemaining),
        cls: 'stat-value'
      });
    }
    
    // Processing rate
    if (progress.current > 0 && elapsed > 0) {
      const rate = (progress.current / elapsed) * 1000; // items per second
      const rateStat = stats.createDiv('stat-item');
      rateStat.createDiv({ text: 'Processing Rate', cls: 'stat-label' });
      rateStat.createDiv({ 
        text: `${rate.toFixed(1)} items/sec`,
        cls: 'stat-value'
      });
    }
  }

  private updateDetails(progress: SyncProgress): void {
    if (!this.detailsEl) return;
    
    // Get additional information from sync engine
    const perfReport = this.syncEngine.getPerformanceReport();
    const errorReport = this.syncEngine.getErrorReport();
    const recoveryStats = this.syncEngine.getRecoveryStats();
    
    this.detailsEl.empty();
    
    // Phase timing
    const phaseSection = this.detailsEl.createDiv('detail-section');
    phaseSection.createEl('h4', { text: 'Phase Timing' });
    const phaseList = phaseSection.createEl('ul');
    
    Object.entries(this.phaseStartTimes).forEach(([phase, startTime]) => {
      const duration = Date.now() - startTime;
      phaseList.createEl('li', { 
        text: `${phase}: ${this.formatDuration(duration)}`
      });
    });
    
    // Performance metrics
    if (perfReport.totalOperations > 0) {
      const perfSection = this.detailsEl.createDiv('detail-section');
      perfSection.createEl('h4', { text: 'Performance' });
      const perfList = perfSection.createEl('ul');
      
      perfList.createEl('li', { 
        text: `Average operation: ${perfReport.averageDuration.toFixed(2)}ms`
      });
      perfList.createEl('li', { 
        text: `Slowest operation: ${perfReport.maxDuration.toFixed(2)}ms`
      });
      
      // Top operations by type
      const topOps = Object.entries(perfReport.operationsByType)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 3);
      
      if (topOps.length > 0) {
        const opsList = perfList.createEl('li');
        opsList.setText('Top operations:');
        const subList = opsList.createEl('ul');
        topOps.forEach(([name, data]) => {
          subList.createEl('li', {
            text: `${name}: ${data.count} (avg ${data.averageDuration.toFixed(2)}ms)`
          });
        });
      }
    }
    
    // Error summary
    if (errorReport.totalErrors > 0) {
      const errorSection = this.detailsEl.createDiv('detail-section');
      errorSection.createEl('h4', { text: 'Errors', cls: 'error-header' });
      const errorList = errorSection.createEl('ul');
      
      errorList.createEl('li', { 
        text: `Total errors: ${errorReport.totalErrors}`
      });
      
      // Error types
      const errorTypes = Object.entries(errorReport.errorsByType)
        .sort((a, b) => b[1] - a[1]);
      
      if (errorTypes.length > 0) {
        const typesList = errorList.createEl('li');
        typesList.setText('By type:');
        const subList = typesList.createEl('ul');
        errorTypes.forEach(([type, count]) => {
          subList.createEl('li', { text: `${type}: ${count}` });
        });
      }
    }
    
    // Recovery status
    if (recoveryStats.hasActiveRecovery || recoveryStats.recoveryHistory > 0) {
      const recoverySection = this.detailsEl.createDiv('detail-section');
      recoverySection.createEl('h4', { text: 'Recovery' });
      const recoveryList = recoverySection.createEl('ul');
      
      if (recoveryStats.hasActiveRecovery) {
        recoveryList.createEl('li', { 
          text: 'Recovery tracking active',
          cls: 'recovery-active'
        });
      }
      
      if (recoveryStats.lastRecovery) {
        recoveryList.createEl('li', { 
          text: `Last recovery: ${recoveryStats.lastRecovery.toLocaleString()}`
        });
      }
    }
  }

  private formatDuration(ms: number): string {
    if (ms < 1000) {
      return `${ms}ms`;
    } else if (ms < 60000) {
      return `${(ms / 1000).toFixed(1)}s`;
    } else {
      const minutes = Math.floor(ms / 60000);
      const seconds = Math.floor((ms % 60000) / 1000);
      return `${minutes}m ${seconds}s`;
    }
  }

  private handleComplete(): void {
    if (this.cancelButton) {
      this.cancelButton.setButtonText('Close');
    }
    
    // Add completion animation
    this.contentEl.addClass('sync-complete');
    
    // Auto-close after delay
    setTimeout(() => {
      this.close();
    }, 3000);
  }

  onClose() {
    if (this.updateInterval !== null) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    
    const { contentEl } = this;
    contentEl.empty();
  }
}