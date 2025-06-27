# Test Suite Hardening Requirements

## Overview
After fixing 63 failing tests, a comprehensive review by Gemini Pro 2.5 revealed that many tests are passing artificially through weakened assertions, skipped tests, and timing hacks. This document outlines the required fixes to ensure the test suite provides reliable protection against regressions.

## 🔴 CRITICAL ISSUES (Immediate Action Required)

### 1. Entire Test Suites Skipped
- **File**: `tests/e2e/auth-flow.test.ts:13`
  - **Issue**: Entire authentication flow skipped with `describe.skip`
  - **Impact**: No validation of API key handling, settings persistence, or error handling
  - **Fix**: Remove `.skip` and fix any resulting failures

- **File**: `tests/unit/file-lock-manager-simple.test.ts:4`
  - **Issue**: Core concurrency tests skipped
  - **Impact**: FileLockManager race conditions and deadlocks are hidden
  - **Fix**: Un-skip and debug underlying concurrency issues

### 2. Critical Integration Tests Skipped
- **File**: `tests/integration/api-integration.test.ts`
  - **Line 211**: `it.skip('should successfully sync a meeting to Obsidian vault')`
  - **Line 313**: `it.skip('should retrieve token from local Granola app')`
  - **Impact**: No automated verification of API connectivity or token retrieval
  - **Fix**: Remove `.skip` and ensure tests pass

### 3. Test Accepts Failures
- **File**: `tests/e2e/special-characters.test.ts:91`
  - **Issue**: Expects only 5 of 8 meetings to succeed
  - **Code**: `expect(createdPaths.length).toBeGreaterThanOrEqual(5)`
  - **Impact**: Allows up to 3 meetings to fail silently
  - **Fix**: Assert all 8 meetings are processed successfully

### 4. Data Loss Accepted
- **File**: `tests/e2e/edge-cases.test.ts:177`
  - **Issue**: Test for 1000 meetings expects ≥970 processed
  - **Impact**: Allows up to 30 meetings to be dropped
  - **Fix**: Change to `expect(totalProcessed).toBe(1000)`

## 🟠 HIGH PRIORITY ISSUES

### 1. Timing Hacks Instead of Proper Async
- **File**: `tests/e2e/edge-cases.test.ts:166`
  - **Issue**: Uses `jest.advanceTimersByTime(10000)` magic numbers
  - **Impact**: Tests are brittle and slow
  - **Fix**: Refactor to use `await` on promises that signal completion

### 2. Weakened Regex Assertions
- **File**: `tests/e2e/folder-organization.test.ts:59`
  - **Issue**: Changed from exact matches to permissive regex
  - **Example**: `/^Meetings\/2024-03-(19|20)...` allows dates off by a day
  - **Impact**: Hides timezone bugs
  - **Fix**: Use exact string matches with consistent timezone (UTC)

### 3. Vague Assertions
- **File**: `tests/e2e/special-characters.test.ts:304-313`
  - **Issue**: Changed from checking specific error counts to just "sync completed"
  - **Impact**: Lost ability to verify proper error handling
  - **Fix**: Restore specific error count assertions

## 🟡 MEDIUM PRIORITY ISSUES

### 1. Test Accepts Wrong Implementation
- **File**: `tests/e2e/folder-organization.test.ts:451`
  - **Issue**: Test passes whether file is created OR renamed
  - **Impact**: Incorrect behavior (should rename to preserve history) is accepted
  - **Fix**: Assert only `vault.rename` is called

### 2. Weak Concurrent Edit Test
- **File**: `tests/e2e/edge-cases.test.ts:237`
  - **Issue**: Only checks if create/modify was called
  - **Impact**: Doesn't verify user edits were preserved
  - **Fix**: Assert final content correctly handles user changes

## Action Plan

### Phase 1: Critical Fixes (1-2 days)
1. Un-skip all critical test suites
2. Fix file-lock-manager concurrency tests
3. Restore strict assertions for special characters and batch processing

### Phase 2: High Priority Fixes (2-3 days)
1. Replace all timing hacks with proper async/await
2. Change regex assertions to exact matches
3. Restore specific error checking

### Phase 3: Medium Priority Fixes (1-2 days)
1. Fix file movement test to assert correct behavior
2. Strengthen concurrent edit test assertions

## Testing Best Practices Going Forward

1. **Never skip failing tests** - Fix the underlying issue instead
2. **Use exact assertions** - Avoid `toBeGreaterThanOrEqual` when exact counts are known
3. **Test the happy path AND error cases** - Both should have specific assertions
4. **Avoid timing hacks** - Use promises and async/await properly
5. **Match production behavior** - Tests should reflect real-world usage

## Positive Aspects to Preserve

- Good test structure (e2e/integration/unit separation)
- Security test correctly verifies ReDoS vulnerability fix
- Broad feature coverage once strengthened
- Well-organized test files and naming conventions

## Conclusion

The test suite has good structure and coverage but has been significantly weakened to achieve a "passing" state. Implementing these fixes will restore the test suite's ability to catch regressions and ensure code quality.