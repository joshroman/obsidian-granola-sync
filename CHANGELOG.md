# Changelog

All notable changes to the Obsidian Granola Sync plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-03-20

### Added
- Initial release of Obsidian Granola Sync
- **Core Features**:
  - Sync all Granola meetings to Obsidian vault
  - Incremental sync support (only new/updated meetings)
  - API key authentication with connection validation
  - Progress tracking with time estimates

- **Organization Options**:
  - Flat folder structure
  - Date-based organization (daily/weekly)
  - Mirror Granola folder structure
  - Customizable file naming with date formats

- **Conflict Resolution**:
  - Detection of 6 conflict types
  - Interactive conflict resolution UI
  - Backup options for local changes
  - Content merging capabilities

- **Performance**:
  - Adaptive batch processing
  - Memory-efficient streaming for large datasets
  - Support for 1000+ meeting libraries
  - Automatic recovery from interrupted syncs

- **User Interface**:
  - Setup wizard for easy onboarding
  - Real-time sync progress modal
  - Detailed error notifications
  - Settings tab with all configuration options

- **Developer Features**:
  - Comprehensive test suite (74 tests)
  - Structured logging system
  - Performance monitoring
  - Error tracking and reporting
  - CI/CD with GitHub Actions

### Security
- API keys stored locally in vault
- Input validation and sanitization
- No third-party data transmission

### Known Issues
- Performance tests may timeout on slower systems
- Large transcripts (>10MB) may cause slowdowns

## [0.0.1] - 2024-03-01

### Added
- Proof of concept plugin structure
- Basic Obsidian plugin functionality
- Test command and ribbon icon