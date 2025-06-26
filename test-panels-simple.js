// Simple test to check panel API directly
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Try to find Granola token like the actual code does
function getTokenInfo() {
  const platform = process.platform;
  let tokenPath;
  
  if (platform === 'darwin') {
    tokenPath = path.join(os.homedir(), 'Library', 'Application Support', 'Granola', 'token.json');
  } else if (platform === 'win32') {
    tokenPath = path.join(process.env.APPDATA || '', 'Granola', 'token.json');
  } else {
    tokenPath = path.join(os.homedir(), '.config', 'Granola', 'token.json');
  }
  
  try {
    const tokenData = fs.readFileSync(tokenPath, 'utf8');
    return JSON.parse(tokenData);
  } catch (error) {
    console.error('Could not read token file:', error.message);
    return null;
  }
}

async function makeRequest(path, body) {
  const tokenInfo = getTokenInfo();
  if (!tokenInfo || !tokenInfo.accessToken) {
    console.error('No token found');
    return;
  }

  const options = {
    hostname: 'api.granola.ai',
    path: path,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${tokenInfo.accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': `Granola/6.4.0 Electron/33.4.5 Chrome/130.0.6723.191 Node/20.18.3 (macOS 15.3.1 24D70)`,
      'X-App-Version': tokenInfo.granolaVersion || '6.4.0',
      'X-Client-Type': 'electron'
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          console.error('Failed to parse response:', e);
          resolve(data);
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

async function testPanels() {
  // Look for the specific meeting the user mentioned
  const targetMeetingId = '90251fba-5410-4700-b18a-d2a284e0b7da';
  
  console.log('Testing Granola panel API...\n');
  
  // Get panels for the specific document
  console.log(`Fetching panels for document ID: ${targetMeetingId}`);
  const panelsResponse = await makeRequest('/v1/get-document-panels', { 
    document_id: targetMeetingId 
  });
  
  if (panelsResponse && panelsResponse.panels) {
    console.log(`\nFound ${panelsResponse.panels.length} panels:`);
    panelsResponse.panels.forEach((panel, index) => {
      console.log(`\nPanel ${index + 1}:`);
      console.log(`  Title: ${panel.title}`);
      console.log(`  Template ID: ${panel.panel_template_id}`);
      console.log(`  Created: ${panel.created_at}`);
      console.log(`  Content type: ${typeof panel.content}`);
      if (panel.original_content) {
        console.log(`  Original content length: ${panel.original_content.length} chars`);
        // Show first 200 chars of content
        console.log(`  Content preview: ${panel.original_content.substring(0, 200)}...`);
      }
    });
  } else {
    console.log('No panels found or error in response:', panelsResponse);
  }
  
  // Also fetch the document itself to see its structure
  console.log('\n\nFetching document details...');
  const docsResponse = await makeRequest('/v2/get-documents', { limit: 100 });
  
  if (docsResponse && docsResponse.docs) {
    const targetDoc = docsResponse.docs.find(d => d.id === targetMeetingId);
    if (targetDoc) {
      console.log('\nDocument found:');
      console.log(`  Title: ${targetDoc.title}`);
      console.log(`  Has notes_plain: ${!!targetDoc.notes_plain}`);
      console.log(`  Notes_plain length: ${targetDoc.notes_plain ? targetDoc.notes_plain.length : 0}`);
      if (targetDoc.notes_plain) {
        console.log(`  Notes preview: ${targetDoc.notes_plain.substring(0, 200)}...`);
      }
    }
  }
}

testPanels().catch(console.error);