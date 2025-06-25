import { App, Plugin, PluginManifest, Notice, EventRef } from 'obsidian';
import { SyncStateManager } from './services/sync-state-manager';
import { SyncEngine } from './services/sync-engine';
import { GranolaService } from './services/granola-service';
import { PathGenerator } from './utils/path-generator';
import { DEFAULT_SETTINGS, PluginSettings } from './types';
import { SettingsTab } from './ui/settings-tab';
import { SyncProgressModal } from './ui/sync-modal';
import { SetupWizard } from './ui/wizard-modal';
import { InputValidator } from './utils/input-validator';
import { Logger } from './utils/logger';
import { ErrorHandler } from './utils/error-handler';

export default class GranolaSyncPlugin extends Plugin {
  settings!: PluginSettings;
  stateManager!: SyncStateManager;
  syncEngine!: SyncEngine;
  granolaService!: GranolaService;
  logger!: Logger;
  errorHandler!: ErrorHandler;
  lastError: string = '';
  private syncInterval: number | null = null;
  private eventRefs: EventRef[] = [];
  private statusBarItem: HTMLElement | null = null;
  
  constructor(app: App, manifest: PluginManifest) {
    super(app, manifest);
  }

  async onload() {
    console.log('Loading Granola Sync plugin');
    
    // Initialize logger and error handler
    this.logger = new Logger(this);
    this.errorHandler = new ErrorHandler(this.logger);
    
    // Load settings
    await this.loadSettings();
    
    // Initialize state manager
    this.stateManager = new SyncStateManager(this);
    await this.stateManager.initialize();
    
    // Initialize services
    this.granolaService = new GranolaService(this.settings.apiKey, this.logger);
    const pathGenerator = new PathGenerator(() => this.settings);
    this.syncEngine = new SyncEngine(
      this.stateManager, 
      this.granolaService, 
      pathGenerator,
      this,
      this.logger
    );
    
    // Add settings tab
    this.addSettingTab(new SettingsTab(this.app, this));
    
    // Add commands
    this.addCommand({
      id: 'granola-sync',
      name: 'Sync Granola Meetings',
      callback: async () => {
        await this.performSync();
      }
    });
    
    this.addCommand({
      id: 'granola-test-connection',
      name: 'Test Granola Connection',
      callback: async () => {
        await this.testConnection();
      }
    });
    
    this.addCommand({
      id: 'granola-setup-wizard',
      name: 'Open Setup Wizard',
      callback: () => {
        this.showSetupWizard();
      }
    });

    // Add ribbon icon
    this.addRibbonIcon('sync', 'Granola Sync', async () => {
      await this.performSync();
    });
    
    // Add status bar item
    this.statusBarItem = this.addStatusBarItem();
    this.updateStatusBar();
    
    // Show setup wizard if no API key
    if (!this.settings.apiKey) {
      this.showSetupWizard();
    }
    
    // Set up automatic sync if enabled
    if (this.settings.syncAutomatically) {
      this.startAutoSync();
    }
    
    this.logger.info('Granola Sync plugin loaded');
  }

  async onunload() {
    console.log('Unloading Granola Sync plugin');
    
    // Cancel any ongoing sync
    this.syncEngine?.cancelSync();
    
    // Clear auto-sync interval
    if (this.syncInterval !== null) {
      window.clearInterval(this.syncInterval);
    }
    
    // Cleanup state manager
    this.stateManager?.cleanup();
    
    // Unregister all events
    this.eventRefs.forEach(ref => this.app.workspace.offref(ref));
    
    // Remove status bar item
    if (this.statusBarItem) {
      this.statusBarItem.remove();
    }
    
    this.logger.info('Granola Sync plugin unloaded');
  }
  
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  
  async saveSettings() {
    await this.saveData(this.settings);
    
    // Update services with new settings
    if (this.granolaService) {
      this.granolaService.updateApiKey(this.settings.apiKey);
    }
    
    // Restart auto-sync if needed
    if (this.settings.syncAutomatically) {
      this.startAutoSync();
    } else {
      this.stopAutoSync();
    }
  }
  
  async performSync() {
    if (!this.settings.apiKey) {
      new Notice('Please configure your Granola API key first');
      this.showSetupWizard();
      return;
    }
    
    const modal = new SyncProgressModal(this.app, this.syncEngine, () => {
      this.syncEngine.cancelSync();
    });
    
    modal.open();
    
    try {
      this.updateStatusBar('syncing');
      const result = await this.syncEngine.sync();
      
      if (result.success) {
        new Notice(`Sync complete! ${result.created} created, ${result.updated} updated`);
      } else {
        new Notice(`Sync failed: ${result.errors[0]?.error || 'Unknown error'}`);
      }
      
      modal.showComplete(result);
      this.updateStatusBar();
    } catch (error) {
      this.errorHandler.showError(error, 'Sync operation');
      modal.showError(error instanceof Error ? error.message : 'Unknown error');
      this.updateStatusBar('error');
    }
  }
  
  async testConnection(): Promise<boolean> {
    if (!this.settings.apiKey) {
      new Notice('No API key configured');
      return false;
    }
    
    try {
      const isValid = await this.granolaService.testConnection();
      if (isValid) {
        new Notice('✅ Successfully connected to Granola!');
      } else {
        new Notice('❌ Connection failed. Please check your API key.');
      }
      return isValid;
    } catch (error) {
      this.errorHandler.showError(error, 'Connection test');
      return false;
    }
  }
  
  async validateApiKey(apiKey: string): Promise<boolean> {
    if (!InputValidator.validateApiKey(apiKey)) {
      this.lastError = 'Invalid API key format';
      return false;
    }
    
    try {
      const tempService = new GranolaService(apiKey, this.logger);
      const isValid = await tempService.testConnection();
      
      if (isValid) {
        this.settings.apiKey = apiKey;
        await this.saveSettings();
        return true;
      } else {
        this.lastError = 'Authentication failed';
        return false;
      }
    } catch (error) {
      const errorInfo = this.errorHandler.handleError(error, 'API key validation');
      this.lastError = errorInfo.error;
      return false;
    }
  }
  
  async clearApiKey() {
    this.settings.apiKey = '';
    await this.saveSettings();
  }
  
  showSetupWizard(): SetupWizard {
    const wizard = new SetupWizard(this.app, this);
    wizard.open();
    return wizard;
  }
  
  private startAutoSync() {
    this.stopAutoSync();
    
    // Sync every 30 minutes
    const interval = 30 * 60 * 1000;
    
    this.syncInterval = window.setInterval(async () => {
      this.logger.info('Starting automatic sync');
      await this.performSync();
    }, interval);
    
    this.logger.info('Automatic sync enabled');
  }
  
  private stopAutoSync() {
    if (this.syncInterval !== null) {
      window.clearInterval(this.syncInterval);
      this.syncInterval = null;
      this.logger.info('Automatic sync disabled');
    }
  }
  
  private updateStatusBar(status?: 'syncing' | 'error') {
    if (!this.statusBarItem) return;
    
    const stats = this.stateManager?.getStats();
    
    if (status === 'syncing') {
      this.statusBarItem.setText('🔄 Syncing...');
      this.statusBarItem.addClass('mod-clickable');
    } else if (status === 'error') {
      this.statusBarItem.setText('⚠️ Sync error');
      this.statusBarItem.addClass('mod-clickable');
    } else if (stats) {
      const lastSync = this.settings.lastSync 
        ? new Date(this.settings.lastSync).toLocaleTimeString()
        : 'Never';
      this.statusBarItem.setText(`📅 ${stats.totalFiles} meetings | Last: ${lastSync}`);
      this.statusBarItem.addClass('mod-clickable');
    } else {
      this.statusBarItem.setText('📅 Granola Sync');
      this.statusBarItem.addClass('mod-clickable');
    }
    
    // Make clickable
    this.statusBarItem.onClickEvent((evt) => {
      this.performSync();
    });
  }
}