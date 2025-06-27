import { browser } from "@wdio/globals";
import { Notice } from "obsidian";
import path from "path";

describe("Granola Sync Plugin - Core Sync Functionality", () => {
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
  });

  describe("Date-based File Organization", () => {
    it("should create date-based subfolders when configured", async () => {
      // Configure plugin for date-based organization
      await browser.execute(() => {
        // @ts-ignore
        const plugin = window.app.plugins.plugins["obsidian-granola-sync"];
        plugin.settings.folderOrganization = "by-date";
        plugin.settings.dateFolderFormat = "daily";
        plugin.settings.includeDateInFilename = true;
        plugin.settings.dateFormat = "yyyy-MM-dd";
        plugin.settings.targetFolder = "Meetings";
      });

      // Mock meeting data with specific dates
      const mockMeetings = [
        {
          id: "test-1",
          title: "Team Meeting",
          date: new Date("2024-03-20"),
          summary: "Test meeting 1",
          transcript: "",
          highlights: [],
          attendees: [],
          tags: []
        },
        {
          id: "test-2",
          title: "Client Call",
          date: new Date("2024-03-21"),
          summary: "Test meeting 2",
          transcript: "",
          highlights: [],
          attendees: [],
          tags: []
        }
      ];

      // Inject mock data into Granola service
      await browser.execute((meetings) => {
        // @ts-ignore
        const plugin = window.app.plugins.plugins["obsidian-granola-sync"];
        // Override the getAllMeetings method to return our test data
        plugin.granolaService.getAllMeetings = async () => meetings;
      }, mockMeetings);

      // Trigger sync
      await browser.execute(() => {
        // @ts-ignore
        const plugin = window.app.plugins.plugins["obsidian-granola-sync"];
        return plugin.performSync(true);
      });

      // Wait for sync to complete
      await browser.pause(2000);

      // Check that date folders were created
      const folder2024_03_20 = await browser.execute(() => {
        // @ts-ignore
        const vault = window.app.vault;
        return vault.getAbstractFileByPath("Meetings/2024-03-20");
      });

      const folder2024_03_21 = await browser.execute(() => {
        // @ts-ignore
        const vault = window.app.vault;
        return vault.getAbstractFileByPath("Meetings/2024-03-21");
      });

      expect(folder2024_03_20).toBeTruthy();
      expect(folder2024_03_21).toBeTruthy();

      // Check that files were created in the correct folders with date prefix
      const file1 = await browser.execute(() => {
        // @ts-ignore
        const vault = window.app.vault;
        return vault.getAbstractFileByPath("Meetings/2024-03-20/2024-03-20 Team Meeting.md");
      });

      const file2 = await browser.execute(() => {
        // @ts-ignore
        const vault = window.app.vault;
        return vault.getAbstractFileByPath("Meetings/2024-03-21/2024-03-21 Client Call.md");
      });

      expect(file1).toBeTruthy();
      expect(file2).toBeTruthy();
    });

    it("should use flat folder structure when configured", async () => {
      // Configure plugin for flat organization
      await browser.execute(() => {
        // @ts-ignore
        const plugin = window.app.plugins.plugins["obsidian-granola-sync"];
        plugin.settings.folderOrganization = "flat";
        plugin.settings.includeDateInFilename = false;
        plugin.settings.targetFolder = "Meetings";
      });

      const mockMeeting = {
        id: "test-flat-1",
        title: "Flat Structure Test",
        date: new Date("2024-03-22"),
        summary: "Test flat structure",
        transcript: "",
        highlights: [],
        attendees: [],
        tags: []
      };

      // Inject mock data
      await browser.execute((meeting) => {
        // @ts-ignore
        const plugin = window.app.plugins.plugins["obsidian-granola-sync"];
        plugin.granolaService.getAllMeetings = async () => [meeting];
      }, mockMeeting);

      // Trigger sync
      await browser.execute(() => {
        // @ts-ignore
        const plugin = window.app.plugins.plugins["obsidian-granola-sync"];
        return plugin.performSync(true);
      });

      await browser.pause(2000);

      // Check file was created directly in Meetings folder without date prefix
      const file = await browser.execute(() => {
        // @ts-ignore
        const vault = window.app.vault;
        // Should have unique suffix but no date prefix
        const files = vault.getFiles().filter((f: any) => 
          f.path.startsWith("Meetings/Flat Structure Test --") && 
          f.path.endsWith(".md")
        );
        return files.length > 0 ? files[0] : null;
      });

      expect(file).toBeTruthy();
      expect(file.path).toMatch(/^Meetings\/Flat Structure Test -- [a-f0-9]{8}\.md$/);
    });
  });

  describe("Weekly Folder Organization", () => {
    it("should create weekly folders when configured", async () => {
      await browser.execute(() => {
        // @ts-ignore
        const plugin = window.app.plugins.plugins["obsidian-granola-sync"];
        plugin.settings.folderOrganization = "by-date";
        plugin.settings.dateFolderFormat = "weekly";
        plugin.settings.weekFormat = "yyyy-'W'ww";
        plugin.settings.includeDateInFilename = true;
        plugin.settings.targetFolder = "Meetings";
      });

      const mockMeetings = [
        {
          id: "week-test-1",
          title: "Monday Meeting",
          date: new Date("2024-03-18"), // Monday of week 12
          summary: "Week test 1",
          transcript: "",
          highlights: [],
          attendees: [],
          tags: []
        },
        {
          id: "week-test-2",
          title: "Friday Meeting",
          date: new Date("2024-03-22"), // Friday of same week
          summary: "Week test 2",
          transcript: "",
          highlights: [],
          attendees: [],
          tags: []
        }
      ];

      await browser.execute((meetings) => {
        // @ts-ignore
        const plugin = window.app.plugins.plugins["obsidian-granola-sync"];
        plugin.granolaService.getAllMeetings = async () => meetings;
      }, mockMeetings);

      await browser.execute(() => {
        // @ts-ignore
        const plugin = window.app.plugins.plugins["obsidian-granola-sync"];
        return plugin.performSync(true);
      });

      await browser.pause(2000);

      // Both meetings should be in the same weekly folder
      const weekFolder = await browser.execute(() => {
        // @ts-ignore
        const vault = window.app.vault;
        return vault.getAbstractFileByPath("Meetings/2024-W12");
      });

      expect(weekFolder).toBeTruthy();

      // Check both files exist in the weekly folder
      const files = await browser.execute(() => {
        // @ts-ignore
        const vault = window.app.vault;
        const file1 = vault.getAbstractFileByPath("Meetings/2024-W12/2024-03-18 Monday Meeting.md");
        const file2 = vault.getAbstractFileByPath("Meetings/2024-W12/2024-03-22 Friday Meeting.md");
        return { file1: !!file1, file2: !!file2 };
      });

      expect(files.file1).toBeTruthy();
      expect(files.file2).toBeTruthy();
    });
  });

  describe("File Naming Options", () => {
    it("should include date in filename when enabled", async () => {
      await browser.execute(() => {
        // @ts-ignore
        const plugin = window.app.plugins.plugins["obsidian-granola-sync"];
        plugin.settings.folderOrganization = "flat";
        plugin.settings.includeDateInFilename = true;
        plugin.settings.dateFormat = "yyyy-MM-dd";
      });

      const mockMeeting = {
        id: "date-test",
        title: "Date Prefix Test",
        date: new Date("2024-03-25"),
        summary: "Testing date prefix",
        transcript: "",
        highlights: [],
        attendees: [],
        tags: []
      };

      await browser.execute((meeting) => {
        // @ts-ignore
        const plugin = window.app.plugins.plugins["obsidian-granola-sync"];
        plugin.granolaService.getAllMeetings = async () => [meeting];
      }, mockMeeting);

      await browser.execute(() => {
        // @ts-ignore
        const plugin = window.app.plugins.plugins["obsidian-granola-sync"];
        return plugin.performSync(true);
      });

      await browser.pause(1000);

      const file = await browser.execute(() => {
        // @ts-ignore
        const vault = window.app.vault;
        return vault.getAbstractFileByPath("Meetings/2024-03-25 Date Prefix Test.md");
      });

      expect(file).toBeTruthy();
    });

    it("should use custom date formats", async () => {
      await browser.execute(() => {
        // @ts-ignore
        const plugin = window.app.plugins.plugins["obsidian-granola-sync"];
        plugin.settings.folderOrganization = "flat";
        plugin.settings.includeDateInFilename = true;
        plugin.settings.dateFormat = "dd-MM-yyyy";
      });

      const mockMeeting = {
        id: "format-test",
        title: "Custom Date Format",
        date: new Date("2024-03-25"),
        summary: "Testing custom date format",
        transcript: "",
        highlights: [],
        attendees: [],
        tags: []
      };

      await browser.execute((meeting) => {
        // @ts-ignore
        const plugin = window.app.plugins.plugins["obsidian-granola-sync"];
        plugin.granolaService.getAllMeetings = async () => [meeting];
      }, mockMeeting);

      await browser.execute(() => {
        // @ts-ignore
        const plugin = window.app.plugins.plugins["obsidian-granola-sync"];
        return plugin.performSync(true);
      });

      await browser.pause(1000);

      const file = await browser.execute(() => {
        // @ts-ignore
        const vault = window.app.vault;
        return vault.getAbstractFileByPath("Meetings/25-03-2024 Custom Date Format.md");
      });

      expect(file).toBeTruthy();
    });
  });
});