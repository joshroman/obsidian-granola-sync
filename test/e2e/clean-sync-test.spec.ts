import { browser } from "@wdio/globals";
import { TestUtils, MockMeeting } from "./helpers/test-utils";

describe("Clean Sync After Fix", () => {
  it("should create separate files for all meetings after clearing state", async () => {
    // Clear all data including state
    await TestUtils.clearTestData();
    
    // Also clear the state manager data
    await browser.execute(() => {
      // @ts-ignore
      const plugin = window.app.plugins.plugins["obsidian-granola-sync"];
      plugin.stateManager.clearState();
    });

    // Configure plugin with date organization
    await TestUtils.configurePlugin({
      targetFolder: "Meetings",
      folderOrganization: "by-date",
      dateFolderFormat: "daily",
      includeDateInFilename: true,
      dateFormat: "yyyy-MM-dd"
    });

    // Create meetings that would have been problematic before
    const mockMeetings: MockMeeting[] = [
      {
        id: "f8fbbab8",
        title: "Josh - Andrea 11",
        date: new Date("2025-06-24T10:00:00Z"),
        summary: "Discussion meeting"
      },
      {
        id: "0a68a429",
        title: "DJB Eval & Coding",
        date: new Date("2025-06-24T14:00:00Z"),
        summary: "Evaluation and coding session"
      },
      {
        id: "eed2559d",
        title: "Meet This Moment - Tuesday Talks",
        date: new Date("2025-06-24T15:00:00Z"),
        summary: "Tuesday talk session"
      },
      {
        id: "d7cc2713",
        title: "Untitled Meeting",
        date: new Date("2025-06-24T16:00:00Z"),
        summary: "General meeting"
      },
      {
        id: "48517861",
        title: "Research Discussion",
        date: new Date("2025-06-24T17:00:00Z"),
        summary: "Research topics"
      }
    ];

    await TestUtils.mockGranolaAPI(mockMeetings);
    const result = await TestUtils.performSync(true);
    
    console.log("Clean sync result:", JSON.stringify(result, null, 2));
    
    // All meetings should be created
    expect(result.created).toBe(5);
    expect(result.errors.length).toBe(0);
    
    // List all files
    const allFiles = await browser.execute(() => {
      // @ts-ignore
      const vault = window.app.vault;
      return vault.getFiles().map((f: any) => ({
        path: f.path,
        size: f.stat.size
      }));
    });
    
    console.log("All files created:", JSON.stringify(allFiles, null, 2));
    
    // Should have 5 separate files
    expect(allFiles.length).toBe(5);
    
    // All should be in date folder
    expect(allFiles.every(f => f.path.includes("2025-06-24"))).toBeTruthy();
    
    // Check that each file contains only one meeting
    for (const file of allFiles) {
      const content = await TestUtils.getFileContent(file.path);
      const meetingHeaders = (content?.match(/^# /gm) || []).length;
      
      if (meetingHeaders !== 1) {
        console.log(`File ${file.path} has ${meetingHeaders} meetings:`);
        console.log(content);
      }
      
      expect(meetingHeaders).toBe(1);
    }
  });
});