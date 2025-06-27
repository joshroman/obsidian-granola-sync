# Granola Sync Plugin Testing

This directory contains automated tests for the Obsidian Granola Sync plugin using WDIO-Obsidian-Service.

## Test Structure

- `e2e/` - End-to-end tests that run against a real Obsidian instance
  - `sync-functionality.spec.ts` - Core sync features and file organization
  - `setup-wizard.spec.ts` - Setup wizard UI and settings
  - `date-organization-bug.spec.ts` - Specific tests for date-related bugs
  - `helpers/test-utils.ts` - Common test utilities
- `unit/` - Unit tests for individual components (uses Jest)
- `fixtures/` - Test data and mock responses

## Running Tests

### Unit Tests
```bash
npm run test:unit           # Run all unit tests
npm run test:unit:watch     # Run in watch mode
npm run test:unit:coverage  # Generate coverage report
```

### E2E Tests
```bash
npm run test:e2e           # Run all E2E tests
npm run test:e2e:watch     # Run in watch mode

# Test against specific Obsidian versions
OBSIDIAN_VERSIONS=latest,1.5.3 npm run test:e2e

# Run tests in parallel
WDIO_MAX_INSTANCES=3 npm run test:e2e
```

### All Tests
```bash
npm test  # Runs both unit and E2E tests
```

## Key Test Scenarios

### Date-based Organization
- Tests that date subfolders are created correctly
- Verifies timezone handling (uses UTC consistently)
- Checks weekly folder organization
- Validates custom date formats

### File Naming
- Tests date prefix inclusion/exclusion
- Verifies unique suffix generation when date is disabled
- Tests all supported date formats

### Setup Wizard
- Tests navigation through wizard steps
- Verifies disabled mirror-granola option
- Checks settings persistence
- Tests preview updates

### Sync Operations
- Tests initial full sync
- Verifies incremental sync
- Tests duplicate prevention
- Checks error recovery

## Writing New Tests

### E2E Test Example
```typescript
import { TestUtils } from "./helpers/test-utils";

describe("My Feature", () => {
  beforeEach(async () => {
    await TestUtils.clearTestData();
  });

  it("should do something", async () => {
    // Configure plugin
    await TestUtils.configurePlugin({
      targetFolder: "Meetings",
      folderOrganization: "by-date"
    });

    // Mock API response
    await TestUtils.mockGranolaAPI([{
      id: "test-1",
      title: "Test Meeting",
      date: new Date(),
      summary: "Test content"
    }]);

    // Perform sync
    await TestUtils.performSync();

    // Verify results
    const exists = await TestUtils.fileExists("Meetings/2024-03-20/Test Meeting.md");
    expect(exists).toBeTruthy();
  });
});
```

## Debugging Tests

1. **View Obsidian Window**: Tests run in a real Obsidian instance. To see it:
   ```bash
   # Add to wdio.conf.mts capabilities:
   "goog:chromeOptions": {
     args: ["--headless=false"]
   }
   ```

2. **Console Logs**: Use `browser.execute()` to log from within Obsidian:
   ```typescript
   await browser.execute(() => {
     console.log("This logs in Obsidian's console");
   });
   ```

3. **Pause Execution**: Add `await browser.pause(5000)` to pause test execution

## CI/CD Integration

The tests are designed to run in CI environments. See `.github/workflows/test.yml` for the GitHub Actions configuration.

## Known Issues

1. **Date Organization**: Currently investigating issues with date-based subfolder creation
2. **Mirror Granola**: Option is disabled due to API limitations

## Resources

- [WDIO-Obsidian-Service Documentation](https://jesse-r-s-hines.github.io/wdio-obsidian-service/)
- [WebdriverIO Documentation](https://webdriver.io/)
- [Obsidian Plugin API](https://docs.obsidian.md/)