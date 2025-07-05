# CSS Cleanup - Implementation Specification

## Problem Statement

The project currently has:
- Individual CSS files in `/styles/` folder that are NOT loaded by the plugin
- A single `styles.css` file that IS loaded by the plugin (per manifest.json)
- This creates dead code and maintenance confusion

## Solution: Remove Dead Code

**SCOPE**: This is a simple cleanup task to remove unused files. Nothing more.

### Implementation Steps

#### Step 1: Audit Current State (5 minutes)
1. Verify that only `styles.css` is loaded:
   - Check `manifest.json` - should show `"css": "styles.css"`
   - Individual files in `/styles/` folder should NOT be referenced

2. List all CSS files in `/styles/` folder:
   ```bash
   ls -la styles/
   ```

#### Step 2: Remove Unused CSS Files (3 minutes)
Delete all individual CSS files in the `/styles/` folder:
- `styles/conflict-modal.css`
- `styles/consent-modal.css`
- `styles/notifications.css`
- `styles/sync-modal.css`
- `styles/wizard-auto-detection.css`
- `styles/wizard.css`

**Note**: These files are dead code. The plugin only loads `styles.css` from the root directory.

#### Step 3: Validation (5 minutes)
1. Build the plugin:
   ```bash
   npm run build
   ```

2. Test that all UI components still work:
   - Open setup wizard
   - Trigger sync modal
   - Test conflict resolution modal
   - Verify no visual regressions

3. Check browser console for CSS-related errors (there should be none)

#### Step 4: Clean Up Empty Directory (1 minute)
Remove the empty `/styles/` folder if no other files remain.

### Success Criteria
- [ ] All unused CSS files removed
- [ ] Plugin builds successfully  
- [ ] All UI components render correctly
- [ ] No CSS-related console errors
- [ ] Codebase is cleaner and less confusing

### What This Task DOES NOT Include

❌ **EXPLICITLY REJECTED** - Do not implement these:
- CSS preprocessing or build steps
- CSS architecture changes
- New scoping methodologies
- Visual regression testing
- Performance optimizations
- CSS framework integration
- Complex build processes
- CSS validation tools
- Style guide creation
- Component library setup

## Notes for Implementation

- The main `styles.css` file already has proper scoping with `.granola-` prefixes
- Individual CSS files contain duplicate or unscoped content that was never loaded
- This is purely a cleanup task to remove dead code
- No functional changes to styling should occur

## Time Estimate
**Total: 15 minutes**

This is a straightforward file deletion task with basic validation. No complex CSS knowledge required.