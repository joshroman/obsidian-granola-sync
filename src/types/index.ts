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
  includeDateInFilename: boolean; // Whether to include date in filename
  dateFormat: string; // e.g., 'yyyy-MM-dd' for file names
  
  // Folder organization options
  folderOrganization: 'flat' | 'by-date' | 'mirror-granola';
  dateFolderFormat: 'daily' | 'weekly'; // only used when folderOrganization is 'by-date'
  weekFormat: string; // e.g., 'yyyy-[W]ww' for weekly folders
  
  // Sync settings
  lastSync: string;
  autoSync: boolean; // Renamed from syncAutomatically for consistency with wizard
  syncInterval: number; // How often to sync in milliseconds
  showProgress: boolean; // Whether to show detailed progress during sync
  
  // Performance settings
  batchSize: number; // Number of meetings to process at once
  requestTimeout: number; // API request timeout in milliseconds
  
  // Auto-detection settings
  granolaConsentGiven: boolean; // User has consented to auto-detection
  useManualToken: boolean; // Force manual token entry
  manualApiToken?: string; // Manually entered token (for migration)
  
  // Debug options
  debugMode: boolean;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
}

export const DEFAULT_SETTINGS: PluginSettings = {
  apiKey: '',
  targetFolder: 'Meetings',
  includeDateInFilename: true,
  dateFormat: 'yyyy-MM-dd',
  folderOrganization: 'flat',
  dateFolderFormat: 'daily',
  weekFormat: "yyyy-'W'ww",
  lastSync: '',
  autoSync: false,
  syncInterval: 900000, // 15 minutes
  showProgress: true,
  batchSize: 10,
  requestTimeout: 30000, // 30 seconds
  granolaConsentGiven: false,
  useManualToken: false,
  debugMode: false,
  logLevel: 'error',
};