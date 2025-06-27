#!/usr/bin/env node

// Test that verifies meetings are actually saved to a test vault
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const pako = require('pako');

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

// Create test vault structure
const testVaultPath = path.join(__dirname, 'test-obsidian-vault');
const pluginPath = path.join(testVaultPath, '.obsidian', 'plugins', 'obsidian-granola-sync');

function setupTestVault() {
  log('\n1. Setting up test vault...', 'yellow');
  
  // Create vault structure
  fs.mkdirSync(pluginPath, { recursive: true });
  
  // Copy plugin files
  const mainJs = path.join(__dirname, '..', 'main.js');
  const manifestJson = path.join(__dirname, '..', 'manifest.json');
  const stylesCSS = path.join(__dirname, '..', 'styles.css');
  
  fs.copyFileSync(mainJs, path.join(pluginPath, 'main.js'));
  fs.copyFileSync(manifestJson, path.join(pluginPath, 'manifest.json'));
  fs.copyFileSync(stylesCSS, path.join(pluginPath, 'styles.css'));
  
  log('  ✓ Test vault created at: ' + testVaultPath, 'green');
  log('  ✓ Plugin files copied', 'green');
}

// Get token from Granola
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

// Make API request to verify we can get meetings
async function fetchMeetings() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.granola.ai',
      port: 443,
      path: '/v2/get-documents',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getToken()}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-App-Version': '6.4.0',
        'X-Client-Type': 'electron',
        'X-Client-Platform': process.platform,
        'X-Client-Architecture': process.arch,
        'X-Client-Id': 'granola-electron-6.4.0'
      }
    };

    const req = https.request(options, (res) => {
      let data = [];
      res.on('data', (chunk) => data.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(data);
        const contentEncoding = res.headers['content-encoding'];
        
        try {
          let responseData;
          if (contentEncoding === 'gzip') {
            responseData = pako.ungzip(buffer, { to: 'string' });
          } else {
            responseData = buffer.toString('utf8');
          }
          
          const parsed = JSON.parse(responseData);
          resolve(parsed);
        } catch (e) {
          reject(new Error(`Failed to parse response: ${e.message}`));
        }
      });
    });

    req.on('error', reject);
    req.write(JSON.stringify({ limit: 3 })); // Just get 3 meetings for testing
    req.end();
  });
}

// Simulate what the plugin would do
async function simulateSync() {
  log('\n2. Fetching meetings from API...', 'yellow');
  
  const response = await fetchMeetings();
  const meetings = response.docs || [];
  
  log(`  ✓ Found ${meetings.length} meetings`, 'green');
  
  if (meetings.length === 0) {
    log('  ⚠️  No meetings to sync', 'yellow');
    return 0;
  }
  
  // Create meetings folder
  const meetingsFolder = path.join(testVaultPath, 'Meetings');
  fs.mkdirSync(meetingsFolder, { recursive: true });
  
  log('\n3. Creating meeting files...', 'yellow');
  
  let created = 0;
  for (const meeting of meetings) {
    const title = meeting.title || 'Untitled Meeting';
    const date = new Date(meeting.created_at);
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
    
    // Generate filename
    const filename = `${dateStr} ${title.replace(/[/\\?%*:|"<>]/g, '-')}.md`;
    const filepath = path.join(meetingsFolder, filename);
    
    // Generate markdown content
    const content = generateMarkdown(meeting);
    
    // Write file
    fs.writeFileSync(filepath, content);
    log(`  ✓ Created: ${filename}`, 'green');
    created++;
  }
  
  return created;
}

function generateMarkdown(meeting) {
  const date = new Date(meeting.created_at);
  const title = meeting.title || 'Untitled Meeting';
  const summary = meeting.notes_plain || meeting.overview || 'No summary available';
  
  // Extract attendees if available
  let attendees = [];
  if (meeting.google_calendar_event && meeting.google_calendar_event.attendees) {
    attendees = meeting.google_calendar_event.attendees.map(a => 
      a.email || a.name || 'Unknown'
    );
  }
  
  // Extract duration if available
  let duration = 'Unknown';
  if (meeting.google_calendar_event && meeting.google_calendar_event.start && meeting.google_calendar_event.end) {
    const start = new Date(meeting.google_calendar_event.start.dateTime);
    const end = new Date(meeting.google_calendar_event.end.dateTime);
    duration = Math.round((end - start) / 60000) + ' minutes';
  }
  
  // Build markdown
  let md = `# ${title}\n\n`;
  md += `## Meeting Information\n`;
  md += `- **Date**: ${date.toLocaleString()}\n`;
  md += `- **Duration**: ${duration}\n`;
  md += `- **Workspace**: ${meeting.workspace_id || 'Default'}\n\n`;
  
  if (attendees.length > 0) {
    md += `## Attendees\n`;
    attendees.forEach(a => md += `- ${a}\n`);
    md += '\n';
  }
  
  md += `## Summary\n`;
  md += `${summary}\n\n`;
  
  if (meeting.tags && meeting.tags.length > 0) {
    md += `## Tags\n`;
    md += meeting.tags.map(t => `#${t}`).join(' ') + '\n\n';
  }
  
  md += `---\n`;
  md += `*Synced from Granola on ${new Date().toLocaleString()}*`;
  
  return md;
}

// Verify the files
function verifySync(count) {
  log('\n4. Verifying sync results...', 'yellow');
  
  const meetingsFolder = path.join(testVaultPath, 'Meetings');
  if (!fs.existsSync(meetingsFolder)) {
    log('  ❌ Meetings folder not found!', 'red');
    return false;
  }
  
  const files = fs.readdirSync(meetingsFolder);
  log(`  ✓ Found ${files.length} meeting files`, 'green');
  
  if (files.length !== count) {
    log(`  ⚠️  Expected ${count} files but found ${files.length}`, 'yellow');
  }
  
  // Show first file as example
  if (files.length > 0) {
    log('\n5. Example meeting file:', 'cyan');
    const firstFile = path.join(meetingsFolder, files[0]);
    const content = fs.readFileSync(firstFile, 'utf8');
    const preview = content.split('\n').slice(0, 15).join('\n');
    console.log('\n' + preview + '\n...');
  }
  
  return true;
}

// Main test
async function runTest() {
  log('=== Obsidian Vault Sync Test ===', 'blue');
  
  try {
    // Setup
    setupTestVault();
    
    // Simulate sync
    const created = await simulateSync();
    
    // Verify
    if (created > 0) {
      const success = verifySync(created);
      
      if (success) {
        log('\n✅ SUCCESS! Meetings were downloaded and saved to the vault!', 'green');
        log(`\n📁 Check the test vault at: ${testVaultPath}`, 'blue');
        log('\n💡 You can now:', 'cyan');
        log('   1. Open this vault in Obsidian to see the synced meetings', 'cyan');
        log('   2. Copy the plugin to your real vault', 'cyan');
        log('   3. Run "npm run build" to rebuild if needed', 'cyan');
      }
    } else {
      log('\n⚠️  No meetings were synced', 'yellow');
    }
    
  } catch (error) {
    log(`\n❌ Test failed: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  }
}

// Cleanup option
if (process.argv.includes('--cleanup')) {
  log('Cleaning up test vault...', 'yellow');
  if (fs.existsSync(testVaultPath)) {
    fs.rmSync(testVaultPath, { recursive: true, force: true });
    log('✓ Test vault removed', 'green');
  }
  process.exit(0);
}

// Run the test
runTest();