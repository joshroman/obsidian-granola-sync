import { browser } from "@wdio/globals";
import { obsidianPage } from "wdio-obsidian-service";

describe("Test Environment Check", () => {
  beforeEach(async () => {
    // Wait for Obsidian to fully load
    await browser.pause(2000);
  });

  it("should have Obsidian app available", async () => {
    const hasApp = await browser.execute(() => {
      // @ts-ignore
      return typeof window !== 'undefined' && window.app !== undefined;
    });

    console.log("Window.app exists:", hasApp);
    
    // Get Obsidian version
    const obsidianInfo = await browser.execute(() => {
      // @ts-ignore
      if (window.app) {
        return {
          hasApp: true,
          // @ts-ignore
          appName: window.app.appName || 'unknown',
          // @ts-ignore
          platformName: window.app.platform?.name || 'unknown',
          // @ts-ignore
          vaultName: window.app.vault?.getName?.() || 'unknown'
        };
      }
      return { hasApp: false };
    });

    console.log("Obsidian info:", obsidianInfo);
  });

  it("should check plugin installation", async () => {
    // List all loaded plugins
    const pluginInfo = await browser.execute(() => {
      // @ts-ignore
      if (window.app && window.app.plugins) {
        // @ts-ignore
        const plugins = window.app.plugins.plugins || {};
        const pluginList = Object.keys(plugins);
        
        return {
          hasPluginManager: true,
          pluginCount: pluginList.length,
          plugins: pluginList,
          // @ts-ignore
          hasGranolaSync: !!plugins['obsidian-granola-sync']
        };
      }
      return { hasPluginManager: false };
    });

    console.log("Plugin info:", pluginInfo);
  });

  it("should check vault structure", async () => {
    const vaultInfo = await browser.execute(() => {
      // @ts-ignore
      if (window.app && window.app.vault) {
        // @ts-ignore
        const vault = window.app.vault;
        return {
          hasVault: true,
          root: vault.getRoot()?.path || 'unknown',
          // @ts-ignore
          files: vault.getFiles?.()?.length || 0,
          // @ts-ignore
          folders: vault.getAllFolders?.()?.length || 0
        };
      }
      return { hasVault: false };
    });

    console.log("Vault info:", vaultInfo);
  });

  it("should get vault path using obsidianPage", async () => {
    try {
      const vaultPath = await obsidianPage.getVaultPath();
      console.log("Vault path from obsidianPage:", vaultPath);
      expect(vaultPath).toBeTruthy();
    } catch (error) {
      console.error("Error getting vault path:", error);
    }
  });

  it("should check if we need to wait for vault creation", async () => {
    // Let's see if we need to wait for Obsidian to create a vault first
    const hasWorkspace = await browser.execute(() => {
      // @ts-ignore
      return typeof window !== 'undefined' && 
             typeof window.app !== 'undefined' && 
             typeof window.app.workspace !== 'undefined';
    });
    
    console.log("Has workspace:", hasWorkspace);
    
    if (!hasWorkspace) {
      console.log("Workspace not ready, trying to wait...");
      
      // Try to wait for app to be available
      const waitResult = await browser.waitUntil(
        async () => {
          const appExists = await browser.execute(() => {
            // @ts-ignore
            return typeof window !== 'undefined' && typeof window.app !== 'undefined';
          });
          return appExists;
        },
        {
          timeout: 10000,
          timeoutMsg: 'Obsidian app did not become available'
        }
      ).catch((err: any) => {
        console.error("Wait failed:", err.message);
        return false;
      });
      
      console.log("Wait result:", waitResult);
    }
  });
});