import { Meeting } from '../types';
import { Logger } from './logger';

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

export interface ValidationWarning {
  field: string;
  message: string;
  value?: any;
}

export class DataValidator {
  constructor(private logger: Logger) {}

  /**
   * Validate a meeting object
   */
  validateMeeting(meeting: any): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Required fields
    if (!meeting.id || typeof meeting.id !== 'string') {
      errors.push({
        field: 'id',
        message: 'Meeting ID is required and must be a string',
        value: meeting.id
      });
    }

    if (!meeting.title || typeof meeting.title !== 'string') {
      errors.push({
        field: 'title',
        message: 'Meeting title is required and must be a string',
        value: meeting.title
      });
    }

    if (!meeting.date) {
      errors.push({
        field: 'date',
        message: 'Meeting date is required',
        value: meeting.date
      });
    } else {
      // Validate date
      const date = this.parseDate(meeting.date);
      if (!date || isNaN(date.getTime())) {
        errors.push({
          field: 'date',
          message: 'Invalid date format',
          value: meeting.date
        });
      } else if (date > new Date(Date.now() + 24 * 60 * 60 * 1000)) {
        warnings.push({
          field: 'date',
          message: 'Meeting date is in the future',
          value: meeting.date
        });
      }
    }

    // Optional fields validation
    if (meeting.summary && typeof meeting.summary !== 'string') {
      errors.push({
        field: 'summary',
        message: 'Summary must be a string',
        value: meeting.summary
      });
    }

    if (meeting.transcript && typeof meeting.transcript !== 'string') {
      errors.push({
        field: 'transcript',
        message: 'Transcript must be a string',
        value: meeting.transcript
      });
    }

    if (meeting.attendees) {
      if (!Array.isArray(meeting.attendees)) {
        errors.push({
          field: 'attendees',
          message: 'Attendees must be an array',
          value: meeting.attendees
        });
      } else {
        // Validate each attendee
        meeting.attendees.forEach((attendee: any, index: number) => {
          if (typeof attendee !== 'string') {
            errors.push({
              field: `attendees[${index}]`,
              message: 'Attendee must be a string',
              value: attendee
            });
          }
        });
      }
    }

    if (meeting.highlights) {
      if (!Array.isArray(meeting.highlights)) {
        errors.push({
          field: 'highlights',
          message: 'Highlights must be an array',
          value: meeting.highlights
        });
      } else {
        meeting.highlights.forEach((highlight: any, index: number) => {
          if (typeof highlight !== 'string') {
            errors.push({
              field: `highlights[${index}]`,
              message: 'Highlight must be a string',
              value: highlight
            });
          }
        });
      }
    }

    if (meeting.duration !== undefined) {
      if (typeof meeting.duration !== 'number' || meeting.duration < 0) {
        errors.push({
          field: 'duration',
          message: 'Duration must be a positive number',
          value: meeting.duration
        });
      } else if (meeting.duration > 480) { // 8 hours
        warnings.push({
          field: 'duration',
          message: 'Duration seems unusually long (> 8 hours)',
          value: meeting.duration
        });
      }
    }

    // Check for suspicious content
    const allTextContent = [
      meeting.title,
      meeting.summary,
      meeting.transcript,
      ...(meeting.highlights || []),
      ...(meeting.attendees || [])
    ].filter(Boolean).join(' ');

    if (this.containsSuspiciousContent(allTextContent)) {
      warnings.push({
        field: 'content',
        message: 'Content contains potentially suspicious patterns',
        value: undefined
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Sanitize meeting data
   */
  sanitizeMeeting(meeting: any): Meeting {
    const sanitized: any = {};

    // Required fields
    sanitized.id = this.sanitizeString(meeting.id || '');
    sanitized.title = this.sanitizeString(meeting.title || 'Untitled Meeting');
    sanitized.date = this.parseDate(meeting.date) || new Date();

    // Optional fields
    if (meeting.summary) {
      sanitized.summary = this.sanitizeString(meeting.summary);
    }

    if (meeting.transcript) {
      sanitized.transcript = this.sanitizeString(meeting.transcript);
    }

    if (meeting.attendees && Array.isArray(meeting.attendees)) {
      sanitized.attendees = meeting.attendees
        .filter((a: any) => typeof a === 'string')
        .map((a: string) => this.sanitizeString(a));
    }

    if (meeting.highlights && Array.isArray(meeting.highlights)) {
      sanitized.highlights = meeting.highlights
        .filter((h: any) => typeof h === 'string')
        .map((h: string) => this.sanitizeString(h));
    }

    if (typeof meeting.duration === 'number' && meeting.duration >= 0) {
      sanitized.duration = Math.min(meeting.duration, 1440); // Cap at 24 hours
    }

    if (meeting.granolaFolder && typeof meeting.granolaFolder === 'string') {
      sanitized.granolaFolder = this.sanitizePath(meeting.granolaFolder);
    }

    if (meeting.tags && Array.isArray(meeting.tags)) {
      sanitized.tags = meeting.tags
        .filter((t: any) => typeof t === 'string')
        .map((t: string) => this.sanitizeString(t));
    }

    return sanitized as Meeting;
  }

  /**
   * Validate sync state data
   */
  validateSyncState(state: any): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (!state.version || typeof state.version !== 'number') {
      errors.push({
        field: 'version',
        message: 'State version is required',
        value: state.version
      });
    }

    if (!state.files || typeof state.files !== 'object') {
      errors.push({
        field: 'files',
        message: 'Files index is required',
        value: state.files
      });
    } else {
      // Validate each file entry
      Object.entries(state.files).forEach(([granolaId, metadata]: [string, any]) => {
        if (!metadata.path || typeof metadata.path !== 'string') {
          errors.push({
            field: `files.${granolaId}.path`,
            message: 'File path is required',
            value: metadata.path
          });
        }

        if (!metadata.contentHash || typeof metadata.contentHash !== 'string') {
          warnings.push({
            field: `files.${granolaId}.contentHash`,
            message: 'Content hash is missing',
            value: metadata.contentHash
          });
        }

        if (typeof metadata.lastModified !== 'number') {
          errors.push({
            field: `files.${granolaId}.lastModified`,
            message: 'Last modified timestamp is required',
            value: metadata.lastModified
          });
        }
      });
    }

    if (state.deletedIds && !Array.isArray(state.deletedIds)) {
      errors.push({
        field: 'deletedIds',
        message: 'Deleted IDs must be an array',
        value: state.deletedIds
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  private parseDate(value: any): Date | null {
    if (!value) return null;
    
    if (value instanceof Date) {
      return value;
    }
    
    if (typeof value === 'string' || typeof value === 'number') {
      const date = new Date(value);
      return isNaN(date.getTime()) ? null : date;
    }
    
    return null;
  }

  private sanitizeString(str: string): string {
    if (typeof str !== 'string') return '';
    
    // Remove null bytes and other control characters
    return str
      .replace(/\0/g, '')
      .replace(/[\x00-\x1F\x7F-\x9F]/g, '')
      .trim();
  }

  private sanitizePath(path: string): string {
    if (typeof path !== 'string') return '';
    
    // Remove dangerous path characters
    return path
      .replace(/\.\./g, '')
      .replace(/[<>:"|?*]/g, '')
      .replace(/^\/+|\/+$/g, '') // Remove leading/trailing slashes
      .trim();
  }

  private containsSuspiciousContent(content: string): boolean {
    if (!content) return false;
    
    // Check for common injection patterns
    const suspiciousPatterns = [
      /<script[\s>]/i,
      /<iframe[\s>]/i,
      /javascript:/i,
      /data:text\/html/i,
      /vbscript:/i,
      /onload\s*=/i,
      /onerror\s*=/i,
      /<embed[\s>]/i,
      /<object[\s>]/i
    ];
    
    return suspiciousPatterns.some(pattern => pattern.test(content));
  }

  /**
   * Calculate checksum for data integrity
   */
  calculateChecksum(data: any): string {
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256');
    const content = JSON.stringify(data);
    hash.update(content);
    return hash.digest('hex');
  }

  /**
   * Verify data checksum
   */
  verifyChecksum(data: any, expectedChecksum: string): boolean {
    const actualChecksum = this.calculateChecksum(data);
    return actualChecksum === expectedChecksum;
  }
}