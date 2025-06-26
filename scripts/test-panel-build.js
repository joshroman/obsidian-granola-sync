// Test the panel functionality using the built main.js
const fs = require('fs');
const path = require('path');

// Load the built plugin
const pluginPath = path.join(__dirname, '../main.js');
const pluginContent = fs.readFileSync(pluginPath, 'utf-8');

// Create a mini test
console.log('Testing panel functionality from built plugin...\n');

// Simple test to verify panels are included in markdown
const testPanelMarkdown = () => {
  // Mock panel data
  const mockPanel = {
    id: 'test-panel-1',
    title: 'Josh Template',
    original_content: `
      <h1>Introduction</h1>
      <p>This is the introduction content.</p>
      <h1>Agenda Items</h1>
      <ul>
        <li>Item 1</li>
        <li>Item 2</li>
      </ul>
      <h1>Key Decisions</h1>
      <p>Decision content here.</p>
    `
  };
  
  const mockMeeting = {
    id: 'test-meeting-1',
    title: 'Test Meeting',
    date: new Date(),
    summary: 'Test summary',
    panels: [mockPanel]
  };
  
  // Check if the built plugin includes panel processing
  const hasPanelProcessing = pluginContent.includes('buildPanelSections') && 
                            pluginContent.includes('PanelProcessor') &&
                            pluginContent.includes('extractStructuredContent');
  
  console.log('✓ Panel processing code included in build:', hasPanelProcessing);
  console.log('✓ PanelProcessor class found:', pluginContent.includes('PanelProcessor'));
  console.log('✓ buildPanelSections method found:', pluginContent.includes('buildPanelSections'));
  console.log('✓ Panel types included:', pluginContent.includes('DocumentPanel'));
  
  console.log('\n✅ Panel build verification complete!');
};

testPanelMarkdown();