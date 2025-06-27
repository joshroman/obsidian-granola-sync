import { Plugin, TFile, TFolder, Vault, App, PluginManifest, MetadataCache } from 'obsidian';
import GranolaSyncPlugin from '../../src/main';
import { MockLogger } from '../mocks/logger';
import { TFile as MockTFile } from '../mocks/obsidian';

// Mock Obsidian API
declare global {
  var app: App;
}

// Polyfill window timers for Node.js environment
if (typeof window === 'undefined') {
  (global as any).window = {
    setTimeout: global.setTimeout.bind(global),
    clearTimeout: global.clearTimeout.bind(global),
    setInterval: global.setInterval.bind(global),
    clearInterval: global.clearInterval.bind(global)
  };
}

// Add Obsidian-specific methods to DocumentFragment and Elements
function addObsidianMethodsGlobally(target: any) {
  target.empty = function() {
    while (this.firstChild) {
      this.removeChild(this.firstChild);
    }
  };
  
  target.setText = function(text: string) {
    this.textContent = text;
    return this;
  };
  
  target.getText = function() {
    return this.textContent || '';
  };
  
  target.addClass = function(cls: string) {
    if (this.classList) this.classList.add(cls);
    return this;
  };
  
  target.removeClass = function(cls: string) {
    if (this.classList) this.classList.remove(cls);
    return this;
  };
  
  target.toggleClass = function(cls: string, force?: boolean) {
    if (this.classList) this.classList.toggle(cls, force);
    return this;
  };
  
  target.createEl = function(tag: string, options?: any) {
    const el = document.createElement(tag);
    if (options) {
      if (options.text) el.textContent = options.text;
      if (options.cls) el.className = options.cls;
      if (options.attr) {
        Object.entries(options.attr).forEach(([key, value]) => {
          el.setAttribute(key, value as string);
        });
      }
    }
    this.appendChild(el);
    addObsidianMethodsGlobally(el);
    return el;
  };
  
  target.createDiv = function(options?: any) {
    return this.createEl('div', options);
  };
}

// Apply to DocumentFragment and HTMLElement prototypes
if (typeof DocumentFragment !== 'undefined') {
  addObsidianMethodsGlobally(DocumentFragment.prototype);
}
if (typeof HTMLElement !== 'undefined') {
  addObsidianMethodsGlobally(HTMLElement.prototype);
}

export function createMockApp(): App {
  const createdFiles = new Map<string, TFile>();
  
  const mockVault = {
    getMarkdownFiles: jest.fn(() => Array.from(createdFiles.values())),
    getAbstractFileByPath: jest.fn((path: string) => createdFiles.get(path) || null),
    create: jest.fn(async (path: string, content: string) => {
      const file = createMockFile(path, content);
      createdFiles.set(path, file);
      return file;
    }),
    modify: jest.fn(async (file: TFile, content: string) => {
      // Update the file's stat to reflect modification
      if (file.stat) {
        file.stat.mtime = Date.now();
        file.stat.size = content.length;
      }
    }),
    delete: jest.fn(async (file: TFile) => {
      createdFiles.delete(file.path);
    }),
    read: jest.fn(async (file: TFile) => {
      const fileData = createdFiles.get(file.path);
      if (!fileData) {
        throw new Error(`File not found: ${file.path}`);
      }
      // Return the content that was stored when the file was created
      return (fileData as any).content || '';
    }),
    rename: jest.fn(async (file: TFile, newPath: string) => {
      const fileData = createdFiles.get(file.path);
      if (fileData) {
        createdFiles.delete(file.path);
        fileData.path = newPath;
        fileData.name = newPath.split('/').pop() || '';
        createdFiles.set(newPath, fileData);
      }
    }),
    createFolder: jest.fn(),
    on: jest.fn((event: string, handler: Function) => {
      // Return a mock event reference
      return { event, handler };
    }),
    off: jest.fn(),
    offref: jest.fn(),
    adapter: {
      exists: jest.fn((path: string) => createdFiles.has(path)),
      mkdir: jest.fn(),
      rmdir: jest.fn(),
      read: jest.fn(async (path: string) => {
        const file = createdFiles.get(path);
        if (!file) throw new Error(`File not found: ${path}`);
        return 'Mock file content';
      }),
      write: jest.fn(),
      stat: jest.fn(),
      list: jest.fn(),
    }
  } as unknown as Vault;
  
  const mockMetadataCache = {
    getFileCache: jest.fn((file: TFile) => {
      // Return frontmatter metadata for files
      const content = (file as any).content;
      if (content) {
        const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
        if (frontmatterMatch) {
          const frontmatter: any = {};
          const lines = frontmatterMatch[1].split('\n');
          for (const line of lines) {
            const [key, value] = line.split(':').map(s => s.trim());
            if (key && value) {
              frontmatter[key] = value.replace(/['"]/g, '');
            }
          }
          return { frontmatter };
        }
      }
      return null;
    }),
    on: jest.fn(),
    off: jest.fn(),
  } as unknown as MetadataCache;
  
  const mockWorkspace = {
    on: jest.fn(),
    off: jest.fn(),
    getActiveFile: jest.fn(),
    getActiveViewOfType: jest.fn(),
  };
  
  return {
    vault: mockVault,
    metadataCache: mockMetadataCache,
    workspace: mockWorkspace,
  } as unknown as App;
}

export function createMockManifest(): PluginManifest {
  return {
    id: 'granola-sync',
    name: 'Granola Sync',
    version: '0.0.1',
    minAppVersion: '0.15.0',
    description: 'Test plugin',
    author: 'Test Author',
    authorUrl: '',
    isDesktopOnly: true,
    dir: '',
  };
}

export function createMockFile(path: string, content: string): TFile {
  const file = new MockTFile(path) as any;
  file.stat = {
    ctime: Date.now(),
    mtime: Date.now(),
    size: content.length,
  };
  file.vault = {} as Vault;
  file.parent = null;
  file.content = content;  // Store content for the read method
  return file as TFile;
}

export interface VaultStructure {
  [path: string]: string;
}

// Test helper for plugin lifecycle
export class TestPlugin {
  plugin!: GranolaSyncPlugin;
  mockApp: any;
  
  constructor() {
    this.mockApp = createMockApp();
  }
  
  async setup() {
    this.plugin = new GranolaSyncPlugin(this.mockApp, createMockManifest());
    
    // Mock plugin data methods with API key to prevent SetupWizard
    this.plugin.loadData = jest.fn().mockResolvedValue({ 
      apiKey: 'test-api-key',
      enhancedSyncState: {
        version: 2,
        fileIndex: {},
        deletedIds: [],
        lastSync: null,
        stateChecksum: ''
      }
    });
    this.plugin.saveData = jest.fn().mockImplementation(async (data) => {
      // Simulate successful save
      return Promise.resolve();
    });
    
    // Mock plugin UI methods
    (this.plugin as any).addCommand = jest.fn();
    (this.plugin as any).addRibbonIcon = jest.fn();
    (this.plugin as any).addStatusBarItem = jest.fn().mockReturnValue({
      setText: jest.fn(),
      addClass: jest.fn(),
      removeClass: jest.fn(),
      remove: jest.fn(),
      onClickEvent: jest.fn()
    });
    (this.plugin as any).addSettingTab = jest.fn();
    (this.plugin as any).registerEvent = jest.fn((eventRef: any) => eventRef);
    (this.plugin as any).registerInterval = jest.fn();
    
    await this.plugin.onload();
  }
  
  async teardown() {
    await this.plugin.onunload();
  }
  
  // Helper to create test vault structure
  async createTestVault(structure: VaultStructure) {
    for (const [path, content] of Object.entries(structure)) {
      // Use the vault's create method to ensure files are tracked properly
      await this.mockApp.vault.create(path, content);
      
      // Mock the metadata cache for this file
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (frontmatterMatch) {
        const frontmatter: any = {};
        const lines = frontmatterMatch[1].split('\n');
        for (const line of lines) {
          const [key, value] = line.split(':').map(s => s.trim());
          if (key && value) {
            frontmatter[key] = value.replace(/['"]/g, '');
          }
        }
        
        const existingImpl = (this.mockApp.metadataCache.getFileCache as jest.Mock).getMockImplementation();
        (this.mockApp.metadataCache.getFileCache as jest.Mock).mockImplementation((f: TFile) => {
          if (f.path === path) {
            return { frontmatter };
          }
          return existingImpl ? existingImpl(f) : null;
        });
      }
    }
  }
  
  // Helper to simulate file operations
  async createFile(path: string, content: string) {
    return await this.mockApp.vault.create(path, content);
  }
  
  async deleteFile(path: string) {
    const file = this.mockApp.vault.getAbstractFileByPath(path);
    if (file) {
      await this.mockApp.vault.delete(file);
    }
  }
  
  // Helper to get plugin settings
  getSettings() {
    return this.plugin.settings;
  }
  
  // Helper to update plugin settings
  async updateSettings(settings: Partial<any>) {
    Object.assign(this.plugin.settings, settings);
    await this.plugin.saveSettings();
  }
}

// Mock Granola API responses
export const mockGranolaAPI = {
  getMeetings: jest.fn(),
  getMeeting: jest.fn(),
  testConnection: jest.fn(),
};

// Test data generators
export function generateMockMeeting(overrides: Partial<any> = {}) {
  return {
    id: Math.random().toString(36).substr(2, 9),
    title: 'Test Meeting',
    date: new Date(),
    transcript: 'This is a test transcript.',
    summary: 'Test meeting summary',
    highlights: ['Key point 1', 'Key point 2'],
    attendees: ['John Doe', 'Jane Smith'],
    duration: 60,
    granolaFolder: 'Work/Meetings',
    tags: ['test', 'meeting'],
    attachments: [],
    ...overrides,
  };
}

// Setup function to be called in test files
export function setupTestEnvironment() {
  // Set up global mocks
  global.app = createMockApp();
  global.moment = require('moment');
  
  // Keep console methods for debugging
  // Uncomment to suppress console output:
  // global.console = {
  //   ...console,
  //   log: jest.fn(),
  //   warn: jest.fn(),
  //   error: jest.fn(),
  // };
}

// Cleanup function
export function cleanupTestEnvironment() {
  jest.clearAllMocks();
  jest.restoreAllMocks();
}