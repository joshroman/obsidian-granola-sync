# Component Inventory - Obsidian Granola Sync

## Executive Summary

This inventory documents all major component implementations and their current usage status. Based on analysis, we recommend keeping the current working implementations as canonical and selectively porting features from enhanced versions.

## Sync Engine Implementations

### 1. SyncEngine (CURRENTLY ACTIVE ✓)
- **File**: `src/services/sync-engine.ts`
- **Status**: In use by main.ts
- **Dependencies**: All exist and working
- **Key Features**:
  - Basic sync with batch processing (5-50 meetings/batch)
  - Progress tracking and cancellation
  - Panel/template support
  - Large file chunking
  - File move handling
  - Queue management
- **Recommendation**: **KEEP AS CANONICAL**

### 2. EnhancedSyncEngine
- **File**: `src/services/enhanced-sync-engine.ts`
- **Status**: Not used
- **Dependencies**: Missing ContentProcessor, wrong PathGenerator import
- **Unique Features**:
  - Transaction support
  - Conflict detection/resolution
  - Dry run mode
  - Auto-resolve strategies
- **Recommendation**: Port conflict detection features only

### 3. OptimizedSyncEngine
- **File**: `src/services/optimized-sync-engine.ts`
- **Status**: Not used
- **Dependencies**: Missing ContentProcessor, wrong PathGenerator import
- **Unique Features**:
  - Performance monitoring
  - Structured logging
  - Error pattern tracking
  - Adaptive batching based on performance
- **Recommendation**: Port performance monitoring only

### 4. HardenedSyncEngine
- **File**: `src/services/hardened-sync-engine.ts`
- **Status**: Not used
- **Dependencies**: Same issues as OptimizedSyncEngine
- **Unique Features**:
  - Large dataset handler
  - Recovery management
  - Time estimation
  - Max meetings limit
- **Recommendation**: Port recovery management only

## State Manager Implementations

### 1. SyncStateManager (CURRENTLY ACTIVE ✓)
- **File**: `src/services/sync-state-manager.ts`
- **Status**: In use by main.ts and sync-engine.ts
- **Version**: 1
- **Features**:
  - Basic file index (granolaId → path)
  - Deleted IDs tracking
  - Rename/delete event handling
  - Last sync timestamp
- **Recommendation**: **Upgrade to Enhanced Version**

### 2. EnhancedStateManager
- **File**: `src/services/enhanced-state-manager.ts`
- **Status**: Not used
- **Version**: 2
- **Unique Features**:
  - Rich metadata (content hash, timestamps)
  - Conflict detection integration
  - Transaction support
  - State integrity (checksums, backups)
  - Migration from v1
  - Orphaned file cleanup
- **Recommendation**: **MAKE CANONICAL** (includes migration)

## API Service Implementations

### 1. EnhancedGranolaService (CURRENTLY ACTIVE ✓)
- **File**: `src/services/enhanced-granola-service.ts`
- **Status**: In use everywhere
- **Features**:
  - Retry logic with exponential backoff
  - Rate limiting
  - Request queuing
  - Error categorization
  - Panel fetching
- **Recommendation**: **KEEP AS CANONICAL**

### 2. granola-service.old.ts
- **File**: `src/services/granola-service.old.ts`
- **Status**: Already marked as old
- **Recommendation**: **DELETE**

## Supporting Services

### Currently Used ✓
1. **PanelProcessor** - Template processing
2. **PathGenerator** - Path generation (utils)
3. **FileManager** - File operations
4. **MarkdownBuilder** - Content generation
5. **ChunkedContentProcessor** - Large file handling
6. **ErrorHandler** - Error management

### Available but Unused
1. **ConflictDetector** - Conflict detection
2. **RecoveryManager** - Sync recovery
3. **StructuredLogger** - Enhanced logging
4. **PerformanceMonitor** - Performance tracking
5. **ErrorTracker** - Error pattern analysis
6. **AdaptiveBatcher** - Dynamic batching
7. **LargeDatasetHandler** - Large sync handling
8. **DataValidator** - Data validation

### Missing Dependencies
1. **ContentProcessor** - Referenced but doesn't exist

## Migration Strategy

### Phase 1: State Manager Upgrade (Week 1)
1. Switch from `SyncStateManager` to `EnhancedStateManager`
2. Test migration from v1 to v2 format
3. Update all imports in main.ts and sync-engine.ts

### Phase 2: Sync Engine Enhancement (Week 2)
1. Keep `SyncEngine` as base
2. Port conflict detection from `EnhancedSyncEngine`
3. Port recovery management from `HardenedSyncEngine`
4. Fix import paths for PathGenerator

### Phase 3: Cleanup (Week 3)
1. Delete unused sync engine variants
2. Delete granola-service.old.ts
3. Remove references to missing ContentProcessor
4. Update documentation

### Phase 4: Testing (Week 4)
1. Fix all failing tests
2. Add tests for migrated features
3. Performance benchmarks
4. Integration testing

## Risk Assessment

### Low Risk Changes
- State manager upgrade (has migration path)
- Deleting already-marked-old files
- Fixing import paths

### Medium Risk Changes
- Porting conflict detection
- Porting recovery management
- Deleting unused engines

### High Risk Changes
- None identified (keeping working code)

## File Deletion List

### Safe to Delete Now
1. `src/services/granola-service.old.ts`

### Delete After Migration
1. `src/services/sync-state-manager.ts` (after switching to enhanced)
2. `src/services/enhanced-sync-engine.ts`
3. `src/services/optimized-sync-engine.ts`
4. `src/services/hardened-sync-engine.ts`

## Recommended Approach

1. **Start with state manager upgrade** - It's designed for migration
2. **Keep working sync engine** - Don't break what works
3. **Port features selectively** - Only what adds clear value
4. **Test extensively** - Each change must maintain stability
5. **Document decisions** - Why each choice was made

## Next Steps

1. Create detailed migration plan for state manager
2. Identify specific features to port from enhanced engines
3. Set up test harness for migration validation
4. Begin Week 1 implementation