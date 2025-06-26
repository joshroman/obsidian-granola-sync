#!/usr/bin/env node

// Direct test of the Granola API endpoint
const https = require('https');
const pako = require('pako');
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

async function testEndpoint(endpoint, method = 'POST', body = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, 'https://api.granola.ai');
    
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Authorization': `Bearer ${getToken()}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-App-Version': '6.4.0',
        'User-Agent': 'Granola/6.4.0 Electron/33.4.5 Chrome/130.0.6723.191 Node/20.18.3 (macOS 15.3.1 24D70)',
        'X-Client-Type': 'electron',
        'X-Client-Platform': 'darwin',
        'X-Client-Architecture': 'arm64',
        'X-Client-Id': 'granola-electron-6.4.0'
      }
    };

    console.log(`\nTesting ${method} ${endpoint}`);
    console.log('Headers:', JSON.stringify(options.headers, null, 2));
    console.log('Body:', JSON.stringify(body, null, 2));

    const req = https.request(options, (res) => {
      console.log(`Status: ${res.statusCode} ${res.statusMessage}`);
      console.log('Response headers:', JSON.stringify(res.headers, null, 2));
      
      let data = [];
      res.on('data', (chunk) => data.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(data);
        const contentEncoding = res.headers['content-encoding'];
        
        try {
          let responseData;
          if (contentEncoding === 'gzip') {
            responseData = pako.ungzip(buffer, { to: 'string' });
          } else {
            responseData = buffer.toString('utf8');
          }
          
          // Try to parse as JSON
          try {
            const parsed = JSON.parse(responseData);
            console.log('Response body:', JSON.stringify(parsed, null, 2));
            resolve({ status: res.statusCode, data: parsed });
          } catch {
            console.log('Response text:', responseData);
            resolve({ status: res.statusCode, data: responseData });
          }
        } catch (e) {
          console.error('Failed to process response:', e.message);
          reject(e);
        }
      });
    });

    req.on('error', (e) => {
      console.error('Request error:', e);
      reject(e);
    });
    
    if (method !== 'GET' && body !== undefined) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('=== Granola API Endpoint Tests ===\n');
  
  try {
    // Test 1: Feature flags (known working endpoint)
    await testEndpoint('/v1/get-feature-flags', 'POST');
    
    // Test 2: Documents endpoint with empty body
    await testEndpoint('/v2/get-documents', 'POST');
    
    // Test 3: Documents endpoint with filters
    await testEndpoint('/v2/get-documents', 'POST', { limit: 3 });
    
    // Test 4: Try v1 version of documents
    await testEndpoint('/v1/get-documents', 'POST', { limit: 3 });
    
    // Test 5: Try without /v2 prefix
    await testEndpoint('/get-documents', 'POST', { limit: 3 });
    
  } catch (error) {
    console.error('\nTest failed:', error.message);
  }
}

runTests();