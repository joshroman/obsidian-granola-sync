import { Plugin, Notice } from 'obsidian';
import { TokenRetrievalService, TokenInfo } from './token-retrieval-service';
import { Logger } from '../utils/logger';

/**
 * Manages authentication tokens in memory only (never persisted to disk).
 * Handles automatic token refresh when tokens are about to expire.
 */
export class TokenManager {
  private tokenInfo: TokenInfo | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;
  private isRefreshing = false;
  
  constructor(
    private plugin: Plugin,
    private logger: Logger
  ) {}

  /**
   * Initialize the token manager by attempting to retrieve tokens
   * @returns true if tokens were successfully retrieved
   */
  async initialize(): Promise<boolean> {
    try {
      this.logger.info('Initializing token manager');
      
      const tokenInfo = TokenRetrievalService.getTokenInfo();
      if (tokenInfo) {
        this.tokenInfo = tokenInfo;
        this.scheduleRefresh(tokenInfo);
        this.logger.info('Token manager initialized successfully');
        return true;
      }
      
      this.logger.warn('No tokens found during initialization');
      return false;
    } catch (error) {
      this.logger.error('Failed to initialize token manager', error);
      return false;
    }
  }

  /**
   * Get the current access token
   * @returns The access token or null if not available
   */
  getAccessToken(): string | null {
    return this.tokenInfo?.accessToken || null;
  }

  /**
   * Get the detected Granola version
   * @returns The Granola version or null if not detected
   */
  getGranolaVersion(): string | null {
    return this.tokenInfo?.granolaVersion || null;
  }

  /**
   * Check if tokens are currently available
   */
  hasTokens(): boolean {
    return this.tokenInfo !== null;
  }

  /**
   * Manually refresh tokens
   * @returns true if refresh was successful
   */
  async refreshTokens(): Promise<boolean> {
    if (this.isRefreshing) {
      this.logger.info('Token refresh already in progress');
      return false;
    }

    try {
      this.isRefreshing = true;
      const newTokenInfo = TokenRetrievalService.getTokenInfo();
      
      if (newTokenInfo) {
        this.tokenInfo = newTokenInfo;
        this.scheduleRefresh(newTokenInfo);
        this.logger.info('Tokens refreshed successfully');
        return true;
      }
      
      return false;
    } catch (error) {
      this.logger.error('Failed to refresh tokens', error);
      return false;
    } finally {
      this.isRefreshing = false;
    }
  }

  /**
   * Schedule automatic token refresh before expiry
   */
  private scheduleRefresh(tokenInfo: TokenInfo): void {
    // Clear any existing timer
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }

    // Only schedule if we have an expiry time
    if (!tokenInfo.expiresAt) {
      this.logger.info('No token expiry time available, skipping auto-refresh');
      return;
    }

    const now = Date.now() / 1000;
    const expiresIn = tokenInfo.expiresAt - now;
    
    // Refresh 10 minutes before expiry
    const refreshIn = (expiresIn - 600) * 1000;
    
    if (refreshIn <= 0) {
      // Token is already expired or about to expire
      this.logger.warn('Token is expired or expiring soon, attempting immediate refresh');
      this.attemptRefresh();
      return;
    }

    this.logger.info(`Scheduling token refresh in ${Math.round(refreshIn / 1000 / 60)} minutes`);
    
    this.refreshTimer = setTimeout(() => {
      this.attemptRefresh();
    }, refreshIn);
  }

  /**
   * Attempt to refresh tokens with error handling
   */
  private async attemptRefresh(): Promise<void> {
    try {
      const success = await this.refreshTokens();
      
      if (!success) {
        // Notify user that re-authentication may be needed
        new Notice(
          'Granola authentication expired. Please ensure Granola is running and you are logged in, then check connection in plugin settings.',
          0
        );
      }
    } catch (error) {
      this.logger.error('Token refresh failed', error);
      new Notice(
        'Failed to refresh Granola authentication. You may need to reconnect.',
        0
      );
    }
  }

  /**
   * Clean up resources and clear tokens from memory
   */
  cleanup(): void {
    this.logger.info('Cleaning up token manager');
    
    // Clear refresh timer
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    
    // Clear tokens from memory
    this.tokenInfo = null;
    this.isRefreshing = false;
  }

  /**
   * Get a status summary for display
   */
  getStatus(): { connected: boolean; version?: string; expiresIn?: number } {
    if (!this.tokenInfo) {
      return { connected: false };
    }

    const status: any = {
      connected: true,
      version: this.tokenInfo.granolaVersion
    };

    if (this.tokenInfo.expiresAt) {
      const now = Date.now() / 1000;
      status.expiresIn = Math.max(0, this.tokenInfo.expiresAt - now);
    }

    return status;
  }
}