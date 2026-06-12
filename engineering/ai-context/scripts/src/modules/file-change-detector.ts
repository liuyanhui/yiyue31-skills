/**
 * File change detector module.
 *
 * Detects staleness by comparing the marker block's `update_time`
 * field against the modification times of sibling files, identifying
 * files that have changed since the last recorded update.
 *
 * Process:
 * 1. Parse the `update_time` value from pipe-delimited key-value pairs
 *    in the start marker content.
 * 2. If the field is missing, fall back to the provided fallbackMtime.
 * 3. Validate the timestamp format (ISO 8601).
 * 4. Scan the directory for immediate-child files (non-recursive).
 * 5. Compare each file's mtime against the baseline timestamp.
 * 6. Return staleness information and any errors.
 */

import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type {
  FileChangeDetectionResult,
  FileChangeDetectionError,
  StaleEntry,
  StaleFileInfo,
} from "../types/index.js";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Extract the update_time value from pipe-delimited key-value pairs
 * in the start marker content.
 *
 * Expected format: `key1: value1 | key2: value2 | ...`
 * Trims whitespace around keys and values.
 *
 * @returns The raw string value, or `undefined` if the field is absent.
 */
function extractUpdateTime(
  startMarkerContent: string,
  updateTimeField: string,
): string | undefined {
  const segments = startMarkerContent.split("|");

  for (const segment of segments) {
    const colonIdx = segment.indexOf(":");
    if (colonIdx === -1) {
      continue;
    }

    const key = segment.slice(0, colonIdx).trim();
    const value = segment.slice(colonIdx + 1).trim();

    if (key === updateTimeField) {
      return value;
    }
  }

  return undefined;
}

/**
 * Parse a timestamp string as ISO 8601.
 *
 * @returns A valid Date object, or `null` if the string cannot be parsed.
 */
function parseTimestamp(rawValue: string): Date | null {
  const ms = Date.parse(rawValue);
  if (isNaN(ms)) {
    return null;
  }
  return new Date(ms);
}

/**
 * Scan a directory for immediate-child files (non-recursive).
 * Skips directories and other non-file entries.
 *
 * @returns Array of objects with the file name and its mtime (Date).
 */
function scanFiles(
  directoryPath: string,
): Array<{ name: string; mtime: Date }> {
  const entries = readdirSync(directoryPath, { withFileTypes: true });
  const result: Array<{ name: string; mtime: Date }> = [];

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }

    const fullPath = join(directoryPath, entry.name);
    const stats = statSync(fullPath);
    result.push({ name: entry.name, mtime: stats.mtime });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Detect file changes relative to the marker block's update timestamp.
 *
 * @param directoryPath     - Parent directory containing the file and its siblings.
 * @param startMarkerContent - Content of the start marker line (pipe-delimited
 *                             key-value pairs, e.g.
 *                             `<!-- skill: ai-context | version: 0.0.1 | update_time: 2026-06-11T20:30:00 -->`).
 * @param updateTimeField   - Name of the timestamp field in the marker (e.g. `"update_time"`).
 * @param fallbackMtime     - Fallback baseline timestamp (Date or ISO string) when the
 *                             update_time field is absent.
 * @returns Staleness information and any errors encountered.
 */
export function detectFileChanges(
  directoryPath: string,
  startMarkerContent: string,
  updateTimeField: string,
  fallbackMtime: Date | string,
): FileChangeDetectionResult {
  // Step 1: Extract update_time from start marker content
  const rawTimestamp = extractUpdateTime(startMarkerContent, updateTimeField);

  let baseline: Date;
  let fallbackUsed = false;

  if (rawTimestamp === undefined) {
    // Step 2: Field missing → use fallbackMtime
    if (typeof fallbackMtime === "string") {
      const parsed = parseTimestamp(fallbackMtime);
      if (parsed === null) {
        return {
          staleness: null,
          errors: [
            {
              directory: directoryPath,
              file: "",
              code: "invalid_timestamp_format",
              message: `Fallback mtime is not a valid ISO 8601 timestamp: ${fallbackMtime}`,
              rawValue: fallbackMtime,
            },
          ],
        };
      }
      baseline = parsed;
    } else {
      baseline = new Date(fallbackMtime.getTime());
    }
    fallbackUsed = true;
  } else {
    // Step 3: Validate timestamp format
    const parsed = parseTimestamp(rawTimestamp);
    if (parsed === null) {
      return {
        staleness: null,
        errors: [
          {
            directory: directoryPath,
            file: "",
            code: "invalid_timestamp_format",
            message: `Invalid ISO 8601 timestamp for field "${updateTimeField}": ${rawTimestamp}`,
            rawValue: rawTimestamp,
          },
        ],
      };
    }
    baseline = parsed;
  }

  // Step 4: Scan directory for files
  const files = scanFiles(directoryPath);

  // Step 5: Compare mtime against baseline
  const staleFiles: StaleFileInfo[] = [];
  for (const file of files) {
    if (file.mtime.getTime() > baseline.getTime()) {
      staleFiles.push({
        name: file.name,
        mtime: file.mtime.toISOString(),
      });
    }
  }

  // Step 6: Build result
  const updateTimeISO = baseline.toISOString();

  const staleness: StaleEntry = {
    directory: directoryPath,
    file: "",
    update_time: updateTimeISO,
    stale_files: staleFiles,
    fallback_to_file_mtime: fallbackUsed,
  };

  return {
    staleness,
    errors: [],
  };
}
