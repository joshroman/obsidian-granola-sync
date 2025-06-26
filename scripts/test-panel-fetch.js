#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');

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

async function testPanelFetch() {
  const token = getToken();
  
  // Fetch a document first
  const docsResponse = await fetch('https://api.granola.ai/v2/get-documents', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'Granola/6.4.0'
    },
    body: JSON.stringify({ limit: 5 })
  });
  
  const docsData = await docsResponse.json();
  console.log(`Found ${docsData.docs.length} documents`);
  
  // Test batch panel fetching
  console.log('\nTesting batch panel fetching (5 concurrent):');
  const start = Date.now();
  
  const CONCURRENT_LIMIT = 5;
  const panelMap = new Map();
  
  for (let i = 0; i < docsData.docs.length; i += CONCURRENT_LIMIT) {
    const batch = docsData.docs.slice(i, i + CONCURRENT_LIMIT);
    const promises = batch.map(async (doc) => {
      try {
        const response = await fetch('https://api.granola.ai/v1/get-document-panels', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'Granola/6.4.0'
          },
          body: JSON.stringify({ document_id: doc.id })
        });
        
        const data = await response.json();
        return { id: doc.id, panels: data.panels || [], title: doc.title };
      } catch (error) {
        console.error(`Failed to fetch panels for ${doc.id}:`, error);
        return { id: doc.id, panels: [], title: doc.title };
      }
    });
    
    const results = await Promise.all(promises);
    results.forEach(({ id, panels, title }) => {
      panelMap.set(id, panels);
      console.log(`- ${title}: ${panels.length} panels`);
    });
  }
  
  const duration = Date.now() - start;
  console.log(`\nFetched panels for ${docsData.docs.length} documents in ${duration}ms`);
  console.log(`Average time per document: ${Math.round(duration / docsData.docs.length)}ms`);
  
  // Show a sample panel with Turndown conversion
  for (const [docId, panels] of panelMap) {
    if (panels.length > 0) {
      const panel = panels[0];
      console.log('\nSample panel:');
      console.log(`Title: ${panel.title}`);
      console.log(`HTML preview: ${panel.original_content.substring(0, 200)}...`);
      break;
    }
  }
}

testPanelFetch().catch(console.error);