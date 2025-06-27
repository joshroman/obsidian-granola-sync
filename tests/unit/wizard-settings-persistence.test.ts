import { App, Modal, ButtonComponent, Setting } from 'obsidian';
import { EnhancedSetupWizard } from '../../src/ui/enhanced-wizard-modal';
import GranolaSyncPlugin from '../../src/main';
import { PluginSettings, DEFAULT_SETTINGS } from '../../src/types';

// Mock Obsidian API
jest.mock('obsidian', () => ({
  App: jest.fn(),
  Modal: class MockModal {
    app: any;
    contentEl: any;
    modalEl: any;
    constructor(app: any) {
      this.app = app;
      this.contentEl = {
        empty: jest.fn(),
        addClass: jest.fn(),
        createDiv: jest.fn(() => ({
          createEl: jest.fn(),
          createDiv: jest.fn(() => ({
            createEl: jest.fn(),
            createDiv: jest.fn(),
            createSpan: jest.fn()
          })),
          empty: jest.fn()
        }))
      };
      this.modalEl = {
        addClass: jest.fn()
      };
    }
    open() {}
    close() {}
  },
  Setting: jest.fn(() => ({
    setName: jest.fn().mockReturnThis(),
    setDesc: jest.fn().mockReturnThis(),
    addText: jest.fn().mockReturnThis(),
    addToggle: jest.fn().mockReturnThis(),
    addDropdown: jest.fn().mockReturnThis(),
    addButton: jest.fn().mockReturnThis(),
    settingEl: {
      style: { display: '' }
    },
    controlEl: {
      addClass: jest.fn()
    }
  })),
  ButtonComponent: jest.fn(() => ({
    setButtonText: jest.fn().mockReturnThis(),
    setCta: jest.fn().mockReturnThis(),
    setDisabled: jest.fn().mockReturnThis(),
    onClick: jest.fn().mockReturnThis(),
    buttonEl: {
      addClass: jest.fn()
    }
  })),
  Notice: jest.fn()
}));

describe('Wizard Settings Persistence Tests', () => {
  let wizard: EnhancedSetupWizard;
  let mockPlugin: GranolaSyncPlugin;
  let mockApp: App;
  let capturedSettings: PluginSettings;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create mock app
    mockApp = new App();
    
    // Create mock plugin
    mockPlugin = {
      app: mockApp,
      settings: { ...DEFAULT_SETTINGS },
      updateSettings: jest.fn(async (settings) => {
        capturedSettings = settings;
      }),
      tokenManager: {
        hasTokens: jest.fn(() => false)
      }
    } as any;
    
    // Create wizard
    wizard = new EnhancedSetupWizard(mockApp, mockPlugin, async (settings) => {
      await mockPlugin.updateSettings(settings);
    });
  });
  
  it('should preserve all settings when wizard completes', async () => {
    // Set up test settings during wizard flow
    const testSettings = {
      apiKey: 'test-api-key-123',
      targetFolder: 'My Meeting Notes',
      folderOrganization: 'mirror-granola' as const,
      includeDateInFilename: false,
      dateFormat: 'dd-MM-yyyy',
      templateFilterEnabled: true,
      templateFilter: 'My Custom Template',
      includeTranscript: false,
      autoSync: true,
      syncInterval: 1800000 // 30 minutes
    };
    
    // Simulate wizard settings being set
    (wizard as any).settings = { ...testSettings };
    
    // Call complete method
    await (wizard as any).complete();
    
    // Verify updateSettings was called
    expect(mockPlugin.updateSettings).toHaveBeenCalledTimes(1);
    
    // Verify all settings were preserved
    expect(capturedSettings).toMatchObject({
      ...testSettings,
      wizardCompleted: true
    });
  });
  
  it('should correctly set folderOrganization modes', async () => {
    const organizationModes = ['flat', 'by-date', 'mirror-granola'] as const;
    
    for (const mode of organizationModes) {
      // Reset mocks
      jest.clearAllMocks();
      
      // Set organization mode
      (wizard as any).settings = {
        folderOrganization: mode,
        targetFolder: 'Meetings'
      };
      
      // Complete wizard
      await (wizard as any).complete();
      
      // Verify setting was applied
      expect(capturedSettings.folderOrganization).toBe(mode);
    }
  });
  
  it('should correctly handle date prefix settings', async () => {
    // Test with date prefix enabled
    (wizard as any).settings = {
      includeDateInFilename: true,
      dateFormat: 'yyyy-MM-dd'
    };
    
    await (wizard as any).complete();
    
    expect(capturedSettings.includeDateInFilename).toBe(true);
    expect(capturedSettings.dateFormat).toBe('yyyy-MM-dd');
    
    // Test with date prefix disabled
    jest.clearAllMocks();
    (wizard as any).settings = {
      includeDateInFilename: false
    };
    
    await (wizard as any).complete();
    
    expect(capturedSettings.includeDateInFilename).toBe(false);
  });
  
  it('should correctly handle template settings', async () => {
    // Test with template filter enabled
    (wizard as any).settings = {
      templateFilterEnabled: true,
      templateFilter: 'Project Alpha Template'
    };
    
    await (wizard as any).complete();
    
    expect(capturedSettings.templateFilterEnabled).toBe(true);
    expect(capturedSettings.templateFilter).toBe('Project Alpha Template');
    
    // Test with template filter disabled
    jest.clearAllMocks();
    (wizard as any).settings = {
      templateFilterEnabled: false
    };
    
    await (wizard as any).complete();
    
    expect(capturedSettings.templateFilterEnabled).toBe(false);
  });
  
  it('should merge with existing plugin settings', async () => {
    // Set some existing settings in plugin
    mockPlugin.settings = {
      ...DEFAULT_SETTINGS,
      apiKey: 'existing-key',
      someOtherSetting: 'should-be-preserved'
    } as any;
    
    // Set new settings in wizard
    (wizard as any).settings = {
      targetFolder: 'New Folder',
      folderOrganization: 'by-date' as const
    };
    
    await (wizard as any).complete();
    
    // Verify merge happened correctly
    expect(capturedSettings).toMatchObject({
      apiKey: 'existing-key', // Preserved from existing
      targetFolder: 'New Folder', // Updated from wizard
      folderOrganization: 'by-date', // Updated from wizard
      someOtherSetting: 'should-be-preserved', // Preserved
      wizardCompleted: true
    });
  });
  
  it('should handle all sync interval options', async () => {
    const intervals = [
      { value: 300000, label: '5 minutes' },
      { value: 900000, label: '15 minutes' },
      { value: 1800000, label: '30 minutes' },
      { value: 3600000, label: '1 hour' }
    ];
    
    for (const interval of intervals) {
      jest.clearAllMocks();
      
      (wizard as any).settings = {
        autoSync: true,
        syncInterval: interval.value
      };
      
      await (wizard as any).complete();
      
      expect(capturedSettings.autoSync).toBe(true);
      expect(capturedSettings.syncInterval).toBe(interval.value);
    }
  });
});