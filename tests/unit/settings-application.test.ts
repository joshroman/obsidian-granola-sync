import { PathGenerator } from '../../src/utils/path-generator';
import { Meeting, PluginSettings, DEFAULT_SETTINGS } from '../../src/types';

describe('Settings Application Tests', () => {
  let pathGenerator: PathGenerator;
  let settings: PluginSettings;
  let testMeeting: Meeting;

  beforeEach(() => {
    settings = { ...DEFAULT_SETTINGS };
    pathGenerator = new PathGenerator(() => settings);
    
    testMeeting = {
      id: 'meeting-123abc',
      title: 'Team Planning Meeting',
      date: new Date('2025-06-26T10:00:00Z'),
      summary: 'Planning session',
      transcript: '',
      highlights: [],
      attendees: [],
      duration: 60,
      granolaFolder: 'Project Alpha',
      tags: [],
      attachments: []
    };
  });

  describe('Date Prefix Setting', () => {
    it('should include date prefix when enabled', () => {
      settings.includeDateInFilename = true;
      settings.dateFormat = 'yyyy-MM-dd';
      
      const path = pathGenerator.generatePath(testMeeting);
      
      expect(path).toContain('2025-06-26 Team Planning Meeting -- ');
    });

    it('should exclude date prefix and add unique suffix when disabled', () => {
      settings.includeDateInFilename = false;
      
      const path = pathGenerator.generatePath(testMeeting);
      
      expect(path).not.toContain('2025-06-26');
      expect(path).toContain('Team Planning Meeting -- g-123abc.md');
    });
  });

  describe('Folder Organization Setting', () => {
    it('should create flat structure when set to flat', () => {
      settings.folderOrganization = 'flat';
      settings.targetFolder = 'Meetings';
      
      const path = pathGenerator.generatePath(testMeeting);
      
      expect(path).toMatch(/^Meetings\/[^\/]+\.md$/);
    });

    it('should create date-based folders when set to by-date', () => {
      settings.folderOrganization = 'by-date';
      settings.dateFolderFormat = 'daily';
      settings.targetFolder = 'Meetings';
      
      const path = pathGenerator.generatePath(testMeeting);
      
      expect(path).toContain('Meetings/2025-06-26/');
    });

    it('should create Granola folder structure when set to mirror-granola', () => {
      settings.folderOrganization = 'mirror-granola';
      settings.targetFolder = 'Meetings';
      
      const path = pathGenerator.generatePath(testMeeting);
      
      expect(path).toContain('Meetings/Project Alpha/');
    });

    it('should handle missing Granola folder gracefully', () => {
      settings.folderOrganization = 'mirror-granola';
      settings.targetFolder = 'Meetings';
      testMeeting.granolaFolder = '';
      
      const path = pathGenerator.generatePath(testMeeting);
      
      // Should fallback to flat structure
      expect(path).toMatch(/^Meetings\/[^\/]+\.md$/);
    });
  });

  describe('Combined Settings', () => {
    it('should apply all settings correctly together', () => {
      settings.includeDateInFilename = false;
      settings.folderOrganization = 'mirror-granola';
      settings.targetFolder = 'My Notes';
      
      const path = pathGenerator.generatePath(testMeeting);
      
      expect(path).toBe('My Notes/Project Alpha/Team Planning Meeting -- g-123abc.md');
    });

    it('should handle special characters in paths', () => {
      settings.folderOrganization = 'mirror-granola';
      settings.includeDateInFilename = false;
      testMeeting.granolaFolder = 'Project: Alpha/Beta';
      testMeeting.title = 'Meeting @ 10:00 AM';
      
      const path = pathGenerator.generatePath(testMeeting);
      
      // Should sanitize special characters
      expect(path).not.toContain(':');
      expect(path).toContain('Project Alpha/Beta'); // Slashes are preserved in folder structure
      expect(path).toContain('Meeting @ 1000 AM -- g-123abc.md');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty meeting title', () => {
      testMeeting.title = '';
      
      const path = pathGenerator.generatePath(testMeeting);
      
      expect(path).toContain('Untitled Meeting');
    });

    it('should handle very long meeting titles', () => {
      testMeeting.title = 'A'.repeat(300);
      
      const path = pathGenerator.generatePath(testMeeting);
      
      // Should truncate to reasonable length
      expect(path.length).toBeLessThan(260); // Windows path limit
    });
  });
});