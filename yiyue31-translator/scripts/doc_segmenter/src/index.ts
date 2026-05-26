/**
 * doc-segmenter: Public API exports.
 *
 * Re-exports all model types, protocol interfaces, implementation classes,
 * utility functions, and constants for use as an npm package.
 */

// Models
export {
  SplitError,
  createChunk,
  createSplitContext,
} from "./models";

export type {
  SourceFileInfo,
  Section,
  Chunk,
  SplitOperation,
  SplitContext,
} from "./models";

// Protocol interfaces (types)
export type {
  FileInspector,
  SectionParser,
  SectionSplitter,
  ChunkMerger,
  IntegrityChecker,
  FileGenerator,
  ReportGenerator,
} from "./types";

// Implementations
export { FileInspectorImpl } from "./inspector";
export { SectionParserImpl } from "./parser";
export { SectionSplitterImpl } from "./splitter";
export { ChunkMergerImpl } from "./merger";
export { IntegrityCheckerImpl } from "./checker";
export { FileGeneratorImpl } from "./generator";
export { ReportGeneratorImpl } from "./reporter";
export { SplitRunnerImpl } from "./runner";

// Utilities
export { sanitizeFilename, calcSizeKb, normalizeNewlines } from "./utils";

// Constants
export { MAX_FILE_SIZE_BYTES, MAX_DEPTH, TARGET_RATIO, HEADING_PATTERN } from "./constants";
