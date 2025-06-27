# Setup Wizard Features

The Granola Sync plugin setup wizard is fully configured with the following features:

## 1. Automatic Connection (No Manual API Key)
- Auto-detects Granola installation
- Retrieves API token automatically from local Granola app
- No manual API key entry required
- Shows connection status and Granola version

## 2. Meeting Folder Configuration
- **Custom folder naming**: Users can specify any folder name (e.g., "Meetings", "Work/Meetings", "Notes/Granola")
- **Live preview**: Shows how the folder will appear in the vault structure
- **Validation**: Ensures folder names are valid

## 3. Folder Organization Options
Users can choose from three organization styles:

### Flat Structure (Default)
```
📁 Meetings
  📄 2024-03-20 Team Meeting.md
  📄 2024-03-21 Client Call.md
  📄 2024-03-22 Project Review.md
```

### Organized by Date
```
📁 Meetings
  📁 2024-03-20
    📄 Team Meeting.md
    📄 Client Call.md
  📁 2024-03-21
    📄 Project Review.md
```

### Mirror Granola Folders
```
📁 Meetings
  📁 Work
    📄 Team Meeting.md
  📁 Personal
    📄 Doctor Appointment.md
```

## 4. File Naming Options
- **Date inclusion toggle**: Choose whether to include dates in filenames
- **Multiple date formats**:
  - `yyyy-MM-dd` → "2024-03-20 Meeting.md"
  - `dd-MM-yyyy` → "20-03-2024 Meeting.md"
  - `MM-dd-yyyy` → "03-20-2024 Meeting.md"
  - `yyyy.MM.dd` → "2024.03.20 Meeting.md"
- **Live preview**: Shows example filenames based on settings

## 5. Sync Settings
- **Auto-sync toggle**: Enable/disable automatic synchronization
- **Sync intervals**:
  - Every 5 minutes
  - Every 15 minutes (default)
  - Every 30 minutes
  - Every hour
- **Progress display**: Toggle detailed sync progress
- **Debug mode**: Enable verbose logging for troubleshooting

## 6. User Experience Features
- **Step-by-step navigation**: Clear progression through setup
- **Progress indicator**: Visual progress bar and step counter
- **Back navigation**: Ability to go back and change settings
- **Skip options**: Can skip optional configuration steps
- **Live previews**: See the effect of settings in real-time
- **Validation**: Ensures all required fields are properly configured

## 7. Setup Summary
- Final review of all settings before starting sync
- Clear indication of what will happen
- One-click start to begin syncing

The wizard provides a smooth, user-friendly experience that guides users through all configuration options while maintaining flexibility for different organizational preferences.