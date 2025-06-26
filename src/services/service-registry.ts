import { Plugin } from 'obsidian';
import { EnhancedGranolaService } from './enhanced-granola-service';
import { EnhancedStateManager } from './enhanced-state-manager';
import { SyncEngine } from './sync-engine';
import { TokenManager } from './token-manager';
import { PathGenerator } from '../utils/path-generator';
import { FileManager } from '../utils/file-manager';
import { Logger } from '../utils/logger';
import { ErrorHandler } from '../utils/error-handler';
import { StructuredLogger } from '../utils/structured-logger';
import { PerformanceMonitor } from '../utils/performance-monitor';
import { ErrorTracker } from '../utils/error-tracker';
import { PanelProcessor } from './panel-processor';
import { PluginSettings } from '../types';

/**
 * Service Registry - Manages lifecycle of all services
 * Prevents memory leaks by ensuring proper cleanup and singleton instances
 */
export class ServiceRegistry {
  private services: Map<string, any> = new Map();
  private cleanupCallbacks: Map<string, () => void> = new Map();
  
  constructor(private plugin: Plugin) {}
  
  /**
   * Initialize all core services
   */
  async initialize(settings: PluginSettings): Promise<void> {
    // Initialize logging services first
    const logger = this.getOrCreate('logger', () => new Logger(this.plugin));
    const errorHandler = this.getOrCreate('errorHandler', () => new ErrorHandler(logger));
    
    // Initialize monitoring services
    const structuredLogger = this.getOrCreate('structuredLogger', () => 
      new StructuredLogger('GranolaSync', this.plugin)
    );
    const performanceMonitor = this.getOrCreate('performanceMonitor', () => 
      new PerformanceMonitor(new StructuredLogger('PerformanceMonitor', this.plugin))
    );
    const errorTracker = this.getOrCreate('errorTracker', () => 
      new ErrorTracker(new StructuredLogger('ErrorTracker', this.plugin))
    );
    
    // Initialize panel processor
    const panelProcessor = this.getOrCreate('panelProcessor', () => 
      new PanelProcessor(structuredLogger)
    );
    
    // Initialize state manager
    const stateManager = this.getOrCreate('stateManager', () => 
      new EnhancedStateManager(this.plugin, structuredLogger)
    );
    await stateManager.initialize();
    
    // Initialize token manager if needed
    if (settings.granolaConsentGiven && !settings.useManualToken) {
      const tokenManager = this.getOrCreate('tokenManager', () => 
        new TokenManager(this.plugin, logger)
      );
      await tokenManager.initialize();
    }
    
    // Initialize Granola service
    const apiKey = this.get<TokenManager>('tokenManager')?.getAccessToken() || settings.apiKey || '';
    const granolaVersion = this.get<TokenManager>('tokenManager')?.getGranolaVersion() || undefined;
    
    const granolaService = this.getOrCreate('granolaService', () => 
      new EnhancedGranolaService(
        { apiKey, granolaVersion },
        new StructuredLogger('GranolaService', this.plugin),
        performanceMonitor,
        errorTracker
      )
    );
    
    // Initialize sync engine
    const pathGenerator = this.getOrCreate('pathGenerator', () => 
      new PathGenerator(() => settings)
    );
    const syncEngine = this.getOrCreate('syncEngine', () => 
      new SyncEngine(
        stateManager,
        granolaService,
        pathGenerator,
        this.plugin,
        logger
      )
    );
    
    // Initialize file manager
    const fileManager = this.getOrCreate('fileManager', () => 
      new FileManager(this.plugin, logger)
    );
    
    // Register cleanup callbacks
    this.registerCleanup('stateManager', () => stateManager.cleanup());
    this.registerCleanup('syncEngine', () => syncEngine.cancelSync());
    this.registerCleanup('fileManager', () => fileManager.cleanup());
  }
  
  /**
   * Update service configurations without recreating instances
   */
  async updateConfiguration(settings: PluginSettings): Promise<void> {
    // Update Granola service configuration
    const granolaService = this.get<EnhancedGranolaService>('granolaService');
    if (granolaService) {
      const apiKey = this.get<TokenManager>('tokenManager')?.getAccessToken() || settings.apiKey || '';
      const granolaVersion = this.get<TokenManager>('tokenManager')?.getGranolaVersion() || undefined;
      
      granolaService.updateConfig({
        apiKey,
        granolaVersion
      });
    }
    
    // Path generator automatically uses updated settings through callback
    // No need to update other services
  }
  
  /**
   * Get or create a service instance
   */
  private getOrCreate<T>(key: string, factory: () => T): T {
    if (!this.services.has(key)) {
      this.services.set(key, factory());
    }
    return this.services.get(key) as T;
  }
  
  /**
   * Get an existing service
   */
  get<T>(key: string): T | undefined {
    return this.services.get(key) as T | undefined;
  }
  
  /**
   * Register a cleanup callback for a service
   */
  private registerCleanup(key: string, cleanup: () => void): void {
    this.cleanupCallbacks.set(key, cleanup);
  }
  
  /**
   * Clean up all services
   */
  async cleanup(): Promise<void> {
    // Execute cleanup callbacks in reverse order
    const entries = Array.from(this.cleanupCallbacks.entries()).reverse();
    for (const [key, cleanup] of entries) {
      try {
        cleanup();
      } catch (error) {
        console.error(`Error cleaning up service ${key}:`, error);
      }
    }
    
    // Clear all references
    this.services.clear();
    this.cleanupCallbacks.clear();
  }
  
  /**
   * Get all services for plugin access
   */
  getAllServices(): {
    logger: Logger;
    errorHandler: ErrorHandler;
    structuredLogger: StructuredLogger;
    performanceMonitor: PerformanceMonitor;
    errorTracker: ErrorTracker;
    panelProcessor: PanelProcessor;
    stateManager: EnhancedStateManager;
    granolaService: EnhancedGranolaService;
    syncEngine: SyncEngine;
    tokenManager?: TokenManager;
    pathGenerator: PathGenerator;
  } {
    return {
      logger: this.get('logger')!,
      errorHandler: this.get('errorHandler')!,
      structuredLogger: this.get('structuredLogger')!,
      performanceMonitor: this.get('performanceMonitor')!,
      errorTracker: this.get('errorTracker')!,
      panelProcessor: this.get('panelProcessor')!,
      stateManager: this.get('stateManager')!,
      granolaService: this.get('granolaService')!,
      syncEngine: this.get('syncEngine')!,
      tokenManager: this.get('tokenManager'),
      pathGenerator: this.get('pathGenerator')!
    };
  }
}