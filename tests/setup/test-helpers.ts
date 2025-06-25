import { App, Plugin, PluginManifest, Notice } from 'obsidian';
import GranolaSyncPlugin from '../../src/main';
import {
  createMockMeeting,
  createMockMeetings,
  createMockVault as createMockVaultFromFactory,
  createMockFile,
  createMockFolder,
  createMockGranolaService,
  createMockNotice,
  createMockProgressCallback,
  DEFAULT_TEST_SETTINGS,
  FIXED_DATE,
  FIXED_TIMESTAMP
} from './mock-factory';

export interface TestEnvironment {
  app: App;
  manifest: PluginManifest;
  vault: any;
  workspace: any;
}

// Factory function to create fresh mocks for each test
function createMockWorkspace() {
  return {
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
}

// Factory function to create fresh vault mocks for each test
function createMockVault() {
  return {
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
}

export function createTestEnvironment(): TestEnvironment {
  const mockWorkspace = createMockWorkspace();
  const mockVault = createMockVault();

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

// Enhanced cleanup function to reset all mock states
export function cleanupTestEnvironment(env: TestEnvironment) {
  // Clear all jest mock call histories and implementations
  Object.values(env.vault).forEach(mock => {
    if (jest.isMockFunction(mock)) {
      mock.mockClear();
    }
  });
  
  Object.values(env.workspace).forEach(mock => {
    if (jest.isMockFunction(mock)) {
      mock.mockClear();
    }
  });

  // Reset vault return values to defaults
  env.vault.getFiles.mockReturnValue([]);
  env.vault.getMarkdownFiles.mockReturnValue([]);
  env.vault.getAbstractFileByPath.mockReturnValue(null);
}

// Factory function for plugin mocks - creates fresh mocks each time
function createPluginMocks(initialData: any = {}) {
  return {
    loadData: jest.fn().mockImplementation(async () => ({ ...initialData })),
    saveData: jest.fn().mockResolvedValue(undefined),
    addCommand: jest.fn(),
    addRibbonIcon: jest.fn(),
    addStatusBarItem: jest.fn().mockReturnValue({
      setText: jest.fn(),
      addClass: jest.fn(),
      removeClass: jest.fn(),
      remove: jest.fn(),
      onClickEvent: jest.fn()
    }),
    addSettingTab: jest.fn(),
    registerEvent: jest.fn().mockReturnValue({ e: jest.fn() }),
    registerInterval: jest.fn()
  };
}

// Enhanced plugin mock setup with complete isolation
export function setupPluginMocks(plugin: GranolaSyncPlugin, initialData: any = {}) {
  const freshMocks = createPluginMocks(initialData);
  
  // Apply all mocks to the plugin instance
  Object.entries(freshMocks).forEach(([key, mock]) => {
    (plugin as any)[key] = mock;
  });
  
  // Return the mocks for direct access in tests if needed
  return freshMocks;
}