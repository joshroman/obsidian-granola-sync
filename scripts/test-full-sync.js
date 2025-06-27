#!/usr/bin/env node

// Full sync test that simulates the complete flow including vault operations
const fs = require('fs');
const path = require('path');
const os = require('os');

// Import the actual plugin components
const { EnhancedGranolaService } = require('../main.js');
const { SyncEngine } = require('../main.js');
const { SyncStateManager } = require('../main.js');
const { PathGenerator } = require('../main.js');
const { Logger } = require('../main.js');
const { StructuredLogger } = require('../main.js');
const { PerformanceMonitor } = require('../main.js');
const { ErrorTracker } = require('../main.js');

// Colors for output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Create a mock Obsidian plugin environment
class MockPlugin {
  constructor() {
    this.vault = new MockVault();
    this.app = { vault: this.vault };
    this.manifest = { version: '1.0.0' };
    this.savedData = {};
  }

  async saveData(data) {
    this.savedData = data;
    // Simulate saving to disk
    const dataPath = path.join(__dirname, '.test-plugin-data.json');
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
  }

  async loadData() {
    try {
      const dataPath = path.join(__dirname, '.test-plugin-data.json');
      if (fs.existsSync(dataPath)) {
        return JSON.parse(fs.readFileSync(dataPath, 'utf8'));
      }
    } catch (e) {}
    return {};
  }
}

// Mock Obsidian vault
class MockVault {
  constructor() {
    this.testVaultPath = path.join(__dirname, 'test-vault');
    if (!fs.existsSync(this.testVaultPath)) {
      fs.mkdirSync(this.testVaultPath, { recursive: true });
    }
  }

  async create(filePath, content) {
    const fullPath = path.join(this.testVaultPath, filePath);
    const dir = path.dirname(fullPath);
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Write the file
    fs.writeFileSync(fullPath, content);
    log(`  ✓ Created file: ${filePath}`, 'green');
    
    return { path: filePath };
  }

  async modify(file, content) {
    const fullPath = path.join(this.testVaultPath, file.path);
    fs.writeFileSync(fullPath, content);
    log(`  ✓ Modified file: ${file.path}`, 'green');
  }

  getAbstractFileByPath(filePath) {
    const fullPath = path.join(this.testVaultPath, filePath);
    if (fs.existsSync(fullPath)) {
      return { path: filePath };
    }
    return null;
  }
}

// Get real token from Granola
function getToken() {
  const tokenPath = path.join(os.homedir(), 'Library/Application Support/Granola/supabase.json');
  try {
    const data = fs.readFileSync(tokenPath, 'utf8');
    const json = JSON.parse(data);
    const cognitoTokens = JSON.parse(json.cognito_tokens);
    return cognitoTokens.access_token;
  } catch (error) {
    throw new Error(`Failed to read token: ${error.message}`);
  }
}

async function testFullSync() {
  log('\n=== Granola Full Sync Test (with Vault Operations) ===\n', 'blue');
  
  try {
    // Step 1: Set up mock environment
    log('1. Setting up test environment...', 'yellow');
    const mockPlugin = new MockPlugin();
    const testSettings = {
      apiKey: getToken(),
      targetFolder: 'Meetings',
      includeDateInFilename: true,
      dateFormat: 'yyyy-MM-dd',
      folderOrganization: 'flat',
      batchSize: 10,
      debugMode: true
    };
    
    // Save settings
    await mockPlugin.saveData(testSettings);
    log('  ✓ Test environment ready', 'green');
    log(`  ✓ Test vault location: ${mockPlugin.vault.testVaultPath}`, 'cyan');
    
    // Step 2: Initialize services
    log('\n2. Initializing sync services...', 'yellow');
    
    const logger = new StructuredLogger('TestSync', mockPlugin);
    const performanceMonitor = new PerformanceMonitor(logger);
    const errorTracker = new ErrorTracker(logger);
    
    const granolaService = new EnhancedGranolaService(
      { apiKey: testSettings.apiKey },
      logger,
      performanceMonitor,
      errorTracker
    );
    
    const stateManager = new SyncStateManager(mockPlugin);
    await stateManager.initialize();
    
    const pathGenerator = new PathGenerator(() => testSettings);
    const syncEngine = new SyncEngine(
      stateManager,
      granolaService,
      pathGenerator,
      mockPlugin,
      new Logger(mockPlugin)
    );
    
    log('  ✓ Services initialized', 'green');
    
    // Step 3: Test API connection
    log('\n3. Testing API connection...', 'yellow');
    const isConnected = await granolaService.testConnection();
    if (!isConnected) {
      throw new Error('Failed to connect to Granola API');
    }
    log('  ✓ API connection successful', 'green');
    
    // Step 4: Run the sync
    log('\n4. Running sync operation...', 'yellow');
    const syncResult = await syncEngine.sync();
    
    log('\n  Sync Results:', 'cyan');
    log(`  - Success: ${syncResult.success ? '✓' : '✗'}`, syncResult.success ? 'green' : 'red');
    log(`  - Created: ${syncResult.created} files`);
    log(`  - Updated: ${syncResult.updated} files`);
    log(`  - Skipped: ${syncResult.skipped} files`);
    log(`  - Errors: ${syncResult.errors.length}`);
    log(`  - Duration: ${syncResult.duration}ms`);
    
    if (syncResult.errors.length > 0) {
      log('\n  Errors encountered:', 'red');
      syncResult.errors.forEach(err => {
        log(`    - ${err.error}`, 'red');
      });
    }
    
    // Step 5: Verify files were created
    log('\n5. Verifying created files...', 'yellow');
    const vaultPath = mockPlugin.vault.testVaultPath;
    const meetingsPath = path.join(vaultPath, 'Meetings');
    
    if (fs.existsSync(meetingsPath)) {
      const files = fs.readdirSync(meetingsPath);
      log(`  ✓ Found ${files.length} files in Meetings folder:`, 'green');
      
      files.forEach(file => {
        const filePath = path.join(meetingsPath, file);
        const stats = fs.statSync(filePath);
        const content = fs.readFileSync(filePath, 'utf8');
        
        log(`\n  📄 ${file} (${stats.size} bytes)`, 'cyan');
        log('  Preview:', 'yellow');
        console.log('  ' + content.split('\n').slice(0, 10).join('\n  '));
        log('  ...', 'yellow');
        
        // Verify content structure
        const hasTitle = content.includes('# ');
        const hasDate = content.includes('**Date**:');
        const hasSyncedFooter = content.includes('*Synced from Granola');
        
        log('\n  Content verification:', 'yellow');
        log(`    - Has title: ${hasTitle ? '✓' : '✗'}`, hasTitle ? 'green' : 'red');
        log(`    - Has date: ${hasDate ? '✓' : '✗'}`, hasDate ? 'green' : 'red');
        log(`    - Has sync footer: ${hasSyncedFooter ? '✓' : '✗'}`, hasSyncedFooter ? 'green' : 'red');
      });
    } else {
      log('  ⚠️  No Meetings folder found', 'yellow');
    }
    
    // Step 6: Check sync state
    log('\n6. Checking sync state...', 'yellow');
    const state = await stateManager.getState();
    log(`  ✓ Last sync: ${state.lastSync || 'Never'}`, 'green');
    log(`  ✓ Tracked files: ${Object.keys(state.files).length}`, 'green');
    
    // Success!
    if (syncResult.success && syncResult.created > 0) {
      log('\n✅ SUCCESS! Meetings were downloaded and saved to the vault!', 'green');
      log(`\n📁 Check the test vault at: ${vaultPath}`, 'blue');
    } else if (syncResult.success && syncResult.created === 0) {
      log('\n⚠️  Sync succeeded but no new meetings were created.', 'yellow');
      log('   This might mean all meetings are already synced.', 'yellow');
    } else {
      log('\n❌ Sync failed!', 'red');
    }
    
  } catch (error) {
    log(`\n❌ Test failed: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  }
}

// Clean up function
function cleanup() {
  log('\n7. Cleaning up test files...', 'yellow');
  try {
    const testVaultPath = path.join(__dirname, 'test-vault');
    const testDataPath = path.join(__dirname, '.test-plugin-data.json');
    const testStatePath = path.join(__dirname, '.test-sync-state.json');
    
    if (fs.existsSync(testVaultPath)) {
      fs.rmSync(testVaultPath, { recursive: true, force: true });
      log('  ✓ Removed test vault', 'green');
    }
    
    if (fs.existsSync(testDataPath)) {
      fs.unlinkSync(testDataPath);
    }
    
    if (fs.existsSync(testStatePath)) {
      fs.unlinkSync(testStatePath);
    }
  } catch (e) {
    log(`  ⚠️  Cleanup warning: ${e.message}`, 'yellow');
  }
}

// Ask user if they want to clean up
process.on('exit', () => {
  // Keep files for inspection
  log('\n💡 Test files kept for inspection. Run with --cleanup to remove them.', 'cyan');
});

// Run the test
testFullSync().then(() => {
  if (process.argv.includes('--cleanup')) {
    cleanup();
  }
});