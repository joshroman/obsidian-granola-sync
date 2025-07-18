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

## Claude Swarm Architecture (CRITICAL)

### Dependency Hierarchy Rules

**FUNDAMENTAL REQUIREMENT**: Claude Swarm configurations MUST NOT have circular dependencies.

#### Hierarchy Structure
```
orchestrator (Level 0 - Top)
├── obsidian_architect (Level 1)
├── feature_developer (Level 1)  
├── test_engineer (Level 1)
├── quality_assurance (Level 1)
├── sync_specialist (Level 2)
├── api_specialist (Level 2)
├── ui_specialist (Level 2)
└── performance_specialist (Level 2)
```

#### Connection Rules
- **Level 0 (Orchestrator)**: Can connect to ALL downstream agents
- **Level 1 (Core Agents)**: Can connect to Level 2 agents only, NEVER to orchestrator or other Level 1
- **Level 2 (Specialists)**: Can connect to each other, NEVER to upstream levels

#### Forbidden Patterns
- ❌ `orchestrator` in any downstream connections array
- ❌ Level 1 agents connecting to other Level 1 agents  
- ❌ Level 2 agents connecting to Level 1 or orchestrator
- ❌ Any bidirectional references (A→B and B→A)

#### Valid Connection Examples
```yaml
# ✅ CORRECT: Orchestrator connects downstream
orchestrator:
  connections: [obsidian_architect, feature_developer, test_engineer, ...]

# ✅ CORRECT: Level 1 connects to Level 2 only
feature_developer:
  connections: [sync_specialist, api_specialist, ui_specialist]

# ✅ CORRECT: Level 2 connects to peers or empty
sync_specialist:
  connections: [api_specialist]  # or connections: []
```

#### Validation
Before deploying claude-swarm.yml:
1. Verify NO agent references orchestrator in connections
2. Verify NO circular dependencies exist
3. Test with `claude-swarm` command for validation errors

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

## CRITICAL: Integration Verification Protocol (IVP)

### MANDATORY CHECKS - NO EXCEPTIONS

Before ANY commit claiming a feature is "fixed" or "complete":

1. **INTEGRATION VERIFICATION (MANDATORY)**
   ```bash
   # These commands MUST pass:
   npm run build
   npm run test:integration-verify
   npm run test:visual-smoke
   ```

2. **CSS/STYLE INTEGRATION RULE**
   - ANY CSS file MUST have corresponding test verifying it's loaded in DOM
   - ANY styling change MUST have visual regression test
   - NO style-related PR without DOM injection verification

3. **DEFINITION OF DONE - HARD REQUIREMENTS**
   - [ ] Feature works in actual Obsidian instance (not just tests pass)
   - [ ] Integration test verifies all components are loaded/connected
   - [ ] Visual test captures before/after screenshots
   - [ ] Manual verification in test vault documented

### TEST PHILOSOPHY CHANGES

**OLD (BROKEN)**: Test that code exists
**NEW (REQUIRED)**: Test that code WORKS in real environment

**FORBIDDEN PATTERNS**:
- ❌ Tests that check for absence of problems without verifying solution exists
- ❌ "Passing by not failing" tests (empty results passing as success)
- ❌ Mocking away the actual integration points being tested

**MANDATORY PATTERNS**:
- ✅ Tests that verify actual DOM manipulation occurred
- ✅ Tests that verify real Obsidian API interactions
- ✅ Tests that capture visual evidence of working feature

## Testing Philosophy

**MANDATORY**: Every feature must have WebdriverIO E2E tests that:

1. Simulate real user interactions
2. Validate all acceptance criteria
3. Test edge cases and error handling
4. Pass before feature is marked complete
5. Run in CI/CD pipeline
6. **VERIFY INTEGRATION**: Test that components are actually loaded and working

Valid, reliable tests are ESSENTIAL for success. Do not force-pass, bypass, or mock tests unless absolutely required. Tests that fail provide crucial information that assists in successful delivery.

## HARD RULE: CSS/UI Changes

ANY change involving CSS, styles, or UI MUST include:
- [ ] Integration test verifying CSS loads in DOM
- [ ] Visual screenshot showing the fix works
- [ ] Manual test in real Obsidian instance
- [ ] Before/after comparison documented

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