import { Meeting, Attachment } from '../types';

export class InputValidator {
  private static readonly MAX_PATH_LENGTH = 255;
  private static readonly MAX_TITLE_LENGTH = 200;
  private static readonly INVALID_PATH_CHARS = /[<>:"|?*\\/]/g;
  private static readonly WINDOWS_RESERVED = /^(CON|PRN|AUX|NUL|COM[0-9]|LPT[0-9])$/i;
  
  /**
   * Validates and sanitizes a meeting title for use as a filename
   */
  static validateMeetingTitle(title: string): string {
    if (!title || title.trim().length === 0) {
      return 'Untitled Meeting';
    }
    
    // Replace invalid characters with dash separator
    let safe = title.replace(this.INVALID_PATH_CHARS, ' - ');
    
    // Clean up multiple consecutive separators, extra spaces, and trim separators
    safe = safe.replace(/(\s*-\s*)+/g, ' - ')  // Multiple separators become one
               .replace(/\s+/g, ' ')            // Multiple spaces become one
               .replace(/^\s*-\s*/, '')         // Remove leading separator
               .replace(/\s*-\s*$/, '')         // Remove trailing separator
               .trim();                         // Remove leading/trailing spaces
    
    // Handle leading dots (hidden files on Unix)
    if (safe.startsWith('..')) {
      // Multiple leading dots: prepend underscore
      safe = '_' + safe;
    } else if (safe.startsWith('.')) {
      // Single leading dot: replace with underscore
      safe = '_' + safe.substring(1);
    }
    
    // Handle trailing dots/spaces (Windows)
    safe = safe.replace(/[\s.]+$/, '');
    
    // Check Windows reserved names
    if (this.WINDOWS_RESERVED.test(safe)) {
      safe = '_' + safe;
    }
    
    // Remove control characters
    safe = safe.replace(/[\x00-\x1f\x7f\x80-\x9f]/g, '');
    
    // Truncate if too long
    if (safe.length > this.MAX_TITLE_LENGTH) {
      safe = safe.substring(0, this.MAX_TITLE_LENGTH);
    }
    
    // Final check - if empty after all sanitization, use default
    return safe.trim() || 'Untitled Meeting';
  }
  
  /**
   * Validates and sanitizes a folder path
   */
  static validateFolderPath(path: string): string {
    // Prevent path traversal
    if (path.includes('..') || path.startsWith('/')) {
      throw new Error('Invalid folder path: contains ".." or absolute path');
    }
    
    // Split and validate each segment
    const segments = path.split('/').filter(Boolean);
    const validSegments = segments.map(segment => {
      // Apply same rules as meeting titles for each segment
      return this.validateMeetingTitle(segment);
    });
    
    return validSegments.join('/');
  }
  
  /**
   * Validates meeting data from external source
   */
  static validateMeetingData(data: any): Meeting {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid meeting data: not an object');
    }
    
    // Validate required fields
    if (!data.id || typeof data.id !== 'string') {
      throw new Error('Meeting missing required id field');
    }
    
    // Validate and sanitize title
    const title = this.validateMeetingTitle(data.title || 'Untitled');
    
    // Validate date
    if (!data.date) {
      throw new Error('Invalid meeting date');
    }
    const date = new Date(data.date);
    if (isNaN(date.getTime())) {
      throw new Error('Invalid meeting date');
    }
    
    // Validate transcript size (10MB limit)
    if (data.transcript && data.transcript.length > 10 * 1024 * 1024) {
      throw new Error('Meeting transcript exceeds 10MB limit');
    }
    
    // Validate arrays
    const attendees = Array.isArray(data.attendees) 
      ? data.attendees.filter((a: any) => typeof a === 'string')
      : [];
      
    const highlights = Array.isArray(data.highlights)
      ? data.highlights.filter((h: any) => typeof h === 'string')
      : [];
      
    const tags = Array.isArray(data.tags)
      ? data.tags.filter((t: any) => typeof t === 'string' && t.trim().length > 0)
      : [];
    
    return {
      id: data.id,
      title,
      date,
      transcript: data.transcript || '',
      summary: data.summary || '',
      highlights,
      attendees,
      duration: typeof data.duration === 'number' ? data.duration : undefined,
      granolaFolder: data.folder ? this.validateFolderPath(data.folder) : undefined,
      tags,
      attachments: this.validateAttachments(data.attachments)
    };
  }
  
  /**
   * Validates attachment data
   */
  private static validateAttachments(attachments: any): Attachment[] {
    if (!Array.isArray(attachments)) {
      return [];
    }
    
    return attachments
      .filter((att: any) => att && typeof att === 'object')
      .map((att: any) => ({
        id: String(att.id || ''),
        name: this.validateMeetingTitle(att.name || 'Untitled'),
        url: String(att.url || ''),
        type: String(att.type || 'application/octet-stream'),
        size: typeof att.size === 'number' ? att.size : 0
      }))
      .filter((att: Attachment) => att.id && att.url); // Only keep valid attachments
  }
  
  /**
   * Validates API key format
   */
  static validateApiKey(apiKey: string): boolean {
    if (!apiKey || typeof apiKey !== 'string') {
      return false;
    }
    
    // Remove whitespace
    const trimmed = apiKey.trim();
    
    // Check minimum length (adjust based on actual Granola API key format)
    if (trimmed.length < 8) {
      return false;
    }
    
    // Check for valid characters (alphanumeric, dash, underscore)
    const validPattern = /^[a-zA-Z0-9\-_]+$/;
    return validPattern.test(trimmed);
  }
  
  /**
   * Sanitizes a path to ensure it doesn't exceed OS limits
   */
  static sanitizePath(basePath: string, filename: string): string {
    const separator = '/';
    const maxLength = this.MAX_PATH_LENGTH;
    
    // Check if filename already has extension
    const hasExtension = filename.endsWith('.md');
    const extension = hasExtension ? '' : '.md';
    
    // Calculate available space for filename
    const baseLength = basePath.length + separator.length + extension.length;
    const availableLength = maxLength - baseLength;
    
    if (availableLength < 20) {
      throw new Error('Base path too long, insufficient space for filename');
    }
    
    // Truncate filename if needed (but preserve extension)
    let truncatedFilename = filename;
    if (filename.length > availableLength) {
      if (hasExtension) {
        // Remove extension, truncate, then add back
        const nameWithoutExt = filename.substring(0, filename.length - 3);
        truncatedFilename = nameWithoutExt.substring(0, availableLength - 3) + '.md';
      } else {
        truncatedFilename = filename.substring(0, availableLength);
      }
    }
      
    return `${basePath}${separator}${truncatedFilename}${extension}`;
  }
}