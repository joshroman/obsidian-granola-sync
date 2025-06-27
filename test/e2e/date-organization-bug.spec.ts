import { browser } from "@wdio/globals";
import { TestUtils, MockMeeting } from "./helpers/test-utils";

describe("Date Organization Bug Reproduction", () => {
  beforeEach(async () => {
    // Clear any existing test data
    await TestUtils.clearTestData();
  });

  afterEach(async () => {
    // Clean up after tests
    await TestUtils.clearTestData();
  });

  describe("Bug: Date-based subfolders not created", () => {
    it("should create date subfolders for each unique meeting date", async () => {
      // Configure exactly as user reported
      await TestUtils.configurePlugin({
        targetFolder: "Meetings",
        folderOrganization: "by-date",
        dateFolderFormat: "daily",
        includeDateInFilename: true,
        dateFormat: "yyyy-MM-dd"
      });

      // Create meetings across different dates
      const mockMeetings: MockMeeting[] = [
        {
          id: "meeting1",
          title: "OMAI Standup",
          date: new Date("2024-01-15T10:00:00Z"),
          summary: "Daily standup meeting"
        },
        {
          id: "meeting2", 
          title: "Design Review",
          date: new Date("2024-01-15T14:00:00Z"), // Same date
          summary: "Design review session"
        },
        {
          id: "meeting3",
          title: "Client Meeting",
          date: new Date("2024-01-16T09:00:00Z"), // Different date
          summary: "Client sync"
        },
        {
          id: "meeting4",
          title: "Team Retrospective",
          date: new Date("2024-01-17T15:00:00Z"), // Another date
          summary: "Sprint retrospective"
        }
      ];

      await TestUtils.mockGranolaAPI(mockMeetings);
      
      // Debug: Check if plugin is ready
      const pluginStatus = await browser.execute(() => {
        // @ts-ignore
        const plugin = window.app.plugins.plugins["obsidian-granola-sync"];
        return {
          hasPlugin: !!plugin,
          hasGranolaService: !!plugin?.granolaService,
          hasSyncEngine: !!plugin?.syncEngine,
          wizardCompleted: plugin?.settings?.wizardCompleted,
          targetFolder: plugin?.settings?.targetFolder,
          folderOrganization: plugin?.settings?.folderOrganization,
          apiKey: plugin?.authService?.hasApiKey ? "set" : "not set"
        };
      });
      console.log("Plugin status before sync:", pluginStatus);
      
      // Try to sync
      try {
        const result = await TestUtils.performSync(true);
        console.log("Sync result:", result);
        if (result && result.errors && result.errors.length > 0) {
          console.log("Sync errors:", JSON.stringify(result.errors, null, 2));
        }
      } catch (error) {
        console.error("Sync error:", error);
      }

      // Debug: List all files created
      const allFiles = await browser.execute(() => {
        // @ts-ignore
        const vault = window.app.vault;
        const files = vault.getFiles();
        return files.map((f: any) => f.path);
      });
      console.log("All files created:", allFiles);

      // Debug: List all folders
      const allFolders = await browser.execute(() => {
        // @ts-ignore
        const vault = window.app.vault;
        const folders = vault.getAllFolders();
        return folders.map((f: any) => f.path);
      });
      console.log("All folders created:", allFolders);

      // Verify date folders were created
      const folder1Exists = await TestUtils.fileExists("Meetings/2024-01-15");
      const folder2Exists = await TestUtils.fileExists("Meetings/2024-01-16");
      const folder3Exists = await TestUtils.fileExists("Meetings/2024-01-17");

      expect(folder1Exists).toBeTruthy();
      expect(folder2Exists).toBeTruthy();
      expect(folder3Exists).toBeTruthy();

      // Verify files are in correct folders - now with unique suffixes
      const file1Exists = await TestUtils.fileExists("Meetings/2024-01-15/2024-01-15 OMAI Standup -- meeting1.md");
      const file2Exists = await TestUtils.fileExists("Meetings/2024-01-15/2024-01-15 Design Review -- meeting2.md");
      const file3Exists = await TestUtils.fileExists("Meetings/2024-01-16/2024-01-16 Client Meeting -- meeting3.md");
      const file4Exists = await TestUtils.fileExists("Meetings/2024-01-17/2024-01-17 Team Retrospective -- meeting4.md");

      expect(file1Exists).toBeTruthy();
      expect(file2Exists).toBeTruthy();
      expect(file3Exists).toBeTruthy();
      expect(file4Exists).toBeTruthy();
    });

    it("should handle timezone correctly for date folders", async () => {
      await TestUtils.configurePlugin({
        targetFolder: "Meetings",
        folderOrganization: "by-date",
        dateFolderFormat: "daily",
        includeDateInFilename: true,
        dateFormat: "yyyy-MM-dd"
      });

      // Create meeting with specific timezone considerations
      const mockMeetings: MockMeeting[] = [
        {
          id: "tz-test1",
          title: "Late Night Meeting",
          date: new Date("2024-01-15T23:30:00-05:00"), // 11:30 PM EST
          summary: "Late meeting that might cross date boundary"
        }
      ];

      await TestUtils.mockGranolaAPI(mockMeetings);
      await TestUtils.performSync(true);

      // Should use UTC date for consistency
      const folderExists = await TestUtils.fileExists("Meetings/2024-01-16"); // UTC date
      const fileExists = await TestUtils.fileExists("Meetings/2024-01-16/2024-01-16 Late Night Meeting -- tz-test1.md");

      expect(folderExists).toBeTruthy();
      expect(fileExists).toBeTruthy();
    });
  });

  describe("Bug: Date prefix not appearing in filenames", () => {
    it("should include date prefix when enabled", async () => {
      await TestUtils.configurePlugin({
        targetFolder: "Meetings",
        folderOrganization: "flat",
        includeDateInFilename: true,
        dateFormat: "yyyy-MM-dd"
      });

      const mockMeeting: MockMeeting = {
        id: "prefix-test",
        title: "Important Meeting",
        date: new Date("2024-03-20T10:00:00Z"),
        summary: "Testing date prefix"
      };

      await TestUtils.mockGranolaAPI([mockMeeting]);
      await TestUtils.performSync(true);

      // File should have date prefix
      const fileWithPrefix = await TestUtils.fileExists("Meetings/2024-03-20 Important Meeting -- 789.md");
      expect(fileWithPrefix).toBeTruthy();

      // Should NOT have the unique suffix when date is included
      const filesInFolder = await TestUtils.getFilesInFolder("Meetings");
      const hasUniqueSuffix = filesInFolder.some(f => f.includes(" -- "));
      expect(hasUniqueSuffix).toBeFalsy();
    });

    it("should add unique suffix when date prefix is disabled", async () => {
      await TestUtils.configurePlugin({
        targetFolder: "Meetings",
        folderOrganization: "flat",
        includeDateInFilename: false
      });

      const mockMeeting: MockMeeting = {
        id: "suffix-test-12345678",
        title: "No Date Meeting",
        date: new Date("2024-03-20T10:00:00Z"),
        summary: "Testing unique suffix"
      };

      await TestUtils.mockGranolaAPI([mockMeeting]);
      await TestUtils.performSync(true);

      // File should have unique suffix from ID
      const fileWithSuffix = await TestUtils.fileExists("Meetings/No Date Meeting -- 12345678.md");
      expect(fileWithSuffix).toBeTruthy();
    });

    it("should use correct date format options", async () => {
      const testCases = [
        { format: "yyyy-MM-dd", expected: "2024-03-20" },
        { format: "dd-MM-yyyy", expected: "20-03-2024" },
        { format: "MM-dd-yyyy", expected: "03-20-2024" },
        { format: "yyyy.MM.dd", expected: "2024.03.20" }
      ];

      for (const testCase of testCases) {
        // Clear previous test data
        await TestUtils.deleteFolder("Meetings");

        await TestUtils.configurePlugin({
          targetFolder: "Meetings",
          folderOrganization: "flat",
          includeDateInFilename: true,
          dateFormat: testCase.format
        });

        const mockMeeting: MockMeeting = {
          id: `format-test-${testCase.format}`,
          title: "Format Test",
          date: new Date("2024-03-20T10:00:00Z"),
          summary: `Testing ${testCase.format} format`
        };

        await TestUtils.mockGranolaAPI([mockMeeting]);
        await TestUtils.performSync(true);

        const expectedPath = `Meetings/${testCase.expected} Format Test.md`;
        const fileExists = await TestUtils.fileExists(expectedPath);
        
        expect(fileExists).toBeTruthy();
      }
    });
  });

  describe("Combined date organization and naming", () => {
    it("should work correctly with both date folders and date prefixes", async () => {
      await TestUtils.configurePlugin({
        targetFolder: "Meetings",
        folderOrganization: "by-date",
        dateFolderFormat: "daily",
        includeDateInFilename: true,
        dateFormat: "yyyy-MM-dd"
      });

      const mockMeetings: MockMeeting[] = [
        {
          id: "combined1",
          title: "Morning Standup",
          date: new Date("2024-03-25T09:00:00Z"),
          summary: "Daily standup"
        },
        {
          id: "combined2",
          title: "Afternoon Review",
          date: new Date("2024-03-25T15:00:00Z"),
          summary: "Code review"
        }
      ];

      await TestUtils.mockGranolaAPI(mockMeetings);
      await TestUtils.performSync(true);

      // Both files should be in date folder with date prefix
      const file1 = await TestUtils.fileExists("Meetings/2024-03-25/2024-03-25 Morning Standup -- -meeting.md");
      const file2 = await TestUtils.fileExists("Meetings/2024-03-25/2024-03-25 Afternoon Review -- view-456.md");

      expect(file1).toBeTruthy();
      expect(file2).toBeTruthy();

      // Verify file content has correct structure
      const content1 = await TestUtils.getFileContent("Meetings/2024-03-25/2024-03-25 Morning Standup.md");
      expect(content1).toContain("Daily standup");
    });
  });
});