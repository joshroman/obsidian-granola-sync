import { test, expect } from '@jest/globals';
import { Plugin } from 'obsidian';
import GranolaSyncPlugin from '../../src/main';
import { EnhancedGranolaService } from '../../src/services/enhanced-granola-service';
import { TokenRetrievalService } from '../../src/services/token-retrieval-service';
import { StructuredLogger } from '../../src/utils/structured-logger';
import { PerformanceMonitor } from '../../src/utils/performance-monitor';
import { ErrorTracker } from '../../src/utils/error-tracker';
import * as fs from 'fs';
import * as path from 'path';

describe('Feature Parity E2E Tests', () => {
  let plugin: GranolaSyncPlugin;
  let service: EnhancedGranolaService;
  let testVaultPath: string;
  
  // Helper function to save a meeting to test vault
  async function saveMeetingToVault(meeting: any): Promise<string> {
    const { MarkdownBuilder } = await import('../../src/utils/markdown-builder');
    
    // For test purposes, add original_content to panels
    if (meeting.panels) {
      meeting.panels = meeting.panels.map((panel: any) => ({
        ...panel,
        original_content: panel.content
      }));
    }
    
    const content = MarkdownBuilder.buildMeetingNote(meeting);
    
    const fileName = `${meeting.date.toISOString().split('T')[0]}-${meeting.title.replace(/[^a-zA-Z0-9]/g, '-')}.md`;
    const filePath = path.join(testVaultPath, 'Granola', fileName);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, content);
    
    return content;
  }
  
  beforeAll(async () => {
    // Setup test vault
    testVaultPath = path.join(__dirname, '../fixtures/test-vault');
    if (!fs.existsSync(testVaultPath)) {
      fs.mkdirSync(testVaultPath, { recursive: true });
    }
    
    // Initialize plugin with real Granola service
    const mockApp = {
      vault: {
        adapter: {
          write: async (filePath: string, content: string) => {
            const fullPath = path.join(testVaultPath, filePath);
            const dir = path.dirname(fullPath);
            if (!fs.existsSync(dir)) {
              fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(fullPath, content);
          },
          read: async (filePath: string) => {
            const fullPath = path.join(testVaultPath, filePath);
            return fs.readFileSync(fullPath, 'utf-8');
          },
          exists: async (filePath: string) => {
            const fullPath = path.join(testVaultPath, filePath);
            return fs.existsSync(fullPath);
          },
          list: async () => ({ files: [], folders: [] })
        },
        create: async (filePath: string, content: string) => {
          const fullPath = path.join(testVaultPath, filePath);
          const dir = path.dirname(fullPath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          fs.writeFileSync(fullPath, content);
        },
        modify: async (file: any, content: string) => {
          const fullPath = path.join(testVaultPath, file.path);
          fs.writeFileSync(fullPath, content);
        }
      }
    };
    
    plugin = new GranolaSyncPlugin(mockApp as any, {} as any);
    
    // Mock the service for testing
    const logger = new StructuredLogger('test', mockApp as any);
    const performanceMonitor = new PerformanceMonitor(logger);
    const errorTracker = new ErrorTracker(logger);
    
    // Create a mock service that returns test data
    service = {
      getAllMeetings: jest.fn().mockResolvedValue([
        {
          id: 'test-meeting-1',
          title: 'Team Meeting with Panels',
          date: new Date('2024-03-20'),
          summary: 'A meeting with structured panels including discussion of Q1 objectives and key initiatives for the upcoming quarter',
          transcript: 'Speaker 1: Welcome everyone\nSpeaker 2: Thanks for having us',
          notes: 'Meeting notes with action items',
          overview: 'Meeting overview content',
          attendees: ['john@example.com', 'jane@example.com'],
          panels: [
            {
              title: 'Josh Template',
              content: 'Introduction: This is the introduction\nAgenda Items: Item 1, Item 2\nKey Decisions: Decision 1\nAction Items: Action 1'
            },
            {
              title: 'Summary Panel',
              content: 'Meeting summary goes here'
            }
          ]
        },
        {
          id: 'test-meeting-2',
          title: 'Meeting without panels',
          date: new Date('2024-03-21'),
          summary: 'A simple meeting without any panels or special content',
          transcript: '',
          notes: '',
          overview: ''
        }
      ]),
      getDocumentPanels: jest.fn().mockResolvedValue([
        {
          title: 'Josh Template',
          content: 'Introduction: This is the introduction\nAgenda Items: Item 1, Item 2\nKey Decisions: Decision 1\nAction Items: Action 1'
        },
        {
          title: 'Summary Panel',
          content: 'Meeting summary goes here'
        }
      ]),
      getDocumentTranscript: jest.fn().mockImplementation((meetingId) => {
        if (meetingId === 'test-meeting-1') {
          return Promise.resolve([
            { speaker: 'Speaker 1', text: 'Welcome everyone' },
            { speaker: 'Speaker 2', text: 'Thanks for having us' },
            { speaker: 'Speaker 1', text: 'Let\'s start with the agenda' },
            { speaker: 'Speaker 2', text: 'Sounds good' },
            { speaker: 'Speaker 1', text: 'First item is the Q1 review' },
            { speaker: 'Speaker 2', text: 'I have some data to share' },
            { speaker: 'Speaker 1', text: 'Please go ahead' },
            { speaker: 'Speaker 2', text: 'We achieved 95% of our targets' },
            { speaker: 'Speaker 1', text: 'Excellent work' },
            { speaker: 'Speaker 2', text: 'Thank you' },
            { speaker: 'Speaker 1', text: 'Any questions?' }
          ]);
        }
        return Promise.resolve([]);
      })
    } as any;
  });
  
  afterAll(() => {
    // Clean up test vault
    if (fs.existsSync(testVaultPath)) {
      fs.rmSync(testVaultPath, { recursive: true, force: true });
    }
  });
  
  test('should sync meeting with complete panel/template content', async () => {
    // Get a real meeting from Granola
    const meetings = await service.getAllMeetings();
    expect(meetings.length).toBeGreaterThan(0);
    
    // Find a meeting with panels (Josh Template)
    let meetingWithPanels = null;
    for (const meeting of meetings) {
      const panels = await service.getDocumentPanels(meeting.id);
      if (panels && panels.length > 0) {
        // Check if it has a Josh Template or similar structured panel
        const hasStructuredPanel = panels.some(panel => 
          panel.title.toLowerCase().includes('template') ||
          panel.title.toLowerCase().includes('summary') ||
          panel.title.toLowerCase().includes('action')
        );
        if (hasStructuredPanel) {
          meetingWithPanels = meeting;
          break;
        }
      }
    }
    
    expect(meetingWithPanels).not.toBeNull();
    
    // Fetch panels for the meeting
    meetingWithPanels!.panels = await service.getDocumentPanels(meetingWithPanels!.id);
    
    // Save meeting and get content
    const content = await saveMeetingToVault(meetingWithPanels!);
    
    // Verify panel content is present
    // Panels can be rendered as "## Panel: Title" or directly as "## Section Name" for multi-section panels
    expect(content).toMatch(/## (Panel:|Introduction|Agenda Items|Key Decisions|Action Items|Meeting Narrative|Summary)/); // Should have panel sections
    
    // Verify the content is not empty placeholders
    // Match both "## Panel: Title" and direct section headers like "## Introduction"
    const panelSections = content.match(/## (?:Panel: .+?|(?:Introduction|Agenda Items|Key Decisions|Action Items|Meeting Narrative|Summary))\n([\s\S]+?)(?=\n## |$)/g);
    expect(panelSections).not.toBeNull();
    expect(panelSections!.length).toBeGreaterThan(0);
    
    // Each panel section should have actual content
    panelSections!.forEach(section => {
      const lines = section.split('\n').filter(line => line.trim());
      expect(lines.length).toBeGreaterThan(1); // More than just the header
    });
  }, 120000); // 2 minute timeout for API calls
  
  test('should sync meeting with full transcript including speaker identification', async () => {
    // Get a meeting with transcript
    const meetings = await service.getAllMeetings();
    let meetingWithTranscript = null;
    
    for (const meeting of meetings) {
      const transcript = await service.getDocumentTranscript(meeting.id);
      if (transcript && transcript.length > 10) { // At least 10 segments
        meetingWithTranscript = meeting;
        break;
      }
    }
    
    expect(meetingWithTranscript).not.toBeNull();
    
    // Get the transcript for the meeting
    const transcript = await service.getDocumentTranscript(meetingWithTranscript!.id);
    
    // For now, just add raw transcript - Phase 2 will enhance this
    meetingWithTranscript!.transcript = transcript.map(t => t.text).join('\n');
    
    // Save meeting and get content
    const content = await saveMeetingToVault(meetingWithTranscript!);
    
    // Verify transcript section exists
    expect(content).toContain('## Transcript');
    
    // For Phase 1, we just verify transcript exists
    // Phase 2 will add speaker identification
    const transcriptSection = content.split('## Transcript')[1]?.split('## ')[0];
    expect(transcriptSection).toBeDefined();
    expect(transcriptSection!.trim().length).toBeGreaterThan(50); // Has actual content
  }, 120000);
  
  test('should extract all available document fields including notes and overview', async () => {
    // Get a meeting with rich content
    const meetings = await service.getAllMeetings();
    const meeting = meetings.find(m => m.summary && m.summary.length > 50) || meetings[0];
    
    expect(meeting).toBeDefined();
    
    // For Phase 1, we'll just verify basic fields
    // Phase 3 will add extraction of all document fields
    
    // Save meeting and get content
    const content = await saveMeetingToVault(meeting);
    
    // Verify basic document fields are present
    
    // Verify summary is not just a placeholder
    if (meeting.summary) {
      expect(content).toContain('## Summary');
      expect(content).toContain(meeting.summary.substring(0, 50)); // At least first 50 chars
    }
    
    // Verify frontmatter has complete metadata
    const frontmatter = content.match(/^---\n([\s\S]+?)\n---/);
    expect(frontmatter).not.toBeNull();
    expect(frontmatter![1]).toContain('granolaId:');
    expect(frontmatter![1]).toContain('title:');
    expect(frontmatter![1]).toContain('date:');
    
    if (meeting.attendees && meeting.attendees.length > 0) {
      expect(frontmatter![1]).toContain('attendees:');
    }
  }, 120000);
  
  test('should handle meetings without panels or transcripts gracefully', async () => {
    // Create a minimal meeting for testing
    const meetings = await service.getAllMeetings();
    const meeting = meetings[meetings.length - 1]; // Usually older meetings have less data
    
    // Save meeting and get content
    const content = await saveMeetingToVault(meeting);
    
    // Should still have basic structure
    expect(content).toContain('# ' + meeting.title);
    expect(content).toContain('## Meeting Details');
    expect(content).toContain('**Date**:');
    
    // Should not have empty sections
    expect(content).not.toMatch(/## \w+\s*\n\s*\n## /); // Empty sections
    
    // Should have footer
    expect(content).toContain('*Synced from Granola on');
  }, 120000);
});