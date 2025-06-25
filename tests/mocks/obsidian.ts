// Mock Obsidian module for testing

export class Plugin {
  app: any;
  manifest: any;
  
  constructor(app: any, manifest: any) {
    this.app = app;
    this.manifest = manifest;
  }
  
  loadData = jest.fn().mockResolvedValue({});
  saveData = jest.fn().mockResolvedValue(undefined);
  
  addCommand = jest.fn();
  addRibbonIcon = jest.fn();
  addSettingTab = jest.fn();
  registerEvent = jest.fn();
  registerInterval = jest.fn();
  
  async onload() {}
  async onunload() {}
}

export class PluginManifest {
  id = 'test-plugin';
  name = 'Test Plugin';
  version = '1.0.0';
  minAppVersion = '0.15.0';
  description = 'Test plugin';
  author = 'Test Author';
  authorUrl = '';
  isDesktopOnly = true;
  dir = '';
}

export class Notice {
  constructor(message: string, timeout?: number) {
    console.log('Notice:', message);
  }
}

export class TFile {
  path: string;
  name: string;
  extension: string;
  vault: any;
  parent: any;
  stat: any;
  
  constructor(path: string) {
    this.path = path;
    this.name = path.split('/').pop() || '';
    this.extension = 'md';
  }
}

export class TFolder {
  path: string;
  name: string;
  parent: any;
  
  constructor(path: string) {
    this.path = path;
    this.name = path.split('/').pop() || '';
  }
}

export class TAbstractFile {
  path: string;
  name: string;
  parent: any;
  
  constructor(path: string) {
    this.path = path;
    this.name = path.split('/').pop() || '';
  }
}

export class App {
  vault: any;
  metadataCache: any;
  workspace: any;
}

export class Modal {
  app: App;
  contentEl: HTMLElement;
  titleEl: HTMLElement;
  
  constructor(app: App) {
    this.app = app;
    this.contentEl = document.createElement('div');
    this.titleEl = document.createElement('div');
  }
  
  open() {}
  close() {}
}

export class PluginSettingTab {
  app: App;
  plugin: any;
  containerEl: HTMLElement;
  
  constructor(app: App, plugin: any) {
    this.app = app;
    this.plugin = plugin;
    this.containerEl = document.createElement('div');
  }
  
  display() {}
  hide() {}
}

export class Setting {
  containerEl: HTMLElement;
  
  constructor(containerEl: HTMLElement) {
    this.containerEl = containerEl;
  }
  
  setName(name: string) { return this; }
  setDesc(desc: string) { return this; }
  addText(cb: any) { return this; }
  addTextArea(cb: any) { return this; }
  addDropdown(cb: any) { return this; }
  addToggle(cb: any) { return this; }
  addButton(cb: any) { return this; }
}

export interface Vault {
  getMarkdownFiles(): TFile[];
  getAbstractFileByPath(path: string): TAbstractFile | null;
  create(path: string, content: string): Promise<TFile>;
  modify(file: TFile, content: string): Promise<void>;
  delete(file: TAbstractFile, force?: boolean): Promise<void>;
  rename(file: TAbstractFile, newPath: string): Promise<void>;
  createFolder(path: string): Promise<void>;
  on(event: string, callback: Function): any;
  off(event: string, callback: Function): void;
  adapter: any;
}

export interface MetadataCache {
  getFileCache(file: TFile): any;
  on(event: string, callback: Function): any;
  off(event: string, callback: Function): void;
}