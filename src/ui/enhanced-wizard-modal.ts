import { Modal, App, Setting, Notice, ButtonComponent } from 'obsidian';
import GranolaSyncPlugin from '../main';
import { PluginSettings } from '../types';
import { EnhancedGranolaService } from '../services/enhanced-granola-service';
import { StructuredLogger } from '../utils/structured-logger';
import { PerformanceMonitor } from '../utils/performance-monitor';
import { ErrorTracker } from '../utils/error-tracker';

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
  }

  private initializeSteps(): void {
    this.steps = [
      {
        id: 'welcome',
        title: 'Welcome to Granola Sync',
        description: 'This wizard will help you set up Granola Sync for Obsidian. We\'ll configure your API connection, choose how to organize your meeting notes, and set up sync preferences.',
        canSkip: false
      },
      {
        id: 'api-key',
        title: 'Connect to Granola',
        description: 'Enter your Granola API key to connect your account. You can find this in your Granola account settings.',
        validate: async () => {
          const apiKey = this.settings.apiKey?.trim();
          if (!apiKey) {
            return { valid: false, error: 'Please enter your API key' };
          }
          
          // Test the API connection
          try {
            if (!this.testApiService) {
              const performanceMonitor = new PerformanceMonitor(this.logger);
              const errorTracker = new ErrorTracker(this.logger);
              this.testApiService = new EnhancedGranolaService(
                { apiKey },
                this.logger,
                performanceMonitor,
                errorTracker
              );
            }
            
            const connected = await this.testApiService.testConnection();
            if (!connected) {
              return { valid: false, error: 'Failed to connect. Please check your API key.' };
            }
            
            return { valid: true };
          } catch (error) {
            return { 
              valid: false, 
              error: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}` 
            };
          }
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
        canSkip: true
      },
      {
        id: 'file-naming',
        title: 'File Naming Convention',
        description: 'Customize how your meeting note files are named.',
        canSkip: true
      },
      {
        id: 'sync-settings',
        title: 'Sync Preferences',
        description: 'Configure automatic sync and other preferences.',
        canSkip: true
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
    contentEl.addClass('granola-setup-wizard');
    
    const step = this.steps[this.currentStep];
    
    // Header
    const header = contentEl.createDiv('wizard-header');
    header.createEl('h2', { text: step.title });
    
    // Progress indicator
    const progress = header.createDiv('wizard-progress');
    const progressBar = progress.createDiv('progress-bar');
    const progressFill = progressBar.createDiv('progress-fill');
    progressFill.style.width = `${((this.currentStep + 1) / this.steps.length) * 100}%`;
    
    const progressText = progress.createDiv('progress-text');
    progressText.setText(`Step ${this.currentStep + 1} of ${this.steps.length}`);
    
    // Content
    const content = contentEl.createDiv('wizard-content');
    content.createEl('p', { text: step.description, cls: 'wizard-description' });
    
    // Render step-specific content
    this.renderStepContent(step, content);
    
    // Footer with navigation
    const footer = contentEl.createDiv('wizard-footer');
    
    // Back button
    if (this.currentStep > 0) {
      const backButton = new ButtonComponent(footer)
        .setButtonText('Back')
        .onClick(() => this.previousStep());
    }
    
    // Spacer
    footer.createDiv('spacer');
    
    // Skip button (if allowed)
    if (step.canSkip && this.currentStep < this.steps.length - 1) {
      new ButtonComponent(footer)
        .setButtonText('Skip')
        .onClick(() => this.nextStep(true));
    }
    
    // Next/Complete button
    const isLastStep = this.currentStep === this.steps.length - 1;
    const nextButton = new ButtonComponent(footer)
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
      case 'sync-settings':
        this.renderSyncSettingsStep(container);
        break;
      case 'complete':
        this.renderCompleteStep(container);
        break;
    }
  }

  private renderWelcomeStep(container: HTMLElement): void {
    const features = container.createDiv('wizard-features');
    
    const featureList = [
      { icon: '🔄', title: 'Automatic Sync', desc: 'Keep your meeting notes up to date' },
      { icon: '📁', title: 'Smart Organization', desc: 'Organize notes by date or mirror Granola' },
      { icon: '🔍', title: 'Conflict Resolution', desc: 'Handle edits without losing data' },
      { icon: '⚡', title: 'Performance', desc: 'Optimized for large meeting libraries' }
    ];
    
    featureList.forEach(feature => {
      const featureEl = features.createDiv('feature-item');
      featureEl.createSpan({ text: feature.icon, cls: 'feature-icon' });
      const textEl = featureEl.createDiv('feature-text');
      textEl.createEl('h4', { text: feature.title });
      textEl.createEl('p', { text: feature.desc });
    });
  }

  private renderApiKeyStep(container: HTMLElement): void {
    const apiKeyContainer = container.createDiv('api-key-container');
    
    new Setting(apiKeyContainer)
      .setName('API Key')
      .setDesc('Your Granola API key')
      .addText(text => text
        .setPlaceholder('Enter your API key...')
        .setValue(this.settings.apiKey || '')
        .onChange(value => {
          this.settings.apiKey = value;
        }));
    
    // Add help link
    const helpText = apiKeyContainer.createEl('p', { 
      text: 'Need help finding your API key? ',
      cls: 'setting-item-description'
    });
    helpText.createEl('a', {
      text: 'Visit Granola Settings',
      href: 'https://app.granola.so/settings'
    });
    
    // Connection status
    const statusContainer = apiKeyContainer.createDiv('connection-status');
    if (this.settings.apiKey) {
      this.updateConnectionStatus(statusContainer);
    }
  }

  private async updateConnectionStatus(container: HTMLElement): Promise<void> {
    container.empty();
    container.createSpan({ text: 'Testing connection...', cls: 'status-testing' });
    
    const validation = await this.steps[1].validate!();
    container.empty();
    
    if (validation.valid) {
      container.createSpan({ text: '✓ Connected successfully', cls: 'status-success' });
    } else {
      container.createSpan({ text: `✗ ${validation.error}`, cls: 'status-error' });
    }
  }

  private renderTargetFolderStep(container: HTMLElement): void {
    new Setting(container)
      .setName('Meeting Notes Folder')
      .setDesc('Where to store your meeting notes (e.g., "Meetings", "Work/Meetings")')
      .addText(text => text
        .setPlaceholder('Meetings')
        .setValue(this.settings.targetFolder || 'Meetings')
        .onChange(value => {
          this.settings.targetFolder = value;
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
    tree.createDiv({ text: '📁 Your Vault', cls: 'tree-root' });
    tree.createDiv({ text: `  📁 ${folder}`, cls: 'tree-folder' });
    tree.createDiv({ text: '    📄 2024-03-20 Team Meeting.md', cls: 'tree-file' });
    tree.createDiv({ text: '    📄 2024-03-21 Client Call.md', cls: 'tree-file' });
  }

  private renderOrganizationStep(container: HTMLElement): void {
    new Setting(container)
      .setName('Folder Organization')
      .setDesc('How to organize meeting notes within your folder')
      .addDropdown(dropdown => dropdown
        .addOption('flat', '📄 All in one folder')
        .addOption('by-date', '📅 Organized by date')
        .addOption('mirror-granola', '🔄 Mirror Granola folders')
        .setValue(this.settings.folderOrganization || 'flat')
        .onChange(value => {
          this.settings.folderOrganization = value as any;
          this.updateOrganizationPreview(container);
        }));
    
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
    
    switch (this.settings.folderOrganization) {
      case 'by-date':
        tree.createDiv({ text: `📁 ${folder}`, cls: 'tree-root' });
        tree.createDiv({ text: '  📁 2024-03-20', cls: 'tree-folder' });
        tree.createDiv({ text: '    📄 Team Meeting.md', cls: 'tree-file' });
        tree.createDiv({ text: '    📄 Client Call.md', cls: 'tree-file' });
        tree.createDiv({ text: '  📁 2024-03-21', cls: 'tree-folder' });
        tree.createDiv({ text: '    📄 Project Review.md', cls: 'tree-file' });
        break;
        
      case 'mirror-granola':
        tree.createDiv({ text: `📁 ${folder}`, cls: 'tree-root' });
        tree.createDiv({ text: '  📁 Work', cls: 'tree-folder' });
        tree.createDiv({ text: '    📄 Team Meeting.md', cls: 'tree-file' });
        tree.createDiv({ text: '  📁 Personal', cls: 'tree-folder' });
        tree.createDiv({ text: '    📄 Doctor Appointment.md', cls: 'tree-file' });
        break;
        
      default:
        tree.createDiv({ text: `📁 ${folder}`, cls: 'tree-root' });
        tree.createDiv({ text: '  📄 2024-03-20 Team Meeting.md', cls: 'tree-file' });
        tree.createDiv({ text: '  📄 2024-03-21 Client Call.md', cls: 'tree-file' });
        tree.createDiv({ text: '  📄 2024-03-22 Project Review.md', cls: 'tree-file' });
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

  private renderSyncSettingsStep(container: HTMLElement): void {
    new Setting(container)
      .setName('Automatic Sync')
      .setDesc('Automatically sync meetings at regular intervals')
      .addToggle(toggle => toggle
        .setValue(this.settings.autoSync ?? false)
        .onChange(value => {
          this.settings.autoSync = value;
          this.render(); // Re-render to show/hide interval setting
        }));
    
    if (this.settings.autoSync) {
      new Setting(container)
        .setName('Sync Interval')
        .setDesc('How often to check for new meetings')
        .addDropdown(dropdown => dropdown
          .addOption('300000', 'Every 5 minutes')
          .addOption('900000', 'Every 15 minutes')
          .addOption('1800000', 'Every 30 minutes')
          .addOption('3600000', 'Every hour')
          .setValue(String(this.settings.syncInterval || 900000))
          .onChange(value => {
            this.settings.syncInterval = parseInt(value);
          }));
    }
    
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
    
    if (this.settings.autoSync) {
      const interval = this.settings.syncInterval || 900000;
      const intervalText = {
        300000: 'every 5 minutes',
        900000: 'every 15 minutes',
        1800000: 'every 30 minutes',
        3600000: 'every hour'
      };
      settingsList.createEl('li', { 
        text: `✓ Auto-sync enabled (${intervalText[interval]})` 
      });
    }
    
    const actions = container.createDiv('setup-actions');
    actions.createEl('p', { 
      text: 'Click "Start Syncing" to begin importing your meeting notes!',
      cls: 'setup-complete-text'
    });
  }

  private async nextStep(skip: boolean = false): Promise<void> {
    if (!skip && this.steps[this.currentStep].validate) {
      const validation = await this.steps[this.currentStep].validate();
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
      ...this.settings
    } as PluginSettings;
    
    this.close();
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
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}