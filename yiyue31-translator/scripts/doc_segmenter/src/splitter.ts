/**
 * SectionSplitter implementation.
 *
 * Splits large sections into chunks under maxSize KB.
 * Handles protected boundaries (HTML tables, code blocks, pipe tables).
 * Recursion depth capped at MAX_DEPTH, with forced truncation fallback.
 */

import { type Chunk, type Section, type SplitOperation } from "./models";
import { calcSizeKb } from "./utils";
import { MAX_DEPTH, TARGET_RATIO, HEADING_PATTERN } from "./constants";

export class SectionSplitterImpl {
  /**
   * Split sections into chunks, all under maxSize KB.
   */
  split(
    sections: Section[],
    maxSize: number
  ): [Chunk[], SplitOperation[]] {
    const allChunks: Chunk[] = [];
    const allOperations: SplitOperation[] = [];

    for (const section of sections) {
      if (section.sizeKb <= maxSize) {
        const chunk = this.sectionToChunk(section);
        allChunks.push(chunk);
      } else {
        const [subChunks, ops] = this.splitSection(section, maxSize, 0);
        allChunks.push(...subChunks);
        allOperations.push(...ops);
      }
    }

    return [allChunks, allOperations];
  }

  private sectionToChunk(section: Section, suffix: string = ""): Chunk {
    const lines = section.content.split("\n");
    return {
      sourceSection: section.title + suffix,
      level: section.level,
      content: section.content,
      sizeKb: section.sizeKb,
      lineCount: lines.length,
      startLine: section.startLine,
      endLine: section.endLine,
      isMerged: false,
      mergedSections: [],
      estimatedTokens: 0,
    };
  }

  private splitSection(
    section: Section,
    maxSize: number,
    depth: number
  ): [Chunk[], SplitOperation[]] {
    const targetSize = maxSize * TARGET_RATIO;
    const operations: SplitOperation[] = [];
    const chunks: Chunk[] = [];
    let remainingContent = section.content;
    let partNum = 1;
    let offset = 0;

    while (remainingContent) {
      const currentSize = calcSizeKb(remainingContent);
      if (currentSize <= maxSize) {
        const chunk = this.makeChunkFromContent(
          remainingContent,
          section.title,
          `-p${partNum}`,
          section.level,
          section.startLine + offset
        );
        chunks.push(chunk);
        break;
      }

      // Try to find a split point respecting protected regions
      const bestPos = this.findBestSplitPoint(
        remainingContent,
        maxSize,
        targetSize
      );

      if (bestPos !== null && bestPos > 0) {
        const partContent = remainingContent.slice(0, bestPos);
        remainingContent = remainingContent.slice(bestPos);

        const chunk = this.makeChunkFromContent(
          partContent,
          section.title,
          `-p${partNum}`,
          section.level,
          section.startLine + offset
        );
        chunks.push(chunk);
        offset += partContent.split("\n").length - 1;
        partNum++;
      } else {
        // No valid split point found -> force truncate with protected-region awareness
        const [forceChunks, forceOps] = this.forceTruncateProtected(
          remainingContent,
          section.title,
          maxSize,
          section.level,
          section.startLine + offset,
          partNum
        );
        chunks.push(...forceChunks);
        operations.push(...forceOps);
        remainingContent = "";
        break;
      }
    }

    // Record split operation
    if (chunks.length > 0) {
      const detailParts: string[] = [];
      for (let i = 0; i < chunks.length; i++) {
        detailParts.push(`p${i + 1}(${Math.round(chunks[i].sizeKb)}KB)`);
      }
      const detail = `${Math.round(section.sizeKb)}KB -> ${detailParts.join(" + ")}`;
      operations.push({
        operation: "split",
        target: section.title,
        detail,
      });
    }

    // Check if any chunk is still over maxSize and needs recursive splitting
    const finalChunks: Chunk[] = [];
    for (const chunk of chunks) {
      if (chunk.sizeKb > maxSize && depth < MAX_DEPTH) {
        const subSection: Section = {
          level: chunk.level,
          title: chunk.sourceSection,
          content: chunk.content,
          sizeKb: chunk.sizeKb,
          startLine: chunk.startLine,
          endLine: chunk.endLine,
        };
        const [subChunks, subOps] = this.splitSection(subSection, maxSize, depth + 1);
        finalChunks.push(...subChunks);
        operations.push(...subOps);
      } else {
        finalChunks.push(chunk);
      }
    }

    return [finalChunks, operations];
  }

  private findBestSplitPoint(
    content: string,
    maxSize: number,
    targetSize: number
  ): number | null {
    const lines = content.split("\n");
    const protected_ = this.getProtectedRanges(lines);
    const maxBytes = Math.floor(maxSize * 1024);
    const targetBytes = Math.floor(targetSize * 1024);

    const candidates: Array<{ splitPos: number; distance: number }> = [];

    let charPos = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const nextCharPos = charPos + line.length + 1;

      const isProtected = this.isInProtected(i, protected_);

      if (!isProtected) {
        const isBlank = line.trim() === "";
        const isHeading = HEADING_PATTERN.test(line);

        if (isBlank) {
          const splitPos = nextCharPos;
          const byteCount = new TextEncoder().encode(content.slice(0, splitPos)).length;
          if (byteCount > 0 && byteCount <= maxBytes) {
            const distance = Math.abs(byteCount - targetBytes);
            candidates.push({ splitPos, distance });
          }
        } else if (isHeading && charPos > 0) {
          const splitPos = charPos;
          const byteCount = new TextEncoder().encode(content.slice(0, splitPos)).length;
          if (byteCount > 0 && byteCount <= maxBytes) {
            const distance = Math.abs(byteCount - targetBytes);
            candidates.push({ splitPos, distance });
          }
        }
      }

      charPos = nextCharPos;
    }

    if (candidates.length === 0) {
      return null;
    }

    candidates.sort((a, b) => a.distance - b.distance);
    return candidates[0].splitPos;
  }

  private getProtectedRanges(lines: string[]): Array<[number, number]> {
    const ranges: Array<[number, number]> = [];

    // HTML tables
    let inHtmlTable = false;
    let start = -1;
    for (let i = 0; i < lines.length; i++) {
      const stripped = lines[i].trim().toLowerCase();
      if (stripped.includes("<table")) {
        inHtmlTable = true;
        start = i;
      }
      if (stripped.includes("</table>") && inHtmlTable) {
        ranges.push([start, i]);
        inHtmlTable = false;
      }
    }

    // Code blocks
    let inCode = false;
    start = -1;
    for (let i = 0; i < lines.length; i++) {
      const stripped = lines[i].trim();
      if (stripped.startsWith("```")) {
        if (!inCode) {
          inCode = true;
          start = i;
        } else {
          ranges.push([start, i]);
          inCode = false;
        }
      }
    }

    // Pipe tables
    let i = 0;
    while (i < lines.length) {
      const stripped = lines[i].trim();
      if (stripped.startsWith("|") && stripped.endsWith("|")) {
        const tableStart = i;
        while (
          i < lines.length &&
          lines[i].trim().startsWith("|") &&
          lines[i].trim().endsWith("|")
        ) {
          i++;
        }
        ranges.push([tableStart, i - 1]);
      } else {
        i++;
      }
    }

    return ranges;
  }

  private isInProtected(
    lineIdx: number,
    protected_: Array<[number, number]>
  ): boolean {
    for (const [start, end] of protected_) {
      if (start <= lineIdx && lineIdx <= end) {
        return true;
      }
    }
    return false;
  }

  private forceTruncateProtected(
    content: string,
    title: string,
    maxSize: number,
    level: number,
    startLine: number,
    partStart: number
  ): [Chunk[], SplitOperation[]] {
    const lines = content.split("\n");
    const protected_ = this.getProtectedRanges(lines);
    const maxBytes = Math.floor(maxSize * 1024);

    // Build a list of line start offsets in the original content
    const lineOffsets: number[] = [0];
    let pos = 0;
    for (const line of lines) {
      pos += line.length + 1; // +1 for the \n
      lineOffsets.push(pos);
    }

    const chunks: Chunk[] = [];
    const operations: SplitOperation[] = [];
    let partNum = partStart;

    // Build segments: each segment is [startChar, endChar, isProtected]
    const segments: Array<[number, number, boolean]> = [];
    i_loop: for (let i = 0; i < lines.length;) {
      // Check if this line starts a protected range
      for (const [ps, pe] of protected_) {
        if (i === ps) {
          const startChar = lineOffsets[ps];
          const endChar = lineOffsets[pe + 1];
          segments.push([startChar, endChar, true]);
          i = pe + 1;
          continue i_loop;
        }
      }
      // Non-protected: single line
      const startChar = lineOffsets[i];
      const endChar = lineOffsets[i + 1];
      segments.push([startChar, endChar, false]);
      i++;
    }

    // Accumulate segments into chunks, keeping protected segments intact
    let chunkStart = 0;
    let chunkEnd = 0;

    for (const [segStart, segEnd, isProt] of segments) {
      if (chunkEnd > chunkStart) {
        const combinedBytes = new TextEncoder().encode(content.slice(chunkStart, segEnd)).length;
        if (combinedBytes <= maxBytes || isProt) {
          // Extend current chunk
          chunkEnd = segEnd;
        } else {
          // Flush current chunk
          const chunkContent = content.slice(chunkStart, chunkEnd);
          chunks.push(
            this.makeChunkFromContent(
              chunkContent,
              title,
              `-p${partNum}`,
              level,
              startLine + content.slice(0, chunkStart).split("\n").length - 1
            )
          );
          partNum++;
          chunkStart = segStart;
          chunkEnd = segEnd;
        }
      } else {
        chunkStart = segStart;
        chunkEnd = segEnd;
      }
    }

    // Flush remaining
    if (chunkEnd > chunkStart) {
      const chunkContent = content.slice(chunkStart, chunkEnd);
      chunks.push(
        this.makeChunkFromContent(
          chunkContent,
          title,
          `-p${partNum}`,
          level,
          startLine + content.slice(0, chunkStart).split("\n").length - 1
        )
      );
    }

    // Record operation
    if (chunks.length > 0) {
      const detailParts: string[] = [];
      for (let idx = 0; idx < chunks.length; idx++) {
        detailParts.push(`p${partStart + idx}(${Math.round(chunks[idx].sizeKb)}KB)`);
      }
      const detail = ` -> ${detailParts.join(" -> ")}`;
      operations.push({
        operation: "split",
        target: title,
        detail,
      });
    }

    return [chunks, operations];
  }

  private makeChunkFromContent(
    content: string,
    title: string,
    suffix: string,
    level: number,
    startLine: number
  ): Chunk {
    const lines = content.split("\n");
    const endLine = startLine + lines.length - 1;
    return {
      sourceSection: title + suffix,
      level,
      content,
      sizeKb: calcSizeKb(content),
      lineCount: lines.length,
      startLine,
      endLine,
      isMerged: false,
      mergedSections: [],
      estimatedTokens: 0,
    };
  }
}
