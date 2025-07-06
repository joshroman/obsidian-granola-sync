import { Modal, App, Setting, Notice, ButtonComponent } from 'obsidian';
import GranolaSyncPlugin from '../main';
import { PluginSettings } from '../types';
import { EnhancedGranolaService } from '../services/enhanced-granola-service';
import { StructuredLogger } from '../utils/structured-logger';
import { PerformanceMonitor } from '../utils/performance-monitor';
import { ErrorTracker } from '../utils/error-tracker';
import { TokenRetrievalService } from '../services/token-retrieval-service';
import { TokenManager } from '../services/token-manager';
import { GranolaConsentModal } from './consent-modal';

export interface WizardStep {
  id: string;
  title: string;
  description: string;
  validate?: () => Promise<{ valid: boolean; error?: string }>;
  canSkip?: boolean;
}

export class EnhancedSetupWizard extends Modal {
  private currentStep = 0;
  private steps: WizardStep[] = [];
  private settings: Partial<PluginSettings> = {};
  private logger: StructuredLogger;
  private testApiService: EnhancedGranolaService | null = null;
  private onComplete: (settings: PluginSettings) => void;
  private navigationStack: number[] = [];
  private isConnecting = false;
  
  // State management for form controls
  private templateSyncMode: 'single' | 'all' = 'single';
  private syncMode: 'manual' | 'automatic' = 'manual';
  
  constructor(
    app: App,
    private plugin: GranolaSyncPlugin,
    onComplete: (settings: PluginSettings) => void
  ) {
    super(app);
    this.onComplete = onComplete;
    this.logger = new StructuredLogger('SetupWizard', plugin);
    this.initializeSteps();
    this.settings = { ...plugin.settings };
    
    // Initialize state from settings
    this.templateSyncMode = this.settings.templateFilterEnabled ? 'all' : 'single';
    this.syncMode = this.settings.autoSync ? 'automatic' : 'manual';
  }

  private initializeSteps(): void {
    this.steps = [
      {
        id: 'welcome',
        title: 'Welcome to Granola Sync',
        description: 'This wizard will help you set up Granola Sync for Obsidian. We\'ll configure your API connection, choose how to organize your meeting notes, and set up sync preferences.\n\n⚠️ **Important:** This is an UNOFFICIAL plugin that uses undocumented Granola APIs. It may break without warning when Granola updates. Currently only tested on macOS.',
        canSkip: false
      },
      {
        id: 'api-key',
        title: 'Connect to Granola',
        description: 'Automatically connect to your local Granola installation.',
        validate: async () => {
          // Check if we have a valid token in our local settings (not just token manager)
          const hasValidToken = (this.settings.apiKey && this.settings.apiKey.trim().length > 0) ||
                               this.plugin.tokenManager?.hasTokens();
          
          if (!hasValidToken) {
            return { valid: false, error: 'No connection established. Please ensure Granola is installed and you are logged in.' };
          }
          
          // Actually test the connection to make sure it works
          try {
            const isConnected = await this.plugin.granolaService.testConnection();
            if (!isConnected) {
              return { valid: false, error: 'Connection test failed. Please check your connection and try again.' };
            }
          } catch (error) {
            console.error('[Granola Plugin Debug] Connection validation error:', error);
            return { valid: false, error: 'Failed to test connection. Please try again.' };
          }
          
          return { valid: true };
        },
        canSkip: false
      },
      {
        id: 'target-folder',
        title: 'Choose Meeting Notes Location',
        description: 'Select where your meeting notes will be stored in your vault.',
        validate: async () => {
          const folder = this.settings.targetFolder?.trim();
          if (!folder) {
            return { valid: false, error: 'Please enter a folder name' };
          }
          
          // Check if folder name is valid
          if (folder.includes('..') || folder.startsWith('/')) {
            return { valid: false, error: 'Invalid folder path' };
          }
          
          return { valid: true };
        },
        canSkip: false
      },
      {
        id: 'organization',
        title: 'Organize Your Notes',
        description: 'Choose how to organize your meeting notes within the folder.',
        canSkip: false
      },
      {
        id: 'file-naming',
        title: 'File Naming Convention',
        description: 'Customize how your meeting note files are named.',
        canSkip: false
      },
      {
        id: 'template-settings',
        title: 'Template Configuration',
        description: 'Choose how to handle meeting templates and panels.',
        canSkip: false
      },
      {
        id: 'transcript-settings',
        title: 'Transcript Settings',
        description: 'Configure transcript inclusion in your meeting notes.',
        canSkip: false
      },
      {
        id: 'sync-settings',
        title: 'Sync Preferences',
        description: 'Configure automatic sync and other preferences.',
        canSkip: false
      },
      {
        id: 'complete',
        title: 'Setup Complete!',
        description: 'You\'re all set! Click "Start Syncing" to begin importing your meeting notes.',
        canSkip: false
      }
    ];
  }

  onOpen() {
    this.render();
  }

  private render() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('granola-sync-plugin');
    contentEl.addClass('granola-setup-wizard');
    
    const step = this.steps[this.currentStep];
    
    // Header
    const header = contentEl.createDiv('granola-wizard-header');
    header.createEl('h2', { text: step.title });
    
    // Progress indicator
    const progress = header.createDiv('granola-wizard-progress');
    const progressBar = progress.createDiv('granola-progress-bar');
    const progressFill = progressBar.createDiv('granola-progress-fill');
    progressFill.style.width = `${((this.currentStep + 1) / this.steps.length) * 100}%`;
    
    const progressText = progress.createDiv('granola-progress-text');
    progressText.setText(`Step ${this.currentStep + 1} of ${this.steps.length}`);
    
    // Content
    const content = contentEl.createDiv('granola-wizard-content');
    content.createEl('p', { text: step.description, cls: 'granola-wizard-description' });
    
    // Render step-specific content
    this.renderStepContent(step, content);
    
    // Footer with navigation
    const footer = contentEl.createDiv('granola-wizard-footer');
    
    // Back button
    if (this.currentStep > 0) {
      const backButton = new ButtonComponent(footer)
        .setButtonText('Back')
        .onClick(() => this.previousStep());
    }
    
    // Spacer
    footer.createDiv('spacer');
    
    // Button group for Skip/Next
    const buttonGroup = footer.createDiv('button-group');
    
    // Skip button (if allowed)
    if (step.canSkip && this.currentStep < this.steps.length - 1) {
      new ButtonComponent(buttonGroup)
        .setButtonText('Skip')
        .onClick(() => this.nextStep(true));
    }
    
    // Next/Complete button
    const isLastStep = this.currentStep === this.steps.length - 1;
    const nextButton = new ButtonComponent(buttonGroup)
      .setButtonText(isLastStep ? 'Start Syncing' : 'Next')
      .setCta()
      .onClick(async () => {
        if (isLastStep) {
          await this.complete();
        } else {
          await this.nextStep();
        }
      });
  }

  private renderStepContent(step: WizardStep, container: HTMLElement): void {
    switch (step.id) {
      case 'welcome':
        this.renderWelcomeStep(container);
        break;
      case 'api-key':
        this.renderApiKeyStep(container);
        break;
      case 'target-folder':
        this.renderTargetFolderStep(container);
        break;
      case 'organization':
        this.renderOrganizationStep(container);
        break;
      case 'file-naming':
        this.renderFileNamingStep(container);
        break;
      case 'template-settings':
        this.renderTemplateSettingsStep(container);
        break;
      case 'transcript-settings':
        this.renderTranscriptSettingsStep(container);
        break;
      case 'sync-settings':
        this.renderSyncSettingsStep(container);
        break;
      case 'complete':
        this.renderCompleteStep(container);
        break;
    }
  }

  private renderWelcomeStep(container: HTMLElement): void {
    const features = container.createDiv('granola-wizard-features');
    
    const featureList = [
      { icon: '🔄', title: 'Automatic Sync', desc: 'Keep your meeting notes up to date' },
      { icon: '📁', title: 'Smart Organization', desc: 'Organize notes by date or mirror Granola' },
      { icon: '🔍', title: 'Conflict Resolution', desc: 'Handle edits without losing data' },
      { icon: '⚡', title: 'Performance', desc: 'Optimized for large meeting libraries' }
    ];
    
    featureList.forEach(feature => {
      const featureEl = features.createDiv('granola-feature-item');
      featureEl.createSpan({ text: feature.icon, cls: 'granola-feature-icon' });
      const textEl = featureEl.createDiv('granola-feature-text');
      textEl.createEl('h4', { text: feature.title });
      textEl.createEl('p', { text: feature.desc });
    });
  }

  private async renderApiKeyStep(container: HTMLElement): Promise<void> {
    const apiKeyContainer = container.createDiv('api-key-container');
    
    // Always attempt auto-connection (no manual option)
    await this.attemptAutoConnection(apiKeyContainer);
  }
  
  private async attemptAutoConnection(container: HTMLElement): Promise<void> {
    // Prevent multiple simultaneous connection attempts
    if (this.isConnecting) {
      return;
    }
    
    this.isConnecting = true;
    container.empty();
    
    const statusDiv = container.createDiv('auto-connection-status');
    statusDiv.createEl('h4', { text: 'Connecting to Granola' });
    
    const statusText = statusDiv.createEl('p', { 
      text: '🔄 Searching for Granola installation...',
      cls: 'status-message'
    });
    
    try {
      // Use synchronous method like granola-ts-client
      console.log('[Granola Plugin Debug] Attempting to retrieve token info...');
      const tokenInfo = TokenRetrievalService.getTokenInfo();
      
      if (tokenInfo) {
        console.log('[Granola Plugin Debug] Token info retrieved:', { hasToken: !!tokenInfo.accessToken, version: tokenInfo.granolaVersion });
        statusText.setText('✅ Granola detected! Testing connection...');
        
        // Test the connection with auto-detected token
        const performanceMonitor = new PerformanceMonitor(this.logger);
        const errorTracker = new ErrorTracker(this.logger);
        this.testApiService = new EnhancedGranolaService(
          { 
            apiKey: tokenInfo.accessToken,
            granolaVersion: tokenInfo.granolaVersion 
          },
          this.logger,
          performanceMonitor,
          errorTracker
        );
        
        console.log('[Granola Plugin Debug] Testing API connection...');
        const connected = await this.testApiService.testConnection();
        console.log('[Granola Plugin Debug] Connection test result:', connected);
        
        if (connected) {
          // Success! Token manager is already initialized by service registry
          // Just update our local settings
          this.settings.apiKey = tokenInfo.accessToken;
          
          // Update the plugin's granolaService immediately so validation will pass
          this.plugin.granolaService.updateConfig({ 
            apiKey: tokenInfo.accessToken,
            granolaVersion: tokenInfo.granolaVersion 
          });
          
          statusText.setText('✅ Connected successfully!');
          
          const successDiv = statusDiv.createDiv('success-info');
          if (tokenInfo.granolaVersion && tokenInfo.granolaVersion !== 'unknown') {
            successDiv.createEl('p', {
              text: `Granola version ${tokenInfo.granolaVersion} detected.`,
              cls: 'version-info'
            });
          } else {
            successDiv.createEl('p', {
              text: 'Granola detected and connected.',
              cls: 'version-info'
            });
          }
          
          // Add experimental warning
          const warningDiv = statusDiv.createDiv('experimental-warning');
          warningDiv.createEl('p', {
            text: '⚠️ Note: This automatic connection is experimental and may break if Granola updates.',
            cls: 'warning-text'
          });
          
          // Mark consent as given since they're using the connection
          this.plugin.settings.granolaConsentGiven = true;
          await this.plugin.saveSettings();
          
          // Enable next button
          this.updateNavigationButtons();
        } else {
          throw new Error('Connection test failed');
        }
      } else {
        console.log('[Granola Plugin Debug] No token info found');
        throw new Error('No token found');
      }
    } catch (error) {
      console.error('[Granola Plugin Debug] Auto-connection failed:', error);
      this.handleAutoConnectionError(container, error);
    } finally {
      this.isConnecting = false;
    }
  }
  
  private handleAutoConnectionError(container: HTMLElement, error: any): void {
    container.empty();
    
    const errorDiv = container.createDiv('connection-error');
    errorDiv.createEl('h4', { text: '❌ Connection Failed' });
    
    const errorMessage = TokenRetrievalService.getErrorMessage(error);
    errorDiv.createEl('p', {
      text: errorMessage,
      cls: 'error-message'
    });
    
    // Provide helpful instructions
    const helpDiv = errorDiv.createDiv('error-help');
    helpDiv.createEl('p', { text: 'Please ensure:' });
    const helpList = helpDiv.createEl('ul');
    helpList.createEl('li', { text: 'Granola is installed on your computer' });
    helpList.createEl('li', { text: 'You have logged into Granola at least once' });
    helpList.createEl('li', { text: 'Granola is running' });
    
    // Only retry button - no manual option
    const buttonDiv = errorDiv.createDiv('granola-button-container');
    
    const retryButton = buttonDiv.createEl('button', {
      text: 'Try Again',
      cls: 'mod-cta'
    });
    retryButton.addEventListener('click', () => {
      this.isConnecting = false; // Reset flag before retry
      this.attemptAutoConnection(container.parentElement || container);
    });
  }

  private async updateConnectionStatus(container: HTMLElement): Promise<void> {
    container.empty();
    container.createSpan({ text: 'Testing connection...', cls: 'granola-status-testing' });
    
    const validation = await this.steps[1].validate!();
    container.empty();
    
    if (validation.valid) {
      container.createSpan({ text: '✓ Connected successfully', cls: 'granola-status-success' });
    } else {
      container.createSpan({ text: `✗ ${validation.error}`, cls: 'granola-status-error' });
    }
  }

  private renderTargetFolderStep(container: HTMLElement): void {
    // Add note about top-level folder restriction at the top
    const note = container.createDiv('folder-note');
    note.createEl('p', { 
      text: 'ℹ️ Note: The meetings folder must be located at the top level of your vault.' 
    });
    
    new Setting(container)
      .setName('Meeting Notes Folder')
      .setDesc('Where to store your meeting notes (e.g., "Meetings", "Work/Meetings")')
      .addText(text => text
        .setPlaceholder('Meetings')
        .setValue(this.settings.targetFolder || 'Meetings')
        .onChange(value => {
          this.settings.targetFolder = value;
          // Update preview when folder name changes
          const preview = container.querySelector('.folder-preview') as HTMLElement;
          if (preview) {
            this.updateFolderPreview(preview);
          }
        }));
    
    // Folder preview
    const preview = container.createDiv('folder-preview');
    this.updateFolderPreview(preview);
  }

  private updateFolderPreview(container: HTMLElement): void {
    container.empty();
    const folder = this.settings.targetFolder || 'Meetings';
    
    container.createEl('h4', { text: 'Preview:' });
    const tree = container.createDiv('folder-tree');
    
    // Root vault folder
    const vaultNode = tree.createDiv({ cls: 'tree-node tree-node-root' });
    vaultNode.createSpan({ text: '📁 Your Vault', cls: 'tree-item' });
    
    // Meetings folder (indented)
    const folderNode = tree.createDiv({ cls: 'tree-node tree-node-level-1' });
    folderNode.createSpan({ text: `📁 ${folder}`, cls: 'tree-item tree-folder' });
    
    // Meeting files (double indented)
    const file1Node = tree.createDiv({ cls: 'tree-node tree-node-level-2' });
    file1Node.createSpan({ text: '📄 2024-03-20 Team Meeting.md', cls: 'tree-item tree-file' });
    
    const file2Node = tree.createDiv({ cls: 'tree-node tree-node-level-2' });
    file2Node.createSpan({ text: '📄 2024-03-21 Client Call.md', cls: 'tree-item tree-file' });
  }

  private renderOrganizationStep(container: HTMLElement): void {
    new Setting(container)
      .setName('Folder Organization')
      .setDesc('How to organize meeting notes within your folder')
      .addDropdown(dropdown => {
        dropdown
          .addOption('flat', '📄 All in one folder')
          .addOption('by-date', '📅 Date-based subfolders')
          .addOption('mirror-granola', '🔄 Mirror Granola folders (Not available)')
          .setValue(this.settings.folderOrganization || 'flat')
          .onChange(value => {
            // Don't allow selecting mirror-granola
            if (value === 'mirror-granola') {
              dropdown.setValue(this.settings.folderOrganization || 'flat');
              new Notice('This option is not yet available due to Granola API limitations');
              return;
            }
            this.settings.folderOrganization = value as any;
            this.updateOrganizationPreview(container);
          });
        // Disable the mirror-granola option
        const selectEl = dropdown.selectEl;
        const mirrorOption = selectEl.querySelector('option[value="mirror-granola"]') as HTMLOptionElement;
        if (mirrorOption) {
          mirrorOption.disabled = true;
        }
        return dropdown;
      });
    
    // Add alert about the limitation
    const alert = container.createDiv('setting-alert');
    alert.createEl('p', { 
      text: '⚠️ Note: "Mirror Granola folders" is not available yet due to limitations from Granola\'s API.',
      cls: 'mod-warning'
    });
    
    // Organization preview
    const preview = container.createDiv('organization-preview');
    this.updateOrganizationPreview(container);
  }

  private updateOrganizationPreview(container: HTMLElement): void {
    let preview = container.querySelector('.organization-preview') as HTMLElement;
    if (!preview) {
      preview = container.createDiv('organization-preview');
    }
    
    preview.empty();
    preview.createEl('h4', { text: 'Example structure:' });
    
    const tree = preview.createDiv('folder-tree');
    const folder = this.settings.targetFolder || 'Meetings';
    
    // Root vault folder
    const vaultNode = tree.createDiv({ cls: 'tree-node tree-node-root' });
    vaultNode.createSpan({ text: '📁 Your Vault', cls: 'tree-item' });
    
    switch (this.settings.folderOrganization) {
      case 'by-date':
        // Meetings folder
        const folderNode1 = tree.createDiv({ cls: 'tree-node tree-node-level-1' });
        folderNode1.createSpan({ text: `📁 ${folder}`, cls: 'tree-item tree-folder' });
        
        // Date subfolder 1
        const dateNode1 = tree.createDiv({ cls: 'tree-node tree-node-level-2' });
        dateNode1.createSpan({ text: '📁 2024-03-20', cls: 'tree-item tree-folder' });
        
        // Files in date folder 1
        const file1Node = tree.createDiv({ cls: 'tree-node tree-node-level-3' });
        file1Node.createSpan({ text: '📄 Team Meeting.md', cls: 'tree-item tree-file' });
        
        const file2Node = tree.createDiv({ cls: 'tree-node tree-node-level-3' });
        file2Node.createSpan({ text: '📄 Client Call.md', cls: 'tree-item tree-file' });
        
        // Date subfolder 2
        const dateNode2 = tree.createDiv({ cls: 'tree-node tree-node-level-2' });
        dateNode2.createSpan({ text: '📁 2024-03-21', cls: 'tree-item tree-folder' });
        
        const file3Node = tree.createDiv({ cls: 'tree-node tree-node-level-3' });
        file3Node.createSpan({ text: '📄 Project Review.md', cls: 'tree-item tree-file' });
        break;
        
      case 'mirror-granola':
        // Meetings folder
        const folderNode2 = tree.createDiv({ cls: 'tree-node tree-node-level-1' });
        folderNode2.createSpan({ text: `📁 ${folder}`, cls: 'tree-item tree-folder' });
        
        // Work subfolder
        const workNode = tree.createDiv({ cls: 'tree-node tree-node-level-2' });
        workNode.createSpan({ text: '📁 Work', cls: 'tree-item tree-folder' });
        
        const workFile = tree.createDiv({ cls: 'tree-node tree-node-level-3' });
        workFile.createSpan({ text: '📄 Team Meeting.md', cls: 'tree-item tree-file' });
        
        // Personal subfolder
        const personalNode = tree.createDiv({ cls: 'tree-node tree-node-level-2' });
        personalNode.createSpan({ text: '📁 Personal', cls: 'tree-item tree-folder' });
        
        const personalFile = tree.createDiv({ cls: 'tree-node tree-node-level-3' });
        personalFile.createSpan({ text: '📄 Doctor Appointment.md', cls: 'tree-item tree-file' });
        break;
        
      default:
        // Meetings folder
        const folderNode3 = tree.createDiv({ cls: 'tree-node tree-node-level-1' });
        folderNode3.createSpan({ text: `📁 ${folder}`, cls: 'tree-item tree-folder' });
        
        // Files directly in meetings folder
        const flat1 = tree.createDiv({ cls: 'tree-node tree-node-level-2' });
        flat1.createSpan({ text: '📄 2024-03-20 Team Meeting.md', cls: 'tree-item tree-file' });
        
        const flat2 = tree.createDiv({ cls: 'tree-node tree-node-level-2' });
        flat2.createSpan({ text: '📄 2024-03-21 Client Call.md', cls: 'tree-item tree-file' });
        
        const flat3 = tree.createDiv({ cls: 'tree-node tree-node-level-2' });
        flat3.createSpan({ text: '📄 2024-03-22 Project Review.md', cls: 'tree-item tree-file' });
    }
  }

  private renderFileNamingStep(container: HTMLElement): void {
    new Setting(container)
      .setName('Include Date in Filename')
      .setDesc('Add the meeting date to the filename')
      .addToggle(toggle => toggle
        .setValue(this.settings.includeDateInFilename ?? true)
        .onChange(value => {
          this.settings.includeDateInFilename = value;
          this.updateNamingPreview(container);
        }));
    
    if (this.settings.includeDateInFilename) {
      new Setting(container)
        .setName('Date Format')
        .setDesc('Format for dates in filenames')
        .addDropdown(dropdown => dropdown
          .addOption('yyyy-MM-dd', '2024-03-20 (Default)')
          .addOption('dd-MM-yyyy', '20-03-2024')
          .addOption('MM-dd-yyyy', '03-20-2024')
          .addOption('yyyy.MM.dd', '2024.03.20')
          .setValue(this.settings.dateFormat || 'yyyy-MM-dd')
          .onChange(value => {
            this.settings.dateFormat = value;
            this.updateNamingPreview(container);
          }));
    }
    
    // Naming preview
    const preview = container.createDiv('naming-preview');
    this.updateNamingPreview(container);
  }

  private updateNamingPreview(container: HTMLElement): void {
    let preview = container.querySelector('.naming-preview') as HTMLElement;
    if (!preview) {
      preview = container.createDiv('naming-preview');
    }
    
    preview.empty();
    preview.createEl('h4', { text: 'Example filenames:' });
    
    const examples = preview.createDiv('filename-examples');
    const date = new Date('2024-03-20');
    const dateStr = this.formatDate(date);
    
    const titles = ['Team Meeting', 'Client Call with ABC Corp', 'Project Review'];
    
    titles.forEach(title => {
      const filename = this.settings.includeDateInFilename
        ? `${dateStr} ${title}.md`
        : `${title}.md`;
      examples.createDiv({ text: `📄 ${filename}`, cls: 'filename-example' });
    });
  }

  private formatDate(date: Date): string {
    const format = this.settings.dateFormat || 'yyyy-MM-dd';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return format
      .replace('yyyy', String(year))
      .replace('MM', month)
      .replace('dd', day);
  }

  private renderTemplateSettingsStep(container: HTMLElement): void {
    // Template Sync Options header
    const header = container.createDiv('section-header');
    header.createEl('h3', { text: 'Template Sync Options' });
    header.createEl('p', { 
      text: 'Choose how meeting templates are synced to your notes.',
      cls: 'section-description' 
    });
    
    // Button toggle group for template mode
    const toggleSetting = new Setting(container)
      .setName('')
      .setDesc('');
    
    const toggleContainer = toggleSetting.controlEl.createDiv('granola-button-toggle-group-inline');
    
    // Option 1: One template per meeting
    const singleBtn = toggleContainer.createEl('button', {
      text: 'Only Sync One Template Per Meeting',
      cls: 'granola-button-toggle'
    });
    if (this.templateSyncMode === 'single') {
      singleBtn.addClass('active');
    }
    
    singleBtn.addEventListener('click', () => {
      this.templateSyncMode = 'single';
      this.settings.templateFilterEnabled = false;
      // Update button states
      singleBtn.addClass('active');
      allBtn.removeClass('active');
      // Update explanation text
      const explainText = container.querySelector('.template-explanation p');
      if (explainText) {
        explainText.textContent = 'Each meeting will use panels from its custom template if available, otherwise panels from the default template.';
      }
    });
    
    // Option 2: All templates
    const allBtn = toggleContainer.createEl('button', {
      text: 'Sync All Templates Applied to a Meeting',
      cls: 'granola-button-toggle'
    });
    if (this.templateSyncMode === 'all') {
      allBtn.addClass('active');
    }
    
    allBtn.addEventListener('click', () => {
      this.templateSyncMode = 'all';
      this.settings.templateFilterEnabled = true;
      // Update button states
      allBtn.addClass('active');
      singleBtn.removeClass('active');
      // Update explanation text
      const explainText = container.querySelector('.template-explanation p');
      if (explainText) {
        explainText.textContent = 'Each meeting will include panels from all applied templates (custom templates first, then default template).';
      }
    });
    
    // Explanation based on selection
    const explanation = container.createDiv('template-explanation');
    if (this.templateSyncMode === 'single') {
      explanation.createEl('p', {
        text: 'Each meeting will use panels from its custom template if available, otherwise panels from the default template.',
        cls: 'setting-item-description'
      });
    } else {
      explanation.createEl('p', {
        text: 'Each meeting will include panels from all applied templates (custom templates first, then default template).',
        cls: 'setting-item-description'
      });
    }
    
    // Separator for custom template filter section
    container.createEl('hr', { cls: 'settings-separator' });
    
    // Custom Template Sync Filter header
    const filterHeader = container.createDiv('section-header');
    filterHeader.createEl('h3', { text: 'Custom Template Sync Filter' });
    
    // Custom template filter toggle
    const customTemplateSetting = new Setting(container)
      .setName('Only sync meetings with custom template')
      .setDesc('Skip meetings that don\'t have a custom template applied')
      .addToggle(toggle => toggle
        .setValue(this.settings.onlyCustomTemplates ?? false)
        .onChange(value => {
          this.settings.onlyCustomTemplates = value;
          // Show/hide template name filter
          const templateNameSetting = container.querySelector('.template-name-filter-setting');
          if (templateNameSetting) {
            templateNameSetting.classList.toggle('hidden', !value);
          }
        }));
    
    // Custom template name filter (show when toggle is on)
    const templateNameSetting = new Setting(container)
      .setName('Filter by Template Name')
      .setDesc('Only include panels from templates containing this name')
      .addText(text => text
        .setPlaceholder('My Custom Template')
        .setValue(this.settings.templateFilterName || '')
        .onChange(value => {
          this.settings.templateFilterName = value;
        }));
    
    // Add class for hiding/showing
    templateNameSetting.settingEl.addClass('template-name-filter-setting');
    if (!this.settings.onlyCustomTemplates) {
      templateNameSetting.settingEl.addClass('hidden');
    }
  }

  private renderTranscriptSettingsStep(container: HTMLElement): void {
    new Setting(container)
      .setName('Include Transcripts')
      .setDesc('Add full meeting transcripts with speaker identification to your notes')
      .addToggle(toggle => toggle
        .setValue(this.settings.includeTranscripts ?? true)
        .onChange(value => {
          this.settings.includeTranscripts = value;
        }));
    
    // Add example of transcript format
    const example = container.createDiv('transcript-example');
    example.createEl('h4', { text: 'Transcript Preview:' });
    const preview = example.createDiv('transcript-preview');
    preview.createEl('p', { text: '## Transcript', cls: 'transcript-heading' });
    preview.createEl('p', { text: 'Me: Let\'s discuss the project timeline for next quarter.', cls: 'transcript-line' });
    preview.createEl('p', { text: 'Them: I think we should focus on the MVP features first.', cls: 'transcript-line' });
    preview.createEl('p', { text: 'Me: That makes sense. What are our key priorities?', cls: 'transcript-line' });
    
    // Add note about transcript processing
    const note = container.createDiv('transcript-note');
    note.createEl('p', { 
      text: '💡 Transcripts are processed to identify speakers and remove duplicate segments for better readability.',
      cls: 'setting-item-description'
    });
  }

  private renderSyncSettingsStep(container: HTMLElement): void {
    // Sync Mode header
    const header = container.createDiv('section-header');
    header.createEl('h3', { text: 'Sync Mode' });
    header.createEl('p', { 
      text: 'Choose how your meeting notes are synced.',
      cls: 'section-description' 
    });
    
    // Button toggle group for sync mode
    const toggleSetting = new Setting(container)
      .setName('')
      .setDesc('');
    
    const toggleContainer = toggleSetting.controlEl.createDiv('granola-button-toggle-group-inline');
    
    // Manual sync button
    const manualBtn = toggleContainer.createEl('button', {
      text: 'Manual',
      cls: 'granola-button-toggle'
    });
    if (this.syncMode === 'manual') {
      manualBtn.addClass('active');
    }
    
    manualBtn.addEventListener('click', () => {
      this.syncMode = 'manual';
      this.settings.autoSync = false;
      // Update buttons
      manualBtn.addClass('active');
      autoBtn.removeClass('active');
      // Update dropdown state
      const dropdown = container.querySelector('.sync-interval-dropdown select') as HTMLSelectElement;
      if (dropdown) {
        dropdown.disabled = true;
      }
    });
    
    // Automatic sync button
    const autoBtn = toggleContainer.createEl('button', {
      text: 'Automatic',
      cls: 'granola-button-toggle'
    });
    if (this.syncMode === 'automatic') {
      autoBtn.addClass('active');
    }
    
    autoBtn.addEventListener('click', () => {
      this.syncMode = 'automatic';
      this.settings.autoSync = true;
      // Update buttons
      autoBtn.addClass('active');
      manualBtn.removeClass('active');
      // Update dropdown state
      const dropdown = container.querySelector('.sync-interval-dropdown select') as HTMLSelectElement;
      if (dropdown) {
        dropdown.disabled = false;
      }
    });
    
    // Explanation based on selection
    const explanation = container.createDiv('sync-explanation');
    explanation.createEl('p', {
      text: this.syncMode === 'manual' 
        ? 'You control when to sync your meeting notes.' 
        : 'Meeting notes will be synced automatically at regular intervals.',
      cls: 'setting-item-description'
    });
    
    // Sync interval dropdown (always shown, disabled when manual)
    const intervalSetting = new Setting(container)
      .setName('Sync Interval')
      .setDesc('How often to check for new meetings')
      .addDropdown(dropdown => {
        dropdown
          .addOption('300000', 'Every 5 minutes')
          .addOption('900000', 'Every 15 minutes')
          .addOption('1800000', 'Every 30 minutes')
          .addOption('3600000', 'Every hour')
          .setValue(String(this.settings.syncInterval || 900000))
          .onChange(value => {
            this.settings.syncInterval = parseInt(value);
          });
        
        // Set initial disabled state
        dropdown.setDisabled(!this.settings.autoSync);
        
        // Add class for styling
        dropdown.selectEl.parentElement?.addClass('sync-interval-dropdown');
      });
    
    // Note about manual sync availability
    const note = container.createDiv('sync-note');
    note.createEl('p', { 
      text: 'ℹ️ Manual sync is always available from the ribbon icon or command palette.',
      cls: 'setting-item-description'
    });
    
    new Setting(container)
      .setName('Show Sync Progress')
      .setDesc('Display detailed progress during sync')
      .addToggle(toggle => toggle
        .setValue(this.settings.showProgress ?? true)
        .onChange(value => {
          this.settings.showProgress = value;
        }));
    
    new Setting(container)
      .setName('Debug Mode')
      .setDesc('Enable detailed logging for troubleshooting')
      .addToggle(toggle => toggle
        .setValue(this.settings.debugMode ?? false)
        .onChange(value => {
          this.settings.debugMode = value;
        }));
  }

  private renderCompleteStep(container: HTMLElement): void {
    const summary = container.createDiv('setup-summary');
    summary.createEl('h3', { text: 'Your Settings:' });
    
    const settingsList = summary.createEl('ul');
    
    settingsList.createEl('li', { 
      text: `✓ Connected to Granola API` 
    });
    
    settingsList.createEl('li', { 
      text: `✓ Notes will be saved to: ${this.settings.targetFolder}` 
    });
    
    const orgText = {
      'flat': 'All in one folder',
      'by-date': 'Organized by date',
      'mirror-granola': 'Mirroring Granola folders'
    };
    settingsList.createEl('li', { 
      text: `✓ Organization: ${orgText[this.settings.folderOrganization || 'flat']}` 
    });
    
    // Template settings
    if (this.settings.templateFilterEnabled) {
      settingsList.createEl('li', { 
        text: '✓ Including ALL template panels' 
      });
      if (this.settings.templateFilterName) {
        settingsList.createEl('li', { 
          text: `✓ Filtering templates by: "${this.settings.templateFilterName}"` 
        });
      }
    } else {
      settingsList.createEl('li', { 
        text: '✓ One template only (custom or default)' 
      });
    }
    
    if (this.settings.onlyCustomTemplates) {
      settingsList.createEl('li', { 
        text: '✓ Only syncing meetings with custom templates' 
      });
    }
    
    if (this.settings.includeTranscripts) {
      settingsList.createEl('li', { 
        text: '✓ Including full transcripts' 
      });
    }
    
    if (this.settings.autoSync) {
      const interval = this.settings.syncInterval || 900000;
      const intervalText: Record<number, string> = {
        300000: 'every 5 minutes',
        900000: 'every 15 minutes',
        1800000: 'every 30 minutes',
        3600000: 'every hour'
      };
      settingsList.createEl('li', { 
        text: `✓ Auto-sync enabled (${intervalText[interval] || 'custom interval'})` 
      });
    }
    
    const actions = container.createDiv('setup-actions');
    actions.createEl('p', { 
      text: 'Click "Start Syncing" to begin importing your meeting notes!',
      cls: 'setup-complete-text'
    });
  }

  private async nextStep(skip: boolean = false): Promise<void> {
    const currentStepConfig = this.steps[this.currentStep];
    if (!skip && currentStepConfig && currentStepConfig.validate) {
      const validation = await currentStepConfig.validate();
      if (!validation.valid) {
        new Notice(validation.error || 'Please complete this step before continuing');
        return;
      }
    }
    
    this.navigationStack.push(this.currentStep);
    this.currentStep++;
    this.render();
  }

  private previousStep(): void {
    if (this.navigationStack.length > 0) {
      this.currentStep = this.navigationStack.pop()!;
    } else {
      this.currentStep = Math.max(0, this.currentStep - 1);
    }
    this.render();
  }

  private async complete(): Promise<void> {
    // Merge settings with defaults
    const completeSettings: PluginSettings = {
      ...this.plugin.settings,
      ...this.settings,
      wizardCompleted: true  // Mark wizard as completed
    } as PluginSettings;
    
    // Close wizard first
    this.close();
    
    // Apply settings
    this.onComplete(completeSettings);
    
    // Log completion
    this.logger.info('Setup wizard completed', {
      settings: {
        hasApiKey: !!completeSettings.apiKey,
        targetFolder: completeSettings.targetFolder,
        organization: completeSettings.folderOrganization,
        autoSync: completeSettings.autoSync
      }
    });
    
    // Trigger initial sync after a short delay to let settings apply
    setTimeout(async () => {
      new Notice('Starting initial sync...');
      await this.plugin.performSync(true); // Force all meetings on first sync
    }, 500);
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }

  private updateNavigationButtons(): void {
    // Don't re-render the entire modal, just update the button states
    const footer = this.contentEl.querySelector('.granola-wizard-footer');
    if (!footer) return;
    
    const nextButton = footer.querySelector('.mod-cta') as HTMLButtonElement;
    if (nextButton) {
      // Enable/disable based on current step validation
      const step = this.steps[this.currentStep];
      if (step.id === 'api-key' && this.settings.apiKey) {
        nextButton.disabled = false;
      }
    }
  }
}