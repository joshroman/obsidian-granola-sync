import { browser } from "@wdio/globals";
import { expect } from "@wdio/globals";
import { TestUtils } from "./helpers/test-utils";

describe("Daily Note Backlink Integration", () => {
  beforeEach(async () => {
    // Clear any existing test data
    await TestUtils.clearTestData();
    
    // Configure plugin to skip wizard and use enhanced frontmatter
    await TestUtils.configurePlugin({
      targetFolder: "Meetings",
      folderOrganization: "flat",
      includeDateInFilename: true,
      wizardCompleted: true
    });
    
    // Ensure file explorer is ready
    await TestUtils.ensureFileExplorerReady();
  });

  afterEach(async () => {
    // Clean up test data
    await TestUtils.clearTestData();
  });

  describe("Knowledge Worker Journey - Enhanced Frontmatter", () => {
    it("should generate enhanced frontmatter for new meetings", async () => {
      console.log("Testing enhanced frontmatter generation...");

      // Arrange: Create a test meeting with all required fields
      const testMeeting = {
        id: "test-meeting-enhanced-fm",
        title: "Daily Standup Team Meeting",
        date: new Date("2024-01-15T10:00:00Z"),
        attendees: ["Alice Smith", "Bob Johnson", "Charlie Wilson"],
        duration: 30
      };

      // Mock Granola API response
      await TestUtils.mockGranolaAPI([testMeeting]);

      // Act: Perform sync
      await TestUtils.performSync(true);
      
      // Wait for sync to complete
      await browser.pause(2000);

      // Assert: Read the created meeting note
      const noteContent = await TestUtils.readMeetingNote("Daily Standup Team Meeting - 2024-01-15");
      
      // Verify enhanced frontmatter structure
      expect(noteContent).toContain('granolaId: "test-meeting-enhanced-fm"');
      expect(noteContent).toContain('title: "Daily Standup Team Meeting"');
      expect(noteContent).toContain('date: "2024-01-15"');  // YYYY-MM-DD format
      expect(noteContent).toContain('time: "10:00"');       // HH:mm format
      expect(noteContent).toContain('type: "meeting"');     // New field
      expect(noteContent).toContain('duration: 30');        // Preserved
      expect(noteContent).toContain('daily-note: "[[2024-01-15]]"'); // New field
      
      // Verify attendees array format
      expect(noteContent).toContain('attendees:');
      expect(noteContent).toContain('  - "Alice Smith"');
      expect(noteContent).toContain('  - "Bob Johnson"');
      expect(noteContent).toContain('  - "Charlie Wilson"');
      
      // Verify tags field is removed
      expect(noteContent).not.toContain('tags:');
      
      console.log("Enhanced frontmatter verified successfully");
    });

    it("should handle meeting without duration correctly", async () => {
      console.log("Testing meeting without duration...");

      // Arrange: Meeting without duration
      const meetingNoDuration = {
        id: "test-meeting-no-duration",
        title: "Quick Check-in",
        date: new Date("2024-01-15T14:00:00Z"),
        attendees: ["David Lee"]
        // No duration field
      };

      await TestUtils.mockGranolaAPI([meetingNoDuration]);

      // Act: Sync meeting
      await TestUtils.performSync(true);
      await browser.pause(2000);

      // Assert: Check frontmatter omits duration field
      const noteContent = await TestUtils.readMeetingNote("Quick Check-in - 2024-01-15");
      
      expect(noteContent).toContain('date: "2024-01-15"');
      expect(noteContent).toContain('time: "14:00"');
      expect(noteContent).toContain('type: "meeting"');
      expect(noteContent).toContain('daily-note: "[[2024-01-15]]"');
      expect(noteContent).not.toContain('duration:');
      
      console.log("Meeting without duration handled correctly");
    });

    it("should handle meeting without attendees correctly", async () => {
      console.log("Testing meeting without attendees...");

      // Arrange: Meeting with empty attendees
      const meetingNoAttendees = {
        id: "test-meeting-no-attendees",
        title: "Solo Planning Session",
        date: new Date("2024-01-15T16:00:00Z"),
        attendees: [],
        duration: 60
      };

      await TestUtils.mockGranolaAPI([meetingNoAttendees]);

      // Act: Sync meeting
      await TestUtils.performSync(true);
      await browser.pause(2000);

      // Assert: Check frontmatter includes empty attendees array
      const noteContent = await TestUtils.readMeetingNote("Solo Planning Session - 2024-01-15");
      
      expect(noteContent).toContain('attendees: []');
      expect(noteContent).toContain('duration: 60');
      
      console.log("Meeting without attendees handled correctly");
    });

    it("should handle special characters in meeting titles", async () => {
      console.log("Testing special characters in meeting titles...");

      // Arrange: Meeting with YAML-problematic characters
      const meetingSpecialChars = {
        id: "test-meeting-special-chars",
        title: 'Meeting: "Planning & Review" [Q1]',
        date: new Date("2024-01-15T09:00:00Z"),
        attendees: ["Emily O'Connor"],
        duration: 45
      };

      await TestUtils.mockGranolaAPI([meetingSpecialChars]);

      // Act: Sync meeting
      await TestUtils.performSync(true);
      await browser.pause(2000);

      // Assert: Check YAML is properly escaped
      const noteContent = await TestUtils.readMeetingNote('Meeting: "Planning & Review" [Q1] - 2024-01-15');
      
      expect(noteContent).toContain('title: "Meeting: \\"Planning & Review\\" [Q1]"');
      expect(noteContent).toContain('  - "Emily O\'Connor"');
      
      console.log("Special characters handled correctly");
    });
  });

  describe("Edge Cases & Error Handling", () => {
    it("should handle timezone edge cases correctly", async () => {
      console.log("Testing timezone handling...");

      // Arrange: Meeting that crosses timezone boundaries
      const timezoneEdgeMeeting = {
        id: "test-meeting-timezone",
        title: "Global Team Sync",
        date: new Date("2024-01-15T23:30:00Z"), // Late UTC time
        attendees: ["Global Team"],
        duration: 60
      };

      await TestUtils.mockGranolaAPI([timezoneEdgeMeeting]);

      // Act: Sync meeting
      await TestUtils.performSync(true);
      await browser.pause(2000);

      // Assert: Check date and time extraction
      const noteContent = await TestUtils.readMeetingNote("Global Team Sync - 2024-01-15");
      
      expect(noteContent).toContain('date: "2024-01-15"');
      expect(noteContent).toContain('time: "23:30"');
      expect(noteContent).toContain('daily-note: "[[2024-01-15]]"');
      
      console.log("Timezone edge case handled correctly");
    });

    it("should handle multiple meetings on same day", async () => {
      console.log("Testing multiple meetings same day...");

      // Arrange: Multiple meetings on same day
      const meetings = [
        {
          id: "meeting-morning",
          title: "Morning Standup",
          date: new Date("2024-01-15T09:00:00Z"),
          attendees: ["Team A"],
          duration: 15
        },
        {
          id: "meeting-afternoon",
          title: "Afternoon Review",
          date: new Date("2024-01-15T15:00:00Z"),
          attendees: ["Team B"],
          duration: 45
        }
      ];

      await TestUtils.mockGranolaAPI(meetings);

      // Act: Sync all meetings
      await TestUtils.performSync(true);
      await browser.pause(3000);

      // Assert: Check both meetings have correct frontmatter
      const morningNote = await TestUtils.readMeetingNote("Morning Standup - 2024-01-15");
      const afternoonNote = await TestUtils.readMeetingNote("Afternoon Review - 2024-01-15");
      
      // Morning meeting
      expect(morningNote).toContain('date: "2024-01-15"');
      expect(morningNote).toContain('time: "09:00"');
      expect(morningNote).toContain('daily-note: "[[2024-01-15]]"');
      
      // Afternoon meeting
      expect(afternoonNote).toContain('date: "2024-01-15"');
      expect(afternoonNote).toContain('time: "15:00"');
      expect(afternoonNote).toContain('daily-note: "[[2024-01-15]]"');
      
      console.log("Multiple meetings same day handled correctly");
    });

    it("should maintain consistency on re-sync", async () => {
      console.log("Testing re-sync consistency...");

      // Arrange: Meeting that will be synced twice
      const testMeeting = {
        id: "test-meeting-resync",
        title: "Consistency Test Meeting",
        date: new Date("2024-01-15T11:00:00Z"),
        attendees: ["Consistency Tester"],
        duration: 30
      };

      await TestUtils.mockGranolaAPI([testMeeting]);

      // Act: Sync twice
      await TestUtils.performSync(true);
      await browser.pause(2000);
      
      const firstSyncContent = await TestUtils.readMeetingNote("Consistency Test Meeting - 2024-01-15");
      
      await TestUtils.performSync(true);
      await browser.pause(2000);
      
      const secondSyncContent = await TestUtils.readMeetingNote("Consistency Test Meeting - 2024-01-15");

      // Assert: Content should be identical
      expect(firstSyncContent).toEqual(secondSyncContent);
      
      console.log("Re-sync consistency verified");
    });
  });

  describe("Integration Tests", () => {
    it("should work with existing sync engine functionality", async () => {
      console.log("Testing integration with existing sync engine...");

      // Arrange: Mix of meetings with different complexity
      const complexMeetings = [
        {
          id: "simple-meeting",
          title: "Simple Meeting",
          date: new Date("2024-01-15T10:00:00Z"),
          attendees: ["Single Attendee"]
        },
        {
          id: "complex-meeting",
          title: "Complex Meeting with All Fields",
          date: new Date("2024-01-15T14:00:00Z"),
          attendees: ["Attendee 1", "Attendee 2", "Attendee 3"],
          duration: 90
        }
      ];

      await TestUtils.mockGranolaAPI(complexMeetings);

      // Act: Sync with existing engine
      await TestUtils.performSync(true);
      await browser.pause(3000);

      // Assert: All meetings processed correctly
      const simpleNote = await TestUtils.readMeetingNote("Simple Meeting - 2024-01-15");
      const complexNote = await TestUtils.readMeetingNote("Complex Meeting with All Fields - 2024-01-15");
      
      // Simple meeting
      expect(simpleNote).toContain('type: "meeting"');
      expect(simpleNote).toContain('daily-note: "[[2024-01-15]]"');
      expect(simpleNote).not.toContain('duration:');
      
      // Complex meeting
      expect(complexNote).toContain('type: "meeting"');
      expect(complexNote).toContain('daily-note: "[[2024-01-15]]"');
      expect(complexNote).toContain('duration: 90');
      expect(complexNote).toContain('  - "Attendee 1"');
      expect(complexNote).toContain('  - "Attendee 2"');
      expect(complexNote).toContain('  - "Attendee 3"');
      
      console.log("Integration with sync engine verified");
    });

    it("should validate YAML frontmatter structure", async () => {
      console.log("Testing YAML frontmatter validation...");

      // Arrange: Meeting that could cause YAML issues
      const yamlTestMeeting = {
        id: "yaml-test-meeting",
        title: "YAML Test: Validation & Verification",
        date: new Date("2024-01-15T13:00:00Z"),
        attendees: ["YAML Tester", "Validation Expert"],
        duration: 45
      };

      await TestUtils.mockGranolaAPI([yamlTestMeeting]);

      // Act: Sync meeting
      await TestUtils.performSync(true);
      await browser.pause(2000);

      // Assert: Validate YAML can be parsed
      const noteContent = await TestUtils.readMeetingNote("YAML Test: Validation & Verification - 2024-01-15");
      
      // Extract frontmatter and validate it's parseable YAML
      const yamlResult = await browser.execute((content) => {
        try {
          // Extract frontmatter content between --- markers
          const yamlMatch = content.match(/^---([\s\S]*?)---/);
          if (!yamlMatch) return { error: "No frontmatter found" };
          
          const yamlContent = yamlMatch[1];
          
          // Basic YAML validation - check for proper structure
          const lines = yamlContent.trim().split('\n');
          const validationErrors = [];
          
          for (const line of lines) {
            if (line.trim() === '') continue;
            if (!line.includes(':') && !line.startsWith('  -')) {
              validationErrors.push(`Invalid YAML line: ${line}`);
            }
          }
          
          return {
            valid: validationErrors.length === 0,
            errors: validationErrors,
            yamlContent: yamlContent
          };
        } catch (error) {
          return { error: error.message };
        }
      }, noteContent);
      
      expect(yamlResult.valid).toBe(true);
      expect(yamlResult.errors).toHaveLength(0);
      
      console.log("YAML frontmatter structure validated");
    });
  });

  describe("Performance Tests", () => {
    it("should handle large number of meetings efficiently", async () => {
      console.log("Testing performance with multiple meetings...");

      // Arrange: Generate 50 meetings for performance test
      const manyMeetings = [];
      for (let i = 1; i <= 50; i++) {
        manyMeetings.push({
          id: `perf-meeting-${i}`,
          title: `Performance Test Meeting ${i}`,
          date: new Date(`2024-01-${String(i % 28 + 1).padStart(2, '0')}T${String(9 + (i % 8)).padStart(2, '0')}:00:00Z`),
          attendees: [`Attendee ${i}`, `Attendee ${i + 1}`],
          duration: 30 + (i % 60)
        });
      }

      await TestUtils.mockGranolaAPI(manyMeetings);

      // Act: Measure sync performance
      const startTime = Date.now();
      await TestUtils.performSync(true);
      await browser.pause(5000); // Allow time for all processing
      const endTime = Date.now();

      const syncDuration = endTime - startTime;

      // Assert: Performance within acceptable bounds
      expect(syncDuration).toBeLessThan(60000); // Should complete within 60 seconds
      
      // Verify a sample of meetings have correct frontmatter
      const sampleNote = await TestUtils.readMeetingNote("Performance Test Meeting 1 - 2024-01-01");
      expect(sampleNote).toContain('type: "meeting"');
      expect(sampleNote).toContain('daily-note: "[[2024-01-01]]"');
      
      console.log(`Performance test completed in ${syncDuration}ms for 50 meetings`);
    });

    it("should not impact memory usage significantly", async () => {
      console.log("Testing memory usage impact...");

      // Arrange: Get baseline memory usage
      const baselineMemory = await browser.execute(() => {
        return {
          // @ts-ignore
          usedJSHeapSize: performance.memory?.usedJSHeapSize || 0,
          // @ts-ignore
          totalJSHeapSize: performance.memory?.totalJSHeapSize || 0
        };
      });

      // Create meetings with frontmatter
      const memoryTestMeetings = [];
      for (let i = 1; i <= 20; i++) {
        memoryTestMeetings.push({
          id: `memory-test-${i}`,
          title: `Memory Test Meeting ${i}`,
          date: new Date(`2024-01-15T${String(9 + i).padStart(2, '0')}:00:00Z`),
          attendees: [`User A`, `User B`, `User C`],
          duration: 45
        });
      }

      await TestUtils.mockGranolaAPI(memoryTestMeetings);

      // Act: Perform sync
      await TestUtils.performSync(true);
      await browser.pause(3000);

      // Measure memory after sync
      const afterSyncMemory = await browser.execute(() => {
        return {
          // @ts-ignore
          usedJSHeapSize: performance.memory?.usedJSHeapSize || 0,
          // @ts-ignore
          totalJSHeapSize: performance.memory?.totalJSHeapSize || 0
        };
      });

      // Assert: Memory usage increase should be reasonable
      const memoryIncrease = afterSyncMemory.usedJSHeapSize - baselineMemory.usedJSHeapSize;
      const memoryIncreasePercent = (memoryIncrease / baselineMemory.usedJSHeapSize) * 100;

      expect(memoryIncreasePercent).toBeLessThan(50); // Should not increase by more than 50%
      
      console.log(`Memory usage increased by ${memoryIncreasePercent.toFixed(2)}%`);
    });
  });

  describe("Visual Regression Tests", () => {
    it("should maintain consistent note formatting", async () => {
      console.log("Testing visual consistency of meeting notes...");

      // Arrange: Create a standard meeting for visual testing
      const visualTestMeeting = {
        id: "visual-test-meeting",
        title: "Visual Regression Test Meeting",
        date: new Date("2024-01-15T10:00:00Z"),
        attendees: ["Visual Tester", "Regression Validator"],
        duration: 60
      };

      await TestUtils.mockGranolaAPI([visualTestMeeting]);

      // Act: Sync meeting
      await TestUtils.performSync(true);
      await browser.pause(2000);

      // Open the meeting note for visual verification
      await browser.execute(() => {
        // @ts-ignore
        const app = window.app;
        app.workspace.openLinkText("Visual Regression Test Meeting - 2024-01-15", "", false);
      });

      await browser.pause(1000);

      // Assert: Take screenshot for visual regression comparison
      await browser.saveScreenshot('./test-screenshots/daily-note-backlink-visual-test.png');
      
      // Verify the note opened and displays correctly
      const noteTitle = await browser.execute(() => {
        // @ts-ignore
        const app = window.app;
        const activeFile = app.workspace.getActiveFile();
        return activeFile?.name || "No active file";
      });

      expect(noteTitle).toContain("Visual Regression Test Meeting");
      
      console.log("Visual regression test completed");
    });
  });
});