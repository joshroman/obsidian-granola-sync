# Obsidian Granola Sync

Seamlessly sync your Granola meeting notes to Obsidian, keeping all your meeting insights organized and accessible in your personal knowledge base.

> ⚠️ **Important Disclaimers:**
> - This is an **UNOFFICIAL** plugin not affiliated with or endorsed by Granola
> - Uses undocumented APIs that **may break without warning** when Granola updates
> - Currently only tested on **macOS** - Windows/Linux compatibility is unknown
> - Your API key is stored locally in your vault (never transmitted to third parties)

## Features

### 🔄 **Automatic Synchronization**
- Sync all your Granola meetings to your Obsidian vault
- Configurable automatic sync intervals (5 min to 1 hour)
- Incremental sync - only fetches new and updated meetings
- Progress tracking with time estimates

### 📁 **Flexible Organization**
- **Flat structure**: All notes in one folder
- **Date-based**: Organize by daily or weekly folders
- **Mirror Granola**: Maintain your existing Granola folder structure
- Customizable file naming with date formats

### ⚡ **Performance & Reliability**
- Optimized for large meeting libraries (1000+ meetings)
- Adaptive batch processing for optimal performance
- Memory-efficient streaming for large datasets
- Automatic recovery from interrupted syncs
- Comprehensive error handling and retry logic

### 🛡️ **Data Integrity**
- Conflict detection and resolution
- User modifications are never overwritten without consent
- Backup options for important changes
- Content validation and sanitization
- State management with transaction support

### 🎨 **User Experience**
- Setup wizard for easy onboarding
- Real-time sync progress with statistics
- Detailed error notifications with actions
- Debug mode for troubleshooting
- Comprehensive logging system

## Installation

### From Obsidian Community Plugins (Recommended)
1. Open Obsidian Settings
2. Navigate to Community Plugins and disable Safe Mode
3. Click Browse and search for "Granola Sync"
4. Click Install, then Enable

### Manual Installation
1. Download the latest release from [GitHub Releases](https://github.com/joshroman/obsidian-granola-sync/releases)
2. Extract the files to your vault's `.obsidian/plugins/obsidian-granola-sync/` folder
3. Reload Obsidian
4. Enable the plugin in Settings > Community Plugins

## Getting Started

### Initial Setup
1. After enabling the plugin, you'll see the setup wizard
2. Enter your Granola API key (found in your [Granola settings](https://app.granola.so/settings))
3. Choose where to store your meeting notes
4. Select your preferred organization method
5. Configure sync preferences
6. Click "Start Syncing" to begin!

### Finding Your API Key
1. Log in to [Granola](https://app.granola.so)
2. Navigate to Settings > API
3. Copy your API key
4. Paste it in the plugin settings

## Configuration

### Basic Settings

| Setting | Description | Default |
|---------|-------------|---------|
| API Key | Your Granola API key | Required |
| Target Folder | Where to store meeting notes | "Meetings" |
| Folder Organization | How to organize notes | Flat |
| Include Date in Filename | Add meeting date to filename | Yes |
| Date Format | Format for dates in filenames | yyyy-MM-dd |

### Advanced Settings

| Setting | Description | Default |
|---------|-------------|---------|
| Auto Sync | Enable automatic synchronization | No |
| Sync Interval | How often to check for new meetings | 15 minutes |
| Show Progress | Display detailed sync progress | Yes |
| Debug Mode | Enable detailed logging | No |
| Log Level | Verbosity of logs (error/warn/info/debug) | error |

### Folder Organization Options

#### Flat Structure (Default)
```
Meetings/
├── 2024-03-20 Team Standup.md
├── 2024-03-21 Client Meeting.md
└── 2024-03-22 Project Review.md
```

#### Date-Based Organization
Daily folders:
```
Meetings/
├── 2024-03-20/
│   ├── Team Standup.md
│   └── Client Meeting.md
└── 2024-03-21/
    └── Project Review.md
```

Weekly folders:
```
Meetings/
├── 2024-W12/
│   ├── Team Standup.md
│   └── Client Meeting.md
└── 2024-W13/
    └── Project Review.md
```

#### Mirror Granola Structure
```
Meetings/
├── Work/
│   ├── Team Standup.md
│   └── Project Review.md
└── Personal/
    └── Doctor Appointment.md
```

## Meeting Note Format

Each synced meeting note includes:

### Frontmatter
```yaml
---
granolaId: meeting-123
title: Team Standup
date: 2024-03-20T10:00:00Z
duration: 30
attendees:
  - John Doe
  - Jane Smith
tags:
  - standup
  - team
---
```

### Content Structure
1. **Summary**: AI-generated meeting summary
2. **Highlights**: Key points and decisions
3. **Transcript**: Full meeting transcript (if available)
4. **Attendees**: List of participants
5. **Attachments**: Links to related documents

## Conflict Resolution

The plugin detects and handles various conflict scenarios:

### Conflict Types
1. **User Modified**: You've edited the local note
2. **Both Modified**: Changes in both Granola and local
3. **File Missing**: Note deleted locally but updated in Granola
4. **Duplicate ID**: Multiple files for the same meeting
5. **Path Conflict**: File would overwrite existing non-meeting note

### Resolution Options
- **Keep Local**: Preserve your changes
- **Keep Remote**: Use Granola's version
- **Merge**: Attempt to combine changes
- **Backup & Update**: Save local version before updating
- **Skip**: Leave unchanged

## Performance Optimization

### Large Meeting Libraries
- Automatic batch size adjustment based on performance
- Memory usage monitoring and throttling
- Streaming API support for datasets > 1000 meetings
- Progress saving for resumable syncs

### Best Practices
1. Run initial sync during off-hours for large libraries
2. Enable auto-sync for incremental updates
3. Use date-based organization for better performance
4. Keep debug mode off unless troubleshooting

## Troubleshooting

### Common Issues

#### "Failed to connect to Granola"
- Verify your API key is correct
- Check your internet connection
- Ensure Granola services are operational

#### "Path exists but is not a file"
- Check for folders with the same name as expected files
- Verify folder organization settings
- Use the conflict resolution dialog

#### Sync seems slow
- Check Settings > Debug Mode is OFF
- Reduce sync interval if auto-sync is enabled
- Consider date-based organization for large vaults

### Debug Information
Enable debug mode in settings to see detailed logs:
1. Settings > Granola Sync > Debug Mode
2. Open Developer Console (Ctrl/Cmd + Shift + I)
3. Look for entries starting with `[Granola Sync]`

### File Explorer Display Issues
If your file explorer shows folders/files in a grid layout instead of a list:
- This is caused by themes or other plugins modifying the file explorer CSS
- Use the CSS snippet in `troubleshooting/file-explorer-fixes/file-explorer-layout-fix-granola.css` to fix this issue

## Security & Privacy

- API keys are stored locally in your vault
- All communication uses HTTPS
- No data is sent to third parties
- Meeting content remains private
- Open source for transparency

## Development

### Building from Source
```bash
# Clone the repository
git clone https://github.com/joshroman/obsidian-granola-sync.git
cd obsidian-granola-sync

# Install dependencies
npm install

# Build the plugin
npm run build

# Run tests
npm test
```

### Contributing
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Support

- **Issues**: [GitHub Issues](https://github.com/joshroman/obsidian-granola-sync/issues)
- **Discussions**: [GitHub Discussions](https://github.com/joshroman/obsidian-granola-sync/discussions)
- **Documentation**: [Wiki](https://github.com/joshroman/obsidian-granola-sync/wiki)

## Version History

### v1.0.0 (2024-03-20)
- Initial release with full Granola sync functionality
- Support for multiple folder organization methods
- Conflict detection and resolution
- Performance optimized for large meeting libraries
- Comprehensive test coverage

## License

MIT License - see [LICENSE](LICENSE) file for details

## Acknowledgments

- [Obsidian](https://obsidian.md) for the amazing knowledge base
- [Granola](https://granola.so) for AI-powered meeting notes
- The Obsidian community for feedback and support

---

Made with ❤️ for the Obsidian community