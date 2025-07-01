#!/usr/bin/env node

/**
 * Visual Regression Comparison Script
 * Compares before/after screenshots to detect visual changes
 */

const fs = require('fs');
const path = require('path');

const SCREENSHOTS_DIR = './test-screenshots';
const BASELINE_DIR = './test-screenshots/baseline';
const OUTPUT_DIR = './test-screenshots/diffs';

/**
 * Simple visual regression checker
 * In a real implementation, you'd use a library like pixelmatch
 */
function compareScreenshots() {
  console.log('🔍 Running visual regression tests...');
  
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    console.log('❌ No screenshots directory found');
    process.exit(1);
  }
  
  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  const screenshots = fs.readdirSync(SCREENSHOTS_DIR)
    .filter(file => file.endsWith('.png') && !file.includes('baseline') && !file.includes('diffs'));
  
  if (screenshots.length === 0) {
    console.log('❌ No screenshots found to compare');
    process.exit(1);
  }
  
  console.log(`📸 Found ${screenshots.length} screenshots to validate:`);
  screenshots.forEach(file => console.log(`  - ${file}`));
  
  // Create baseline if it doesn't exist
  if (!fs.existsSync(BASELINE_DIR)) {
    fs.mkdirSync(BASELINE_DIR, { recursive: true });
    console.log('📁 Creating baseline directory...');
    
    // Copy current screenshots as baseline
    screenshots.forEach(file => {
      const srcPath = path.join(SCREENSHOTS_DIR, file);
      const destPath = path.join(BASELINE_DIR, file);
      fs.copyFileSync(srcPath, destPath);
      console.log(`  ✅ Created baseline: ${file}`);
    });
    
    console.log('✅ Baseline created. Run tests again to compare against baseline.');
    return;
  }
  
  // Compare against baseline
  let differences = 0;
  
  screenshots.forEach(file => {
    const currentPath = path.join(SCREENSHOTS_DIR, file);
    const baselinePath = path.join(BASELINE_DIR, file);
    
    if (!fs.existsSync(baselinePath)) {
      console.log(`⚠️  No baseline for ${file} - creating new baseline`);
      fs.copyFileSync(currentPath, baselinePath);
      return;
    }
    
    // Simple file size comparison (in real implementation, use pixel comparison)
    const currentStats = fs.statSync(currentPath);
    const baselineStats = fs.statSync(baselinePath);
    
    const sizeDiff = Math.abs(currentStats.size - baselineStats.size);
    const threshold = baselineStats.size * 0.05; // 5% threshold
    
    if (sizeDiff > threshold) {
      differences++;
      console.log(`❌ Visual difference detected in ${file}:`);
      console.log(`   Current: ${currentStats.size} bytes`);
      console.log(`   Baseline: ${baselineStats.size} bytes`);
      console.log(`   Difference: ${sizeDiff} bytes (${((sizeDiff/baselineStats.size)*100).toFixed(1)}%)`);
    } else {
      console.log(`✅ ${file} matches baseline`);
    }
  });
  
  if (differences > 0) {
    console.log(`\n❌ Visual regression detected! ${differences} file(s) changed.`);
    console.log('Review the changes and update baseline if intentional:');
    console.log(`   npm run test:visual-update-baseline`);
    process.exit(1);
  } else {
    console.log('\n✅ All visual tests passed!');
  }
}

/**
 * Update baseline screenshots
 */
function updateBaseline() {
  console.log('📸 Updating visual baseline...');
  
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    console.log('❌ No screenshots directory found');
    process.exit(1);
  }
  
  if (!fs.existsSync(BASELINE_DIR)) {
    fs.mkdirSync(BASELINE_DIR, { recursive: true });
  }
  
  const screenshots = fs.readdirSync(SCREENSHOTS_DIR)
    .filter(file => file.endsWith('.png') && !file.includes('baseline') && !file.includes('diffs'));
  
  screenshots.forEach(file => {
    const srcPath = path.join(SCREENSHOTS_DIR, file);
    const destPath = path.join(BASELINE_DIR, file);
    fs.copyFileSync(srcPath, destPath);
    console.log(`✅ Updated baseline: ${file}`);
  });
  
  console.log(`\n✅ Baseline updated with ${screenshots.length} screenshots`);
}

// Command line interface
const command = process.argv[2];

switch (command) {
  case 'update-baseline':
    updateBaseline();
    break;
  default:
    compareScreenshots();
    break;
}