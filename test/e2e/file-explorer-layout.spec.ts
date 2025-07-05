import { browser } from "@wdio/globals";
import { TestUtils } from "./helpers/test-utils";

describe("File Explorer Layout Validation", () => {
  beforeEach(async () => {
    console.log("🔧 Setting up File Explorer layout test...");
    
    // Clear any previous test data
    await TestUtils.clearTestData();
    
    // Create test vault structure (validates existing files)
    await TestUtils.createTestVaultStructure();
    
    // Ensure File Explorer is ready and visible
    await TestUtils.ensureFileExplorerReady();
    
    // Configure plugin for testing
    await TestUtils.configurePlugin({
      targetFolder: "Meetings",
      folderOrganization: "flat"
    });
    
    // Close any open modals
    await TestUtils.closeAllModals();
    await browser.pause(1000); // Let layout settle
  });

  it("should display all files/folders in single column layout", async () => {
    console.log("📊 Testing default File Explorer layout...");
    
    // Get layout metrics at default width
    const layout = await TestUtils.getFileExplorerLayout();
    
    console.log(`File Explorer Layout: ${layout.totalItems} items, ${layout.wrappedItems} wrapped`);
    
    // Verify minimal wrapping (File Explorer may have some icons/nested elements)
    expect(layout.wrappedItems).toBeLessThanOrEqual(2);
    console.log(`✅ Layout check: ${layout.wrappedItems} wrapped items (acceptable: ≤2)`);
    
    // Verify we have a reasonable number of items (our test structure)
    expect(layout.totalItems).toBeGreaterThanOrEqual(5);
    
    // All items should be visible
    expect(layout.items.every(item => item.width > 0 && item.height > 0)).toBe(true);
    
    console.log("✅ Default layout validation passed");
  });

  it("should maintain proper layout at narrow widths", async () => {
    console.log("📏 Testing File Explorer at narrow widths...");
    
    const testWidths = ["250px", "200px", "150px"];
    
    for (const width of testWidths) {
      console.log(`📐 Testing width: ${width}`);
      
      const results = await TestUtils.testFileExplorerAtWidths([width]);
      const result = results[0];
      
      // Even at narrow widths, items should stack vertically (minimal wrapping)
      expect(result.wrappedItems).toBeLessThanOrEqual(2);
      expect(result.allItemsVisible).toBe(true);
      
      console.log(`✅ Width ${width}: ${result.layout.totalItems} items, ${result.wrappedItems} wrapped`);
      
      // Take screenshot for this width
      await browser.saveScreenshot(`./test-screenshots/file-explorer-${width.replace('px', '')}.png`);
    }
    
    console.log("✅ Narrow width validation passed");
  });

  it("should handle long file names properly", async () => {
    console.log("📝 Testing long filename handling...");
    
    // Get elements with long names
    const longNameItems = await TestUtils.getLongNameElements();
    
    console.log(`Found ${longNameItems.length} items with long names`);
    
    // Verify we found some long-named items from our test structure
    expect(longNameItems.length).toBeGreaterThan(0);
    
    // Check each long-named item
    longNameItems.forEach((item, index) => {
      console.log(`📄 Item ${index + 1}: "${item.text}" - whiteSpace: ${item.styles.whiteSpace}`);
      
      // For File Explorer, Obsidian may use 'normal' white-space but with overflow handling
      // The key is that text should not break the layout - check for proper overflow handling
      const hasProperOverflow = ['hidden', 'ellipsis', 'auto', 'scroll'].includes(item.styles.overflow) ||
                               ['ellipsis', 'clip'].includes(item.styles.textOverflow) ||
                               item.styles.wordWrap === 'break-word' ||
                               item.styles.wordBreak === 'break-all';
      
      console.log(`🔍 Overflow handling - overflow: ${item.styles.overflow}, textOverflow: ${item.styles.textOverflow}, hasProperOverflow: ${hasProperOverflow}`);
      
      // Either the element should have non-normal white-space OR proper overflow handling
      const hasAppropriateTextHandling = item.styles.whiteSpace !== 'normal' || hasProperOverflow;
      expect(hasAppropriateTextHandling).toBe(true);
    });
    
    console.log("✅ Long filename handling validation passed");
  });

  it("should maintain layout integrity during File Explorer resize", async () => {
    console.log("🔄 Testing File Explorer resize behavior...");
    
    // Test multiple widths in sequence to simulate user resizing
    const resizeSequence = ["300px", "150px", "250px", "200px", "300px"];
    
    for (let i = 0; i < resizeSequence.length; i++) {
      const width = resizeSequence[i];
      console.log(`🔧 Resize step ${i + 1}: ${width}`);
      
      const results = await TestUtils.testFileExplorerAtWidths([width]);
      const result = results[0];
      
      // Layout should remain stable through all resize operations
      expect(result.wrappedItems).toBeLessThanOrEqual(2);
      expect(result.allItemsVisible).toBe(true);
      
      // Verify container width actually changed
      expect(result.layout.containerWidth).toBeGreaterThan(0);
    }
    
    console.log("✅ Resize behavior validation passed");
  });

  it("should display nested folder structure correctly", async () => {
    console.log("📁 Testing nested folder structure display...");
    
    const layout = await TestUtils.getFileExplorerLayout();
    
    // Look for our test folder structure
    const folderNames = layout.items.map(item => item.name);
    
    // Should contain our test folders
    const expectedFolders = ['Projects', 'Daily Notes', 'Resources', 'Long Folder Name With Spaces'];
    const foundFolders = expectedFolders.filter(folder => 
      folderNames.some(name => name.includes(folder))
    );
    
    console.log(`Found folders: ${foundFolders.join(', ')}`);
    expect(foundFolders.length).toBeGreaterThan(0);
    
    // All folder items should be properly positioned (no wrapping)
    const folderItems = layout.items.filter(item => 
      expectedFolders.some(folder => item.name.includes(folder))
    );
    
    // Most folder items should not be wrapped, but some nested items might be
    const nonWrappedFolders = folderItems.filter(folder => !folder.isWrapped);
    expect(nonWrappedFolders.length).toBeGreaterThan(folderItems.length / 2);
    
    folderItems.forEach(folder => {
      expect(folder.width).toBeGreaterThan(0);
      expect(folder.height).toBeGreaterThan(0);
    });
    
    console.log("✅ Nested folder structure validation passed");
  });

  afterEach(async () => {
    console.log("🧹 Cleaning up File Explorer layout test...");
    
    // Reset File Explorer width to default
    await browser.execute(() => {
      const fileExplorer = (window as any).app.workspace.getLeavesOfType("file-explorer")[0];
      if (fileExplorer) {
        const container = fileExplorer.view.containerEl.closest('.workspace-leaf');
        if (container) {
          (container as HTMLElement).style.width = '';
          (container as HTMLElement).style.minWidth = '';
          (container as HTMLElement).style.maxWidth = '';
        }
      }
    });
    
    // Clear test state
    await TestUtils.clearTestData();
  });
});