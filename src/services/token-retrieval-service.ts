import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Logger } from '../utils/logger';

export interface TokenInfo {
  accessToken: string;
  refreshToken: string;
  expiresAt?: number;
  granolaVersion?: string;
}

export class TokenRetrievalService {
  private static readonly PLATFORM_PATHS = {
    darwin: ['Library', 'Application Support', 'Granola'],
    win32: ['AppData', 'Roaming', 'Granola'],
    linux: ['.config', 'Granola']
  };

  private static readonly SUPABASE_FILE = 'supabase.json';
  
  /**
   * Attempts to retrieve authentication tokens from the local Granola installation.
   * This is an experimental feature that reads from Granola's local storage.
   * 
   * @returns TokenInfo if successful, null if Granola is not installed or user not logged in
   */
  static getTokenInfo(): TokenInfo | null {
    try {
      const filePath = this.getSupabaseFilePath();
      console.log('[Granola Plugin Debug] Looking for token file at:', filePath);
      const data = this.readTokenFile(filePath);
      console.log('[Granola Plugin Debug] Token file read successfully');
      const tokenInfo = this.parseTokenData(data);
      console.log('[Granola Plugin Debug] Token parsed successfully, version:', tokenInfo.granolaVersion);
      return tokenInfo;
    } catch (error) {
      // Log the actual error for debugging
      console.error('[Granola Plugin Debug] Failed to get token info. Error:', error);
      return null;
    }
  }

  private static getSupabaseFilePath(): string {
    const platform = process.platform as keyof typeof this.PLATFORM_PATHS;
    const pathSegments = this.PLATFORM_PATHS[platform];
    
    if (!pathSegments) {
      throw new Error(`Platform not supported: ${platform}`);
    }

    const homedir = os.homedir();
    
    // Handle Windows APPDATA environment variable
    if (platform === 'win32') {
      const appData = process.env.APPDATA || path.join(homedir, 'AppData', 'Roaming');
      return path.join(appData, 'Granola', this.SUPABASE_FILE);
    }
    
    return path.join(homedir, ...pathSegments, this.SUPABASE_FILE);
  }

  private static readTokenFile(filePath: string): string {
    try {
      // Check if file exists first
      if (!fs.existsSync(filePath)) {
        throw new Error('Granola not installed or user not logged in');
      }
      return fs.readFileSync(filePath, 'utf8');
    } catch (error: any) {
      if (error.code === 'ENOENT' || error.message.includes('not installed')) {
        throw new Error('Granola not installed or user not logged in');
      }
      throw error;
    }
  }

  private static parseTokenData(data: string): TokenInfo {
    let supabaseData: any;
    try {
      supabaseData = JSON.parse(data);
    } catch {
      throw new Error('Invalid token file format');
    }

    if (!supabaseData.cognito_tokens) {
      throw new Error('Token data not found');
    }

    let cognitoTokens: any;
    try {
      cognitoTokens = JSON.parse(supabaseData.cognito_tokens);
    } catch {
      throw new Error('Invalid token format');
    }

    if (!cognitoTokens.access_token || !cognitoTokens.refresh_token) {
      throw new Error('Missing required tokens');
    }

    return {
      accessToken: cognitoTokens.access_token,
      refreshToken: cognitoTokens.refresh_token,
      expiresAt: cognitoTokens.expires_at,
      granolaVersion: supabaseData.app_version
    };
  }

  /**
   * Checks if a token is expired or will expire soon (within 5 minutes)
   */
  static isTokenExpired(tokenInfo: TokenInfo): boolean {
    if (!tokenInfo.expiresAt) return false;
    
    const now = Date.now() / 1000;
    const bufferTime = 300; // 5 minutes buffer
    
    return now >= tokenInfo.expiresAt - bufferTime;
  }

  /**
   * Gets a human-readable error message for common token retrieval failures
   */
  static getErrorMessage(error: any): string {
    const errorMessage = error?.message || '';
    
    if (errorMessage.includes('not installed')) {
      return 'Granola is not installed or you need to log in to Granola first.';
    }
    
    if (errorMessage.includes('Platform not supported')) {
      return 'Automatic connection is not available for your operating system.';
    }
    
    if (errorMessage.includes('Invalid token')) {
      return 'Unable to read Granola authentication data. Please ensure Granola is up to date.';
    }
    
    return 'Unable to connect to Granola automatically. Please ensure Granola is installed and you are logged in.';
  }
}