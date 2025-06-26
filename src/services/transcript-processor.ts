import { TranscriptSegment } from '../types';
import { StructuredLogger } from '../utils/structured-logger';

export interface TranscriptSegmentWithSpeaker extends TranscriptSegment {
  speaker: string;
  start_time?: Date;
  end_time?: Date;
  confidence: number;
}

/**
 * Processes transcript segments with speaker identification and deduplication.
 * Based on the granola-automation-client implementation.
 */
export class TranscriptProcessor {
  constructor(private logger: StructuredLogger) {}

  /**
   * Process transcript segments with speaker identification and optional deduplication.
   * Based on granola-automation-client's implementation.
   */
  processTranscript(
    segments: TranscriptSegment[],
    documentId: string,
    deduplicate: boolean = true,
    similarityThreshold: number = 0.68,
    timeWindowSeconds: number = 4.5
  ): TranscriptSegmentWithSpeaker[] {
    // Filter out empty segments and process
    const segmentsWithSpeakers: TranscriptSegmentWithSpeaker[] = segments
      .filter(segment => segment.text && segment.text.trim().length > 0)
      .map(segment => {
        // Parse timestamps
        const startTime = segment.start_timestamp ? new Date(segment.start_timestamp) : undefined;
        const endTime = segment.end_timestamp ? new Date(segment.end_timestamp) : undefined;
        
        // Determine speaker based on source
        let speaker = "Unknown";
        if (segment.source === "microphone") {
          speaker = "Me";
        } else if (segment.source === "system") {
          speaker = "Them";
        }
        
        return {
          ...segment,
          text: segment.text!.trim(),
          speaker,
          document_id: segment.document_id || documentId,
          start_time: startTime,
          end_time: endTime,
          confidence: 1.0
        };
      });

    // Sort by start time
    segmentsWithSpeakers.sort((a, b) => {
      if (!a.start_time || !b.start_time) return 0;
      return a.start_time.getTime() - b.start_time.getTime();
    });

    if (deduplicate) {
      const deduplicatedSegments = this.deduplicateSegments(
        segmentsWithSpeakers,
        similarityThreshold,
        timeWindowSeconds
      );
      
      return this.improveSpeakerAssignment(deduplicatedSegments);
    }

    return segmentsWithSpeakers;
  }

  /**
   * Format processed transcript segments for markdown output.
   * Groups consecutive segments by speaker.
   */
  formatTranscriptMarkdown(segments: TranscriptSegmentWithSpeaker[]): string {
    if (segments.length === 0) return '';

    const lines: string[] = [];
    let currentSpeaker: string | null = null;
    let speakerSegments: string[] = [];

    for (const segment of segments) {
      // If speaker changes, write the accumulated text
      if (currentSpeaker !== null && currentSpeaker !== segment.speaker) {
        lines.push(`${currentSpeaker}:`);
        lines.push(speakerSegments.join(' ').trim());
        lines.push('');
        speakerSegments = [];
      }

      currentSpeaker = segment.speaker;
      if (segment.text && segment.text.trim()) {
        speakerSegments.push(segment.text.trim());
      }
    }

    // Write the last speaker's text
    if (currentSpeaker && speakerSegments.length > 0) {
      lines.push(`${currentSpeaker}:`);
      lines.push(speakerSegments.join(' ').trim());
      lines.push('');
    }

    return lines.join('\n');
  }

  private deduplicateSegments(
    segments: TranscriptSegmentWithSpeaker[],
    similarityThreshold: number,
    timeWindowSeconds: number
  ): TranscriptSegmentWithSpeaker[] {
    if (!segments.length) return [];

    const segmentsToRemove = new Set<number>();

    for (let i = 0; i < segments.length; i++) {
      if (segmentsToRemove.has(i)) continue;

      const segment = segments[i];
      if (!segment.start_time) continue;

      const windowEnd = new Date(segment.start_time.getTime() + timeWindowSeconds * 1000);

      for (let j = i + 1; j < segments.length; j++) {
        if (segmentsToRemove.has(j)) continue;

        const other = segments[j];
        if (!other.start_time || other.start_time.getTime() > windowEnd.getTime()) break;

        const similarity = this.calculateTextSimilarity(segment.text || '', other.text || '');

        if (similarity >= similarityThreshold) {
          // Prefer keeping "microphone" source over "system"
          if (segment.source === "microphone" && other.source === "system") {
            segmentsToRemove.add(j);
          } else if (segment.source === "system" && other.source === "microphone") {
            segmentsToRemove.add(i);
            break;
          } else {
            // Keep the one with more text or remove the later duplicate
            if (similarity > 0.95 || (segment.text?.length || 0) >= (other.text?.length || 0)) {
              segmentsToRemove.add(j);
            } else {
              segmentsToRemove.add(i);
              break;
            }
          }
        }
      }
    }

    return segments.filter((_, i) => !segmentsToRemove.has(i));
  }

  private improveSpeakerAssignment(segments: TranscriptSegmentWithSpeaker[]): TranscriptSegmentWithSpeaker[] {
    // For now, return segments as-is
    // The full implementation in granola-automation-client includes
    // more sophisticated heuristics for speaker assignment
    return segments;
  }

  private calculateTextSimilarity(text1: string, text2: string): number {
    const s1 = text1.toLowerCase();
    const s2 = text2.toLowerCase();

    if (s1.length === 0 && s2.length === 0) return 1.0;
    if (s1.length === 0 || s2.length === 0) return 0.0;
    if (s1 === s2) return 1.0;

    // Check for containment
    if (s1.includes(s2) || s2.includes(s1)) {
      const minLen = Math.min(s1.length, s2.length);
      const maxLen = Math.max(s1.length, s2.length);
      return Math.min(1.0, minLen / maxLen + 0.2);
    }

    // Simple similarity based on common characters
    const lcs = this.longestCommonSubsequence(s1, s2);
    const maxLen = Math.max(s1.length, s2.length);
    return Math.min(1.0, lcs / maxLen);
  }

  private longestCommonSubsequence(s1: string, s2: string): number {
    const matrix: number[][] = Array(s1.length + 1)
      .fill(null)
      .map(() => Array(s2.length + 1).fill(0));

    for (let i = 1; i <= s1.length; i++) {
      for (let j = 1; j <= s2.length; j++) {
        if (s1[i - 1] === s2[j - 1]) {
          matrix[i][j] = matrix[i - 1][j - 1] + 1;
        } else {
          matrix[i][j] = Math.max(matrix[i - 1][j], matrix[i][j - 1]);
        }
      }
    }

    return matrix[s1.length][s2.length];
  }
}