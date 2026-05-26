/**
 * IntegrityChecker implementation.
 *
 * Validates chunks against the original content with 4 checks:
 * - line_count: sum of chunk line_counts == sourceInfo.fileLines
 * - content_concat: normalized(concatenated chunk contents) == normalized(original)
 * - no_duplicates: no chunk content appears more than once in full text
 * - first_last_line: first/last lines of chunks match original
 */

import { type Chunk, type SourceFileInfo } from "./models";

export class IntegrityCheckerImpl {
  /**
   * Run all integrity checks on the final chunks.
   */
  check(
    chunks: Chunk[],
    originalContent: string,
    sourceInfo: SourceFileInfo
  ): Record<string, boolean> {
    return {
      line_count: this.checkLineCount(chunks, sourceInfo),
      content_concat: this.checkContentConcat(chunks, originalContent),
      no_duplicates: this.checkNoDuplicates(chunks),
      first_last_line: this.checkFirstLastLine(chunks, originalContent),
    };
  }

  private checkLineCount(
    chunks: Chunk[],
    sourceInfo: SourceFileInfo
  ): boolean {
    let totalLines = 0;
    for (const chunk of chunks) {
      totalLines += chunk.content.split("\n").length - 1; // count \n characters
      if (chunk.content && !chunk.content.endsWith("\n")) {
        totalLines += 1;
      }
    }

    // Count the extra lines introduced by merge separators
    let mergeSeparatorLines = 0;
    for (const chunk of chunks) {
      if (chunk.isMerged && chunk.mergedSections.length >= 2) {
        mergeSeparatorLines += (chunk.mergedSections.length - 1) * 2;
      }
    }

    const adjustedLines = totalLines - mergeSeparatorLines;
    return adjustedLines === sourceInfo.fileLines;
  }

  private checkContentConcat(
    chunks: Chunk[],
    originalContent: string
  ): boolean {
    const concatenated = chunks.map(c => c.content).join("");

    // Direct comparison first
    if (concatenated === originalContent) {
      return true;
    }

    // For merged content: normalize both by keeping only non-empty lines
    return this.normalizeWhitespace(concatenated) === this.normalizeWhitespace(originalContent);
  }

  private checkNoDuplicates(chunks: Chunk[]): boolean {
    const fullText = chunks.map(c => c.content).join("");

    for (const chunk of chunks) {
      const content = chunk.content;
      if (!content.trim()) {
        continue;
      }
      // Count how many times this chunk's content appears in the full text
      let count = 0;
      let pos = 0;
      while ((pos = fullText.indexOf(content, pos)) !== -1) {
        count++;
        pos += 1;
      }
      if (count > 1) {
        return false;
      }
    }
    return true;
  }

  private checkFirstLastLine(
    chunks: Chunk[],
    originalContent: string
  ): boolean {
    if (chunks.length === 0 || !originalContent) {
      return true;
    }

    let originalLines = originalContent.split("\n");
    // Filter out empty lines at the end
    while (originalLines.length > 0 && originalLines[originalLines.length - 1] === "") {
      originalLines.pop();
    }

    if (originalLines.length === 0) {
      return true;
    }

    const firstChunkLines = chunks[0].content.split("\n");
    const lastChunkLines = chunks[chunks.length - 1].content.split("\n");

    // Get first non-empty line from first chunk
    let firstLine = "";
    for (const line of firstChunkLines) {
      if (line.trim()) {
        firstLine = line;
        break;
      }
    }

    // Get last non-empty line from last chunk
    let lastLine = "";
    for (let i = lastChunkLines.length - 1; i >= 0; i--) {
      if (lastChunkLines[i].trim()) {
        lastLine = lastChunkLines[i];
        break;
      }
    }

    // Compare with original
    let origFirst = "";
    for (const line of originalLines) {
      if (line.trim()) {
        origFirst = line;
        break;
      }
    }

    let origLast = "";
    for (let i = originalLines.length - 1; i >= 0; i--) {
      if (originalLines[i].trim()) {
        origLast = originalLines[i];
        break;
      }
    }

    return firstLine === origFirst && lastLine === origLast;
  }

  private normalizeWhitespace(text: string): string {
    const lines = text.split("\n");
    const nonEmpty = lines.filter(line => line.trim());
    return nonEmpty.join("\n");
  }
}
