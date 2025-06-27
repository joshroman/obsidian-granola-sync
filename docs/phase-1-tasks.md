# Phase 1: Panel/Template Support - Detailed Task List

## Task 1: Create Panel Type Definitions (30 mins)

1. Open `src/types/index.ts`
2. Add the following interfaces:
   ```typescript
   export interface DocumentPanel {
     id: string;
     document_id: string;
     panel_template_id: string;
     title: string;
     content: any; // ProseMirror content structure
     original_content: string; // HTML content
     generated_lines?: Array<{
       text: string;
       type: string;
     }>;
     created_at: string;
     updated_at: string;
   }
   
   export interface DocumentPanelsResponse {
     panels: DocumentPanel[];
   }
   
   export interface PanelSection {
     heading: string;
     content: string;
   }
   ```
3. Update `Meeting` interface:
   - Add `panels?: DocumentPanel[]`
   - Add `panelSections?: Record<string, string>` for structured content

## Task 2: Extend EnhancedGranolaService (1 hour)

1. Open `src/services/enhanced-granola-service.ts`
2. Add import for new types
3. Add method to fetch panels:
   ```typescript
   async getDocumentPanels(documentId: string): Promise<DocumentPanel[]>
   ```
4. Implement with:
   - Proper API call to `/v1/get-document-panels`
   - Error handling and logging
   - Return empty array on failure (graceful degradation)
5. Test with a real document ID using test script

## Task 3: Create Panel Processing Service (1.5 hours)

1. Create new file `src/services/panel-processor.ts`
2. Implement `PanelProcessor` class with methods:
   - `extractStructuredContent(panel: DocumentPanel): Record<string, string>`
   - `convertHtmlToMarkdown(html: string): string`
   - `extractSectionFromHtml(html: string, sectionName: string): string`
3. Handle HTML parsing for panel content:
   - Extract sections by H1 tags
   - Convert HTML lists to markdown
   - Clean up HTML entities
   - Preserve formatting
4. Add unit tests for HTML parsing

## Task 4: Update transformMeeting in EnhancedGranolaService (45 mins)

1. Modify the `transformMeeting` method to accept panels parameter
2. Add panel data to the returned Meeting object
3. Extract structured content for known templates (Josh Template)
4. Map panel sections to meeting fields

## Task 5: Update Sync Engine (1 hour)

1. Open `src/services/sync-engine.ts`
2. In `syncSingleMeeting` method:
   - After fetching meeting, fetch panels
   - Log panel fetch results
   - Pass panels to markdown builder
3. Add try-catch for panel fetching
4. Update progress tracking to include panel fetch
5. Test with a real sync operation

## Task 6: Enhance MarkdownBuilder (1.5 hours)

1. Open `src/utils/markdown-builder.ts`
2. Update `buildMeetingNote` to accept panels
3. Add new method `buildPanelSections(panels: DocumentPanel[]): string`
4. For each panel:
   - Create a section header `## Panel: [Title]`
   - Extract and format content
   - Handle structured sections
5. Integrate panel sections into main content flow
6. Ensure proper spacing and formatting

## Task 7: Integration Testing (1 hour)

1. Run the existing sync command with a meeting that has panels
2. Verify panels appear in the markdown output
3. Check formatting and structure
4. Test with meetings without panels
5. Run E2E test for panel content

## Task 8: Manual Testing & Debugging (1 hour)

1. Test with various panel types:
   - Josh Template
   - Summary panels
   - Action item panels
2. Verify HTML to markdown conversion
3. Check for edge cases:
   - Empty panels
   - Malformed HTML
   - Missing sections
4. Fix any issues found

## Task 9: Code Cleanup & Documentation (30 mins)

1. Add JSDoc comments to new methods
2. Update README with panel support information
3. Add error messages for debugging
4. Remove any console.logs used for testing

## Task 10: Prepare for Review (30 mins)

1. Run all tests
2. Create a summary of changes
3. Document any design decisions
4. List any concerns or edge cases
5. Prepare questions for reviewers

## Checklist Before Review

- [ ] All panel type definitions added
- [ ] API integration tested with real data
- [ ] Panel processor handles all content types
- [ ] Markdown output includes panel sections
- [ ] E2E test for panels passes
- [ ] No regression in existing functionality
- [ ] Code is clean and documented
- [ ] Error handling is comprehensive

## Testing Commands

```bash
# Run unit tests
npm test

# Run E2E tests
npm run test:e2e

# Test specific panel functionality
npm test -- panel

# Manual sync test
npm run dev
# In Obsidian: Granola Sync: Sync All Meetings
```