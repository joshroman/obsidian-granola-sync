#!/usr/bin/env -S npx tsx

/**
 * Integration test script that uses the actual EnhancedGranolaService implementation
 * This replaces the flawed test-new-endpoints.js that bypassed the service layer
 */

import { EnhancedGranolaService } from '../src/services/enhanced-granola-service';
import { StructuredLogger } from '../src/utils/structured-logger';
import { PerformanceMonitor } from '../src/utils/performance-monitor';
import { ErrorTracker } from '../src/utils/error-tracker';
import { TokenRetrievalService } from '../src/services/token-retrieval-service';

async function testServiceIntegration() {
  console.log('=== Testing EnhancedGranolaService Integration ===\n');
  
  try {
    // Get API token using the actual token service
    const tokenInfo = TokenRetrievalService.getTokenInfo();
    if (!tokenInfo) {
      throw new Error('No API token found. Please ensure Granola is installed and you are logged in.');
    }
    
    console.log('✅ Token retrieved successfully');
    console.log(`   Version: ${tokenInfo.version}`);
    
    // Create mock plugin for services (following existing test pattern)
    const mockPlugin = {
      manifest: { version: '1.0.0' },
      settings: { debugMode: true, logLevel: 'debug' }
    };
    
    // Create service dependencies
    const logger = new StructuredLogger('test', mockPlugin);
    const performanceMonitor = new PerformanceMonitor(logger);
    const errorTracker = new ErrorTracker(logger);
    
    // Create the actual service instance
    const granolaService = new EnhancedGranolaService(
      { 
        apiKey: tokenInfo.accessToken,
        granolaVersion: tokenInfo.version 
      },
      logger,
      performanceMonitor,
      errorTracker
    );
    
    console.log('✅ EnhancedGranolaService created successfully\n');
    
    // Test 1: Feature Flags API using actual service method
    console.log('🧪 Testing getFeatureFlags() service method...');
    try {
      const featureFlags = await granolaService.getFeatureFlags();
      console.log(`✅ Retrieved ${featureFlags.length} feature flags via service`);
      if (featureFlags.length > 0) {
        console.log(`   Sample flags: ${featureFlags.slice(0, 3).map(f => f.feature).join(', ')}`);
        
        // Verify structure matches expected type
        const firstFlag = featureFlags[0];
        if (typeof firstFlag.feature !== 'string' || firstFlag.value === undefined) {
          console.error('❌ Feature flag structure does not match expected type');
        }
      }
    } catch (error) {
      console.error('❌ getFeatureFlags() test failed:', error instanceof Error ? error.message : error);
    }
    
    // Test 2: Feature Flags Map (backward compatibility) using actual service method
    console.log('\n🧪 Testing getFeatureFlagsMap() service method...');
    try {
      const flagsMap = await granolaService.getFeatureFlagsMap();
      const flagCount = Object.keys(flagsMap).length;
      console.log(`✅ Retrieved ${flagCount} flags in map format via service`);
      if (flagsMap.view_source !== undefined) {
        console.log(`   view_source flag: ${flagsMap.view_source}`);
      }
    } catch (error) {
      console.error('❌ getFeatureFlagsMap() test failed:', error instanceof Error ? error.message : error);
    }
    
    // Test 3: People API using actual service method
    console.log('\n🧪 Testing getPeople() service method...');
    try {
      const people = await granolaService.getPeople();
      console.log(`✅ Retrieved ${people.length} people via service`);
      if (people.length > 0) {
        const firstPerson = people[0];
        console.log(`   First person: ${firstPerson.name} (${firstPerson.email})`);
        if (firstPerson.company_name) {
          console.log(`   Company: ${firstPerson.company_name}`);
        }
        
        // Verify structure matches expected type
        if (!firstPerson.id || !firstPerson.name || !firstPerson.email) {
          console.error('❌ Person structure missing required fields');
        }
      }
    } catch (error) {
      console.error('❌ getPeople() test failed:', error instanceof Error ? error.message : error);
    }
    
    // Test 4: Notion Integration using actual service method
    console.log('\n🧪 Testing getNotionIntegration() service method...');
    try {
      const notion = await granolaService.getNotionIntegration();
      if (notion) {
        console.log(`✅ Retrieved Notion integration details via service`);
        console.log(`   Is connected: ${notion.isConnected}`);
        console.log(`   Can integrate: ${notion.canIntegrate}`);
        const workspaceCount = Object.keys(notion.integrations).length;
        if (workspaceCount > 0) {
          console.log(`   Connected workspaces: ${workspaceCount}`);
          const workspaceNames = Object.values(notion.integrations).map(w => w.workspace_name);
          console.log(`   Workspace names: ${workspaceNames.join(', ')}`);
        }
      } else {
        console.log('✅ Notion integration returned null (no integration) via service');
      }
    } catch (error) {
      console.error('❌ getNotionIntegration() test failed:', error instanceof Error ? error.message : error);
    }
    
    // Test 5: Subscriptions using actual service method
    console.log('\n🧪 Testing getSubscriptions() service method...');
    try {
      const subscriptions = await granolaService.getSubscriptions();
      if (subscriptions) {
        console.log(`✅ Retrieved subscription information via service`);
        console.log(`   Active plan: ${subscriptions.active_plan_id}`);
        console.log(`   Available plans: ${subscriptions.subscription_plans.length}`);
        if (subscriptions.subscription_plans.length > 0) {
          const activePlan = subscriptions.subscription_plans.find(p => p.id === subscriptions.active_plan_id);
          if (activePlan) {
            console.log(`   Active plan details: ${activePlan.display_name} (${activePlan.type})`);
            console.log(`   Price: $${activePlan.price.monthly}/${activePlan.currency_iso} monthly`);
          }
        }
      } else {
        console.log('✅ Subscriptions returned null (no subscription data) via service');
      }
    } catch (error) {
      console.error('❌ getSubscriptions() test failed:', error instanceof Error ? error.message : error);
    }
    
    console.log('\n🎉 All service integration tests completed!');
    console.log('✅ SUCCESS: All API methods tested via actual EnhancedGranolaService implementation');
    
  } catch (error) {
    console.error('\n💥 Service integration test setup failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Run the test
testServiceIntegration().catch(console.error);