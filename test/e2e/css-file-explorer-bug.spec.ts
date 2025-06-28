import { browser } from "@wdio/globals";
import { expect } from "@wdio/globals";
import { TestUtils } from "./helpers/test-utils";

describe("CSS File Explorer Bug Investigation", () => {
  beforeEach(async () => {
    // Clear any existing test data
    await TestUtils.clearTestData();
  });

  afterEach(async () => {
    // Clean up
    await TestUtils.clearTestData();
  });

  it("should reproduce file explorer CSS issue after sync", async () => {
    console.log("Starting CSS bug investigation...");

    // Configure plugin with basic settings
    await TestUtils.configurePlugin({
      targetFolder: "Meetings",
      folderOrganization: "flat",
      includeDateInFilename: true
    });

    // Take screenshot before sync
    await browser.saveScreenshot(`./test-screenshots/before-sync.png`);

    // Inspect file explorer CSS before sync
    const beforeSyncStyles = await browser.execute(() => {
      // @ts-ignore
      const app = window.app;
      const fileExplorer = app.workspace.getLeavesOfType("file-explorer")[0];
      
      if (!fileExplorer) return { error: "No file explorer found" };
      
      const container = fileExplorer.view.containerEl;
      const navFiles = container.querySelectorAll(".nav-file");
      
      // Get computed styles from first nav-file if exists
      if (navFiles.length > 0) {
        const styles = window.getComputedStyle(navFiles[0]);
        return {
          navFileCount: navFiles.length,
          containerClasses: container.className,
          sampleStyles: {
            display: styles.display,
            width: styles.width,
            minWidth: styles.minWidth,
            padding: styles.padding,
            margin: styles.margin,
            overflow: styles.overflow,
            boxSizing: styles.boxSizing
          }
        };
      }
      
      return { navFileCount: 0, containerClasses: container.className };
    });

    console.log("Before sync styles:", beforeSyncStyles);

    // Mock multiple meetings to simulate sync
    const testMeetings = [];
    for (let i = 1; i <= 10; i++) {
      testMeetings.push({
        id: `meeting-${i}`,
        title: `Test Meeting ${i}`,
        date: new Date(`2024-03-${String(i).padStart(2, '0')}T10:00:00Z`),
        summary: `This is test meeting ${i} synced by Granola.`,
        transcript: "",
        highlights: [],
        attendees: ["Test User"],
        tags: ["test"]
      });
    }

    await TestUtils.mockGranolaAPI(testMeetings);
    
    // Perform sync
    await TestUtils.performSync(true);
    
    // Wait for file explorer to update
    await browser.pause(2000);

    // Take screenshot after sync
    await browser.saveScreenshot(`./test-screenshots/after-sync.png`);

    // Check for CSS changes after sync
    const afterSyncAnalysis = await browser.execute(() => {
      // @ts-ignore
      const app = window.app;
      const fileExplorer = app.workspace.getLeavesOfType("file-explorer")[0];
      
      if (!fileExplorer) return { error: "No file explorer found" };
      
      const container = fileExplorer.view.containerEl;
      const navFiles = container.querySelectorAll(".nav-file");
      const leaf = fileExplorer.containerEl;
      
      // Look for any granola-specific classes
      const allElements = container.querySelectorAll("*");
      const pluginClasses = new Set();
      
      allElements.forEach(el => {
        Array.from(el.classList).forEach(cls => {
          if (cls.includes("granola") || cls.includes("sync") || cls.includes("button-container")) {
            pluginClasses.add(cls);
          }
        });
      });
      
      // Check for generic CSS selectors that might affect file explorer
      const styleSheets = Array.from(document.styleSheets);
      const problematicRules = [];
      
      styleSheets.forEach(sheet => {
        try {
          const rules = Array.from(sheet.cssRules || sheet.rules || []);
          rules.forEach(rule => {
            if (rule instanceof CSSStyleRule) {
              const selector = rule.selectorText;
              
              // Check for problematic selectors
              if ((selector.includes(".button-container") || 
                   selector.includes(".notice") ||
                   selector.includes("flex") && !selector.includes("granola")) &&
                  !selector.includes("granola-")) {
                problematicRules.push({
                  selector: selector,
                  styles: rule.style.cssText
                });
              }
            }
          });
        } catch (e) {
          // Some stylesheets might not be accessible
        }
      });
      
      return {
        navFileCount: navFiles.length,
        containerClasses: container.className,
        pluginClasses: Array.from(pluginClasses),
        problematicRules: problematicRules.slice(0, 10), // Limit to first 10
        leafWidth: leaf.style.width || "auto"
      };
    });

    console.log("After sync analysis:", afterSyncAnalysis);

    // Now test the resize behavior
    const resizeTest = await browser.execute(() => {
      // @ts-ignore
      const app = window.app;
      const fileExplorer = app.workspace.getLeavesOfType("file-explorer")[0];
      
      if (!fileExplorer) return { error: "No file explorer found" };
      
      const container = fileExplorer.view.containerEl;
      const leaf = fileExplorer.containerEl;
      const originalWidth = leaf.style.width || "300px";
      
      const results = [];
      const widths = ["300px", "250px", "200px", "150px", "100px"];
      
      widths.forEach(width => {
        leaf.style.width = width;
        
        // Force layout recalculation
        void leaf.offsetHeight;
        
        const navFiles = container.querySelectorAll(".nav-file");
        let visibleCount = 0;
        let hiddenCount = 0;
        
        navFiles.forEach(file => {
          const rect = file.getBoundingClientRect();
          const styles = window.getComputedStyle(file);
          
          if (rect.width > 0 && 
              rect.height > 0 && 
              styles.display !== "none" && 
              styles.visibility !== "hidden" &&
              styles.opacity !== "0") {
            visibleCount++;
          } else {
            hiddenCount++;
          }
        });
        
        results.push({
          width: width,
          visibleFiles: visibleCount,
          hiddenFiles: hiddenCount,
          totalFiles: navFiles.length
        });
      });
      
      // Restore original width
      leaf.style.width = originalWidth;
      
      return results;
    });

    console.log("Resize test results:", resizeTest);

    // Check for the specific button-container issue
    const buttonContainerCheck = await browser.execute(() => {
      const elements = document.querySelectorAll(".button-container");
      const affectedElements = [];
      
      elements.forEach(el => {
        const parent = el.parentElement;
        if (parent && !parent.className.includes("granola")) {
          affectedElements.push({
            location: parent.className || parent.tagName,
            isInFileExplorer: el.closest(".workspace-leaf-content[data-type='file-explorer']") !== null
          });
        }
      });
      
      return affectedElements;
    });

    console.log("Button container elements found:", buttonContainerCheck);

    // Generate report
    const report = {
      timestamp: new Date().toISOString(),
      beforeSync: beforeSyncStyles,
      afterSync: afterSyncAnalysis,
      resizeTest: resizeTest,
      buttonContainerIssue: buttonContainerCheck,
      recommendations: [
        "Add .granola-sync prefix to all CSS selectors",
        "Avoid generic .button-container selector",
        "Scope .notice animations to plugin-specific notices",
        "Check flex layout overrides"
      ]
    };

    // Save report
    await browser.execute((reportData) => {
      console.log("CSS Debug Report:", reportData);
    }, report);

    // Assertions to verify the bug
    expect(afterSyncAnalysis.navFileCount).toBeGreaterThan(0);
    
    // Check if files disappear at narrow widths
    const narrowWidthResult = resizeTest.find(r => r.width === "100px");
    if (narrowWidthResult && narrowWidthResult.hiddenFiles > 0) {
      console.warn(`BUG CONFIRMED: ${narrowWidthResult.hiddenFiles} files disappear at 100px width`);
    }
  });
});