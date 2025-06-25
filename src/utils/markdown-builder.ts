import { Meeting } from '../types';

export class MarkdownBuilder {
  static buildMeetingNote(meeting: Meeting): string {
    // TODO: Convert meeting data to markdown
    // 1. Create frontmatter with granolaId and metadata
    // 2. Add meeting title as H1
    // 3. Add meeting metadata (date, duration, attendees)
    // 4. Add summary section if available
    // 5. Add highlights section if available
    // 6. Add transcript section if available
    // 7. Add tags if available
    // Example structure:
    /*
    ---
    granolaId: "12345"
    date: 2024-03-20
    tags: [meeting, project-x]
    ---
    
    # Meeting Title
    
    **Date:** March 20, 2024
    **Duration:** 60 minutes
    **Attendees:** John, Jane
    
    ## Summary
    ...
    
    ## Key Highlights
    - Point 1
    - Point 2
    
    ## Transcript
    ...
    */
    throw new Error('Not implemented - see example structure above');
  }
}
