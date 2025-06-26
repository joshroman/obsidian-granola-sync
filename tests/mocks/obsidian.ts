// Mock Obsidian module for testing

export function normalizePath(path: string): string {
  // Simple normalization - remove duplicate slashes, trim
  return path.replace(/\/+/g, '/').replace(/^\/|\/$/g, '');
}

export class Plugin {
  app: any;
  manifest: any;
  
  constructor(app: any, manifest: any) {
    this.app = app;
    this.manifest = manifest;
  }
  
  loadData = jest.fn().mockResolvedValue({});
  saveData = jest.fn().mockResolvedValue(undefined);
  
  addCommand = jest.fn();
  addRibbonIcon = jest.fn();
  addSettingTab = jest.fn();
  registerEvent = jest.fn();
  registerInterval = jest.fn();
  
  async onload() {}
  async onunload() {}
}

export class PluginManifest {
  id = 'test-plugin';
  name = 'Test Plugin';
  version = '1.0.0';
  minAppVersion = '0.15.0';
  description = 'Test plugin';
  author = 'Test Author';
  authorUrl = '';
  isDesktopOnly = true;
  dir = '';
}

export class Notice {
  constructor(message: string, timeout?: number) {
    console.log('Notice:', message);
  }
}

export class TFile {
  path: string;
  name: string;
  extension: string;
  vault: any;
  parent: any;
  stat: any;
  
  constructor(path: string) {
    this.path = path;
    this.name = path.split('/').pop() || '';
    this.extension = 'md';
  }
}

export class TFolder {
  path: string;
  name: string;
  parent: any;
  
  constructor(path: string) {
    this.path = path;
    this.name = path.split('/').pop() || '';
  }
}

export class TAbstractFile {
  path: string;
  name: string;
  parent: any;
  
  constructor(path: string) {
    this.path = path;
    this.name = path.split('/').pop() || '';
  }
}

export class App {
  vault: any;
  metadataCache: any;
  workspace: any;
}

export class Modal {
  app: App;
  contentEl: any; // DocumentFragment in Obsidian
  titleEl: HTMLElement;
  
  constructor(app: App) {
    this.app = app;
    // Create a DocumentFragment-like object with Obsidian methods
    this.contentEl = this.createDocumentFragmentWithMethods();
    this.titleEl = document.createElement('div');
    
    // Add Obsidian-specific methods to DOM elements
    this.addObsidianMethods(this.titleEl);
  }
  
  private createDocumentFragmentWithMethods() {
    const fragment = document.createDocumentFragment();
    this.addObsidianMethods(fragment as any);
    return fragment;
  }
  
  private addObsidianMethods(el: HTMLElement | DocumentFragment) {
    (el as any).empty = () => {
      while (el.firstChild) {
        el.removeChild(el.firstChild);
      }
    };
    
    // Add Obsidian-specific text methods
    (el as any).setText = (text: string) => {
      el.textContent = text;
      return el;
    };
    
    (el as any).getText = () => {
      return el.textContent || '';
    };
    
    // Add Obsidian-specific class methods
    (el as any).addClass = (cls: string) => {
      if (el.classList) {
        el.classList.add(cls);
      }
      return el;
    };
    
    (el as any).removeClass = (cls: string) => {
      if (el.classList) {
        el.classList.remove(cls);
      }
      return el;
    };
    
    (el as any).toggleClass = (cls: string, force?: boolean) => {
      if (el.classList) {
        el.classList.toggle(cls, force);
      }
      return el;
    };
    
    // Add Obsidian-specific attribute methods
    (el as any).setAttr = (attr: string, value: string) => {
      el.setAttribute(attr, value);
      return el;
    };
    
    (el as any).getAttr = (attr: string) => {
      return el.getAttribute(attr);
    };
    
    // Add Obsidian-specific event methods
    (el as any).onClick = (callback: (evt: MouseEvent) => void) => {
      el.addEventListener('click', callback);
      return el;
    };
    
    (el as any).onChange = (callback: (evt: Event) => void) => {
      el.addEventListener('change', callback);
      return el;
    };
    
    const self = this;
    (el as any).createEl = (tag: string, options?: any) => {
      const newEl = document.createElement(tag);
      if (options) {
        if (options.text) newEl.textContent = options.text;
        if (options.cls) newEl.className = options.cls;
        if (options.attr) {
          Object.entries(options.attr).forEach(([key, value]) => {
            newEl.setAttribute(key, value as string);
          });
        }
      }
      el.appendChild(newEl);
      self.addObsidianMethods(newEl);
      return newEl;
    };
    
    (el as any).createDiv = (options?: any) => (el as any).createEl('div', options);
  }
  
  open() {
    this.onOpen();
  }
  
  close() {
    this.onClose();
  }
  
  onOpen() {}
  onClose() {}
}

export class PluginSettingTab {
  app: App;
  plugin: any;
  containerEl: HTMLElement;
  
  constructor(app: App, plugin: any) {
    this.app = app;
    this.plugin = plugin;
    this.containerEl = document.createElement('div');
    
    // Add Obsidian-specific methods
    this.addObsidianMethods(this.containerEl);
  }
  
  private addObsidianMethods(el: HTMLElement | DocumentFragment) {
    (el as any).empty = () => {
      while (el.firstChild) {
        el.removeChild(el.firstChild);
      }
    };
    
    // Add Obsidian-specific text methods
    (el as any).setText = (text: string) => {
      el.textContent = text;
      return el;
    };
    
    (el as any).getText = () => {
      return el.textContent || '';
    };
    
    // Add Obsidian-specific class methods
    (el as any).addClass = (cls: string) => {
      if (el.classList) {
        el.classList.add(cls);
      }
      return el;
    };
    
    (el as any).removeClass = (cls: string) => {
      if (el.classList) {
        el.classList.remove(cls);
      }
      return el;
    };
    
    (el as any).toggleClass = (cls: string, force?: boolean) => {
      if (el.classList) {
        el.classList.toggle(cls, force);
      }
      return el;
    };
    
    // Add Obsidian-specific attribute methods
    (el as any).setAttr = (attr: string, value: string) => {
      el.setAttribute(attr, value);
      return el;
    };
    
    (el as any).getAttr = (attr: string) => {
      return el.getAttribute(attr);
    };
    
    // Add Obsidian-specific event methods
    (el as any).onClick = (callback: (evt: MouseEvent) => void) => {
      el.addEventListener('click', callback);
      return el;
    };
    
    (el as any).onChange = (callback: (evt: Event) => void) => {
      el.addEventListener('change', callback);
      return el;
    };
    
    const self = this;
    (el as any).createEl = (tag: string, options?: any) => {
      const newEl = document.createElement(tag);
      if (options) {
        if (options.text) newEl.textContent = options.text;
        if (options.cls) newEl.className = options.cls;
        if (options.attr) {
          Object.entries(options.attr).forEach(([key, value]) => {
            newEl.setAttribute(key, value as string);
          });
        }
      }
      el.appendChild(newEl);
      self.addObsidianMethods(newEl);
      return newEl;
    };
    
    (el as any).createDiv = (options?: any) => (el as any).createEl('div', options);
  }
  
  display() {}
  hide() {}
}

export class Setting {
  containerEl: HTMLElement;
  
  constructor(containerEl: HTMLElement) {
    this.containerEl = containerEl;
  }
  
  setName(name: string) { return this; }
  setDesc(desc: string) { return this; }
  addText(cb: any) { return this; }
  addTextArea(cb: any) { return this; }
  addDropdown(cb: any) { return this; }
  addToggle(cb: any) { return this; }
  addButton(cb: any) { return this; }
}

export interface Vault {
  getMarkdownFiles(): TFile[];
  getAbstractFileByPath(path: string): TAbstractFile | null;
  create(path: string, content: string): Promise<TFile>;
  modify(file: TFile, content: string): Promise<void>;
  delete(file: TAbstractFile, force?: boolean): Promise<void>;
  rename(file: TAbstractFile, newPath: string): Promise<void>;
  createFolder(path: string): Promise<void>;
  on(event: string, callback: Function): any;
  off(event: string, callback: Function): void;
  adapter: any;
}

export interface MetadataCache {
  getFileCache(file: TFile): any;
  on(event: string, callback: Function): any;
  off(event: string, callback: Function): void;
}

// Mock ProgressBarComponent
export class ProgressBarComponent {
  private containerEl: HTMLElement;
  private progressBar: HTMLDivElement;
  
  constructor(containerEl: HTMLElement) {
    this.containerEl = containerEl;
    this.progressBar = document.createElement('div');
    this.progressBar.className = 'progress-bar';
    this.containerEl.appendChild(this.progressBar);
  }
  
  setValue(value: number) {
    this.progressBar.style.width = `${value}%`;
  }
}

// Mock EventRef
export interface EventRef {}

// Mock requestUrl function
export const requestUrl = jest.fn().mockImplementation(async (options: any) => {
  console.log('Mock requestUrl called with:', options.url);
  
  // Mock successful responses for different endpoints
  if (options.url.includes('/meetings')) {
    return {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'content-encoding': 'gzip'
      },
      json: {
        documents: [
          {
            id: 'test-meeting-123',
            title: 'Test Meeting',
            created_at: '2024-03-20T10:00:00Z',
            updated_at: '2024-03-20T10:00:00Z',
            plaintext: 'Test meeting content'
          }
        ]
      },
      text: JSON.stringify({
        documents: [
          {
            id: 'test-meeting-123',
            title: 'Test Meeting',
            created_at: '2024-03-20T10:00:00Z',
            updated_at: '2024-03-20T10:00:00Z',
            plaintext: 'Test meeting content'
          }
        ]
      })
    };
  }
  
  // Handle /v2/get-documents endpoint
  if (options.url.includes('/v2/get-documents')) {
    return {
      status: 200,
      headers: {
        'content-type': 'application/json'
      },
      json: {
        docs: [],
        next_cursor: null
      },
      text: JSON.stringify({
        docs: [],
        next_cursor: null
      })
    };
  }
  
  if (options.url.includes('/get-document-panels')) {
    return {
      status: 200,
      headers: {
        'content-type': 'application/json'
      },
      json: {
        panels: []
      },
      text: JSON.stringify({ panels: [] })
    };
  }
  
  // Default response
  return {
    status: 200,
    headers: {
      'content-type': 'application/json'
    },
    json: {},
    text: '{}'
  };
});