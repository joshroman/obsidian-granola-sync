import { App, Plugin, PluginManifest, Notice, EventRef } from 'obsidian';
import { DEFAULT_SETTINGS, PluginSettings } from './types';
import { SettingsTab } from './ui/settings-tab';
import { SyncProgressModal } from './ui/sync-modal';
import { EnhancedSetupWizard } from './ui/enhanced-wizard-modal';
import { ServiceRegistry } from './services/service-registry';
import { InputValidator } from './utils/input-validator';
import { EnhancedGranolaService } from './services/enhanced-granola-service';
import { StructuredLogger } from './utils/structured-logger';
import { PerformanceMonitor } from './utils/performance-monitor';
import { ErrorTracker } from './utils/error-tracker';
import { EnhancedStateManager } from './services/enhanced-state-manager';
import { SyncEngine } from './services/sync-engine';
import { Logger } from './utils/logger';
import { ErrorHandler } from './utils/error-handler';
import { TokenManager } from './services/token-manager';
import { PanelProcessor } from './services/panel-processor';
import { FileLogger } from './utils/file-logger';
import { PluginValidator } from './utils/plugin-validator';

export default class GranolaSyncPlugin extends Plugin {
  settings!: PluginSettings;
  private serviceRegistry!: ServiceRegistry;
  lastError: string = '';
  private syncInterval: number | null = null;
  private eventRefs: EventRef[] = [];
  private statusBarItem: HTMLElement | null = null;
  
  // Service accessor properties
  get stateManager() { return this.serviceRegistry.get<EnhancedStateManager>('stateManager')!; }
  get syncEngine() { return this.serviceRegistry.get<SyncEngine>('syncEngine')!; }
  get granolaService() { return this.serviceRegistry.get<EnhancedGranolaService>('granolaService')!; }
  get logger() { return this.serviceRegistry.get<Logger>('logger')!; }
  get errorHandler() { return this.serviceRegistry.get<ErrorHandler>('errorHandler')!; }
  get tokenManager() { return this.serviceRegistry.get<TokenManager>('tokenManager'); }
  get performanceMonitor() { return this.serviceRegistry.get<PerformanceMonitor>('performanceMonitor')!; }
  get errorTracker() { return this.serviceRegistry.get<ErrorTracker>('errorTracker')!; }
  get structuredLogger() { return this.serviceRegistry.get<StructuredLogger>('structuredLogger')!; }
  get panelProcessor() { return this.serviceRegistry.get<PanelProcessor>('panelProcessor')!; }
  get fileLogger() { return this.serviceRegistry.get<FileLogger>('fileLogger')!; }
  
  constructor(app: App, manifest: PluginManifest) {
    super(app, manifest);
  }

  async onload() {
    console.log('Loading Granola Sync plugin');
    
    
    // Load settings
    await this.loadSettings();
    
    // Initialize service registry
    try {
      this.serviceRegistry = new ServiceRegistry(this);
      await this.serviceRegistry.initialize(this.settings);
    } catch (error) {
      console.error('Service registry initialization failed:', error);
      new Notice('⚠️ Granola Sync: Service initialization failed. Plugin may not work correctly.');
      // Continue loading - don't fail completely
    }
    
    // Validate plugin initialization (non-blocking)
    try {
      const validation = await PluginValidator.validateInitialization(this);
      if (!validation.allPassed) {
        console.warn('Plugin validation warnings:', validation.failures);
        PluginValidator.showValidationResults(validation);
      }
    } catch (error) {
      console.warn('Plugin validation failed, but continuing load:', error);
    }
    
    // Start health monitoring
    PluginValidator.startHealthMonitoring();
    
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
    
    this.addCommand({
      id: 'granola-reset-sync-state',
      name: 'Reset Sync State',
      callback: async () => {
        const confirmed = confirm('This will reset the sync state and allow re-syncing all meetings. Use this after manually deleting meeting files. Continue?');
        if (confirmed) {
          await this.resetSyncState();
          new Notice('✅ Sync state reset. You can now sync all meetings again.');
        }
      }
    });
    
    this.addCommand({
      id: 'granola-force-sync-all',
      name: 'Force Sync All Meetings',
      callback: async () => {
        const confirmed = confirm('This will sync ALL meetings from Granola, ignoring the last sync time. Continue?');
        if (confirmed) {
          await this.performSync(true);
        }
      }
    });
    
    this.addCommand({
      id: 'granola-debug-meeting-data',
      name: 'Debug Granola Meeting Data',
      callback: async () => {
        await this.granolaService.debugMeetingData();
        new Notice('Check console for meeting data');
      }
    });
    
    this.addCommand({
      id: 'granola-export-debug-logs',
      name: 'Export Debug Logs',
      callback: async () => {
        await this.exportDebugLogs();
      }
    });

    // Add ribbon icon
    this.addRibbonIcon('sync', 'Granola Sync', async () => {
      await this.performSync();
    });
    
    // Add status bar item
    this.statusBarItem = this.addStatusBarItem();
    this.updateStatusBar();
    
    // Show setup wizard if not completed
    if (!this.settings.wizardCompleted) {
      // Show wizard for initial setup or incomplete setup
      this.showSetupWizard();
    }
    
    // Set up automatic sync if enabled
    if (this.settings.autoSync) {
      this.startAutoSync();
    }
    
    if (this.logger) {
      this.logger.info('Granola Sync plugin loaded');
    }
  }

  async onunload() {
    console.log('Unloading Granola Sync plugin');
    
    // Clear auto-sync interval
    if (this.syncInterval !== null) {
      window.clearInterval(this.syncInterval);
    }
    
    // Unregister all events
    this.eventRefs.forEach(ref => this.app.workspace.offref(ref));
    
    // Remove status bar item
    if (this.statusBarItem) {
      this.statusBarItem.remove();
    }
    
    // Clean up all services through registry
    await this.serviceRegistry?.cleanup();
    
    console.log('Granola Sync plugin unloaded');
  }
  
  
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  
  async saveSettings() {
    await this.saveData(this.settings);
    
    // Update service configurations through registry
    await this.serviceRegistry.updateConfiguration(this.settings);
    
    // Restart auto-sync if needed
    if (this.settings.autoSync) {
      this.startAutoSync();
    } else {
      this.stopAutoSync();
    }
  }
  
  async updateSettings(newSettings: PluginSettings) {
    // Update plugin settings with new values
    this.settings = newSettings;
    await this.saveSettings();
  }
  
  async performSync(forceAll: boolean = false) {
    // Check if we have authentication (either token manager or manual API key)
    const hasAuth = this.tokenManager?.hasTokens() || this.settings.apiKey;
    
    if (!hasAuth) {
      new Notice('Please connect to Granola first');
      this.showSetupWizard();
      return;
    }
    
    // In test environment, skip modal
    if (process.env.NODE_ENV === 'test') {
      try {
        const result = await this.syncEngine.sync(forceAll);
        if (result.success) {
          new Notice(`Sync complete! ${result.created} created, ${result.updated} updated`);
        } else {
          new Notice(`Sync failed: ${result.errors[0]?.error || 'Unknown error'}`);
        }
        return result;
      } catch (error) {
        this.lastError = error instanceof Error ? error.message : 'Unknown error';
        throw error;
      }
    }
    
    const modal = new SyncProgressModal(this.app, this.syncEngine, () => {
      this.syncEngine.cancelSync();
    });
    
    modal.open();
    
    try {
      this.updateStatusBar('syncing');
      const result = await this.syncEngine.sync(forceAll);
      
      if (result && result.success) {
        new Notice(`Sync complete! ${result.created} created, ${result.updated} updated`);
      } else if (result && result.errors && result.errors.length > 0) {
        new Notice(`Sync failed: ${result.errors[0]?.error || 'Unknown error'}`);
      } else {
        new Notice('Sync failed: Unknown error');
      }
      
      if (result) {
        modal.showComplete(result);
      }
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
      const tempService = new EnhancedGranolaService(
        { apiKey },
        new StructuredLogger('TempGranolaService', this),
        this.performanceMonitor,
        this.errorTracker
      );
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
  
  showSetupWizard(): EnhancedSetupWizard {
    const wizard = new EnhancedSetupWizard(this.app, this, async (settings) => {
      // Update settings through proper handler to ensure services are updated
      await this.updateSettings(settings);
      new Notice('Setup complete! You can now sync your meetings.');
    });
    wizard.open();
    return wizard;
  }
  
  async resetSyncState() {
    if (this.logger) {
      this.logger.info('Resetting sync state...');
    }
    
    // Clear the state manager
    await this.stateManager.clearState();
    
    // Clear last sync time
    this.settings.lastSync = '';
    await this.saveSettings();
    
    if (this.logger) {
      this.logger.info('Sync state reset complete');
    }
    this.updateStatusBar();
  }
  
  async exportDebugLogs() {
    try {
      new Notice('📦 Exporting debug logs...');
      
      const result = await this.fileLogger.exportLogs();
      
      // Open the folder containing the export
      const { shell } = require('electron');
      shell.showItemInFolder(result.path);
      
      new Notice(`✅ Debug logs exported to: ${result.filename}`);
    } catch (error) {
      this.logger.error('Failed to export debug logs', error as Error);
      new Notice('❌ Failed to export debug logs. Check console for details.');
    }
  }
  
  private startAutoSync() {
    this.stopAutoSync();
    
    // Use interval from settings, default to 15 minutes
    const interval = this.settings.syncInterval || 900000;
    
    this.syncInterval = window.setInterval(async () => {
      if (this.logger) {
        this.logger.info('Starting automatic sync');
      }
      await this.performSync();
    }, interval);
    
    if (this.logger) {
      this.logger.info(`Automatic sync enabled (interval: ${interval}ms)`);
    }
  }
  
  private stopAutoSync() {
    if (this.syncInterval !== null) {
      window.clearInterval(this.syncInterval);
      this.syncInterval = null;
      if (this.logger) {
        this.logger.info('Automatic sync disabled');
      }
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