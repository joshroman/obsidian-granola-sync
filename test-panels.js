// Test script to debug panel fetching
const { TokenRetrievalService } = require('./src/services/token-retrieval-service');
const https = require('https');

async function makeRequest(path, body) {
  const tokenInfo = TokenRetrievalService.getTokenInfo();
  if (!tokenInfo) {
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
      'User-Agent': `Granola/6.4.0 Electron/33.4.5 Chrome/130.0.6723.191 Node/20.18.3 (macOS 15.3.1 24D70)`,
      'X-App-Version': '6.4.0',
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
          resolve(data);
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function testPanels() {
  // First get documents
  console.log('Fetching documents...');
  const docs = await makeRequest('/v2/get-documents', { limit: 5 });
  
  if (!docs || !docs.docs || docs.docs.length === 0) {
    console.error('No documents found');
    return;
  }

  console.log(`Found ${docs.docs.length} documents\n`);

  // For each document, get panels
  for (const doc of docs.docs) {
    console.log(`\nDocument: ${doc.title}`);
    console.log(`ID: ${doc.id}`);
    console.log(`Created: ${doc.created_at}`);
    
    const panelsResponse = await makeRequest('/v1/get-document-panels', { 
      document_id: doc.id 
    });
    
    if (panelsResponse && panelsResponse.panels) {
      console.log(`Panels (${panelsResponse.panels.length}):`);
      panelsResponse.panels.forEach(panel => {
        console.log(`  - ${panel.title} (Template ID: ${panel.panel_template_id})`);
      });
    } else {
      console.log('  No panels found');
    }
  }
}

testPanels().catch(console.error);