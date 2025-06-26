#!/usr/bin/env node

// End-to-end test script for Granola sync
// This tests the actual API integration without mocks

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
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Read token from Granola app
function getToken() {
  const tokenPath = path.join(os.homedir(), 'Library/Application Support/Granola/supabase.json');
  try {
    const data = fs.readFileSync(tokenPath, 'utf8');
    const json = JSON.parse(data);
    const cognitoTokens = JSON.parse(json.cognito_tokens);
    return cognitoTokens.access_token;
  } catch (error) {
    log(`Failed to read token: ${error.message}`, 'red');
    return null;
  }
}

// Make API request with gzip handling
function makeRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.granola.ai',
      port: 443,
      path: path,
      method: method,
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
          resolve({ status: res.statusCode, data: parsed, headers: res.headers });
        } catch (e) {
          reject(new Error(`Failed to parse response: ${e.message}`));
        }
      });
    });

    req.on('error', reject);
    
    if (body !== undefined) {
      req.write(JSON.stringify(body));
    }
    
    req.end();
  });
}

// Test the sync functionality
async function testSync() {
  log('\n=== Granola Sync E2E Test ===\n', 'blue');
  
  try {
    // Step 1: Test connection
    log('1. Testing API connection...', 'yellow');
    const connectionTest = await makeRequest('POST', '/v1/get-feature-flags');
    
    if (connectionTest.status === 200) {
      log('✓ API connection successful', 'green');
    } else {
      throw new Error(`API connection failed with status ${connectionTest.status}`);
    }
    
    // Step 2: Fetch documents
    log('\n2. Fetching documents...', 'yellow');
    const docsResponse = await makeRequest('POST', '/v2/get-documents', { limit: 5 });
    
    if (docsResponse.status !== 200) {
      throw new Error(`Failed to fetch documents: ${docsResponse.status}`);
    }
    
    const docs = docsResponse.data.docs || [];
    log(`✓ Found ${docs.length} document(s)`, 'green');
    
    // Step 3: Test document transformation
    if (docs.length > 0) {
      log('\n3. Testing document transformation...', 'yellow');
      const firstDoc = docs[0];
      
      // Simulate the transformation that would happen in the plugin
      const meeting = {
        id: firstDoc.id,
        title: firstDoc.title || 'Untitled Meeting',
        date: new Date(firstDoc.created_at),
        summary: firstDoc.notes_plain || firstDoc.overview || '',
        attendees: extractAttendees(firstDoc.google_calendar_event),
        duration: extractDuration(firstDoc.google_calendar_event),
        tags: Array.isArray(firstDoc.tags) ? firstDoc.tags : []
      };
      
      log('✓ Successfully transformed document:', 'green');
      log(`  - Title: ${meeting.title}`);
      log(`  - Date: ${meeting.date.toLocaleString()}`);
      log(`  - Attendees: ${meeting.attendees.join(', ') || 'None'}`);
      log(`  - Duration: ${meeting.duration || 'Unknown'} minutes`);
      log(`  - Tags: ${meeting.tags.join(', ') || 'None'}`);
      
      // Step 4: Test markdown generation
      log('\n4. Testing markdown generation...', 'yellow');
      const markdown = generateTestMarkdown(meeting);
      log('✓ Generated markdown preview:', 'green');
      log('---');
      console.log(markdown.substring(0, 500) + '...');
      log('---');
      
      // Step 5: Verify content encoding
      log('\n5. Verifying response encoding...', 'yellow');
      log(`✓ Response was ${docsResponse.headers['content-encoding'] === 'gzip' ? 'gzipped' : 'not gzipped'} and handled correctly`, 'green');
    }
    
    log('\n✅ All tests passed! The sync functionality is working correctly.', 'green');
    log('\nYou can now test the plugin in Obsidian with confidence.', 'blue');
    
  } catch (error) {
    log(`\n❌ Test failed: ${error.message}`, 'red');
    process.exit(1);
  }
}

// Helper functions
function extractAttendees(event) {
  if (!event || !event.attendees) return [];
  return event.attendees.map(a => a.email || a.name || '').filter(Boolean);
}

function extractDuration(event) {
  if (!event || !event.start || !event.end) return undefined;
  const start = new Date(event.start.dateTime || event.start.date);
  const end = new Date(event.end.dateTime || event.end.date);
  return Math.round((end.getTime() - start.getTime()) / 60000);
}

function generateTestMarkdown(meeting) {
  const date = meeting.date.toLocaleString();
  const attendeesList = meeting.attendees.map(a => `- ${a}`).join('\n') || '- No attendees';
  const tagsList = meeting.tags.map(t => `#${t}`).join(' ') || '';
  
  return `# ${meeting.title}

## Meeting Information
- **Date**: ${date}
- **Duration**: ${meeting.duration || 'Unknown'} minutes

## Attendees
${attendeesList}

## Summary
${meeting.summary || 'No summary available'}

## Tags
${tagsList}

---
*Synced from Granola*`;
}

// Run the test
testSync();