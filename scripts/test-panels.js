// Test script to verify panel functionality
const { TokenRetrievalService } = require('../dist/services/token-retrieval-service');
const { PanelProcessor } = require('../dist/services/panel-processor');
const { StructuredLogger } = require('../dist/utils/structured-logger');

async function testPanels() {
  console.log('Testing panel functionality...\n');
  
  // Get token
  const tokenInfo = TokenRetrievalService.getTokenInfo();
  if (!tokenInfo) {
    console.error('Failed to get token info. Make sure Granola is installed and you are logged in.');
    return;
  }
  
  console.log('✓ Successfully retrieved auth token\n');
  
  // Fetch some documents
  const response = await fetch('https://api.granola.ai/v2/get-documents', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${tokenInfo.accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'Granola/6.4.0 Electron/33.4.5 Chrome/130.0.6723.191 Node/20.18.3 (macOS 15.3.1 24D70)',
      'X-App-Version': '6.4.0',
      'X-Client-Type': 'electron',
      'X-Client-Platform': 'darwin',
      'X-Client-Architecture': 'arm64',
      'X-Client-Id': 'granola-electron-6.4.0'
    },
    body: JSON.stringify({ limit: 10 })
  });
  
  if (!response.ok) {
    console.error('Failed to fetch documents:', response.status);
    return;
  }
  
  const data = await response.json();
  console.log(`✓ Fetched ${data.docs?.length || 0} documents\n`);
  
  // Find a document with panels
  let documentWithPanels = null;
  
  for (const doc of data.docs || []) {
    console.log(`Checking document: ${doc.title}...`);
    
    // Fetch panels for this document
    const panelsResponse = await fetch('https://api.granola.ai/v1/get-document-panels', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenInfo.accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Granola/6.4.0 Electron/33.4.5 Chrome/130.0.6723.191 Node/20.18.3 (macOS 15.3.1 24D70)',
        'X-App-Version': '6.4.0',
        'X-Client-Type': 'electron',
        'X-Client-Platform': 'darwin',
        'X-Client-Architecture': 'arm64',
        'X-Client-Id': 'granola-electron-6.4.0'
      },
      body: JSON.stringify({ document_id: doc.id })
    });
    
    if (panelsResponse.ok) {
      const panelsData = await panelsResponse.json();
      if (panelsData.panels && panelsData.panels.length > 0) {
        console.log(`  → Found ${panelsData.panels.length} panels`);
        documentWithPanels = { doc, panels: panelsData.panels };
        break;
      } else {
        console.log(`  → No panels`);
      }
    }
  }
  
  if (!documentWithPanels) {
    console.log('\n❌ No documents with panels found');
    return;
  }
  
  console.log(`\n✓ Found document with panels: ${documentWithPanels.doc.title}\n`);
  
  // Test panel processing
  const logger = new StructuredLogger();
  const panelProcessor = new PanelProcessor(logger);
  
  console.log('Testing panel processing:\n');
  
  for (const panel of documentWithPanels.panels) {
    console.log(`Panel: ${panel.title}`);
    console.log(`Template: ${panel.template_slug || 'none'}`);
    
    // Extract structured content
    const sections = panelProcessor.extractStructuredContent(panel);
    console.log(`Sections found: ${Object.keys(sections).length}`);
    
    for (const [heading, content] of Object.entries(sections)) {
      console.log(`  - ${heading}: ${content.substring(0, 100)}...`);
    }
    
    console.log('');
  }
  
  // Test known template processing
  console.log('Testing known template processing:');
  const knownSections = panelProcessor.processKnownTemplates(documentWithPanels.panels);
  
  if (Object.keys(knownSections).length > 0) {
    console.log('✓ Found known template sections:');
    for (const [key, value] of Object.entries(knownSections)) {
      console.log(`  - ${key}: ${value.substring(0, 100)}...`);
    }
  } else {
    console.log('❌ No known template sections found');
  }
  
  console.log('\n✅ Panel functionality test complete!');
}

// Run the test
testPanels().catch(console.error);