/**
 * Barrel export for all type definitions.
 *
 * Import from this module to access any type, interface, class, or constant:
 * ```ts
 * import type { CheckConfig, FileReport, CliParseError } from "../types/index.js";
 * import { DEFAULT_CONFIG } from "../types/index.js";
 * ```
 */

// Enum-like string literal types
export type {
  MarkerIssueIdentifier,
  MarkerPositionClassification,
  CustomContentClassification,
} from "./enums.js";

// Configuration types and defaults
export type {
  MarkerConfig,
  OutputConfig,
  CheckConfig,
  CliArgs,
} from "./config.js";
export { DEFAULT_CONFIG } from "./config.js";

// Report types
export type {
  ForbiddenMatch,
  FilesystemMismatch,
  StaleFileInfo,
  StaleInfo,
  FileReport,
  DirectoryReport,
  ReportMeta,
  CustomContentStats,
  ReportSummary,
  DepthBucket,
  MissingFileEntry,
  MarkerIssueEntry,
  ContentIssueEntry,
  EncodingIssueEntry,
  OversizedFileEntry,
  RequiredAnyMissingEntry,
  RequiredAllMissingEntry,
  ForbiddenFoundEntry,
  PatternIssues,
  DisallowedSectionEntry,
  FilesystemMismatchEntry,
  StaleEntry,
  ReportDetails,
  CheckResult,
} from "./report.js";

// Validation & module-level result types + error classes
export type {
  ValidationError,
  ValidatedConfig,
  InvalidConfig,
  ValidationResult,
  DirectoryInfo,
  FileExistenceResult,
  ContentLengthDetail,
  ContentIssueResult,
  PairedMarkerValidationResult,
  IllegalBytePosition,
  EncodingValidationResult,
  FileSizeValidationResult,
  DiskEntry,
  ParsedEntry,
  DiffResult,
  ConsistencyCheckResult,
  FileChangeDetectionError,
  FileChangeDetectionResult,
  DirectoryDepthEntry,
  DepthDistributionResult,
  PipelineResult,
} from "./validation.js";
export {
  CliParseError,
  MissingRequiredArgError,
  InvalidArgValueError,
  HelpRequestedError,
} from "./validation.js";
