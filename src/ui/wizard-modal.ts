import { App, Modal, Setting, Notice } from 'obsidian';
import GranolaSyncPlugin from '../main';
import { InputValidator } from '../utils/input-validator';

export class SetupWizard extends Modal {
  private plugin: GranolaSyncPlugin;
  currentStep: number = 0;
  private tempSettings: {
    apiKey: string;
    targetFolder: string;
  } = {
    apiKey: '',
    targetFolder: 'Meetings'
  };
  private error: string = '';
  private isValidating: boolean = false;

  constructor(app: App, plugin: GranolaSyncPlugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen() {
    this.showCurrentStep();
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }

  private showCurrentStep() {
    const { contentEl } = this;
    contentEl.empty();

    // Add modal title
    contentEl.createEl('h2', { text: 'Granola Sync Setup' });

    // Show step content
    const stepContent = this.getStepContent();
    contentEl.appendChild(stepContent);

    // Add navigation buttons
    this.addNavigationButtons();
  }

  getStepContent(): DocumentFragment {
    const content = document.createDocumentFragment();

    switch (this.currentStep) {
      case 0:
        this.showWelcomeStep(content);
        break;
      case 1:
        this.showApiKeyStep(content);
        break;
      case 2:
        this.showFolderStep(content);
        break;
      case 3:
        this.showPreviewStep(content);
        break;
    }

    return content;
  }

  private showWelcomeStep(content: DocumentFragment) {
    const container = content.createEl('div');
    
    container.createEl('p', {
      text: 'Welcome to Granola Sync! This wizard will help you connect your Granola account to Obsidian.'
    });
    
    container.createEl('p', {
      text: 'You\'ll need:'
    });
    
    const list = container.createEl('ul');
    list.createEl('li', { text: 'Your Granola API key' });
    list.createEl('li', { text: 'A folder to store your meeting notes' });
    
    container.createEl('p', {
      text: 'Your API key will be stored locally in your vault and never shared.',
      cls: 'mod-warning'
    });
  }

  private showApiKeyStep(content: DocumentFragment) {
    const container = content.createEl('div');
    
    container.createEl('p', {
      text: 'Enter your Granola API key. You can find this in your Granola account settings.'
    });
    
    new Setting(container)
      .setName('API Key')
      .setDesc('Your Granola API key')
      .addText(text => {
        text
          .setPlaceholder('Enter your API key')
          .setValue(this.tempSettings.apiKey)
          .onChange(value => {
            this.tempSettings.apiKey = value;
            this.error = '';
          });
        text.inputEl.type = 'password';
        text.inputEl.style.width = '100%';
      });
    
    if (this.error) {
      container.createEl('p', {
        text: this.error,
        cls: 'mod-warning'
      });
    }
    
    container.createEl('p', {
      text: 'Don\'t have an API key? Visit your Granola account settings to generate one.',
      cls: 'setting-item-description'
    });
  }

  private showFolderStep(content: DocumentFragment) {
    const container = content.createEl('div');
    
    container.createEl('p', {
      text: 'Choose where to store your meeting notes.'
    });
    
    new Setting(container)
      .setName('Meeting notes folder')
      .setDesc('All synced meetings will be saved in this folder')
      .addText(text => {
        text
          .setPlaceholder('Meetings')
          .setValue(this.tempSettings.targetFolder)
          .onChange(value => {
            this.tempSettings.targetFolder = value;
            this.error = '';
          });
        text.inputEl.style.width = '100%';
      });
    
    if (this.error) {
      container.createEl('p', {
        text: this.error,
        cls: 'mod-warning'
      });
    }
    
    container.createEl('p', {
      text: 'You can organize meetings into subfolders later in settings.',
      cls: 'setting-item-description'
    });
  }

  private showPreviewStep(content: DocumentFragment) {
    const container = content.createEl('div');
    
    container.createEl('p', {
      text: 'Setup is complete! Here\'s what will happen:'
    });
    
    const list = container.createEl('ul');
    list.createEl('li', {
      text: `Meeting notes will be saved in: ${this.tempSettings.targetFolder}/`
    });
    list.createEl('li', {
      text: 'Files will be named with date prefix by default (e.g., "2024-03-20 Team Meeting.md")'
    });
    list.createEl('li', {
      text: 'You can customize organization and naming in settings'
    });
    
    container.createEl('p', {
      text: 'Ready to sync your meetings?',
      cls: 'setting-item-description'
    });
  }

  private addNavigationButtons() {
    const buttonContainer = this.contentEl.createEl('div', {
      cls: 'modal-button-container'
    });

    // Back button
    if (this.currentStep > 0) {
      const backButton = buttonContainer.createEl('button', {
        text: 'Back',
        cls: 'mod-cta'
      });
      backButton.addEventListener('click', () => {
        this.previousStep();
      });
    }

    // Spacer
    buttonContainer.createEl('div', { cls: 'modal-button-spacer' });

    // Next/Complete button
    const nextButton = buttonContainer.createEl('button', {
      text: this.currentStep === 3 ? 'Complete Setup' : 'Next',
      cls: 'mod-cta'
    });
    
    if (this.isValidating) {
      nextButton.disabled = true;
      nextButton.textContent = 'Validating...';
    }
    
    nextButton.addEventListener('click', async () => {
      if (this.currentStep === 3) {
        await this.complete();
      } else {
        await this.nextStep();
      }
    });
  }

  async nextStep() {
    if (!await this.validateCurrentStep()) {
      return;
    }
    
    this.currentStep++;
    this.showCurrentStep();
  }

  previousStep() {
    this.currentStep--;
    this.error = '';
    this.showCurrentStep();
  }

  private async validateCurrentStep(): Promise<boolean> {
    this.error = '';
    
    switch (this.currentStep) {
      case 1: // API key step
        if (!this.tempSettings.apiKey) {
          this.error = 'Please enter your API key';
          this.showCurrentStep();
          return false;
        }
        
        this.isValidating = true;
        this.showCurrentStep();
        
        const isValid = await this.setApiKey(this.tempSettings.apiKey);
        
        this.isValidating = false;
        
        if (!isValid) {
          this.showCurrentStep();
          return false;
        }
        break;
        
      case 2: // Folder step
        if (!this.validateFolder(this.tempSettings.targetFolder)) {
          this.showCurrentStep();
          return false;
        }
        break;
    }
    
    return true;
  }

  async setApiKey(apiKey: string): Promise<boolean> {
    const isValid = await this.plugin.validateApiKey(apiKey);
    
    if (!isValid) {
      this.error = this.plugin.lastError || 'Invalid API key';
      return false;
    }
    
    return true;
  }

  setTargetFolder(folder: string) {
    this.tempSettings.targetFolder = folder;
  }

  validateFolder(folder: string): boolean {
    if (!folder || folder.trim().length === 0) {
      this.error = 'Please enter a folder name';
      return false;
    }
    
    if (folder.includes('..') || folder.startsWith('/')) {
      this.error = 'Invalid folder path';
      return false;
    }
    
    // Additional validation for Windows
    if (folder.includes('\\')) {
      this.error = 'Please use forward slashes (/) for folder paths';
      return false;
    }
    
    return true;
  }

  canProceedToNext(): boolean {
    switch (this.currentStep) {
      case 1:
        return !!this.tempSettings.apiKey && !this.error;
      case 2:
        return !!this.tempSettings.targetFolder && !this.error;
      default:
        return true;
    }
  }

  getError(): string {
    return this.error;
  }

  async complete() {
    // API key is already saved from validation
    this.plugin.settings.targetFolder = this.tempSettings.targetFolder;
    await this.plugin.saveSettings();
    
    new Notice('Setup complete! You can now sync your meetings.');
    this.close();
    
    // Offer to sync immediately
    if (confirm('Would you like to sync your meetings now?')) {
      await this.plugin.performSync();
    }
  }
}