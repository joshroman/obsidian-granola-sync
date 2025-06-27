# Detailed API Auto-Retrieval Implementation Plan

## Overview

Both Gemini and O3 agree this is technically feasible but fragile and risky. Key consensus points:
- ✅ High user value - transforms impossible setup to seamless
- ⚠️ Fragile - depends on undocumented Granola internals
- ⚠️ Security risks - handling third-party refresh tokens
- ✅ Need explicit user consent
- ✅ Must maintain manual fallback
- ⚠️ High maintenance burden

## Phase 1: Core Token Retrieval Service

### 1.1 Create Token Service with Platform Support
**File**: `src/services/token-retrieval-service.ts`

```typescript
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
  private static readonly logger = new Logger('TokenRetrieval');

  static async getTokenInfo(): Promise<TokenInfo | null> {
    try {
      const filePath = this.getSupabaseFilePath();
      const data = await this.readTokenFile(filePath);
      return this.parseTokenData(data);
    } catch (error) {
      this.logger.error('Failed to retrieve token', error);
      return null;
    }
  }

  private static getSupabaseFilePath(): string {
    const platform = process.platform as keyof typeof this.PLATFORM_PATHS;
    const pathSegments = this.PLATFORM_PATHS[platform];
    
    if (!pathSegments) {
      throw new Error(`Unsupported platform: ${platform}`);
    }

    const homedir = os.homedir();
    return path.join(homedir, ...pathSegments, this.SUPABASE_FILE);
  }

  private static async readTokenFile(filePath: string): Promise<string> {
    try {
      return await fs.promises.readFile(filePath, 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error('Granola not installed or user not logged in');
      }
      throw error;
    }
  }

  private static parseTokenData(data: string): TokenInfo {
    const supabaseData = JSON.parse(data);
    if (!supabaseData.cognito_tokens) {
      throw new Error('Invalid token file format');
    }

    const cognitoTokens = JSON.parse(supabaseData.cognito_tokens);
    return {
      accessToken: cognitoTokens.access_token,
      refreshToken: cognitoTokens.refresh_token,
      expiresAt: cognitoTokens.expires_at,
      granolaVersion: supabaseData.app_version
    };
  }

  static isTokenExpired(tokenInfo: TokenInfo): boolean {
    if (!tokenInfo.expiresAt) return false;
    const now = Date.now() / 1000;
    return now >= tokenInfo.expiresAt - 300; // 5 min buffer
  }
}
```

### 1.2 Create Token Manager with Security Focus
**File**: `src/services/token-manager.ts`

```typescript
export class TokenManager {
  private tokenInfo: TokenInfo | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;
  
  constructor(
    private plugin: Plugin,
    private logger: Logger
  ) {}

  async initialize(): Promise<boolean> {
    // Never store tokens in settings - memory only
    const tokenInfo = await TokenRetrievalService.getTokenInfo();
    if (tokenInfo) {
      this.tokenInfo = tokenInfo;
      this.scheduleRefresh(tokenInfo);
      return true;
    }
    return false;
  }

  getAccessToken(): string | null {
    return this.tokenInfo?.accessToken || null;
  }

  private scheduleRefresh(tokenInfo: TokenInfo): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    if (tokenInfo.expiresAt) {
      const now = Date.now() / 1000;
      const refreshIn = (tokenInfo.expiresAt - now - 600) * 1000; // 10 min before expiry
      
      if (refreshIn > 0) {
        this.refreshTimer = setTimeout(() => {
          this.refreshToken();
        }, refreshIn);
      }
    }
  }

  private async refreshToken(): Promise<void> {
    try {
      const newTokenInfo = await TokenRetrievalService.getTokenInfo();
      if (newTokenInfo) {
        this.tokenInfo = newTokenInfo;
        this.scheduleRefresh(newTokenInfo);
        this.logger.info('Token refreshed successfully');
      }
    } catch (error) {
      this.logger.error('Token refresh failed', error);
      // Notify user that re-authentication may be needed
      new Notice('Granola authentication expired. Please log into Granola and try again.');
    }
  }

  cleanup(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    this.tokenInfo = null; // Clear from memory
  }
}
```

### 1.3 Update Granola Service Headers
**File**: `src/services/enhanced-granola-service.ts`

Add platform-aware headers:

```typescript
private getHeaders(): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'X-App-Version': this.getGranolaVersion(),
    'User-Agent': this.getUserAgent(),
    'X-Client-Type': 'electron',
    'X-Client-Platform': this.getPlatform(),
    'X-Client-Architecture': this.getArchitecture(),
    'X-Client-Id': `granola-electron-${this.getGranolaVersion()}`
  };

  if (this.apiKey) {
    headers['Authorization'] = `Bearer ${this.apiKey}`;
  }

  return headers;
}

private getGranolaVersion(): string {
  // Start with known working version, can be updated from token file
  return this.detectedVersion || '6.4.0';
}

private getUserAgent(): string {
  const platform = process.platform;
  const arch = process.arch;
  const osVersion = os.release();
  
  return `Granola/${this.getGranolaVersion()} Electron/33.4.5 Chrome/130.0.6723.191 Node/20.18.3 (${platform} ${osVersion})`;
}

private getPlatform(): string {
  const platform = process.platform;
  return platform === 'win32' ? 'win32' : platform;
}

private getArchitecture(): string {
  return process.arch === 'x64' ? 'x64' : 'arm64';
}
```

## Phase 2: UI/UX Updates with Consent

### 2.1 Create Consent Modal
**File**: `src/ui/consent-modal.ts`

```typescript
export class GranolaConsentModal extends Modal {
  private onAccept: () => void;
  private onDecline: () => void;

  constructor(
    app: App,
    onAccept: () => void,
    onDecline: () => void
  ) {
    super(app);
    this.onAccept = onAccept;
    this.onDecline = onDecline;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('granola-consent-modal');

    contentEl.createEl('h2', { text: 'Connect to Granola' });

    contentEl.createEl('p', {
      text: 'Granola Sync can automatically connect to your local Granola installation.'
    });

    const detailsEl = contentEl.createEl('div', { cls: 'granola-consent-details' });
    detailsEl.createEl('p', {
      text: 'This plugin will:'
    });

    const listEl = detailsEl.createEl('ul');
    listEl.createEl('li', { text: 'Read authentication data from your local Granola app' });
    listEl.createEl('li', { text: 'Use this data only to sync your meetings' });
    listEl.createEl('li', { text: 'Keep all data local - nothing is sent to third parties' });

    contentEl.createEl('p', { 
      cls: 'granola-consent-warning',
      text: 'Note: This connection may break if Granola updates. A manual option is available if needed.'
    });

    const buttonContainer = contentEl.createEl('div', { cls: 'button-container' });
    
    const acceptBtn = buttonContainer.createEl('button', {
      text: 'Allow Connection',
      cls: 'mod-cta'
    });
    acceptBtn.addEventListener('click', () => {
      this.onAccept();
      this.close();
    });

    const declineBtn = buttonContainer.createEl('button', {
      text: 'Configure Manually'
    });
    declineBtn.addEventListener('click', () => {
      this.onDecline();
      this.close();
    });
  }
}
```

### 2.2 Update Setup Wizard
**File**: `src/ui/enhanced-wizard-modal.ts`

Update API key step:

```typescript
private async createApiKeyStep(): Promise<void> {
  const stepDiv = this.stepsContainer.createDiv({ cls: 'wizard-step' });
  
  stepDiv.createEl('h3', { text: 'Connect to Granola' });
  
  // First, check if user has given consent
  if (!this.plugin.settings.granolaConsentGiven) {
    new GranolaConsentModal(
      this.app,
      async () => {
        this.plugin.settings.granolaConsentGiven = true;
        await this.plugin.saveSettings();
        await this.attemptAutoConnection(stepDiv);
      },
      () => {
        this.showManualConfiguration(stepDiv);
      }
    ).open();
  } else {
    await this.attemptAutoConnection(stepDiv);
  }
}

private async attemptAutoConnection(container: HTMLElement): Promise<void> {
  const statusEl = container.createEl('div', { cls: 'granola-connection-status' });
  statusEl.createEl('span', { text: '🔄 Searching for Granola installation...' });

  try {
    const tokenInfo = await TokenRetrievalService.getTokenInfo();
    if (tokenInfo) {
      statusEl.empty();
      statusEl.createEl('span', { 
        text: '✅ Granola detected!',
        cls: 'success-message' 
      });
      
      // Initialize token manager
      this.plugin.tokenManager = new TokenManager(this.plugin, this.logger);
      await this.plugin.tokenManager.initialize();
      
      // Test the connection
      const isValid = await this.testConnection(tokenInfo.accessToken);
      if (isValid) {
        statusEl.createEl('p', { text: 'Connection verified successfully.' });
        this.enableNextButton();
      } else {
        throw new Error('Connection test failed');
      }
    } else {
      throw new Error('No token found');
    }
  } catch (error) {
    statusEl.empty();
    statusEl.createEl('span', { 
      text: '❌ Granola not detected',
      cls: 'error-message'
    });
    
    const helpEl = container.createEl('div', { cls: 'granola-help-text' });
    helpEl.createEl('p', { text: 'Please ensure:' });
    const helpList = helpEl.createEl('ul');
    helpList.createEl('li', { text: 'Granola is installed' });
    helpList.createEl('li', { text: 'You are logged into Granola' });
    helpList.createEl('li', { text: 'Granola has been opened at least once' });
    
    const buttonContainer = container.createEl('div', { cls: 'button-container' });
    
    const retryBtn = buttonContainer.createEl('button', {
      text: 'Try Again',
      cls: 'mod-cta'
    });
    retryBtn.addEventListener('click', () => {
      this.attemptAutoConnection(container);
    });
    
    const manualBtn = buttonContainer.createEl('button', {
      text: 'Enter Manually (Advanced)'
    });
    manualBtn.addEventListener('click', () => {
      this.showManualConfiguration(container);
    });
  }
}

private showManualConfiguration(container: HTMLElement): void {
  container.empty();
  container.createEl('h4', { text: 'Manual Configuration (Advanced)' });
  
  container.createEl('p', {
    text: 'This option is for advanced users who have access to their Granola API token.',
    cls: 'setting-item-description'
  });
  
  const inputContainer = container.createDiv();
  const input = inputContainer.createEl('input', {
    type: 'password',
    placeholder: 'Enter your Granola API token',
    cls: 'granola-api-input'
  });
  
  const testBtn = inputContainer.createEl('button', {
    text: 'Test Connection',
    cls: 'mod-cta'
  });
  
  testBtn.addEventListener('click', async () => {
    const token = input.value.trim();
    if (token) {
      const isValid = await this.testConnection(token);
      if (isValid) {
        this.plugin.settings.useManualToken = true;
        this.plugin.settings.manualApiToken = token;
        await this.plugin.saveSettings();
        new Notice('✅ Connection successful!');
        this.enableNextButton();
      }
    }
  });
}
```

### 2.3 Update Settings Tab
**File**: `src/ui/settings-tab.ts`

Replace API key field with connection status:

```typescript
private addConnectionSettings(containerEl: HTMLElement): void {
  containerEl.createEl('h3', { text: 'Granola Connection' });

  const statusSetting = new Setting(containerEl)
    .setName('Connection Status')
    .setDesc(this.getConnectionStatusDescription());

  // Add status indicator
  const statusEl = statusSetting.controlEl.createDiv({ cls: 'granola-status' });
  this.updateConnectionStatus(statusEl);

  // Add action buttons
  statusSetting.addButton(button => button
    .setButtonText('Check Connection')
    .onClick(async () => {
      await this.checkConnection(statusEl);
    }));

  if (this.plugin.settings.useManualToken) {
    statusSetting.addButton(button => button
      .setButtonText('Switch to Auto')
      .onClick(async () => {
        this.plugin.settings.useManualToken = false;
        await this.plugin.saveSettings();
        await this.checkConnection(statusEl);
      }));
  }

  // Advanced section (collapsed by default)
  const advancedDetails = containerEl.createEl('details', { cls: 'granola-advanced' });
  advancedDetails.createEl('summary', { text: 'Advanced Options' });
  
  new Setting(advancedDetails)
    .setName('Manual Token')
    .setDesc('For advanced users only')
    .addText(text => text
      .setPlaceholder('Enter token manually')
      .setValue(this.plugin.settings.useManualToken ? '••••••••' : '')
      .onChange(async (value) => {
        if (value) {
          this.plugin.settings.useManualToken = true;
          this.plugin.settings.manualApiToken = value;
          await this.plugin.saveSettings();
        }
      }));
}

private async updateConnectionStatus(statusEl: HTMLElement): Promise<void> {
  statusEl.empty();
  
  if (this.plugin.tokenManager?.getAccessToken()) {
    statusEl.createEl('span', { 
      text: '✅ Connected',
      cls: 'status-connected' 
    });
  } else if (this.plugin.settings.useManualToken && this.plugin.settings.manualApiToken) {
    statusEl.createEl('span', { 
      text: '🔑 Manual token',
      cls: 'status-manual' 
    });
  } else {
    statusEl.createEl('span', { 
      text: '❌ Not connected',
      cls: 'status-disconnected' 
    });
  }
}
```

## Phase 3: Test Updates

### 3.1 Unit Tests for Token Retrieval
**File**: `tests/services/token-retrieval-service.test.ts`

```typescript
import { TokenRetrievalService } from '../../src/services/token-retrieval-service';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

jest.mock('fs/promises');
jest.mock('os');

describe('TokenRetrievalService', () => {
  const mockHomedir = '/home/testuser';
  const validSupabaseJson = {
    cognito_tokens: JSON.stringify({
      access_token: 'test-access-token',
      refresh_token: 'test-refresh-token',
      expires_at: Date.now() / 1000 + 3600
    }),
    app_version: '6.4.0'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (os.homedir as jest.Mock).mockReturnValue(mockHomedir);
  });

  describe('getTokenInfo', () => {
    it('should retrieve tokens on macOS', async () => {
      Object.defineProperty(process, 'platform', { value: 'darwin' });
      
      const expectedPath = path.join(
        mockHomedir,
        'Library/Application Support/Granola/supabase.json'
      );
      
      (fs.readFile as jest.Mock).mockResolvedValue(
        JSON.stringify(validSupabaseJson)
      );

      const result = await TokenRetrievalService.getTokenInfo();

      expect(fs.readFile).toHaveBeenCalledWith(expectedPath, 'utf8');
      expect(result).toEqual({
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresAt: expect.any(Number),
        granolaVersion: '6.4.0'
      });
    });

    it('should retrieve tokens on Windows', async () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      
      const expectedPath = path.join(
        mockHomedir,
        'AppData/Roaming/Granola/supabase.json'
      );
      
      (fs.readFile as jest.Mock).mockResolvedValue(
        JSON.stringify(validSupabaseJson)
      );

      const result = await TokenRetrievalService.getTokenInfo();

      expect(fs.readFile).toHaveBeenCalledWith(expectedPath, 'utf8');
      expect(result).toBeTruthy();
    });

    it('should handle missing file gracefully', async () => {
      (fs.readFile as jest.Mock).mockRejectedValue({ code: 'ENOENT' });

      const result = await TokenRetrievalService.getTokenInfo();

      expect(result).toBeNull();
    });

    it('should handle malformed JSON', async () => {
      (fs.readFile as jest.Mock).mockResolvedValue('invalid json');

      const result = await TokenRetrievalService.getTokenInfo();

      expect(result).toBeNull();
    });

    it('should handle missing cognito_tokens field', async () => {
      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify({}));

      const result = await TokenRetrievalService.getTokenInfo();

      expect(result).toBeNull();
    });
  });

  describe('isTokenExpired', () => {
    it('should detect expired tokens', () => {
      const expiredToken = {
        accessToken: 'token',
        refreshToken: 'refresh',
        expiresAt: Date.now() / 1000 - 100
      };

      expect(TokenRetrievalService.isTokenExpired(expiredToken)).toBe(true);
    });

    it('should detect valid tokens', () => {
      const validToken = {
        accessToken: 'token',
        refreshToken: 'refresh',
        expiresAt: Date.now() / 1000 + 3600
      };

      expect(TokenRetrievalService.isTokenExpired(validToken)).toBe(false);
    });

    it('should apply 5-minute buffer', () => {
      const almostExpiredToken = {
        accessToken: 'token',
        refreshToken: 'refresh',
        expiresAt: Date.now() / 1000 + 200 // Less than 5 min
      };

      expect(TokenRetrievalService.isTokenExpired(almostExpiredToken)).toBe(true);
    });
  });
});
```

### 3.2 Integration Tests
**File**: `tests/integration/auto-auth.test.ts`

```typescript
describe('Auto Authentication Integration', () => {
  let plugin: GranolaSyncPlugin;
  let mockFs: any;

  beforeEach(() => {
    // Mock file system with test tokens
    mockFs = {
      '/home/test/Library/Application Support/Granola/supabase.json': JSON.stringify({
        cognito_tokens: JSON.stringify({
          access_token: 'integration-test-token',
          refresh_token: 'integration-refresh-token',
          expires_at: Date.now() / 1000 + 3600
        })
      })
    };

    // Setup plugin with mocked file system
    plugin = new GranolaSyncPlugin();
  });

  it('should auto-detect Granola on plugin load', async () => {
    await plugin.onload();

    expect(plugin.tokenManager).toBeDefined();
    expect(plugin.tokenManager.getAccessToken()).toBe('integration-test-token');
  });

  it('should fall back to manual token if auto-detection fails', async () => {
    // Remove mock file
    delete mockFs['/home/test/Library/Application Support/Granola/supabase.json'];

    await plugin.onload();

    expect(plugin.tokenManager.getAccessToken()).toBeNull();
    expect(plugin.settings.useManualToken).toBe(false);
  });

  it('should handle token refresh', async () => {
    jest.useFakeTimers();

    await plugin.onload();

    // Fast-forward to near token expiry
    jest.advanceTimersByTime(50 * 60 * 1000); // 50 minutes

    // Update mock file with new token
    mockFs['/home/test/Library/Application Support/Granola/supabase.json'] = JSON.stringify({
      cognito_tokens: JSON.stringify({
        access_token: 'refreshed-token',
        refresh_token: 'new-refresh-token',
        expires_at: Date.now() / 1000 + 7200
      })
    });

    // Trigger refresh
    jest.advanceTimersByTime(11 * 60 * 1000); // 11 more minutes

    expect(plugin.tokenManager.getAccessToken()).toBe('refreshed-token');

    jest.useRealTimers();
  });
});
```

### 3.3 Security Tests
**File**: `tests/security/token-handling.test.ts`

```typescript
describe('Token Security', () => {
  it('should never log tokens', () => {
    const consoleSpy = jest.spyOn(console, 'log');
    const tokenInfo = {
      accessToken: 'secret-token',
      refreshToken: 'secret-refresh'
    };

    // Run various operations that might log
    const service = new TokenRetrievalService();
    // ... operations ...

    // Verify no tokens were logged
    const allLogs = consoleSpy.mock.calls.flat().join(' ');
    expect(allLogs).not.toContain('secret-token');
    expect(allLogs).not.toContain('secret-refresh');
  });

  it('should clear tokens from memory on cleanup', () => {
    const tokenManager = new TokenManager(mockPlugin, mockLogger);
    tokenManager.initialize();

    // Verify token exists
    expect(tokenManager.getAccessToken()).toBeTruthy();

    // Cleanup
    tokenManager.cleanup();

    // Verify token cleared
    expect(tokenManager.getAccessToken()).toBeNull();
  });

  it('should not persist tokens to disk', async () => {
    const plugin = new GranolaSyncPlugin();
    await plugin.onload();

    // Check settings don't contain tokens
    expect(plugin.settings.apiKey).toBeUndefined();
    expect(JSON.stringify(plugin.settings)).not.toContain('token');
  });
});
```

## Phase 4: Error Handling & Recovery

### 4.1 Enhanced Error Messages
**File**: `src/utils/error-messages.ts`

```typescript
export const ErrorMessages = {
  GRANOLA_NOT_INSTALLED: {
    title: 'Granola Not Detected',
    message: 'Please ensure Granola is installed and you have logged in at least once.',
    actions: [
      'Download Granola from https://granola.app',
      'Open Granola and log in',
      'Try connecting again'
    ]
  },
  
  TOKEN_EXPIRED: {
    title: 'Authentication Expired',
    message: 'Your Granola session has expired.',
    actions: [
      'Open Granola to refresh your session',
      'Try connecting again',
      'Use manual token option if issue persists'
    ]
  },
  
  UNSUPPORTED_CLIENT: {
    title: 'Connection Failed',
    message: 'Unable to connect to Granola API.',
    actions: [
      'Ensure you have the latest version of Granola',
      'Check your internet connection',
      'Contact support if issue persists'
    ]
  },
  
  PLATFORM_NOT_SUPPORTED: {
    title: 'Platform Not Supported',
    message: 'Auto-detection is not yet available for your operating system.',
    actions: [
      'Use the manual token option',
      'Check for plugin updates'
    ]
  }
};

export function showErrorWithActions(error: keyof typeof ErrorMessages): void {
  const errorInfo = ErrorMessages[error];
  const notice = new Notice('', 0); // Persistent notice
  
  const container = notice.noticeEl;
  container.empty();
  container.addClass('granola-error-notice');
  
  container.createEl('h4', { text: errorInfo.title });
  container.createEl('p', { text: errorInfo.message });
  
  if (errorInfo.actions.length > 0) {
    const actionList = container.createEl('ul');
    errorInfo.actions.forEach(action => {
      actionList.createEl('li', { text: action });
    });
  }
  
  const dismissBtn = container.createEl('button', {
    text: 'Dismiss',
    cls: 'mod-cta'
  });
  dismissBtn.addEventListener('click', () => notice.hide());
}
```

## Phase 5: Documentation Updates

### 5.1 Update README.md
Remove API key instructions and add:

```markdown
## Getting Started

1. **Install Granola**: Download from [granola.app](https://granola.app)
2. **Log into Granola**: Open Granola and sign in with your account
3. **Install Plugin**: Search for "Granola Sync" in Obsidian Community Plugins
4. **Enable Plugin**: Toggle on and click the Granola icon to start setup
5. **Allow Connection**: Grant permission for the plugin to connect to Granola
6. **Start Syncing**: Your meetings will automatically sync to your vault

### Troubleshooting

**"Granola not detected" error**
- Ensure Granola is installed and you've logged in
- Try opening Granola first, then retry connection
- Use "Enter Manually (Advanced)" option if needed

**"Authentication expired" error**
- Open Granola to refresh your session
- Click "Check Connection" in plugin settings

**Platform Support**
- ✅ macOS: Fully supported
- ✅ Windows: Fully supported
- ✅ Linux: Fully supported
- 🚧 Mobile: Not supported (desktop only)
```

### 5.2 Migration for Existing Users
**File**: `src/migration/token-migration.ts`

```typescript
export async function migrateExistingUsers(plugin: GranolaSyncPlugin): Promise<void> {
  // Check if user has old manual API key
  if (plugin.settings.apiKey && !plugin.settings.migrationComplete) {
    const notice = new Notice('', 0);
    const container = notice.noticeEl;
    
    container.createEl('h4', { text: 'Granola Sync Update' });
    container.createEl('p', { 
      text: 'This plugin now connects automatically to Granola. Would you like to switch to automatic connection?'
    });
    
    const btnContainer = container.createDiv({ cls: 'button-container' });
    
    const yesBtn = btnContainer.createEl('button', {
      text: 'Yes, use automatic',
      cls: 'mod-cta'
    });
    yesBtn.addEventListener('click', async () => {
      try {
        const tokenInfo = await TokenRetrievalService.getTokenInfo();
        if (tokenInfo) {
          plugin.tokenManager = new TokenManager(plugin, new Logger('TokenManager'));
          await plugin.tokenManager.initialize();
          
          // Clear old API key
          delete plugin.settings.apiKey;
          plugin.settings.migrationComplete = true;
          await plugin.saveSettings();
          
          new Notice('✅ Switched to automatic connection!');
        }
      } catch (error) {
        new Notice('❌ Auto-detection failed. Keeping manual token.');
      }
      notice.hide();
    });
    
    const noBtn = btnContainer.createEl('button', {
      text: 'Keep manual token'
    });
    noBtn.addEventListener('click', () => {
      plugin.settings.migrationComplete = true;
      plugin.settings.useManualToken = true;
      plugin.settings.manualApiToken = plugin.settings.apiKey;
      delete plugin.settings.apiKey;
      plugin.saveSettings();
      notice.hide();
    });
  }
}
```

## Implementation Order

1. **Phase 1**: Core token retrieval (1-2 days)
   - TokenRetrievalService
   - TokenManager
   - Update API headers

2. **Phase 2**: UI updates (1-2 days)
   - Consent modal
   - Update wizard
   - Update settings tab

3. **Phase 3**: Testing (1 day)
   - Unit tests
   - Integration tests
   - Security tests

4. **Phase 4**: Error handling (1 day)
   - Enhanced error messages
   - Recovery flows

5. **Phase 5**: Documentation & migration (1 day)
   - Update README
   - Migration for existing users

## Risk Mitigation

1. **Version Detection**: Read Granola version from token file
2. **Fallback Path**: Always maintain manual token option
3. **Clear Communication**: Explicit consent and warnings about fragility
4. **Monitoring**: Log Granola version changes
5. **Quick Updates**: Prepare for rapid patches when Granola updates

## Success Metrics

- Zero-config setup for 90%+ of users
- <5 seconds to detect and connect
- Clear error messages when detection fails
- Smooth migration for existing users
- No security vulnerabilities