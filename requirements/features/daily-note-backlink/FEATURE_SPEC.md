# Feature: Daily Note Backlink Integration

## Overview
- **Phase**: v1.1 (Version 1.1: Daily Note Integration)
- **Priority**: P1 (High)
- **Estimated Effort**: 3-5 days
- **Primary Persona**: Knowledge Worker (with secondary support for Consultant and Second Brain Builder)

## User Stories & Acceptance Criteria

### Primary User Story
As a Knowledge Worker, I want my meeting notes to have structured frontmatter that enables Dataview/Templater queries so that my daily notes can automatically display all meetings for each day.

**Acceptance Criteria**:
- [ ] Meeting notes include frontmatter with `type: meeting` for Dataview filtering
- [ ] Date field uses YYYY-MM-DD format (not ISO string) for daily note queries
- [ ] Time field shows meeting start time in HH:mm 24-hour format
- [ ] Daily-note field contains wikilink to corresponding daily note `[[YYYY-MM-DD]]`
- [ ] Attendees and duration fields are preserved from existing implementation
- [ ] Tags field is removed from frontmatter (user request)
- [ ] All new meetings get the enhanced frontmatter automatically
- [ ] Existing meetings are NOT modified (no backwards compatibility required)

### Secondary User Stories

**As a Consultant**, I want to query meetings by date and attendees so that I can track billable time per client.
- [ ] Attendees field remains as YAML array for easy querying
- [ ] Duration field enables time tracking calculations

**As a Second Brain Builder**, I want standardized metadata across all meeting notes so that I can build complex queries and automations.
- [ ] Consistent frontmatter structure across all new meetings
- [ ] Compatible with standard Obsidian plugin ecosystem (Dataview, Templater)

### Edge Cases & Error Handling

1. **Scenario**: Meeting has no attendees
   - **Handling**: Include empty attendees array `attendees: []`
   - **User Experience**: Dataview queries handle empty arrays gracefully

2. **Scenario**: Meeting has no duration data
   - **Handling**: Omit duration field entirely (not `duration: null`)
   - **User Experience**: Dataview queries can filter by presence of duration

3. **Scenario**: Meeting title contains YAML-breaking characters
   - **Handling**: Use existing `escapeYaml()` method for safe YAML
   - **User Experience**: Titles display correctly in queries

4. **Scenario**: Meeting date spans timezone boundaries
   - **Handling**: Use meeting date as provided by Granola API
   - **User Experience**: Consistent with user's expected meeting date

## Technical Specification

### Frontmatter Schema
```yaml
---
# Core meeting metadata (enhanced for daily note integration)
granolaId: "meeting-id-from-granola"
title: "Meeting Title"
date: "YYYY-MM-DD"          # Changed from ISO string
time: "HH:mm"               # New field: 24-hour format
type: "meeting"             # New field: for Dataview filtering
duration: 60                # Existing: minutes (optional)

# Daily note integration
daily-note: "[[YYYY-MM-DD]]"  # New field: wikilink to daily note

# Existing fields (preserved)
attendees:                  # Existing: YAML array
  - "Attendee Name"
  - "Another Attendee"

# Removed fields
# tags: []                  # Removed per user request
---
```

### Data Model Updates
```typescript
// No changes to Meeting interface required
// All fields already exist or can be derived

interface FrontmatterData {
  granolaId: string;
  title: string;
  date: string;           // Format: YYYY-MM-DD
  time: string;           // Format: HH:mm
  type: "meeting";
  duration?: number;      // Optional: minutes
  "daily-note": string;   // Format: [[YYYY-MM-DD]]
  attendees: string[];
  // tags removed
}
```

### Implementation Points

**Modified Components**:
- `src/utils/markdown-builder.ts` - Update `buildDefaultContent()` method
- Add date/time formatting utilities

**Dependencies**: 
- Existing `moment` library for date formatting
- Existing `escapeYaml()` method for safe YAML output

**Settings Integration**:
- No new settings required - this becomes the default frontmatter format
- Existing meetings are NOT retroactively updated

## Testing Strategy

### E2E Test Scenarios (WebdriverIO)

1. **Happy Path Test - New Meeting Sync**
   ```typescript
   test('New meetings get enhanced frontmatter for daily note integration', async () => {
     // Arrange: Mock a meeting from Granola
     const testMeeting = {
       id: 'test-meeting-123',
       title: 'Daily Standup',
       date: new Date('2024-01-15T10:00:00Z'),
       attendees: ['Alice', 'Bob'],
       duration: 30
     };
     
     // Act: Sync the meeting
     await TestUtils.mockGranolaAPI([testMeeting]);
     await TestUtils.performSync();
     
     // Assert: Check frontmatter format
     const noteContent = await TestUtils.readMeetingNote('Daily Standup - 2024-01-15');
     expect(noteContent).toContain('date: "2024-01-15"');
     expect(noteContent).toContain('time: "10:00"');
     expect(noteContent).toContain('type: "meeting"');
     expect(noteContent).toContain('daily-note: "[[2024-01-15]]"');
     expect(noteContent).toContain('duration: 30');
     expect(noteContent).not.toContain('tags:');
   });
   ```

2. **Edge Case Test - Meeting Without Duration**
   ```typescript
   test('Meetings without duration omit field from frontmatter', async () => {
     const meetingNoDuration = {
       id: 'test-meeting-no-duration',
       title: 'Quick Check-in',
       date: new Date('2024-01-15T14:00:00Z'),
       attendees: ['Charlie']
       // duration: undefined
     };
     
     await TestUtils.mockGranolaAPI([meetingNoDuration]);
     await TestUtils.performSync();
     
     const noteContent = await TestUtils.readMeetingNote('Quick Check-in - 2024-01-15');
     expect(noteContent).not.toContain('duration:');
   });
   ```

3. **Integration Test - Dataview Query Compatibility**
   ```typescript
   test('Enhanced frontmatter works with Dataview queries', async () => {
     // Sync multiple meetings for same day
     const meetings = [
       { /* meeting 1 at 09:00 */ },
       { /* meeting 2 at 14:00 */ }
     ];
     
     await TestUtils.mockGranolaAPI(meetings);
     await TestUtils.performSync();
     
     // Test Dataview query execution
     const queryResult = await browser.execute(() => {
       // @ts-ignore
       const dv = window.app.plugins.plugins.dataview?.api;
       if (!dv) return { error: 'Dataview not available' };
       
       return dv.pages('"Meetings"')
         .where(p => p.date === '2024-01-15' && p.type === 'meeting')
         .sort(p => p.time)
         .array();
     });
     
     expect(queryResult.length).toBe(2);
     expect(queryResult[0].time).toBe('09:00');
     expect(queryResult[1].time).toBe('14:00');
   });
   ```

4. **Visual Regression Test**
   ```typescript
   test('Meeting notes maintain visual formatting', async () => {
     await TestUtils.syncSampleMeeting();
     await browser.saveScreenshot('./test-screenshots/enhanced-frontmatter-note.png');
     // Compare with baseline screenshot
   });
   ```

### Performance Benchmarks
- **Frontmatter Generation**: < 1ms per meeting (negligible overhead)
- **Sync Performance**: No impact on existing sync benchmarks
- **Memory Usage**: No additional memory requirements

## Implementation Plan

### Day 1: Setup & Analysis
- [ ] Create feature branch `feature/daily-note-backlink`
- [ ] Write comprehensive E2E tests following TDD approach
- [ ] Document current frontmatter format vs. target format
- [ ] Plan markdown-builder.ts modifications

### Day 2-3: Core Implementation
- [ ] Modify `buildDefaultContent()` in markdown-builder.ts
- [ ] Update frontmatter generation logic:
  - Change date format from ISO to YYYY-MM-DD
  - Add time field (HH:mm format)
  - Add type: meeting field
  - Add daily-note wikilink
  - Remove tags field
- [ ] Add date/time formatting utilities
- [ ] Preserve existing granolaId, title, attendees, duration

### Day 4: Testing & Integration
- [ ] Run all E2E tests and ensure 100% pass rate
- [ ] Test with sample Dataview queries
- [ ] Verify no regression in existing sync functionality
- [ ] Test edge cases (no duration, special characters, etc.)

### Day 5: Polish & Documentation
- [ ] Performance testing with large meeting volumes
- [ ] Update user documentation with Dataview query examples
- [ ] Prepare user communication about Dataview/Templater prerequisites

## Success Metrics

### Technical Success
- [ ] All E2E tests passing (100% pass rate)
- [ ] No performance regression in sync operations
- [ ] Enhanced frontmatter validates as proper YAML
- [ ] Compatible with Dataview and Templater plugins

### User Success
- [ ] Users can query meetings by date with simple Dataview syntax
- [ ] Daily notes automatically populate with meeting data via queries
- [ ] Zero manual intervention required for meeting data in daily notes

### Business Success
- [ ] Feature enables "wow moment" user experience
- [ ] Positions plugin as essential for knowledge workers
- [ ] Creates foundation for future query-based features

## Integration Examples

### Sample Daily Note Template with Dataview
```markdown
# {{date:YYYY-MM-DD}}

## Meetings
```dataview
TABLE time as "Time", title as "Meeting", attendees as "Attendees"
FROM "Meetings"
WHERE date = this.file.name AND type = "meeting"
SORT time
```

## Tasks
- [ ] 

## Notes

```

### Sample Templater Integration
```javascript
// In daily note template
<%*
const meetings = dv.pages('"Meetings"')
  .where(p => p.date === tp.file.title && p.type === 'meeting')
  .sort(p => p.time);

if (meetings.length > 0) {
  tR += "## Meetings Today\n\n";
  meetings.forEach(meeting => {
    tR += `- ${meeting.time} [[${meeting.file.name}|${meeting.title}]]\n`;
  });
}
%>
```

## Open Questions

✅ **Resolved Questions**:
- Frontmatter format confirmed
- No backwards compatibility needed
- Tags field removal confirmed
- Static values (not Templater syntax) confirmed
- Prerequisites (Dataview/Templater) acknowledged

**No remaining open questions** - specification is complete and ready for implementation.

## Dependencies & Prerequisites

### For Plugin Development
- Existing `moment` library for date formatting
- Existing YAML escaping utilities
- Current markdown-builder.ts structure

### For End Users
- **Required**: Dataview OR Templater plugin installed
- **Required**: Basic understanding of daily note templates
- **Optional**: Custom daily note folder structure

## Backward Compatibility

**No backward compatibility provided** - this is new functionality for meetings synced after implementation. Existing meeting notes retain their current frontmatter format and are not modified.