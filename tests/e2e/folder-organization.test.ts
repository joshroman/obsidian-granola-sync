import GranolaSyncPlugin from '../../src/main';
import { createTestEnvironment, setupPluginMocks, TestEnvironment } from '../setup/test-helpers';
import { DEFAULT_SETTINGS } from '../../src/types';

describe('Folder Organization E2E Tests', () => {
  let env: TestEnvironment;
  let plugin: GranolaSyncPlugin;

  beforeEach(async () => {
    env = createTestEnvironment();
    plugin = new GranolaSyncPlugin(env.app as any, env.manifest);
    setupPluginMocks(plugin, { apiKey: 'test-key' });
    
    await plugin.onload();
  });

  afterEach(async () => {
    await plugin.onunload();
  });

  describe('Flat organization', () => {
    it('should save all meetings in target folder without subfolders', async () => {
      plugin.settings = {
        ...DEFAULT_SETTINGS,
        apiKey: 'test-key',
        targetFolder: 'Meetings',
        folderOrganization: 'flat'
      };

      const meetings = [
        {
          id: '1',
          title: 'Team Standup',
          date: new Date('2024-03-20'),
          summary: 'Daily sync'
        },
        {
          id: '2',
          title: 'Client Meeting',
          date: new Date('2024-03-21'),
          summary: 'Project review'
        }
      ];

      // Mock API to return meetings
      if (plugin.granolaService) {
        plugin.granolaService.getAllMeetings = jest.fn().mockResolvedValue(meetings);
        plugin.granolaService.testConnection = jest.fn().mockResolvedValue(true);
      }

      await plugin.performSync();

      // Verify files created in flat structure
      // Note: Date may vary by timezone
      expect(env.vault.create).toHaveBeenCalledWith(
        expect.stringMatching(/^Meetings\/2024-03-(19|20) Team Standup\.md$/),
        expect.any(String)
      );
      expect(env.vault.create).toHaveBeenCalledWith(
        expect.stringMatching(/^Meetings\/2024-03-(20|21) Client Meeting\.md$/),
        expect.any(String)
      );
    });
  });

  describe('By-date organization', () => {
    it('should organize meetings in daily folders', async () => {
      plugin.settings = {
        ...DEFAULT_SETTINGS,
        apiKey: 'test-key',
        targetFolder: 'Meetings',
        folderOrganization: 'by-date',
        dateFolderFormat: 'daily'
      };

      const meetings = [
        {
          id: '1',
          title: 'Morning Meeting',
          date: new Date('2024-03-20T09:00:00'),
          summary: 'Daily sync'
        },
        {
          id: '2',
          title: 'Afternoon Meeting',
          date: new Date('2024-03-20T14:00:00'),
          summary: 'Follow-up'
        },
        {
          id: '3',
          title: 'Next Day Meeting',
          date: new Date('2024-03-21T10:00:00'),
          summary: 'Planning'
        }
      ];

      plugin.granolaService.getAllMeetings = jest.fn().mockResolvedValue(meetings);
      plugin.granolaService.testConnection = jest.fn().mockResolvedValue(true);

      await plugin.performSync();

      // Verify folder creation (may vary by timezone)
      const folderCalls = (env.vault.createFolder as jest.Mock).mock.calls.map(call => call[0]);
      expect(folderCalls).toContain(expect.stringMatching(/Meetings\/2024-03-(19|20)/));
      expect(folderCalls).toContain(expect.stringMatching(/Meetings\/2024-03-(20|21)/));

      // Verify files in correct folders
      expect(env.vault.create).toHaveBeenCalledWith(
        expect.stringMatching(/^Meetings\/2024-03-(19|20)\/2024-03-(19|20) Morning Meeting\.md$/),
        expect.any(String)
      );
      expect(env.vault.create).toHaveBeenCalledWith(
        expect.stringMatching(/^Meetings\/2024-03-(19|20)\/2024-03-(19|20) Afternoon Meeting\.md$/),
        expect.any(String)
      );
      expect(env.vault.create).toHaveBeenCalledWith(
        expect.stringMatching(/^Meetings\/2024-03-(20|21)\/2024-03-(20|21) Next Day Meeting\.md$/),
        expect.any(String)
      );
    });

    it('should organize meetings in weekly folders', async () => {
      plugin.settings = {
        ...DEFAULT_SETTINGS,
        apiKey: 'test-key',
        targetFolder: 'Meetings',
        folderOrganization: 'by-date',
        dateFolderFormat: 'weekly',
        weekFormat: 'yyyy-[W]ww'
      };

      const meetings = [
        {
          id: '1',
          title: 'Week 12 Monday',
          date: new Date('2024-03-18'), // Monday of week 12
          summary: 'Start of week'
        },
        {
          id: '2',
          title: 'Week 12 Friday',
          date: new Date('2024-03-22'), // Friday of week 12
          summary: 'End of week'
        },
        {
          id: '3',
          title: 'Week 13 Monday',
          date: new Date('2024-03-25'), // Monday of week 13
          summary: 'Next week'
        }
      ];

      plugin.granolaService.getAllMeetings = jest.fn().mockResolvedValue(meetings);
      plugin.granolaService.testConnection = jest.fn().mockResolvedValue(true);

      await plugin.performSync();

      // Verify weekly folder creation
      expect(env.vault.createFolder).toHaveBeenCalledWith('Meetings/2024-W12');
      expect(env.vault.createFolder).toHaveBeenCalledWith('Meetings/2024-W13');

      // Verify files in correct weekly folders
      expect(env.vault.create).toHaveBeenCalledWith(
        expect.stringMatching(/^Meetings\/2024-W12\/2024-03-18 Week 12 Monday\.md$/),
        expect.any(String)
      );
      expect(env.vault.create).toHaveBeenCalledWith(
        expect.stringMatching(/^Meetings\/2024-W12\/2024-03-22 Week 12 Friday\.md$/),
        expect.any(String)
      );
      expect(env.vault.create).toHaveBeenCalledWith(
        expect.stringMatching(/^Meetings\/2024-W13\/2024-03-25 Week 13 Monday\.md$/),
        expect.any(String)
      );
    });
  });

  describe('Mirror Granola organization', () => {
    it('should mirror Granola folder structure', async () => {
      plugin.settings = {
        ...DEFAULT_SETTINGS,
        apiKey: 'test-key',
        targetFolder: 'Meetings',
        folderOrganization: 'mirror-granola'
      };

      const meetings = [
        {
          id: '1',
          title: 'Project A Meeting',
          date: new Date('2024-03-20'),
          granolaFolder: 'Work/ProjectA',
          summary: 'Project sync'
        },
        {
          id: '2',
          title: 'Project B Meeting',
          date: new Date('2024-03-20'),
          granolaFolder: 'Work/ProjectB',
          summary: 'Different project'
        },
        {
          id: '3',
          title: 'Personal Meeting',
          date: new Date('2024-03-20'),
          granolaFolder: 'Personal',
          summary: 'Personal notes'
        },
        {
          id: '4',
          title: 'No Folder Meeting',
          date: new Date('2024-03-20'),
          summary: 'Should go to root'
        }
      ];

      plugin.granolaService.getAllMeetings = jest.fn().mockResolvedValue(meetings);
      plugin.granolaService.testConnection = jest.fn().mockResolvedValue(true);

      await plugin.performSync();

      // Verify nested folder creation
      expect(env.vault.createFolder).toHaveBeenCalledWith('Meetings/Work');
      expect(env.vault.createFolder).toHaveBeenCalledWith('Meetings/Work/ProjectA');
      expect(env.vault.createFolder).toHaveBeenCalledWith('Meetings/Work/ProjectB');
      expect(env.vault.createFolder).toHaveBeenCalledWith('Meetings/Personal');

      // Verify files in mirrored structure
      expect(env.vault.create).toHaveBeenCalledWith(
        expect.stringMatching(/^Meetings\/Work\/ProjectA\/2024-03-20 Project A Meeting\.md$/),
        expect.any(String)
      );
      expect(env.vault.create).toHaveBeenCalledWith(
        expect.stringMatching(/^Meetings\/Work\/ProjectB\/2024-03-20 Project B Meeting\.md$/),
        expect.any(String)
      );
      expect(env.vault.create).toHaveBeenCalledWith(
        expect.stringMatching(/^Meetings\/Personal\/2024-03-20 Personal Meeting\.md$/),
        expect.any(String)
      );
      expect(env.vault.create).toHaveBeenCalledWith(
        expect.stringMatching(/^Meetings\/2024-03-20 No Folder Meeting\.md$/),
        expect.any(String)
      );
    });

    it('should handle malicious folder paths safely', async () => {
      plugin.settings = {
        ...DEFAULT_SETTINGS,
        apiKey: 'test-key',
        targetFolder: 'Meetings',
        folderOrganization: 'mirror-granola'
      };

      const meetings = [
        {
          id: '1',
          title: 'Malicious Path 1',
          date: new Date('2024-03-20'),
          granolaFolder: '../../../etc/passwd',
          summary: 'Path traversal attempt'
        },
        {
          id: '2',
          title: 'Malicious Path 2',
          date: new Date('2024-03-20'),
          granolaFolder: '/absolute/path',
          summary: 'Absolute path attempt'
        },
        {
          id: '3',
          title: 'Malicious Path 3',
          date: new Date('2024-03-20'),
          granolaFolder: 'C:\\Windows\\System32',
          summary: 'Windows path attempt'
        }
      ];

      plugin.granolaService.getAllMeetings = jest.fn().mockResolvedValue(meetings);
      plugin.granolaService.testConnection = jest.fn().mockResolvedValue(true);

      // Should not throw, but should handle safely
      await plugin.performSync();

      // Verify no files created with malicious paths
      const createdPaths = (env.vault.create as jest.Mock).mock.calls.map(call => call[0]);
      
      expect(createdPaths).not.toContain(expect.stringContaining('..'));
      expect(createdPaths).not.toContain(expect.stringMatching(/^[/\\]/));
      expect(createdPaths).not.toContain(expect.stringContaining('etc/passwd'));
      expect(createdPaths).not.toContain(expect.stringContaining('System32'));
    });
  });

  describe('File naming formats', () => {
    it('should use meeting name only format', async () => {
      plugin.settings = {
        ...DEFAULT_SETTINGS,
        apiKey: 'test-key',
        targetFolder: 'Meetings',
        fileNamingFormat: 'meeting-name',
        folderOrganization: 'flat'
      };

      const meetings = [
        {
          id: '1',
          title: 'Weekly Review',
          date: new Date('2024-03-20'),
          summary: 'Team review'
        }
      ];

      plugin.granolaService.getAllMeetings = jest.fn().mockResolvedValue(meetings);
      plugin.granolaService.testConnection = jest.fn().mockResolvedValue(true);

      await plugin.performSync();

      // Verify filename without date prefix
      expect(env.vault.create).toHaveBeenCalledWith(
        'Meetings/Weekly Review.md',
        expect.any(String)
      );
    });

    it('should use custom date format', async () => {
      plugin.settings = {
        ...DEFAULT_SETTINGS,
        apiKey: 'test-key',
        targetFolder: 'Meetings',
        fileNamingFormat: 'date-meeting-name',
        dateFormat: 'dd-MM-yyyy',
        folderOrganization: 'flat'
      };

      const meetings = [
        {
          id: '1',
          title: 'Team Meeting',
          date: new Date('2024-03-20'),
          summary: 'Daily sync'
        }
      ];

      plugin.granolaService.getAllMeetings = jest.fn().mockResolvedValue(meetings);
      plugin.granolaService.testConnection = jest.fn().mockResolvedValue(true);

      await plugin.performSync();

      // Verify custom date format
      expect(env.vault.create).toHaveBeenCalledWith(
        'Meetings/20-03-2024 Team Meeting.md',
        expect.any(String)
      );
    });
  });

  describe('File movement on organization change', () => {
    it('should move files when folder organization changes', async () => {
      // Initial sync with flat organization
      plugin.settings = {
        ...DEFAULT_SETTINGS,
        apiKey: 'test-key',
        targetFolder: 'Meetings',
        folderOrganization: 'flat'
      };

      const meetings = [
        {
          id: '1',
          title: 'Team Meeting',
          date: new Date('2024-03-20'),
          summary: 'Daily sync'
        }
      ];

      plugin.granolaService.getAllMeetings = jest.fn().mockResolvedValue(meetings);
      plugin.granolaService.testConnection = jest.fn().mockResolvedValue(true);

      await plugin.performSync();

      // Simulate existing file
      const existingFile = { path: 'Meetings/2024-03-20 Team Meeting.md' };
      env.vault.getAbstractFileByPath = jest.fn().mockReturnValue(existingFile);
      
      // Change to by-date organization
      plugin.settings.folderOrganization = 'by-date';
      plugin.settings.dateFolderFormat = 'daily';

      // Clear previous mocks
      jest.clearAllMocks();
      plugin.granolaService.getAllMeetings = jest.fn().mockResolvedValue(meetings);
      plugin.granolaService.testConnection = jest.fn().mockResolvedValue(true);

      await plugin.performSync();

      // Verify file was moved
      expect(env.vault.rename).toHaveBeenCalledWith(
        existingFile,
        'Meetings/2024-03-20/2024-03-20 Team Meeting.md'
      );
    });
  });
});