import type {
  MarkerIssueIdentifier,
  MarkerPositionClassification,
} from "./enums.js";
import type { CheckConfig } from "./config.js";
import type {
  ForbiddenMatch,
  StaleFileInfo,
  DepthBucket,
} from "./report.js";

// ---------------------------------------------------------------------------
// Config validation
// ---------------------------------------------------------------------------

/**
 * A single validation error found when checking a configuration value.
 */
export interface ValidationError {
  /** Dot-path of the invalid field (e.g. `"markers.start"`). */
  field: string;
  /** Human-readable description of the problem. */
  message: string;
  /** Whether this error is fatal (prevents the tool from running). */
  fatal: boolean;
}

/**
 * Discriminated-union success case: the configuration is valid.
 */
export interface ValidatedConfig {
  /** Discriminant — always `true`. */
  isValid: true;
  /** The fully validated configuration object. */
  config: CheckConfig;
  /** No errors (kept for structural consistency with the union). */
  errors: [];
}

/**
 * Discriminated-union failure case: one or more validation errors.
 */
export interface InvalidConfig {
  /** Discriminant — always `false`. */
  isValid: false;
  /** The list of validation errors that prevented a valid config. */
  errors: ValidationError[];
}

/**
 * Result of configuration validation.
 *
 * Use the `isValid` discriminant to narrow:
 * ```ts
 * if (result.isValid) { result.config /* CheckConfig *\/ }
 * else { result.errors /* ValidationError[] *\/ }
 * ```
 */
export type ValidationResult = ValidatedConfig | InvalidConfig;

// ---------------------------------------------------------------------------
// Directory & file scanning helpers
// ---------------------------------------------------------------------------

/**
 * Basic information about a scanned directory.
 */
export interface DirectoryInfo {
  /** Absolute path of the directory. */
  directory: string;
  /** Directory depth relative to the scan root (0 = root). */
  depth: number;
}

/**
 * Result of checking whether a target file exists in a specific directory.
 */
export interface FileExistenceResult {
  /** Directory that was checked. */
  directory: string;
  /** Directory depth relative to scan root. */
  depth: number;
  /** Whether the target file was found. */
  fileExists: boolean;
  /** Resolved absolute path of the target file (even if it does not exist). */
  filePath: string;
}

// ---------------------------------------------------------------------------
// Content & marker validation
// ---------------------------------------------------------------------------

/**
 * Numeric detail about a content-length violation.
 */
export interface ContentLengthDetail {
  /** Actual character count between markers. */
  actual_length: number;
  /** Minimum required character count from configuration. */
  min_required: number;
}

/**
 * Result of checking whether content between markers meets length requirements.
 */
export interface ContentIssueResult {
  /** File path. */
  file: string;
  /** Human-readable issue descriptions. */
  issues: string[];
  /** Numeric detail of the content length violation. */
  detail: ContentLengthDetail;
}

/**
 * Comprehensive result of validating paired markers in a file.
 */
export interface PairedMarkerValidationResult {
  /** Whether the marker structure is valid. */
  valid: boolean;
  /** Marker issue identifiers detected (empty if valid). */
  issues: MarkerIssueIdentifier[];
  /** Number of marker pairs found. */
  marker_count: number;
  /** The content extracted from between the markers, or `null` if invalid. */
  extracted_content: string | null;
  /**
   * Content-length issue if the extracted content is too short,
   * or `null` if content length is acceptable.
   */
  content_issue: ContentIssueResult | null;
}

// ---------------------------------------------------------------------------
// Encoding validation
// ---------------------------------------------------------------------------

/**
 * Position of an illegal byte detected during encoding validation.
 */
export interface IllegalBytePosition {
  /** Byte offset within the file content. */
  offset: number;
  /** The byte value (0-255) that was flagged. */
  byteValue: number;
}

/**
 * Result of validating a file's text encoding.
 */
export interface EncodingValidationResult {
  /** Whether the file passes encoding validation. */
  passed: boolean;
  /** Encoding detected in the file. */
  detectedEncoding: string;
  /** Encoding expected by configuration. */
  expectedEncoding: string;
  /** Illegal byte positions found (empty if passed). */
  illegalBytes: IllegalBytePosition[];
}

// ---------------------------------------------------------------------------
// File size validation
// ---------------------------------------------------------------------------

/**
 * Result of validating a file's size against the configured limit.
 */
export interface FileSizeValidationResult {
  /** Whether the file is within the allowed size. */
  passed: boolean;
  /** Actual file size in bytes. */
  actual_size: number;
  /** Maximum allowed file size in bytes. */
  max_size: number;
}

// ---------------------------------------------------------------------------
// Disk / parsed entry types for filesystem consistency checking
// ---------------------------------------------------------------------------

/**
 * An entry read from the physical filesystem (file or subdirectory).
 */
export interface DiskEntry {
  /** Entry name (e.g. `"src"` or `"README.md"`). */
  name: string;
  /** Whether the entry is a file or a directory. */
  type: "file" | "directory";
}

/**
 * An entry parsed from the marker block's content listing.
 */
export interface ParsedEntry {
  /** Entry name. */
  name: string;
  /** Whether the entry is a file or a directory. */
  type: "file" | "directory";
}

/**
 * Result of diffing filesystem entries against marker-block entries.
 */
export interface DiffResult {
  /** Entries found on disk but not recorded in the marker block. */
  unrecorded: string[];
  /** Entries listed in the marker block but not present on disk. */
  nonexistent: string[];
}

/**
 * Full result of a filesystem-disk consistency check for one file.
 */
export interface ConsistencyCheckResult {
  /** Parent directory of the checked file. */
  directory: string;
  /** File path that was checked. */
  file: string;
  /** Entries on disk not recorded in the marker block. */
  unrecorded: string[];
  /** Entries in the marker block that do not exist on disk. */
  nonexistent: string[];
}

// ---------------------------------------------------------------------------
// File change / staleness detection
// ---------------------------------------------------------------------------

/**
 * An error encountered while detecting file changes (e.g. bad timestamp format).
 */
export interface FileChangeDetectionError {
  /** Parent directory of the file. */
  directory: string;
  /** File path where the error occurred. */
  file: string;
  /** Machine-readable error code. */
  code: "invalid_timestamp_format";
  /** Human-readable error description. */
  message: string;
  /** The raw value that could not be parsed (if available). */
  rawValue?: string;
}

/**
 * Result of file-change (staleness) detection for a single marker block.
 */
export interface FileChangeDetectionResult {
  /**
   * Staleness information if stale files were detected, or `null`
   * if the marker block is up-to-date or staleness checking is not applicable.
   */
  staleness: import("./report.js").StaleEntry | null;
  /** Errors encountered during detection (e.g. unparseable timestamps). */
  errors: FileChangeDetectionError[];
}

// ---------------------------------------------------------------------------
// Depth distribution
// ---------------------------------------------------------------------------

/**
 * An entry used to compute depth distribution statistics.
 */
export interface DirectoryDepthEntry {
  /** Directory path. */
  path: string;
  /** Directory depth relative to scan root. */
  depth: number;
  /** Whether the target file exists in this directory. */
  fileExists: boolean;
}

/**
 * Mapping from depth level (as string) to coverage counts.
 */
export type DepthDistributionResult = Record<string, DepthBucket>;

// ---------------------------------------------------------------------------
// Pipeline result
// ---------------------------------------------------------------------------

import type { CheckResult, DirectoryReport } from "./report.js";

/**
 * Complete output of the validation pipeline, including per-directory reports.
 */
export interface PipelineResult {
  /** The aggregated check result. */
  result: CheckResult;
  /** Per-directory reports in scan order. */
  directoryReports: DirectoryReport[];
}

// ---------------------------------------------------------------------------
// CLI parsing errors
// ---------------------------------------------------------------------------

/**
 * Base error class for CLI argument parsing failures.
 *
 * All CLI-parsing errors inherit from this class, enabling callers
 * to catch any CLI issue with a single `instanceof` check.
 */
export class CliParseError extends Error {
  /** The CLI argument that caused the error, if identifiable. */
  readonly arg?: string;

  constructor(message: string, arg?: string) {
    super(message);
    this.name = "CliParseError";
    this.arg = arg;
  }
}

/**
 * Thrown when a required CLI argument is missing entirely.
 */
export class MissingRequiredArgError extends CliParseError {
  constructor(arg: string) {
    super(`Missing required argument: ${arg}`, arg);
    this.name = "MissingRequiredArgError";
  }
}

/**
 * Thrown when a CLI argument is present but has an invalid value.
 */
export class InvalidArgValueError extends CliParseError {
  /** The invalid value that was provided. */
  readonly value: string;

  constructor(arg: string, value: string) {
    super(`Invalid value for argument ${arg}: ${value}`, arg);
    this.name = "InvalidArgValueError";
    this.value = value;
  }
}

/**
 * Thrown when the user requests help output (e.g. `--help` or `-h`).
 *
 * This is not a "real" error — it signals the caller to print usage
 * information and exit cleanly.
 */
export class HelpRequestedError extends CliParseError {
  constructor() {
    super("Help requested");
    this.name = "HelpRequestedError";
  }
}
