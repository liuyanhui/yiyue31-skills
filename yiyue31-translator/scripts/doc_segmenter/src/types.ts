/**
 * Protocol interfaces for all pipeline modules.
 *
 * Each module (FileInspector, SectionParser, etc.) must implement
 * the corresponding interface defined here. Matches Python's Protocol classes.
 */

import type {
  Chunk,
  Section,
  SourceFileInfo,
  SplitContext,
  SplitOperation,
} from "./models";

/** Stage 0: Pre-check the source file and gather metadata. */
export interface FileInspector {
  /**
   * Inspect a file and return its metadata.
   * @throws SplitError exitCode=1 if file not found, exitCode=2 if exceeds size limit.
   */
  inspect(filePath: string): SourceFileInfo;
}

/** Stage 1: Parse file content into a list of sections. */
export interface SectionParser {
  /**
   * Parse raw content into sections based on Markdown headings.
   * @param content - The full file content as a string.
   * @param fileEncoding - The encoding of the source file.
   * @returns A list of Section objects, one per heading found.
   */
  parse(content: string, fileEncoding: string): Section[];
}

/** Stage 2: Split large sections into chunks under max_size. */
export interface SectionSplitter {
  /**
   * Split sections into chunks, all under maxSize KB.
   * @param sections - Parsed sections from SectionParser.
   * @param maxSize - Maximum size per chunk in KB.
   * @returns A tuple of [chunks, operations].
   */
  split(
    sections: Section[],
    maxSize: number
  ): [Chunk[], SplitOperation[]];
}

/** Stage 3: Merge small chunks with same-level neighbors. */
export interface ChunkMerger {
  /**
   * Merge chunks smaller than minSize into same-level neighbors.
   * @param chunks - Chunks from SectionSplitter.
   * @param maxSize - Maximum size per chunk in KB (merge must not exceed).
   * @param minSize - Minimum size threshold in KB (chunks below trigger merge).
   * @returns A tuple of [mergedChunks, operations].
   */
  merge(
    chunks: Chunk[],
    maxSize: number,
    minSize: number
  ): [Chunk[], SplitOperation[]];
}

/** Stage 4: Validate chunks against the original content. */
export interface IntegrityChecker {
  /**
   * Run all integrity checks on the final chunks.
   * @param chunks - The final chunk list after merging.
   * @param originalContent - The original file content.
   * @param sourceInfo - Metadata about the source file.
   * @returns A dict mapping check names to pass/fail results.
   */
  check(
    chunks: Chunk[],
    originalContent: string,
    sourceInfo: SourceFileInfo
  ): Record<string, boolean>;
}

/** Stage 5: Write chunk files, manifest, and progress JSON. */
export interface FileGenerator {
  /**
   * Generate output files for all chunks.
   * @param chunks - The final chunk list.
   * @param outputDir - Directory to write files into.
   * @param sourceInfo - Metadata about the source file.
   * @param maxSize - Maximum chunk size threshold in KB.
   * @throws SplitError exitCode=4 if output directory write fails.
   */
  generate(
    chunks: Chunk[],
    outputDir: string,
    sourceInfo: SourceFileInfo,
    maxSize: number
  ): void;
}

/** Stage 6: Generate the split report. */
export interface ReportGenerator {
  /**
   * Generate report.md from the full pipeline context.
   * @param context - The complete SplitContext with all pipeline data.
   */
  generateReport(context: SplitContext): void;
}
