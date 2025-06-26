# Feature Parity Implementation Plan

## Overview

This plan outlines the implementation steps to achieve feature parity between the Obsidian Granola Sync plugin and the granola-automation-client, specifically focusing on complete note synchronization including panels/templates and full transcripts.

## End-to-End Success Criteria

The implementation will be considered complete when all the following E2E tests pass:

1. **Panel/Template Content Test**: Meetings with panels (e.g., Josh Template) sync with all structured content sections (Introduction, Agenda Items, Key Decisions, Action Items, etc.)
2. **Full Transcript Test**: Meetings sync with complete transcripts including speaker identification (Me/Them) and proper grouping
3. **Complete Document Fields Test**: All available document fields (overview, notes, notes_plain, notes_markdown) are extracted and included
4. **Graceful Degradation Test**: Meetings without panels or transcripts sync successfully without empty sections

## Phase 1: Panel/Template Support

### Objective
Add support for fetching and processing document panels (templates) from the Granola API.

### Detailed Tasks

1. **Create Panel Type Definitions** 
   - [ ] Add `DocumentPanel` interface in `src/types/index.ts`
   - [ ] Add `DocumentPanelsResponse` type for API response
   - [ ] Add `PanelContent` type for structured panel data
   - [ ] Update `Meeting` interface to include `panels?: DocumentPanel[]`

2. **Extend EnhancedGranolaService**
   - [ ] Add `getDocumentPanels(documentId: string): Promise<DocumentPanel[]>` method
   - [ ] Implement error handling for panel API calls
   - [ ] Add panel caching to reduce API calls
   - [ ] Test panel fetching with real API

3. **Create Panel Processing Service**
   - [ ] Create `src/services/panel-processor.ts`
   - [ ] Implement `extractStructuredContent(panel: DocumentPanel): Record<string, string>`
   - [ ] Add HTML to markdown conversion for panel content
   - [ ] Handle different panel types (Josh Template, Summary, etc.)

4. **Update Sync Engine**
   - [ ] Modify `syncMeeting` to fetch panels for each document
   - [ ] Pass panels to markdown builder
   - [ ] Handle panel fetch failures gracefully

5. **Enhance MarkdownBuilder**
   - [ ] Add `buildPanelSections(panels: DocumentPanel[]): string` method
   - [ ] Format each panel as a markdown section
   - [ ] Include panel content in the final markdown output
   - [ ] Ensure proper markdown formatting for lists, headings, etc.

6. **Update Meeting Transformer**
   - [ ] Modify `transformMeeting` to include panel data
   - [ ] Map panel content to appropriate meeting fields

### Success Criteria
- Panels are fetched successfully from the API
- Panel content appears in synced markdown files
- Structured content (Josh Template) is properly formatted
- No empty panel sections in output

## Phase 2: Full Transcript Support

### Objective
Implement complete transcript processing with speaker identification, deduplication, and proper formatting.

### Detailed Tasks

1. **Create Transcript Types**
   - [ ] Add `TranscriptSegmentWithSpeaker` interface
   - [ ] Add `EnhancedTranscript` type
   - [ ] Update `Meeting` interface for enhanced transcript

2. **Create Transcript Processor Service**
   - [ ] Create `src/services/transcript-processor.ts`
   - [ ] Port `calculateTextSimilarity` algorithm
   - [ ] Implement `deduplicateSegments` method
   - [ ] Add `improveSpeakerAssignment` logic
   - [ ] Create `formatTranscriptMarkdown` method

3. **Extend EnhancedGranolaService**
   - [ ] Add `getDocumentTranscriptWithSpeakers` method
   - [ ] Integrate transcript processor
   - [ ] Handle transcript API responses properly

4. **Update Sync Engine**
   - [ ] Fetch and process transcripts for each meeting
   - [ ] Pass enhanced transcript to markdown builder

5. **Update MarkdownBuilder**
   - [ ] Add transcript formatting with grouped speakers
   - [ ] Ensure proper markdown formatting
   - [ ] Handle empty transcripts gracefully

### Success Criteria
- Transcripts show speaker identification (Me/Them)
- Duplicate segments are removed
- Speakers are grouped in blocks, not line-by-line
- Transcript markdown is clean and readable

## Phase 3: Extract All Document Fields

### Objective
Ensure all available document data is extracted and included in synced notes.

### Detailed Tasks

1. **Update Document Types**
   - [ ] Add missing fields to document interface
   - [ ] Include notes, notes_plain, notes_markdown, overview

2. **Enhance transformMeeting Method**
   - [ ] Extract all available fields from API response
   - [ ] Map fields appropriately to Meeting interface
   - [ ] Handle missing fields gracefully

3. **Update MarkdownBuilder**
   - [ ] Add sections for overview if present
   - [ ] Include notes content appropriately
   - [ ] Ensure no duplicate content
   - [ ] Format all fields properly

4. **Improve Metadata Extraction**
   - [ ] Extract all attendee information
   - [ ] Include meeting duration calculation
   - [ ] Add any additional metadata fields

### Success Criteria
- All available document fields appear in markdown
- No data is lost during transformation
- Markdown structure is logical and complete
- Graceful handling of missing fields

## Implementation Timeline

1. **Phase 1**: 2-3 days
   - Day 1: Type definitions and API integration
   - Day 2: Panel processing and markdown generation
   - Day 3: Testing and refinement

2. **Phase 2**: 2-3 days
   - Day 1: Transcript processor implementation
   - Day 2: Speaker identification and deduplication
   - Day 3: Integration and testing

3. **Phase 3**: 1-2 days
   - Day 1: Field extraction and mapping
   - Day 2: Testing and polish

## Review Process

After each phase:
1. Run E2E tests to verify functionality
2. Submit code for review to o3 and Gemini models
3. Address feedback and suggestions
4. Ensure all tests pass before moving to next phase

## Risk Mitigation

1. **API Changes**: Use defensive coding and null checks
2. **Performance**: Implement caching and batch processing
3. **Data Loss**: Always preserve original data, enhance don't replace
4. **Backward Compatibility**: Ensure existing syncs continue to work