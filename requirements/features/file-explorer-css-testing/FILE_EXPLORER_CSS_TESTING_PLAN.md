# Plan: Enhanced File Explorer CSS Scoping Validation

## Objective
Create a comprehensive E2E test that verifies CSS scoping doesn't affect Obsidian's File Explorer by:
1. Adding test files/folders to create a realistic file tree
2. Verifying File Explorer items display correctly (stacked, not wrapped)
3. Testing at multiple File Explorer widths to ensure responsive behavior

## Implementation Strategy

### 1. **Test Vault Structure Setup**
**Location**: `/test/test-vault/`
**Add organized test content:**
```
test-vault/
├── README.md (existing)
├── Projects/
│   ├── Project Alpha.md
│   ├── Project Beta.md
│   └── Archive/
│       ├── Old Project.md
│       └── Legacy Notes.md
├── Daily Notes/
│   ├── 2025-01-01.md
│   ├── 2025-01-02.md
│   └── 2025-01-03.md
├── Resources/
│   ├── Important Links.md
│   ├── Reference Material.md
│   └── Templates/
│       ├── Meeting Template.md
│       └── Project Template.md
└── Long Folder Name With Spaces/
    ├── Very Long File Name That Tests Wrapping Behavior.md
    ├── Another Long Name.md
    └── Short.md
```

### 2. **Enhanced Test Utility Functions**
**File**: `test/e2e/helpers/test-utils.ts`
**Add new methods:**

```typescript
// Create test vault structure
static async createTestVaultStructure(): Promise<void>

// Get File Explorer layout metrics
static async getFileExplorerLayout(): Promise<{
  items: Array<{name: string, isWrapped: boolean, width: number, height: number}>,
  containerWidth: number,
  totalItems: number,
  wrappedItems: number
}>

// Test File Explorer at different widths
static async testFileExplorerAtWidths(widths: string[]): Promise<LayoutTestResult[]>
```

### 3. **New CSS Scoping Test**
**File**: `test/e2e/file-explorer-layout.spec.ts` (new file)
**Test Structure:**

```typescript
describe("File Explorer Layout Validation", () => {
  beforeEach(async () => {
    await TestUtils.clearTestData();
    await TestUtils.createTestVaultStructure();
    await TestUtils.ensureFileExplorerReady();
  });

  it("should display all files/folders in single column layout", async () => {
    // Test at default width (300px)
    const layout = await TestUtils.getFileExplorerLayout();
    
    // Verify no items are wrapped
    expect(layout.wrappedItems).toBe(0);
    expect(layout.items.every(item => !item.isWrapped)).toBe(true);
  });

  it("should maintain proper layout at narrow widths", async () => {
    const testWidths = ["250px", "200px", "150px"];
    
    for (const width of testWidths) {
      const results = await TestUtils.testFileExplorerAtWidths([width]);
      
      // Even at narrow widths, items should stack vertically
      expect(results[0].wrappedItems).toBe(0);
      expect(results[0].allItemsVisible).toBe(true);
    }
  });

  it("should handle long file names without wrapping", async () => {
    // Focus on the "Long Folder Name With Spaces" folder
    const longNameItems = await browser.execute(() => {
      const fileExplorer = app.workspace.getLeavesOfType("file-explorer")[0];
      const navFiles = fileExplorer.view.containerEl.querySelectorAll('.nav-file');
      
      return Array.from(navFiles)
        .filter(el => el.textContent?.includes('Long'))
        .map(el => ({
          text: el.textContent,
          rect: el.getBoundingClientRect(),
          styles: window.getComputedStyle(el)
        }));
    });
    
    // Verify long names are handled properly (truncated or scrolled, not wrapped)
    longNameItems.forEach(item => {
      expect(item.styles.whiteSpace).not.toBe('normal'); // Should be nowrap or pre
    });
  });
});
```

### 4. **Layout Detection Logic**
**Core Algorithm:**
```typescript
// Detect if File Explorer items are wrapping
const detectWrapping = () => {
  const container = fileExplorer.view.containerEl;
  const items = container.querySelectorAll('.nav-file, .nav-folder');
  
  let previousBottom = -1;
  const wrappedItems = [];
  
  items.forEach((item, index) => {
    const rect = item.getBoundingClientRect();
    
    if (index > 0 && rect.top <= previousBottom + 5) {
      // Item is on same line as previous = wrapped
      wrappedItems.push({
        index,
        name: item.textContent,
        position: { top: rect.top, left: rect.left }
      });
    }
    
    previousBottom = rect.bottom;
  });
  
  return {
    totalItems: items.length,
    wrappedItems: wrappedItems.length,
    wrappedDetails: wrappedItems
  };
};
```

### 5. **Enhanced CSS Verification**
**Update existing CSS test to include File Explorer validation:**

```typescript
it("should not affect File Explorer layout with realistic content", async () => {
  // Create full test vault structure
  await TestUtils.createTestVaultStructure();
  
  // Test CSS analysis (existing)
  const cssAnalysis = await browser.execute(() => { ... });
  
  // NEW: Test File Explorer layout
  const layoutResults = await TestUtils.testFileExplorerAtWidths([
    "300px", "250px", "200px", "150px"
  ]);
  
  // Verify no wrapping at any width
  layoutResults.forEach((result, index) => {
    expect(result.wrappedItems).toBe(0);
    expect(result.allItemsVisible).toBe(true);
  });
  
  // Take screenshot evidence
  await browser.saveScreenshot(`./test-screenshots/file-explorer-layout-validation.png`);
});
```

### 6. **Visual Evidence Collection**
**Screenshot Strategy:**
- Before/after File Explorer layout
- Different widths showing proper stacking
- Long filename handling
- Nested folder structure display

## Files to Create/Modify

### New Files:
1. **Test vault structure** (15+ files in organized folders)
2. **`test/e2e/file-explorer-layout.spec.ts`** - Dedicated layout test
3. **Test screenshots directory structure**

### Modified Files:
1. **`test/e2e/helpers/test-utils.ts`** - Add vault creation and layout detection utilities
2. **`test/e2e/css-scoping-fix.spec.ts`** - Enhance with File Explorer layout validation

## Success Criteria

✅ **File Explorer displays correctly** at all tested widths
✅ **No item wrapping** occurs (all items in single column)
✅ **Long filenames handled** properly (truncated/scrolled, not wrapped)  
✅ **Nested folders expand/collapse** correctly
✅ **Visual evidence captured** showing proper layout
✅ **Test runs reliably** without WebDriver issues

## Benefits

- **Comprehensive CSS validation** with realistic file structure
- **Responsive layout testing** across multiple widths
- **Real-world scenario** testing with diverse file/folder names
- **Visual proof** that plugin CSS doesn't interfere with Obsidian UI
- **Regression prevention** for future CSS changes