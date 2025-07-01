const fs = require('fs');
const path = require('path');

/**
 * Ensures the test environment is properly set up before running E2E tests.
 * This addresses the common issue where tests work locally but fail in CI
 * due to missing directories or files.
 */
function ensureTestEnvironment(testVaultPath) {
    // Ensure test vault directory exists
    if (!fs.existsSync(testVaultPath)) {
        console.log(`Creating test vault directory: ${testVaultPath}`);
        fs.mkdirSync(testVaultPath, { recursive: true });
    }

    // Ensure .obsidian directory exists
    const obsidianDir = path.join(testVaultPath, '.obsidian');
    if (!fs.existsSync(obsidianDir)) {
        console.log(`Creating .obsidian directory: ${obsidianDir}`);
        fs.mkdirSync(obsidianDir, { recursive: true });
    }

    // Ensure minimal Obsidian configuration exists
    const appConfigPath = path.join(obsidianDir, 'app.json');
    if (!fs.existsSync(appConfigPath)) {
        console.log('Creating minimal app.json configuration');
        const minimalConfig = {
            legacyEditorDefaultMode: 'source',
            defaultViewMode: 'source',
            livePreview: false,
            attachmentFolderPath: './attachments',
            alwaysUpdateLinks: true
        };
        fs.writeFileSync(appConfigPath, JSON.stringify(minimalConfig, null, 2));
    }

    // Ensure community-plugins.json exists (even if empty)
    const pluginsPath = path.join(obsidianDir, 'community-plugins.json');
    if (!fs.existsSync(pluginsPath)) {
        console.log('Creating empty community-plugins.json');
        fs.writeFileSync(pluginsPath, '[]');
    }

    // Validate the environment
    const issues = [];
    
    if (!fs.existsSync(testVaultPath)) {
        issues.push(`Test vault directory does not exist: ${testVaultPath}`);
    }
    
    if (!fs.existsSync(obsidianDir)) {
        issues.push(`.obsidian directory does not exist: ${obsidianDir}`);
    }
    
    if (!fs.statSync(testVaultPath).isDirectory()) {
        issues.push(`Test vault path is not a directory: ${testVaultPath}`);
    }

    if (issues.length > 0) {
        throw new Error(`Test environment validation failed:\n${issues.join('\n')}`);
    }

    console.log('Test environment validated successfully');
}

module.exports = { ensureTestEnvironment };