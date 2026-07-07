/**
 * Validation pipeline orchestrator module.
 *
 * Coordinates the full checking pipeline: scanning directories,
 * validating files, collecting results, and producing the aggregate
 * {@link CheckResult}.
 *
 * Pipeline flow for EACH directory:
 * 1. File Existence → if missing: record MissingFileEntry, file_report=null, SKIP rest
 * 2. File Size → if oversized: record OversizedFileEntry, SKIP content checks
 * 3. Encoding → if mismatch: record EncodingIssueEntry, SKIP content parsing
 * 4. Hand-written detection → if NO `# AI Coding Auto Sections` heading AND
 *    NO markers: report-only (file_report.passed=true), SKIP marker checks.
 * 5. Paired Markers → if incomplete: record MarkerIssueEntry, SKIP marker-dependent checks
 * 6. Marker-dependent (only when markers complete):
 *    - Required patterns
 *    - Forbidden patterns
 *    - Allowed sections (adaptive: flag managed headings outside the allowed set)
 *    - Content-disk consistency
 *    - File change detection
 *    - Marker position
 *    - Custom content classification
 *
 * Uses dependency injection via ModuleRegistry for testability.
 */

import type {
  CheckConfig,
  CheckResult,
  PipelineResult,
  DirectoryInfo,
  FileExistenceResult,
  FileSizeValidationResult,
  EncodingValidationResult,
  PairedMarkerValidationResult,
  DirectoryReport,
  FileReport,
  ReportMeta,
  ReportSummary,
  ReportDetails,
  CustomContentStats,
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
  DepthBucket,
  MarkerPositionClassification,
  CustomContentClassification,
  ConsistencyCheckResult,
  FileChangeDetectionResult,
} from "../types/index.js";
import { readFileSync } from "node:fs";
import { resolve, join } from "node:path";

// ---------------------------------------------------------------------------
// ModuleRegistry for dependency injection
// ---------------------------------------------------------------------------

/**
 * Registry of all module functions used by the pipeline.
 *
 * When not provided to {@link runPipeline}, default implementations
 * that delegate to the real modules are used. Tests inject mock
 * implementations to avoid filesystem access.
 */
export interface ModuleRegistry {
  scanDirectories: (config: CheckConfig) => DirectoryInfo[];
  checkFileExistence: (
    directories: DirectoryInfo[],
    filename: string,
    targetRoot: string,
  ) => FileExistenceResult[];
  validateFileSize: (
    filePath: string,
    maxFileSize: number,
  ) => FileSizeValidationResult;
  validateEncoding: (
    filePath: string,
    expectedEncoding: string,
  ) => EncodingValidationResult;
  validatePairedMarkers: (
    fileContent: string,
    startMarker: string,
    endMarker: string,
    minContentLength: number,
    filePath: string,
  ) => PairedMarkerValidationResult;
  validateRequiredPatterns: (
    filePath: string,
    fileContent: string,
    requiredAnyPatterns: string[],
    requiredAllPatterns: string[],
  ) => { required_any_missing: string[]; required_all_missing: string[] };
  validateForbiddenPatterns: (
    filePath: string,
    fileContent: string,
    forbiddenPatterns: string[],
  ) => ForbiddenFoundEntry[];
  /**
   * Adaptive allowed-section check. Optional: when omitted, the check is
   * treated as a no-op (used by tests that do not exercise this path).
   */
  validateAllowedSections?: (
    filePath: string,
    fileContent: string,
    startMarker: string,
    endMarker: string,
    allowedSectionNames: string[],
  ) => DisallowedSectionEntry[];
  checkConsistency: (
    directoryPath: string,
    fileContent: string,
    markers: CheckConfig["markers"],
    config: CheckConfig,
  ) => ConsistencyCheckResult | null;
  detectFileChanges: (
    directoryPath: string,
    startMarkerContent: string,
    updateTimeField: string,
    fallbackMtime: Date | string,
  ) => FileChangeDetectionResult;
  analyzeMarkerPosition: (
    fileContent: string,
    markers: CheckConfig["markers"],
  ) => MarkerPositionClassification;
  analyzeCustomContent: (
    fileContent: string,
    markers: CheckConfig["markers"],
  ) => CustomContentClassification;
  readFile: (filePath: string) => string;
}

// ---------------------------------------------------------------------------
// Helper: structural marker issues (everything except content_too_short)
// ---------------------------------------------------------------------------

const STRUCTURAL_MARKER_ISSUES = new Set([
  "missing_start_marker",
  "missing_end_marker",
  "marker_order_reversed",
  "multiple_marker_pairs",
]);

/**
 * Filter marker issues to only structural ones (not content_too_short).
 */
function filterStructuralIssues(
  issues: PairedMarkerValidationResult["issues"],
): PairedMarkerValidationResult["issues"] {
  return issues.filter((id) => STRUCTURAL_MARKER_ISSUES.has(id));
}

/**
 * Check whether there are any structural marker issues.
 */
function hasStructuralMarkerIssues(
  issues: PairedMarkerValidationResult["issues"],
): boolean {
  return issues.some((id) => STRUCTURAL_MARKER_ISSUES.has(id));
}

// ---------------------------------------------------------------------------
// Helper: hand-written file detection (report-only)
// ---------------------------------------------------------------------------

/**
 * H1 heading that marks a CLAUDE.md as skill-managed. Its presence signals
 * that the yiyue31-context skill owns the marker block for this file.
 * Sourced verbatim from the rewritten SKILL.md.
 */
const MANAGED_HEADING = "# AI Coding Auto Sections";

/**
 * Detect a hand-written CLAUDE.md that the skill deliberately does not manage.
 *
 * Per the rewritten SKILL.md's REPORT-ONLY rule, a file with NEITHER the
 * `# AI Coding Auto Sections` heading NOR any marker is a legitimate state
 * (a human-authored file). The checker must NOT flag such a file as a
 * missing-marker / missing-section error. Files that carry the heading or
 * any marker are still validated, so broken pairs (e.g. an open marker with
 * no close marker) remain failing errors.
 */
function isHandWrittenFile(
  fileContent: string,
  startMarker: string,
  endMarker: string,
): boolean {
  const hasHeading = fileContent.includes(MANAGED_HEADING);
  const hasStart = fileContent.includes(startMarker);
  const hasEnd = fileContent.includes(endMarker);
  return !hasHeading && !hasStart && !hasEnd;
}

// ---------------------------------------------------------------------------
// Helper: read file content
// ---------------------------------------------------------------------------

export function defaultReadFile(filePath: string): string {
  return readFileSync(filePath, "utf-8");
}

// ---------------------------------------------------------------------------
// Default module registry (uses real module implementations)
// ---------------------------------------------------------------------------

function createDefaultRegistry(): ModuleRegistry {
  // Lazy imports to avoid circular dependency issues at test time
  const { scanDirectories } = require("./directory-scanner.js");
  const { checkFileExistence } = require("./file-existence-checker.js");
  const { validateFileSize } = require("./file-size-validator.js");
  const { validateEncoding } = require("./file-encoding-validator.js");
  const { validatePairedMarkers } = require("./paired-marker-validator.js");
  const { validateRequiredPatterns } = require("./required-pattern-validator.js");
  const { validateForbiddenPatterns } = require("./forbidden-pattern-validator.js");
  const { validateAllowedSections } = require("./allowed-section-validator.js");
  const { checkConsistency } = require("./content-disk-consistency-checker.js");
  const { detectFileChanges } = require("./file-change-detector.js");
  const { analyzeMarkerPosition } = require("./marker-position-analyzer.js");
  const { analyzeCustomContent } = require("./custom-content-analyzer.js");

  return {
    scanDirectories,
    checkFileExistence,
    validateFileSize,
    validateEncoding,
    validatePairedMarkers,
    validateRequiredPatterns,
    validateForbiddenPatterns,
    validateAllowedSections,
    checkConsistency,
    detectFileChanges,
    analyzeMarkerPosition,
    analyzeCustomContent,
    readFile: defaultReadFile,
  };
}

// ---------------------------------------------------------------------------
// Exported helper functions
// ---------------------------------------------------------------------------

/**
 * Determine whether the overall pipeline passed.
 *
 * Returns `true` only when all error arrays in the details are empty:
 * missing_files, marker_issues, encoding_issues, oversized_files,
 * content_issues, and all pattern_issues sub-arrays.
 *
 * Note: The task spec says "true only when missing_files, marker_issues,
 * encoding_issues, oversized_files ALL empty", so we follow that rule.
 */
export function computePassed(details: ReportDetails): boolean {
  return (
    details.missing_files.length === 0 &&
    details.marker_issues.length === 0 &&
    details.encoding_issues.length === 0 &&
    details.oversized_files.length === 0
  );
}

/**
 * Compute coverage rate as covered/total.
 * Returns `undefined` when total is 0.
 */
export function computeCoverageRate(
  covered: number,
  total: number,
): number | undefined {
  if (total === 0) {
    return undefined;
  }
  return covered / total;
}

/**
 * Compute the report summary from the aggregated data.
 */
export function computeSummary(
  totalDirectories: number,
  coveredDirectories: number,
  missingDirectories: number,
  details: ReportDetails,
  customContentStats: CustomContentStats,
): ReportSummary {
  return {
    total_directories: totalDirectories,
    covered_directories: coveredDirectories,
    missing_directories: missingDirectories,
    coverage_rate: computeCoverageRate(coveredDirectories, totalDirectories),
    passed: computePassed(details),
    custom_content_stats: customContentStats,
  };
}

// ---------------------------------------------------------------------------
// Pipeline implementation
// ---------------------------------------------------------------------------

/**
 * Run the complete validation pipeline.
 *
 * @param config - Fully resolved and validated configuration.
 * @param directories - Optional pre-resolved list of directory paths.
 *                      When provided, only these directories are scanned
 *                      (passed to scanDirectories as config override).
 * @param moduleRegistry - Optional module registry for dependency injection.
 *                         When not provided, default real implementations are used.
 * @returns Complete pipeline result with check report and per-directory data.
 */
export function runPipeline(
  config: CheckConfig,
  directories?: string[],
  moduleRegistry?: ModuleRegistry,
): PipelineResult {
  const registry = moduleRegistry ?? createDefaultRegistry();

  // ---- Step 1: Scan directories ----
  let dirInfos: DirectoryInfo[];
  if (directories && directories.length > 0) {
    // Use provided directory paths as-is, assign depth based on path separators
    dirInfos = directories.map((dir) => {
      const relativePath = dir === config.target ? "." : dir;
      // Depth = number of path separators + 1 (matching directory-scanner convention)
      const sepCount = relativePath === "."
        ? 0
        : relativePath.split(/[/\\]/).filter(Boolean).length - 1;
      const depth = relativePath === "." ? 1 : sepCount + 2;
      return { directory: relativePath, depth };
    });
  } else {
    dirInfos = registry.scanDirectories(config);
  }

  // ---- Step 2: Check file existence ----
  const existenceResults = registry.checkFileExistence(
    dirInfos,
    config.filename,
    config.target,
  );

  // ---- Accumulators for detail entries ----
  const missingFiles: MissingFileEntry[] = [];
  const markerIssues: MarkerIssueEntry[] = [];
  const contentIssues: ContentIssueEntry[] = [];
  const encodingIssues: EncodingIssueEntry[] = [];
  const oversizedFiles: OversizedFileEntry[] = [];
  const requiredAnyMissing: RequiredAnyMissingEntry[] = [];
  const requiredAllMissing: RequiredAllMissingEntry[] = [];
  const forbiddenFound: ForbiddenFoundEntry[] = [];
  const disallowedSections: DisallowedSectionEntry[] = [];
  const filesystemMismatches: FilesystemMismatchEntry[] = [];
  const staleEntries: StaleEntry[] = [];

  // Accumulators for stats
  const markerPositionStats: Record<MarkerPositionClassification, number> = {
    head: 0,
    middle: 0,
    tail: 0,
  };
  let customContentCount = 0;
  let markerOnlyCount = 0;

  // ---- Step 3: Process each directory ----
  const directoryReports: DirectoryReport[] = existenceResults.map(
    (existResult) => {
      const dirPath = existResult.directory;
      const depth = existResult.depth;
      const filePath = existResult.filePath;

      // --- Gate 1: File existence ---
      if (!existResult.fileExists) {
        missingFiles.push({ directory: dirPath, depth });
        return { directory: dirPath, depth, file_report: null };
      }

      // --- Gate 2: File size ---
      const sizeResult = registry.validateFileSize(filePath, config.max_file_size);
      if (!sizeResult.passed) {
        oversizedFiles.push({
          file: filePath,
          actual_size: sizeResult.actual_size,
          max_size: sizeResult.max_size,
        });

        // File exists but is oversized: produce a minimal FileReport
        const fileReport: FileReport = {
          file: filePath,
          directory: dirPath,
          depth,
          passed: false,
          file_size: sizeResult.actual_size,
          detected_encoding: "",
          marker_count: 0,
          marker_issues: [],
          content_length: 0,
          marker_position: null,
          content_classification: "marker_only",
          required_any_missing: [],
          required_all_missing: [],
          forbidden_found: [],
          filesystem_mismatch: null,
          stale_info: null,
        };
        return { directory: dirPath, depth, file_report: fileReport };
      }

      // --- Gate 3: Encoding ---
      const encodingResult = registry.validateEncoding(
        filePath,
        config.expected_encoding,
      );
      if (!encodingResult.passed) {
        encodingIssues.push({
          file: filePath,
          detected_encoding: encodingResult.detectedEncoding,
          expected_encoding: encodingResult.expectedEncoding,
        });

        const fileReport: FileReport = {
          file: filePath,
          directory: dirPath,
          depth,
          passed: false,
          file_size: sizeResult.actual_size,
          detected_encoding: encodingResult.detectedEncoding,
          marker_count: 0,
          marker_issues: [],
          content_length: 0,
          marker_position: null,
          content_classification: "marker_only",
          required_any_missing: [],
          required_all_missing: [],
          forbidden_found: [],
          filesystem_mismatch: null,
          stale_info: null,
        };
        return { directory: dirPath, depth, file_report: fileReport };
      }

      // --- Read file content (needed for all further checks) ---
      let fileContent: string;
      try {
        fileContent = registry.readFile(filePath);
      } catch {
        // If reading fails, treat as encoding failure
        encodingIssues.push({
          file: filePath,
          detected_encoding: "unreadable",
          expected_encoding: config.expected_encoding,
        });
        const fileReport: FileReport = {
          file: filePath,
          directory: dirPath,
          depth,
          passed: false,
          file_size: sizeResult.actual_size,
          detected_encoding: "unreadable",
          marker_count: 0,
          marker_issues: [],
          content_length: 0,
          marker_position: null,
          content_classification: "marker_only",
          required_any_missing: [],
          required_all_missing: [],
          forbidden_found: [],
          filesystem_mismatch: null,
          stale_info: null,
        };
        return { directory: dirPath, depth, file_report: fileReport };
      }

      // --- Gate 4: Hand-written file (report-only, non-failing) ---
      // A CLAUDE.md with no `# AI Coding Auto Sections` heading and no markers
      // is a legitimate hand-written state. Per the rewritten skill's
      // REPORT-ONLY rule, we skip marker validation entirely so the run does
      // not fail on a missing-section / missing-marker error for this file.
      // Files that carry the heading OR any marker still fall through to the
      // normal paired-marker checks, so broken pairs remain failing.
      if (
        isHandWrittenFile(
          fileContent,
          config.markers.start,
          config.markers.end,
        )
      ) {
        const fileReport: FileReport = {
          file: filePath,
          directory: dirPath,
          depth,
          passed: true,
          file_size: sizeResult.actual_size,
          detected_encoding: encodingResult.detectedEncoding,
          marker_count: 0,
          marker_issues: [],
          content_length: 0,
          marker_position: null,
          content_classification: "marker_only",
          required_any_missing: [],
          required_all_missing: [],
          forbidden_found: [],
          filesystem_mismatch: null,
          stale_info: null,
        };
        return { directory: dirPath, depth, file_report: fileReport };
      }

      // --- Gate 5: Paired markers ---
      const markerResult = registry.validatePairedMarkers(
        fileContent,
        config.markers.start,
        config.markers.end,
        config.min_content_length,
        filePath,
      );

      // Separate structural issues from content issues
      const structuralIssues = filterStructuralIssues(markerResult.issues);
      const hasStructural = hasStructuralMarkerIssues(markerResult.issues);

      // Always record marker issues (structural ones go to markerIssues)
      if (structuralIssues.length > 0) {
        markerIssues.push({
          file: filePath,
          issues: structuralIssues,
          marker_count: markerResult.marker_count,
        });
      }

      // content_too_short goes to content_issues, NOT marker_issues
      if (markerResult.content_issue !== null) {
        contentIssues.push({
          file: markerResult.content_issue.file,
          issues: markerResult.content_issue.issues,
          detail: markerResult.content_issue.detail,
        });
      }

      // If structural marker issues exist, skip marker-dependent checks
      if (hasStructural) {
        const fileReport: FileReport = {
          file: filePath,
          directory: dirPath,
          depth,
          passed: false,
          file_size: sizeResult.actual_size,
          detected_encoding: encodingResult.detectedEncoding,
          marker_count: markerResult.marker_count,
          marker_issues: structuralIssues,
          content_length: markerResult.extracted_content?.length ?? 0,
          marker_position: null,
          content_classification: "marker_only",
          required_any_missing: [],
          required_all_missing: [],
          forbidden_found: [],
          filesystem_mismatch: null,
          stale_info: null,
        };
        return { directory: dirPath, depth, file_report: fileReport };
      }

      // --- Step 5: Marker-dependent checks (only when markers are structurally valid) ---

      // Required patterns
      const patternResult = registry.validateRequiredPatterns(
        filePath,
        fileContent,
        config.required_any_patterns,
        config.required_all_patterns,
      );
      if (patternResult.required_any_missing.length > 0) {
        requiredAnyMissing.push({
          file: filePath,
          patterns: patternResult.required_any_missing,
        });
      }
      for (const missing of patternResult.required_all_missing) {
        requiredAllMissing.push({
          file: filePath,
          missing_pattern: missing,
        });
      }

      // Forbidden patterns
      const forbiddenResults = registry.validateForbiddenPatterns(
        filePath,
        fileContent,
        config.forbidden_patterns,
      );
      forbiddenFound.push(...forbiddenResults);

      // Allowed sections (adaptive): every `## ` heading inside the marker
      // block must belong to the configured allowed set. Headings outside the
      // markers are not examined. Optional registry hook → no-op when omitted.
      const disallowedResults = registry.validateAllowedSections
        ? registry.validateAllowedSections(
            filePath,
            fileContent,
            config.markers.start,
            config.markers.end,
            config.allowed_section_names,
          )
        : [];
      disallowedSections.push(...disallowedResults);

      // Content-disk consistency
      const fullDirPath = resolve(join(config.target, dirPath));
      const consistencyResult = registry.checkConsistency(
        fullDirPath,
        fileContent,
        config.markers,
        config,
      );
      let filesystemMismatch: FileReport["filesystem_mismatch"] = null;
      if (consistencyResult !== null) {
        filesystemMismatch = {
          unrecorded: consistencyResult.unrecorded,
          nonexistent: consistencyResult.nonexistent,
        };
        filesystemMismatches.push({
          directory: consistencyResult.directory,
          file: consistencyResult.file,
          unrecorded: consistencyResult.unrecorded,
          nonexistent: consistencyResult.nonexistent,
        });
      }

      // File change detection
      let staleInfo: FileReport["stale_info"] = null;
      const changeResult = registry.detectFileChanges(
        fullDirPath,
        config.markers.start,
        config.markers.update_time_field,
        new Date().toISOString(),
      );
      if (changeResult.staleness !== null) {
        staleEntries.push(changeResult.staleness);
        staleInfo = {
          update_time: changeResult.staleness.update_time,
          stale_files: changeResult.staleness.stale_files,
          fallback_to_file_mtime: changeResult.staleness.fallback_to_file_mtime,
        };
      }

      // Marker position
      const markerPosition = registry.analyzeMarkerPosition(
        fileContent,
        config.markers,
      );
      markerPositionStats[markerPosition]++;

      // Custom content classification
      const contentClassification = registry.analyzeCustomContent(
        fileContent,
        config.markers,
      );
      if (contentClassification === "has_custom_content") {
        customContentCount++;
      } else {
        markerOnlyCount++;
      }

      // Build the full FileReport for this directory
      const filePassed =
        structuralIssues.length === 0 &&
        markerResult.content_issue === null &&
        patternResult.required_any_missing.length === 0 &&
        patternResult.required_all_missing.length === 0 &&
        forbiddenResults.length === 0 &&
        disallowedResults.length === 0 &&
        consistencyResult === null &&
        staleInfo === null;

      const fileReport: FileReport = {
        file: filePath,
        directory: dirPath,
        depth,
        passed: filePassed,
        file_size: sizeResult.actual_size,
        detected_encoding: encodingResult.detectedEncoding,
        marker_count: markerResult.marker_count,
        marker_issues: structuralIssues,
        content_length: markerResult.extracted_content?.length ?? 0,
        marker_position: markerPosition,
        content_classification: contentClassification,
        required_any_missing: patternResult.required_any_missing,
        required_all_missing: patternResult.required_all_missing,
        forbidden_found: forbiddenResults.length > 0
          ? forbiddenResults[0].matches
          : [],
        filesystem_mismatch: filesystemMismatch,
        stale_info: staleInfo,
      };

      return { directory: dirPath, depth, file_report: fileReport };
    },
  );

  // ---- Step 4: Aggregate results ----

  // Build details
  const details: ReportDetails = {
    missing_files: missingFiles,
    marker_issues: markerIssues,
    content_issues: contentIssues,
    encoding_issues: encodingIssues,
    oversized_files: oversizedFiles,
    pattern_issues: {
      required_any_missing: requiredAnyMissing,
      required_all_missing: requiredAllMissing,
      forbidden_found: forbiddenFound,
    },
    disallowed_sections: disallowedSections,
    filesystem_mismatches: filesystemMismatches,
    stale_entries: staleEntries,
  };

  // Count directories
  const totalDirectories = directoryReports.length;
  const coveredDirectories = directoryReports.filter(
    (dr) => dr.file_report !== null,
  ).length;
  const missingDirectories = totalDirectories - coveredDirectories;

  // Compute custom content stats
  const customContentStats: CustomContentStats = {
    has_custom_content: customContentCount,
    marker_only: markerOnlyCount,
  };

  // Compute summary
  const summary = computeSummary(
    totalDirectories,
    coveredDirectories,
    missingDirectories,
    details,
    customContentStats,
  );

  // Compute depth distribution
  const depthEntries = directoryReports.map((dr) => ({
    path: dr.directory,
    depth: dr.depth,
    fileExists: dr.file_report !== null,
  }));

  // Use directory-depth-distributor module
  const { computeDepthDistribution } = require("./directory-depth-distributor.js");
  const depthDistribution = computeDepthDistribution(depthEntries);

  // Build meta
  const meta: ReportMeta = {
    tool_version: "0.1.0",
    timestamp: new Date().toISOString(),
    target: config.target,
    config,
  };

  const result: CheckResult = {
    meta,
    summary,
    depth_distribution: depthDistribution,
    marker_position_stats: markerPositionStats,
    details,
  };

  return { result, directoryReports };
}
