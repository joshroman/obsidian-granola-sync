# Obsidian Granola Sync

Sync your Granola meeting notes to Obsidian automatically.

> ⚠️ **Note**: This is an unofficial plugin using undocumented Granola APIs that may change without notice. Currently tested on macOS only.

## What It Does

This plugin automatically syncs your meeting notes from Granola to your Obsidian vault, keeping them organized and up-to-date. It detects changes, handles conflicts gracefully, and preserves any edits you make locally.

## Key Features

- **Auto-sync**: Set it and forget it - syncs every 5-60 minutes
- **Smart conflict handling**: Never lose your edits
- **Flexible organization**: Store notes flat or in date-based folders
- **Incremental updates**: Only syncs what's changed
- **Template support**: Preserves your custom Granola templates

## Installation

### From Community Plugins (Coming Soon)
1. Settings → Community Plugins → Browse
2. Search for "Granola Sync"
3. Install and Enable

### Manual Install
1. Download latest release from [GitHub](https://github.com/joshroman/obsidian-granola-sync/releases)
2. Extract to `.obsidian/plugins/obsidian-granola-sync/`
3. Enable in Settings → Community Plugins

## Getting Started

1. Enable the plugin - the setup wizard will guide you
2. Your Granola API key is detected automatically
3. Choose where to store notes and how to organize them
4. Start syncing!

## Settings

### Basic Settings

| Setting | What it does | Default |
|---------|--------------|---------|
| **Target Folder** | Where meeting notes are stored | "Meetings" |
| **Organization** | How to organize files:<br>• **Flat**: All in one folder<br>• **By Date**: Daily/weekly folders | Flat |
| **Date in Filename** | Add meeting date to filename | Yes |
| **Date Format** | How dates appear (yyyy-MM-dd) | yyyy-MM-dd |
| **Include Transcript** | Include full meeting transcript | Yes |
| **Auto Sync** | Sync automatically | No |
| **Sync Interval** | How often to check (5-60 min) | 15 minutes |

### Advanced Settings

| Setting | What it does | Default |
|---------|--------------|---------|
| **Show Progress** | Display sync progress window | Yes |
| **Debug Mode** | Show detailed logs (slows sync) | No |

## Meeting Note Format

Each note includes:
- Meeting title, date, duration, and attendees in frontmatter
- Summary and key highlights
- Custom template sections (if used in Granola)
- Full transcript (optional)
- Links to attachments

## Troubleshooting

**"Failed to connect"**: Make sure Granola is installed and running

**Sync is slow**: Turn off Debug Mode in settings

**Conflicts**: The plugin will ask what to do - your edits are always protected

**Need help?**: Enable Debug Mode and check the console (Cmd/Ctrl + Shift + I)

## Privacy & Security

- Your API key stays on your device
- All data transfers are encrypted
- No third-party services involved
- Open source for transparency

## Support

- **Issues**: [GitHub Issues](https://github.com/joshroman/obsidian-granola-sync/issues)
- **Questions**: [GitHub Discussions](https://github.com/joshroman/obsidian-granola-sync/discussions)

## License

MIT License - see [LICENSE](LICENSE)

---

Made with ❤️ for the Obsidian community