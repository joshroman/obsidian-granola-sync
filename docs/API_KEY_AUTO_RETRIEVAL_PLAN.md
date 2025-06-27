# API Key Auto-Retrieval Implementation Plan

## Overview

Currently, the plugin requires users to manually enter an API key, but Granola doesn't provide a way for users to obtain this key. The granola-ts-client project demonstrates how to automatically retrieve the authentication token from the local Granola app installation.

## Current Discovery

### Token Location
- **macOS**: `~/Library/Application Support/Granola/supabase.json`
- **Windows**: Not yet implemented (likely `%APPDATA%\Granola\supabase.json`)
- **Linux**: Not yet implemented (likely `~/.config/Granola/supabase.json`)

### Token Structure
```json
{
  "cognito_tokens": "{\"access_token\":\"...\",\"refresh_token\":\"...\",\"expires_at\":...}"
}
```

### Required Headers
To avoid "Unsupported client" errors, we must send:
```typescript
{
  'X-App-Version': '6.4.0',
  'User-Agent': 'Granola/6.4.0 Electron/33.4.5 ...',
  'X-Client-Type': 'electron',
  'X-Client-Platform': 'darwin', // or 'win32', 'linux'
  'X-Client-Architecture': 'arm64', // or 'x64'
  'X-Client-Id': 'granola-electron-6.4.0'
}
```

## Implementation Plan

### Phase 1: Add Auto-Detection Service

#### 1.1 Create Token Retrieval Service
```typescript
// src/services/token-retrieval-service.ts
export class TokenRetrievalService {
  private static getGranolaDataPath(): string {
    const platform = process.platform;
    const homedir = os.homedir();
    
    switch (platform) {
      case 'darwin':
        return path.join(homedir, 'Library/Application Support/Granola');
      case 'win32':
        return path.join(process.env.APPDATA || '', 'Granola');
      case 'linux':
        return path.join(homedir, '.config/Granola');
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  static async getAuthToken(): Promise<string | null> {
    try {
      const dataPath = this.getGranolaDataPath();
      const supabaseFile = path.join(dataPath, 'supabase.json');
      
      const data = await fs.readFile(supabaseFile, 'utf8');
      const supabaseData = JSON.parse(data);
      const cognitoTokens = JSON.parse(supabaseData.cognito_tokens);
      
      return cognitoTokens.access_token;
    } catch (error) {
      return null; // Granola not installed or not logged in
    }
  }
}
```

#### 1.2 Update GranolaService Headers
Add the required headers to avoid client rejection:
```typescript
private getHeaders(): HeadersInit {
  return {
    'Authorization': `Bearer ${this.apiKey}`,
    'Content-Type': 'application/json',
    'X-App-Version': '6.4.0',
    'User-Agent': this.getUserAgent(),
    'X-Client-Type': 'electron',
    'X-Client-Platform': this.getPlatform(),
    'X-Client-Architecture': this.getArchitecture(),
    'X-Client-Id': 'granola-electron-6.4.0'
  };
}
```

### Phase 2: Update Setup Wizard

#### 2.1 Auto-Detection Step
Add auto-detection before API key input:

```typescript
// In enhanced-wizard-modal.ts
private async createApiKeyStep(): Promise<void> {
  // First, try auto-detection
  const autoToken = await TokenRetrievalService.getAuthToken();
  
  if (autoToken) {
    // Show success message
    stepDiv.createEl('div', {
      cls: 'granola-auto-detect-success',
      text: '✅ Granola installation detected! API key retrieved automatically.'
    });
    
    this.apiKey = autoToken;
    this.testConnection(); // Validate it works
  } else {
    // Show manual input with explanation
    stepDiv.createEl('p', {
      text: 'Unable to automatically detect Granola. Please ensure Granola is installed and you are logged in.'
    });
    
    // Add "Try Again" button
    const retryButton = stepDiv.createEl('button', {
      text: 'Try Auto-Detection Again',
      cls: 'mod-cta'
    });
  }
}
```

#### 2.2 Simplified User Flow
1. User clicks Granola Sync icon
2. Wizard attempts auto-detection
3. If successful → Skip to organization settings
4. If failed → Show helpful message with retry option
5. Remove manual API key input entirely

### Phase 3: Update Settings Tab

#### 3.1 Remove API Key Field
- Remove the manual API key input field
- Replace with status indicator:
  - ✅ "Granola connected" (green)
  - ❌ "Granola not detected" (red)
  - 🔄 "Checking..." (during detection)

#### 3.2 Add Troubleshooting Section
```typescript
new Setting(containerEl)
  .setName('Connection Status')
  .setDesc(this.getConnectionStatusDesc())
  .addButton(button => button
    .setButtonText('Check Connection')
    .onClick(async () => {
      const token = await TokenRetrievalService.getAuthToken();
      if (token) {
        this.plugin.settings.apiKey = token;
        await this.plugin.saveSettings();
        new Notice('✅ Granola connection established!');
      } else {
        new Notice('❌ Granola not detected. Please ensure Granola is running and you are logged in.');
      }
    })
  );
```

### Phase 4: Add Background Token Refresh

#### 4.1 Token Validation
Since tokens expire, add periodic validation:

```typescript
// In main.ts onload()
this.registerInterval(
  window.setInterval(async () => {
    // Every 30 minutes, refresh token if needed
    if (this.settings.apiKey) {
      const newToken = await TokenRetrievalService.getAuthToken();
      if (newToken && newToken !== this.settings.apiKey) {
        this.settings.apiKey = newToken;
        await this.saveSettings();
      }
    }
  }, 30 * 60 * 1000)
);
```

### Phase 5: Update Documentation

#### 5.1 Update README
- Remove API key instructions
- Add "Granola must be installed and running"
- Add troubleshooting for auto-detection

#### 5.2 Update Error Messages
- "API key invalid" → "Unable to connect to Granola. Please ensure Granola is running and you are logged in."
- "Network error" → Keep as is
- Add specific error for "Granola not detected"

## Migration Strategy

### For Existing Users
1. On plugin update, attempt auto-detection
2. If successful, replace stored API key
3. Show notice: "Updated to use automatic Granola detection"
4. If failed, keep existing API key

### For New Users
1. Always use auto-detection
2. No manual API key option
3. Clear instructions if Granola not detected

## Security Considerations

1. **No API Key Storage**: Token retrieved on-demand
2. **Platform Security**: Reading from user's app data (same security as Granola)
3. **Token Refresh**: Automatic handling of expired tokens

## Benefits

1. **Zero Configuration**: Users just install and go
2. **Always Current**: Token automatically refreshed
3. **Better Security**: No manual key handling
4. **Platform Native**: Works like official Granola integrations

## Implementation Priority

1. **High Priority**: 
   - Token retrieval service
   - Update wizard for auto-detection
   - Update API headers

2. **Medium Priority**:
   - Settings tab updates
   - Background token refresh
   - Migration for existing users

3. **Low Priority**:
   - Windows/Linux support
   - Advanced troubleshooting UI

## Testing Requirements

1. Test with Granola installed and logged in
2. Test with Granola not installed
3. Test with Granola installed but not logged in
4. Test token expiration and refresh
5. Test on different platforms (once implemented)