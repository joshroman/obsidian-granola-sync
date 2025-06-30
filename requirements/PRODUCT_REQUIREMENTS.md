# Product Requirements Document - Obsidian Granola Sync

## Executive Summary

### Problem Statement
Knowledge workers who use Granola for AI-powered meeting transcription and Obsidian for personal knowledge management face a significant workflow gap. Their valuable meeting insights remain siloed in Granola, disconnected from their broader knowledge graph in Obsidian. This separation forces manual copy-paste workflows, reduces the discoverability of meeting insights, and prevents users from building comprehensive, interconnected knowledge bases.

### Solution Overview
Obsidian Granola Sync is an open-source plugin that automatically synchronizes meeting notes from Granola to Obsidian vaults. It provides configurable organization options, preserves meeting metadata, and ensures data integrity while respecting user privacy and local-first principles.

### Target Market
Individual knowledge workers, consultants, researchers, and productivity enthusiasts who:
- Use both Granola and Obsidian in their daily workflow
- Value unified knowledge management
- Prioritize data privacy and local storage
- Seek automation to reduce manual work

### Success Metrics
- **Reliability**: 99%+ successful sync operations
- **Performance**: Sync 1000+ meetings efficiently
- **User Satisfaction**: Positive community feedback and high plugin ratings
- **Feature Completeness**: Core sync, organization, and conflict resolution capabilities

## Product Vision

### Mission Statement
"Seamlessly sync all your Granola meeting notes to Obsidian for unified knowledge management"

### Long-term Vision
Become the standard bridge between AI-powered meeting tools and personal knowledge management systems, setting the bar for:
- Privacy-respecting integrations
- User-configurable workflows
- Reliable background synchronization
- Intelligent conflict resolution

### Key Differentiation
1. **First-Mover Advantage**: First solution addressing this specific workflow gap
2. **Privacy-Focused**: All data stays local, no third-party servers
3. **Highly Configurable**: Multiple organization methods and sync options
4. **Open Source**: Transparent, auditable, and community-driven
5. **User-Centric Design**: Never overwrites user modifications without consent

## User Personas

### Primary Persona: "The Knowledge Worker" (Sarah)
**Background**
- Remote product manager, 32 years old
- Attends 15-20 meetings per week
- Uses Obsidian for project documentation and personal notes
- Tech-savvy, comfortable with plugins

**Pain Points**
- Meeting notes scattered between Granola and Obsidian
- Can't link meeting decisions to project documentation
- Manual copy-paste takes 30+ minutes daily
- Loses context when switching between apps
- Difficult to find past meeting decisions

**Current Workflow**
1. Takes notes in Granola during meetings
2. Reviews and edits after meeting
3. Manually copies important sections to Obsidian
4. Creates links to related project notes
5. Often forgets to transfer some meetings

**Success Criteria**
- All meetings automatically appear in Obsidian within 5 minutes
- Can create wiki-links to meetings from project notes
- Meetings organized by date for easy browsing
- Never loses local edits

### Secondary Persona: "The Consultant" (Marcus)
**Background**
- Independent business consultant, 45 years old
- Manages 5-8 concurrent clients
- Needs organized records for compliance and billing
- Medium-high technical proficiency

**Pain Points**
- Must maintain separate meeting records per client
- Needs quick access to past decisions for reports
- Requires different organization schemes for different clients
- Worried about data mixing between clients

**Current Workflow**
1. Uses Granola for all client meetings
2. Exports important meetings to PDF
3. Manually organizes in client folders
4. Struggles to maintain consistency

**Success Criteria**
- Meetings automatically organized by client/project
- Easy to generate client reports from meeting history
- Flexible naming conventions for different clients
- Clear separation between client data

### Tertiary Persona: "The Second Brain Builder" (Alex)
**Background**
- Software engineer and productivity enthusiast, 28 years old
- Building comprehensive personal knowledge base
- Power user of both Obsidian and automation tools
- Very high technical proficiency

**Pain Points**
- Wants everything interconnected with backlinks
- Needs custom templates and formatting
- Values data ownership and portability
- Frustrated by closed ecosystems

**Current Workflow**
1. Complex Obsidian setup with plugins and templates
2. Manual integration of meeting notes
3. Custom scripts for some automation
4. Constant tweaking and optimization

**Success Criteria**
- Full control over sync behavior
- Template support for consistent formatting
- Ability to customize organization rules
- Debug mode for troubleshooting
- Can contribute improvements (open source)

## Core Features & User Stories

### 1. Automatic Synchronization
**User Story**: As a knowledge worker, I want my Granola meetings to automatically appear in Obsidian so I don't have to manually copy them.

**Acceptance Criteria**:
- Configurable sync intervals (5 min to 1 hour)
- Manual sync on demand
- Only syncs new/updated meetings (incremental)
- Shows progress with time estimates
- Handles interruptions gracefully

### 2. Flexible Organization
**User Story**: As a consultant, I want to organize my meetings by client and date so I can quickly find relevant information.

**Features**:
- Flat structure (all in one folder)
- Date-based organization (daily/weekly folders)
- Customizable file naming with date formats
- Future: Mirror Granola's folder structure

### 3. Template & Panel Support
**User Story**: As a second brain builder, I want meeting notes formatted consistently with my Obsidian templates.

**Features**:
- Preserves Granola's template panels
- Custom panels appear at note top
- Optional full transcript inclusion
- Markdown formatting preservation

### 4. Conflict Resolution
**User Story**: As a user who edits synced notes, I want my changes protected from being overwritten.

**Features**:
- Detects user modifications
- Multiple resolution options (keep local/remote/merge/backup)
- Never overwrites without consent
- Clear conflict explanations

### 5. Performance & Reliability
**User Story**: As someone with 1000+ meetings, I want sync to be fast and not freeze Obsidian.

**Features**:
- Adaptive batch processing
- Memory-efficient streaming
- Comprehensive error handling
- Automatic retry with backoff
- State recovery after crashes

## Success Metrics & KPIs

### User Metrics
- **Active Installations**: Track via Obsidian community stats
- **Sync Frequency**: Average syncs per user per week
- **Meeting Volume**: Average meetings synced per user
- **Error Rate**: Percentage of failed syncs
- **User Retention**: 30-day and 90-day retention

### Technical Metrics
- **Sync Performance**: Time to sync 100/1000 meetings
- **Memory Usage**: Peak memory during large syncs
- **API Reliability**: Uptime and response times
- **Compatibility**: Success rate across platforms

### Community Metrics
- **Plugin Rating**: Stars/rating in community plugins
- **Issue Resolution Time**: Average time to fix bugs
- **Community Contributions**: PRs and feature requests
- **Documentation Quality**: Support ticket reduction

## Technical Constraints & Assumptions

### Constraints
1. **Unofficial API**: Using undocumented Granola APIs that may change
2. **Desktop Only**: No mobile Obsidian API access
3. **Local Storage**: All data must remain on user's device
4. **Platform Testing**: Currently only tested on macOS
5. **Obsidian API Limits**: Must respect vault operation limits

### Assumptions
1. Users have active Granola and Obsidian installations
2. Users are comfortable installing community plugins
3. Granola continues to store data locally
4. Meeting volume typically under 5000 per user
5. Users want one-way sync (Granola → Obsidian)

### Dependencies
- Obsidian Plugin API stability
- Granola local data structure
- Filesystem permissions
- Network connectivity for API calls

## Roadmap & Future Considerations

### Near Term (v1.x)
- Windows and Linux testing/support
- Folder structure mirroring (when API available)
- Bulk operations UI
- Enhanced template customization

### Medium Term (v2.x)
- Official Granola API migration
- Two-way sync exploration
- Advanced filtering options
- Meeting search and preview

### Long Term
- Integration with other meeting tools
- AI-powered meeting insights
- Collaborative features
- Mobile companion app

### API Migration Strategy
When official Granola API becomes available:
1. Implement parallel API support
2. Automatic migration for existing users
3. Deprecation timeline for unofficial API
4. Feature parity verification

## Out of Scope

### Current Version
1. **Mobile Synchronization**: No mobile Obsidian plugin support
2. **Real-time Collaboration**: Not a collaborative tool
3. **Two-way Sync**: Changes in Obsidian don't sync back
4. **Meeting Creation**: Cannot create meetings from Obsidian
5. **Granola Feature Integration**: No direct Granola UI access

### Permanent Exclusions
1. **Cloud Storage**: Will not store user data on external servers
2. **Account Management**: No user accounts or authentication
3. **Paid Features**: Core functionality remains free
4. **Analytics/Tracking**: No user behavior tracking
5. **Proprietary Formats**: Markdown only, no binary formats

## Risk Mitigation

### Technical Risks
- **API Changes**: Monitor for breaks, quick patches, community communication
- **Data Loss**: Comprehensive backups, never delete source data
- **Performance Issues**: Profiling, optimization, batch size limits

### User Risks
- **Privacy Concerns**: Clear documentation, local-only guarantee
- **Learning Curve**: Setup wizard, video tutorials, templates
- **Conflicts**: Smart detection, clear UI, safe defaults

## References
- See [TECHNICAL_SPECS.md](TECHNICAL_SPECS.md) for implementation details
- See [ROADMAP.md](ROADMAP.md) for delivery timeline and feature priorities
- See [README.md](../README.md) for user documentation