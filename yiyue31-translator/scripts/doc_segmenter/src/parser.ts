/**
 * SectionParser implementation.
 *
 * Parses Markdown content into a list of Section objects based on headings.
 * Uses character offsets to preserve exact content (no lossy split/join).
 */

import { type Section } from "./models";
import { calcSizeKb } from "./utils";
import { HEADING_PATTERN } from "./constants";

export class SectionParserImpl {
  /**
   * Parse raw content into sections based on Markdown headings.
   *
   * @param content - The full file content as a string.
   * @param fileEncoding - The encoding of the source file.
   * @returns A list of Section objects, one per heading found.
   */
  parse(content: string, fileEncoding: string): Section[] {
    if (!content) {
      // Empty content -> single empty section
      return [
        {
          level: 0,
          title: "root",
          content: "",
          sizeKb: 0.0,
          startLine: 0,
          endLine: 0,
        },
      ];
    }

    const lines = content.split("\n");

    // Build character offset map for each line start
    const lineOffsets: number[] = [0];
    let pos = 0;
    for (const line of lines) {
      pos += line.length + 1; // +1 for the \n
      lineOffsets.push(pos);
    }
    // lineOffsets[i] = character offset of line i start
    // lineOffsets[len(lines)] = len(content)

    // Find all heading positions
    const headingPositions: Array<{ lineIdx: number; level: number; title: string }> = [];
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(HEADING_PATTERN);
      if (match) {
        const level = match[1].length;
        const title = match[2].trim();
        headingPositions.push({ lineIdx: i, level, title });
      }
    }

    if (headingPositions.length === 0) {
      // No headings -> single root section
      const sizeKb = calcSizeKb(content);
      return [
        {
          level: 0,
          title: "root",
          content,
          sizeKb,
          startLine: 0,
          endLine: lines.length > 0 ? lines.length - 1 : 0,
        },
      ];
    }

    // Build sections from heading positions using character offsets
    const sections: Section[] = [];

    // Handle content before the first heading (frontmatter, author info, etc.)
    const firstHeadingLine = headingPositions[0].lineIdx;
    if (firstHeadingLine > 0) {
      const preambleCharEnd = lineOffsets[firstHeadingLine];
      const preambleContent = content.slice(0, preambleCharEnd);
      sections.push({
        level: 0,
        title: "preamble",
        content: preambleContent,
        sizeKb: calcSizeKb(preambleContent),
        startLine: 0,
        endLine: firstHeadingLine - 1,
      });
    }

    for (let idx = 0; idx < headingPositions.length; idx++) {
      const { lineIdx, level, title } = headingPositions[idx];

      // Section starts at this heading line's character offset
      const startChar = lineOffsets[lineIdx];
      const startLine = lineIdx;

      // Section ends at the character before the next heading line
      let endChar: number;
      let endLine: number;
      if (idx + 1 < headingPositions.length) {
        const nextLineIdx = headingPositions[idx + 1].lineIdx;
        endChar = lineOffsets[nextLineIdx];
        endLine = nextLineIdx - 1;
      } else {
        endChar = content.length;
        endLine = lines.length - 1;
      }

      // Extract section content directly from the string
      const sectionContent = content.slice(startChar, endChar);
      const sizeKb = calcSizeKb(sectionContent);

      sections.push({
        level,
        title,
        content: sectionContent,
        sizeKb,
        startLine,
        endLine,
      });
    }

    return sections;
  }
}
