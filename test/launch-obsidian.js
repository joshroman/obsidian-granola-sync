const { execSync } = require('child_process');
const path = require('path');

// Launch Obsidian with our plugin
const pluginPath = path.join(__dirname, '..');
const vaultPath = path.join(__dirname, 'test-vault');

console.log('Plugin path:', pluginPath);
console.log('Vault path:', vaultPath);

try {
  // Create test vault if it doesn't exist
  execSync(`mkdir -p "${vaultPath}"`, { stdio: 'inherit' });
  
  // Launch Obsidian with the plugin
  console.log('Launching Obsidian...');
  execSync(`npx obsidian-launcher launch "${vaultPath}" --plugin "${pluginPath}"`, { 
    stdio: 'inherit' 
  });
} catch (error) {
  console.error('Error launching Obsidian:', error);
}