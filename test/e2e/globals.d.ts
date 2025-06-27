// Type definitions for WebdriverIO browser object
declare module '@wdio/globals' {
  export const browser: Browser;
  
  export interface Browser {
    execute<T>(script: string | ((...args: any[]) => T), ...args: any[]): Promise<T>;
    executeAsync<T>(script: string | ((...args: any[]) => T), ...args: any[]): Promise<T>;
    pause(ms: number): Promise<void>;
    waitUntil(condition: () => Promise<boolean> | boolean, options?: any): Promise<void>;
  }
}

// Make browser available globally
declare const browser: import('@wdio/globals').Browser;