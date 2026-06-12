/**
 * Report generator module.
 *
 * Takes the pipeline result and writes formatted reports to the
 * configured output destinations (JSON, Markdown, or both).
 *
 * Exported functions:
 * - normalizeToPosixPath — convert backslashes to forward slashes
 * - generateJsonReport — serialize CheckResult to formatted JSON
 * - generateMarkdownReport — produce human-readable Markdown
 * - generateReport — write files based on config.output settings
 */

import type {
  CheckConfig,
  CheckResult,
  PipelineResult,
  ReportSummary,
  DepthBucket,
  ReportDetails,
  MissingFileEntry,
  MarkerIssueEntry,
  ContentIssueEntry,
  EncodingIssueEntry,
  OversizedFileEntry,
  PatternIssues,
  FilesystemMismatchEntry,
  StaleEntry,
} from "../types/index.js";
import { writeFileSync } from "node:fs";
import { dirname, isAbsolute } from "node:path";
import { existsSync } from "node:fs";

// ---------------------------------------------------------------------------
// normalizeToPosixPath
// ---------------------------------------------------------------------------

/**
 * Replace all backslashes with forward slashes.
 *
 * Operates on the raw string — does not perform any real filesystem
 * path resolution. Used to normalise paths in report output.
 */
export function normalizeToPosixPath(p: string): string {
  return p.replace(/\\/g, "/");
}

// ---------------------------------------------------------------------------
// Deep normalise helper — walk a value and normalise every string that
// looks like it could be a path (heuristic: contains at least one
// backslash). This keeps non-path strings untouched while still
// catching paths embedded inside arrays and nested objects.
// ---------------------------------------------------------------------------

function deepNormalizePaths(value: unknown): unknown {
  if (typeof value === "string") {
    return value.includes("\\") ? normalizeToPosixPath(value) : value;
  }
  if (Array.isArray(value)) {
    return value.map(deepNormalizePaths);
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = deepNormalizePaths(v);
    }
    return out;
  }
  return value;
}

// ---------------------------------------------------------------------------
// generateJsonReport
// ---------------------------------------------------------------------------

/**
 * Serialize a {@link CheckResult} to a formatted JSON string.
 *
 * - All fields are present; empty issue arrays are `[]` (DEFER-005).
 * - All paths are normalised to POSIX (forward slashes).
 */
export function generateJsonReport(result: CheckResult): string {
  const normalised = deepNormalizePaths(result) as CheckResult;
  return JSON.stringify(normalised, null, 2);
}

// ---------------------------------------------------------------------------
// Markdown helpers
// ---------------------------------------------------------------------------

function summaryTable(summary: ReportSummary): string {
  const rate =
    summary.coverage_rate !== undefined
      ? `${(summary.coverage_rate * 100).toFixed(1)}%`
      : "N/A";

  return [
    "| Metric | Value |",
    "|---|---|",
    `| Total directories | ${summary.total_directories} |`,
    `| Covered directories | ${summary.covered_directories} |`,
    `| Missing directories | ${summary.missing_directories} |`,
    `| Coverage rate | ${rate} |`,
    `| Passed | ${summary.passed} |`,
    `| Custom content (has) | ${summary.custom_content_stats.has_custom_content} |`,
    `| Marker only | ${summary.custom_content_stats.marker_only} |`,
  ].join("\n");
}

function depthDistributionTable(
  dist: Record<string, DepthBucket>,
): string {
  const keys = Object.keys(dist).sort(
    (a, b) => Number(a) - Number(b),
  );
  if (keys.length === 0) return "";

  const lines = [
    "## Depth Distribution\n",
    "| Depth | Total | Covered | Missing |",
    "|---|---|---|---|",
  ];
  for (const k of keys) {
    const b = dist[k];
    lines.push(`| ${k} | ${b.total} | ${b.covered} | ${b.missing} |`);
  }
  return lines.join("\n");
}

function markerPositionStatsSection(
  stats: Record<string, number>,
): string {
  const lines = [
    "## Marker Position Stats\n",
    "| Position | Count |",
    "|---|---|",
  ];
  for (const [pos, count] of Object.entries(stats)) {
    lines.push(`| ${pos} | ${count} |`);
  }
  return lines.join("\n");
}

function customContentStatsSection(summary: ReportSummary): string {
  return [
    "## Custom Content Stats\n",
    `| Classification | Count |`,
    `|---|---|`,
    `| has_custom_content | ${summary.custom_content_stats.has_custom_content} |`,
    `| marker_only | ${summary.custom_content_stats.marker_only} |`,
  ].join("\n");
}

function missingFilesSection(entries: MissingFileEntry[]): string {
  if (entries.length === 0) return "";
  const lines = ["## Missing Files\n"];
  for (const e of entries) {
    const dir = normalizeToPosixPath(e.directory);
    lines.push(`- ${dir} (depth ${e.depth})`);
  }
  return lines.join("\n");
}

function markerIssuesSection(entries: MarkerIssueEntry[]): string {
  if (entries.length === 0) return "";
  const lines = ["## Marker Issues\n"];
  for (const e of entries) {
    const file = normalizeToPosixPath(e.file);
    lines.push(`- **${file}**: ${e.issues.join(", ")} (marker_count: ${e.marker_count})`);
  }
  return lines.join("\n");
}

function contentIssuesSection(entries: ContentIssueEntry[]): string {
  if (entries.length === 0) return "";
  const lines = ["## Content Issues\n"];
  for (const e of entries) {
    const file = normalizeToPosixPath(e.file);
    lines.push(
      `- **${file}**: ${e.issues.join(", ")} (actual: ${e.detail.actual_length}, min: ${e.detail.min_required})`,
    );
  }
  return lines.join("\n");
}

function encodingIssuesSection(entries: EncodingIssueEntry[]): string {
  if (entries.length === 0) return "";
  const lines = ["## Encoding Issues\n"];
  for (const e of entries) {
    const file = normalizeToPosixPath(e.file);
    lines.push(`- **${file}**: detected ${e.detected_encoding}, expected ${e.expected_encoding}`);
  }
  return lines.join("\n");
}

function oversizedFilesSection(entries: OversizedFileEntry[]): string {
  if (entries.length === 0) return "";
  const lines = ["## Oversized Files\n"];
  for (const e of entries) {
    const file = normalizeToPosixPath(e.file);
    lines.push(`- **${file}**: ${e.actual_size} bytes (max: ${e.max_size})`);
  }
  return lines.join("\n");
}

function patternIssuesSection(pi: PatternIssues): string {
  const parts: string[] = [];
  if (pi.required_any_missing.length > 0) {
    parts.push("### Required Any Missing\n");
    for (const e of pi.required_any_missing) {
      const file = normalizeToPosixPath(e.file);
      parts.push(`- **${file}**: missing patterns: ${e.patterns.join(", ")}`);
    }
  }
  if (pi.required_all_missing.length > 0) {
    parts.push("### Required All Missing\n");
    for (const e of pi.required_all_missing) {
      const file = normalizeToPosixPath(e.file);
      parts.push(`- **${file}**: missing pattern: ${e.missing_pattern}`);
    }
  }
  if (pi.forbidden_found.length > 0) {
    parts.push("### Forbidden Patterns Found\n");
    for (const e of pi.forbidden_found) {
      const file = normalizeToPosixPath(e.file);
      for (const m of e.matches) {
        parts.push(`- **${file}**: pattern \`${m.pattern}\` — ${m.context}`);
      }
    }
  }
  if (parts.length === 0) return "";
  parts.unshift("## Pattern Issues\n");
  return parts.join("\n");
}

function filesystemMismatchesSection(
  entries: FilesystemMismatchEntry[],
): string {
  if (entries.length === 0) return "";
  const lines = ["## Filesystem Mismatches\n"];
  for (const e of entries) {
    const dir = normalizeToPosixPath(e.directory);
    const file = normalizeToPosixPath(e.file);
    lines.push(
      `- **${file}** (${dir}): unrecorded: [${e.unrecorded.map(normalizeToPosixPath).join(", ")}], nonexistent: [${e.nonexistent.map(normalizeToPosixPath).join(", ")}]`,
    );
  }
  return lines.join("\n");
}

function staleEntriesSection(entries: StaleEntry[]): string {
  if (entries.length === 0) return "";
  const lines = ["## Stale Entries\n"];
  for (const e of entries) {
    const dir = normalizeToPosixPath(e.directory);
    const file = normalizeToPosixPath(e.file);
    const stale = e.stale_files
      .map((sf) => `${sf.name} (${sf.mtime})`)
      .join(", ");
    lines.push(
      `- **${file}** (${dir}): update_time=${e.update_time}, stale_files: ${stale}${e.fallback_to_file_mtime ? " [fallback_to_file_mtime]" : ""}`,
    );
  }
  return lines.join("\n");
}

function detailsSection(details: ReportDetails): string {
  const sections: string[] = [];

  const missing = missingFilesSection(details.missing_files);
  if (missing) sections.push(missing);

  const marker = markerIssuesSection(details.marker_issues);
  if (marker) sections.push(marker);

  const content = contentIssuesSection(details.content_issues);
  if (content) sections.push(content);

  const encoding = encodingIssuesSection(details.encoding_issues);
  if (encoding) sections.push(encoding);

  const oversized = oversizedFilesSection(details.oversized_files);
  if (oversized) sections.push(oversized);

  const patterns = patternIssuesSection(details.pattern_issues);
  if (patterns) sections.push(patterns);

  const fsMismatches = filesystemMismatchesSection(
    details.filesystem_mismatches,
  );
  if (fsMismatches) sections.push(fsMismatches);

  const stale = staleEntriesSection(details.stale_entries);
  if (stale) sections.push(stale);

  return sections.join("\n\n");
}

// ---------------------------------------------------------------------------
// generateMarkdownReport
// ---------------------------------------------------------------------------

const MTIME_WARNING =
  "\n> **mtime reliability warning**: git checkout, git clone, tar extraction may reset mtime.\n";

/**
 * Generate a human-readable Markdown report from a {@link CheckResult}.
 *
 * Includes:
 * - Title heading
 * - Summary table
 * - Detail sections for each non-empty issue category
 * - Depth distribution table
 * - Marker position stats table
 * - Custom content stats
 * - mtime reliability warning
 */
export function generateMarkdownReport(result: CheckResult): string {
  const parts: string[] = [];

  // Title
  parts.push("# AI Context Checker Report\n");

  // Summary
  parts.push("## Summary\n");
  parts.push(summaryTable(result.summary));

  // mtime warning (placed after summary)
  parts.push(MTIME_WARNING);

  // Details (only non-empty sections)
  const details = detailsSection(result.details);
  if (details) {
    parts.push(details);
  }

  // Depth distribution
  const depthTable = depthDistributionTable(result.depth_distribution);
  if (depthTable) {
    parts.push(depthTable);
  }

  // Marker position stats
  parts.push(markerPositionStatsSection(result.marker_position_stats));

  // Custom content stats
  parts.push(customContentStatsSection(result.summary));

  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// generateReport (main entry)
// ---------------------------------------------------------------------------

/**
 * Generate and write reports based on the pipeline result and config.
 *
 * - If `config.output.json` is set and non-empty: write JSON to that path.
 * - If `config.output.markdown` is set and non-empty: write Markdown to that path.
 * - If neither configured, no files are written.
 * - If the parent directory of an output path does not exist, throws an Error.
 */
export function generateReport(
  pipelineResult: PipelineResult,
  config: CheckConfig,
): void {
  const jsonPath = config.output.json;
  const mdPath = config.output.markdown;

  // Write JSON report
  if (jsonPath && jsonPath.length > 0) {
    const parentDir = dirname(jsonPath);
    if (!existsSync(parentDir)) {
      throw new Error(
        `Parent directory does not exist for JSON output: ${parentDir}`,
      );
    }
    const jsonContent = generateJsonReport(pipelineResult.result);
    writeFileSync(jsonPath, jsonContent, "utf-8");
  }

  // Write Markdown report
  if (mdPath && mdPath.length > 0) {
    const parentDir = dirname(mdPath);
    if (!existsSync(parentDir)) {
      throw new Error(
        `Parent directory does not exist for Markdown output: ${parentDir}`,
      );
    }
    const mdContent = generateMarkdownReport(pipelineResult.result);
    writeFileSync(mdPath, mdContent, "utf-8");
  }
}
