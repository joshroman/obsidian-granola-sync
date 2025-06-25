# TODO.md - Obsidian Granola Sync Plugin

## Current Phase: Phase 8 - Conflict Resolution

### Phase 8 Tasks (In Progress)

#### Day 1: Foundation
- [ ] Extend SyncState interface with FileMetadata
  - [ ] Add contentHash, lastModifiedAt, syncVersion fields
  - [ ] Add stateChecksum for integrity validation
- [ ] Implement content hashing utility
  - [ ] Use crypto.subtle API for SHA-256
  - [ ] Hash frontmatter + key sections only
  - [ ] Add hash caching mechanism
- [ ] Add modification tracking
  - [ ] Listen to vault 'modify' events
  - [ ] Compare mtime with lastSyncedAt
  - [ ] Track user vs sync modifications
- [ ] Begin conflict detection engine
  - [ ] Define ConflictType enum
  - [ ] Create ConflictInfo interface
  - [ ] Implement basic detection logic

#### Day 2: Core Logic
- [ ] Complete conflict detection
  - [ ] Handle all conflict types
  - [ ] Add duplicate ID detection
  - [ ] Validate file metadata
- [ ] Implement resolution strategies
  - [ ] Define ConflictResolution enum
  - [ ] Create ConflictResolver class
  - [ ] Implement each resolution strategy
- [ ] Add merge capabilities
  - [ ] Smart merge for content conflicts
  - [ ] Preserve user body content
  - [ ] Update metadata from Granola
- [ ] Create validation framework
  - [ ] StateValidator for sync state
  - [ ] MeetingValidator for data integrity
  - [ ] Recovery suggestions

#### Day 3: Polish & Recovery
- [ ] Transaction system
  - [ ] Create StateTransaction class
  - [ ] Add rollback capabilities
  - [ ] Ensure atomic operations
- [ ] State recovery mechanisms
  - [ ] Implement StateRecovery class
  - [ ] Multiple recovery strategies
  - [ ] Backup/restore functionality
- [ ] Conflict UI components
  - [ ] ConflictResolutionModal
  - [ ] Diff visualization
  - [ ] Batch resolution options
- [ ] Comprehensive testing
  - [ ] Unit tests for each component
  - [ ] Integration tests
  - [ ] E2E conflict scenarios

### Upcoming Phases

#### Phase 9: Observability & Performance (Next)
- Structured logging with Winston/Pino
- Performance optimization with p-queue
- Memory usage monitoring
- Circuit breaker pattern

#### Phase 10: Core Engine Hardening
- AbortController for cancellation
- Progress persistence
- State machine implementation
- Network resilience

#### Phase 11: User Experience Polish
- Interactive wizard improvements
- Real-time progress with ETA
- Pause/resume capability
- Guided troubleshooting

#### Phase 12: Documentation & Release
- Comprehensive README
- API documentation
- Video tutorials
- Community submission prep

## Recently Completed

### Phase 7: Test Infrastructure ✅
- Fixed timezone issues across tests
- Reduced test failures from 57 to 4
- Achieved 74/108 tests passing
- Identified clustering strategy for remaining failures

### Phase 6: Test Rehabilitation ✅
- Implemented test clustering strategy
- 22% failure reduction achieved
- Grouped related test failures

### Phase 5: Testing & Edge Cases ✅
- Added comprehensive test coverage
- Special character handling
- Timezone edge cases
- Large dataset tests

### Phase 4: UI/UX Polish ✅
- Setup wizard implementation
- Sync progress modal
- Settings improvements
- Status bar integration

### Phase 3: Performance & Error Handling ✅
- Retry logic with exponential backoff
- Streaming for large datasets
- Comprehensive error handling
- Batch processing optimization

### Phase 2: Core Sync Functionality ✅
- API integration
- File creation/updates
- Path generation
- Basic authentication

### Phase 1: Foundation & Testing Framework ✅
- Project structure
- TypeScript setup
- Testing framework
- Core types

### Phase 0.5: Critical Infrastructure ✅
- State management system
- Input validation
- Test environment setup
- Performance groundwork

### Phase 0: Proof of Concept ✅
- Basic plugin structure
- Minimal working plugin
- Development workflow

## Notes

- Current test status: 4 failed, 30 skipped, 74 passed (108 total)
- Main failing tests are in special-characters.test.ts and edge-cases.test.ts
- Performance tests show good results with adaptive batch sizing
- State management is functional but needs conflict resolution enhancements

## Development Guidelines

1. Always run tests before committing: `npm test`
2. Update this TODO.md as tasks are completed
3. Follow atomic commit practices
4. Use feature branches for major changes
5. Get AI review before phase completion