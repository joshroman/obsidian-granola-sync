# CLAUDE.md - Project Development Guide

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Obsidian Granola Sync is an open-source plugin that bridges Granola (AI-powered meeting transcription) and Obsidian (personal knowledge management) for knowledge workers who need unified access to their meeting insights. The plugin automatically synchronizes meeting notes from Granola to Obsidian vaults with configurable organization options, preserves meeting metadata, and ensures data integrity while respecting user privacy through a local-first architecture.

## Development Workflow

### For New Features

1. **Check Roadmap**: Review `requirements/ROADMAP.md` for next priority feature
2. **Create Feature Branch**: `git checkout -b feature/[name]`
3. **Write E2E Tests First**: Create WebdriverIO tests that define "done"
4. **Implement Feature**: Follow TDD Red-Green-Refactor cycle
5. **Push and Wait**: After pushing, MUST wait for GitHub Actions to pass
6. **Validate Completion**: All E2E tests must pass before marking complete
7. **Merge**: Only after CI/CD validation succeeds

### For Bug Fixes

1. **Write Failing Test**: Reproduce bug with WebdriverIO E2E test
2. **Fix Bug**: Make test pass using minimal changes
3. **Verify No Regressions**: Run full test suite locally
4. **Push and Wait**: Monitor GitHub Actions for success
5. **Document**: Update relevant documentation if needed

### CI/CD Synchronization (CRITICAL)

**MANDATORY**: Development must pause after each push until GitHub Actions completes successfully.

```bash
# After pushing to GitHub
git push origin <branch>

# MANDATORY: Wait for CI/CD to complete
# Do NOT continue development until:
# - All GitHub Actions workflows pass (green checkmarks)
# - No test failures in CI
# - Build artifacts generated successfully
```

## Technical Standards

### Core Stack
- **Language**: TypeScript 5.x with strict mode
- **Runtime**: Obsidian Plugin API (Electron-based)
- **Build**: esbuild for bundling, npm for packages
- **Testing**: 
  - Jest 29.x for unit/integration tests
  - WebdriverIO 9.x with custom Obsidian service for E2E
- **Platform**: macOS only (current phase)
- **Minimum Obsidian**: v1.4.0

### Code Quality Standards
- TypeScript strict mode enabled
- ESLint + Prettier for consistent formatting
- Zero errors/warnings policy
- Comprehensive JSDoc for public methods

### Testing Standards
- **TDD Workflow**: Red-Green-Refactor cycle
- **Unit Tests**: Minimum 80% code coverage
- **E2E Tests**: MANDATORY for all user-facing features
- **Critical Paths**: 100% coverage (sync engine, conflict resolution)

## Project Structure

```
obsidian-granola-sync/
├── requirements/
│   ├── PRODUCT_REQUIREMENTS.md    # Product vision and goals
│   ├── TECHNICAL_SPECS.md         # Architecture and standards
│   └── ROADMAP.md                 # Feature priorities and timeline
├── src/
│   ├── main.ts                    # Plugin entry point
│   ├── services/
│   │   ├── granola-service.ts     # Granola API client wrapper
│   │   ├── auth-service.ts        # API key management
│   │   └── sync-engine.ts         # Core sync orchestration
│   ├── ui/
│   │   ├── settings-tab.ts        # Plugin settings interface
│   │   ├── sync-modal.ts          # Progress display
│   │   └── wizard-modal.ts        # First-run setup
│   ├── utils/
│   │   ├── file-manager.ts        # Vault file operations
│   │   ├── markdown-builder.ts    # Meeting to markdown conversion
│   │   ├── template-engine.ts     # Custom template processing
│   │   └── path-generator.ts      # Dynamic path generation
│   └── types/
│       └── index.ts               # TypeScript type definitions
├── tests/
│   ├── unit/                      # Jest unit tests
│   ├── integration/               # Service integration tests
│   └── e2e/                       # WebdriverIO E2E tests (MANDATORY)
│       ├── *.test.ts              # Feature test suites
│       └── setup/                 # Test infrastructure
├── .github/
│   └── workflows/                 # CI/CD pipelines
└── docs/                          # User documentation
```

## Development Commands

```bash
# Initial setup
npm install

# Build plugin
npm run build

# Development mode (watches for changes)
npm run dev

# Run all tests
npm test

# Run E2E tests only
npm run test:e2e

# Run specific test
npm test -- path/to/test.spec.ts

# Lint and format
npm run lint
npm run format

# Check TypeScript
npm run typecheck
```

## Key Patterns

### Error Handling
```typescript
type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };
```

### Progress Tracking
```typescript
interface Progress {
  current: number;
  total: number;
  message: string;
}
```

### Core Principles
- **Batch Processing**: Process meetings in configurable batches (default: 10)
- **Idempotent Operations**: Sync can be run multiple times safely
- **User Data Protection**: Never overwrite user modifications without consent
- **Local-First**: All data stays on user's machine

## Testing Philosophy

**MANDATORY**: Every feature must have WebdriverIO E2E tests that:

1. Simulate real user interactions
2. Validate all acceptance criteria
3. Test edge cases and error handling
4. Pass before feature is marked complete
5. Run in CI/CD pipeline

Valid, reliable tests are ESSENTIAL for success. Do not force-pass, bypass, or mock tests unless absolutely required. Tests that fail provide crucial information that assists in successful delivery.

## Current Development Status

### Version Status
- **Current**: v0.9 (pre-release)
- **Next**: v1.0 - CSS isolation fixes (1-2 days)
- **Then**: v1.1 - Daily note backlinking (3-5 days)
- **Future**: User feedback driven

### Completed Features
- ✅ Core sync engine with incremental updates
- ✅ Multiple organization methods (flat, date-based)
- ✅ Conflict resolution with user protection
- ✅ Template and panel support
- ✅ Performance optimization for 1000+ meetings
- ✅ Setup wizard and auto API key detection
- ✅ Comprehensive error handling

### In Progress
- 🔄 CSS scoping fixes for v1.0 release

### Next Up
- 📋 Daily note backlinking (v1.1)
- 📋 Official Granola API migration (when available)

## Definition of Done

A feature is ONLY complete when:
- [ ] All acceptance criteria from ROADMAP.md met
- [ ] All WebdriverIO E2E tests passing
- [ ] No regressions in existing tests
- [ ] Performance benchmarks met (see TECHNICAL_SPECS.md)
- [ ] CI/CD pipeline passes (GitHub Actions)
- [ ] Code reviewed (if team > 1)
- [ ] User documentation updated
- [ ] No TypeScript/ESLint errors

## Security & Privacy

- **API Keys**: Stored locally in Obsidian plugin data
- **No Analytics**: Zero telemetry or data collection
- **HTTPS Only**: All API communications encrypted
- **Input Validation**: Sanitize all external data
- **Local-First**: No external servers or cloud storage

## Performance Requirements

| Operation | Meeting Count | Time Limit | Memory Limit |
|-----------|--------------|------------|--------------|
| Initial Sync | 100 | 30 seconds | 100MB |
| Initial Sync | 1000 | 5 minutes | 200MB |
| Incremental | 10 | 5 seconds | 50MB |

## Obsidian Plugin Specifics

- Main class extends `Plugin` from Obsidian API
- Settings stored via `plugin.saveData()` and `plugin.loadData()`
- UI components extend `Modal` or `SettingTab`
- File operations use `app.vault` methods
- Respect Obsidian's async patterns and error handling

## Granola API Integration

**Note**: Currently using unofficial API - plan to migrate when official API available

- Authentication via API key
- Fetch meetings endpoint
- Rate limiting considerations
- Error handling for network issues
- Graceful degradation on API changes

## Quick References

- **Product Vision**: See `requirements/PRODUCT_REQUIREMENTS.md`
- **Technical Architecture**: See `requirements/TECHNICAL_SPECS.md`
- **Feature Roadmap**: See `requirements/ROADMAP.md`
- **User Documentation**: See `README.md`

## Phase Completion Process

When completing a development phase:

1. **Expert Review** (optional)
   - Use Zen MCP server for code review
   - Incorporate feedback on architecture and security
   - Address edge cases identified

2. **Git Commit & Tag**
   - Create atomic commit with descriptive message
   - Tag if major milestone
   - Ensure clean working directory

3. **Wait for CI/CD**
   - Push and monitor GitHub Actions
   - Only proceed after all checks pass
   - Fix any CI-specific issues immediately

## Contact & Resources

- **Repository**: github.com/[your-username]/obsidian-granola-sync
- **Obsidian Forum**: [plugin thread when created]
- **Issue Tracker**: GitHub Issues
- **Granola**: granola.ai (unofficial integration)