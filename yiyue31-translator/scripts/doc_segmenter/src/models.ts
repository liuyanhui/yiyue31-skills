/**
 * Data models for the file splitting pipeline.
 *
 * Defines all TypeScript interfaces and classes used throughout the splitting
 * workflow, matching the Python dataclasses in models.py with camelCase naming.
 */

/**
 * Structured error with an exit code for the CLI.
 *
 * Exit codes:
 *   0 - Success (not used for errors)
 *   1 - File not found or unreadable
 *   2 - File exceeds size limit
 *   3 - Validation failed
 *   4 - Output directory write failure
 */
export class SplitError extends Error {
  public readonly exitCode: number;

  constructor(message: string, exitCode: number) {
    super(message);
    this.name = "SplitError";
    this.exitCode = exitCode;
  }
}

/** Metadata about the source Markdown file. */
export interface SourceFileInfo {
  filePath: string;
  fileSize: number; // KB, UTF-8 bytes / 1024
  fileLines: number;
  fileChars: number;
  fileEncoding: string;
}

/** A parsed Markdown section identified by its heading. */
export interface Section {
  level: number; // 1-6 (heading depth)
  title: string;
  content: string; // includes the heading line itself
  sizeKb: number; // UTF-8 bytes / 1024
  startLine: number;
  endLine: number;
}

/** A split/merged output unit ready for file generation. */
export interface Chunk {
  sourceSection: string; // e.g. "Methodology-p1", "Conclusion + Appendix"
  level: number; // section heading depth
  content: string;
  sizeKb: number; // UTF-8 bytes / 1024
  lineCount: number;
  startLine: number;
  endLine: number;
  isMerged: boolean;
  mergedSections: string[];
  estimatedTokens: number;
}

/** Record of a single split or merge action. */
export interface SplitOperation {
  operation: string; // "split" or "merge"
  target: string; // section name
  detail: string; // e.g. "72KB -> p1(38KB) + p2(34KB)"
}

/** Pipeline-wide data carrier passed between all stages. */
export interface SplitContext {
  sourceInfo: SourceFileInfo;
  sections: Section[];
  chunks: Chunk[];
  operations: SplitOperation[];
  validationResults: Record<string, boolean>;
  outputDir: string;
}

/**
 * Create a Chunk with proper defaults.
 *
 * Matches Python's @dataclass defaults: isMerged=False,
 * mergedSections=[], estimatedTokens=0.
 */
export function createChunk(params: {
  sourceSection: string;
  level: number;
  content: string;
  sizeKb: number;
  lineCount: number;
  startLine: number;
  endLine: number;
  isMerged?: boolean;
  mergedSections?: string[];
  estimatedTokens?: number;
}): Chunk {
  return {
    isMerged: false,
    mergedSections: [],
    estimatedTokens: 0,
    ...params,
  };
}

/**
 * Create a SplitContext with proper defaults.
 *
 * Matches Python's @dataclass defaults: sections=[], chunks=[],
 * operations=[], validationResults={}, outputDir="".
 */
export function createSplitContext(params: {
  sourceInfo: SourceFileInfo;
  sections?: Section[];
  chunks?: Chunk[];
  operations?: SplitOperation[];
  validationResults?: Record<string, boolean>;
  outputDir?: string;
}): SplitContext {
  return {
    sections: [],
    chunks: [],
    operations: [],
    validationResults: {},
    outputDir: "",
    ...params,
  };
}
