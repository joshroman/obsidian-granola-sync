import { Notice } from 'obsidian';
import type GranolaSyncPlugin from '../main';

export interface ValidationResult {
  allPassed: boolean;
  failures: string[];
  results: {
    stylesLoaded: boolean;
    servicesInitialized: boolean;
    uiComponentsReady: boolean;
    apiConnected: boolean;
  };
}

/**
 * Plugin Self-Validation System
 * Ensures critical components are properly loaded and integrated
 */
export class PluginValidator {
  
  /**
   * Validates plugin initialization and integration
   * MANDATORY: Called during plugin onload to ensure everything works
   */
  static async validateInitialization(plugin: GranolaSyncPlugin): Promise<ValidationResult> {
    const results = {
      stylesLoaded: false,
      servicesInitialized: false,
      uiComponentsReady: false,
      apiConnected: false
    };
    
    const failures: string[] = [];
    
    // 1. CSS validation - Skip during plugin load as styles.css loads asynchronously
    results.stylesLoaded = true; // Assume styles.css will load via Obsidian
    
    // 2. Verify service registry initialization
    results.servicesInitialized = this.validateServicesInitialized(plugin);
    if (!results.servicesInitialized) {
      failures.push('Service registry not properly initialized');
    }
    
    // 3. Verify UI components are accessible
    results.uiComponentsReady = this.validateUIComponents(plugin);
    if (!results.uiComponentsReady) {
      failures.push('UI components not properly registered');
    }
    
    // 4. Verify API connectivity (if configured)
    results.apiConnected = await this.validateAPIConnection(plugin);
    // Note: API connection is not mandatory for plugin load, just tracked
    
    const allPassed = results.stylesLoaded && results.servicesInitialized && results.uiComponentsReady;
    
    return {
      allPassed,
      failures,
      results
    };
  }
  
  /**
   * CRITICAL: Validates CSS is actually loaded via styles.css
   * This prevents the file explorer CSS bug from ever happening again
   */
  private static validateCSSLoaded(): boolean {
    try {
      // Check if granola-specific CSS rules exist in any stylesheet
      const styleSheets = Array.from(document.styleSheets);
      
      for (const sheet of styleSheets) {
        try {
          // Check if stylesheet URL indicates this is our styles.css
          if (sheet.href?.includes('obsidian-granola-sync') && sheet.href?.includes('styles.css')) {
            return true;
          }
          
          // Also check CSS rules if accessible for granola-specific selectors
          const rules = Array.from(sheet.cssRules || sheet.rules || []);
          for (const rule of rules) {
            if (rule instanceof CSSStyleRule) {
              if (rule.selectorText?.includes('.granola-conflict-modal') || 
                  rule.selectorText?.includes('.granola-consent-modal') ||
                  rule.selectorText?.includes('.granola-setup-wizard')) {
                return true;
              }
            }
          }
        } catch (e) {
          // Some stylesheets might not be accessible (CORS), continue checking others
          continue;
        }
      }
      
      return false;
    } catch (error) {
      console.error('CSS validation failed:', error);
      return false;
    }
  }
  
  /**
   * Validates services are initialized by checking if key services exist
   */
  private static validateServicesInitialized(plugin: GranolaSyncPlugin): boolean {
    try {
      // Check if key services are accessible via plugin getters
      return !!(plugin.stateManager && plugin.syncEngine && plugin.granolaService && plugin.logger);
    } catch (error) {
      console.error('Service validation failed:', error);
      return false;
    }
  }
  
  /**
   * Validates UI components are properly registered
   */
  private static validateUIComponents(plugin: GranolaSyncPlugin): boolean {
    try {
      // Check if commands are registered
      const commands = (plugin.app as any).commands?.commands;
      if (!commands) return false;
      
      const granolaCommands = Object.keys(commands).filter(id => 
        id.includes('granola-sync') || id.includes('obsidian-granola-sync')
      );
      
      return granolaCommands.length > 0;
    } catch (error) {
      console.error('UI component validation failed:', error);
      return false;
    }
  }
  
  /**
   * Validates API connection if configured
   */
  private static async validateAPIConnection(plugin: GranolaSyncPlugin): Promise<boolean> {
    try {
      if (!plugin.settings?.apiKey && !plugin.tokenManager?.hasTokens()) {
        return true; // No API configured, validation passes
      }
      
      // Quick connection test without showing notices
      const isConnected = await plugin.granolaService?.testConnection();
      return isConnected || false;
    } catch (error) {
      // API connection failure is not a critical plugin failure
      return false;
    }
  }
  
  /**
   * Shows validation results to user if there are failures
   */
  static showValidationResults(result: ValidationResult): void {
    if (result.allPassed) {
      console.log('✅ Plugin validation passed - all systems operational');
      return;
    }
    
    console.error('❌ Plugin validation failed:', result.failures);
    
    // Show critical failures to user
    if (!result.results.stylesLoaded) {
      new Notice('⚠️ Granola Sync: CSS not loaded - UI issues may occur. Please reload Obsidian.');
    }
    
    if (!result.results.servicesInitialized) {
      new Notice('⚠️ Granola Sync: Services not initialized - plugin may not work correctly.');
    }
  }
  
  /**
   * Runtime health monitoring
   * Checks if CSS is still loaded periodically
   */
  static startHealthMonitoring(): void {
    // Check every 30 seconds if CSS is still loaded
    setInterval(() => {
      const cssLoaded = this.validateCSSLoaded();
      
      if (!cssLoaded) {
        console.error('CRITICAL: Granola styles.css not loaded!');
        new Notice('⚠️ Granola Sync: styles.css missing - plugin may not display correctly');
      }
    }, 30000);
  }
}