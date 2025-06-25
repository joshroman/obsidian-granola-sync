import { App, Plugin, PluginManifest, Notice } from 'obsidian';
import { SyncStateManager } from './services/sync-state-manager';
import { DEFAULT_SETTINGS, PluginSettings } from './types';

export default class GranolaSyncPlugin extends Plugin {
  settings: PluginSettings;
  stateManager: SyncStateManager;
  
  constructor(app: App, manifest: PluginManifest) {
    super(app, manifest);
  }

  async onload() {
    console.log('Loading Granola Sync plugin');
    
    // Load settings
    await this.loadSettings();
    
    // Initialize state manager
    this.stateManager = new SyncStateManager(this);
    await this.stateManager.initialize();
    
    // Add test command
    this.addCommand({
      id: 'granola-test-command',
      name: 'Test Granola Connection',
      callback: () => {
        new Notice('Granola Sync: Plugin is working! 🎉');
      }
    });
    
    // Add sync command (placeholder for now)
    this.addCommand({
      id: 'granola-sync',
      name: 'Sync Granola Meetings',
      callback: async () => {
        new Notice('Granola Sync: Sync functionality coming soon!');
        // TODO: Implement sync
      }
    });

    // Add ribbon icon
    this.addRibbonIcon('sync', 'Granola Sync', () => {
      new Notice('Granola Sync: Ready to sync meetings!');
    });
    
    // TODO: Add settings tab
    // TODO: Initialize sync engine
    // TODO: Set up automatic sync if enabled
  }

  async onunload() {
    console.log('Unloading Granola Sync plugin');
    // Cleanup will be handled by Obsidian
  }
  
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  
  async saveSettings() {
    await this.saveData(this.settings);
  }
}