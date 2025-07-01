# Technical Specifications - Obsidian Granola Sync

## System Architecture

### Tech Stack
- **Language**: TypeScript 5.x with strict mode
- **Runtime**: Obsidian Plugin API (Electron-based)
- **Build Tools**: esbuild for bundling, npm for package management
- **Testing Framework**: 
  - Jest 29.x for unit/integration tests
  - WebdriverIO 9.x with custom Obsidian service for E2E tests
- **Platform Support**: macOS only (current phase)
- **Minimum Obsidian Version**: 1.4.0

### Architecture Patterns
- **Overall Pattern**: Event-driven plugin architecture with modular services
- **Data Flow**: Unidirectional sync (Granola → Obsidian)
- **Sync Pattern**: Incremental with state tracking and conflict detection
- **State Management**: Transaction-based with rollback capability
- **Error Handling**: Result<T, E> pattern for explicit error propagation
- **Storage**: Local-first, no external servers or analytics

### Component Architecture

```
┌─────────────────────────────────────────────────┐
│                   UI Layer                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐        │
│  │Settings  │ │Sync Modal│ │Conflict  │        │
│  │   Tab    │ │          │ │Resolution│        │
│  └──────────┘ └──────────┘ └──────────┘        │
└─────────────────────────────────────────────────┘
                        │
┌─────────────────────────────────────────────────┐
│                Service Layer                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐        │
│  │Granola   │ │Sync      │ │Auth      │        │
│  │Service   │ │Engine    │ │Service   │        │
│  └──────────┘ └──────────┘ └──────────┘        │
└─────────────────────────────────────────────────┘
                        │
┌─────────────────────────────────────────────────┐
│                 Data Layer                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐        │
│  │File      │ │State     │ │Cache     │        │
│  │Manager   │ │Manager   │ │Manager   │        │
│  └──────────┘ └──────────┘ └──────────┘        │
└─────────────────────────────────────────────────┘
                        │
┌─────────────────────────────────────────────────┐
│                Utility Layer                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐        │
│  │Markdown  │ │Template  │ │Path      │        │
│  │Builder   │ │Engine    │ │Generator │        │
│  └──────────┘ └──────────┘ └──────────┘        │
└─────────────────────────────────────────────────┘
```

### Key Design Decisions

1. **Modular Service Architecture**: Each service has a single responsibility
2. **Dependency Injection**: Services receive dependencies via constructor
3. **Interface-First Design**: All services implement clear interfaces
4. **Immutable State**: State changes create new objects, not mutations
5. **Defensive Programming**: Validate all external inputs
6. **Progressive Enhancement**: Core features work without optional ones

## Development Standards

### Code Quality Standards

#### TypeScript Configuration
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

#### Code Style
- **Linting**: ESLint with recommended rules
- **Formatting**: Prettier with 2-space indentation
- **Naming Conventions**:
  - Classes: PascalCase (e.g., `SyncEngine`)
  - Methods/Functions: camelCase (e.g., `syncMeetings`)
  - Constants: UPPER_SNAKE_CASE (e.g., `MAX_RETRY_COUNT`)
  - Interfaces: Prefixed with 'I' (e.g., `ISyncOptions`)

#### Documentation Standards
- All public methods must have JSDoc comments
- Complex algorithms require inline explanations
- README maintained with current features
- CLAUDE.md updated with architectural decisions

### Testing Standards

#### TDD Workflow (Red-Green-Refactor)
1. **Red**: Write a failing test that defines desired behavior
2. **Green**: Write minimum code to make the test pass
3. **Refactor**: Improve code quality while keeping tests green
4. **Integrate**: Run full test suite before committing

#### Test Coverage Requirements
- **Unit Tests**: Minimum 80% code coverage
- **Integration Tests**: All service interactions covered
- **E2E Tests**: Every user-facing feature must have E2E tests
- **Critical Paths**: 100% coverage for sync engine and conflict resolution

#### E2E Testing Requirements
```typescript
// Every feature must have an E2E test like this:
describe('Feature: Sync Meetings', () => {
  it('should sync new meetings from Granola to Obsidian', async () => {
    // Arrange: Set up test vault and mock data
    // Act: Trigger sync
    // Assert: Verify meetings appear correctly
  });
  
  it('should handle sync errors gracefully', async () => {
    // Test error scenarios
  });
});
```

### Security Standards

1. **API Key Storage**
   - Stored in Obsidian's plugin data (encrypted on disk)
   - Never logged or transmitted to external services
   - Validation before storage

2. **Data Protection**
   - All data remains on user's local machine
   - No analytics or telemetry collection
   - HTTPS-only for API communications

3. **Input Validation**
   - Sanitize all markdown content
   - Validate file paths for directory traversal
   - Escape special characters in filenames

4. **Error Messages**
   - Never expose sensitive information
   - Provide actionable guidance without technical details
   - Log detailed errors only in debug mode

## CI/CD and Development Workflow

### Mandatory CI/CD Synchronization

**CRITICAL REQUIREMENT**: Development must pause after each push until GitHub Actions CI/CD completes successfully.

#### Workflow Requirements
1. **Local Development**
   - Run full test suite locally before committing
   - Ensure `npm run lint` and `npm run build` pass
   - Verify E2E tests pass with `npm run test:e2e`

2. **Push and Wait Protocol**
   ```bash
   # After pushing to GitHub
   git push origin <branch>
   
   # MANDATORY: Wait for CI/CD to complete
   # Do NOT continue development until:
   # - All GitHub Actions workflows pass (green checkmarks)
   # - No test failures in CI
   # - Build artifacts generated successfully
   ```

3. **CI/CD Failure Protocol**
   - If CI/CD fails, fix issues immediately
   - Do not start new work until CI is green
   - Revert commits if necessary to maintain green main branch

4. **Rationale**
   - Prevents drift between local and CI environments
   - Catches environment-specific issues early
   - Maintains consistent quality gates
   - Ensures reproducible builds

### GitHub Actions Workflow

```yaml
name: CI/CD Pipeline
on: [push, pull_request]

jobs:
  test:
    runs-on: macos-latest
    steps:
      - Lint code (ESLint + Prettier)
      - Run unit tests with coverage
      - Run integration tests
      - Run E2E tests with Obsidian
      - Build plugin
      - Upload artifacts
```

### Quality Gates (All Must Pass)
1. **Code Quality**
   - ESLint: 0 errors, 0 warnings
   - TypeScript: Strict mode, no errors
   - Prettier: All files formatted

2. **Test Results**
   - Unit tests: 100% pass rate
   - Integration tests: 100% pass rate
   - E2E tests: 100% pass rate
   - Code coverage: Minimum 80%

3. **Build Success**
   - Plugin builds without errors
   - Bundle size < 2MB
   - No missing dependencies

4. **Security Checks**
   - No exposed API keys in code
   - Dependencies vulnerability scan
   - No unsafe file operations

## Testing Strategy

### Test Pyramid

```
        ╱─────╲           E2E Tests (WebdriverIO)
       ╱       ╲          - User workflows
      ╱         ╲         - Visual regression
     ╱───────────╲        - Performance validation
    ╱             ╲       
   ╱               ╲      Integration Tests (Jest)
  ╱                 ╲     - Service interactions
 ╱───────────────────╲    - API integration
╱                     ╲   - State management
───────────────────────   Unit Tests (Jest)
                          - Pure functions
                          - Individual methods
                          - Edge cases
```

### E2E Test Scenarios (Mandatory)

1. **First-Time Setup**
   - Wizard completion
   - API key validation
   - Initial sync

2. **Sync Operations**
   - Full sync (all meetings)
   - Incremental sync (new only)
   - Sync with conflicts
   - Sync interruption recovery

3. **Organization Methods**
   - Flat structure
   - Date-based folders
   - Custom naming patterns

4. **Conflict Resolution**
   - User modifications preserved
   - Duplicate handling
   - Missing file recovery

5. **Performance Scenarios**
   - 100 meetings in < 30 seconds
   - 1000 meetings without crashes
   - Memory usage stays under limit

### Test Data Management
- Mock Granola API responses in `tests/fixtures/`
- Test vault snapshots for regression testing
- Deterministic meeting IDs for reproducibility
- Time-frozen tests for consistent results

## Performance Requirements

### Sync Performance
| Operation | Meeting Count | Time Limit | Memory Limit |
|-----------|--------------|------------|--------------|
| Initial Sync | 100 | 30 seconds | 100MB |
| Initial Sync | 1000 | 5 minutes | 200MB |
| Incremental | 10 | 5 seconds | 50MB |
| Single Meeting | 1 | 2 seconds | 25MB |

### UI Responsiveness
- Progress modal updates every 100ms
- Cancel button responds within 500ms
- Settings save within 1 second
- No UI freezing during sync

### Resource Usage
- CPU: Single core utilization
- Disk I/O: Batched writes (10 files at a time)
- Network: Respect rate limits
- Memory: Stream large responses

## Infrastructure & Deployment

### Development Environment
```bash
# Required tools
- Node.js 18.x or 20.x
- npm 8.x+
- macOS (for E2E tests)
- Obsidian.app installed

# Setup
npm install
npm run build
npm run test:all
```

### Release Process

1. **Version Bump**
   ```bash
   npm version patch/minor/major
   git push && git push --tags
   ```

2. **Wait for CI/CD** ⚠️
   - ALL GitHub Actions must pass
   - Download and test release artifacts
   - Verify manifest.json version updated

3. **GitHub Release**
   - Create release from tag
   - Attach main.js, manifest.json, styles.css
   - Write comprehensive changelog

4. **Community Plugin Submission**
   - Submit PR to obsidian-releases repo
   - Include testing evidence
   - Wait for review approval

### Rollback Procedures
1. Revert problematic commit
2. Create hotfix branch
3. Fix issue with tests
4. Fast-track through CI/CD
5. Release patch version

## Monitoring & Observability

### Logging Strategy

```typescript
// Structured logging with levels
logger.debug('Sync started', { meetingCount: 100 });
logger.info('Sync completed', { duration: '45s', errors: 0 });
logger.warn('Rate limit approaching', { remaining: 10 });
logger.error('Sync failed', { error: err, context: syncState });
```

### Metrics to Track
1. **Performance Metrics**
   - Sync duration by meeting count
   - Memory usage peaks
   - API response times
   - File write performance

2. **Reliability Metrics**
   - Sync success rate
   - Error frequency by type
   - Retry success rate
   - Conflict resolution outcomes

3. **Usage Metrics** (Privacy-Preserving)
   - Feature usage (settings only)
   - Sync frequency patterns
   - Error report submissions

### Error Tracking
- Structured error types with codes
- User-friendly error messages
- Debug mode for detailed logs
- Error recovery suggestions

### User Feedback Mechanisms
- GitHub Issues integration
- Error report generation
- Debug log export
- Community forum support

## Compliance & Validation

### Data Privacy
- No external data transmission
- Local-only storage
- User consent for any data sharing
- Clear privacy documentation

### Accessibility
- Keyboard navigation support
- Screen reader compatibility
- High contrast mode support
- Clear error messages

### Obsidian Community Standards
- Follow plugin guidelines
- Respect API rate limits
- No modification of core Obsidian files
- Compatible with other plugins

## Migration & Compatibility

### API Migration Strategy
When official Granola API becomes available:
1. Implement adapter pattern
2. Parallel API support period
3. Automatic detection of API version
4. Seamless migration for users
5. Deprecation warnings

### Obsidian Version Support
- Minimum: 1.4.0 (current)
- Test on latest stable
- Monitor deprecation warnings
- Update within 30 days of breaking changes

## References
- Based on user needs from [PRODUCT_REQUIREMENTS.md](PRODUCT_REQUIREMENTS.md)
- Implementation timeline in [ROADMAP.md](ROADMAP.md)
- Developer guide in [CLAUDE.md](../CLAUDE.md)