import { App, Plugin, PluginManifest } from 'obsidian';
import GranolaSyncPlugin from '../../src/main';

export interface TestEnvironment {
  app: App;
  manifest: PluginManifest;
  vault: any;
  workspace: any;
}

export function createTestEnvironment(): TestEnvironment {
  const mockWorkspace = {
    activeLeaf: null,
    on: jest.fn(),
    off: jest.fn(),
    trigger: jest.fn(),
    getLeavesOfType: jest.fn().mockReturnValue([]),
    revealLeaf: jest.fn(),
    getActiveViewOfType: jest.fn(),
    onLayoutReady: jest.fn((callback) => callback()),
    requestSaveLayout: jest.fn(),
    offref: jest.fn()
  };

  const mockVault = {
    getFiles: jest.fn().mockReturnValue([]),
    getMarkdownFiles: jest.fn().mockReturnValue([]),
    getAbstractFileByPath: jest.fn(),
    create: jest.fn(),
    modify: jest.fn(),
    delete: jest.fn(),
    rename: jest.fn(),
    createFolder: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    adapter: {
      path: {
        join: (...parts: string[]) => parts.join('/'),
        dirname: (path: string) => path.split('/').slice(0, -1).join('/'),
        basename: (path: string) => path.split('/').pop() || ''
      }
    }
  };

  const mockApp = {
    workspace: mockWorkspace,
    vault: mockVault,
    metadataCache: {
      getFirstLinkpathDest: jest.fn(),
      getFileCache: jest.fn(),
      on: jest.fn(),
      off: jest.fn()
    },
    fileManager: {
      getNewFileParent: jest.fn().mockReturnValue({ path: '' }),
      renameFile: jest.fn()
    }
  } as unknown as App;

  const manifest: PluginManifest = {
    id: 'granola-sync',
    name: 'Granola Sync',
    version: '0.0.1',
    minAppVersion: '0.15.0',
    description: 'Test plugin',
    author: 'Test Author',
    authorUrl: '',
    isDesktopOnly: true,
    dir: ''
  };

  return {
    app: mockApp,
    manifest,
    vault: mockVault,
    workspace: mockWorkspace
  };
}

// Extend GranolaSyncPlugin with test methods
export function setupPluginMocks(plugin: GranolaSyncPlugin, initialData: any = {}) {
  // Mock plugin data methods
  (plugin as any).loadData = jest.fn().mockImplementation(async () => {
    // Return both plugin settings and state manager data
    return { ...initialData };
  });
  (plugin as any).saveData = jest.fn().mockResolvedValue(undefined);
  
  // Mock plugin UI methods
  (plugin as any).addCommand = jest.fn();
  (plugin as any).addRibbonIcon = jest.fn();
  (plugin as any).addStatusBarItem = jest.fn().mockReturnValue({
    setText: jest.fn(),
    addClass: jest.fn(),
    removeClass: jest.fn(),
    remove: jest.fn(),
    onClickEvent: jest.fn()
  });
  (plugin as any).addSettingTab = jest.fn();
  (plugin as any).registerEvent = jest.fn().mockReturnValue({ e: jest.fn() });
  (plugin as any).registerInterval = jest.fn();
}