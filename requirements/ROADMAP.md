# Product Roadmap - Obsidian Granola Sync

## Overview

### Current Status
- **Version**: v0.9 (pre-release)
- **Development Philosophy**: Ship solid, well-tested features, then gather user feedback
- **Success Criteria**: Reliable sync with zero UI conflicts
- **Target Users**: Knowledge workers using both Granola and Obsidian

### Roadmap Approach
This roadmap focuses on achieving a stable v1.0 release, adding one high-value feature in v1.1, then pausing for community feedback. No v2.0 is planned at this time.

## Version 1.0: Production Ready

**Timeline**: 1-2 days  
**Goal**: Fix critical CSS isolation issues for stable public release

### Features

#### 1. CSS Scoping Fixes
**Priority**: P0 (Critical)

**Description**: Apply the corrected CSS from `styles-fixed.css` to prevent the plugin's styles from interfering with Obsidian's file explorer and other UI elements.

**User Stories**:
- As a user, I want the plugin to not affect Obsidian's file explorer so that files don't disappear when I resize panes
- As a user, I want all plugin UI elements properly styled without breaking other parts of Obsidian

**Acceptance Criteria**:
- [ ] All `.button-container` selectors properly scoped to plugin classes
- [ ] No generic `.notice` animations affecting Obsidian notifications
- [ ] File explorer remains functional during and after sync
- [ ] All plugin modals display correctly without global CSS leaks
- [ ] E2E test passes for CSS isolation (`css-file-explorer-bug.spec.ts`)

**Dependencies**: None

**Risks**: 
- Low risk - fixes already identified and tested
- Main risk is ensuring complete coverage of all selectors

**Test Scenarios**:
1. Sync meetings and verify file explorer remains stable
2. Open all plugin modals and check styling
3. Resize Obsidian panes during sync
4. Verify no visual glitches in core Obsidian UI

## Version 1.1: Daily Note Integration

**Timeline**: 3-5 days  
**Goal**: Enable automatic backlinking from daily notes to meetings

### Features

#### 1. Daily Note Backlinking
**Priority**: P1 (High)

**Description**: Automatically create backlinks from daily notes to any meetings that occurred on that day. This feature will check if a daily note exists for a meeting's date and update it with a link to the meeting note.

**User Stories**:
- As a Knowledge Worker, I want my daily notes to automatically show all meetings from that day so that I have a complete daily record
- As a Consultant, I want to see all client meetings in my daily note so that I can track billable time
- As a user, I want meeting links added to existing daily notes without overwriting my content

**Acceptance Criteria**:
- [ ] When syncing a meeting, check if daily note exists for that date
- [ ] If daily note exists, add meeting link without disrupting existing content
- [ ] If daily note doesn't exist, optionally create it (based on user setting)
- [ ] Links use meeting title and time (e.g., `- 10:00 AM [[Team Standup - 2024-01-15]]`)
- [ ] Support multiple daily note formats (configurable date format)
- [ ] Handle timezone correctly for meeting dates
- [ ] Never duplicate links if sync runs multiple times
- [ ] Preserve daily note organization (append to specific section if configured)

**Implementation Details**:
- Use the existing `date` property in frontmatter (format: MM/DD/YYYY)
- Leverage Obsidian's Daily Notes plugin API if available
- Support custom daily note locations and naming patterns
- Add configuration options in settings:
  - Enable/disable daily note linking
  - Daily note date format
  - Section to append links (e.g., "## Meetings")
  - Create daily note if missing (yes/no)

**Dependencies**: 
- Obsidian Daily Notes plugin (optional but recommended)
- Existing date metadata in meeting notes

**Risks**:
- Medium complexity due to various daily note formats
- Need to handle edge cases (missing daily notes, custom formats)
- Must not corrupt existing daily note content

**Test Scenarios**:
1. Sync meeting with existing daily note - verify link added
2. Sync meeting without daily note - verify behavior based on settings
3. Re-sync same meeting - verify no duplicate links
4. Sync multiple meetings on same day - verify all appear
5. Test with different daily note formats and locations
6. Test timezone edge cases (meetings near midnight)
7. Test with daily note containing existing content

**E2E Test Requirements**:
```typescript
describe('Daily Note Backlinking', () => {
  it('should add meeting links to existing daily notes', async () => {
    // Create daily note with content
    // Sync meeting for that date
    // Verify link added without disrupting content
  });
  
  it('should handle multiple meetings on same day', async () => {
    // Sync several meetings
    // Verify all appear in chronological order
  });
  
  it('should not duplicate links on re-sync', async () => {
    // Sync meeting twice
    // Verify only one link exists
  });
});
```

## Future Roadmap (User Feedback Driven)

**Timeline**: Post v1.1  
**Approach**: Gather community feedback before committing to new features

### Monitoring Areas

#### 1. Official Granola API
- **What**: Transition from unofficial to official API when available
- **Why**: Better stability and support
- **How**: Implement adapter pattern for seamless migration

#### 2. Platform Expansion
- **What**: Windows and Linux support
- **Why**: Broader user base
- **How**: Set up CI/CD for cross-platform testing

#### 3. Advanced Organization
- **What**: Mirror Granola's folder structure
- **Why**: Requested by users with complex organization
- **How**: Requires API support for folder hierarchy

#### 4. Performance Optimizations
- **What**: Faster sync for very large vaults (5000+ meetings)
- **Why**: Scale for power users
- **How**: Implement progressive sync strategies

#### 5. Two-way Sync Exploration
- **What**: Changes in Obsidian sync back to Granola
- **Why**: True bidirectional workflow
- **How**: Requires official API support

### User Feedback Channels
1. GitHub Issues
2. Obsidian Forum plugin thread
3. Direct user interviews
4. Usage analytics (privacy-preserving)

## Development Principles

### Quality Standards
1. **Test-Driven Development**: Write E2E tests before implementing features
2. **CI/CD Sync**: Wait for GitHub Actions success before continuing development
3. **Incremental Delivery**: Ship small, valuable improvements
4. **User-Centric**: Gather feedback before adding complexity

### Release Process
1. **Version 1.0**:
   - Apply CSS fixes
   - Run full E2E test suite
   - Submit to Obsidian Community Plugins
   - Announce in forum

2. **Version 1.1**:
   - Implement daily note backlinking
   - Beta test with power users
   - Gather feedback on implementation
   - Polish based on feedback
   - Release to community

### Success Metrics

#### Version 1.0
- Zero CSS-related bug reports
- Successful submission to Community Plugins
- Positive initial user feedback

#### Version 1.1
- 80%+ of users enable daily note backlinking
- Daily note feature "just works" without configuration
- Feature request: "This is exactly what I needed!"

#### Overall
- 4.5+ star rating in Community Plugins
- Active user growth month-over-month
- Low bug report rate (<1% of users)

## Risk Mitigation

### Technical Risks
1. **CSS Regression**: Comprehensive E2E tests, visual regression testing
2. **Daily Note Corruption**: Extensive edge case testing, backup before modification
3. **API Changes**: Monitor Granola updates, quick patch process

### User Experience Risks
1. **Feature Complexity**: Default settings that work for 90% of users
2. **Performance Impact**: Benchmark tests, optimization as needed
3. **Breaking Changes**: Careful migration paths, clear communication

## References
- Goals and success metrics from [PRODUCT_REQUIREMENTS.md](PRODUCT_REQUIREMENTS.md)
- Technical implementation constraints from [TECHNICAL_SPECS.md](TECHNICAL_SPECS.md)
- Current development status from [CLAUDE.md](../CLAUDE.md)