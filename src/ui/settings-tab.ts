import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import GranolaSyncPlugin from '../main';

export class SettingsTab extends PluginSettingTab {
  plugin: GranolaSyncPlugin;

  constructor(app: App, plugin: GranolaSyncPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Granola Sync Settings' });

    // Security notice
    const isAutoMode = !this.plugin.settings.useManualToken && this.plugin.settings.granolaConsentGiven;
    if (!isAutoMode) {
      containerEl.createEl('div', {
        text: '⚠️ Your API key is stored locally in your vault. ' +
          'Do not sync .obsidian folder if sharing your vault.',
        cls: 'setting-item-description mod-warning'
      });
    }

    // API key field (only show in manual mode)
    if (!isAutoMode) {
      new Setting(containerEl)
        .setName('Granola API Key')
        .setDesc('Your API key from Granola settings')
        .addText(text => {
          text
            .setPlaceholder('Enter your API key')
            .setValue(this.plugin.settings.apiKey)
            .onChange(async (value) => {
              this.plugin.settings.apiKey = value;
              await this.plugin.saveSettings();
            });
          text.inputEl.type = 'password';
        })
        .addButton(button => {
          button
            .setButtonText('Test Connection')
            .onClick(async () => {
              await this.plugin.testConnection();
              // Refresh display to update connection status
              this.display();
            });
        });
    } else {
      // Show automatic mode info
      new Setting(containerEl)
        .setName('Authentication Mode')
        .setDesc('Using automatic token from Granola desktop app')
        .addButton(button => {
          button
            .setButtonText('Test Connection')
            .setCta()
            .onClick(async () => {
              await this.plugin.testConnection();
              // Refresh display to update connection status
              this.display();
            });
        })
        .addButton(button => {
          button
            .setButtonText('Switch to Manual')
            .onClick(async () => {
              this.plugin.settings.useManualToken = true;
              this.plugin.settings.granolaConsentGiven = false;
              await this.plugin.saveSettings();
              // Reinitialize services
              await this.plugin.onload();
              this.display();
            });
        });
    }

    // Connection status display
    const connectionStatusEl = containerEl.createEl('div', {
      cls: 'setting-item'
    });
    
    connectionStatusEl.createEl('div', {
      text: 'Connection Status',
      cls: 'setting-item-name'
    });
    
    const statusDiv = connectionStatusEl.createEl('div', {
      cls: 'setting-item-description'
    });
    
    // Determine connection status
    const hasApiKey = !!this.plugin.settings.apiKey || 
                     (this.plugin.tokenManager?.hasValidToken() ?? false);
    
    if (!hasApiKey && !isAutoMode) {
      statusDiv.createEl('span', {
        text: '❌ Not configured',
        cls: 'mod-warning'
      });
    } else if (this.plugin.lastError) {
      statusDiv.createEl('span', {
        text: `❌ Connection failed: ${this.plugin.lastError}`,
        cls: 'mod-warning'
      });
    } else if (this.plugin.granolaService) {
      // Check if we've successfully connected before
      const lastSync = this.plugin.settings.lastSync;
      if (lastSync) {
        statusDiv.createEl('span', {
          text: '✅ Connected',
          cls: 'mod-success'
        });
        if (isAutoMode) {
          statusDiv.createEl('span', {
            text: ' (automatic token)',
            cls: 'setting-item-description'
          });
        }
      } else {
        statusDiv.createEl('span', {
          text: '🔄 Ready to sync',
          cls: 'setting-item-description'
        });
      }
    } else {
      statusDiv.createEl('span', {
        text: '⚠️ Service not initialized',
        cls: 'mod-warning'
      });
    }

    // Target folder
    new Setting(containerEl)
      .setName('Meeting notes folder')
      .setDesc('Where to store synced meeting notes')
      .addText(text => text
        .setPlaceholder('Meetings')
        .setValue(this.plugin.settings.targetFolder)
        .onChange(async (value) => {
          this.plugin.settings.targetFolder = value;
          await this.plugin.saveSettings();
          this.updatePreview();
        }));

    // File naming format
    new Setting(containerEl)
      .setName('File naming format')
      .setDesc('How to name meeting note files')
      .addDropdown(dropdown => dropdown
        .addOption('meeting-name', 'Meeting name only')
        .addOption('date-meeting-name', 'Date + Meeting name')
        .setValue(this.plugin.settings.fileNamingFormat)
        .onChange(async (value: any) => {
          this.plugin.settings.fileNamingFormat = value;
          await this.plugin.saveSettings();
          this.updatePreview();
        }));

    // Date format (only shown when using date in filename)
    if (this.plugin.settings.fileNamingFormat === 'date-meeting-name') {
      new Setting(containerEl)
        .setName('Date format')
        .setDesc('Format for dates in filenames (using date-fns format)')
        .addText(text => text
          .setPlaceholder('yyyy-MM-dd')
          .setValue(this.plugin.settings.dateFormat)
          .onChange(async (value) => {
            this.plugin.settings.dateFormat = value;
            await this.plugin.saveSettings();
            this.updatePreview();
          }));
    }

    // Folder organization
    new Setting(containerEl)
      .setName('Folder organization')
      .setDesc('How to organize meeting notes in subfolders')
      .addDropdown(dropdown => dropdown
        .addOption('flat', 'No subfolders (flat structure)')
        .addOption('by-date', 'Organize by date')
        .addOption('mirror-granola', 'Mirror Granola folder structure')
        .setValue(this.plugin.settings.folderOrganization)
        .onChange(async (value: any) => {
          this.plugin.settings.folderOrganization = value;
          await this.plugin.saveSettings();
          this.updatePreview();
          this.display(); // Refresh to show/hide date folder settings
        }));

    // Date folder format (only shown when organizing by date)
    if (this.plugin.settings.folderOrganization === 'by-date') {
      new Setting(containerEl)
        .setName('Date folder format')
        .setDesc('How to group meetings by date')
        .addDropdown(dropdown => dropdown
          .addOption('daily', 'Daily folders (YYYY-MM-DD)')
          .addOption('weekly', 'Weekly folders (YYYY-W##)')
          .setValue(this.plugin.settings.dateFolderFormat)
          .onChange(async (value: any) => {
            this.plugin.settings.dateFolderFormat = value;
            await this.plugin.saveSettings();
            this.updatePreview();
          }));
    }

    // Preview of file path structure
    const previewEl = containerEl.createEl('div', {
      cls: 'setting-item'
    });
    previewEl.createEl('div', {
      text: 'Example file path:',
      cls: 'setting-item-name'
    });
    previewEl.createEl('code', {
      text: this.generateExamplePath(),
      cls: 'setting-item-description'
    });

    containerEl.createEl('h3', { text: 'Sync Options' });

    // Automatic sync
    new Setting(containerEl)
      .setName('Automatic sync')
      .setDesc('Automatically sync meetings every 30 minutes')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.syncAutomatically)
        .onChange(async (value) => {
          this.plugin.settings.syncAutomatically = value;
          await this.plugin.saveSettings();
        }));

    // Batch size
    new Setting(containerEl)
      .setName('Batch size')
      .setDesc('Number of meetings to process at once (lower values use less memory)')
      .addText(text => text
        .setPlaceholder('10')
        .setValue(String(this.plugin.settings.batchSize))
        .onChange(async (value) => {
          const num = parseInt(value);
          if (!isNaN(num) && num > 0 && num <= 100) {
            this.plugin.settings.batchSize = num;
            await this.plugin.saveSettings();
          }
        }));

    containerEl.createEl('h3', { text: 'Debug Options' });

    // Debug mode
    new Setting(containerEl)
      .setName('Debug mode')
      .setDesc('Enable detailed logging for troubleshooting')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.debugMode)
        .onChange(async (value) => {
          this.plugin.settings.debugMode = value;
          await this.plugin.saveSettings();
        }));

    // Log level
    if (this.plugin.settings.debugMode) {
      new Setting(containerEl)
        .setName('Log level')
        .setDesc('Minimum level of messages to log')
        .addDropdown(dropdown => dropdown
          .addOption('error', 'Error only')
          .addOption('warn', 'Warning and above')
          .addOption('info', 'Info and above')
          .addOption('debug', 'Everything (verbose)')
          .setValue(this.plugin.settings.logLevel)
          .onChange(async (value: any) => {
            this.plugin.settings.logLevel = value;
            await this.plugin.saveSettings();
          }));
    }

    // Sync status
    containerEl.createEl('h3', { text: 'Sync Status' });
    
    const statusEl = containerEl.createEl('div', {
      cls: 'setting-item'
    });
    
    if (this.plugin.settings.lastSync) {
      statusEl.createEl('div', {
        text: `Last sync: ${new Date(this.plugin.settings.lastSync).toLocaleString()}`,
        cls: 'setting-item-description'
      });
    } else {
      statusEl.createEl('div', {
        text: 'Never synced',
        cls: 'setting-item-description'
      });
    }
    
    if (this.plugin.stateManager) {
      const stats = this.plugin.stateManager.getStats();
      statusEl.createEl('div', {
        text: `Tracked files: ${stats.totalFiles} | Deleted: ${stats.deletedFiles}`,
        cls: 'setting-item-description'
      });
    }

    // Manual sync button
    new Setting(containerEl)
      .setName('Manual sync')
      .setDesc('Sync your Granola meetings now')
      .addButton(button => button
        .setButtonText('Sync Now')
        .setCta()
        .onClick(async () => {
          await this.plugin.performSync();
        }));

    // Clear API key button
    new Setting(containerEl)
      .setName('Clear credentials')
      .setDesc('Remove your API key from this vault')
      .addButton(button => button
        .setButtonText('Clear API Key')
        .setWarning()
        .onClick(async () => {
          if (confirm('Are you sure you want to clear your API key?')) {
            await this.plugin.clearApiKey();
            new Notice('API key cleared');
            this.display();
          }
        }));
  }

  private updatePreview() {
    // Find the preview element and update it
    const previewCode = this.containerEl.querySelector('code');
    if (previewCode) {
      previewCode.textContent = this.generateExamplePath();
    }
  }

  private generateExamplePath(): string {
    const settings = this.plugin.settings;
    let path = settings.targetFolder;

    // Add subfolder based on organization
    switch (settings.folderOrganization) {
      case 'by-date':
        if (settings.dateFolderFormat === 'weekly') {
          path += '/2024-W12';
        } else {
          path += '/2024-03-20';
        }
        break;
      case 'mirror-granola':
        path += '/Work/ProjectX';
        break;
    }

    // Add filename
    let filename = '';
    if (settings.fileNamingFormat === 'date-meeting-name') {
      filename = '2024-03-20 ';
    }
    filename += 'Team Standup.md';

    return `${path}/${filename}`;
  }
}