import { App, Modal } from 'obsidian';

/**
 * Modal for obtaining user consent to access local Granola data
 */
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
    contentEl.addClass('granola-sync-plugin');
    contentEl.addClass('granola-consent-modal');

    // Header
    contentEl.createEl('h2', { text: 'Connect to Granola' });

    // Main description
    contentEl.createEl('p', {
      text: 'Granola Sync can automatically connect to your local Granola installation for seamless meeting synchronization.'
    });

    // What we do section
    const detailsEl = contentEl.createEl('div', { cls: 'granola-consent-details' });
    detailsEl.createEl('h3', {
      text: 'This plugin will:'
    });

    const listEl = detailsEl.createEl('ul');
    listEl.createEl('li', { text: 'Read authentication data from your local Granola app' });
    listEl.createEl('li', { text: 'Use this data only to sync your meetings to Obsidian' });
    listEl.createEl('li', { text: 'Keep all data local - nothing is sent to third parties' });
    listEl.createEl('li', { text: 'Store tokens in memory only (never saved to disk)' });

    // Experimental warning
    const warningEl = contentEl.createEl('div', { cls: 'granola-consent-warning' });
    warningEl.createEl('p', { 
      text: '⚠️ Experimental Feature',
      cls: 'warning-title'
    });
    warningEl.createEl('p', {
      text: 'This connection method is experimental and may break if Granola updates its internal structure. A manual configuration option is available if automatic detection fails.'
    });

    // Privacy note
    const privacyEl = contentEl.createEl('div', { cls: 'granola-consent-privacy' });
    privacyEl.createEl('p', {
      text: '🔒 Your privacy is protected. This plugin only reads local files and does not share any data externally.'
    });

    // Buttons
    const buttonContainer = contentEl.createEl('div', { cls: 'granola-button-container' });
    
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

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
}