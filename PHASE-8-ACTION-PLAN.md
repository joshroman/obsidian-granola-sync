# Phase 8: Conflict Resolution - Action Plan

## Overview
Phase 8 focuses on implementing robust conflict resolution and data integrity measures to ensure reliable syncing even when users modify files between syncs. This phase will enhance the existing basic conflict handling with comprehensive detection, resolution strategies, and data validation.

## Current State Analysis

### What's Already Implemented
1. **Basic State Management**
   - SyncStateManager tracks file paths and deleted IDs
   - File rename/delete event handlers
   - Debounced state saving

2. **Simple Conflict Avoidance**
   - Skip sync for user-deleted files
   - File path updates when files move
   - Basic error handling

### What's Missing
1. **User Modification Detection**
   - No tracking of file modification times
   - No content hash/checksum validation
   - No detection of user edits vs sync updates

2. **Conflict Resolution Strategy**
   - No backup before overwriting
   - No merge capabilities
   - No user choice preservation

3. **Data Integrity**
   - No validation of sync state consistency
   - No recovery from corrupted state
   - No transaction-like operations

## Implementation Plan

### Step 1: Enhanced State Management (Day 1)

#### 1.1 Extend Sync State with Integrity Data
```typescript
interface FileMetadata {
  granolaId: string;
  path: string;
  lastSyncedAt: string;
  lastModifiedAt: string;
  contentHash: string;
  fileSize: number;
  syncVersion: number;
}

interface SyncState {
  version: number;
  fileMetadata: Record<string, FileMetadata>; // Replace simple fileIndex
  deletedIds: Set<string>;
  lastSync: string;
  stateChecksum: string; // For state integrity validation
}
```

#### 1.2 Implement Content Hashing
- Use crypto.subtle API for SHA-256 hashing
- Hash only frontmatter + key content sections for performance
- Store hash with each synced file

#### 1.3 Track Modification Times
- Monitor vault 'modify' events
- Compare file.stat.mtime with lastSyncedAt
- Detect user modifications between syncs

### Step 2: Conflict Detection Engine (Day 1-2)

#### 2.1 Types of Conflicts to Detect
```typescript
enum ConflictType {
  USER_MODIFIED = 'user_modified',      // User edited since last sync
  BOTH_MODIFIED = 'both_modified',      // Both user and Granola changed
  FILE_MISSING = 'file_missing',        // Expected file not found
  DUPLICATE_ID = 'duplicate_id',        // Same ID in multiple files
  CORRUPTED_METADATA = 'corrupted_metadata', // Invalid frontmatter
  PATH_CONFLICT = 'path_conflict'       // Target path already exists
}

interface ConflictInfo {
  type: ConflictType;
  granolaId: string;
  localPath?: string;
  remoteData?: Meeting;
  userModifiedAt?: Date;
  lastSyncedAt?: Date;
  resolution?: ConflictResolution;
}
```

#### 2.2 Conflict Detection Logic
```typescript
class ConflictDetector {
  async detectConflicts(meeting: Meeting, metadata?: FileMetadata): Promise<ConflictInfo[]> {
    const conflicts: ConflictInfo[] = [];
    
    // Check if file exists and was modified
    if (metadata) {
      const file = await this.getFile(metadata.path);
      if (!file) {
        conflicts.push({ type: ConflictType.FILE_MISSING, ... });
      } else {
        // Check modification time
        if (file.stat.mtime > new Date(metadata.lastSyncedAt).getTime()) {
          // Verify with content hash
          const currentHash = await this.hashFile(file);
          if (currentHash !== metadata.contentHash) {
            conflicts.push({ type: ConflictType.USER_MODIFIED, ... });
          }
        }
      }
    }
    
    // Check for duplicate IDs
    const duplicates = await this.findDuplicateIds(meeting.id);
    if (duplicates.length > 1) {
      conflicts.push({ type: ConflictType.DUPLICATE_ID, ... });
    }
    
    return conflicts;
  }
}
```

### Step 3: Conflict Resolution Strategies (Day 2)

#### 3.1 Resolution Options
```typescript
enum ConflictResolution {
  KEEP_LOCAL = 'keep_local',           // Preserve user's version
  KEEP_REMOTE = 'keep_remote',         // Overwrite with Granola
  MERGE = 'merge',                     // Attempt smart merge
  BACKUP_AND_UPDATE = 'backup_update', // Backup local, then update
  CREATE_DUPLICATE = 'create_duplicate', // Keep both versions
  SKIP = 'skip'                        // Skip this sync
}
```

#### 3.2 Resolution Engine
```typescript
class ConflictResolver {
  async resolveConflict(
    conflict: ConflictInfo,
    strategy: ConflictResolution
  ): Promise<void> {
    switch (strategy) {
      case ConflictResolution.BACKUP_AND_UPDATE:
        await this.backupFile(conflict.localPath);
        await this.updateFile(conflict.remoteData);
        break;
        
      case ConflictResolution.MERGE:
        const merged = await this.attemptMerge(conflict);
        await this.saveFile(merged);
        break;
        
      case ConflictResolution.CREATE_DUPLICATE:
        const dupPath = await this.generateConflictPath(conflict.localPath);
        await this.createFile(dupPath, conflict.remoteData);
        break;
    }
  }
  
  private async attemptMerge(conflict: ConflictInfo): Promise<string> {
    // Smart merge strategy:
    // 1. Preserve user's content body
    // 2. Update frontmatter from Granola
    // 3. Append new highlights/summary
    // 4. Mark as merged in frontmatter
  }
  
  private async backupFile(path: string): Promise<string> {
    const backupPath = `${path}.backup-${Date.now()}`;
    await this.vault.copy(path, backupPath);
    return backupPath;
  }
}
```

### Step 4: Data Validation Framework (Day 2-3)

#### 4.1 State Validation
```typescript
class StateValidator {
  async validateState(state: SyncState): Promise<ValidationResult> {
    const issues: ValidationIssue[] = [];
    
    // Verify state checksum
    const calculatedChecksum = await this.calculateStateChecksum(state);
    if (calculatedChecksum !== state.stateChecksum) {
      issues.push({
        severity: 'critical',
        message: 'State checksum mismatch - possible corruption'
      });
    }
    
    // Verify all tracked files exist
    for (const [id, metadata] of Object.entries(state.fileMetadata)) {
      const file = await this.vault.getFileByPath(metadata.path);
      if (!file) {
        issues.push({
          severity: 'warning',
          message: `Tracked file missing: ${metadata.path}`
        });
      }
    }
    
    // Check for orphaned files (have granolaId but not in state)
    const orphaned = await this.findOrphanedFiles(state);
    if (orphaned.length > 0) {
      issues.push({
        severity: 'info',
        message: `Found ${orphaned.length} orphaned files`
      });
    }
    
    return { valid: issues.filter(i => i.severity === 'critical').length === 0, issues };
  }
}
```

#### 4.2 Meeting Data Validation
```typescript
class MeetingValidator {
  validateMeeting(data: any): Result<Meeting, ValidationError> {
    // Enhanced validation beyond InputValidator
    
    // Check data consistency
    if (data.date && data.endDate) {
      const duration = new Date(data.endDate) - new Date(data.date);
      if (duration < 0) {
        return { ok: false, error: new ValidationError('End date before start date') };
      }
    }
    
    // Validate relationships
    if (data.highlights && data.transcript) {
      // Verify highlights exist in transcript
      for (const highlight of data.highlights) {
        if (!data.transcript.includes(highlight.text)) {
          console.warn('Highlight not found in transcript');
        }
      }
    }
    
    // Check size constraints
    const estimatedSize = JSON.stringify(data).length;
    if (estimatedSize > 10 * 1024 * 1024) {
      return { ok: false, error: new ValidationError('Meeting data exceeds 10MB') };
    }
    
    return { ok: true, value: data as Meeting };
  }
}
```

### Step 5: State Recovery & Transactions (Day 3)

#### 5.1 Transaction-like Operations
```typescript
class StateTransaction {
  private rollbackActions: (() => Promise<void>)[] = [];
  private committed = false;
  
  async execute<T>(
    operation: () => Promise<T>,
    rollback: () => Promise<void>
  ): Promise<T> {
    try {
      const result = await operation();
      this.rollbackActions.push(rollback);
      return result;
    } catch (error) {
      // Auto-rollback on error
      await this.rollback();
      throw error;
    }
  }
  
  async commit(): Promise<void> {
    this.committed = true;
    this.rollbackActions = [];
  }
  
  async rollback(): Promise<void> {
    if (this.committed) return;
    
    // Execute rollbacks in reverse order
    for (let i = this.rollbackActions.length - 1; i >= 0; i--) {
      try {
        await this.rollbackActions[i]();
      } catch (error) {
        console.error('Rollback failed:', error);
      }
    }
  }
}
```

#### 5.2 State Recovery
```typescript
class StateRecovery {
  async recoverFromCorruption(
    corruptedState: any
  ): Promise<SyncState> {
    console.log('Attempting state recovery...');
    
    // Strategy 1: Rebuild from vault files
    const rebuiltState = await this.rebuildStateFromVault();
    
    // Strategy 2: Merge with corrupted state
    const mergedState = this.mergeStates(rebuiltState, corruptedState);
    
    // Strategy 3: Load from backup
    const backupState = await this.loadStateBackup();
    
    // Choose best recovery option
    const recovered = await this.selectBestState([
      rebuiltState,
      mergedState,
      backupState
    ]);
    
    // Validate recovered state
    const validation = await this.validator.validateState(recovered);
    if (!validation.valid) {
      throw new Error('Failed to recover valid state');
    }
    
    return recovered;
  }
  
  private async createStateBackup(state: SyncState): Promise<void> {
    const backup = {
      ...state,
      backupDate: new Date().toISOString()
    };
    await this.plugin.saveData({
      ...await this.plugin.loadData(),
      stateBackup: backup
    });
  }
}
```

### Step 6: User Interface for Conflicts (Day 3)

#### 6.1 Conflict Resolution Modal
```typescript
class ConflictResolutionModal extends Modal {
  constructor(
    app: App,
    private conflicts: ConflictInfo[],
    private onResolve: (resolutions: Map<string, ConflictResolution>) => void
  ) {
    super(app);
  }
  
  onOpen() {
    const { contentEl } = this;
    contentEl.createEl('h2', { text: 'Sync Conflicts Detected' });
    
    this.conflicts.forEach(conflict => {
      const conflictEl = contentEl.createDiv({ cls: 'conflict-item' });
      
      // Show conflict details
      conflictEl.createEl('h3', { text: conflict.granolaId });
      conflictEl.createEl('p', { 
        text: `Type: ${this.getConflictDescription(conflict.type)}` 
      });
      
      // Show diff preview if available
      if (conflict.type === ConflictType.BOTH_MODIFIED) {
        const diffEl = conflictEl.createDiv({ cls: 'conflict-diff' });
        this.renderDiff(diffEl, conflict);
      }
      
      // Resolution options
      const optionsEl = conflictEl.createDiv({ cls: 'conflict-options' });
      this.renderResolutionOptions(optionsEl, conflict);
    });
    
    // Apply to all option
    new ButtonComponent(contentEl)
      .setButtonText('Apply to All Conflicts')
      .onClick(() => this.applyToAll());
  }
}
```

### Step 7: Testing Plan

#### 7.1 Unit Tests
- Hash calculation consistency
- Conflict detection accuracy
- State validation logic
- Recovery mechanisms

#### 7.2 Integration Tests
- File modification during sync
- Concurrent access handling
- State corruption recovery
- Transaction rollback

#### 7.3 E2E Tests
- User edits preservation
- Conflict resolution flow
- Data integrity across syncs
- Performance with conflicts

## Success Metrics

1. **Zero Data Loss**
   - No user content lost during conflicts
   - All conflicts have recovery path

2. **Conflict Detection Rate**
   - 100% of user modifications detected
   - No false positives in conflict detection

3. **Resolution Success**
   - 95%+ automatic resolution rate
   - Clear manual resolution for remainder

4. **Performance Impact**
   - <10% overhead for conflict detection
   - <1s for state validation

5. **User Experience**
   - Clear conflict explanations
   - Intuitive resolution options
   - Minimal sync interruptions

## Risk Mitigation

1. **Performance Concerns**
   - Hash only critical content, not full file
   - Cache hashes until file modified
   - Batch validation operations

2. **State Corruption**
   - Multiple backup strategies
   - Graceful degradation
   - Manual recovery tools

3. **User Confusion**
   - Clear documentation
   - In-app guidance
   - Safe defaults (preserve user data)

## Implementation Timeline

### Day 1: Foundation
- [ ] Extend state with metadata
- [ ] Implement content hashing
- [ ] Add modification tracking
- [ ] Begin conflict detection

### Day 2: Core Logic  
- [ ] Complete conflict detection
- [ ] Implement resolution strategies
- [ ] Add merge capabilities
- [ ] Create validation framework

### Day 3: Polish & Recovery
- [ ] Transaction system
- [ ] State recovery mechanisms
- [ ] Conflict UI components
- [ ] Comprehensive testing

## Next Steps

After Phase 8 completion:
1. Expert review with AI models
2. Git commit with atomic changes
3. Tag as `phase-8-complete`
4. Proceed to Phase 9 (Observability & Performance)