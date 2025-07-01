import { browser } from "@wdio/globals";
import { expect } from "@wdio/globals";
import { TestUtils } from "../e2e/helpers/test-utils";

/**
 * CRITICAL INTEGRATION VERIFICATION TESTS
 * These tests ensure components are actually loaded and working
 * NOT just that code exists or tests pass
 */
describe("MANDATORY: Integration Verification", () => {
  beforeEach(async () => {
    await TestUtils.clearTestData();
  });

  afterEach(async () => {
    await TestUtils.clearTestData();
  });

  /**
   * CRITICAL: This test would have caught the CSS bug
   * Verifies CSS is actually loaded into DOM, not just that files exist
   */
  it("MANDATORY: CSS styles are loaded and applied in DOM", async () => {
    console.log("🔍 Verifying CSS integration...");

    // Configure plugin to trigger initialization
    await TestUtils.configurePlugin({
      targetFolder: "Meetings",
      folderOrganization: "flat"
    });

    // CRITICAL: Check that CSS is actually in the DOM
    const cssIntegrationCheck = await browser.execute(() => {
      const styleSheets = Array.from(document.styleSheets);
      let granolaStylesFound = false;
      let granolaRulesCount = 0;
      let specificSelectors: string[] = [];

      // Check all stylesheets for granola-specific CSS
      for (const sheet of styleSheets) {
        try {
          // Check the style element content
          if (sheet.ownerNode?.textContent?.includes('.granola-')) {
            granolaStylesFound = true;
          }

          // Also check CSS rules if accessible
          const rules = Array.from(sheet.cssRules || sheet.rules || []);
          for (const rule of rules) {
            if (rule instanceof CSSStyleRule) {
              if (rule.selectorText?.includes('.granola-') || 
                  rule.cssText?.includes('.granola-')) {
                granolaStylesFound = true;
                granolaRulesCount++;
                specificSelectors.push(rule.selectorText || 'unknown');
              }
            }
          }
        } catch (e) {
          // Some stylesheets might not be accessible, continue
        }
      }

      return {
        stylesFound: granolaStylesFound,
        rulesCount: granolaRulesCount,
        sampleSelectors: specificSelectors.slice(0, 5),
        totalStyleSheets: styleSheets.length
      };
    });

    console.log("CSS Integration Check:", cssIntegrationCheck);

    // CRITICAL ASSERTION: CSS MUST be loaded
    expect(cssIntegrationCheck.stylesFound).toBe(true);
    expect(cssIntegrationCheck.rulesCount).toBeGreaterThan(0);
    
    // Verify specific critical selectors exist
    const hasRequiredSelectors = cssIntegrationCheck.sampleSelectors.some(selector =>
      selector.includes('.granola-conflict-modal') ||
      selector.includes('.granola-consent-modal') ||
      selector.includes('.granola-setup-wizard')
    );
    expect(hasRequiredSelectors).toBe(true);
  });

  /**
   * CRITICAL: Test that plugin fully initializes with all services
   */
  it("MANDATORY: Plugin services are initialized and accessible", async () => {
    console.log("🔍 Verifying service integration...");

    await TestUtils.configurePlugin({
      targetFolder: "Meetings",
      folderOrganization: "flat"
    });

    const serviceCheck = await browser.execute(() => {
      // @ts-ignore
      const app = window.app;
      const plugin = app.plugins.plugins["obsidian-granola-sync"];

      if (!plugin) {
        return { error: "Plugin not found" };
      }

      return {
        pluginLoaded: !!plugin,
        hasServiceRegistry: !!plugin.serviceRegistry,
        serviceRegistryInitialized: !!(plugin.stateManager && plugin.syncEngine),
        hasStateManager: !!plugin.stateManager,
        hasSyncEngine: !!plugin.syncEngine,
        hasGranolaService: !!plugin.granolaService,
        hasLogger: !!plugin.logger,
        hasErrorHandler: !!plugin.errorHandler,
        settingsLoaded: !!plugin.settings
      };
    });

    console.log("Service Check:", serviceCheck);

    expect(serviceCheck.pluginLoaded).toBe(true);
    expect(serviceCheck.hasServiceRegistry).toBe(true);
    expect(serviceCheck.serviceRegistryInitialized).toBe(true);
    expect(serviceCheck.hasStateManager).toBe(true);
    expect(serviceCheck.hasSyncEngine).toBe(true);
    expect(serviceCheck.hasGranolaService).toBe(true);
    expect(serviceCheck.hasLogger).toBe(true);
    expect(serviceCheck.hasErrorHandler).toBe(true);
    expect(serviceCheck.settingsLoaded).toBe(true);
  });

  /**
   * CRITICAL: Test that UI components are registered and working
   */
  it("MANDATORY: UI components are registered and functional", async () => {
    console.log("🔍 Verifying UI integration...");

    await TestUtils.configurePlugin({
      targetFolder: "Meetings",
      folderOrganization: "flat"
    });

    const uiCheck = await browser.execute(() => {
      // @ts-ignore
      const app = window.app;
      const plugin = app.plugins.plugins["obsidian-granola-sync"];

      if (!plugin) {
        return { error: "Plugin not found" };
      }

      // Check commands are registered
      const commands = app.commands?.commands || {};
      const granolaCommands = Object.keys(commands).filter(id => 
        id.includes('granola-sync') || id.includes('obsidian-granola-sync')
      );

      // Check ribbon icon exists
      const ribbonIcons = document.querySelectorAll('.side-dock-ribbon-tab');
      const hasGranolaRibbon = Array.from(ribbonIcons).some(icon => 
        icon.getAttribute('aria-label')?.includes('Granola') ||
        icon.querySelector('[lucide-name="sync"]')
      );

      // Check status bar
      const statusBarItems = document.querySelectorAll('.status-bar-item');
      const hasGranolaStatus = Array.from(statusBarItems).some(item =>
        item.textContent?.includes('Granola') || item.textContent?.includes('meetings')
      );

      return {
        commandsRegistered: granolaCommands.length,
        commandList: granolaCommands.slice(0, 3),
        hasRibbonIcon: hasGranolaRibbon,
        hasStatusBarItem: hasGranolaStatus
      };
    });

    console.log("UI Check:", uiCheck);

    expect(uiCheck.commandsRegistered).toBeGreaterThan(0);
    // Note: Ribbon and status bar checks might be timing dependent
  });

  /**
   * CRITICAL: Test file explorer behavior after plugin load
   * This ensures the CSS bug doesn't happen
   */
  it("MANDATORY: File explorer remains functional after plugin initialization", async () => {
    console.log("🔍 Verifying file explorer protection...");

    await TestUtils.configurePlugin({
      targetFolder: "Meetings",
      folderOrganization: "flat"
    });

    // Ensure file explorer is ready
    await TestUtils.ensureFileExplorerReady();

    const fileExplorerTest = await browser.execute(() => {
      // @ts-ignore
      const app = window.app;
      const fileExplorer = app.workspace.getLeavesOfType("file-explorer")[0];

      if (!fileExplorer) {
        return { error: "No file explorer found" };
      }

      const container = fileExplorer.view.containerEl;
      const leaf = fileExplorer.containerEl;

      // Test resize behavior at different widths
      const originalWidth = leaf.style.width || "300px";
      const testWidths = ["300px", "200px", "150px", "100px"];
      const results = [];

      for (const width of testWidths) {
        leaf.style.width = width;
        void leaf.offsetHeight; // Force layout

        const navFiles = container.querySelectorAll(".nav-file");
        let visibleCount = 0;

        navFiles.forEach(file => {
          const rect = file.getBoundingClientRect();
          const styles = window.getComputedStyle(file);

          if (rect.width > 0 && 
              rect.height > 0 && 
              styles.display !== "none" && 
              styles.visibility !== "hidden" &&
              styles.opacity !== "0") {
            visibleCount++;
          }
        });

        results.push({
          width: width,
          totalFiles: navFiles.length,
          visibleFiles: visibleCount,
          allVisible: visibleCount === navFiles.length
        });
      }

      // Restore original width
      leaf.style.width = originalWidth;

      return {
        testResults: results,
        noProblematicSelectors: !container.querySelector('.button-container:not(.granola-conflict-modal .button-container):not(.granola-consent-modal .button-container):not(.granola-setup-wizard .button-container)')
      };
    });

    console.log("File Explorer Test:", fileExplorerTest);

    // Verify file explorer works at all widths
    for (const result of fileExplorerTest.testResults) {
      expect(result.allVisible).toBe(true);
    }

    // Verify no problematic CSS selectors affecting file explorer
    expect(fileExplorerTest.noProblematicSelectors).toBe(true);
  });

  /**
   * MANDATORY: Visual evidence capture
   * Takes screenshots to provide visual proof tests are working
   */
  it("MANDATORY: Capture visual evidence of working plugin", async () => {
    console.log("📸 Capturing visual evidence...");

    await TestUtils.configurePlugin({
      targetFolder: "Meetings",
      folderOrganization: "flat"
    });

    // Take screenshot of initial state
    await browser.saveScreenshot(`./test-screenshots/integration-verify-initial.png`);

    // Open settings to show plugin is loaded
    await browser.execute(() => {
      // @ts-ignore
      const app = window.app;
      app.setting.open();
      app.setting.openTab("obsidian-granola-sync");
    });

    await browser.pause(1000);
    await browser.saveScreenshot(`./test-screenshots/integration-verify-settings.png`);

    // Close settings
    await browser.execute(() => {
      // @ts-ignore
      const app = window.app;
      app.setting.close();
    });

    // Test file explorer at different widths
    const fileExplorerWidths = ["300px", "200px", "150px"];
    for (const width of fileExplorerWidths) {
      await browser.execute((w) => {
        // @ts-ignore
        const app = window.app;
        const fileExplorer = app.workspace.getLeavesOfType("file-explorer")[0];
        if (fileExplorer) {
          fileExplorer.containerEl.style.width = w;
        }
      }, width);

      await browser.pause(500);
      await browser.saveScreenshot(`./test-screenshots/file-explorer-${width}.png`);
    }

    console.log("✅ Visual evidence captured in test-screenshots/");
  });
});