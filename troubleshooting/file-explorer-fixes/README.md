# File Explorer Layout Fix

## Issue Description

Some Obsidian users may experience their file explorer displaying folders and files in a horizontal/grid layout instead of the standard vertical list view. This can happen when:

- A theme modifies the file explorer CSS
- Another plugin changes the display properties
- Custom CSS snippets affect the navigation layout

**Note**: This is NOT a bug in the Granola Sync plugin. The issue is caused by external CSS modifications to Obsidian's file explorer.

## Symptoms

- Folders appear side-by-side instead of vertically stacked
- Multiple items appear on the same line
- Subfolder indentation may be broken
- Items may disappear when the file explorer pane is resized

## Solution

We've provided a CSS snippet that forces the file explorer back to the standard vertical layout.

### How to Apply the Fix

1. Open Obsidian Settings (`Cmd/Ctrl + ,`)
2. Go to **Appearance** → **CSS snippets**
3. Click the folder icon to open the snippets folder
4. Copy `file-explorer-layout-fix-granola.css` from this directory into your snippets folder
5. Go back to Obsidian Settings → Appearance → CSS snippets
6. Enable the "file-explorer-layout-fix-granola" snippet by clicking the toggle

The fix should apply immediately, restoring your file explorer to the standard vertical list view.

### What This Fix Does

The CSS snippet:
- Forces all folder children to display vertically (`flex-direction: column`)
- Resets margins and padding that might cause misalignment
- Ensures proper indentation for nested folders
- Prevents items from floating or displaying inline
- Maintains consistent width for all items

### Alternative Solutions

If the CSS snippet doesn't resolve your issue:

1. **Check your theme**: Try switching to the Default theme temporarily
2. **Disable other plugins**: Turn off plugins that might affect the file explorer
3. **Check for other CSS snippets**: Disable other snippets one by one to find conflicts
4. **Use Developer Tools**: Press `Cmd+Opt+I` (Mac) or `Ctrl+Shift+I` (Windows) to inspect the CSS and identify the source

### Still Having Issues?

If you continue to experience problems:
1. Check if the issue persists in Obsidian's Safe Mode (all plugins disabled)
2. Report the issue to the theme or plugin that's causing the conflict
3. You can ask for help in the Obsidian Discord server's #appearance channel