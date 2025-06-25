export interface Meeting {
  id: string;
  title: string;
  date: Date;
  transcript?: string;
  summary?: string;
  highlights?: string[];
  attendees?: string[];
  duration?: number; // in minutes
  granolaFolder?: string;
  tags?: string[];
  attachments?: Attachment[];
}

export interface Attachment {
  id: string;
  name: string;
  url: string;
  type: string; // MIME type
  size: number; // bytes
}

export interface SyncResult {
  success: boolean;
  created: number;
  updated: number;
  skipped: number;
  errors: SyncError[];
  duration: number; // milliseconds
}

export interface SyncError {
  meetingId: string;
  meetingTitle: string;
  error: string;
  timestamp: Date;
  details?: {
    type: string;
    message: string;
    code?: string | number;
    stack?: string;
  };
}

export interface SyncProgress {
  current: number;
  total: number;
  message: string;
  currentFile?: string;
  phase?: 'fetching' | 'processing' | 'writing' | 'complete';
  startTime?: Date;
  estimatedTimeRemaining?: number;
}

export type Result<T, E = Error> = 
  | { ok: true; value: T }
  | { ok: false; error: E };

export interface PluginSettings {
  apiKey: string;
  targetFolder: string;
  
  // File naming options
  fileNamingFormat: 'meeting-name' | 'date-meeting-name';
  dateFormat: string; // e.g., 'YYYY-MM-DD' for file names
  
  // Folder organization options
  folderOrganization: 'flat' | 'by-date' | 'mirror-granola';
  dateFolderFormat: 'daily' | 'weekly'; // only used when folderOrganization is 'by-date'
  weekFormat: string; // e.g., 'YYYY-[W]WW' for weekly folders
  
  lastSync: string;
  syncAutomatically: boolean;
  batchSize: number; // Number of meetings to process at once
  requestTimeout: number; // API request timeout in milliseconds
  
  // Debug options
  debugMode: boolean;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
}

export const DEFAULT_SETTINGS: PluginSettings = {
  apiKey: '',
  targetFolder: 'Meetings',
  fileNamingFormat: 'date-meeting-name',
  dateFormat: 'yyyy-MM-dd',
  folderOrganization: 'flat',
  dateFolderFormat: 'daily',
  weekFormat: "yyyy-'W'ww",
  lastSync: '',
  syncAutomatically: false,
  batchSize: 10,
  requestTimeout: 30000, // 30 seconds
  debugMode: false,
  logLevel: 'error',
};