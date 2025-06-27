import { browser } from "@wdio/globals";

describe("Granola Sync Plugin - Setup Wizard", () => {
  let plugin: any;
  let app: any;

  beforeEach(async () => {
    // Get the Obsidian app and plugin instance
    app = await browser.executeAsync((done) => {
      // @ts-ignore
      done(window.app);
    });
    
    // Get our plugin instance
    plugin = await browser.executeAsync((done) => {
      // @ts-ignore
      const plugin = window.app.plugins.plugins["obsidian-granola-sync"];
      done(plugin);
    });

    // Reset wizard completion state
    await browser.execute(() => {
      // @ts-ignore
      const plugin = window.app.plugins.plugins["obsidian-granola-sync"];
      plugin.settings.wizardCompleted = false;
    });
  });

  describe("Wizard Navigation", () => {
    it("should open setup wizard on first launch", async () => {
      // Trigger plugin reload to simulate first launch
      await browser.execute(() => {
        // @ts-ignore
        const plugin = window.app.plugins.plugins["obsidian-granola-sync"];
        plugin.onload();
      });

      // Check if wizard modal is open
      const wizardExists = await browser.execute(() => {
        const modals = document.querySelectorAll(".granola-setup-wizard");
        return modals.length > 0;
      });

      expect(wizardExists).toBeTruthy();
    });

    it("should navigate through wizard steps", async () => {
      // Open wizard manually
      const wizard = await browser.execute(() => {
        // @ts-ignore
        const plugin = window.app.plugins.plugins["obsidian-granola-sync"];
        return plugin.showSetupWizard();
      });

      // Wait for wizard to render
      await browser.pause(500);

      // Check we're on step 1 (Welcome)
      let currentStep = await browser.execute(() => {
        const progressText = document.querySelector(".progress-text");
        return progressText?.textContent;
      });
      expect(currentStep).toContain("Step 1");

      // Click Next
      await browser.execute(() => {
        const nextButton = Array.from(document.querySelectorAll("button"))
          .find(btn => btn.textContent === "Next");
        nextButton?.click();
      });

      await browser.pause(300);

      // Check we're on step 2 (Connection)
      currentStep = await browser.execute(() => {
        const progressText = document.querySelector(".progress-text");
        return progressText?.textContent;
      });
      expect(currentStep).toContain("Step 2");

      // Go back
      await browser.execute(() => {
        const backButton = Array.from(document.querySelectorAll("button"))
          .find(btn => btn.textContent === "Back");
        backButton?.click();
      });

      await browser.pause(300);

      // Check we're back on step 1
      currentStep = await browser.execute(() => {
        const progressText = document.querySelector(".progress-text");
        return progressText?.textContent;
      });
      expect(currentStep).toContain("Step 1");
    });
  });

  describe("Folder Organization Settings", () => {
    it("should disable mirror-granola option with warning", async () => {
      // Open wizard and navigate to organization step
      await browser.execute(() => {
        // @ts-ignore
        const plugin = window.app.plugins.plugins["obsidian-granola-sync"];
        plugin.showSetupWizard();
      });

      await browser.pause(500);

      // Navigate to folder organization step (step 4)
      for (let i = 0; i < 3; i++) {
        await browser.execute(() => {
          const nextButton = Array.from(document.querySelectorAll("button"))
            .find(btn => btn.textContent === "Next");
          nextButton?.click();
        });
        await browser.pause(300);
      }

      // Check that mirror-granola option is disabled
      const mirrorOptionDisabled = await browser.execute(() => {
        const select = document.querySelector('select');
        const mirrorOption = Array.from(select?.options || [])
          .find(opt => opt.value === "mirror-granola");
        return mirrorOption?.disabled;
      });

      expect(mirrorOptionDisabled).toBeTruthy();

      // Check warning message exists
      const warningExists = await browser.execute(() => {
        const warnings = Array.from(document.querySelectorAll(".setting-alert"));
        return warnings.some(w => w.textContent?.includes("Mirror Granola folders"));
      });

      expect(warningExists).toBeTruthy();
    });

    it("should update preview when organization type changes", async () => {
      // Open wizard and navigate to organization step
      await browser.execute(() => {
        // @ts-ignore
        const plugin = window.app.plugins.plugins["obsidian-granola-sync"];
        plugin.showSetupWizard();
      });

      await browser.pause(500);

      // Navigate to folder organization step
      for (let i = 0; i < 3; i++) {
        await browser.execute(() => {
          const nextButton = Array.from(document.querySelectorAll("button"))
            .find(btn => btn.textContent === "Next");
          nextButton?.click();
        });
        await browser.pause(300);
      }

      // Select flat organization
      await browser.execute(() => {
        const select = document.querySelector('select') as HTMLSelectElement;
        select.value = "flat";
        select.dispatchEvent(new Event('change'));
      });

      await browser.pause(300);

      // Check preview shows flat structure
      let previewContent = await browser.execute(() => {
        const preview = document.querySelector(".organization-preview");
        return preview?.textContent;
      });

      expect(previewContent).toContain("All in one folder");

      // Select date-based organization
      await browser.execute(() => {
        const select = document.querySelector('select') as HTMLSelectElement;
        select.value = "by-date";
        select.dispatchEvent(new Event('change'));
      });

      await browser.pause(300);

      // Check preview shows date folders
      previewContent = await browser.execute(() => {
        const preview = document.querySelector(".organization-preview");
        return preview?.textContent;
      });

      expect(previewContent).toMatch(/2024-\d{2}-\d{2}/);
    });
  });

  describe("File Naming Settings", () => {
    it("should toggle date format options based on include date setting", async () => {
      // Open wizard and navigate to file naming step
      await browser.execute(() => {
        // @ts-ignore
        const plugin = window.app.plugins.plugins["obsidian-granola-sync"];
        plugin.showSetupWizard();
      });

      await browser.pause(500);

      // Navigate to file naming step (step 5)
      for (let i = 0; i < 4; i++) {
        await browser.execute(() => {
          const nextButton = Array.from(document.querySelectorAll("button"))
            .find(btn => btn.textContent === "Next");
          nextButton?.click();
        });
        await browser.pause(300);
      }

      // Check date format dropdown exists when include date is enabled
      let dateFormatExists = await browser.execute(() => {
        const dropdowns = document.querySelectorAll('select');
        return Array.from(dropdowns).some(d => 
          d.innerHTML.includes("yyyy-MM-dd")
        );
      });

      expect(dateFormatExists).toBeTruthy();

      // Toggle include date off
      await browser.execute(() => {
        const toggle = document.querySelector('input[type="checkbox"]') as HTMLInputElement;
        toggle.click();
      });

      await browser.pause(300);

      // Check date format dropdown is hidden
      dateFormatExists = await browser.execute(() => {
        const container = document.querySelector(".wizard-content");
        const settings = container?.querySelectorAll(".setting-item") || [];
        return Array.from(settings).some(s => 
          s.textContent?.includes("Date Format") && 
          window.getComputedStyle(s as Element).display !== "none"
        );
      });

      expect(dateFormatExists).toBeFalsy();
    });
  });

  describe("Settings Persistence", () => {
    it("should save settings when wizard is completed", async () => {
      // Open wizard
      await browser.execute(() => {
        // @ts-ignore
        const plugin = window.app.plugins.plugins["obsidian-granola-sync"];
        plugin.showSetupWizard();
      });

      await browser.pause(500);

      // Navigate through all steps with specific settings
      // Step 1: Welcome - click Next
      await browser.execute(() => {
        const nextButton = Array.from(document.querySelectorAll("button"))
          .find(btn => btn.textContent === "Next");
        nextButton?.click();
      });
      await browser.pause(300);

      // Step 2: Connection - skip for now
      await browser.execute(() => {
        const skipButton = Array.from(document.querySelectorAll("button"))
          .find(btn => btn.textContent === "Skip");
        skipButton?.click();
      });
      await browser.pause(300);

      // Step 3: Target folder - set custom folder
      await browser.execute(() => {
        const input = document.querySelector('input[type="text"]') as HTMLInputElement;
        input.value = "TestMeetings";
        input.dispatchEvent(new Event('input'));
      });
      await browser.execute(() => {
        const nextButton = Array.from(document.querySelectorAll("button"))
          .find(btn => btn.textContent === "Next");
        nextButton?.click();
      });
      await browser.pause(300);

      // Step 4: Organization - select by-date
      await browser.execute(() => {
        const select = document.querySelector('select') as HTMLSelectElement;
        select.value = "by-date";
        select.dispatchEvent(new Event('change'));
      });
      await browser.execute(() => {
        const nextButton = Array.from(document.querySelectorAll("button"))
          .find(btn => btn.textContent === "Next");
        nextButton?.click();
      });
      await browser.pause(300);

      // Continue through remaining steps
      for (let i = 0; i < 4; i++) {
        await browser.execute(() => {
          const nextButton = Array.from(document.querySelectorAll("button"))
            .find(btn => btn.textContent === "Next");
          nextButton?.click();
        });
        await browser.pause(300);
      }

      // Complete wizard
      await browser.execute(() => {
        const completeButton = Array.from(document.querySelectorAll("button"))
          .find(btn => btn.textContent?.includes("Start Syncing"));
        completeButton?.click();
      });

      await browser.pause(500);

      // Check settings were saved
      const settings = await browser.execute(() => {
        // @ts-ignore
        const plugin = window.app.plugins.plugins["obsidian-granola-sync"];
        return {
          targetFolder: plugin.settings.targetFolder,
          folderOrganization: plugin.settings.folderOrganization,
          wizardCompleted: plugin.settings.wizardCompleted
        };
      });

      expect(settings.targetFolder).toBe("TestMeetings");
      expect(settings.folderOrganization).toBe("by-date");
      expect(settings.wizardCompleted).toBeTruthy();
    });
  });
});