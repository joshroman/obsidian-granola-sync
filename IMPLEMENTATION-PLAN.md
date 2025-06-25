# Granola Obsidian Plugin - Implementation Plan

## Overview
A pragmatic, test-driven Obsidian plugin that syncs meeting data from Granola to your vault with a focus on reliability, performance, and user experience.

## Core Principles
1. **Pragmatic Security**: Balance security with usability
2. **Test-First Development**: Write tests before implementation
3. **User-Centric Design**: Prioritize ease of use and clear feedback
4. **Incremental Delivery**: Ship working features incrementally

## Project Phases

### Phase 0: Proof of Concept ✅ (Complete)

#### Objective
Create a minimal "no-op" Obsidian plugin to validate our development setup and local testing workflow before investing in full feature development.

#### Deliverables
- Minimal working plugin that loads in Obsidian
- Local development workflow established
- Basic command that shows a notice
- Confirm hot-reload setup works

#### Implementation Steps
1. **Create minimal plugin structure**
   ```bash
   # Create basic files
   mkdir -p .obsidian/plugins/granola-sync
   touch manifest.json main.ts package.json tsconfig.json
   ```

2. **Minimal manifest.json**
   ```json
   {
     "id": "granola-sync",
     "name": "Granola Sync",
     "version": "0.0.1",
     "minAppVersion": "0.15.0",
     "description": "Proof of concept for Granola meeting sync",
     "author": "Your Name",
     "authorUrl": "https://yoursite.com",
     "isDesktopOnly": true
   }
   ```

3. **Minimal main.ts**
   ```typescript
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
     }

     async onunload() {
       console.log('Unloading Granola Sync plugin');
     }
   }
   ```

4. **Development workflow setup**
   - Install dependencies: `npm install obsidian @types/node typescript`
   - Build command: `npm run build` (compiles to main.js)
   - Copy files to vault: `.obsidian/plugins/granola-sync/`
   - Enable plugin in Obsidian settings
   - Test the command via Command Palette

5. **Validation checklist**
   - [ ] Plugin appears in Obsidian's Community Plugins list (installed)
   - [ ] Plugin can be enabled without errors
   - [ ] Test command appears in Command Palette
   - [ ] Command shows notice when executed
   - [ ] Console logs appear in Developer Tools
   - [ ] Changes to main.ts reflect after rebuild + reload

### Phase Workflow After Each Phase

After completing each phase, we follow these steps:

1. **Expert Review with AI Models**
   - Use Zen MCP server to get code review from o3 and Gemini models
   - Incorporate their feedback on architecture, performance, and best practices
   - Address any security concerns or edge cases they identify

2. **Git Commit for Rollback**
   - Create atomic commit with clear message describing the phase completion
   - Tag the commit with phase number for easy reference
   - Ensure working directory is clean before proceeding

3. **Continue to Next Phase**
   - Only proceed after review feedback is addressed
   - Carry forward any learnings or improvements suggested

### Phase 0.5: Critical Infrastructure & Junior Dev Setup

#### Objective
Address critical gaps identified in expert review before proceeding with main implementation. Set up robust infrastructure for state management, testing, and developer support.

#### Deliverables
- State management system for tracking synced files
- Concrete E2E test environment setup
- Junior developer toolkit and skeleton code
- Input validation framework
- Performance optimization groundwork

#### State Management System
```typescript
// src/services/sync-state-manager.ts
interface SyncState {
  // Version for migration support
  version: number;
  // Map of granolaId -> current file path
  fileIndex: Map<string, string>;
  // Track deleted files to prevent recreation
  deletedIds: Set<string>;
  // Last sync timestamp
  lastSync: string;
}

class SyncStateManager {
  private state: SyncState;
  private stateFile = '.granola-sync-state.json';
  
  async initialize(): Promise<void> {
    // Load state from plugin data
    const saved = await this.plugin.loadData();
    if (saved?.syncState) {
      this.state = this.deserializeState(saved.syncState);
      await this.validateAndMigrateState();
    } else {
      this.state = this.createEmptyState();
    }
    
    // Register vault event listeners
    this.plugin.registerEvent(
      this.app.vault.on('rename', this.handleRename.bind(this))
    );
    this.plugin.registerEvent(
      this.app.vault.on('delete', this.handleDelete.bind(this))
    );
    
    // Build initial index from vault
    await this.rebuildIndex();
  }
  
  async rebuildIndex(): Promise<void> {
    const files = this.app.vault.getMarkdownFiles();
    const newIndex = new Map<string, string>();
    
    for (const file of files) {
      const cache = this.app.metadataCache.getFileCache(file);
      const granolaId = cache?.frontmatter?.granolaId;
      if (granolaId) {
        newIndex.set(granolaId, file.path);
      }
    }
    
    this.state.fileIndex = newIndex;
    await this.saveState();
  }
  
  async handleRename(file: TAbstractFile, oldPath: string): Promise<void> {
    if (file instanceof TFile) {
      const cache = this.app.metadataCache.getFileCache(file);
      const granolaId = cache?.frontmatter?.granolaId;
      if (granolaId) {
        this.state.fileIndex.set(granolaId, file.path);
        await this.saveState();
      }
    }
  }
  
  async handleDelete(file: TAbstractFile): Promise<void> {
    if (file instanceof TFile) {
      // Find granolaId from our index
      for (const [id, path] of this.state.fileIndex.entries()) {
        if (path === file.path) {
          this.state.fileIndex.delete(id);
          this.state.deletedIds.add(id);
          await this.saveState();
          break;
        }
      }
    }
  }
  
  getFilePath(granolaId: string): string | undefined {
    return this.state.fileIndex.get(granolaId);
  }
  
  isDeleted(granolaId: string): boolean {
    return this.state.deletedIds.has(granolaId);
  }
}
```

#### E2E Test Environment Setup
```typescript
// tests/setup/test-environment.ts
import { Plugin, TFile, TFolder, Vault } from 'obsidian';

// Mock Obsidian API
global.app = createMockApp();
global.moment = require('moment');

function createMockApp() {
  const mockVault = {
    getMarkdownFiles: jest.fn(() => []),
    getAbstractFileByPath: jest.fn(),
    create: jest.fn(),
    modify: jest.fn(),
    delete: jest.fn(),
    rename: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    adapter: {
      exists: jest.fn(),
      mkdir: jest.fn(),
      rmdir: jest.fn(),
      read: jest.fn(),
      write: jest.fn(),
    }
  };
  
  const mockMetadataCache = {
    getFileCache: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
  };
  
  return {
    vault: mockVault,
    metadataCache: mockMetadataCache,
    workspace: createMockWorkspace(),
  };
}

// Test helper for plugin lifecycle
export class TestPlugin {
  plugin: GranolaSyncPlugin;
  mockApp: any;
  
  async setup() {
    this.mockApp = createMockApp();
    this.plugin = new GranolaSyncPlugin(this.mockApp, createMockManifest());
    await this.plugin.onload();
  }
  
  async teardown() {
    await this.plugin.onunload();
  }
  
  // Helper to create test vault structure
  async createTestVault(structure: VaultStructure) {
    for (const [path, content] of Object.entries(structure)) {
      const file = createMockFile(path, content);
      this.mockApp.vault.getMarkdownFiles.mockReturnValue(
        [...this.mockApp.vault.getMarkdownFiles(), file]
      );
    }
  }
}

// Example test using the environment
describe('Granola Sync E2E', () => {
  let testPlugin: TestPlugin;
  
  beforeEach(async () => {
    testPlugin = new TestPlugin();
    await testPlugin.setup();
  });
  
  afterEach(async () => {
    await testPlugin.teardown();
  });
  
  test('syncs meetings without duplicates', async () => {
    // Create test vault with existing meeting
    await testPlugin.createTestVault({
      'meetings/Team Standup.md': '---\ngranolaId: 123\n---\n# Team Standup'
    });
    
    // Mock API response
    mockGranolaAPI.getMeetings.mockResolvedValue([
      { id: '123', title: 'Team Standup', date: new Date() }
    ]);
    
    // Run sync
    await testPlugin.plugin.syncEngine.sync();
    
    // Verify no duplicate created
    expect(testPlugin.mockApp.vault.create).not.toHaveBeenCalled();
  });
});
```

#### Junior Developer Setup Script
```bash
#!/bin/bash
# scripts/setup-dev.sh

echo "🚀 Setting up Granola Sync development environment..."

# 1. Create directory structure
mkdir -p src/{services,ui,utils,types}
mkdir -p tests/{e2e,integration,unit,setup,fixtures}

# 2. Create skeleton files with TODOs
cat > src/services/sync-engine.ts << 'EOF'
import { SyncStateManager } from './sync-state-manager';
import { GranolaService } from './granola-service';
import { PathGenerator } from '../utils/path-generator';

export class SyncEngine {
  constructor(
    private stateManager: SyncStateManager,
    private granolaService: GranolaService,
    private pathGenerator: PathGenerator
  ) {}
  
  async sync(): Promise<SyncResult> {
    // TODO: Implement sync logic following the pattern in IMPLEMENTATION-PLAN.md
    // 1. Check sync lock
    // 2. Load state
    // 3. Fetch meetings since last sync
    // 4. Process in batches
    // 5. Update state
    throw new Error('Not implemented');
  }
}
EOF

# 3. Create test template
cat > tests/e2e/sync.test.ts << 'EOF'
import { TestPlugin } from '../setup/test-environment';

describe('Sync Engine E2E Tests', () => {
  let plugin: TestPlugin;
  
  beforeEach(async () => {
    plugin = new TestPlugin();
    await plugin.setup();
  });
  
  afterEach(async () => {
    await plugin.teardown();
  });
  
  test('TODO: Add your first test', async () => {
    // Arrange: Set up test data
    
    // Act: Run the operation
    
    // Assert: Verify the result
    expect(true).toBe(false); // This should fail - replace with real test!
  });
});
EOF

# 4. Install dependencies
npm install --save-dev jest @types/jest ts-jest @testing-library/jest-dom

# 5. Configure Jest
cat > jest.config.js << 'EOF'
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/setup/test-environment.ts'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};
EOF

# 6. Create sample test vault
mkdir -p test-vault/.obsidian/plugins/granola-sync
cp manifest.json test-vault/.obsidian/plugins/granola-sync/

echo "✅ Setup complete! Next steps:"
echo "1. Run 'npm test' to verify test setup"
echo "2. Run 'npm run dev' to start development"
echo "3. Check src/ folder for skeleton files with TODOs"
```

#### Input Validation Framework
```typescript
// src/utils/input-validator.ts
export class InputValidator {
  private static readonly MAX_PATH_LENGTH = 255;
  private static readonly MAX_TITLE_LENGTH = 200;
  private static readonly INVALID_PATH_CHARS = /[<>:"|?*]/g;
  private static readonly WINDOWS_RESERVED = /^(CON|PRN|AUX|NUL|COM[0-9]|LPT[0-9])$/i;
  
  static validateMeetingTitle(title: string): string {
    if (!title || title.trim().length === 0) {
      return 'Untitled Meeting';
    }
    
    // Remove invalid characters
    let safe = title.replace(this.INVALID_PATH_CHARS, '');
    
    // Handle leading dots (hidden files on Unix)
    if (safe.startsWith('.')) {
      safe = '_' + safe;
    }
    
    // Handle trailing dots/spaces (Windows)
    safe = safe.replace(/[\s.]+$/, '');
    
    // Check Windows reserved names
    if (this.WINDOWS_RESERVED.test(safe)) {
      safe = '_' + safe;
    }
    
    // Truncate if too long
    if (safe.length > this.MAX_TITLE_LENGTH) {
      safe = safe.substring(0, this.MAX_TITLE_LENGTH);
    }
    
    return safe || 'Untitled Meeting';
  }
  
  static validateFolderPath(path: string): string {
    // Prevent path traversal
    if (path.includes('..') || path.startsWith('/')) {
      throw new Error('Invalid folder path: contains ".." or absolute path');
    }
    
    // Split and validate each segment
    const segments = path.split('/').filter(Boolean);
    const validSegments = segments.map(segment => {
      // Apply same rules as meeting titles
      return this.validateMeetingTitle(segment);
    });
    
    return validSegments.join('/');
  }
  
  static validateMeetingData(data: any): Meeting {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid meeting data');
    }
    
    // Validate required fields
    if (!data.id || typeof data.id !== 'string') {
      throw new Error('Meeting missing required id field');
    }
    
    // Validate and sanitize title
    const title = this.validateMeetingTitle(data.title || 'Untitled');
    
    // Validate date
    const date = new Date(data.date);
    if (isNaN(date.getTime())) {
      throw new Error('Invalid meeting date');
    }
    
    // Validate transcript size (10MB limit)
    if (data.transcript && data.transcript.length > 10 * 1024 * 1024) {
      throw new Error('Meeting transcript exceeds 10MB limit');
    }
    
    return {
      id: data.id,
      title,
      date,
      transcript: data.transcript || '',
      granolaFolder: data.folder ? this.validateFolderPath(data.folder) : undefined,
      // ... other fields
    };
  }
}
```

### Phase 1: Foundation & Testing Framework

#### Deliverables
- Complete E2E test suite (failing tests)
- Full plugin structure (building on PoC)
- Development environment setup
- CI/CD pipeline

#### Technical Setup
```bash
# Project structure
obsidian-granola-sync/
├── src/
│   ├── main.ts                 # Plugin entry point
│   ├── services/
│   │   ├── granola-service.ts  # API client wrapper
│   │   ├── auth-service.ts     # Authentication handling
│   │   └── sync-engine.ts      # Core sync logic
│   ├── ui/
│   │   ├── settings-tab.ts     # Plugin settings
│   │   ├── sync-modal.ts       # Progress display
│   │   └── wizard-modal.ts     # First-run setup
│   ├── utils/
│   │   ├── file-manager.ts     # Vault file operations
│   │   ├── markdown-builder.ts # Meeting to markdown
│   │   ├── template-engine.ts  # Custom templates
│   │   └── path-generator.ts   # Dynamic path generation based on settings
│   └── types/
│       └── index.ts            # TypeScript definitions
├── tests/
│   ├── e2e/
│   │   ├── full-sync.test.ts   # Complete workflow
│   │   ├── auth-flow.test.ts   # Authentication
│   │   └── edge-cases.test.ts  # Special scenarios
│   ├── integration/
│   │   └── api-client.test.ts  # API communication
│   └── unit/
│       ├── markdown.test.ts    # Markdown generation
│       └── sync-logic.test.ts  # Sync algorithms
├── manifest.json
├── package.json
├── tsconfig.json
└── README.md
```

#### Core Type Definitions
```typescript
// src/types/index.ts

export interface Meeting {
  id: string;
  title: string;
  date: Date;
  transcript?: string;
  summary?: string;
  highlights?: string[];
  attendees?: string[];
  duration?: number; // in minutes
  granolaFolder?: string;
  tags?: string[];
  attachments?: Attachment[];
}

export interface Attachment {
  id: string;
  name: string;
  url: string;
  type: string; // MIME type
  size: number; // bytes
}

export interface SyncResult {
  success: boolean;
  created: number;
  updated: number;
  skipped: number;
  errors: SyncError[];
  duration: number; // milliseconds
}

export interface SyncError {
  meetingId: string;
  meetingTitle: string;
  error: string;
  timestamp: Date;
}

export interface SyncProgress {
  current: number;
  total: number;
  currentFile?: string;
  phase: 'fetching' | 'processing' | 'writing' | 'complete';
  startTime: Date;
  estimatedTimeRemaining?: number;
}

export type Result<T, E = Error> = 
  | { ok: true; value: T }
  | { ok: false; error: E };
```

#### E2E Tests to Write First
```typescript
// tests/e2e/full-sync.test.ts
describe('Granola Sync E2E', () => {
  test('first-time setup wizard', async () => {
    // User installs plugin
    // Opens settings
    // Completes setup wizard
    // Performs initial sync
  });

  test('sync 100 meetings successfully', async () => {
    // Mock 100 meetings from API
    // Run sync
    // Verify all files created correctly
    // Check performance < 10 seconds
  });

  test('handle network interruption gracefully', async () => {
    // Start sync
    // Interrupt network mid-sync
    // Verify partial progress saved
    // Resume sync successfully
  });

  test('prevent duplicate meetings', async () => {
    // Sync meetings
    // Run sync again
    // Verify no duplicates created
  });
  
  test('folder organization - flat structure', async () => {
    // Set folderOrganization to 'flat'
    // Sync meetings
    // Verify all files in target folder without subfolders
  });
  
  test('folder organization - by date daily', async () => {
    // Set folderOrganization to 'by-date' and dateFolderFormat to 'daily'
    // Sync meetings from different dates
    // Verify files organized in YYYY-MM-DD folders
  });
  
  test('folder organization - by date weekly', async () => {
    // Set folderOrganization to 'by-date' and dateFolderFormat to 'weekly'
    // Sync meetings from different weeks
    // Verify files organized in YYYY-W## folders
  });
  
  test('folder organization - mirror Granola', async () => {
    // Set folderOrganization to 'mirror-granola'
    // Sync meetings with Granola folder structure
    // Verify vault mirrors Granola's folder hierarchy
  });
  
  test('file naming - meeting name only', async () => {
    // Set fileNamingFormat to 'meeting-name'
    // Sync meetings
    // Verify files named with meeting title only
  });
  
  test('file naming - date + meeting name', async () => {
    // Set fileNamingFormat to 'date-meeting-name'
    // Sync meetings
    // Verify files named with date prefix
  });
});
```

### Phase 2: Core Sync Engine

#### Deliverables
- Working API client with granola-automation-client
- Idempotent sync logic
- Basic file creation/updates
- Authentication with pragmatic security

#### Authentication Implementation
```typescript
// Pragmatic approach: plaintext with safeguards
interface PluginSettings {
  apiKey: string;
  targetFolder: string;
  
  // File naming options
  fileNamingFormat: 'meeting-name' | 'date-meeting-name';
  dateFormat: string; // e.g., 'YYYY-MM-DD' for file names
  
  // Folder organization options
  folderOrganization: 'flat' | 'by-date' | 'mirror-granola';
  dateFolderFormat: 'daily' | 'weekly'; // only used when folderOrganization is 'by-date'
  weekFormat: string; // e.g., 'YYYY-[W]WW' for weekly folders
  
  lastSync: string;
  syncAutomatically: boolean;
}

class SettingsTab extends PluginSettingTab {
  display(): void {
    const {containerEl} = this;
    
    // Security notice
    containerEl.createEl('div', {
      text: '⚠️ Your API key is stored locally in your vault. ' +
            'Do not sync .obsidian folder if sharing your vault.',
      cls: 'setting-item-description mod-warning'
    });

    // API key field (masked)
    new Setting(containerEl)
      .setName('Granola API Key')
      .setDesc('Your API key from Granola settings')
      .addText(text => {
        text
          .setPlaceholder('Enter your API key')
          .setValue(this.plugin.settings.apiKey)
          .onChange(async (value) => {
            this.plugin.settings.apiKey = value;
            await this.plugin.saveSettings();
          });
        // Mask the input
        text.inputEl.type = 'password';
      })
      .addButton(button => {
        button
          .setButtonText('Test Connection')
          .onClick(async () => {
            const isValid = await this.plugin.testConnection();
            new Notice(isValid ? '✅ Connected!' : '❌ Connection failed');
          });
      });
    
    // Target folder
    new Setting(containerEl)
      .setName('Meeting notes folder')
      .setDesc('Where to store synced meeting notes')
      .addText(text => text
        .setPlaceholder('meetings')
        .setValue(this.plugin.settings.targetFolder)
        .onChange(async (value) => {
          this.plugin.settings.targetFolder = value;
          await this.plugin.saveSettings();
          this.updatePreview();
        }));
    
    // File naming format
    new Setting(containerEl)
      .setName('File naming format')
      .setDesc('How to name meeting note files')
      .addDropdown(dropdown => dropdown
        .addOption('meeting-name', 'Meeting name only')
        .addOption('date-meeting-name', 'Date + Meeting name')
        .setValue(this.plugin.settings.fileNamingFormat)
        .onChange(async (value) => {
          this.plugin.settings.fileNamingFormat = value as any;
          await this.plugin.saveSettings();
          this.updatePreview();
        }));
    
    // Folder organization
    new Setting(containerEl)
      .setName('Folder organization')
      .setDesc('How to organize meeting notes in subfolders')
      .addDropdown(dropdown => dropdown
        .addOption('flat', 'No subfolders (flat structure)')
        .addOption('by-date', 'Organize by date')
        .addOption('mirror-granola', 'Mirror Granola folder structure')
        .setValue(this.plugin.settings.folderOrganization)
        .onChange(async (value) => {
          this.plugin.settings.folderOrganization = value as any;
          await this.plugin.saveSettings();
          this.updatePreview();
          this.refreshDateFolderSettings();
        }));
    
    // Date folder format (only shown when organizing by date)
    if (this.plugin.settings.folderOrganization === 'by-date') {
      new Setting(containerEl)
        .setName('Date folder format')
        .setDesc('How to group meetings by date')
        .addDropdown(dropdown => dropdown
          .addOption('daily', 'Daily folders (YYYY-MM-DD)')
          .addOption('weekly', 'Weekly folders (YYYY-W##)')
          .setValue(this.plugin.settings.dateFolderFormat)
          .onChange(async (value) => {
            this.plugin.settings.dateFolderFormat = value as any;
            await this.plugin.saveSettings();
            this.updatePreview();
          }));
    }
    
    // Preview of file path structure
    containerEl.createEl('div', {
      cls: 'setting-item',
      text: 'Example file path: '
    }).createEl('code', {
      text: this.generateExamplePath(),
      cls: 'setting-item-description'
    });
  }
}
```

#### Sync Engine Core
```typescript
class SyncEngine {
  private syncLock = false;
  
  async sync(): Promise<SyncResult> {
    // Prevent concurrent syncs
    if (this.syncLock) {
      throw new Error('Sync already in progress');
    }
    
    this.syncLock = true;
    const progress = new SyncProgress();
    
    try {
      // Load previous sync state
      const state = await this.loadSyncState();
      
      // Fetch meetings since last sync
      const meetings = await this.fetchMeetingsSince(state.lastSync);
      
      // Process in batches for UI responsiveness
      for (const batch of this.batchMeetings(meetings, 20)) {
        await this.processBatch(batch, state, progress);
        
        // Yield to UI thread
        await sleep(0);
      }
      
      // Save updated state
      await this.saveSyncState(state);
      
      return progress.getResult();
      
    } finally {
      this.syncLock = false;
    }
  }
  
  private async processMeeting(meeting: Meeting, state: SyncState) {
    // Check if meeting was deleted by user
    if (this.stateManager.isDeleted(meeting.id)) {
      // Skip recreation of deleted meetings
      return;
    }
    
    // Generate unique file path using path generator
    const pathGenerator = new PathGenerator(this.settings);
    const filePath = await pathGenerator.generatePath(meeting);
    
    // Use state manager to find existing file efficiently
    const existingPath = this.stateManager.getFilePath(meeting.id);
    const existingFile = existingPath 
      ? await this.vault.getAbstractFileByPath(existingPath) as TFile
      : null;
    
    if (existingFile) {
      // Update only if changed
      if (this.hasChanges(meeting, existingFile)) {
        await this.updateMeetingFile(existingFile, meeting);
      }
    } else {
      // Create new file with frontmatter
      await this.createMeetingFile(filePath, meeting);
      // Update state manager with new file
      this.stateManager.addFile(meeting.id, filePath);
    }
  }
  
  // Optimized file finding using metadata cache
  private async findFileByGranolaId(id: string): Promise<TFile | null> {
    // First check state manager cache
    const cachedPath = this.stateManager.getFilePath(id);
    if (cachedPath) {
      const file = this.app.vault.getAbstractFileByPath(cachedPath);
      if (file instanceof TFile) {
        return file;
      }
    }
    
    // Fallback to metadata cache search (O(n) but using cached data)
    const files = this.app.vault.getMarkdownFiles();
    for (const file of files) {
      const cache = this.app.metadataCache.getFileCache(file);
      if (cache?.frontmatter?.granolaId === id) {
        // Update state manager cache
        this.stateManager.addFile(id, file.path);
        return file;
      }
    }
    
    return null;
  }
}

#### Path Generation Logic
```typescript
class PathGenerator {
  constructor(private settings: PluginSettings) {}
  
  async generatePath(meeting: Meeting): Promise<string> {
    let path = this.settings.targetFolder;
    
    // Add subfolder based on organization setting
    switch (this.settings.folderOrganization) {
      case 'by-date':
        const dateFolder = this.getDateFolder(meeting.date);
        path = `${path}/${dateFolder}`;
        break;
        
      case 'mirror-granola':
        if (meeting.granolaFolder) {
          // Use InputValidator to sanitize folder path
          const sanitizedFolder = InputValidator.validateFolderPath(meeting.granolaFolder);
          path = `${path}/${sanitizedFolder}`;
        }
        break;
        
      case 'flat':
      default:
        // No subfolders
        break;
    }
    
    // Generate filename based on naming format
    let filename: string;
    switch (this.settings.fileNamingFormat) {
      case 'date-meeting-name':
        const dateStr = format(meeting.date, this.settings.dateFormat || 'yyyy-MM-dd');
        const sanitizedTitle = InputValidator.validateMeetingTitle(meeting.title);
        filename = `${dateStr} ${sanitizedTitle}`;
        break;
        
      case 'meeting-name':
      default:
        filename = InputValidator.validateMeetingTitle(meeting.title);
        break;
    }
    
    // Ensure the full path doesn't exceed OS limits
    const fullPath = `${path}/${filename}.md`;
    if (fullPath.length > 255) {
      // Truncate filename to fit
      const availableLength = 255 - path.length - 4; // -4 for ".md" and "/"
      filename = filename.substring(0, Math.max(availableLength, 20));
    }
    
    return `${path}/${filename}.md`;
  }
  
  private getDateFolder(date: Date): string {
    switch (this.settings.dateFolderFormat) {
      case 'weekly':
        // Format: YYYY-W## (e.g., 2024-W12)
        const weekNum = format(date, 'ww');
        const year = format(date, 'yyyy');
        return this.settings.weekFormat
          ? format(date, this.settings.weekFormat)
          : `${year}-W${weekNum}`;
          
      case 'daily':
      default:
        // Format: YYYY-MM-DD
        return format(date, 'yyyy-MM-dd');
    }
  }
}
```

### Phase 3: Performance & Error Handling

#### Deliverables
- Retry logic with exponential backoff
- Streaming for large data sets
- Comprehensive error handling
- Performance optimizations

#### Error Handling Matrix
```typescript
class ErrorHandler {
  private retryCount = new Map<string, number>();
  private syncCancelled = false;
  
  async handle(error: Error, context: string): Promise<boolean> {
    // Check if sync was cancelled
    if (this.syncCancelled) {
      return false; // Don't retry
    }
    
    if (error.message.includes('401')) {
      new Notice('Authentication failed. Please check your API key.');
      this.plugin.openSettings();
      return false;
    } else if (error.message.includes('429')) {
      const retries = this.retryCount.get(context) || 0;
      if (retries < 3) {
        const delay = Math.pow(2, retries) * 1000; // Exponential backoff
        new Notice(`Rate limited. Retrying in ${delay/1000} seconds...`);
        await sleep(delay);
        this.retryCount.set(context, retries + 1);
        return true; // Retry
      }
      new Notice('Rate limit exceeded. Please try again later.');
      return false;
    } else if (error.message.includes('Network')) {
      new Notice('Connection failed. Check your internet and retry.');
      return false;
    } else if (error.message.includes('ENOSPC')) {
      new Notice('Disk full! Cannot save meetings.');
      return false;
    } else if (error.message.includes('EACCES')) {
      new Notice('Permission denied. Check vault folder permissions.');
      return false;
    } else {
      // Log for debugging
      console.error(`Granola Sync Error in ${context}:`, error);
      new Notice('Sync failed. See console for details.');
      return false;
    }
  }
  
  cancelSync() {
    this.syncCancelled = true;
  }
}

// Add cancellation support to sync engine
class SyncEngine {
  private abortController: AbortController | null = null;
  
  async sync(): Promise<SyncResult> {
    this.abortController = new AbortController();
    
    try {
      // Pass abort signal to all async operations
      const meetings = await this.fetchMeetings({
        signal: this.abortController.signal
      });
      
      // Check for cancellation between operations
      if (this.abortController.signal.aborted) {
        throw new Error('Sync cancelled by user');
      }
      
      // ... rest of sync logic
    } finally {
      this.abortController = null;
    }
  }
  
  cancelSync() {
    if (this.abortController) {
      this.abortController.abort();
    }
  }
}
```

#### Performance Optimizations
```typescript
class PerformantSync {
  // Stream large responses
  async *streamMeetings(since: Date): AsyncGenerator<Meeting> {
    let page = 1;
    let hasMore = true;
    
    while (hasMore) {
      const response = await this.fetchPage(page, since);
      
      for (const meeting of response.meetings) {
        yield meeting;
      }
      
      hasMore = response.hasNextPage;
      page++;
    }
  }
  
  // Batch file operations
  async batchCreateFiles(meetings: Meeting[]) {
    const operations = meetings.map(m => 
      this.createFile(m).catch(e => ({ error: e, meeting: m }))
    );
    
    const results = await Promise.allSettled(operations);
    
    // Handle failures gracefully
    const failures = results.filter(r => r.status === 'rejected');
    if (failures.length > 0) {
      // Log but continue
    }
  }
}
```

### Phase 4: UI/UX Polish

#### Deliverables
- First-run setup wizard
- Sync progress display
- Status bar integration
- Settings improvements

#### Setup Wizard
```typescript
class SetupWizard extends Modal {
  private step = 0;
  private settings: Partial<PluginSettings> = {};
  
  async show() {
    this.open();
    await this.showStep(0);
  }
  
  private async showStep(step: number) {
    const {contentEl} = this;
    contentEl.empty();
    
    switch(step) {
      case 0: // Welcome
        contentEl.createEl('h2', {text: 'Welcome to Granola Sync'});
        contentEl.createEl('p', {text: 'This wizard will help you connect your Granola account.'});
        break;
        
      case 1: // API Key
        contentEl.createEl('h2', {text: 'Connect to Granola'});
        const keyInput = new TextComponent(contentEl);
        keyInput.inputEl.type = 'password';
        keyInput.setPlaceholder('Enter your API key');
        
        contentEl.createEl('p', {
          text: 'Find your API key in Granola settings.',
          cls: 'setting-item-description'
        });
        break;
        
      case 2: // Folder selection
        contentEl.createEl('h2', {text: 'Choose destination folder'});
        // Folder picker
        break;
        
      case 3: // Preview
        contentEl.createEl('h2', {text: 'Ready to sync!'});
        const preview = await this.generatePreview();
        contentEl.createEl('pre', {text: preview});
        break;
    }
    
    // Navigation buttons
    this.addNavigationButtons();
  }
}

#### Sync Progress Modal
```typescript
class SyncProgressModal extends Modal {
  private progressBarEl: HTMLElement;
  private statusEl: HTMLElement;
  private detailsEl: HTMLElement;
  private cancelButton: ButtonComponent;
  private backgroundButton: ButtonComponent;
  private isBackgrounded = false;
  
  constructor(
    app: App, 
    private syncEngine: SyncEngine,
    private onCancel: () => void
  ) {
    super(app);
  }
  
  onOpen() {
    const {contentEl} = this;
    contentEl.empty();
    
    contentEl.createEl('h2', {text: 'Syncing Meetings'});
    
    // Progress bar
    const progressContainer = contentEl.createEl('div', {
      cls: 'sync-progress-container'
    });
    this.progressBarEl = progressContainer.createEl('div', {
      cls: 'sync-progress-bar'
    });
    
    // Status text
    this.statusEl = contentEl.createEl('div', {
      cls: 'sync-status',
      text: 'Initializing...'
    });
    
    // Details (collapsible)
    const detailsContainer = contentEl.createEl('details');
    detailsContainer.createEl('summary', {text: 'Details'});
    this.detailsEl = detailsContainer.createEl('div', {
      cls: 'sync-details'
    });
    
    // Action buttons
    const buttonContainer = contentEl.createEl('div', {
      cls: 'sync-buttons'
    });
    
    this.cancelButton = new ButtonComponent(buttonContainer)
      .setButtonText('Cancel')
      .setWarning()
      .onClick(() => {
        this.onCancel();
        this.close();
      });
      
    this.backgroundButton = new ButtonComponent(buttonContainer)
      .setButtonText('Run in Background')
      .onClick(() => {
        this.isBackgrounded = true;
        this.close();
        new Notice('Sync continuing in background...');
      });
  }
  
  updateProgress(progress: SyncProgress) {
    if (this.isBackgrounded) {
      // Show brief notice instead of updating modal
      if (progress.current % 10 === 0) {
        new Notice(`Syncing: ${progress.current}/${progress.total} meetings`);
      }
      return;
    }
    
    const percentage = (progress.current / progress.total) * 100;
    this.progressBarEl.style.width = `${percentage}%`;
    
    this.statusEl.setText(
      `Syncing meeting ${progress.current} of ${progress.total}`
    );
    
    if (progress.currentFile) {
      this.detailsEl.setText(`Processing: ${progress.currentFile}`);
    }
    
    // Disable cancel if almost done
    if (percentage > 95) {
      this.cancelButton.setDisabled(true);
    }
  }
  
  showError(error: string) {
    this.statusEl.setText(`Error: ${error}`);
    this.statusEl.addClass('sync-error');
    this.cancelButton.setButtonText('Close');
    this.backgroundButton.setDisabled(true);
  }
  
  showComplete(result: SyncResult) {
    this.statusEl.setText(
      `Sync complete! ${result.created} created, ${result.updated} updated.`
    );
    this.statusEl.addClass('sync-success');
    this.cancelButton.setButtonText('Close');
    this.backgroundButton.setDisabled(true);
    
    if (result.errors.length > 0) {
      this.detailsEl.setText(
        `Completed with ${result.errors.length} errors. Check console for details.`
      );
    }
  }
}
```

### Phase 5: Testing & Edge Cases

#### Critical Test Scenarios
1. **Special Characters in Titles**
   - Emojis: "Team Standup 🚀"
   - Path separators: "Q1/Q2 Review"
   - Reserved chars: "Meeting: Project *Important*"

2. **Large Data Sets**
   - Meeting with 2000+ highlights
   - 10,000 meetings in vault
   - 100MB transcript

3. **Concurrent Operations**
   - User edits while syncing
   - Multiple sync triggers
   - Plugin reload mid-sync

4. **Time Zone Handling**
   - Meetings across date boundaries
   - DST transitions
   - UTC vs local time

5. **Folder Organization Edge Cases**
   - Deep Granola folder nesting (>10 levels)
   - Folder names with special characters
   - Changing organization method mid-sync
   - Missing Granola folder metadata
   - Conflicting folder names after sanitization

#### Edge Case Handlers
```typescript
// File name sanitization is now handled by InputValidator
// Additional edge case handlers:

class ConflictResolver {
  async resolve(existingPath: string, meeting: Meeting): Promise<string> {
    // Try with date suffix
    const date = format(meeting.date, 'yyyy-MM-dd');
    let attempt = `${existingPath} ${date}`;
    
    // If still exists, add counter
    let counter = 1;
    while (await this.vault.adapter.exists(attempt + '.md')) {
      attempt = `${existingPath} ${date} (${counter})`;
      counter++;
    }
    
    return attempt + '.md';
  }
}

// Handle settings changes and migrations
class SettingsMigrationHandler {
  async handleOrganizationChange(
    oldSettings: PluginSettings, 
    newSettings: PluginSettings
  ): Promise<void> {
    // Only handle if organization method changed
    if (oldSettings.folderOrganization === newSettings.folderOrganization &&
        oldSettings.fileNamingFormat === newSettings.fileNamingFormat) {
      return;
    }
    
    const modal = new Modal(this.app);
    modal.titleEl.setText('Folder Organization Changed');
    modal.contentEl.setText(
      'Your folder organization settings have changed. Would you like to:' +
      '\n\n1. Keep existing files where they are (recommended)' +
      '\n2. Reorganize all files to match new settings' +
      '\n\nWarning: Reorganizing may break external links to your notes.'
    );
    
    modal.contentEl.createEl('button', { text: 'Keep Existing' })
      .addEventListener('click', () => {
        modal.close();
        // Just update settings, don't move files
      });
      
    modal.contentEl.createEl('button', { text: 'Reorganize All' })
      .addEventListener('click', async () => {
        modal.close();
        await this.reorganizeAllFiles(oldSettings, newSettings);
      });
      
    modal.open();
  }
  
  private async reorganizeAllFiles(
    oldSettings: PluginSettings,
    newSettings: PluginSettings
  ): Promise<void> {
    const progress = new Notice('Reorganizing files...', 0);
    const stateManager = this.plugin.stateManager;
    const pathGenerator = new PathGenerator(newSettings);
    
    try {
      const files = this.app.vault.getMarkdownFiles();
      let processed = 0;
      
      for (const file of files) {
        const cache = this.app.metadataCache.getFileCache(file);
        const granolaId = cache?.frontmatter?.granolaId;
        
        if (granolaId) {
          // Generate new path
          const meeting = await this.reconstructMeetingFromFile(file);
          const newPath = await pathGenerator.generatePath(meeting);
          
          if (newPath !== file.path) {
            // Create folders if needed
            const dir = newPath.substring(0, newPath.lastIndexOf('/'));
            if (dir && !await this.app.vault.adapter.exists(dir)) {
              await this.app.vault.createFolder(dir);
            }
            
            // Move file
            await this.app.vault.rename(file, newPath);
            
            // Update state manager
            stateManager.updatePath(granolaId, newPath);
          }
        }
        
        processed++;
        progress.setMessage(`Reorganizing files... ${processed}/${files.length}`);
      }
      
      progress.setMessage('Reorganization complete!');
      setTimeout(() => progress.hide(), 2000);
      
    } catch (error) {
      progress.hide();
      new Notice('Error reorganizing files. Some files may not have been moved.');
      console.error('Reorganization error:', error);
    }
  }
}
```

### Phase 6: Documentation & Release

#### Documentation Requirements
1. **README.md**
   - Clear installation instructions
   - Security considerations
   - Troubleshooting guide
   - FAQ

2. **Video Tutorial**
   - 3-minute setup walkthrough
   - Common workflows
   - Tips and tricks

3. **Migration Guide**
   - For future versions
   - Data format changes
   - Setting migrations

#### Community Plugin Submission
```json
// manifest.json
{
  "id": "granola-sync",
  "name": "Granola Sync",
  "version": "1.0.0",
  "minAppVersion": "0.15.0",
  "description": "Sync your Granola meetings to Obsidian",
  "author": "Your Name",
  "authorUrl": "https://yoursite.com",
  "isDesktopOnly": true
}
```

## Risk Mitigation Strategies

### Security Considerations
1. **API Key Storage**
   - Stored in `.obsidian/plugins/granola-sync/data.json`
   - Masked in UI with password input
   - Clear warning about vault syncing
   - Documentation includes `.gitignore` template

2. **Network Security**
   - HTTPS only
   - Certificate validation
   - No request/response logging
   - Timeout on all requests

### Data Integrity
1. **Backup Recommendation**
   - Prompt user to backup vault before first sync
   - Document recovery procedures
   - Keep sync state for rollback

2. **Conflict Prevention**
   - Never overwrite user edits
   - Use frontmatter IDs for tracking
   - Clear conflict resolution UI

### Performance Safeguards
1. **Resource Limits**
   - Max 100 files per batch
   - 30-second request timeout
   - Memory monitoring for large meetings
   - Progress cancellation

2. **Graceful Degradation**
   - Partial sync on failure
   - Skip corrupted meetings
   - Continue on individual errors

## Success Metrics

### Technical Goals
- ✅ All E2E tests passing
- ✅ <5% sync failure rate
- ✅ <10 second sync for 100 meetings
- ✅ Zero data loss incidents

### User Experience Goals
- ✅ <3 clicks to complete setup
- ✅ Clear error messages
- ✅ Progress visibility
- ✅ 4.5+ star rating

### Code Quality Goals
- ✅ 80% test coverage
- ✅ TypeScript strict mode
- ✅ ESLint compliance
- ✅ Documented public APIs

## Development Guidelines

### Coding Standards
```typescript
// Always use explicit types
interface Meeting {
  id: string;
  title: string;
  date: Date;
  // ...
}

// Prefer composition
class SyncEngine {
  constructor(
    private api: GranolaAPI,
    private vault: VaultManager,
    private settings: SettingsManager
  ) {}
}

// Handle errors explicitly
async function riskyOperation(): Promise<Result<Data, Error>> {
  try {
    const data = await fetch();
    return { ok: true, value: data };
  } catch (error) {
    return { ok: false, error };
  }
}
```

### Testing Philosophy
1. **Test Behavior, Not Implementation**
   - Focus on user outcomes
   - Allow refactoring
   - Mock external dependencies

2. **Test Pyramid**
   - Many unit tests (fast)
   - Some integration tests (realistic)
   - Few E2E tests (confidence)

3. **Test Data**
   - Use realistic fixtures
   - Cover edge cases
   - Include error scenarios

## Next Steps for Developer

### Immediate Actions
1. Run `/init` to set up project
2. Install dependencies: `npm install`
3. Write first failing E2E test
4. Set up GitHub repository
5. Configure CI/CD (GitHub Actions)

### Phase 1 Checklist
- [ ] Project structure created
- [ ] TypeScript configured
- [ ] Jest/Vitest set up
- [ ] First E2E test written
- [ ] CI pipeline running
- [ ] README started

### Resources
- [Obsidian Plugin API](https://github.com/obsidianmd/obsidian-api)
- [granola-automation-client](https://www.npmjs.com/package/granola-automation-client)
- [Plugin Development Guide](https://marcus.se.net/obsidian-plugin-docs/)

### Phase 7: Test Infrastructure Stabilization 🚀 (NEXT)

#### Objective
Establish CI/CD pipeline and fix all failing tests to achieve 90%+ pass rate

#### Duration: 3-5 days

#### Deliverables
1. **CI/CD Pipeline (Day 1)**
   - GitHub Actions for multi-OS testing
   - Automated test runs on every PR
   - Code coverage enforcement (85%+)
   - Type checking and linting gates

2. **Test Environment Fixes (Days 2-3)**
   - Centralized test configuration
   - Fixed timezone handling (UTC everywhere)
   - Deterministic mock factory
   - Proper async/await patterns

3. **Complete All Tests (Days 4-5)**
   - Fix 57 failing tests
   - Implement 3 TODO tests
   - Remove all placeholder assertions
   - Achieve 90%+ pass rate

#### Implementation Details

**1. GitHub Actions Workflow**
```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test -- --coverage
      - run: npm run build
```

**2. Test Environment Setup**
```typescript
// tests/setup/test-environment.ts
process.env.TZ = 'UTC';
jest.useFakeTimers();
jest.setSystemTime(new Date('2024-03-20T10:00:00Z'));

// Centralized mock factory
export const createMockEnvironment = () => ({
  vault: createMockVault(),
  api: createMockGranolaAPI(),
  settings: createDefaultSettings(),
  // ... consistent mocks
});
```

**3. Priority Test Fixes**
- Timezone issues (affects 15+ tests)
- Async race conditions (affects 20+ tests)
- Mock initialization (affects 10+ tests)
- TODO test implementation (3 tests)

### Phase 8: Data Integrity & Conflict Resolution

#### Objective
Implement robust conflict handling and data integrity measures

#### Duration: 2-3 days

#### Deliverables
1. **Conflict Resolution Engine**
   - Idempotent sync algorithm
   - Three-way merge for conflicts
   - User choice preservation
   - Backup before destructive ops

2. **Data Validation**
   - Checksum verification
   - Schema versioning
   - Migration support
   - Rollback capability

3. **State Management Hardening**
   - Transaction-like operations
   - State corruption recovery
   - Orphaned data cleanup
   - Memory-efficient storage

### Phase 9: Observability & Performance

#### Objective
Add production-grade monitoring and performance optimization

#### Duration: 3-4 days

#### Deliverables
1. **Structured Logging**
   - Winston/Pino integration
   - Log levels and filtering
   - Correlation IDs
   - Debug mode toggle

2. **Performance Optimization**
   - Implement p-queue for batching
   - Memory usage monitoring
   - Large vault benchmarks (10k+ files)
   - Throttling for file operations

3. **Error Tracking**
   - Circuit breaker pattern
   - Retry with exponential backoff
   - User-friendly error messages
   - Self-diagnostic tools

### Phase 10: Core Engine Hardening

#### Objective
Ensure rock-solid reliability of sync engine

#### Duration: 3-4 days

#### Deliverables
1. **Sync Engine Robustness**
   - AbortController for cancellation
   - Progress persistence
   - State machine implementation
   - Network resilience

2. **API Integration**
   - Contract testing
   - Rate limit visual feedback
   - Offline mode handling
   - Request queuing

3. **Large Dataset Support**
   - Streaming for large meetings
   - Adaptive batch sizing
   - Memory pressure handling
   - Progress accuracy

### Phase 11: User Experience Polish

#### Objective
Create delightful, intuitive user experience

#### Duration: 2-3 days

#### Deliverables
1. **Setup Experience**
   - Interactive wizard improvements
   - Connection validation UI
   - Permission explanations
   - Sample vault creation

2. **Sync Experience**
   - Real-time progress with ETA
   - Detailed sync reports
   - Pause/resume capability
   - Status bar integration

3. **Error Recovery**
   - Guided troubleshooting
   - Settings export/import
   - Reset capabilities
   - Support info collection

### Phase 12: Documentation & Release Preparation

#### Objective
Prepare for production release and community submission

#### Duration: 2-3 days

#### Deliverables
1. **Documentation Suite**
   - Comprehensive README
   - API documentation
   - Troubleshooting guide
   - Video tutorials

2. **Release Automation**
   - Semantic versioning
   - Changelog generation
   - One-click publish
   - Beta testing process

3. **Community Readiness**
   - Plugin submission prep
   - Support templates
   - Feature request process
   - Security disclosure policy

## Updated Timeline

### Week 1: Foundation (Phases 7-8)
- **Days 1-5**: CI/CD setup and test fixes
- **Days 6-7**: Data integrity implementation

### Week 2: Reliability (Phases 9-10)
- **Days 8-11**: Observability and performance
- **Days 12-14**: Core engine hardening

### Week 3: Polish & Release (Phases 11-12)
- **Days 15-17**: UX improvements
- **Days 18-21**: Documentation and release

## Success Metrics by Phase

- **Phase 7**: 90%+ test pass rate, CI/CD operational
- **Phase 8**: Zero data loss, conflict resolution working
- **Phase 9**: <100ms UI response, structured logs
- **Phase 10**: 99.9% sync reliability, graceful failures
- **Phase 11**: <3 clicks to setup, intuitive UI
- **Phase 12**: Complete docs, beta feedback positive

## Risk Mitigation

1. **Test Instability**: Fixed environment will resolve
2. **API Changes**: Contract tests provide protection
3. **Large Vaults**: Streaming prevents memory issues
4. **User Confusion**: Clear docs and error messages

## Security Note
As agreed, API keys will be stored unencrypted in Obsidian's standard plugin data location. Clear documentation will advise users about vault syncing considerations.

## Deletion and Sync Policies

### Meeting Deletion Handling
The plugin follows these policies for deletions:

1. **Meetings deleted in Obsidian**: 
   - Are tracked in the state manager's `deletedIds` set
   - Will NOT be recreated on next sync
   - User has full control over their vault

2. **Meetings deleted in Granola**:
   - Are NOT automatically deleted from Obsidian
   - Rationale: Obsidian is the user's knowledge base; they may want to keep historical records
   - Future enhancement: Add optional "sync deletions" setting with clear warnings

3. **Conflicting edits**:
   - If a meeting is edited in both places, Granola version takes precedence
   - Local changes are preserved in a conflict file with timestamp suffix

### Default Settings for New Users
```typescript
const DEFAULT_SETTINGS: PluginSettings = {
  apiKey: '',
  targetFolder: 'Meetings',
  fileNamingFormat: 'date-meeting-name',
  dateFormat: 'yyyy-MM-dd',
  folderOrganization: 'flat',  // Simple by default
  dateFolderFormat: 'daily',
  weekFormat: 'yyyy-[W]ww',
  lastSync: '',
  syncAutomatically: false  // Manual sync for safety
};
```

## Questions to Clarify

Before starting implementation:
1. What templating system should we support? (Handlebars, custom, both?)
2. Should we support multiple Granola accounts?
3. What metadata should we include in frontmatter?
4. How should we handle meeting attachments/files?

---

This plan provides a pragmatic, test-driven approach to building a reliable Granola sync plugin while maintaining security awareness and focusing on user experience.