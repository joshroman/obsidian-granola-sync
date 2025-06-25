# Local Testing Guide - Obsidian Granola Sync

This guide walks you through testing the Granola Sync plugin locally with your own Obsidian instance before deploying to others.

## Pre-requisites

1. **Granola Account**: Active Granola account with meeting notes
2. **Granola API Key**: Obtain from Granola settings/account page
3. **Obsidian**: Version 1.4.0 or higher installed
4. **Node.js**: Version 18.x or higher (for building)
5. **Test Vault**: Create a dedicated test vault for initial testing

## Step 1: Build the Plugin

```bash
# 1. Navigate to the plugin directory
cd /Users/joshroman/Projects/obsidian-granola-sync

# 2. Install dependencies (if not already done)
npm install

# 3. Run the test suite to verify everything works
npm test

# 4. Build the plugin
npm run build

# 5. Create the styles.css file
cat styles/*.css > styles.css
```

## Step 2: Install in Test Vault

1. **Create a test vault** in Obsidian:
   - Open Obsidian
   - Click "Create new vault"
   - Name it "GranolaSync-Test"
   - Choose a location you can easily access

2. **Create plugins directory**:
   ```bash
   # Navigate to your test vault
   cd /path/to/GranolaSync-Test
   
   # Create plugins directory if it doesn't exist
   mkdir -p .obsidian/plugins/obsidian-granola-sync
   ```

3. **Copy plugin files**:
   ```bash
   # Copy the built files
   cp /Users/joshroman/Projects/obsidian-granola-sync/main.js .obsidian/plugins/obsidian-granola-sync/
   cp /Users/joshroman/Projects/obsidian-granola-sync/manifest.json .obsidian/plugins/obsidian-granola-sync/
   cp /Users/joshroman/Projects/obsidian-granola-sync/styles.css .obsidian/plugins/obsidian-granola-sync/
   ```

## Step 3: Enable the Plugin

1. **Open test vault** in Obsidian
2. Go to **Settings** (gear icon)
3. Navigate to **Community plugins**
4. **Disable Safe Mode** if it's enabled
5. Click **Reload plugins** button
6. Find "Granola Sync" in the list
7. Toggle it **ON**

## Step 4: Initial Configuration

### 4a. First-time Setup Wizard

1. **Click the Granola Sync icon** in the left ribbon
2. The **Setup Wizard** should appear automatically
3. Follow the wizard steps:
   - **Welcome**: Read the introduction
   - **API Key**: Enter your Granola API key
   - **Test Connection**: Verify it connects successfully
   - **Organization**: Choose folder structure (try "Date-based" first)
   - **Settings**: Configure sync preferences
   - **Complete**: Review settings

### 4b. Manual Configuration (Alternative)

1. Go to **Settings → Granola Sync**
2. Enter your **API Key**
3. Click **Test Connection**
4. Configure:
   - **Sync Folder**: `Meetings` (recommended)
   - **Organization**: Date-based (YYYY/MM)
   - **File Naming**: Include date prefix
   - **Auto-sync**: OFF (for initial testing)

## Step 5: Test Basic Sync

1. **Manual Sync Test**:
   - Click the Granola Sync ribbon icon
   - Select "Sync Now"
   - Watch the progress modal
   - Verify meetings appear in your vault

2. **Check Results**:
   - Navigate to the sync folder
   - Verify folder structure matches your settings
   - Open a few meeting notes
   - Check formatting and content

3. **Verify Features**:
   - ✅ Meeting title and date
   - ✅ Participants list
   - ✅ Summary section
   - ✅ Action items
   - ✅ Transcript (if available)

## Step 6: Test Advanced Features

### 6a. Incremental Sync
1. Wait for new meetings in Granola
2. Run sync again
3. Verify only new meetings are added
4. Check sync statistics in progress modal

### 6b. Conflict Resolution
1. **Create conflict scenario**:
   - Edit a synced meeting note in Obsidian
   - Add a comment like "LOCAL EDIT TEST"
   - Run sync again
   - Conflict resolution dialog should appear

2. **Test each resolution option**:
   - Keep Local
   - Keep Remote
   - Merge Both
   - Skip

### 6c. Large Dataset Performance
1. If you have 100+ meetings:
   - Run full sync
   - Monitor progress and performance
   - Check memory usage in Activity Monitor/Task Manager
   - Verify batch processing works

### 6d. Error Recovery
1. **Simulate interruption**:
   - Start a sync
   - Close Obsidian mid-sync
   - Reopen and sync again
   - Verify recovery works

## Step 7: Test Edge Cases

### 7a. Special Characters
- Verify meetings with special characters in titles work
- Test: `"Meeting: Project <Alpha> | Review & Planning"`

### 7b. Long Content
- Test meetings with very long transcripts
- Verify no truncation or errors

### 7c. Date Edge Cases
- Meetings at midnight
- Different timezones
- Daylight saving transitions

### 7d. Folder Organization
1. Test each organization mode:
   - Flat structure
   - Date-based (daily)
   - Date-based (weekly)
   - Mirror Granola

## Step 8: Test UI/UX

### 8a. Settings Changes
1. Change various settings
2. Run sync after each change
3. Verify settings persist
4. Test settings validation

### 8b. Error Handling
1. **Test invalid API key**:
   - Enter wrong API key
   - Verify clear error message
   
2. **Test network issues**:
   - Disconnect internet
   - Try to sync
   - Verify helpful error message

### 8c. Progress Tracking
1. During sync, verify:
   - Accurate progress percentage
   - Time remaining estimates
   - Current operation display
   - Statistics update

## Step 9: Performance Testing

1. **Check Performance**:
   ```bash
   # In Obsidian, open Developer Console
   # (Ctrl/Cmd + Shift + I)
   
   # Look for any errors or warnings
   # Check console timing logs
   ```

2. **Monitor Resources**:
   - CPU usage during sync
   - Memory consumption
   - Disk I/O patterns

## Step 10: Final Validation

### 10a. Clean Install Test
1. **Remove and reinstall**:
   - Disable plugin
   - Delete plugin folder
   - Reinstall following steps 2-3
   - Verify fresh setup works

### 10b. Data Integrity
1. **Compare with Granola**:
   - Pick 5 random meetings
   - Compare Obsidian version with Granola
   - Verify all data transferred correctly

### 10c. Backup Test
1. **Before production use**:
   - Backup your main vault
   - Test restore procedure
   - Verify no data corruption

## Step 11: Production Deployment

Once all tests pass:

1. **Install in main vault**:
   ```bash
   cp -r .obsidian/plugins/obsidian-granola-sync /path/to/main-vault/.obsidian/plugins/
   ```

2. **Configure for production**:
   - Use preferred folder structure
   - Enable auto-sync if desired
   - Set sync interval (recommended: 30 minutes)

3. **Initial production sync**:
   - Run manual sync first
   - Review results
   - Enable auto-sync after verification

## Troubleshooting Checklist

If issues occur:

1. **Check logs**:
   - Open Developer Console (Ctrl/Cmd + Shift + I)
   - Look for error messages
   - Check structured logs

2. **Common issues**:
   - ❌ Plugin doesn't appear → Reload Obsidian
   - ❌ API connection fails → Verify API key
   - ❌ Sync hangs → Check internet connection
   - ❌ Missing meetings → Check date filters

3. **Reset if needed**:
   - Settings → Granola Sync → Advanced → Reset Plugin
   - This clears all settings and sync state

## Success Criteria

Your testing is complete when:

- ✅ All meetings sync successfully
- ✅ Folder organization works as expected
- ✅ Conflict resolution handles all cases
- ✅ Performance is acceptable (< 5 min for 1000 meetings)
- ✅ No console errors during normal operation
- ✅ UI is responsive and intuitive
- ✅ Recovery from errors works properly
- ✅ Settings persist across restarts

## Feedback Collection

Before deploying to others:

1. **Document any issues** found during testing
2. **Note performance metrics** for your dataset size
3. **List feature requests** or improvements
4. **Capture screenshots** of any UI issues

## Next Steps

After successful local testing:

1. **Beta Testing**:
   - Share with 3-5 trusted users
   - Provide this testing guide
   - Collect structured feedback

2. **Community Release**:
   - Submit to Obsidian plugin directory
   - Monitor GitHub issues
   - Plan update schedule

---

**Remember**: Always backup your vault before testing any new plugin!