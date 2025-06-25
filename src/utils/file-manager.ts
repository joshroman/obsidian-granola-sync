import { Plugin, TFile, TFolder, normalizePath } from 'obsidian';
import { Meeting } from '../types';
import { Logger } from './logger';

export class FileManager {
  constructor(
    private plugin: Plugin,
    private logger: Logger
  ) {}
  
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
    meeting: Meeting
  ): Promise<{ created: boolean; file: TFile }> {
    const normalizedPath = normalizePath(filePath);
    
    // Ensure parent folder exists
    const folderPath = normalizedPath.substring(0, normalizedPath.lastIndexOf('/'));
    if (folderPath) {
      await this.ensureFolderExists(folderPath);
    }
    
    const existingFile = this.plugin.app.vault.getAbstractFileByPath(normalizedPath);
    
    if (existingFile instanceof TFile) {
      // Update existing file
      await this.plugin.app.vault.modify(existingFile, content);
      this.logger.debug(`Updated file: ${normalizedPath}`);
      return { created: false, file: existingFile };
    } else if (existingFile) {
      throw new Error(`Path exists but is not a file: ${normalizedPath}`);
    } else {
      // Create new file
      const file = await this.plugin.app.vault.create(normalizedPath, content);
      this.logger.debug(`Created file: ${normalizedPath}`);
      return { created: true, file };
    }
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
}