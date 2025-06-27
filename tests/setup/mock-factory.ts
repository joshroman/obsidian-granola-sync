import { TFile, TFolder, Vault, App, Notice } from 'obsidian';
import { Meeting, PluginSettings } from '../../src/types';
import { GranolaService } from '../../src/services/granola-service';

// Fixed date for all tests
export const FIXED_DATE = new Date('2024-03-20T10:00:00Z');
export const FIXED_TIMESTAMP = FIXED_DATE.getTime();

// Default settings for tests
export const DEFAULT_TEST_SETTINGS: PluginSettings = {
  apiKey: 'test-api-key-123',
  targetFolder: 'Meetings',
  includeDateInFilename: true,
  dateFormat: 'yyyy-MM-dd',
  folderOrganization: 'flat',
  dateFolderFormat: 'daily',
  weekFormat: 'yyyy-[W]ww',
  lastSync: '',
  autoSync: false,
  syncInterval: 900000,
  showProgress: true,
  onlyCompletedMeetings: false,
  completedMeetingGraceMinutes: 5,
  batchSize: 10,
  requestTimeout: 30000,
  granolaConsentGiven: false,
  useManualToken: false,
  debugMode: false,
  logLevel: 'error',
  wizardCompleted: true,
  templateFilterEnabled: false,
  templateFilterName: '',
  onlyCustomTemplates: false,
  includeTranscripts: true
};

// Meeting factory
export function createMockMeeting(overrides: Partial<Meeting> = {}): Meeting {
  const baseDate = new Date(FIXED_DATE);
  if (overrides.date instanceof Date) {
    // Use the override date as-is
  } else if (typeof overrides.date === 'string') {
    overrides.date = new Date(overrides.date);
  } else {
    overrides.date = baseDate;
  }

  return {
    id: `meeting-${Math.random().toString(36).substr(2, 9)}`,
    title: 'Test Meeting',
    date: baseDate,
    transcript: 'This is a test transcript.\n\nWith multiple paragraphs.',
    summary: 'Test meeting summary with key points discussed.',
    highlights: [
      'Key point 1: Important discussion',
      'Key point 2: Action items identified',
      'Key point 3: Next steps agreed'
    ],
    attendees: ['John Doe', 'Jane Smith', 'Bob Johnson'],
    duration: 60,
    granolaFolder: '',
    tags: ['test', 'meeting', 'sync'],
    attachments: [],
    url: 'https://app.granola.so/meeting/test-123',
    recordingUrl: '',
    ...overrides
  };
}

// Batch meeting generator
export function createMockMeetings(count: number, baseOverrides: Partial<Meeting> = {}): Meeting[] {
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(FIXED_DATE);
    date.setDate(date.getDate() + i);
    
    return createMockMeeting({
      ...baseOverrides,
      id: `meeting-${i + 1}`,
      title: `Meeting ${i + 1}`,
      date,
      granolaFolder: baseOverrides.granolaFolder || ''
    });
  });
}

// Vault mock factory
export function createMockVault(): Partial<Vault> {
  const files: TFile[] = [];
  const folders: TFolder[] = [];
  
  return {
    getMarkdownFiles: jest.fn(() => files),
    getAbstractFileByPath: jest.fn((path: string) => {
      return files.find(f => f.path === path) || folders.find(f => f.path === path) || null;
    }),
    create: jest.fn(async (path: string, content: string) => {
      const file = createMockFile(path, content);
      files.push(file);
      return file;
    }),
    modify: jest.fn(async (file: TFile, content: string) => {
      // Update file in mock
    }),
    delete: jest.fn(async (file: TFile) => {
      const index = files.indexOf(file);
      if (index > -1) files.splice(index, 1);
    }),
    rename: jest.fn(async (file: TFile, newPath: string) => {
      file.path = newPath;
      file.name = newPath.split('/').pop() || '';
    }),
    createFolder: jest.fn(async (path: string) => {
      const folder = createMockFolder(path);
      folders.push(folder);
      return folder;
    }),
    getFolderByPath: jest.fn((path: string) => {
      return folders.find(f => f.path === path) || null;
    }),
    adapter: {
      exists: jest.fn(async (path: string) => {
        return files.some(f => f.path === path) || folders.some(f => f.path === path);
      }),
      mkdir: jest.fn(),
      rmdir: jest.fn(),
      read: jest.fn(),
      write: jest.fn(),
      stat: jest.fn(),
      list: jest.fn()
    }
  };
}

// File mock factory
export function createMockFile(path: string, content: string = ''): TFile {
  return {
    path,
    name: path.split('/').pop() || '',
    extension: 'md',
    vault: {} as Vault,
    parent: null,
    basename: path.split('/').pop()?.replace('.md', '') || '',
    stat: {
      ctime: FIXED_TIMESTAMP,
      mtime: FIXED_TIMESTAMP,
      size: content.length
    }
  } as TFile;
}

// Folder mock factory
export function createMockFolder(path: string): TFolder {
  return {
    path,
    name: path.split('/').pop() || '',
    parent: null,
    vault: {} as Vault,
    children: [],
    isRoot: () => false
  } as TFolder;
}

// GranolaService mock factory
export function createMockGranolaService(): jest.Mocked<GranolaService> {
  return {
    testConnection: jest.fn().mockResolvedValue({ success: true }),
    getMeetings: jest.fn().mockResolvedValue([]),
    getMeeting: jest.fn().mockResolvedValue(null),
    searchMeetings: jest.fn().mockResolvedValue([]),
    updateApiKey: jest.fn()
  } as any;
}

// Notice mock
export function createMockNotice(): jest.MockedClass<typeof Notice> {
  const MockNotice = jest.fn().mockImplementation((message: string, timeout?: number) => {
    return {
      message,
      timeout,
      hide: jest.fn()
    };
  });
  
  return MockNotice as any;
}

// Progress callback mock
export function createMockProgressCallback() {
  const updates: Array<{ current: number; total: number; message: string }> = [];
  
  const callback = jest.fn((current: number, total: number, message: string) => {
    updates.push({ current, total, message });
  });
  
  return {
    callback,
    updates,
    getLastUpdate: () => updates[updates.length - 1],
    reset: () => {
      updates.length = 0;
      callback.mockClear();
    }
  };
}

// API response factories
export function createMockApiResponse<T>(data: T, options: {
  status?: number;
  headers?: Record<string, string>;
  delay?: number;
} = {}) {
  const { status = 200, headers = {}, delay = 0 } = options;
  
  return new Promise<{ data: T; status: number; headers: Record<string, string> }>((resolve) => {
    setTimeout(() => {
      resolve({ data, status, headers });
    }, delay);
  });
}

// Error factories
export function createNetworkError(message: string = 'Network error') {
  const error = new Error(message);
  (error as any).code = 'NETWORK_ERROR';
  return error;
}

export function createApiError(status: number, message: string) {
  const error = new Error(message);
  (error as any).status = status;
  (error as any).response = { status, data: { error: message } };
  return error;
}

// Test data generators
export function generateMeetingContent(meeting: Meeting, settings: PluginSettings): string {
  const dateFns = require('date-fns');
  const dateStr = dateFns.format(meeting.date, settings.dateFormat);
  
  let content = `---
id: ${meeting.id}
title: ${meeting.title}
date: ${meeting.date.toISOString()}
tags: ${meeting.tags.join(', ')}
---

# ${meeting.title}

**Date:** ${dateStr}
**Duration:** ${meeting.duration} minutes
**Attendees:** ${meeting.attendees.join(', ')}

## Summary
${meeting.summary}

## Highlights
${meeting.highlights.map(h => `- ${h}`).join('\n')}`;

  if (settings.includeTranscript && meeting.transcript) {
    content += `\n\n## Transcript\n${meeting.transcript}`;
  }

  return content;
}