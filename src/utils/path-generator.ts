import { Meeting, PluginSettings } from '../types';
import { InputValidator } from './input-validator';
import { format, formatInTimeZone } from 'date-fns-tz';

export class PathGenerator {
  constructor(private getSettings: () => PluginSettings) {}
  
  generatePath(meeting: Meeting): string {
    const settings = this.getSettings();
    
    // Start with base folder
    let pathParts: string[] = [settings.targetFolder];
    
    // Add subfolder based on organization
    switch (settings.folderOrganization) {
      case 'by-date':
        pathParts.push(this.getDateFolder(meeting.date));
        break;
        
      case 'mirror-granola':
        // Check if Granola provided folder information
        if (meeting.granolaFolder) {
          const sanitizedFolder = InputValidator.validateFolderPath(meeting.granolaFolder);
          pathParts.push(sanitizedFolder);
        } else {
          console.warn(`[PathGenerator] No Granola folder for meeting: ${meeting.title}`);
        }
        break;
        
      case 'flat':
      default:
        // No additional folders
        break;
    }
    
    // Generate filename
    const filename = this.generateFilename(meeting);
    
    // Combine path parts
    const fullPath = pathParts.filter(part => part).join('/') + '/' + filename;
    
    // Validate and sanitize the complete path
    return InputValidator.sanitizePath(pathParts.join('/'), filename);
  }
  
  private generateFilename(meeting: Meeting): string {
    const settings = this.getSettings();
    const sanitizedTitle = InputValidator.validateMeetingTitle(meeting.title);
    
    // Always add a unique suffix to prevent overwrites
    // Use last 8 characters of meeting ID for uniqueness
    const uniqueSuffix = meeting.id.slice(-8);
    
    if (settings.includeDateInFilename) {
      // Use UTC to ensure consistent dates across timezones
      const datePrefix = this.formatDateUTC(meeting.date, settings.dateFormat);
      // Include unique suffix to prevent overwrites of meetings with same title on same date
      return `${datePrefix} ${sanitizedTitle} -- ${uniqueSuffix}.md`;
    } else {
      // Use double dash separator - no special characters allowed in Obsidian
      return `${sanitizedTitle} -- ${uniqueSuffix}.md`;
    }
  }
  
  private getDateFolder(date: Date): string {
    const settings = this.getSettings();
    
    switch (settings.dateFolderFormat) {
      case 'weekly':
        // Use week format from settings with UTC
        return this.formatDateUTC(date, settings.weekFormat);
        
      case 'daily':
      default:
        // Use standard date format with UTC
        return this.formatDateUTC(date, 'yyyy-MM-dd');
    }
  }
  
  private formatDateUTC(date: Date, formatString: string): string {
    // Ensure we're working with a Date object
    const dateObj = date instanceof Date ? date : new Date(date);
    
    // Use formatInTimeZone to force UTC formatting
    return formatInTimeZone(dateObj, 'UTC', formatString);
  }
}
