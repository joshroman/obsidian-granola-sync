import { FileManager } from '../../src/utils/file-manager';
import { Plugin } from 'obsidian';
import { Logger } from '../../src/utils/logger';

describe('FileManager Security Tests', () => {
  let fileManager: FileManager;
  let mockPlugin: Plugin;
  let mockLogger: Logger;

  beforeEach(() => {
    mockPlugin = {
      app: {
        vault: {
          getAbstractFileByPath: jest.fn(),
          createFolder: jest.fn(),
          create: jest.fn(),
          modify: jest.fn(),
          read: jest.fn()
        }
      }
    } as any;

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    } as any;

    fileManager = new FileManager(mockPlugin, mockLogger);
  });

  describe('ReDoS Prevention', () => {
    it('should handle malicious panel titles without hanging', () => {
      const maliciousTitle = 'a'.repeat(1000) + '!'.repeat(1000);
      const content = `## Panel: Normal Panel\nContent here\n\n## Panel: ${maliciousTitle}\nMalicious content`;
      
      const startTime = Date.now();
      // Access private method via any cast
      const result = (fileManager as any).extractPanelSection(content, maliciousTitle);
      const endTime = Date.now();
      
      // Should complete quickly (under 100ms)
      expect(endTime - startTime).toBeLessThan(100);
      expect(result).toBeTruthy();
    });

    it('should handle complex regex patterns in section headers', () => {
      const complexPattern = '.*+?^${}()|[]\\\\';
      const content = `## ${complexPattern}\nContent here\n\n## Another Section\nMore content`;
      
      const startTime = Date.now();
      const result = (fileManager as any).extractSection(content, `## ${complexPattern}`);
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(100);
      expect(result).toBeTruthy();
      expect(result).toContain('Content here');
    });

    it('should correctly extract panel sections', () => {
      const content = `## Panel: Test Panel\nPanel content\nMore content\n\n## Panel: Another Panel\nOther content`;
      
      const result = (fileManager as any).extractPanelSection(content, 'Test Panel');
      
      expect(result).toBe('## Panel: Test Panel\nPanel content\nMore content');
    });

    it('should return null for non-existent panels', () => {
      const content = `## Panel: Test Panel\nPanel content`;
      
      const result = (fileManager as any).extractPanelSection(content, 'Non-existent Panel');
      
      expect(result).toBeNull();
    });
  });
});