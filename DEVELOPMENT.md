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
