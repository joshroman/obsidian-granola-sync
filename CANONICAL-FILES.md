# Canonical Files - Obsidian Granola Sync

This document defines the authoritative implementations for each component in the codebase.

## Core Services (Canonical)

### State Management
- **CANONICAL**: `src/services/enhanced-state-manager.ts`
- **CLASS**: `EnhancedStateManager`
- **FEATURES**: Version 2 state format, migration support, conflict detection, transactions, integrity checks

### Sync Engine
- **CANONICAL**: `src/services/sync-engine.ts`
- **CLASS**: `SyncEngine`
- **FEATURES**: Core sync, batch processing, conflict detection, panel support, progress tracking

### API Service
- **CANONICAL**: `src/services/enhanced-granola-service.ts`
- **CLASS**: `EnhancedGranolaService`
- **FEATURES**: Retry logic, rate limiting, request queuing, error categorization

## Deleted Files (No Longer Used)

The following files have been removed as part of consolidation:
- ❌ `src/services/sync-state-manager.ts` - Replaced by EnhancedStateManager
- ❌ `src/services/enhanced-sync-engine.ts` - Features ported to SyncEngine
- ❌ `src/services/optimized-sync-engine.ts` - Features ported to SyncEngine
- ❌ `src/services/hardened-sync-engine.ts` - Features ported to SyncEngine
- ❌ `src/services/granola-service.old.ts` - Already marked as old

## Import Guidelines

### State Manager
```typescript
// ✅ CORRECT
import { EnhancedStateManager } from './services/enhanced-state-manager';

// ❌ WRONG (file deleted)
import { SyncStateManager } from './services/sync-state-manager';
```

### Sync Engine
```typescript
// ✅ CORRECT
import { SyncEngine } from './services/sync-engine';

// ❌ WRONG (files deleted)
import { EnhancedSyncEngine } from './services/enhanced-sync-engine';
import { OptimizedSyncEngine } from './services/optimized-sync-engine';
import { HardenedSyncEngine } from './services/hardened-sync-engine';
```

### API Service
```typescript
// ✅ CORRECT
import { EnhancedGranolaService } from './services/enhanced-granola-service';

// ❌ WRONG (file deleted)
import { GranolaService } from './services/granola-service.old';
```

## Features Consolidated

### From EnhancedSyncEngine → SyncEngine
- ✅ Basic conflict detection (user modifications, file missing)
- ✅ Automatic conflict resolution strategies
- ✅ Backup creation before updates
- ❌ Transaction support (available in EnhancedStateManager)
- ❌ Dry run mode (not ported - can add if needed)

### From OptimizedSyncEngine → SyncEngine
- ❌ Performance monitoring (not ported - can add if needed)
- ❌ Structured logging (not ported - can add if needed)
- ✅ Adaptive batching (already existed in base)

### From HardenedSyncEngine → SyncEngine
- ❌ Recovery management (not ported - can add if needed)
- ✅ Large dataset handling (already existed via ChunkedProcessor)
- ✅ Cancellation support (already existed)

## Linting Rules

To prevent accidental use of deleted files, add these rules to your linter:

### ESLint Configuration
```json
{
  "rules": {
    "no-restricted-imports": ["error", {
      "paths": [
        {
          "name": "./services/sync-state-manager",
          "message": "Use EnhancedStateManager instead"
        },
        {
          "name": "./services/enhanced-sync-engine",
          "message": "Use SyncEngine instead"
        },
        {
          "name": "./services/optimized-sync-engine",
          "message": "Use SyncEngine instead"
        },
        {
          "name": "./services/hardened-sync-engine",
          "message": "Use SyncEngine instead"
        }
      ]
    }]
  }
}
```

## Architecture Decisions

1. **Single Implementation Rule**: Each component has exactly one implementation
2. **Feature Migration**: Essential features from enhanced versions were ported to base implementations
3. **Backward Compatibility**: The consolidated implementations maintain the same public APIs
4. **Optional Features**: Advanced features like conflict detection can be enabled/disabled via settings
5. **Performance First**: Base implementations were kept because they're already optimized and working

## Future Enhancements

If additional features from the deleted implementations are needed:
1. Port them to the canonical implementation
2. Make them optional via settings when appropriate
3. Ensure they don't impact core functionality
4. Add comprehensive tests before enabling