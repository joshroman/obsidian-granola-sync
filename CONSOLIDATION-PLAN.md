# Consolidation Plan - Obsidian Granola Sync

## Executive Summary

Based on unanimous expert consensus from o3, Gemini 2.5 Pro, and o3-mini, we are pausing all feature development to consolidate multiple implementations into a single, stable codebase. This consolidation is essential for long-term maintainability and reliability.

## Current State Analysis

### Multiple Implementations Found

**Sync Engines (4 variants):**
1. `sync-engine.ts` - Original implementation
2. `enhanced-sync-engine.ts` - Added progress tracking
3. `optimized-sync-engine.ts` - Performance improvements
4. `hardened-sync-engine.ts` - Most complete, includes all features

**State Managers (2 variants):**
1. `sync-state-manager.ts` - Basic state tracking
2. `enhanced-state-manager.ts` - Added integrity checks

**Granola Services (2 variants):**
1. `granola-service.old.ts` - Original (already marked old)
2. `enhanced-granola-service.ts` - Current implementation

### Test Status
- Total: 108 tests
- Passing: ~74 (68.5%)
- Failing: ~30+ 
- Key issues: timezone handling, async races, mock initialization

### Technical Debt
1. Violated single-source-of-truth principle
2. Unclear which implementations are canonical
3. Risk of regression when modifying code
4. Increased cognitive load for developers

## Consolidation Strategy

### Week 1: Analysis & Planning

#### Component Inventory Matrix

| Component | File | Status | Unique Features | Recommendation |
|-----------|------|--------|-----------------|----------------|
| Sync Engine | sync-engine.ts | Legacy | Basic sync | Deprecate |
| Sync Engine | enhanced-sync-engine.ts | Active | Progress tracking | Merge into hardened |
| Sync Engine | optimized-sync-engine.ts | Active | Batch optimization | Merge into hardened |
| Sync Engine | hardened-sync-engine.ts | Latest | All features + recovery | **CANONICAL** |
| State Manager | sync-state-manager.ts | Active | Basic state | Merge into enhanced |
| State Manager | enhanced-state-manager.ts | Latest | Integrity checks | **CANONICAL** |
| API Service | enhanced-granola-service.ts | Active | Retry, rate limit | **CANONICAL** |

#### Selection Criteria
1. **Completeness**: Which implementation has all required features?
2. **Stability**: Which has the most robust error handling?
3. **Performance**: Which handles large datasets best?
4. **Maintainability**: Which has the cleanest architecture?

### Week 2: Implementation

#### Merge Plan
1. **Day 1-2**: Port unique features from deprecated engines
   - Progress tracking from enhanced-sync-engine
   - Batch optimization from optimized-sync-engine
   - Ensure no logic is lost

2. **Day 3-4**: Update all imports
   - Global search/replace for deprecated imports
   - Update main.ts to use canonical versions
   - Fix any circular dependencies

3. **Day 5**: Delete deprecated files
   - Remove all non-canonical implementations
   - Clean up old imports
   - Update build configuration

### Week 3: Validation

#### Phase 2 Requirements Verification
- [ ] API Integration
  - Authentication with API key
  - Retry logic with exponential backoff
  - Rate limiting
  
- [ ] Path Generation (all 3 modes)
  - Flat structure
  - By-date organization (daily/weekly)
  - Mirror Granola folders
  
- [ ] File Management
  - Idempotent operations
  - Conflict resolution
  - State tracking
  
- [ ] Authentication
  - Secure API key storage
  - Connection validation
  - Error handling

#### Test Suite Stabilization
1. Fix timezone issues globally
2. Resolve async race conditions
3. Update mocks to match canonical implementations
4. Achieve 100% pass rate

### Week 4: Quality Gates

#### CI/CD Pipeline Requirements
```yaml
# .github/workflows/quality-gates.yml
- name: Run Tests
  run: |
    npm test -- --coverage
    if [ $? -ne 0 ]; then
      echo "Tests failed. No merge allowed."
      exit 1
    fi

- name: Check Coverage
  run: |
    coverage=$(cat coverage/coverage-summary.json | jq '.total.lines.pct')
    if (( $(echo "$coverage < 85" | bc -l) )); then
      echo "Coverage below 85%. No merge allowed."
      exit 1
    fi
```

#### Documentation Updates
1. Mark canonical files with clear headers
2. Add deprecation notices to old files
3. Update architecture diagrams
4. Create migration guide for developers

## Risk Mitigation

### Potential Risks
1. **Lost functionality**: Careful code review before deletion
2. **Breaking changes**: Comprehensive test coverage
3. **Performance regression**: Benchmark before/after
4. **Hidden dependencies**: Thorough import analysis

### Mitigation Strategies
1. Create feature comparison matrix
2. Tag current state for rollback
3. Test each consolidation step
4. Gradual migration with feature flags

## Success Metrics

### Must Have (Week 4)
- ✅ Single sync engine (hardened-sync-engine.ts)
- ✅ Single state manager (enhanced-state-manager.ts)
- ✅ 100% test pass rate
- ✅ All Phase 2 requirements working
- ✅ CI/CD with quality gates

### Nice to Have
- ✅ Performance improvement from consolidation
- ✅ Reduced memory footprint
- ✅ Cleaner dependency graph
- ✅ Developer documentation

## Timeline

| Week | Focus | Deliverable |
|------|-------|-------------|
| 1 | Analysis | Component inventory, canonical selection |
| 2 | Implementation | Merged codebase, deleted redundancies |
| 3 | Validation | All tests passing, Phase 2 verified |
| 4 | Quality | CI/CD gates, documentation, beta ready |

## Team Communication

### Daily Standup Topics
1. Which components are being analyzed/merged?
2. Any unique logic discovered?
3. Test status update
4. Blockers or concerns

### Review Checkpoints
- End of Week 1: Architecture review
- End of Week 2: Code review
- End of Week 3: Test review
- End of Week 4: Release review

## Post-Consolidation

Once consolidation is complete:
1. Tag release candidate v1.0-rc1
2. Begin community beta testing
3. Plan v2.0 feature roadmap
4. Submit to Obsidian Community Plugins

## Appendix: File Deletion List

Files to be removed after consolidation:
- `src/services/sync-engine.ts`
- `src/services/enhanced-sync-engine.ts`
- `src/services/optimized-sync-engine.ts`
- `src/services/sync-state-manager.ts`
- `src/services/granola-service.old.ts`

Files to be marked as canonical:
- `src/services/hardened-sync-engine.ts` → `src/services/sync-engine.ts`
- `src/services/enhanced-state-manager.ts` → `src/services/state-manager.ts`
- `src/services/enhanced-granola-service.ts` → `src/services/granola-service.ts`