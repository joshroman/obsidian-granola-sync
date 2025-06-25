# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an Obsidian plugin that syncs meeting data from Granola (a meeting note-taking app) to Obsidian vaults. The plugin is designed to be user-friendly, secure, and performant.

## Development Commands

```bash
# Initial setup (if not already done)
npm init
npm install --save-dev obsidian @types/node typescript jest @types/jest ts-jest

# Build TypeScript
npm run build

# Run tests
npm test

# Run a single test file
npm test -- path/to/test.spec.ts

# Start development (watches for changes)
npm run dev

# Lint and format
npm run lint
npm run format
```

## Architecture

### Core Principles
- **Test-First Development**: Write E2E tests before implementation
- **Pragmatic Security**: API keys stored locally, clear warnings about data handling
- **User-Centric Design**: Progress feedback, error recovery, setup wizard
- **Incremental Delivery**: Ship working features early and often

### Project Structure
```
src/
├── main.ts                 # Plugin entry point, registers commands and settings
├── services/
│   ├── granola-service.ts  # Wraps Granola API client
│   ├── auth-service.ts     # API key storage and validation
│   └── sync-engine.ts      # Core sync logic with progress tracking
├── ui/
│   ├── settings-tab.ts     # Plugin settings interface
│   ├── sync-modal.ts       # Progress display during sync
│   └── wizard-modal.ts     # First-run setup experience
├── utils/
│   ├── file-manager.ts     # Obsidian vault file operations
│   ├── markdown-builder.ts # Converts meeting data to markdown
│   ├── template-engine.ts  # Custom template processing
│   └── path-generator.ts   # Dynamic path generation based on settings
└── types/
    └── index.ts            # TypeScript type definitions
```

### Key Patterns

1. **Error Handling**: Use Result<T, E> pattern for explicit error handling
   ```typescript
   type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };
   ```

2. **Progress Tracking**: All long operations report progress
   ```typescript
   interface Progress {
     current: number;
     total: number;
     message: string;
   }
   ```

3. **Batch Processing**: Process meetings in configurable batches (default: 10)

4. **Idempotent Operations**: Sync can be run multiple times safely

5. **Flexible File Organization**: Supports multiple folder structures
   - Flat structure (all notes in one folder)
   - Date-based organization (daily/weekly folders)
   - Mirror Granola's folder hierarchy
   - Configurable file naming (with or without date prefix)

### Testing Strategy

Valid, reliable tests are ESSENTIAL for success. Do not force-pass, bypass, or mock tests unless absolutely required. Tests that fail provide crucial information that assists in successful delivery, and bypassing tests leads to sub-optimal results or outright project failure.

- **E2E Tests First**: Write end-to-end tests that exercise the full plugin
- **Unit Tests**: Test individual services and utilities
- **Mock Obsidian API**: Use test fixtures for vault operations
- **Mock Granola API**: Use test data for API responses

Example test structure:
```typescript
// tests/e2e/sync-meetings.spec.ts
describe('Sync Meetings E2E', () => {
  it('syncs new meetings to vault', async () => {
    // Test implementation
  });
});
```

## Obsidian Plugin Specifics

- Main class extends `Plugin` from Obsidian API
- Settings stored via `plugin.saveData()` and `plugin.loadData()`
- UI components extend `Modal` or `SettingTab`
- File operations use `app.vault` methods
- Respect Obsidian's async patterns and error handling

## Granola API Integration

The plugin integrates with Granola's API (assumed based on implementation plan):
- Authentication via API key
- Fetch meetings endpoint
- Rate limiting considerations
- Error handling for network issues

## Security Considerations

- API keys stored in Obsidian plugin data (local only)
- No credentials transmitted to third parties
- Clear warnings when syncing overwrites local files
- Validation of all external data before processing

## Performance Optimizations

- Batch processing to avoid UI freezing
- Progress reporting for user feedback
- Caching to avoid redundant API calls
- Efficient markdown generation

## Development Workflow

### Phase Completion Process

After completing each development phase:

1. **Expert Review with AI Models**
   - Use Zen MCP server to request code review from o3 and Gemini models
   - Incorporate feedback on architecture, performance, security, and best practices
   - Address any edge cases or concerns identified

2. **Git Commit & Tag**
   - Create atomic commit with descriptive message for the phase
   - Tag the commit with phase number (e.g., `phase-1-complete`)
   - Ensure clean working directory before proceeding

3. **Proceed to Next Phase**
   - Only continue after addressing review feedback
   - Document any significant changes or learnings

## Next Steps

Phase 0 ✅ Complete - Proof of concept plugin created and tested

Phase 1: Foundation & Testing Framework
- Set up project structure with TypeScript
- Write E2E tests for all major features
- Configure testing framework (Jest/Vitest)
- Set up CI/CD pipeline

Phase 2: Core Sync Engine
- Implement Granola API integration
- Build path generation with folder organization
- Create file management with conflict resolution
- Add authentication with API key storage

Phase 3: Performance & Error Handling
- Add retry logic and rate limiting
- Implement streaming for large datasets
- Build comprehensive error handling
- Optimize batch processing

Phase 4: UI/UX Polish
- Create setup wizard for first-time users
- Build settings tab with organization options
- Add sync progress modal
- Implement status bar integration

Phase 5: Testing & Edge Cases
- Test all folder organization combinations
- Handle special characters and edge cases
- Test large datasets and performance
- Verify timezone handling

Phase 6: Documentation & Release
- Write comprehensive README
- Create video tutorial
- Prepare for Community Plugins submission
- Write migration guides