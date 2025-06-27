import { browser } from "@wdio/globals";
import { TestUtils, MockMeeting } from "./helpers/test-utils";

describe("Multiple Meetings Same File Bug", () => {
  beforeEach(async () => {
    await TestUtils.clearTestData();
  });

  it("should create separate files for meetings with similar titles", async () => {
    // Configure plugin for date-based organization
    await TestUtils.configurePlugin({
      targetFolder: "Meetings",
      folderOrganization: "by-date",
      dateFolderFormat: "daily",
      includeDateInFilename: false, // No date prefix to test unique suffixes
      dateFormat: "yyyy-MM-dd"
    });

    // Create multiple meetings with the same title on the same date
    const mockMeetings: MockMeeting[] = [
      {
        id: "meeting1",
        title: "OMAI Test Meeting",
        date: new Date("2025-06-26T10:00:00Z"),
        summary: "First test meeting"
      },
      {
        id: "meeting2",
        title: "OMAI Test Meeting", // Same title
        date: new Date("2025-06-26T14:00:00Z"), // Same date, different time
        summary: "Second test meeting"
      },
      {
        id: "meeting3",
        title: "Meet This Moment",
        date: new Date("2025-06-26T15:00:00Z"),
        summary: "Third meeting"
      },
      {
        id: "meeting4",
        title: "Meet This Moment", // Same title as meeting3
        date: new Date("2025-06-26T16:00:00Z"),
        summary: "Fourth meeting"
      }
    ];

    await TestUtils.mockGranolaAPI(mockMeetings);
    const result = await TestUtils.performSync(true);
    
    console.log("Sync result:", result);
    
    // List all files created
    const allFiles = await browser.execute(() => {
      // @ts-ignore
      const vault = window.app.vault;
      return vault.getFiles().map((f: any) => ({
        path: f.path,
        size: f.stat.size
      }));
    });
    console.log("All files created:", allFiles);

    // We should have 4 separate files
    expect(allFiles.length).toBe(4);
    
    // Check each file's content to ensure they're not concatenated
    for (const file of allFiles) {
      const content = await TestUtils.getFileContent(file.path);
      console.log(`\nContent of ${file.path}:\n${content}\n`);
      
      // Each file should contain only one meeting
      const meetingCount = (content?.match(/^# /gm) || []).length;
      expect(meetingCount).toBe(1);
    }
  });

  it("should handle unique suffixes correctly when date prefix is enabled", async () => {
    await TestUtils.clearTestData();
    
    // Configure with date prefix enabled
    await TestUtils.configurePlugin({
      targetFolder: "Meetings",
      folderOrganization: "by-date",
      dateFolderFormat: "daily",
      includeDateInFilename: true,
      dateFormat: "yyyy-MM-dd"
    });

    // Create meetings with same title and date
    const mockMeetings: MockMeeting[] = [
      {
        id: "standup1",
        title: "Standup",
        date: new Date("2025-06-27T09:00:00Z"),
        summary: "Morning standup"
      },
      {
        id: "standup2",
        title: "Standup", // Same title
        date: new Date("2025-06-27T15:00:00Z"), // Same date
        summary: "Afternoon standup"
      }
    ];

    await TestUtils.mockGranolaAPI(mockMeetings);
    const result = await TestUtils.performSync(true);
    
    const allFiles = await browser.execute(() => {
      // @ts-ignore
      const vault = window.app.vault;
      return vault.getFiles().map((f: any) => f.path);
    });
    
    console.log("Files with date prefix:", allFiles);
    
    // Check content of the file(s)
    for (const filePath of allFiles) {
      const content = await TestUtils.getFileContent(filePath);
      console.log(`\nContent of ${filePath}:\n${content}\n`);
    }
    
    // Should have 2 files with unique suffixes
    expect(allFiles.length).toBe(2);
    
    // Both should be in the same date folder
    expect(allFiles.every(f => f.includes("2025-06-27"))).toBeTruthy();
    
    // Files should have different names (with suffixes)
    expect(allFiles[0]).not.toBe(allFiles[1]);
  });
});