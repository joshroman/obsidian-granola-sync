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
  panels?: DocumentPanel[];
  panelSections?: Record<string, string>; // Structured content from panels
  endTime?: Date; // When the meeting ended
  updatedAt?: Date; // Last update time from Granola
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
  onlyCompletedMeetings: boolean; // Only sync meetings that have ended
  completedMeetingGraceMinutes: number; // Minutes after meeting end before syncing
  
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
  
  // Timezone settings
  timezone: string; // IANA timezone identifier (e.g., 'America/New_York')
  
  // Wizard completion tracking
  wizardCompleted: boolean;
  
  // Template filtering
  templateFilterEnabled: boolean;
  templateFilterName: string;
  onlyCustomTemplates: boolean; // Only sync meetings with custom templates
  includeTranscripts: boolean;
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
  onlyCompletedMeetings: false, // Disabled by default to sync all meetings
  completedMeetingGraceMinutes: 5, // Not used with template-based detection
  batchSize: 10,
  requestTimeout: 30000, // 30 seconds
  granolaConsentGiven: false,
  useManualToken: false,
  debugMode: false,
  logLevel: 'error',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  wizardCompleted: false,
  templateFilterEnabled: false,
  templateFilterName: '',
  onlyCustomTemplates: false,
  includeTranscripts: true
};

export interface DocumentPanel {
  id: string;
  document_id: string;
  panel_template_id: string;
  title: string;
  content: any; // ProseMirror content structure
  original_content: string; // HTML content
  generated_lines?: Array<{
    text: string;
    type: string;
  }>;
  created_at: string;
  updated_at: string;
}

export interface DocumentPanelsResponse {
  panels: DocumentPanel[];
}

export interface TranscriptSegment {
  text?: string;
  start_timestamp?: string;
  end_timestamp?: string;
  source?: string; // "microphone" or "system"
  document_id?: string;
}

export interface PanelSection {
  heading: string;
  content: string;
}

export interface SyncState {
  lastSyncDate: string;
  syncedMeetingIds: string[];
  version: string;
}

// New API types for Granola API fix - July 4, 2025
/**
 * Information about a person in the user's network (exact API response structure)
 */
export interface PersonInfo {
  id: string;
  created_at: string;
  user_id: string;
  name: string;
  job_title: string | null;
  company_name?: string; // Optional - may not always be present
  company_description: string;
  links: Array<{ url: string; title: string }>;
  email: string;
  avatar?: string; // Optional - may not always be present
  favorite_panel_templates?: Array<{ template_id: string }>; // Optional - may be empty or missing
  user_type?: string; // Optional - may not always be present
  subscription_name?: string; // Optional - may not always be present
}

/**
 * Response containing information about people (returns array directly)
 */
export type PeopleResponse = PersonInfo[];

/**
 * Individual feature flag setting (exact API response structure)
 */
export interface FeatureFlag {
  feature: string;
  value: boolean | string | number | object;
  user_id: string | null;
}

/**
 * Response containing feature flag settings (returns array directly)
 */
export type FeatureFlagsResponse = FeatureFlag[];

/**
 * Response containing Notion integration details (exact API response structure)
 */
export interface NotionIntegrationResponse {
  canIntegrate: boolean;
  isConnected: boolean;
  authUrl: string;
  integrations: Record<string, {
    workspace_name: string;
    workspace_icon?: string; // Optional - may not always be present
  }>;
}

/**
 * Subscription plan details (exact API response structure)
 */
export interface SubscriptionPlan {
  id: string;
  type: string;
  display_name: string;
  price: {
    monthly: number;
  };
  currency_iso: string;
  requires_workspace: boolean;
  requires_payment: boolean;
  privacy_mode: string;
  is_team_upsell_target: boolean;
  features: string[];
  display_order: number;
  live: boolean;
}

/**
 * Response containing subscription information (exact API response structure)
 */
export interface SubscriptionsResponse {
  active_plan_id: string;
  subscription_plans: SubscriptionPlan[];
}