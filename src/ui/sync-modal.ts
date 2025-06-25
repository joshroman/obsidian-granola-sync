import { App, Modal, ProgressBarComponent } from 'obsidian';
import { SyncEngine } from '../services/sync-engine';
import { SyncResult } from '../types';

export class SyncProgressModal extends Modal {
  private syncEngine: SyncEngine;
  private onCancel: () => void;
  private progressBar!: ProgressBarComponent;
  private statusEl!: HTMLElement;
  private detailsEl!: HTMLElement;
  private cancelButton!: HTMLButtonElement;
  private closeButton!: HTMLButtonElement;
  private startTime!: number;
  private isComplete: boolean = false;

  constructor(app: App, syncEngine: SyncEngine, onCancel: () => void) {
    super(app);
    this.syncEngine = syncEngine;
    this.onCancel = onCancel;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    
    // Title
    contentEl.createEl('h2', { text: 'Syncing Granola Meetings' });
    
    // Progress bar
    const progressContainer = contentEl.createEl('div', {
      cls: 'sync-progress-container'
    });
    this.progressBar = new ProgressBarComponent(progressContainer);
    this.progressBar.setValue(0);
    
    // Status text
    this.statusEl = contentEl.createEl('div', {
      text: 'Connecting to Granola...',
      cls: 'sync-status'
    });
    
    // Details section
    this.detailsEl = contentEl.createEl('div', {
      cls: 'sync-details'
    });
    
    // Buttons
    const buttonContainer = contentEl.createEl('div', {
      cls: 'modal-button-container'
    });
    
    this.cancelButton = buttonContainer.createEl('button', {
      text: 'Cancel',
      cls: 'mod-warning'
    });
    this.cancelButton.addEventListener('click', () => {
      this.handleCancel();
    });
    
    // Spacer
    buttonContainer.createEl('div', { cls: 'modal-button-spacer' });
    
    this.closeButton = buttonContainer.createEl('button', {
      text: 'Close',
      cls: 'mod-cta'
    });
    this.closeButton.style.display = 'none';
    this.closeButton.addEventListener('click', () => {
      this.close();
    });
    
    // Subscribe to progress updates
    this.startTime = Date.now();
    this.subscribeToProgress();
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }

  private subscribeToProgress() {
    // Poll for progress updates
    const updateInterval = setInterval(() => {
      if (this.isComplete) {
        clearInterval(updateInterval);
        return;
      }
      
      const progress = this.syncEngine.getProgress();
      this.updateProgress(progress);
    }, 100);
  }

  private updateProgress(progress: { current: number; total: number; message: string }) {
    if (progress.total > 0) {
      const percentage = (progress.current / progress.total) * 100;
      this.progressBar.setValue(percentage);
      
      this.statusEl.setText(progress.message);
      
      // Update details
      const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
      const rate = elapsed > 0 ? Math.floor(progress.current / elapsed) : 0;
      
      this.detailsEl.empty();
      this.detailsEl.createEl('div', {
        text: `Progress: ${progress.current} / ${progress.total} meetings`,
        cls: 'sync-detail-item'
      });
      
      if (rate > 0 && progress.current < progress.total) {
        const remaining = Math.ceil((progress.total - progress.current) / rate);
        this.detailsEl.createEl('div', {
          text: `Time elapsed: ${this.formatTime(elapsed)} | Est. remaining: ${this.formatTime(remaining)}`,
          cls: 'sync-detail-item'
        });
      } else {
        this.detailsEl.createEl('div', {
          text: `Time elapsed: ${this.formatTime(elapsed)}`,
          cls: 'sync-detail-item'
        });
      }
    }
  }

  private formatTime(seconds: number): string {
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  }

  showComplete(result: SyncResult) {
    this.isComplete = true;
    
    const { contentEl } = this;
    contentEl.empty();
    
    // Title
    contentEl.createEl('h2', { 
      text: result.success ? '✅ Sync Complete' : '❌ Sync Failed'
    });
    
    // Summary
    const summaryEl = contentEl.createEl('div', {
      cls: 'sync-summary'
    });
    
    if (result.success) {
      const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
      
      summaryEl.createEl('p', {
        text: `Successfully synced ${result.created + result.updated} meetings in ${this.formatTime(elapsed)}`
      });
      
      const statsEl = summaryEl.createEl('div', {
        cls: 'sync-stats'
      });
      
      if (result.created > 0) {
        statsEl.createEl('div', {
          text: `📄 ${result.created} new ${result.created === 1 ? 'meeting' : 'meetings'} created`,
          cls: 'sync-stat-item'
        });
      }
      
      if (result.updated > 0) {
        statsEl.createEl('div', {
          text: `✏️ ${result.updated} ${result.updated === 1 ? 'meeting' : 'meetings'} updated`,
          cls: 'sync-stat-item'
        });
      }
      
      if (result.skipped > 0) {
        statsEl.createEl('div', {
          text: `⏭️ ${result.skipped} ${result.skipped === 1 ? 'meeting' : 'meetings'} skipped (no changes)`,
          cls: 'sync-stat-item'
        });
      }
    }
    
    // Errors
    if (result.errors.length > 0) {
      const errorsEl = contentEl.createEl('div', {
        cls: 'sync-errors'
      });
      
      errorsEl.createEl('h3', {
        text: `Errors (${result.errors.length})`
      });
      
      const errorListEl = errorsEl.createEl('div', {
        cls: 'sync-error-list'
      });
      
      // Show up to 5 errors
      result.errors.slice(0, 5).forEach(error => {
        const errorEl = errorListEl.createEl('div', {
          cls: 'sync-error-item'
        });
        
        errorEl.createEl('strong', {
          text: error.meetingTitle || 'Unknown meeting'
        });
        
        errorEl.createEl('div', {
          text: error.error,
          cls: 'sync-error-message'
        });
      });
      
      if (result.errors.length > 5) {
        errorListEl.createEl('div', {
          text: `... and ${result.errors.length - 5} more errors`,
          cls: 'sync-error-more'
        });
      }
    }
    
    // Close button
    const buttonContainer = contentEl.createEl('div', {
      cls: 'modal-button-container'
    });
    
    const closeButton = buttonContainer.createEl('button', {
      text: 'Close',
      cls: 'mod-cta'
    });
    closeButton.addEventListener('click', () => {
      this.close();
    });
  }

  showError(error: string) {
    this.isComplete = true;
    
    const { contentEl } = this;
    contentEl.empty();
    
    contentEl.createEl('h2', { text: '❌ Sync Error' });
    
    contentEl.createEl('p', {
      text: error,
      cls: 'mod-warning'
    });
    
    // Close button
    const buttonContainer = contentEl.createEl('div', {
      cls: 'modal-button-container'
    });
    
    const closeButton = buttonContainer.createEl('button', {
      text: 'Close',
      cls: 'mod-cta'
    });
    closeButton.addEventListener('click', () => {
      this.close();
    });
  }

  private handleCancel() {
    if (confirm('Are you sure you want to cancel the sync?')) {
      this.onCancel();
      this.close();
    }
  }
}