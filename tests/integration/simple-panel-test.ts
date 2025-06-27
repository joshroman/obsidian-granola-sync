// Simple test to verify panel fetching works
import { TokenRetrievalService } from '../../src/services/token-retrieval-service';

async function testPanelFetching() {
  console.log('Testing panel fetching...');
  
  // Get token
  const tokenInfo = TokenRetrievalService.getTokenInfo();
  if (!tokenInfo) {
    console.error('Failed to get token info');
    return;
  }
  
  // Make a simple request to test the API
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
    body: JSON.stringify({ limit: 5 })
  });
  
  if (!response.ok) {
    console.error('Failed to fetch documents:', response.status, await response.text());
    return;
  }
  
  const data = await response.json();
  console.log('Got documents:', data.docs?.length || 0);
  
  if (data.docs && data.docs.length > 0) {
    const doc = data.docs[0];
    console.log('Testing panels for document:', doc.title);
    
    // Try to fetch panels
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
    
    if (!panelsResponse.ok) {
      console.error('Failed to fetch panels:', panelsResponse.status, await panelsResponse.text());
      return;
    }
    
    const panelsData = await panelsResponse.json();
    console.log('Got panels:', panelsData);
    
    if (panelsData.panels) {
      console.log('Panel count:', panelsData.panels.length);
      panelsData.panels.forEach((panel: any) => {
        console.log('Panel:', panel.title);
        console.log('Has content:', !!panel.original_content);
        console.log('Content preview:', panel.original_content?.substring(0, 200) + '...');
      });
    }
  }
}

// Run the test
testPanelFetching().catch(console.error);