import { Plugin, TFile, TFolder, Vault, App, PluginManifest, MetadataCache } from 'obsidian';
import GranolaSyncPlugin from '../../src/main';

// Mock Obsidian API
declare global {
  var app: App;
  var moment: any;
}

export function createMockApp(): App {
  const mockVault = {
    getMarkdownFiles: jest.fn(() => []),
    getAbstractFileByPath: jest.fn(),
    create: jest.fn(),
    modify: jest.fn(),
    delete: jest.fn(),
    rename: jest.fn(),
    createFolder: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    adapter: {
      exists: jest.fn(),
      mkdir: jest.fn(),
      rmdir: jest.fn(),
      read: jest.fn(),
      write: jest.fn(),
      stat: jest.fn(),
      list: jest.fn(),
    }
  } as unknown as Vault;
  
  const mockMetadataCache = {
    getFileCache: jest.fn(),
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
  return {
    path,
    name: path.split('/').pop() || '',
    extension: 'md',
    vault: {} as Vault,
    parent: null,
    stat: {
      ctime: Date.now(),
      mtime: Date.now(),
      size: content.length,
    },
  } as TFile;
}

export interface VaultStructure {
  [path: string]: string;
}

// Test helper for plugin lifecycle
export class TestPlugin {
  plugin: GranolaSyncPlugin;
  mockApp: any;
  
  constructor() {
    this.mockApp = createMockApp();
  }
  
  async setup() {
    this.plugin = new GranolaSyncPlugin(this.mockApp, createMockManifest());
    
    // Mock plugin data methods
    this.plugin.loadData = jest.fn().mockResolvedValue({});
    this.plugin.saveData = jest.fn().mockResolvedValue(undefined);
    
    await this.plugin.onload();
  }
  
  async teardown() {
    await this.plugin.onunload();
  }
  
  // Helper to create test vault structure
  async createTestVault(structure: VaultStructure) {
    const files: TFile[] = [];
    
    for (const [path, content] of Object.entries(structure)) {
      const file = createMockFile(path, content);
      files.push(file);
      
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
        
        (this.mockApp.metadataCache.getFileCache as jest.Mock).mockImplementation((f: TFile) => {
          if (f.path === path) {
            return { frontmatter };
          }
          return null;
        });
      }
    }
    
    // Update vault mock to return these files
    (this.mockApp.vault.getMarkdownFiles as jest.Mock).mockReturnValue(files);
    (this.mockApp.vault.getAbstractFileByPath as jest.Mock).mockImplementation((path: string) => {
      return files.find(f => f.path === path) || null;
    });
  }
  
  // Helper to simulate file operations
  async createFile(path: string, content: string) {
    const file = createMockFile(path, content);
    const currentFiles = (this.mockApp.vault.getMarkdownFiles as jest.Mock)();
    (this.mockApp.vault.getMarkdownFiles as jest.Mock).mockReturnValue([...currentFiles, file]);
    return file;
  }
  
  async deleteFile(path: string) {
    const currentFiles = (this.mockApp.vault.getMarkdownFiles as jest.Mock)();
    const filtered = currentFiles.filter((f: TFile) => f.path !== path);
    (this.mockApp.vault.getMarkdownFiles as jest.Mock).mockReturnValue(filtered);
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
    date: new Date().toISOString(),
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
  
  // Mock console methods to reduce noise in tests
  global.console = {
    ...console,
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

// Cleanup function
export function cleanupTestEnvironment() {
  jest.clearAllMocks();
  jest.restoreAllMocks();
}