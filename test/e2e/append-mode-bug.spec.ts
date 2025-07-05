import { browser } from "@wdio/globals";
import { TestUtils, MockMeeting } from "./helpers/test-utils";

describe("Append Mode Bug Investigation", () => {
  beforeEach(async () => {
    await TestUtils.clearTestData();
  });

  it("should not append meetings to existing files when they have different IDs", async () => {
    // Configure plugin
    await TestUtils.configurePlugin({
      targetFolder: "Meetings",
      folderOrganization: "flat", // Use flat to simplify
      includeDateInFilename: false,
      dateFormat: "yyyy-MM-dd"
    });

    // First sync - create initial meetings
    const firstBatch: MockMeeting[] = [
      {
        id: "josh-andrea-11",
        title: "Josh - Andrea 11",
        date: new Date("2025-06-24T10:00:00Z"),
        summary: "First meeting"
      }
    ];

    await TestUtils.mockGranolaAPI(firstBatch);
    const result1 = await TestUtils.performSync(true);
    console.log("First sync result:", result1);

    // List files to see what was actually created
    const filesAfterFirst = await browser.execute(() => {
      // @ts-ignore
      const vault = window.app.vault;
      return vault.getFiles().map((f: any) => f.path);
    });
    console.log("Files after first sync:", filesAfterFirst);

    // Get the actual filename (it will have the last 8 chars of the ID)
    const expectedSuffix = "josh-andrea-11".slice(-8); // "-andrea-11" -> "ndrea-11"
    const actualFilePath = filesAfterFirst[0];
    
    // Check first file was created
    const file1Content = await TestUtils.getFileContent(actualFilePath);
    console.log("First file content:", file1Content);
    expect(file1Content).toContain("Josh - Andrea 11");

    // Second sync - add another meeting with different title
    const secondBatch: MockMeeting[] = [
      ...firstBatch, // Include first meeting
      {
        id: "djb-eval-coding",
        title: "DJB Eval & Coding",
        date: new Date("2025-06-24T14:00:00Z"),
        summary: "Second meeting"
      }
    ];

    await TestUtils.mockGranolaAPI(secondBatch);
    const result2 = await TestUtils.performSync(true); // Force sync all
    console.log("Second sync result:", JSON.stringify(result2, null, 2));

    // List all files
    const allFiles = await browser.execute(() => {
      // @ts-ignore
      const vault = window.app.vault;
      return vault.getFiles().map((f: any) => ({
        path: f.path,
        size: f.stat.size
      }));
    });
    console.log("All files after second sync:", allFiles);

    // Debug: Check file content even if only 1 file
    if (allFiles.length === 1) {
      const singleFileContent = await TestUtils.getFileContent(allFiles[0].path);
      console.log("Single file content (should not have both meetings):", singleFileContent);
    }
    
    // Should have 2 separate files (allow for extra files from test environment)
    expect(allFiles.length).toBeGreaterThanOrEqual(2);

    // Check each file content - find our specific test files
    const file1Path = allFiles.find((f: any) => f.path.includes("Josh - Andrea"))?.path;
    const file2Path = allFiles.find((f: any) => f.path.includes("DJB Eval"))?.path;
    
    // Ensure both test files exist
    expect(file1Path).toBeDefined();
    expect(file2Path).toBeDefined();
    
    const file1After = await TestUtils.getFileContent(file1Path!);
    const file2After = await TestUtils.getFileContent(file2Path!);

    console.log("File 1 after second sync:", file1After);
    console.log("File 2 after second sync:", file2After);

    // Each file should contain only its own meeting
    expect(file1After).toContain("Josh - Andrea 11");
    expect(file1After).not.toContain("DJB Eval");

    expect(file2After).toContain("DJB Eval & Coding");
    expect(file2After).not.toContain("Josh - Andrea");
  });

  it("should handle conflict detection correctly with unique filenames", async () => {
    // Configure plugin
    await TestUtils.configurePlugin({
      targetFolder: "Meetings",
      folderOrganization: "by-date",
      dateFolderFormat: "daily",
      includeDateInFilename: true,
      dateFormat: "yyyy-MM-dd"
    });

    // Create a meeting
    const meeting: MockMeeting = {
      id: "test-conflict",
      title: "Conflict Test Meeting",
      date: new Date("2025-06-25T10:00:00Z"),
      summary: "Testing conflict detection"
    };

    await TestUtils.mockGranolaAPI([meeting]);
    await TestUtils.performSync(true);

    // Modify the file locally
    const filePath = "Meetings/2025-06-25/2025-06-25 Conflict Test Meeting -- -conflict.md";
    await browser.execute(async (path: string) => {
      // @ts-ignore
      const vault = window.app.vault;
      const file = vault.getAbstractFileByPath(path);
      if (file && 'extension' in file && file.extension === 'md') {
        const content = await vault.read(file as any);
        await vault.modify(file as any, content + "\n\n## Local Notes\nAdded by user");
      }
    }, filePath);

    // Sync again with updated meeting
    meeting.summary = "Updated summary from Granola";
    await TestUtils.mockGranolaAPI([meeting]);
    
    // Enable conflict detection
    await browser.execute(() => {
      // @ts-ignore
      const plugin = window.app.plugins.plugins["obsidian-granola-sync"];
      plugin.syncEngine.enableConflictDetection = true;
    });

    const result = await TestUtils.performSync(false);
    console.log("Sync with conflict result:", result);

    // Check the file content
    const content = await TestUtils.getFileContent(filePath);
    console.log("File content after conflict sync:", content);

    // Should either skip or have conflict markers, not duplicate content
    const headerCount = (content?.match(/^# Conflict Test Meeting/gm) || []).length;
    expect(headerCount).toBe(1); // Should only have one header, not duplicated
  });
});