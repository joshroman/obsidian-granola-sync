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
    // Wait a bit for modals to close
    await browser.pause(500);
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
    
    // Additional wait to ensure file operations complete
    await browser.pause(1000);
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
    // Wait for file explorer to render
    await browser.pause(1000);
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
}