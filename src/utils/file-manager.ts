import { Plugin, TFile, TFolder, normalizePath } from 'obsidian';
import { Meeting } from '../types';
import { Logger } from './logger';
import { FileLockManager } from './file-lock-manager';

export class FileManager {
  private lockManager: FileLockManager;
  
  constructor(
    private plugin: Plugin,
    private logger: Logger
  ) {
    this.lockManager = new FileLockManager(logger);
  }
  
  async ensureFolderExists(folderPath: string): Promise<void> {
    const normalizedPath = normalizePath(folderPath);
    
    try {
      const folder = this.plugin.app.vault.getAbstractFileByPath(normalizedPath);
      if (!folder) {
        await this.plugin.app.vault.createFolder(normalizedPath);
        this.logger.debug(`Created folder: ${normalizedPath}`);
      } else if (!(folder instanceof TFolder)) {
        throw new Error(`Path exists but is not a folder: ${normalizedPath}`);
      }
    } catch (error) {
      // Folder might already exist or parent folders need to be created
      if (error instanceof Error && error.message.includes('already exists')) {
        return;
      }
      
      // Try creating parent folders first
      const parts = normalizedPath.split('/');
      let currentPath = '';
      
      for (const part of parts) {
        if (!part) continue;
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        
        try {
          const existing = this.plugin.app.vault.getAbstractFileByPath(currentPath);
          if (!existing) {
            await this.plugin.app.vault.createFolder(currentPath);
          }
        } catch (innerError) {
          if (innerError instanceof Error && !innerError.message.includes('already exists')) {
            throw innerError;
          }
        }
      }
    }
  }
  
  async createOrUpdateFile(
    filePath: string,
    content: string,
    meeting: Meeting,
    appendMode: boolean = false
  ): Promise<{ created: boolean; file: TFile }> {
    const normalizedPath = normalizePath(filePath);
    
    // Use file locking to prevent race conditions
    return await this.lockManager.withLock(normalizedPath, 'createOrUpdate', async () => {
      this.logger.debug(`createOrUpdateFile called for: ${normalizedPath}`);
      
      // Ensure parent folder exists
      const folderPath = normalizedPath.substring(0, normalizedPath.lastIndexOf('/'));
      if (folderPath) {
        await this.ensureFolderExists(folderPath);
      }
      
      const existingFile = this.plugin.app.vault.getAbstractFileByPath(normalizedPath);
      this.logger.debug(`Existing file check: ${existingFile ? existingFile.path : 'not found'}`);
      
      if (existingFile instanceof TFile) {
        // Update existing file
        if (appendMode) {
          // Read existing content and append new content
          const existingContent = await this.plugin.app.vault.read(existingFile);
          const appendedContent = await this.appendNewContent(existingContent, content, meeting);
          await this.plugin.app.vault.modify(existingFile, appendedContent);
          this.logger.debug(`Appended to file: ${normalizedPath}`);
        } else {
          await this.plugin.app.vault.modify(existingFile, content);
          this.logger.debug(`Updated file: ${normalizedPath}`);
        }
        return { created: false, file: existingFile };
      } else if (existingFile) {
        throw new Error(`Path exists but is not a file: ${normalizedPath}`);
      } else {
        // Create new file
        try {
          const file = await this.plugin.app.vault.create(normalizedPath, content);
          this.logger.debug(`Created file: ${normalizedPath}`);
          return { created: true, file };
        } catch (error) {
          this.logger.error(`Failed to create file: ${normalizedPath}`, error);
          // Check if file was created by another process
          const checkAgain = this.plugin.app.vault.getAbstractFileByPath(normalizedPath);
          if (checkAgain instanceof TFile) {
            this.logger.warn(`File was created by another process, updating instead: ${normalizedPath}`);
            await this.plugin.app.vault.modify(checkAgain, content);
            return { created: false, file: checkAgain };
          }
          throw error;
        }
      }
    });
  }
  
  async fileExists(filePath: string): Promise<boolean> {
    const normalizedPath = normalizePath(filePath);
    const file = this.plugin.app.vault.getAbstractFileByPath(normalizedPath);
    return file instanceof TFile;
  }
  
  async readFile(filePath: string): Promise<string> {
    const normalizedPath = normalizePath(filePath);
    const file = this.plugin.app.vault.getAbstractFileByPath(normalizedPath);
    
    if (!(file instanceof TFile)) {
      throw new Error(`File not found: ${normalizedPath}`);
    }
    
    return await this.plugin.app.vault.read(file);
  }
  
  async getFileByPath(filePath: string): Promise<TFile | null> {
    const normalizedPath = normalizePath(filePath);
    const file = this.plugin.app.vault.getAbstractFileByPath(normalizedPath);
    return file instanceof TFile ? file : null;
  }
  
  extractGranolaId(content: string): string | null {
    // Extract granolaId from frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) return null;
    
    const granolaIdMatch = frontmatterMatch[1].match(/granolaId:\s*["']?([^"'\n]+)["']?/);
    return granolaIdMatch ? granolaIdMatch[1] : null;
  }
  
  /**
   * Clean up resources
   */
  cleanup(): void {
    this.lockManager.cleanup();
  }

  private async appendNewContent(
    existingContent: string, 
    newContent: string, 
    meeting: Meeting
  ): Promise<string> {
    // Extract the frontmatter from new content
    const newFrontmatterMatch = newContent.match(/^---\n([\s\S]*?)\n---\n/);
    const newBodyStart = newFrontmatterMatch ? newFrontmatterMatch[0].length : 0;
    const newBody = newContent.substring(newBodyStart);

    // Extract sections from new content that might be new (e.g., new panels)
    const newSections = this.extractNewSections(existingContent, newBody, meeting);

    if (newSections.length === 0) {
      // No new content to append
      this.logger.debug('No new sections found to append');
      return existingContent;
    }

    // Append new sections at the end of the document
    const appendMarker = '\n\n---\n## Updated Content\n';
    const timestamp = new Date().toLocaleString();
    const updateHeader = `${appendMarker}_Last updated: ${timestamp}_\n\n`;
    
    return existingContent + updateHeader + newSections.join('\n\n');
  }

  private extractNewSections(
    existingContent: string, 
    newBody: string,
    meeting: Meeting
  ): string[] {
    const newSections: string[] = [];
    
    // Extract panel sections from new content
    if (meeting.panels) {
      const existingPanelIds = this.extractExistingPanelIds(existingContent);
      
      for (const panel of meeting.panels) {
        if (!existingPanelIds.has(panel.panel_template_id)) {
          // This is a new panel, extract its content from newBody
          const panelSection = this.extractPanelSection(newBody, panel.title);
          if (panelSection) {
            newSections.push(panelSection);
          }
        }
      }
    }

    // Check for new transcript content
    if (meeting.transcript && !existingContent.includes('## Transcript')) {
      const transcriptSection = this.extractSection(newBody, '## Transcript');
      if (transcriptSection) {
        newSections.push(transcriptSection);
      }
    }

    return newSections;
  }

  private extractExistingPanelIds(content: string): Set<string> {
    const panelIds = new Set<string>();
    // Look for panel IDs in HTML comments
    const panelIdMatches = content.matchAll(/<!-- panel-id: ([^-]+) -->/g);
    for (const match of panelIdMatches) {
      panelIds.add(match[1]);
    }
    return panelIds;
  }

  private extractPanelSection(content: string, panelTitle: string): string | null {
    // Use literal string matching to avoid ReDoS vulnerability
    const searchString = `## Panel: ${panelTitle}`;
    const startIndex = content.indexOf(searchString);
    if (startIndex === -1) return null;
    
    // Find the start of the next section
    const nextSectionIndex = content.indexOf('\n## ', startIndex + 1);
    const endIndex = nextSectionIndex !== -1 ? nextSectionIndex : content.length;
    
    return content.substring(startIndex, endIndex).trim();
  }

  private extractSection(content: string, sectionHeader: string): string | null {
    // Use literal string matching to avoid ReDoS vulnerability
    const startIndex = content.indexOf(sectionHeader);
    if (startIndex === -1) return null;
    
    // Find the start of the next section
    const nextSectionIndex = content.indexOf('\n## ', startIndex + 1);
    const endIndex = nextSectionIndex !== -1 ? nextSectionIndex : content.length;
    
    return content.substring(startIndex, endIndex).trim();
  }
}