import { Meeting } from '../types';
import { Logger } from './logger';
import { MarkdownBuilder } from './markdown-builder';

/**
 * Processes large meeting content in chunks to avoid memory issues
 */
export class ChunkedContentProcessor {
  private static readonly CHUNK_SIZE = 512 * 1024; // 512KB chunks
  
  constructor(private logger: Logger) {}
  
  /**
   * Process a large meeting by chunking the content
   */
  async processLargeMeeting(
    meeting: Meeting,
    onProgress?: (processedBytes: number) => Promise<void>
  ): Promise<string> {
    this.logger.info(`Processing large meeting: ${meeting.title}`);
    
    // Create a lightweight meeting object for metadata
    const metadataMeeting: Meeting = {
      ...meeting,
      transcript: '', // Will be added in chunks
      summary: meeting.summary?.substring(0, 1000), // Limit summary size
      highlights: meeting.highlights?.slice(0, 50) // Limit highlights
    };
    
    // Generate base content without large fields
    let content = MarkdownBuilder.buildMeetingNote(metadataMeeting);
    
    // Process transcript in chunks if it exists and is large
    if (meeting.transcript && meeting.transcript.length > ChunkedContentProcessor.CHUNK_SIZE) {
      content = await this.appendTranscriptChunks(
        content,
        meeting.transcript,
        onProgress
      );
    } else if (meeting.transcript) {
      // Small transcript - add normally
      content = this.insertTranscript(content, meeting.transcript);
    }
    
    // Add full summary if it was truncated
    if (meeting.summary && meeting.summary.length > 1000) {
      content = this.insertFullSummary(content, meeting.summary);
    }
    
    // Add remaining highlights if they were truncated
    if (meeting.highlights && meeting.highlights.length > 50) {
      content = this.insertRemainingHighlights(
        content,
        meeting.highlights.slice(50)
      );
    }
    
    return content;
  }
  
  /**
   * Append transcript in chunks to avoid memory issues
   */
  private async appendTranscriptChunks(
    baseContent: string,
    transcript: string,
    onProgress?: (processedBytes: number) => Promise<void>
  ): Promise<string> {
    const chunks = this.splitIntoChunks(transcript);
    let processedBytes = 0;
    
    // Find where to insert the transcript
    const transcriptMarker = '## Transcript';
    const transcriptIndex = baseContent.indexOf(transcriptMarker);
    
    if (transcriptIndex === -1) {
      // No transcript section, add it
      baseContent += '\n\n## Transcript\n';
    }
    
    // Build transcript content
    let transcriptContent = '';
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      transcriptContent += chunk;
      
      processedBytes += chunk.length;
      
      // Report progress
      if (onProgress && i % 10 === 0) {
        await onProgress(processedBytes);
      }
      
      // Allow UI to update
      if (i % 50 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    
    // Insert transcript content
    if (transcriptIndex !== -1) {
      // Replace existing empty transcript section
      const beforeTranscript = baseContent.substring(0, transcriptIndex + transcriptMarker.length);
      const afterTranscript = baseContent.substring(
        baseContent.indexOf('\n', transcriptIndex + transcriptMarker.length + 1)
      );
      return beforeTranscript + '\n' + transcriptContent + afterTranscript;
    } else {
      // Append to end
      return baseContent + transcriptContent + '\n';
    }
  }
  
  /**
   * Split text into chunks at word boundaries
   */
  private splitIntoChunks(text: string): string[] {
    const chunks: string[] = [];
    let currentChunk = '';
    
    const words = text.split(/(\s+)/); // Keep whitespace
    
    for (const word of words) {
      if (currentChunk.length + word.length > ChunkedContentProcessor.CHUNK_SIZE) {
        if (currentChunk) {
          chunks.push(currentChunk);
          currentChunk = '';
        }
      }
      currentChunk += word;
    }
    
    if (currentChunk) {
      chunks.push(currentChunk);
    }
    
    return chunks;
  }
  
  /**
   * Insert transcript into content
   */
  private insertTranscript(content: string, transcript: string): string {
    const marker = '## Transcript';
    const index = content.indexOf(marker);
    
    if (index !== -1) {
      const before = content.substring(0, index + marker.length);
      const after = content.substring(content.indexOf('\n', index + marker.length + 1));
      return before + '\n' + transcript + after;
    }
    
    return content;
  }
  
  /**
   * Insert full summary into content
   */
  private insertFullSummary(content: string, summary: string): string {
    const marker = '## Summary';
    const index = content.indexOf(marker);
    
    if (index !== -1) {
      const before = content.substring(0, index + marker.length);
      const after = content.substring(content.indexOf('\n## ', index + marker.length));
      return before + '\n' + summary + '\n' + after;
    }
    
    return content;
  }
  
  /**
   * Insert remaining highlights
   */
  private insertRemainingHighlights(content: string, highlights: string[]): string {
    const marker = '## Key Points';
    const index = content.indexOf(marker);
    
    if (index !== -1) {
      const before = content.substring(0, content.indexOf('\n## ', index + marker.length));
      const after = content.substring(content.indexOf('\n## ', index + marker.length));
      
      const highlightsList = highlights.map(h => `- ${h}`).join('\n');
      return before + '\n' + highlightsList + '\n' + after;
    }
    
    return content;
  }
}