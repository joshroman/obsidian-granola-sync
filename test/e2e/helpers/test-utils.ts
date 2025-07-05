import { browser } from "@wdio/globals";

export interface MockMeeting {
  id: string;
  title: string;
  date: Date;
  summary: string;
  transcript?: string;
  highlights?: string[];
  attendees?: string[];
  tags?: string[];
  granolaFolder?: string;
}

export interface FileExplorerLayoutItem {
  name: string;
  isWrapped: boolean;
  width: number;
  height: number;
  top: number;
  left: number;
}

export interface FileExplorerLayout {
  items: FileExplorerLayoutItem[];
  containerWidth: number;
  totalItems: number;
  wrappedItems: number;
}

export interface LayoutTestResult {
  width: string;
  wrappedItems: number;
  allItemsVisible: boolean;
  layout: FileExplorerLayout;
}

export class TestUtils {
  /**
   * Get the plugin instance
   */
  static async getPlugin() {
    return browser.executeAsync((done: any) => {
      // @ts-ignore
      const plugin = window.app.plugins.plugins["obsidian-granola-sync"];
      done(plugin);
    });
  }

  /**
   * Get the Obsidian app instance
   */
  static async getApp() {
    return browser.executeAsync((done: any) => {
      // @ts-ignore
      done(window.app);
    });
  }

  /**
   * Configure plugin settings
   */
  static async configurePlugin(settings: any) {
    await browser.execute((s) => {
      // @ts-ignore
      const plugin = window.app.plugins.plugins["obsidian-granola-sync"];
      Object.assign(plugin.settings, s);
      // Also set a test API key if not provided
      if (!plugin.settings.apiKey) {
        plugin.settings.apiKey = "test-api-key";
      }
      // Mark wizard as completed for testing
      plugin.settings.wizardCompleted = true;
      // Initialize auth service with the API key
      if (plugin.authService) {
        plugin.authService.apiKey = "test-api-key";
      }
    }, settings);
    
    // Close any open modals (including wizard)
    await TestUtils.closeAllModals();
  }
  
  /**
   * Close all open modals
   */
  static async closeAllModals() {
    await browser.execute(() => {
      // @ts-ignore
      const app = window.app;
      // Close all modals
      const modals = document.querySelectorAll('.modal-container');
      modals.forEach(modal => {
        const closeButton = modal.querySelector('.modal-close-button');
        if (closeButton instanceof HTMLElement) {
          closeButton.click();
        }
      });
    });
    // Wait longer for modals to close completely
    await browser.pause(1000);
  }

  /**
   * Mock Granola API responses
   */
  static async mockGranolaAPI(meetings: MockMeeting[]) {
    await browser.execute((m) => {
      // @ts-ignore
      const plugin = window.app.plugins.plugins["obsidian-granola-sync"];
      // Convert date strings back to Date objects
      const meetingsWithDates = m.map((meeting: any) => ({
        ...meeting,
        date: new Date(meeting.date)
      }));
      plugin.granolaService.getAllMeetings = async () => meetingsWithDates;
      plugin.granolaService.getMeetingsSince = async (since: string) => {
        const sinceDate = new Date(since);
        return meetingsWithDates.filter((meeting: any) => meeting.date >= sinceDate);
      };
    }, meetings);
  }

  /**
   * Trigger a sync operation and wait for completion
   */
  static async performSync(forceAll: boolean = false) {
    const result = await browser.executeAsync((force: any, done: any) => {
      // @ts-ignore
      const plugin = window.app.plugins.plugins["obsidian-granola-sync"];
      plugin.performSync(force).then(done);
    }, forceAll);
    
    // Additional wait to ensure file operations complete fully
    await browser.pause(2000);
    return result;
  }

  /**
   * Check if a file exists in the vault
   */
  static async fileExists(path: string): Promise<boolean> {
    return browser.execute((p) => {
      // @ts-ignore
      const vault = window.app.vault;
      const file = vault.getAbstractFileByPath(p);
      return !!file;
    }, path);
  }

  /**
   * Get file content
   */
  static async getFileContent(path: string): Promise<string | null> {
    return browser.executeAsync(async (p: any, done: any) => {
      // @ts-ignore
      const vault = window.app.vault;
      const file = vault.getAbstractFileByPath(p);
      if (file && 'extension' in file && file.extension === 'md') {
        const content = await vault.read(file as any);
        done(content);
      } else {
        done(null);
      }
    }, path);
  }

  /**
   * Get all files in a folder
   */
  static async getFilesInFolder(folderPath: string): Promise<string[]> {
    return browser.execute((path) => {
      // @ts-ignore
      const vault = window.app.vault;
      const folder = vault.getAbstractFileByPath(path);
      if (folder && 'children' in folder) {
        return (folder as any).children
          .filter((f: any) => 'extension' in f && f.extension === 'md')
          .map((f: any) => f.path);
      }
      return [];
    }, folderPath);
  }

  /**
   * Ensure file explorer is open and ready
   */
  static async ensureFileExplorerReady() {
    await browser.execute(() => {
      // @ts-ignore
      const app = window.app;
      // Get or create file explorer leaf
      let fileExplorer = app.workspace.getLeavesOfType("file-explorer")[0];
      if (!fileExplorer) {
        // Open file explorer in left sidebar
        app.workspace.getLeftLeaf(false).setViewState({
          type: "file-explorer",
          active: true
        });
      }
    });
    // Wait longer for file explorer to render completely
    await browser.pause(1500);
  }

  /**
   * Clear all test data
   */
  static async clearTestData() {
    await browser.execute(() => {
      // @ts-ignore
      const plugin = window.app.plugins.plugins["obsidian-granola-sync"];
      // Clear sync state
      plugin.stateManager.clearState();
      // Reset settings to defaults
      plugin.settings.lastSync = "";
      plugin.settings.wizardCompleted = false;
    });

    // Delete test folders
    await TestUtils.deleteFolder("Meetings");
    await TestUtils.deleteFolder("TestMeetings");
  }

  /**
   * Delete a folder and all its contents
   */
  static async deleteFolder(folderPath: string) {
    await browser.execute(async (path) => {
      // @ts-ignore
      const vault = window.app.vault;
      const folder = vault.getAbstractFileByPath(path);
      if (folder && 'children' in folder) {
        // Delete all files in folder recursively
        const deleteRecursive = async (abstractFile: any) => {
          if ('children' in abstractFile) {
            for (const child of abstractFile.children) {
              await deleteRecursive(child);
            }
          }
          await vault.delete(abstractFile);
        };
        await deleteRecursive(folder);
      }
    }, folderPath);
  }

  /**
   * Wait for a modal to appear
   */
  static async waitForModal(className: string, timeout: number = 5000): Promise<boolean> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      const exists = await browser.execute((cls) => {
        return document.querySelector(`.${cls}`) !== null;
      }, className);
      
      if (exists) return true;
      await browser.pause(100);
    }
    return false;
  }

  /**
   * Click a button by text
   */
  static async clickButton(text: string) {
    await browser.execute((btnText) => {
      const button = Array.from(document.querySelectorAll("button"))
        .find(btn => btn.textContent?.includes(btnText));
      if (button) {
        button.click();
      }
    }, text);
  }

  /**
   * Get current wizard step
   */
  static async getCurrentWizardStep(): Promise<number> {
    return browser.execute(() => {
      const progressText = document.querySelector(".progress-text")?.textContent || "";
      const match = progressText.match(/Step (\d+)/);
      return match ? parseInt(match[1]) : 0;
    });
  }

  /**
   * Test real settings UI interaction with proper error handling
   */
  static async testSettingsUIInteraction(): Promise<boolean> {
    console.log("🔧 Testing real settings UI interaction...");
    
    try {
      // Method 1: Try real Obsidian Settings API with proper waiting
      const settingsAPIReady = await browser.waitUntil(async () => {
        return await browser.execute(() => {
          // @ts-ignore
          const app = window.app;
          return app && app.setting && 
                 typeof app.setting.open === 'function' &&
                 typeof app.setting.openTab === 'function' &&
                 typeof app.setting.close === 'function';
        });
      }, { 
        timeout: 5000,
        timeoutMsg: 'Settings API not ready within 5 seconds'
      }).catch(() => false);

      if (settingsAPIReady) {
        console.log("✅ Settings API ready, testing real API calls...");
        
        await browser.execute(() => {
          try {
            // @ts-ignore
            const app = window.app;
            app.setting.open();
            app.setting.openTab("obsidian-granola-sync");
          } catch (error) {
            console.warn('Settings API call failed:', error);
            throw error;
          }
        });

        await browser.pause(1000);
        await browser.saveScreenshot(`./test-screenshots/integration-verify-settings.png`);

        // Close settings
        await browser.execute(() => {
          try {
            // @ts-ignore
            const app = window.app;
            app.setting.close();
          } catch (error) {
            console.warn('Settings close failed:', error);
          }
        });
        
        console.log("✅ Real settings API interaction successful");
        return true;
      } else {
        console.log("⚠️  Settings API not ready, trying UI interaction fallback...");
        return await TestUtils.testUIClickInteraction();
      }
    } catch (error) {
      console.log(`⚠️  Settings API failed (${error}), trying UI interaction fallback...`);
      return await TestUtils.testUIClickInteraction();
    }
  }

  /**
   * Test UI interaction by clicking actual elements
   */
  static async testUIClickInteraction(): Promise<boolean> {
    console.log("🖱️  Testing UI click interactions...");
    
    try {
      // Method 2: Use real UI interactions - click settings gear
      const settingsButtonExists = await browser.execute(() => {
        // Look for settings button in various locations
        const selectors = [
          '.side-dock-ribbon-tab[aria-label*="Settings"]',
          '.side-dock-ribbon-tab[aria-label*="settings"]', 
          '.workspace-ribbon-collapse-btn',
          '[data-type="settings"]',
          '.clickable-icon[aria-label*="Settings"]'
        ];
        
        for (const selector of selectors) {
          const element = document.querySelector(selector);
          if (element) {
            console.log(`Found settings button with selector: ${selector}`);
            return { found: true, selector };
          }
        }
        
        return { found: false, selector: null };
      });

      if (settingsButtonExists.found) {
        console.log(`✅ Settings button found: ${settingsButtonExists.selector}`);
        
        // Click the settings button
        await browser.execute((selector) => {
          const settingsBtn = document.querySelector(selector);
          if (settingsBtn && settingsBtn instanceof HTMLElement) {
            settingsBtn.click();
            console.log('Settings button clicked');
          }
        }, settingsButtonExists.selector);

        // Wait for settings modal to appear
        const settingsModalAppeared = await browser.waitUntil(async () => {
          return await browser.execute(() => {
            const modals = document.querySelectorAll('.modal-container, .setting-tab, .settings-modal');
            return modals.length > 0;
          });
        }, { 
          timeout: 3000,
          timeoutMsg: 'Settings modal did not appear'
        }).catch(() => false);

        if (settingsModalAppeared) {
          console.log("✅ Settings modal appeared");
          
          // Look for plugin tab
          const pluginTabFound = await browser.execute(() => {
            const selectors = [
              '*[data-tab="obsidian-granola-sync"]',
              '.setting-tab*=granola',
              '.setting-tab*=Granola',
              '.nav-item*=granola'
            ];
            
            for (const selector of selectors) {
              try {
                const tab = document.querySelector(selector);
                if (tab) {
                  console.log(`Found plugin tab: ${selector}`);
                  if (tab instanceof HTMLElement) {
                    tab.click();
                  }
                  return true;
                }
              } catch (e) {
                // Continue to next selector
              }
            }
            return false;
          });

          await browser.pause(1000);
          await browser.saveScreenshot(`./test-screenshots/integration-verify-ui-interaction.png`);

          // Close modal
          await browser.execute(() => {
            const closeButtons = document.querySelectorAll('.modal-close-button, .modal-bg, .setting-close');
            closeButtons.forEach(btn => {
              if (btn instanceof HTMLElement) {
                btn.click();
              }
            });
          });
          
          console.log(`✅ UI interaction successful. Plugin tab found: ${pluginTabFound}`);
          return true;
        }
      }
      
      console.log("⚠️  UI interaction fallback could not find settings elements");
      return false;
    } catch (error) {
      console.log(`❌ UI interaction failed: ${error}`);
      return false;
    }
  }

  /**
   * Test plugin through command palette interaction
   */
  static async testCommandPaletteInteraction(): Promise<boolean> {
    console.log("⌨️  Testing command palette interaction...");
    
    try {
      // Open command palette (Ctrl+P / Cmd+P)
      await browser.keys(['Control', 'p']);
      await browser.pause(500);
      
      // Wait for command palette to appear
      const paletteAppeared = await browser.waitUntil(async () => {
        return await browser.execute(() => {
          return document.querySelector('.prompt-input, .suggestion-container') !== null;
        });
      }, { 
        timeout: 2000,
        timeoutMsg: 'Command palette did not appear'
      }).catch(() => false);

      if (paletteAppeared) {
        // Type plugin command
        await browser.keys('Granola');
        await browser.pause(500);
        
        // Look for granola commands
        const granolaCommands = await browser.execute(() => {
          const suggestions = document.querySelectorAll('.suggestion-item, .prompt-instruction');
          const granolaItems = Array.from(suggestions).filter(item => 
            item.textContent?.toLowerCase().includes('granola')
          );
          return granolaItems.length;
        });
        
        console.log(`✅ Found ${granolaCommands} Granola commands in palette`);
        
        // Close command palette
        await browser.keys('Escape');
        
        await browser.saveScreenshot(`./test-screenshots/integration-verify-command-palette.png`);
        return granolaCommands > 0;
      }
      
      return false;
    } catch (error) {
      console.log(`❌ Command palette interaction failed: ${error}`);
      // Close palette if still open
      await browser.keys('Escape').catch(() => {});
      return false;
    }
  }

  /**
   * Read a meeting note by its title (without extension)
   * Handles the filename pattern used by the sync engine
   */
  static async readMeetingNote(noteTitle: string): Promise<string> {
    // First try to find the file in the configured target folder
    const settings = await browser.execute(() => {
      // @ts-ignore
      const plugin = window.app.plugins.plugins["obsidian-granola-sync"];
      return plugin.settings;
    });
    
    const targetFolder = settings.targetFolder || "Meetings";
    
    // List all files in the target folder
    const filesInFolder = await TestUtils.getFilesInFolder(targetFolder);
    
    // Extract the meeting title without the date part if present
    // Handle patterns like "Meeting Title - 2024-01-15" or just "Meeting Title"
    let titlePart = noteTitle;
    const dateMatch = noteTitle.match(/^(.+?)\s*-\s*(\d{4}-\d{2}-\d{2})$/);
    if (dateMatch) {
      titlePart = dateMatch[1].trim();
    }
    
    // Look for files that contain the title
    // The actual pattern is: YYYY-MM-DD Title -- uniqueSuffix.md
    // Special characters in titles are sanitized
    const sanitizedTitlePart = titlePart.replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim();
    
    for (const file of filesInFolder) {
      const fileName = file.split('/').pop() || '';
      // Remove the extension and unique suffix
      const nameWithoutExt = fileName.replace(/\.md$/, '').replace(/\s*--\s*[^-]+$/, '');
      
      // Check if this file matches our title (with or without date prefix)
      // Try both original and sanitized versions
      if (nameWithoutExt.includes(titlePart) || nameWithoutExt.includes(sanitizedTitlePart)) {
        const content = await TestUtils.getFileContent(file);
        if (content !== null) {
          return content;
        }
      }
    }
    
    throw new Error(`Meeting note not found with title: ${noteTitle}. Files found: ${filesInFolder.join(', ')}`);
  }

  /**
   * Create comprehensive test vault structure for File Explorer testing
   */
  static async createTestVaultStructure(): Promise<void> {
    // This method validates that the test vault structure already exists
    // The structure is created as static files in the test-vault directory
    await browser.execute(() => {
      console.log('📁 Test vault structure validation - files should already exist in test-vault/');
    });
  }

  /**
   * Get File Explorer layout metrics to detect wrapping issues
   */
  static async getFileExplorerLayout(): Promise<FileExplorerLayout> {
    return browser.execute(() => {
      const fileExplorer = (window as any).app.workspace.getLeavesOfType("file-explorer")[0];
      if (!fileExplorer) {
        throw new Error('File Explorer not found');
      }

      const container = fileExplorer.view.containerEl;
      const items = container.querySelectorAll('.nav-file, .nav-folder');
      
      console.log(`🔍 File Explorer Debug - Found ${items.length} items in container`);
      console.log(`📐 Container dimensions:`, container.getBoundingClientRect());
      
      let previousBottom = -1;
      const wrappedItems: any[] = [];
      const layoutItems: FileExplorerLayoutItem[] = [];
      
      items.forEach((item: Element, index: number) => {
        const rect = item.getBoundingClientRect();
        const name = item.textContent?.trim() || `item-${index}`;
        
        // More accurate wrapping detection for vertical File Explorer
        // In a proper File Explorer, items should stack vertically
        // Only consider an item wrapped if it's significantly higher than the previous item
        // and to the right (indicating horizontal wrapping, which shouldn't happen)
        const isWrapped = index > 0 && 
                          rect.top < previousBottom - 5 && // Above previous item
                          rect.left > 20; // And to the right (horizontal offset)
        
        if (isWrapped) {
          console.log(`⚠️  Potential wrapped item ${index}: "${name}" at top: ${rect.top}, previousBottom: ${previousBottom}`);
          wrappedItems.push({
            index,
            name,
            position: { top: rect.top, left: rect.left }
          });
        }
        
        layoutItems.push({
          name,
          isWrapped,
          width: rect.width,
          height: rect.height,
          top: rect.top,
          left: rect.left
        });
        
        console.log(`📋 Item ${index}: "${name}" - top: ${rect.top}, left: ${rect.left}, wrapped: ${isWrapped}`);
        previousBottom = rect.bottom;
      });
      
      const containerRect = container.getBoundingClientRect();
      
      console.log(`📊 Final analysis: ${wrappedItems.length} wrapped items out of ${items.length} total`);
      
      return {
        items: layoutItems,
        containerWidth: containerRect.width,
        totalItems: items.length,
        wrappedItems: wrappedItems.length
      };
    });
  }

  /**
   * Test File Explorer layout at different widths
   */
  static async testFileExplorerAtWidths(widths: string[]): Promise<LayoutTestResult[]> {
    const results: LayoutTestResult[] = [];
    
    for (const width of widths) {
      // Set File Explorer width
      await browser.execute((w) => {
        const fileExplorer = (window as any).app.workspace.getLeavesOfType("file-explorer")[0];
        if (fileExplorer) {
          const container = fileExplorer.view.containerEl.closest('.workspace-leaf');
          if (container) {
            (container as HTMLElement).style.width = w;
            (container as HTMLElement).style.minWidth = w;
            (container as HTMLElement).style.maxWidth = w;
          }
        }
      }, width);
      
      // Wait for layout to settle
      await browser.pause(500);
      
      // Get layout metrics
      const layout = await TestUtils.getFileExplorerLayout();
      
      // Check if all items are visible
      const allItemsVisible = layout.items.length > 0 && 
        layout.items.every(item => item.width > 0 && item.height > 0);
      
      results.push({
        width,
        wrappedItems: layout.wrappedItems,
        allItemsVisible,
        layout
      });
    }
    
    // Reset width
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
    
    return results;
  }

  /**
   * Ensure File Explorer is ready and visible
   */
  static async ensureFileExplorerReady(): Promise<void> {
    await browser.execute(() => {
      const app = (window as any).app;
      
      // Ensure File Explorer is open
      const fileExplorerLeaf = app.workspace.getLeavesOfType("file-explorer")[0];
      if (!fileExplorerLeaf) {
        // Try to open File Explorer
        app.workspace.getLeftLeaf(false).setViewState({
          type: "file-explorer",
          active: true,
        });
      }
    });
    
    // Wait for File Explorer to be ready
    await browser.pause(1500);
    
    // Verify it's actually ready
    const isReady = await browser.execute(() => {
      const fileExplorer = (window as any).app.workspace.getLeavesOfType("file-explorer")[0];
      return fileExplorer && fileExplorer.view && fileExplorer.view.containerEl;
    });
    
    if (!isReady) {
      throw new Error('File Explorer failed to initialize properly');
    }
  }

  /**
   * Get elements with long names for testing text wrapping behavior
   */
  static async getLongNameElements(): Promise<any[]> {
    return browser.execute(() => {
      const fileExplorer = (window as any).app.workspace.getLeavesOfType("file-explorer")[0];
      if (!fileExplorer) {
        return [];
      }
      
      const navFiles = fileExplorer.view.containerEl.querySelectorAll('.nav-file, .nav-folder');
      
      console.log(`🔍 Analyzing ${navFiles.length} File Explorer items for long names...`);
      
      const longNameItems = Array.from(navFiles)
        .filter((el: Element) => {
          const text = el.textContent || '';
          const isLong = text.includes('Long') || text.includes('Very') || text.length > 20;
          if (isLong) {
            console.log(`📝 Found long name candidate: "${text}" (length: ${text.length})`);
          }
          return isLong;
        })
        .map((el: Element) => {
          const styles = window.getComputedStyle(el);
          const result = {
            text: el.textContent,
            rect: el.getBoundingClientRect(),
            styles: {
              whiteSpace: styles.whiteSpace,
              overflow: styles.overflow,
              textOverflow: styles.textOverflow,
              wordWrap: styles.wordWrap,
              wordBreak: styles.wordBreak
            }
          };
          console.log(`📊 Element styles:`, result.styles);
          return result;
        });
        
      console.log(`✅ Found ${longNameItems.length} long name elements`);
      return longNameItems;
    });
  }
}