import { browser } from "@wdio/globals";
import { expect } from "@wdio/globals";
import { TestUtils } from "./helpers/test-utils";

describe("CSS Scoping Fix Verification", () => {
  beforeEach(async () => {
    // Configure plugin to skip wizard
    await TestUtils.configurePlugin({
      targetFolder: "Meetings",
      folderOrganization: "flat"
    });
  });

  it("should have properly scoped CSS selectors that don't affect file explorer", async () => {
    console.log("Verifying CSS scoping fixes...");

    // Check for problematic CSS rules in stylesheets - ONLY from plugin
    const cssAnalysis = await browser.execute(() => {
      const styleSheets = Array.from(document.styleSheets);
      const problematicSelectors: string[] = [];
      const properlyScoped: string[] = [];
      
      styleSheets.forEach(sheet => {
        try {
          // ONLY check stylesheets that contain granola-specific CSS
          const sheetContent = sheet.ownerNode?.textContent || '';
          const isPluginStylesheet = sheetContent.includes('.granola-') || 
                                    sheetContent.includes('granola-sync-plugin');
          
          if (!isPluginStylesheet) {
            return; // Skip Obsidian core stylesheets
          }
          
          const rules = Array.from(sheet.cssRules || sheet.rules || []);
          rules.forEach(rule => {
            if (rule instanceof CSSStyleRule) {
              const selector = rule.selectorText;
              
              // Check for problematic generic selectors ONLY in plugin stylesheets
              if (selector) {
                if (selector === ".button-container" || 
                    selector === ".notice" ||
                    (selector.includes(".button-container") && !selector.includes("granola"))) {
                  problematicSelectors.push(selector);
                }
                
                // Check for properly scoped selectors
                if (selector.includes(".granola-sync-plugin") ||
                    selector.includes(".granola-conflict-modal") ||
                    selector.includes(".granola-consent-modal") ||
                    selector.includes(".granola-setup-wizard")) {
                  properlyScoped.push(selector);
                }
              }
            }
          });
        } catch (e) {
          // Some stylesheets might not be accessible
        }
      });
      
      return {
        problematicSelectors,
        properlyScoped,
        totalStyleSheets: styleSheets.length
      };
    });

    console.log("CSS Analysis:", cssAnalysis);

    // Verify no problematic selectors exist
    expect(cssAnalysis.problematicSelectors).toHaveLength(0);
    
    // Verify we have properly scoped selectors
    expect(cssAnalysis.properlyScoped.length).toBeGreaterThan(0);
    
    // Open a modal to verify the granola-sync-plugin class is applied
    await browser.execute(() => {
      // @ts-ignore
      const app = window.app;
      const plugin = app.plugins.plugins["obsidian-granola-sync"];
      
      // Create a test modal
      const { Modal } = require("obsidian");
      class TestModal extends Modal {
        onOpen() {
          const { contentEl } = this;
          contentEl.empty();
          contentEl.addClass("granola-sync-plugin");
          contentEl.addClass("granola-test-modal");
          contentEl.createEl("h2", { text: "Test Modal" });
          
          // Add button container to test scoping
          const buttonContainer = contentEl.createDiv("button-container");
          buttonContainer.createEl("button", { text: "Test Button" });
        }
      }
      
      const modal = new TestModal(app);
      modal.open();
      
      // Store modal reference for testing
      // @ts-ignore
      window.testModal = modal;
    });

    // Wait for modal to render
    await browser.pause(500);

    // Verify modal has correct classes
    const modalCheck = await browser.execute(() => {
      const modal = document.querySelector(".modal-container .granola-sync-plugin");
      const buttonContainer = modal?.querySelector(".button-container");
      
      return {
        modalHasPluginClass: !!modal,
        buttonContainerExists: !!buttonContainer,
        modalClasses: modal?.className || "",
        computedStyles: buttonContainer ? {
          display: window.getComputedStyle(buttonContainer).display,
          justifyContent: window.getComputedStyle(buttonContainer).justifyContent
        } : null
      };
    });

    console.log("Modal Check:", modalCheck);

    // Verify modal setup
    expect(modalCheck.modalHasPluginClass).toBe(true);
    expect(modalCheck.buttonContainerExists).toBe(true);
    
    // Verify button container styles are applied
    if (modalCheck.computedStyles) {
      expect(modalCheck.computedStyles.display).toBe("flex");
      expect(modalCheck.computedStyles.justifyContent).toBe("flex-end");
    }

    // Close the test modal
    await browser.execute(() => {
      // @ts-ignore
      if (window.testModal) {
        // @ts-ignore
        window.testModal.close();
      }
    });

    // Final check: Ensure file explorer is not affected
    const fileExplorerCheck = await browser.execute(() => {
      // @ts-ignore
      const app = window.app;
      const fileExplorer = app.workspace.getLeavesOfType("file-explorer")[0];
      
      if (!fileExplorer) {
        return { fileExplorerExists: false };
      }
      
      const container = fileExplorer.view.containerEl;
      const buttonContainers = container.querySelectorAll(".button-container");
      
      return {
        fileExplorerExists: true,
        buttonContainersInFileExplorer: buttonContainers.length,
        fileExplorerClasses: container.className
      };
    });

    console.log("File Explorer Check:", fileExplorerCheck);

    // File explorer should not have any button-container elements affected by our CSS
    expect(fileExplorerCheck.buttonContainersInFileExplorer).toBe(0);
  });

  it("should not affect File Explorer layout with realistic content", async () => {
    console.log("🔍 Testing File Explorer layout with realistic content...");
    
    // Create comprehensive test vault structure
    await TestUtils.createTestVaultStructure();
    
    // Ensure File Explorer is ready
    await TestUtils.ensureFileExplorerReady();
    
    // Test CSS analysis (existing validation)
    const cssAnalysis = await browser.execute(() => {
      const styleSheets = Array.from(document.styleSheets);
      let granolaStylesFound = false;
      let granolaRulesCount = 0;
      let specificSelectors: string[] = [];
      
      for (const sheet of styleSheets) {
        try {
          // Check if this stylesheet contains plugin CSS
          if (sheet.ownerNode?.textContent?.includes('.granola-')) {
            granolaStylesFound = true;
          }
          
          const rules = Array.from(sheet.cssRules || sheet.rules || []);
          for (const rule of rules) {
            if (rule instanceof CSSStyleRule) {
              if (rule.selectorText?.includes('.granola-') || rule.cssText?.includes('.granola-')) {
                granolaStylesFound = true;
                granolaRulesCount++;
                specificSelectors.push(rule.selectorText || 'unknown');
              }
            }
          }
        } catch (e) {
          // Some stylesheets might not be accessible
        }
      }
      
      return {
        stylesFound: granolaStylesFound,
        rulesCount: granolaRulesCount,
        sampleSelectors: specificSelectors.slice(0, 5),
        totalStyleSheets: styleSheets.length
      };
    });
    
    console.log('CSS Integration Check:', cssAnalysis);
    
    // Verify plugin CSS is loaded
    expect(cssAnalysis.stylesFound).toBe(true);
    expect(cssAnalysis.rulesCount).toBeGreaterThan(0);
    
    // NEW: Test File Explorer layout at multiple widths
    console.log("📐 Testing File Explorer layout at multiple widths...");
    
    const layoutResults = await TestUtils.testFileExplorerAtWidths([
      "300px", "250px", "200px", "150px"
    ]);
    
    console.log("📊 Layout Results:");
    layoutResults.forEach((result, index) => {
      console.log(`  Width ${result.width}: ${result.layout.totalItems} items, ${result.wrappedItems} wrapped, visible: ${result.allItemsVisible}`);
    });
    
    // Verify minimal wrapping at any width (File Explorer may have some elements)
    layoutResults.forEach((result, index) => {
      expect(result.wrappedItems).toBeLessThanOrEqual(2);
      expect(result.allItemsVisible).toBe(true);
      expect(result.layout.totalItems).toBeGreaterThan(0);
    });
    
    // Test long filename handling
    console.log("📝 Testing long filename handling...");
    const longNameItems = await TestUtils.getLongNameElements();
    
    console.log(`Found ${longNameItems.length} items with long names`);
    expect(longNameItems.length).toBeGreaterThan(0);
    
    // Verify long names are handled properly
    longNameItems.forEach((item, index) => {
      console.log(`  Item ${index + 1}: "${item.text}" - whiteSpace: ${item.styles.whiteSpace}`);
      // Either non-normal white-space OR proper overflow handling
      const hasProperOverflow = ['hidden', 'ellipsis', 'auto', 'scroll'].includes(item.styles.overflow) ||
                               ['ellipsis', 'clip'].includes(item.styles.textOverflow);
      const hasAppropriateTextHandling = item.styles.whiteSpace !== 'normal' || hasProperOverflow;
      expect(hasAppropriateTextHandling).toBe(true);
    });
    
    // Take comprehensive screenshot evidence
    await browser.saveScreenshot('./test-screenshots/file-explorer-layout-validation.png');
    
    console.log("✅ File Explorer layout validation completed successfully");
  });
});