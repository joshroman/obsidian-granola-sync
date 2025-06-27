# Quick Start Testing Guide

A condensed version for experienced users who want to test quickly.

## 5-Minute Quick Test

```bash
# 1. Build the plugin
cd /Users/joshroman/Projects/obsidian-granola-sync
npm install && npm test && npm run build
cat styles/*.css > styles.css

# 2. Install to test vault
VAULT_PATH="/path/to/your/test-vault"
mkdir -p "$VAULT_PATH/.obsidian/plugins/obsidian-granola-sync"
cp main.js manifest.json styles.css "$VAULT_PATH/.obsidian/plugins/obsidian-granola-sync/"

# 3. Open Obsidian and enable plugin
# Settings → Community plugins → Enable Granola Sync
```

## Essential Test Checklist

### ✅ Basic Functionality
- [ ] Plugin loads without errors
- [ ] API key validation works
- [ ] First sync completes successfully
- [ ] Meeting notes appear in correct folders
- [ ] Content formatting is correct

### ✅ Core Features
- [ ] Incremental sync (only new meetings)
- [ ] Conflict detection for edited notes
- [ ] Progress tracking shows accurate info
- [ ] Different folder organizations work
- [ ] Auto-sync runs on schedule

### ✅ Error Handling
- [ ] Invalid API key shows clear error
- [ ] Network failure handled gracefully
- [ ] Interrupted sync can recover
- [ ] Large datasets don't crash

### ✅ Performance
- [ ] 100 meetings sync in < 30 seconds
- [ ] UI remains responsive during sync
- [ ] Memory usage stays reasonable
- [ ] No console errors in normal use

## Command Reference

```bash
# Development commands
npm test              # Run test suite
npm run build        # Build plugin
npm run dev          # Watch mode

# Quick install to vault
./scripts/install-to-vault.sh /path/to/vault

# Check for issues
npm run lint         # Code quality
npm run check        # Full validation
```

## Testing Scenarios

### 1. Fresh Install
1. Install plugin
2. Run setup wizard
3. Complete first sync
4. Verify all meetings imported

### 2. Daily Use
1. Add meetings in Granola
2. Auto-sync picks them up
3. Edit in Obsidian
4. Conflict handled properly

### 3. Recovery Test
1. Start large sync
2. Force quit Obsidian
3. Restart and sync
4. Verify recovery works

### 4. Edge Cases
- Meeting with no transcript
- Very long meeting (3+ hours)
- Special characters in title
- 1000+ meeting library

## Quick Troubleshooting

| Issue | Solution |
|-------|----------|
| Plugin won't load | Reload Obsidian, check console |
| API connection fails | Verify key, check network |
| Sync seems stuck | Check progress modal, wait for batch |
| Missing meetings | Check date range, folder settings |
| Duplicate meetings | Reset sync state in settings |

## Performance Benchmarks

Expected performance on modern hardware:

- **First sync**: ~10 meetings/second
- **Incremental**: ~50 meetings/second  
- **Memory usage**: < 200MB for 1000 meetings
- **UI blocking**: None (async processing)

## Ready for Production?

You're ready when:
- ✅ All checklist items pass
- ✅ No console errors
- ✅ Performance acceptable
- ✅ UI feels smooth
- ✅ Confident in stability

---

**Pro tip**: Use a separate Obsidian profile for testing to avoid any conflicts with your main vault.