# E2E Test Guide

## Overview

This guide documents the E2E testing infrastructure for the Obsidian Granola Sync plugin. Our E2E tests use WebdriverIO with a custom Obsidian service to test the plugin in a real Obsidian environment.

## Test Architecture

### Directory Structure
```
test/
├── e2e/                    # E2E test specs
│   ├── *.spec.ts          # Test files (use .spec.ts extension)
│   ├── helpers/           # Test utilities and helpers
│   └── setup/             # Test environment setup
├── test-vault/            # Test Obsidian vault
│   ├── .obsidian/         # Obsidian configuration
│   └── README.md          # Vault documentation
└── E2E_TEST_GUIDE.md      # This file
```

### Key Principles

1. **Environment Parity**: Tests must work identically in local and CI environments
2. **Test Isolation**: Each test should be independent and not affect others
3. **Clean State**: Tests should clean up after themselves
4. **Explicit Setup**: All test requirements should be explicitly defined

## Common Issues and Solutions

### Issue: "Vault doesn't exist" in CI

**Problem**: Tests work locally but fail in CI with "Vault doesn't exist" error.

**Root Cause**: Git doesn't track empty directories. The test vault directory exists locally but not in CI after checkout.

**Solution**: 
1. We've added `.gitkeep` files to ensure directories are tracked
2. We've added test environment validation that creates missing directories
3. The `onPrepare` hook in `wdio.conf.mts` ensures the environment is ready

### Issue: Test Runner Conflicts

**Problem**: Jest tries to run E2E tests and fails on WebdriverIO imports.

**Root Cause**: Overlapping test patterns between Jest and WebdriverIO.

**Solution**: 
- Jest config: Only matches `**/tests/**/*.test.ts`
- WebdriverIO: Only matches `**/test/e2e/**/*.spec.ts`
- Different file extensions prevent conflicts

## Running Tests

### Local Development
```bash
# Run all E2E tests
npm run test:e2e

# Run specific test file
npm run test:e2e -- --spec test/e2e/daily-note-backlink.spec.ts

# Run with debugging
npm run test:e2e -- --logLevel=debug
```

### CI Environment
Tests run automatically on push via GitHub Actions. The CI workflow:
1. Sets up Node.js environment
2. Installs dependencies
3. Runs unit tests (Jest)
4. Runs E2E tests (WebdriverIO)
5. Uploads test results

## Writing New Tests

### Test Structure
```typescript
describe('Feature Name', () => {
    beforeEach(async () => {
        // Clear test data
        await TestUtils.clearTestData();
        // Setup test environment
        await TestUtils.setupPlugin({
            // plugin settings
        });
    });

    afterEach(async () => {
        // Clean up test data
        await TestUtils.cleanupTestFiles();
    });

    it('should do something specific', async () => {
        // Arrange
        const testData = createTestMeeting();
        
        // Act
        await performAction(testData);
        
        // Assert
        const result = await getResult();
        expect(result).toBe(expected);
    });
});
```

### Best Practices

1. **Use Page Objects**: Encapsulate UI interactions in page objects
2. **Wait for Elements**: Always wait for elements before interacting
3. **Clear Test Data**: Always clear data before and after tests
4. **Meaningful Names**: Use descriptive test and function names
5. **Avoid Hard Waits**: Use explicit waits instead of sleep()

## Debugging Tests

### Local Debugging
1. Add `browser.debug()` to pause execution
2. Use `--logLevel=debug` for verbose output
3. Check screenshots in test results
4. Use Chrome DevTools when paused

### CI Debugging
1. Check GitHub Actions logs
2. Download artifacts for screenshots
3. Run tests locally with same Node version
4. Check for environment differences

## Test Environment Setup

The test environment is automatically validated and set up by:
1. `ensure-test-environment.ts` - Creates required directories
2. `wdio.conf.mts` - Runs validation before tests
3. Git-tracked fixture files - Ensure consistent state

## Maintenance

### Regular Tasks
1. Update Obsidian test version quarterly
2. Review and remove obsolete tests
3. Monitor test execution time
4. Update WebdriverIO dependencies

### Adding New Test Fixtures
1. Add files to `test/test-vault/`
2. Ensure they're tracked by Git
3. Document their purpose
4. Clean them up in tests

## Troubleshooting Checklist

- [ ] Test vault directory exists?
- [ ] `.obsidian` config directory exists?
- [ ] All required files tracked by Git?
- [ ] Test uses correct file extension (.spec.ts)?
- [ ] WebdriverIO service configured correctly?
- [ ] Environment variables set in CI?
- [ ] Node version matches CI?
- [ ] Dependencies up to date?