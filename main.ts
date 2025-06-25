import { App, Plugin, PluginManifest, Notice } from 'obsidian';

export default class GranolaSyncPlugin extends Plugin {
  constructor(app: App, manifest: PluginManifest) {
    super(app, manifest);
  }

  async onload() {
    console.log('Loading Granola Sync plugin');
    
    // Add a simple command to verify plugin works
    this.addCommand({
      id: 'granola-test-command',
      name: 'Test Granola Connection',
      callback: () => {
        new Notice('Granola Sync: Plugin is working! 🎉');
      }
    });

    // Add a ribbon icon (optional, but helps verify plugin is active)
    this.addRibbonIcon('sync', 'Granola Sync', () => {
      new Notice('Granola Sync: Ready to sync meetings!');
    });
  }

  async onunload() {
    console.log('Unloading Granola Sync plugin');
  }
}