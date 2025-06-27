// Test markdown output with panels
const { TokenRetrievalService } = require('../src/services/token-retrieval-service');

async function testMarkdownWithPanels() {
  console.log('Testing markdown generation with panels...\n');
  
  // Get token
  const tokenInfo = TokenRetrievalService.getTokenInfo();
  if (!tokenInfo) {
    console.error('Failed to get token info');
    return;
  }
  
  // Fetch a document with panels
  const docsResponse = await fetch('https://api.granola.ai/v2/get-documents', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${tokenInfo.accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'Granola/6.4.0 Electron/33.4.5 Chrome/130.0.6723.191 Node/20.18.3 (macOS 15.3.1 24D70)'
    },
    body: JSON.stringify({ limit: 5 })
  });
  
  const docsData = await docsResponse.json();
  const doc = docsData.docs[0];
  
  // Fetch panels
  const panelsResponse = await fetch('https://api.granola.ai/v1/get-document-panels', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${tokenInfo.accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'Granola/6.4.0 Electron/33.4.5 Chrome/130.0.6723.191 Node/20.18.3 (macOS 15.3.1 24D70)'
    },
    body: JSON.stringify({ document_id: doc.id })
  });
  
  const panelsData = await panelsResponse.json();
  
  // Create a meeting object with panels
  const meeting = {
    id: doc.id,
    title: doc.title || 'Test Meeting',
    date: new Date(doc.created_at),
    summary: doc.notes_plain || doc.overview || '',
    panels: panelsData.panels || []
  };
  
  console.log(`Document: ${meeting.title}`);
  console.log(`Panels: ${meeting.panels.length}`);
  
  // Simulate markdown generation
  console.log('\nMarkdown output preview:\n');
  console.log('---');
  console.log(`granolaId: "${meeting.id}"`);
  console.log(`title: "${meeting.title}"`);
  console.log(`date: ${meeting.date.toISOString()}`);
  console.log('---');
  console.log('');
  console.log(`# ${meeting.title}`);
  console.log('');
  
  if (meeting.summary) {
    console.log('## Summary');
    console.log(meeting.summary.substring(0, 200) + '...');
    console.log('');
  }
  
  // Show panel sections
  if (meeting.panels.length > 0) {
    console.log('## Panels\n');
    
    for (const panel of meeting.panels) {
      console.log(`### Panel: ${panel.title}`);
      
      // Extract some content from HTML
      const htmlPreview = panel.original_content
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 200);
      
      console.log(htmlPreview + '...');
      console.log('');
    }
  }
  
  console.log('\n✅ Markdown generation test complete!');
}

testMarkdownWithPanels().catch(console.error);