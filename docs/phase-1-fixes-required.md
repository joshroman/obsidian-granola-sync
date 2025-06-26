# Phase 1 Critical Fixes Required

Based on expert review from o3 and Gemini models, the following fixes are required before Phase 1 can be considered complete:

## Critical Performance Fix: N+1 API Calls

### Problem
Currently fetching panels individually for each meeting causes N additional API calls, severely impacting performance for large syncs.

### Solution
```typescript
// In sync-engine.ts, batch panel fetching:
private async fetchPanelsForBatch(meetings: Meeting[]): Promise<Map<string, DocumentPanel[]>> {
  const panelMap = new Map<string, DocumentPanel[]>();
  
  // Fetch panels concurrently with controlled concurrency
  const CONCURRENT_LIMIT = 5;
  for (let i = 0; i < meetings.length; i += CONCURRENT_LIMIT) {
    const batch = meetings.slice(i, i + CONCURRENT_LIMIT);
    const promises = batch.map(async (meeting) => {
      try {
        const panels = await this.granolaService.getDocumentPanels(meeting.id);
        return { id: meeting.id, panels };
      } catch (error) {
        this.logger.warn(`Failed to fetch panels for ${meeting.id}`, error);
        return { id: meeting.id, panels: [] };
      }
    });
    
    const results = await Promise.all(promises);
    results.forEach(({ id, panels }) => panelMap.set(id, panels));
  }
  
  return panelMap;
}
```

## Replace Regex HTML Parser

### Problem
Current regex-based HTML parsing is brittle and will fail on complex HTML structures.

### Solution
1. Add Turndown library: `npm install turndown @types/turndown`
2. Replace PanelProcessor.convertHtmlToMarkdown:

```typescript
import TurndownService from 'turndown';

export class PanelProcessor {
  private turndownService: TurndownService;
  
  constructor(private logger: StructuredLogger) {
    this.turndownService = new TurndownService({
      headingStyle: 'atx',
      bulletListMarker: '•',
      codeBlockStyle: 'fenced'
    });
    
    // Configure Turndown rules for Granola-specific HTML
    this.configureTurndown();
  }
  
  private configureTurndown() {
    // Add custom rules if needed
    this.turndownService.addRule('granolaLinks', {
      filter: ['a'],
      replacement: (content, node) => {
        const href = node.getAttribute('href');
        // Sanitize Granola links
        if (href?.includes('notes.granola.ai')) {
          return content; // Strip the link
        }
        return `[${content}](${href})`;
      }
    });
  }
  
  convertHtmlToMarkdown(html: string): string {
    // Sanitize dangerous content first
    const sanitized = this.sanitizeHtml(html);
    return this.turndownService.turndown(sanitized);
  }
}
```

## Security Improvements

### Problem
Malicious HTML could inject front-matter or wiki-links that compromise note integrity.

### Solution
```typescript
private sanitizeHtml(html: string): string {
  // Remove potential front-matter injections
  html = html.replace(/^---[\s\S]*?---/gm, '');
  
  // Escape wiki-link syntax
  html = html.replace(/\[\[([^\]]+)\]\]/g, '\\[\\[$1\\]\\]');
  
  // Remove script tags and event handlers
  html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  html = html.replace(/on\w+\s*=\s*"[^"]*"/gi, '');
  
  return html;
}

// Improve YAML escaping
private escapeYaml(value: string): string {
  // Comprehensive YAML escaping
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/:/g, '\\:')
    .replace(/>/g, '\\>')
    .replace(/\|/g, '\\|')
    .replace(/\*/g, '\\*')
    .replace(/&/g, '\\&')
    .replace(/#/g, '\\#');
}
```

## Dependency Management

### Problem
Creating new instances of loggers and processors for each operation is inefficient.

### Solution
1. In main.ts, create singletons:
```typescript
// Create shared instances
this.structuredLogger = new StructuredLogger();
this.panelProcessor = new PanelProcessor(this.structuredLogger);
```

2. Pass via dependency injection:
```typescript
// In MarkdownBuilder
export class MarkdownBuilder {
  constructor(
    private panelProcessor: PanelProcessor,
    private logger: StructuredLogger
  ) {}
  
  static buildMeetingNote(
    meeting: Meeting, 
    template?: string,
    panelProcessor?: PanelProcessor
  ): string {
    // Use injected processor or create default
    const processor = panelProcessor || new PanelProcessor(new StructuredLogger());
    // ...
  }
}
```

3. Remove dynamic import from transformMeeting - panels are processed in MarkdownBuilder

## Testing Requirements

1. Add unit tests for security sanitization
2. Add performance tests for batch panel fetching
3. Test with malicious HTML content
4. Verify YAML escaping with special characters

## Implementation Priority

1. **IMMEDIATE**: Fix N+1 performance issue (blocks production use)
2. **HIGH**: Add security sanitization (prevents data corruption)
3. **HIGH**: Replace regex parser with Turndown (prevents parsing failures)
4. **MEDIUM**: Fix dependency injection (code quality)

## Acceptance Criteria

- [ ] Panel fetching uses concurrent batching with rate limit respect
- [ ] HTML parser handles nested lists, tables, and complex formatting
- [ ] Malicious content cannot inject front-matter or wiki-links
- [ ] YAML escaping handles all special characters
- [ ] No duplicate logger/processor instances created
- [ ] All tests pass including new security tests