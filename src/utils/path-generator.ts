import { Meeting, PluginSettings } from '../types';
import { InputValidator } from './input-validator';
import { format } from 'date-fns';

export class PathGenerator {
  constructor(private settings: PluginSettings) {}
  
  generatePath(meeting: Meeting): string {
    // Start with base folder
    let pathParts: string[] = [this.settings.targetFolder];
    
    // Add subfolder based on organization
    switch (this.settings.folderOrganization) {
      case 'by-date':
        pathParts.push(this.getDateFolder(meeting.date));
        break;
        
      case 'mirror-granola':
        if (meeting.granolaFolder) {
          const sanitizedFolder = InputValidator.validateFolderPath(meeting.granolaFolder);
          pathParts.push(sanitizedFolder);
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
    const sanitizedTitle = InputValidator.validateMeetingTitle(meeting.title);
    
    switch (this.settings.fileNamingFormat) {
      case 'date-meeting-name':
        const datePrefix = format(meeting.date, this.settings.dateFormat);
        return `${datePrefix} ${sanitizedTitle}.md`;
        
      case 'meeting-name':
      default:
        return `${sanitizedTitle}.md`;
    }
  }
  
  private getDateFolder(date: Date): string {
    switch (this.settings.dateFolderFormat) {
      case 'weekly':
        // Use week format from settings
        return format(date, this.settings.weekFormat);
        
      case 'daily':
      default:
        // Use standard date format
        return format(date, 'yyyy-MM-dd');
    }
  }
}
