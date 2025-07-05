import { Modal, App, Setting, Notice } from 'obsidian';
import { Conflict, ConflictResolution, ConflictType } from '../services/conflict-detector';

export interface ConflictResolutionResult {
  conflicts: Array<{
    conflict: Conflict;
    resolution: ConflictResolution;
  }>;
  applyToAll: boolean;
  defaultResolution?: ConflictResolution;
}

export class ConflictResolutionModal extends Modal {
  private conflicts: Conflict[];
  private resolutions: Map<string, ConflictResolution> = new Map();
  private applyToAll: boolean = false;
  private defaultResolution?: ConflictResolution;
  private onSubmit: (result: ConflictResolutionResult) => void;

  constructor(
    app: App,
    conflicts: Conflict[],
    onSubmit: (result: ConflictResolutionResult) => void
  ) {
    super(app);
    this.conflicts = conflicts;
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('granola-sync-plugin');
    contentEl.addClass('granola-conflict-modal');

    // Title
    contentEl.createEl('h2', { text: 'Resolve Sync Conflicts' });
    
    // Summary
    const summary = contentEl.createDiv('conflict-summary');
    summary.createEl('p', {
      text: `Found ${this.conflicts.length} conflict${this.conflicts.length > 1 ? 's' : ''} that need resolution:`
    });

    // Global options
    if (this.conflicts.length > 1) {
      new Setting(contentEl)
        .setName('Apply to all conflicts')
        .setDesc('Use the same resolution for all similar conflicts')
        .addToggle(toggle => toggle
          .setValue(this.applyToAll)
          .onChange(value => {
            this.applyToAll = value;
            this.refreshConflictList();
          })
        );

      if (this.applyToAll) {
        new Setting(contentEl)
          .setName('Default resolution')
          .addDropdown(dropdown => {
            dropdown
              .addOption('', 'Choose resolution...')
              .addOption(ConflictResolution.KEEP_LOCAL, 'Keep local changes')
              .addOption(ConflictResolution.KEEP_REMOTE, 'Use remote version')
              .addOption(ConflictResolution.BACKUP_AND_UPDATE, 'Backup local & use remote')
              .addOption(ConflictResolution.MERGE, 'Merge changes')
              .addOption(ConflictResolution.SKIP, 'Skip')
              .onChange(value => {
                this.defaultResolution = value as ConflictResolution;
                if (value) {
                  // Apply to all conflicts
                  this.conflicts.forEach(conflict => {
                    this.resolutions.set(conflict.granolaId, this.defaultResolution!);
                  });
                  this.refreshConflictList();
                }
              });
          });
      }
    }

    // Conflict list
    const conflictList = contentEl.createDiv('conflict-list');
    this.renderConflictList(conflictList);

    // Action buttons
    const buttonContainer = contentEl.createDiv('granola-button-container');
    
    const cancelButton = buttonContainer.createEl('button', { text: 'Cancel' });
    cancelButton.addEventListener('click', () => this.close());
    
    const resolveButton = buttonContainer.createEl('button', {
      text: 'Resolve Conflicts',
      cls: 'mod-cta'
    });
    resolveButton.addEventListener('click', () => this.resolveConflicts());
  }

  private refreshConflictList() {
    const conflictList = this.contentEl.querySelector('.conflict-list');
    if (conflictList) {
      conflictList.empty();
      this.renderConflictList(conflictList as HTMLElement);
    }
  }

  private renderConflictList(container: HTMLElement) {
    this.conflicts.forEach((conflict, index) => {
      const conflictEl = container.createDiv('conflict-item');
      
      // Conflict header
      const header = conflictEl.createDiv('conflict-header');
      header.createEl('h4', { text: `Conflict ${index + 1}: ${this.getConflictTitle(conflict)}` });
      
      // Conflict details
      const details = conflictEl.createDiv('conflict-details');
      
      if (conflict.localPath) {
        details.createEl('div', { 
          text: `Local: ${conflict.localPath}`,
          cls: 'conflict-path'
        });
      }
      
      if (conflict.remotePath) {
        details.createEl('div', { 
          text: `Remote: ${conflict.remotePath}`,
          cls: 'conflict-path'
        });
      }
      
      details.createEl('div', {
        text: conflict.description,
        cls: 'conflict-description'
      });
      
      // Timestamps if available
      if (conflict.userModifiedTime) {
        details.createEl('div', {
          text: `Local modified: ${new Date(conflict.userModifiedTime).toLocaleString()}`,
          cls: 'conflict-timestamp'
        });
      }
      
      if (conflict.remoteModifiedTime) {
        details.createEl('div', {
          text: `Remote modified: ${new Date(conflict.remoteModifiedTime).toLocaleString()}`,
          cls: 'conflict-timestamp'
        });
      }
      
      // Resolution options
      if (!this.applyToAll || !this.defaultResolution) {
        const resolutionSetting = new Setting(conflictEl)
          .setName('Resolution')
          .addDropdown(dropdown => {
            // Add appropriate options based on conflict type
            const options = this.getResolutionOptions(conflict);
            
            dropdown.addOption('', 'Choose resolution...');
            options.forEach(option => {
              dropdown.addOption(option.value, option.label);
            });
            
            // Set current value if exists
            const currentResolution = this.resolutions.get(conflict.granolaId);
            if (currentResolution) {
              dropdown.setValue(currentResolution);
            }
            
            dropdown.onChange(value => {
              if (value) {
                this.resolutions.set(conflict.granolaId, value as ConflictResolution);
              }
            });
          });
      }
    });
  }

  private getConflictTitle(conflict: Conflict): string {
    switch (conflict.type) {
      case ConflictType.USER_MODIFIED:
        return 'Local Changes';
      case ConflictType.BOTH_MODIFIED:
        return 'Both Modified';
      case ConflictType.FILE_MISSING:
        return 'File Missing';
      case ConflictType.DUPLICATE_ID:
        return 'Duplicate ID';
      case ConflictType.METADATA_CORRUPTED:
        return 'Metadata Issue';
      case ConflictType.PATH_CONFLICT:
        return 'Path Conflict';
      default:
        return 'Unknown Conflict';
    }
  }

  private getResolutionOptions(conflict: Conflict): Array<{value: string, label: string}> {
    const options: Array<{value: string, label: string}> = [];
    
    switch (conflict.type) {
      case ConflictType.USER_MODIFIED:
        options.push(
          { value: ConflictResolution.KEEP_LOCAL, label: 'Keep my changes' },
          { value: ConflictResolution.BACKUP_AND_UPDATE, label: 'Backup my changes & update' },
          { value: ConflictResolution.MERGE, label: 'Try to merge changes' }
        );
        break;
        
      case ConflictType.BOTH_MODIFIED:
        options.push(
          { value: ConflictResolution.KEEP_LOCAL, label: 'Keep my version' },
          { value: ConflictResolution.KEEP_REMOTE, label: 'Use remote version' },
          { value: ConflictResolution.BACKUP_AND_UPDATE, label: 'Backup mine & use remote' },
          { value: ConflictResolution.MERGE, label: 'Try to merge changes' }
        );
        break;
        
      case ConflictType.FILE_MISSING:
        options.push(
          { value: ConflictResolution.KEEP_REMOTE, label: 'Recreate file' },
          { value: ConflictResolution.SKIP, label: 'Skip (keep deleted)' }
        );
        break;
        
      case ConflictType.DUPLICATE_ID:
      case ConflictType.PATH_CONFLICT:
        options.push(
          { value: ConflictResolution.CREATE_DUPLICATE, label: 'Create new file' },
          { value: ConflictResolution.KEEP_LOCAL, label: 'Keep existing file' },
          { value: ConflictResolution.SKIP, label: 'Skip' }
        );
        break;
        
      case ConflictType.METADATA_CORRUPTED:
        options.push(
          { value: ConflictResolution.KEEP_REMOTE, label: 'Fix with remote data' },
          { value: ConflictResolution.SKIP, label: 'Skip for now' }
        );
        break;
    }
    
    options.push({ value: ConflictResolution.SKIP, label: 'Skip this conflict' });
    
    return options;
  }

  private resolveConflicts() {
    // Validate all conflicts have resolutions
    const unresolvedConflicts = this.conflicts.filter(
      conflict => !this.resolutions.has(conflict.granolaId)
    );
    
    if (unresolvedConflicts.length > 0) {
      new Notice(`Please choose a resolution for all conflicts (${unresolvedConflicts.length} remaining)`);
      return;
    }
    
    // Build result
    const result: ConflictResolutionResult = {
      conflicts: this.conflicts.map(conflict => ({
        conflict,
        resolution: this.resolutions.get(conflict.granolaId)!
      })),
      applyToAll: this.applyToAll,
      defaultResolution: this.defaultResolution
    };
    
    this.close();
    this.onSubmit(result);
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}