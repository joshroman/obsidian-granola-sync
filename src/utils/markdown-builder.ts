import { Meeting, Attachment, DocumentPanel } from '../types';
import { PanelProcessor } from '../services/panel-processor';
import { StructuredLogger } from './structured-logger';
import moment from 'moment';

export class MarkdownBuilder {
  static buildMeetingNote(meeting: Meeting, template?: string, panelProcessor?: PanelProcessor): string {
    if (template) {
      return this.processTemplate(template, meeting, panelProcessor);
    }
    
    return this.buildDefaultContent(meeting, panelProcessor);
  }
  
  private static buildDefaultContent(meeting: Meeting, panelProcessor?: PanelProcessor): string {
    const lines: string[] = [];
    
    // Frontmatter
    lines.push('---');
    lines.push(`granolaId: "${meeting.id}"`);
    lines.push(`title: "${this.escapeYaml(meeting.title)}"`);
    lines.push(`date: ${meeting.date.toISOString()}`);
    
    if (meeting.attendees && meeting.attendees.length > 0) {
      lines.push('attendees:');
      meeting.attendees.forEach(attendee => {
        lines.push(`  - "${this.escapeYaml(attendee)}"`);
      });
    }
    
    if (meeting.tags && meeting.tags.length > 0) {
      lines.push('tags:');
      meeting.tags.forEach(tag => {
        lines.push(`  - "${this.escapeYaml(tag)}"`);
      });
    }
    
    if (meeting.duration) {
      lines.push(`duration: ${meeting.duration}`);
    }
    
    lines.push('---');
    lines.push('');
    
    // Title
    lines.push(`# ${meeting.title}`);
    lines.push('');
    
    // Metadata section
    lines.push('## Meeting Details');
    lines.push(`- **Date**: ${moment(meeting.date).format('MMMM D, YYYY [at] h:mm A')}`);
    
    if (meeting.attendees && meeting.attendees.length > 0) {
      lines.push(`- **Attendees**: ${meeting.attendees.join(', ')}`);
    }
    
    if (meeting.duration) {
      lines.push(`- **Duration**: ${this.formatDuration(meeting.duration)}`);
    }
    
    lines.push('');
    
    // Summary
    if (meeting.summary) {
      console.log('[Granola Plugin Debug] Adding summary from meeting.summary field');
      lines.push('## Summary');
      lines.push(meeting.summary);
      lines.push('');
    }
    
    // Highlights
    if (meeting.highlights && meeting.highlights.length > 0) {
      lines.push('## Key Points');
      meeting.highlights.forEach(highlight => {
        lines.push(`- ${highlight}`);
      });
      lines.push('');
    }
    
    // Panel sections
    if (meeting.panels && meeting.panels.length > 0) {
      console.log('[Granola Plugin Debug] Building panel sections for', meeting.panels.length, 'panels');
      lines.push(...this.buildPanelSections(meeting.panels, panelProcessor));
    } else {
      console.log('[Granola Plugin Debug] No panels found for meeting:', meeting.title);
    }
    
    // Transcript
    if (meeting.transcript) {
      lines.push('## Transcript');
      lines.push(meeting.transcript);
      lines.push('');
    }
    
    // Attachments
    if (meeting.attachments && meeting.attachments.length > 0) {
      lines.push('## Attachments');
      meeting.attachments.forEach(attachment => {
        lines.push(`- [${attachment.name}](${attachment.url}) (${this.formatFileSize(attachment.size)})`);
      });
      lines.push('');
    }
    
    // Footer
    lines.push('---');
    lines.push(`*Synced from Granola on ${moment().format('YYYY-MM-DD [at] HH:mm')}*`);
    
    return lines.join('\n');
  }
  
  private static processTemplate(template: string, meeting: Meeting, panelProcessor?: PanelProcessor): string {
    // Replace template variables
    let content = template;
    
    // Basic replacements
    content = content.replace(/{{id}}/g, meeting.id);
    content = content.replace(/{{title}}/g, meeting.title);
    content = content.replace(/{{date}}/g, meeting.date.toISOString());
    content = content.replace(/{{date_formatted}}/g, moment(meeting.date).format('MMMM D, YYYY'));
    content = content.replace(/{{time_formatted}}/g, moment(meeting.date).format('h:mm A'));
    
    // Optional fields
    content = content.replace(/{{summary}}/g, meeting.summary || '');
    content = content.replace(/{{transcript}}/g, meeting.transcript || '');
    content = content.replace(/{{duration}}/g, meeting.duration ? this.formatDuration(meeting.duration) : '');
    content = content.replace(/{{duration_minutes}}/g, meeting.duration?.toString() || '0');
    
    // Arrays
    if (meeting.attendees && meeting.attendees.length > 0) {
      content = content.replace(/{{attendees}}/g, meeting.attendees.join(', '));
      content = content.replace(/{{attendees_list}}/g, meeting.attendees.map(a => `- ${a}`).join('\n'));
    } else {
      content = content.replace(/{{attendees}}/g, '');
      content = content.replace(/{{attendees_list}}/g, '');
    }
    
    if (meeting.highlights && meeting.highlights.length > 0) {
      content = content.replace(/{{highlights}}/g, meeting.highlights.join('\n'));
      content = content.replace(/{{highlights_list}}/g, meeting.highlights.map(h => `- ${h}`).join('\n'));
    } else {
      content = content.replace(/{{highlights}}/g, '');
      content = content.replace(/{{highlights_list}}/g, '');
    }
    
    if (meeting.tags && meeting.tags.length > 0) {
      content = content.replace(/{{tags}}/g, meeting.tags.join(', '));
      content = content.replace(/{{tags_list}}/g, meeting.tags.map(t => `#${t}`).join(' '));
    } else {
      content = content.replace(/{{tags}}/g, '');
      content = content.replace(/{{tags_list}}/g, '');
    }
    
    // Attachments
    if (meeting.attachments && meeting.attachments.length > 0) {
      const attachmentsList = meeting.attachments
        .map(a => `- [${a.name}](${a.url}) (${this.formatFileSize(a.size)})`)
        .join('\n');
      content = content.replace(/{{attachments}}/g, attachmentsList);
    } else {
      content = content.replace(/{{attachments}}/g, '');
    }
    
    // Add frontmatter if not present
    if (!content.startsWith('---')) {
      const frontmatter = [
        '---',
        `granolaId: "${meeting.id}"`,
        `title: "${this.escapeYaml(meeting.title)}"`,
        `date: ${meeting.date.toISOString()}`,
        '---',
        ''
      ].join('\n');
      content = frontmatter + content;
    }
    
    return content;
  }
  
  private static escapeYaml(value: string): string {
    // Comprehensive YAML escaping
    return value
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/:/g, '\\:')
      .replace(/>/g, '\\>')
      .replace(/\|/g, '\\|')
      .replace(/\*/g, '\\*')
      .replace(/&/g, '\\&')
      .replace(/#/g, '\\#');
  }
  
  private static formatDuration(minutes: number): string {
    if (minutes < 60) {
      return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }
    
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (mins === 0) {
      return `${hours} hour${hours !== 1 ? 's' : ''}`;
    }
    
    return `${hours} hour${hours !== 1 ? 's' : ''} ${mins} minute${mins !== 1 ? 's' : ''}`;
  }
  
  private static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
  
  private static buildPanelSections(panels: DocumentPanel[], panelProcessor?: PanelProcessor): string[] {
    const lines: string[] = [];
    // Use injected processor or create default
    const processor = panelProcessor || new PanelProcessor(new StructuredLogger());
    
    console.log('[Granola Plugin Debug] Processing', panels.length, 'panels');
    for (const panel of panels) {
      console.log('[Granola Plugin Debug] Processing panel:', panel.title, 'ID:', panel.panel_template_id);
      
      // Extract structured content from the panel
      const sections = processor.extractStructuredContent(panel);
      
      // If we have structured sections, format them
      if (Object.keys(sections).length > 0) {
        console.log('[Granola Plugin Debug] Panel sections:', sections);
        
        // Special case: If a panel contains multiple sections, render them as top-level sections
        // This handles templates like "Josh Template" that have multiple H1 sections
        if (Object.keys(sections).length > 1 || (Object.keys(sections).length === 1 && !sections['Content'])) {
          // Add panel ID comment before the first section
          let firstSection = true;
          // Render each section as a top-level H2
          for (const [heading, content] of Object.entries(sections)) {
            // Skip empty content
            if (!content.trim()) continue;
            
            // Add section as H2
            lines.push(`## ${heading}`);
            if (firstSection) {
              lines.push(`<!-- panel-id: ${panel.panel_template_id} -->`);
              firstSection = false;
            }
            lines.push('');
            lines.push(content);
            lines.push('');
          }
        } else {
          // Single section or just "Content" - render with panel header
          lines.push(`## Panel: ${panel.title}`);
          lines.push(`<!-- panel-id: ${panel.panel_template_id} -->`);
          lines.push('');
          
          for (const [heading, content] of Object.entries(sections)) {
            if (heading === 'Content' || heading === panel.title) {
              // Don't add redundant heading
              if (content.trim()) {
                lines.push(content);
                lines.push('');
              }
            } else {
              // Add as subsection
              lines.push(`### ${heading}`);
              lines.push('');
              if (content.trim()) {
                lines.push(content);
                lines.push('');
              }
            }
          }
        }
      } else if (panel.original_content) {
        // Fallback: If no structured content, try to convert HTML directly
        const content = processor.convertHtmlToMarkdown(panel.original_content);
        if (content.trim()) {
          lines.push(content);
          lines.push('');
        }
      }
      
      // Add spacing between panels
      lines.push('');
    }
    
    return lines;
  }
}
