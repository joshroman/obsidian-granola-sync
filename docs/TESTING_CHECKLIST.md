# Obsidian Granola Sync - Testing Checklist

Use this checklist to systematically test all plugin features before deployment.

## 🚀 Setup & Installation

### Build Process
- [ ] `npm install` completes without errors
- [ ] `npm test` shows 74 tests passing
- [ ] `npm run build` creates main.js
- [ ] styles.css generated from individual files
- [ ] No TypeScript compilation errors

### Installation
- [ ] Plugin folder created in .obsidian/plugins/
- [ ] All 3 files copied (main.js, manifest.json, styles.css)
- [ ] Plugin appears in Community Plugins list
- [ ] Plugin enables without errors
- [ ] Ribbon icon appears in left sidebar

## 🔧 Configuration

### Setup Wizard
- [ ] Wizard launches on first activation
- [ ] Welcome screen displays correctly
- [ ] API key input accepts text
- [ ] Test Connection validates API key
- [ ] Invalid API key shows error
- [ ] Valid API key shows success
- [ ] Organization preview updates on selection
- [ ] Settings summary shows selections
- [ ] Wizard completion saves settings

### Settings Tab
- [ ] All settings load with defaults
- [ ] API key field masks input
- [ ] Test Connection button works
- [ ] Sync folder path validates
- [ ] Organization dropdown works
- [ ] Date format preview updates
- [ ] Auto-sync toggle persists
- [ ] Sync interval validates (min 5)
- [ ] Batch size validates (1-100)
- [ ] Settings save on change

## 📥 Core Sync Functionality

### First Sync
- [ ] Sync Now command appears in palette
- [ ] Ribbon icon click starts sync
- [ ] Progress modal appears
- [ ] Progress percentage accurate
- [ ] Time estimate reasonable
- [ ] Current operation displays
- [ ] All meetings download
- [ ] Folder structure created correctly
- [ ] Meeting notes have correct content
- [ ] Statistics show after completion

### Incremental Sync
- [ ] Second sync only fetches new meetings
- [ ] Modified meetings update
- [ ] Deleted meetings handled per settings
- [ ] Progress shows "Checking for updates"
- [ ] Statistics show new/updated count

### Auto-sync
- [ ] Auto-sync runs at set interval
- [ ] Status bar shows next sync time
- [ ] Manual sync resets timer
- [ ] Auto-sync can be interrupted
- [ ] Settings change updates schedule

## 📁 Organization Modes

### Flat Structure
- [ ] All notes in single folder
- [ ] No subfolders created
- [ ] File names include dates
- [ ] Duplicate titles handled

### Date-based Daily
- [ ] YYYY/MM/DD folder structure
- [ ] Notes in correct date folders
- [ ] Empty folders not created
- [ ] Cross-timezone meetings handled

### Date-based Weekly  
- [ ] YYYY/Week-XX structure
- [ ] Week numbers correct
- [ ] Week boundary meetings placed correctly
- [ ] ISO week numbering used

### Mirror Granola
- [ ] Granola folder structure replicated
- [ ] Nested folders work
- [ ] Root level meetings handled
- [ ] Special characters in folders sanitized

## ⚠️ Conflict Resolution

### User Modified Detection
- [ ] Edited notes detected
- [ ] Conflict modal appears
- [ ] Shows local vs remote diff
- [ ] Keep Local preserves changes
- [ ] Warning before overwrite

### Both Modified
- [ ] Simultaneous edits detected
- [ ] Merge option available
- [ ] Merge preserves both changes
- [ ] Backup created if selected

### File Missing
- [ ] Deleted files detected
- [ ] Re-create option works
- [ ] Skip option available
- [ ] Bulk resolution works

### Metadata Issues
- [ ] Corrupted frontmatter detected
- [ ] Repair option fixes issues
- [ ] Manual intervention guided
- [ ] Recovery successful

## 🚨 Error Handling

### API Errors
- [ ] Invalid key error clear
- [ ] Rate limit message helpful  
- [ ] Network timeout handled
- [ ] Server errors show status
- [ ] Retry logic works

### File System Errors
- [ ] Permission errors caught
- [ ] Disk full handled
- [ ] Invalid paths rejected
- [ ] Character encoding handled

### Data Errors
- [ ] Malformed JSON handled
- [ ] Missing fields defaulted
- [ ] Invalid dates corrected
- [ ] Empty responses handled

## 🎨 UI/UX

### Visual Design
- [ ] UI matches Obsidian theme
- [ ] Dark mode support
- [ ] Light mode support
- [ ] Custom CSS applies
- [ ] Responsive layouts

### User Feedback
- [ ] Progress always visible
- [ ] Errors clearly explained
- [ ] Success confirmations shown
- [ ] Help text informative
- [ ] Cancel always available

### Accessibility
- [ ] Keyboard navigation works
- [ ] Tab order logical
- [ ] Screen reader friendly
- [ ] High contrast visible
- [ ] Focus indicators clear

## 🚄 Performance

### Small Dataset (<100 meetings)
- [ ] Sync completes < 10 seconds
- [ ] UI remains responsive
- [ ] Memory usage < 100MB
- [ ] No console warnings

### Medium Dataset (100-500)
- [ ] Sync completes < 60 seconds
- [ ] Batch processing visible
- [ ] Progress updates smoothly
- [ ] Cancel works immediately

### Large Dataset (500-1000)
- [ ] Sync completes < 5 minutes
- [ ] Memory usage < 200MB
- [ ] No UI freezing
- [ ] Recovery after interrupt

### Stress Test (1000+)
- [ ] Sync eventually completes
- [ ] Memory usage stable
- [ ] Adaptive batching works
- [ ] No crashes or hangs

## 🔒 Security & Privacy

### API Security
- [ ] API key stored locally only
- [ ] No key in logs/console
- [ ] HTTPS used exclusively
- [ ] No sensitive data exposed

### Data Handling
- [ ] No external services used
- [ ] Local storage only
- [ ] Sanitization prevents injection
- [ ] File paths validated

## 🐛 Edge Cases

### Special Characters
- [ ] Emoji in titles work
- [ ] Unicode names handled
- [ ] Reserved chars sanitized
- [ ] Path separators escaped

### Extreme Values
- [ ] Very long titles truncated
- [ ] Huge transcripts handled
- [ ] Many attendees displayed
- [ ] Long summaries formatted

### Date/Time Edge Cases
- [ ] Midnight meetings placed correctly
- [ ] Timezone changes handled
- [ ] DST transitions work
- [ ] Invalid dates skipped

### Concurrency
- [ ] Multiple sync prevention
- [ ] Rapid clicks handled
- [ ] Settings changes during sync
- [ ] Vault switch handled

## 📋 Final Checks

### Documentation
- [ ] README accurate
- [ ] All features documented
- [ ] Examples provided
- [ ] Troubleshooting helpful

### Code Quality
- [ ] No console errors
- [ ] No memory leaks
- [ ] Cleanup on disable
- [ ] State persists correctly

### Release Ready
- [ ] Version numbers match
- [ ] Changelog updated
- [ ] Community submission ready
- [ ] Support plan defined

---

## Test Results Summary

**Date Tested**: _____________

**Tester**: _____________

**Environment**:
- Obsidian Version: _____________
- OS: _____________
- Vault Size: _____________
- Meeting Count: _____________

**Overall Result**: 
- [ ] PASS - Ready for deployment
- [ ] FAIL - Issues need resolution

**Notes**:
_________________________________
_________________________________
_________________________________