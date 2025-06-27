// Type definitions for WebdriverIO browser object
declare module '@wdio/globals' {
  interface Browser {
    execute<T>(script: string | ((...args: any[]) => T), ...args: any[]): Promise<T>;
    pause(ms: number): Promise<void>;
  }
}

// Extend the global browser object
declare const browser: import('@wdio/globals').Browser;