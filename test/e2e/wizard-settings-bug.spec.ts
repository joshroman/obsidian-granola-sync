import { browser } from "@wdio/globals";
import { TestUtils, MockMeeting } from "./helpers/test-utils";

describe("Wizard Settings Bug", () => {
  beforeEach(async () => {
    // Clear any existing test data
    await TestUtils.clearTestData();
  });

  it("should apply date organization settings from wizard correctly", async () => {
    // First configure settings as the wizard would
    await browser.execute(() => {
      // @ts-ignore
      const plugin = window.app.plugins.plugins["obsidian-granola-sync"];
      // Simulate wizard settings
      plugin.settings = {
        ...plugin.settings,
        targetFolder: "Meetings",
        folderOrganization: "by-date",
        dateFolderFormat: "daily",
        includeDateInFilename: true,
        dateFormat: "yyyy-MM-dd",
        wizardCompleted: true,
        apiKey: "test-api-key"
      };
      // Update services
      if (plugin.authService) {
        plugin.authService.apiKey = "test-api-key";
      }
      // Save settings
      plugin.saveSettings();
    });

    // Wait for settings to be saved
    await browser.pause(500);

    // Check what settings are actually in the plugin
    const pluginState = await browser.execute(() => {
      // @ts-ignore
      const plugin = window.app.plugins.plugins["obsidian-granola-sync"];
      return {
        settings: plugin.settings,
        pathGeneratorSettings: {
          targetFolder: plugin.pathGenerator?.targetFolder,
          folderOrganization: plugin.pathGenerator?.folderOrganization,
          dateFolderFormat: plugin.pathGenerator?.dateFolderFormat,
          includeDateInFilename: plugin.pathGenerator?.includeDateInFilename,
          dateFormat: plugin.pathGenerator?.dateFormat
        }
      };
    });

    console.log("Plugin state after wizard:", JSON.stringify(pluginState, null, 2));

    // Now try to sync
    const mockMeetings: MockMeeting[] = [
      {
        id: "test-meeting",
        title: "Test Meeting",
        date: new Date("2024-03-20T10:00:00Z"),
        summary: "Testing wizard settings"
      }
    ];

    await TestUtils.mockGranolaAPI(mockMeetings);
    
    const result = await TestUtils.performSync(true);
    console.log("Sync result:", result);

    // The path will be generated during sync, so we don't need to check it separately

    // Verify the file was created with date folder and date prefix
    const expectedPath = "Meetings/2024-03-20/2024-03-20 Test Meeting.md";
    const fileExists = await TestUtils.fileExists(expectedPath);
    
    console.log(`File exists at ${expectedPath}:`, fileExists);
    
    // Also check if file exists without date folder (in case it's using flat structure)
    const flatPath = "Meetings/Test Meeting.md";
    const flatFileExists = await TestUtils.fileExists(flatPath);
    console.log(`File exists at ${flatPath}:`, flatFileExists);
    
    // List all files to see what was actually created
    const allFiles = await browser.execute(() => {
      // @ts-ignore
      const vault = window.app.vault;
      return vault.getFiles().map((f: any) => f.path);
    });
    console.log("All files:", allFiles);

    expect(fileExists).toBeTruthy();
  });
});