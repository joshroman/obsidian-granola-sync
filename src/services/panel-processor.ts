import { DocumentPanel, PanelSection } from '../types';
import { StructuredLogger } from '../utils/structured-logger';
import TurndownService from 'turndown';

export class PanelProcessor {
  private turndownService: TurndownService;
  
  constructor(private logger: StructuredLogger) {
    this.turndownService = new TurndownService({
      headingStyle: 'atx',
      bulletListMarker: '-',
      codeBlockStyle: 'fenced'
    });
    
    // Configure Turndown rules for Granola-specific HTML
    this.configureTurndown();
  }
  
  private configureTurndown() {
    // Add custom rules if needed
    this.turndownService.addRule('granolaLinks', {
      filter: ['a'],
      replacement: (content, node) => {
        const element = node as HTMLElement;
        const href = element.getAttribute('href');
        // Sanitize Granola links
        if (href?.includes('notes.granola.ai')) {
          return content; // Strip the link
        }
        return href ? `[${content}](${href})` : content;
      }
    });
  }

  /**
   * Extract structured content from a panel by parsing HTML sections
   * @param panel The document panel to extract content from
   * @returns An object with section headings as keys and content as values
   */
  extractStructuredContent(panel: DocumentPanel): Record<string, string> {
    if (!panel.original_content) {
      this.logger.debug('Panel has no original_content', { panelId: panel.id });
      return {};
    }

    const html = this.sanitizeHtml(panel.original_content);
    const sections: Record<string, string> = {};
    
    // Extract sections based on H1 tags
    const sectionRegex = /<h1[^>]*>(.*?)<\/h1>([\s\S]*?)(?=<h1|$)/gi;
    let match;
    
    while ((match = sectionRegex.exec(html)) !== null) {
      const heading = this.cleanHtml(match[1]).trim();
      let content = match[2].trim();
      
      // Convert HTML content to clean text with structure preserved
      content = this.convertHtmlToMarkdown(content);
      
      if (heading && content) {
        sections[heading] = content;
      }
    }
    
    // If no H1 sections found, try to extract the whole content
    if (Object.keys(sections).length === 0 && html.trim()) {
      sections['Content'] = this.convertHtmlToMarkdown(html);
    }
    
    this.logger.debug('Extracted sections from panel', { 
      panelId: panel.id, 
      panelTitle: panel.title,
      sectionCount: Object.keys(sections).length,
      sectionHeadings: Object.keys(sections)
    });
    
    return sections;
  }

  /**
   * Sanitize HTML to prevent malicious content
   */
  private sanitizeHtml(html: string): string {
    // Remove potential front-matter injections
    html = html.replace(/^---[\s\S]*?---/gm, '');
    
    // Escape wiki-link syntax
    html = html.replace(/\[\[([^\]]+)\]\]/g, '\\[\\[$1\\]\\]');
    
    // Remove script tags and event handlers
    html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    html = html.replace(/on\w+\s*=\s*"[^"]*"/gi, '');
    
    return html;
  }

  /**
   * Convert HTML content to clean markdown-like text
   * @param html HTML string to convert
   * @returns Clean text with structure preserved
   */
  convertHtmlToMarkdown(html: string): string {
    if (!html) return '';
    
    // Sanitize dangerous content first
    const sanitized = this.sanitizeHtml(html);
    return this.turndownService.turndown(sanitized);
  }

  /**
   * Extract a specific section from HTML by heading name
   * @param html HTML content to search
   * @param sectionName Name of the section to extract
   * @returns Content of the section or empty string if not found
   */
  extractSectionFromHtml(html: string, sectionName: string): string {
    if (!html || !sectionName) return '';
    
    // Create a regex to find the specific section
    const escapedSection = sectionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const sectionRegex = new RegExp(
      `<h1[^>]*>${escapedSection}<\/h1>([\\s\\S]*?)(?=<h1|$)`,
      'i'
    );
    
    const match = html.match(sectionRegex);
    if (match && match[1]) {
      return this.convertHtmlToMarkdown(match[1]);
    }
    
    return '';
  }

  /**
   * Clean HTML by removing tags and decoding entities
   * @param html HTML string to clean
   * @returns Plain text
   */
  private cleanHtml(html: string): string {
    if (!html) return '';
    
    // Decode HTML entities first
    const decoded = this.decodeHtmlEntities(html);
    
    return decoded
      .replace(/<[^>]*>/g, '') // Remove all tags
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Decode HTML entities
   * @param html HTML string with entities
   * @returns Decoded string
   */
  private decodeHtmlEntities(html: string): string {
    return html
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
      .replace(/&#x([0-9A-F]+);/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)));
  }

  /**
   * Process panels for known templates (e.g., Josh Template)
   * @param panels Array of document panels
   * @returns Structured content from known templates
   */
  processKnownTemplates(panels: DocumentPanel[]): Record<string, string> {
    const structuredContent: Record<string, string> = {};
    
    for (const panel of panels) {
      // Check for Josh Template or similar structured panels
      if (panel.title.toLowerCase().includes('template') || 
          panel.title.toLowerCase().includes('josh')) {
        const sections = this.extractStructuredContent(panel);
        
        // Map known sections
        if (sections['Introduction']) {
          structuredContent['Introduction'] = sections['Introduction'];
        }
        if (sections['Agenda Items']) {
          structuredContent['Agenda Items'] = sections['Agenda Items'];
        }
        if (sections['Key Decisions']) {
          structuredContent['Key Decisions'] = sections['Key Decisions'];
        }
        if (sections['Action Items']) {
          structuredContent['Action Items'] = sections['Action Items'];
        }
        if (sections['Meeting Narrative']) {
          structuredContent['Meeting Narrative'] = sections['Meeting Narrative'];
        }
        if (sections['Other Discussion & Notes']) {
          structuredContent['Other Notes'] = sections['Other Discussion & Notes'];
        }
      }
      
      // Also check for Summary panels
      if (panel.title.toLowerCase().includes('summary')) {
        const sections = this.extractStructuredContent(panel);
        if (sections['Summary'] || sections['Content']) {
          structuredContent['Summary'] = sections['Summary'] || sections['Content'];
        }
      }
    }
    
    return structuredContent;
  }
}