#!/bin/bash
# Junior Developer Setup Script for Granola Sync Plugin

echo "🚀 Setting up Granola Sync development environment..."

# Create skeleton files with TODOs
echo "📁 Creating skeleton service files..."

# Sync Engine skeleton
cat > src/services/sync-engine.ts << 'EOF'
import { SyncStateManager } from './sync-state-manager';
import { GranolaService } from './granola-service';
import { PathGenerator } from '../utils/path-generator';
import { SyncResult, SyncProgress, Meeting } from '../types';

export class SyncEngine {
  constructor(
    private stateManager: SyncStateManager,
    private granolaService: GranolaService,
    private pathGenerator: PathGenerator
  ) {}
  
  async sync(): Promise<SyncResult> {
    // TODO: Implement sync logic following the pattern in IMPLEMENTATION-PLAN.md
    // 1. Check sync lock to prevent concurrent syncs
    // 2. Load state from stateManager
    // 3. Fetch meetings since last sync using granolaService
    // 4. Process meetings in batches
    // 5. Update state after each batch
    // 6. Return sync result with statistics
    throw new Error('Not implemented - see TODOs above');
  }
  
  private async processBatch(meetings: Meeting[], progress: SyncProgress): Promise<void> {
    // TODO: Process a batch of meetings
    // 1. For each meeting, check if it needs to be created or updated
    // 2. Use stateManager to check if file exists or was deleted
    // 3. Use pathGenerator to determine file path
    // 4. Create or update the file
    // 5. Update progress
    throw new Error('Not implemented');
  }
}
EOF

# Granola Service skeleton
cat > src/services/granola-service.ts << 'EOF'
import { Meeting } from '../types';
import { InputValidator } from '../utils/input-validator';

export class GranolaService {
  constructor(private apiKey: string) {}
  
  async testConnection(): Promise<boolean> {
    // TODO: Implement API connection test
    // 1. Make a simple API call to verify the key works
    // 2. Return true if successful, false otherwise
    // 3. Handle errors gracefully
    throw new Error('Not implemented');
  }
  
  async getMeetingsSince(date: string): Promise<Meeting[]> {
    // TODO: Fetch meetings from Granola API
    // 1. Make API call with date parameter
    // 2. Validate response data using InputValidator
    // 3. Transform to Meeting objects
    // 4. Handle pagination if needed
    throw new Error('Not implemented');
  }
  
  async getAllMeetings(): Promise<Meeting[]> {
    // TODO: Fetch all meetings (for initial sync)
    // 1. Handle pagination
    // 2. Validate each meeting
    // 3. Return array of validated meetings
    throw new Error('Not implemented');
  }
}
EOF

# Path Generator skeleton
cat > src/utils/path-generator.ts << 'EOF'
import { Meeting, PluginSettings } from '../types';
import { InputValidator } from './input-validator';
import { format } from 'date-fns';

export class PathGenerator {
  constructor(private settings: PluginSettings) {}
  
  async generatePath(meeting: Meeting): Promise<string> {
    // TODO: Generate file path based on settings
    // 1. Start with target folder from settings
    // 2. Add subfolder based on folderOrganization setting
    //    - 'flat': no subfolders
    //    - 'by-date': organize by date (daily/weekly)
    //    - 'mirror-granola': use meeting.granolaFolder
    // 3. Generate filename based on fileNamingFormat
    //    - 'meeting-name': just the title
    //    - 'date-meeting-name': date prefix + title
    // 4. Validate and sanitize the path
    // 5. Ensure total path length is within OS limits
    throw new Error('Not implemented - see TODOs above');
  }
  
  private getDateFolder(date: Date): string {
    // TODO: Generate date-based folder name
    // 1. Check dateFolderFormat setting (daily/weekly)
    // 2. Format date accordingly
    // 3. Return folder name
    throw new Error('Not implemented');
  }
}
EOF

# Markdown Builder skeleton
cat > src/utils/markdown-builder.ts << 'EOF'
import { Meeting } from '../types';

export class MarkdownBuilder {
  static buildMeetingNote(meeting: Meeting): string {
    // TODO: Convert meeting data to markdown
    // 1. Create frontmatter with granolaId and metadata
    // 2. Add meeting title as H1
    // 3. Add meeting metadata (date, duration, attendees)
    // 4. Add summary section if available
    // 5. Add highlights section if available
    // 6. Add transcript section if available
    // 7. Add tags if available
    // Example structure:
    /*
    ---
    granolaId: "12345"
    date: 2024-03-20
    tags: [meeting, project-x]
    ---
    
    # Meeting Title
    
    **Date:** March 20, 2024
    **Duration:** 60 minutes
    **Attendees:** John, Jane
    
    ## Summary
    ...
    
    ## Key Highlights
    - Point 1
    - Point 2
    
    ## Transcript
    ...
    */
    throw new Error('Not implemented - see example structure above');
  }
}
EOF

echo "📁 Creating test file templates..."

# E2E test template
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
  
  test('TODO: syncs new meetings without creating duplicates', async () => {
    // Arrange: Set up test data
    // - Create existing meeting in vault
    // - Mock API to return same meeting
    
    // Act: Run the sync operation
    
    // Assert: Verify no duplicate was created
    expect(true).toBe(false); // This should fail - replace with real test!
  });
  
  test('TODO: handles API connection errors gracefully', async () => {
    // Arrange: Mock API to return error
    
    // Act: Attempt sync
    
    // Assert: Verify error is handled and user is notified
    expect(true).toBe(false); // Replace with real test
  });
  
  test('TODO: respects user file deletions', async () => {
    // Arrange: Create meeting, then delete it
    
    // Act: Run sync with same meeting from API
    
    // Assert: Verify meeting is not recreated
    expect(true).toBe(false); // Replace with real test
  });
});
EOF

# Unit test template
cat > tests/unit/input-validator.test.ts << 'EOF'
import { InputValidator } from '../../src/utils/input-validator';

describe('InputValidator', () => {
  describe('validateMeetingTitle', () => {
    test('TODO: handles normal titles', () => {
      const result = InputValidator.validateMeetingTitle('Team Standup');
      expect(result).toBe('Team Standup');
    });
    
    test('TODO: removes invalid path characters', () => {
      // Test with <, >, :, ", |, ?, *
      expect(true).toBe(false); // Replace with real test
    });
    
    test('TODO: handles Windows reserved names', () => {
      // Test with CON, PRN, AUX, etc.
      expect(true).toBe(false); // Replace with real test
    });
    
    test('TODO: handles empty or whitespace titles', () => {
      // Should return 'Untitled Meeting'
      expect(true).toBe(false); // Replace with real test
    });
  });
});
EOF

echo "📦 Installing test dependencies..."
npm install --save-dev jest @types/jest ts-jest @testing-library/jest-dom

echo "⚙️ Configuring Jest..."
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

echo "📝 Updating package.json scripts..."
# Update package.json to include test script
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.scripts.test = 'jest';
pkg.scripts['test:watch'] = 'jest --watch';
pkg.scripts['test:coverage'] = 'jest --coverage';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
"

echo "📁 Creating sample test vault..."
mkdir -p test-vault/.obsidian/plugins/granola-sync
cp manifest.json test-vault/.obsidian/plugins/granola-sync/

echo "📝 Creating development checklist..."
cat > DEVELOPMENT.md << 'EOF'
# Granola Sync Plugin Development Guide

## Quick Start
1. Run `npm install` to install dependencies
2. Run `npm run dev` to start development mode
3. Run `npm test` to run tests
4. Copy built files to your Obsidian vault's plugin directory

## Development Workflow
1. Write tests first (TDD)
2. Implement features to make tests pass
3. Run `npm test` to verify
4. Test manually in Obsidian

## Current TODOs
- [ ] Implement GranolaService API client
- [ ] Implement SyncEngine core logic
- [ ] Implement PathGenerator for file organization
- [ ] Implement MarkdownBuilder for note generation
- [ ] Add Settings UI tab
- [ ] Add sync progress modal
- [ ] Write comprehensive E2E tests
- [ ] Add error handling throughout

## File Structure
- `src/` - Source code
  - `services/` - Core business logic
  - `ui/` - Obsidian UI components
  - `utils/` - Helper utilities
  - `types/` - TypeScript type definitions
- `tests/` - Test files
  - `e2e/` - End-to-end tests
  - `unit/` - Unit tests
  - `setup/` - Test configuration

## Testing
- Run all tests: `npm test`
- Run with coverage: `npm test:coverage`
- Run in watch mode: `npm test:watch`

## Building
- Development build: `npm run dev`
- Production build: `npm run build`

## Tips
1. Check the skeleton files for detailed TODOs
2. Follow the patterns in IMPLEMENTATION-PLAN.md
3. Use InputValidator for all external data
4. Test edge cases thoroughly
5. Keep security in mind (API keys, user data)
EOF

echo "✅ Setup complete! Next steps:"
echo "1. Run 'npm test' to see failing tests"
echo "2. Check src/ folder for skeleton files with TODOs"
echo "3. Read DEVELOPMENT.md for workflow guide"
echo "4. Start implementing features to make tests pass!"