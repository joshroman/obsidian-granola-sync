import type { Options } from "@wdio/types";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get Obsidian versions to test against
const obsidianVersions = process.env.OBSIDIAN_VERSIONS?.split(",") || ["latest"];
const maxInstances = parseInt(process.env.WDIO_MAX_INSTANCES || "1");

export const config: Options.Testrunner = {
  runner: "local",
  
  // Cache directory for Obsidian downloads
  cacheDir: path.resolve(__dirname, ".obsidian-cache"),
  
  // Test files
  specs: ["./test/e2e/**/*.spec.ts"],
  exclude: [],
  
  // Capabilities
  maxInstances,
  capabilities: obsidianVersions.map(version => ({
    browserName: "obsidian",
    browserVersion: version,
    "wdio:obsidianOptions": {
      // Load the plugin from the current directory
      plugins: [__dirname],
      // Use a test vault directory
      vault: path.join(__dirname, "test", "test-vault"),
      // Additional options
      showReleaseNotes: false,
      waitForIndexing: true
    }
  })),
  
  // Test framework
  framework: "mocha",
  mochaOpts: {
    ui: "bdd",
    timeout: 60000,
    retries: 0,
  },
  
  // Logging
  logLevel: "info",
  coloredLogs: true,
  deprecationWarnings: true,
  bail: 0,
  waitforTimeout: 10000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,
  
  // Services and reporters
  services: ["obsidian"],
  reporters: ["obsidian"],
  
  // Hooks
  onPrepare: function (config, capabilities) {
    // Ensure test environment is properly set up
    const testVaultPath = path.join(__dirname, "test", "test-vault");
    console.log(`Validating test environment at: ${testVaultPath}`);
    ensureTestEnvironment(testVaultPath);
  },
  
  beforeSession: function (config, capabilities, specs) {
    console.log(`Testing Obsidian ${capabilities.browserVersion} with specs:`, specs);
  },
  
  afterTest: async function(test, context, { error, result, duration, passed, retries }) {
    if (!passed) {
      console.error(`Test failed: ${test.title}`, error);
    }
  },
};