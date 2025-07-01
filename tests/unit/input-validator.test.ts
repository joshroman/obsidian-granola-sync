import { InputValidator } from '../../src/utils/input-validator';

describe('InputValidator', () => {
  describe('validateMeetingTitle', () => {
    test('handles normal titles', () => {
      const result = InputValidator.validateMeetingTitle('Team Standup');
      expect(result).toBe('Team Standup');
    });
    
    test('replaces invalid path characters with dash separator', () => {
      const input = 'Meeting: Project <Status> | Q&A?';
      const result = InputValidator.validateMeetingTitle(input);
      expect(result).toBe('Meeting - Project - Status - Q&A');
      
      // Test each invalid character gets cleaned up properly (no trailing separators)
      expect(InputValidator.validateMeetingTitle('Test<')).toBe('Test');
      expect(InputValidator.validateMeetingTitle('Test>')).toBe('Test');
      expect(InputValidator.validateMeetingTitle('Test:')).toBe('Test');
      expect(InputValidator.validateMeetingTitle('Test"')).toBe('Test');
      expect(InputValidator.validateMeetingTitle('Test|')).toBe('Test');
      expect(InputValidator.validateMeetingTitle('Test?')).toBe('Test');
      expect(InputValidator.validateMeetingTitle('Test*')).toBe('Test');
      expect(InputValidator.validateMeetingTitle('Test\\')).toBe('Test');
      
      // Test the main use case: forward slash  
      expect(InputValidator.validateMeetingTitle('Meeting with Bob/Jack')).toBe('Meeting with Bob - Jack');
    });
    
    test('cleans up multiple consecutive separators', () => {
      // Multiple invalid characters become single separator
      expect(InputValidator.validateMeetingTitle('Test<>:|')).toBe('Test');
      expect(InputValidator.validateMeetingTitle('Project//Review')).toBe('Project - Review');
      expect(InputValidator.validateMeetingTitle('Client\\|Server')).toBe('Client - Server');
      expect(InputValidator.validateMeetingTitle('/Start/Middle\\End|')).toBe('Start - Middle - End');
    });
    
    test('handles Windows reserved names', () => {
      expect(InputValidator.validateMeetingTitle('CON')).toBe('_CON');
      expect(InputValidator.validateMeetingTitle('PRN')).toBe('_PRN');
      expect(InputValidator.validateMeetingTitle('AUX')).toBe('_AUX');
      expect(InputValidator.validateMeetingTitle('NUL')).toBe('_NUL');
      expect(InputValidator.validateMeetingTitle('COM1')).toBe('_COM1');
      expect(InputValidator.validateMeetingTitle('LPT1')).toBe('_LPT1');
      
      // Case insensitive
      expect(InputValidator.validateMeetingTitle('con')).toBe('_con');
      expect(InputValidator.validateMeetingTitle('Con')).toBe('_Con');
    });
    
    test('handles empty or whitespace titles', () => {
      expect(InputValidator.validateMeetingTitle('')).toBe('Untitled Meeting');
      expect(InputValidator.validateMeetingTitle('   ')).toBe('Untitled Meeting');
      expect(InputValidator.validateMeetingTitle('\t\n')).toBe('Untitled Meeting');
    });
    
    test('handles leading dots', () => {
      expect(InputValidator.validateMeetingTitle('.hidden')).toBe('_hidden');
      expect(InputValidator.validateMeetingTitle('..double')).toBe('_..double');
    });
    
    test('handles trailing dots and spaces', () => {
      expect(InputValidator.validateMeetingTitle('Meeting...')).toBe('Meeting');
      expect(InputValidator.validateMeetingTitle('Meeting   ')).toBe('Meeting');
      expect(InputValidator.validateMeetingTitle('Meeting. . .')).toBe('Meeting');
    });
    
    test('removes control characters', () => {
      const withControl = 'Meeting\x00with\x1fcontrol\x7fchars';
      expect(InputValidator.validateMeetingTitle(withControl)).toBe('Meetingwithcontrolchars');
    });
    
    test('truncates long titles', () => {
      const longTitle = 'A'.repeat(250);
      const result = InputValidator.validateMeetingTitle(longTitle);
      expect(result.length).toBe(200);
      expect(result).toBe('A'.repeat(200));
    });
  });
  
  describe('validateFolderPath', () => {
    test('prevents path traversal', () => {
      expect(() => InputValidator.validateFolderPath('../outside'))
        .toThrow('Invalid folder path');
      expect(() => InputValidator.validateFolderPath('folder/../escape'))
        .toThrow('Invalid folder path');
      expect(() => InputValidator.validateFolderPath('/absolute/path'))
        .toThrow('Invalid folder path');
    });
    
    test('validates folder segments', () => {
      const result = InputValidator.validateFolderPath('Work/Project: Status/Q&A');
      expect(result).toBe('Work/Project - Status/Q&A');
    });
    
    test('handles empty segments', () => {
      const result = InputValidator.validateFolderPath('folder//double//slash');
      expect(result).toBe('folder/double/slash');
    });
    
    test('sanitizes each segment', () => {
      const result = InputValidator.validateFolderPath('CON/PRN/Regular');
      expect(result).toBe('_CON/_PRN/Regular');
    });
  });
  
  describe('validateMeetingData', () => {
    test('validates required fields', () => {
      expect(() => InputValidator.validateMeetingData(null))
        .toThrow('Invalid meeting data');
      expect(() => InputValidator.validateMeetingData({}))
        .toThrow('Meeting missing required id field');
      expect(() => InputValidator.validateMeetingData({ id: 123 }))
        .toThrow('Meeting missing required id field');
    });
    
    test('validates and sanitizes meeting data', () => {
      const input = {
        id: 'test-123',
        title: 'Meeting: Test',
        date: '2024-01-15T10:00:00Z',
        attendees: ['John', 123, 'Jane'], // Mixed types
        highlights: ['Point 1', null, 'Point 2'], // With null
        tags: ['tag1', '', 'tag2'], // With empty
        duration: '60', // String instead of number
        folder: 'Work/Project'
      };
      
      const result = InputValidator.validateMeetingData(input);
      
      expect(result.id).toBe('test-123');
      expect(result.title).toBe('Meeting - Test');
      expect(result.date).toEqual(new Date('2024-01-15T10:00:00Z'));
      expect(result.attendees).toEqual(['John', 'Jane']);
      expect(result.highlights).toEqual(['Point 1', 'Point 2']);
      expect(result.tags).toEqual(['tag1', 'tag2']);
      expect(result.duration).toBeUndefined(); // Invalid type
      expect(result.granolaFolder).toBe('Work/Project');
    });
    
    test('validates date field', () => {
      expect(() => InputValidator.validateMeetingData({
        id: 'test',
        date: 'invalid-date'
      })).toThrow('Invalid meeting date');
      
      expect(() => InputValidator.validateMeetingData({
        id: 'test',
        date: null
      })).toThrow('Invalid meeting date');
    });
    
    test('validates transcript size limit', () => {
      const largeMeeting = {
        id: 'test',
        date: new Date(),
        transcript: 'A'.repeat(11 * 1024 * 1024) // 11MB
      };
      
      expect(() => InputValidator.validateMeetingData(largeMeeting))
        .toThrow('transcript exceeds 10MB limit');
    });
    
    test('validates attachments', () => {
      const meeting = {
        id: 'test',
        date: new Date(),
        attachments: [
          { id: '1', name: 'file.pdf', url: 'http://example.com/file.pdf', type: 'application/pdf', size: 1024 },
          { id: '2', name: 'CON', url: 'http://example.com/con', type: 'text/plain', size: 100 },
          { invalid: 'object' }, // Invalid structure
          null, // Null attachment
          { id: '', name: 'no-id', url: 'http://example.com/no-id' } // Empty ID
        ]
      };
      
      const result = InputValidator.validateMeetingData(meeting);
      
      expect(result.attachments).toHaveLength(2);
      expect(result.attachments![0].name).toBe('file.pdf');
      expect(result.attachments![1].name).toBe('_CON'); // Sanitized
    });
  });
  
  describe('validateApiKey', () => {
    test('rejects invalid API keys', () => {
      expect(InputValidator.validateApiKey('')).toBe(false);
      expect(InputValidator.validateApiKey(null as any)).toBe(false);
      expect(InputValidator.validateApiKey(undefined as any)).toBe(false);
      expect(InputValidator.validateApiKey('   ')).toBe(false);
      expect(InputValidator.validateApiKey('short')).toBe(false); // Too short
      expect(InputValidator.validateApiKey('key with spaces')).toBe(false);
      expect(InputValidator.validateApiKey('key@with#special')).toBe(false);
    });
    
    test('accepts valid API keys', () => {
      expect(InputValidator.validateApiKey('simple-api-key')).toBe(true);
      expect(InputValidator.validateApiKey('API_KEY_123')).toBe(true);
      expect(InputValidator.validateApiKey('very-long-api-key-with-many-segments')).toBe(true);
      expect(InputValidator.validateApiKey('1234567890')).toBe(true); // Exactly 10 chars
    });
    
    test('trims whitespace before validation', () => {
      expect(InputValidator.validateApiKey('  valid-key-123  ')).toBe(true);
      expect(InputValidator.validateApiKey('\tvalid-key\n')).toBe(true);
    });
  });
  
  describe('sanitizePath', () => {
    test('ensures path length within OS limits', () => {
      const basePath = '/very/long/path/that/goes/on/and/on'.repeat(5);
      const filename = 'meeting-name-that-is-also-quite-long';
      
      const result = InputValidator.sanitizePath(basePath, filename);
      expect(result.length).toBeLessThanOrEqual(255);
      expect(result).toContain('.md');
    });
    
    test('throws error if base path too long', () => {
      const basePath = '/a'.repeat(240);
      const filename = 'short';
      
      expect(() => InputValidator.sanitizePath(basePath, filename))
        .toThrow('Base path too long');
    });
    
    test('truncates filename if needed', () => {
      const basePath = '/meetings';
      const longFilename = 'A'.repeat(300);
      
      const result = InputValidator.sanitizePath(basePath, longFilename);
      expect(result.length).toBeLessThanOrEqual(255);
      expect(result).toMatch(/^\/meetings\/A+\.md$/);
    });
  });
});
