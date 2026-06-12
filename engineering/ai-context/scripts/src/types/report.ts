import type {
  MarkerIssueIdentifier,
  MarkerPositionClassification,
  CustomContentClassification,
} from "./enums.js";
import type { CheckConfig } from "./config.js";

// ---------------------------------------------------------------------------
// Low-level report primitives
// ---------------------------------------------------------------------------

/**
 * A single forbidden-pattern match found inside a file.
 */
export interface ForbiddenMatch {
  /** The regex pattern that triggered the match. */
  pattern: string;
  /** Surrounding text providing context for where the match occurred. */
  context: string;
}

/**
 * Describes discrepancies between what the marker block lists as
 * child entries and what actually exists on disk.
 */
export interface FilesystemMismatch {
  /** Entries listed in the marker block but not found on disk. */
  unrecorded: string[];
  /** Entries found on disk but not listed in the marker block. */
  nonexistent: string[];
}

/**
 * Information about a single file whose modification time is older
 * than the marker block's declared update timestamp.
 */
export interface StaleFileInfo {
  /** File name (relative to its parent directory). */
  name: string;
  /** ISO-8601 formatted last modification time of the file. */
  mtime: string;
}

/**
 * Staleness analysis result for a marker block's update_time field.
 */
export interface StaleInfo {
  /** The update_time value parsed from the marker block (ISO-8601). */
  update_time: string;
  /** Files whose mtime is newer than `update_time`, indicating stale data. */
  stale_files: StaleFileInfo[];
  /**
   * Whether the tool fell back to comparing against the containing file's
   * own mtime instead of the `update_time` field.
   */
  fallback_to_file_mtime: boolean;
}

// ---------------------------------------------------------------------------
// Per-file & per-directory reports
// ---------------------------------------------------------------------------

/**
 * Complete validation result for a single target file (e.g. CLAUDE.md).
 */
export interface FileReport {
  /** Resolved absolute path of the file. */
  file: string;
  /** Parent directory of the file. */
  directory: string;
  /** Directory depth relative to the scan root (0 = root). */
  depth: number;
  /** Whether the file passed ALL validation checks. */
  passed: boolean;
  /** File size in bytes. */
  file_size: number;
  /** Encoding detected by the tool (e.g. `"utf-8"` or `"ascii"`). */
  detected_encoding: string;
  /** Number of marker pairs found in the file. */
  marker_count: number;
  /** Structured marker validation issues detected in the file. */
  marker_issues: MarkerIssueIdentifier[];
  /** Length of content between the start and end markers (characters). */
  content_length: number;
  /**
   * Where the marker block sits within the file, or `null` if no
   * valid marker block was found.
   */
  marker_position: MarkerPositionClassification | null;
  /** Whether the marker block contains custom content or is marker-only. */
  content_classification: CustomContentClassification;
  /**
   * Patterns from `required_any_patterns` that did **not** match
   * (empty means all constraints satisfied or no constraint defined).
   */
  required_any_missing: string[];
  /**
   * Patterns from `required_all_patterns` that did **not** match
   * (empty means all constraints satisfied or no constraint defined).
   */
  required_all_missing: string[];
  /** Forbidden-pattern matches found in the file. */
  forbidden_found: ForbiddenMatch[];
  /**
   * Filesystem consistency mismatch for the marker block's listed
   * entries, or `null` if not applicable.
   */
  filesystem_mismatch: FilesystemMismatch | null;
  /**
   * Staleness information derived from the marker block's update_time,
   * or `null` if not applicable.
   */
  stale_info: StaleInfo | null;
}

/**
 * Aggregated report for a single scanned directory.
 */
export interface DirectoryReport {
  /** Absolute path of the directory. */
  directory: string;
  /** Directory depth relative to the scan root (0 = root). */
  depth: number;
  /**
   * The file-level report for the target file found in this directory,
   * or `null` if the file does not exist.
   */
  file_report: FileReport | null;
}

// ---------------------------------------------------------------------------
// Report meta & summary
// ---------------------------------------------------------------------------

/**
 * Metadata attached to every generated report.
 */
export interface ReportMeta {
  /** Version string of the ai-context-checker tool. */
  tool_version: string;
  /** ISO-8601 timestamp of when the report was generated. */
  timestamp: string;
  /** The root target directory that was scanned. */
  target: string;
  /** The fully resolved configuration used for the check. */
  config: CheckConfig;
}

/**
 * Counts of files classified by custom-content presence.
 */
export interface CustomContentStats {
  /** Number of files that have user-authored content inside the marker block. */
  has_custom_content: number;
  /** Number of files that contain only the markers with no custom content. */
  marker_only: number;
}

/**
 * High-level summary of the check result.
 */
export interface ReportSummary {
  /** Total number of directories scanned. */
  total_directories: number;
  /** Number of directories that contain a valid target file. */
  covered_directories: number;
  /** Number of directories missing a valid target file. */
  missing_directories: number;
  /** Coverage rate as a fraction (0..1). Omitted if total is zero. */
  coverage_rate?: number;
  /** Whether the overall check passed (no missing directories, no errors). */
  passed: boolean;
  /** Aggregate custom-content statistics across all scanned files. */
  custom_content_stats: CustomContentStats;
}

// ---------------------------------------------------------------------------
// Depth distribution
// ---------------------------------------------------------------------------

/**
 * Counts for a single depth bucket in the directory depth distribution.
 */
export interface DepthBucket {
  /** Total directories at this depth. */
  total: number;
  /** Directories at this depth that have a valid target file. */
  covered: number;
  /** Directories at this depth that are missing the target file. */
  missing: number;
}

// ---------------------------------------------------------------------------
// Detail entries (used in ReportDetails)
// ---------------------------------------------------------------------------

/**
 * A directory that is missing the expected target file.
 */
export interface MissingFileEntry {
  /** Directory path. */
  directory: string;
  /** Directory depth relative to scan root. */
  depth: number;
}

/**
 * Marker structural issues found in a specific file.
 */
export interface MarkerIssueEntry {
  /** File path. */
  file: string;
  /** Marker issue identifiers detected. */
  issues: MarkerIssueIdentifier[];
  /** Number of marker pairs found. */
  marker_count: number;
}

/**
 * Content-length violation details for a specific file.
 */
export interface ContentIssueEntry {
  /** File path. */
  file: string;
  /** Human-readable issue descriptions. */
  issues: string[];
  /** Numeric detail about the content length violation. */
  detail: {
    /** Actual character count between markers. */
    actual_length: number;
    /** Minimum required character count. */
    min_required: number;
  };
}

/**
 * Encoding mismatch detected in a specific file.
 */
export interface EncodingIssueEntry {
  /** File path. */
  file: string;
  /** Encoding detected by the tool. */
  detected_encoding: string;
  /** Encoding expected by configuration. */
  expected_encoding: string;
}

/**
 * A file that exceeds the configured maximum file size.
 */
export interface OversizedFileEntry {
  /** File path. */
  file: string;
  /** Actual file size in bytes. */
  actual_size: number;
  /** Maximum allowed file size in bytes. */
  max_size: number;
}

/**
 * A file missing at least one required "any" pattern match.
 */
export interface RequiredAnyMissingEntry {
  /** File path. */
  file: string;
  /** Patterns from `required_any_patterns` that did not match. */
  patterns: string[];
}

/**
 * A file missing a specific required "all" pattern match.
 */
export interface RequiredAllMissingEntry {
  /** File path. */
  file: string;
  /** The single pattern from `required_all_patterns` that did not match. */
  missing_pattern: string;
}

/**
 * A file containing one or more forbidden pattern matches.
 */
export interface ForbiddenFoundEntry {
  /** File path. */
  file: string;
  /** Individual forbidden-pattern matches with context. */
  matches: ForbiddenMatch[];
}

/**
 * Aggregated pattern validation issues across all scanned files.
 */
export interface PatternIssues {
  /** Files missing at least one required "any" pattern. */
  required_any_missing: RequiredAnyMissingEntry[];
  /** Files missing at least one required "all" pattern. */
  required_all_missing: RequiredAllMissingEntry[];
  /** Files containing forbidden pattern matches. */
  forbidden_found: ForbiddenFoundEntry[];
}

/**
 * Filesystem consistency mismatch for a specific file's marker block.
 */
export interface FilesystemMismatchEntry {
  /** Parent directory of the file. */
  directory: string;
  /** File path. */
  file: string;
  /** Entries listed in the marker block but not found on disk. */
  unrecorded: string[];
  /** Entries found on disk but not listed in the marker block. */
  nonexistent: string[];
}

/**
 * Staleness information for a specific file's marker block.
 */
export interface StaleEntry {
  /** Parent directory of the file. */
  directory: string;
  /** File path. */
  file: string;
  /** The update_time value from the marker block. */
  update_time: string;
  /** Files whose mtime is newer than `update_time`. */
  stale_files: StaleFileInfo[];
  /** Whether fallback to file mtime comparison was used. */
  fallback_to_file_mtime: boolean;
}

/**
 * Complete detail section of a check report, listing every issue found.
 */
export interface ReportDetails {
  /** Directories missing the expected target file. */
  missing_files: MissingFileEntry[];
  /** Files with marker structural issues. */
  marker_issues: MarkerIssueEntry[];
  /** Files with content-length violations. */
  content_issues: ContentIssueEntry[];
  /** Files with encoding mismatches. */
  encoding_issues: EncodingIssueEntry[];
  /** Files exceeding the size limit. */
  oversized_files: OversizedFileEntry[];
  /** Aggregated pattern validation issues. */
  pattern_issues: PatternIssues;
  /** Files with filesystem-disk consistency mismatches. */
  filesystem_mismatches: FilesystemMismatchEntry[];
  /** Files with stale update_time values. */
  stale_entries: StaleEntry[];
}

// ---------------------------------------------------------------------------
// Top-level check result
// ---------------------------------------------------------------------------

/**
 * The complete output of a full check pipeline run.
 *
 * Contains metadata, summary statistics, depth distribution,
 * marker position statistics, and all detected issues.
 */
export interface CheckResult {
  /** Report metadata (tool version, timestamp, config). */
  meta: ReportMeta;
  /** High-level pass/fail summary and coverage statistics. */
  summary: ReportSummary;
  /** Directory counts grouped by depth level (key is depth as string). */
  depth_distribution: Record<string, DepthBucket>;
  /** Counts of files grouped by marker position classification. */
  marker_position_stats: Record<MarkerPositionClassification, number>;
  /** Exhaustive list of every issue found. */
  details: ReportDetails;
}
