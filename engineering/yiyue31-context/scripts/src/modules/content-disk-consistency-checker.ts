/**
 * Content-disk consistency checker module.
 *
 * Compares the entries listed inside a marker block against the
 * actual filesystem contents, detecting unrecorded or phantom entries.
 *
 * Three-step process:
 * 1. Disk scan — read directory entries, apply exclude/filter rules.
 * 2. File parse — extract backtick-enclosed names from the marker section.
 * 3. Diff — compare disk entries vs parsed entries by name+type.
 */

import { readdirSync } from "node:fs";
import type {
  CheckConfig,
  ConsistencyCheckResult,
  DiskEntry,
  MarkerConfig,
} from "../types/index.js";
import { findMarkerIndex, matchedMarkerLength } from "./marker-matcher.js";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Determine whether a name looks like it has a file extension.
 * A name has an extension if it contains at least one '.' that is not
 * the first character (so ".gitignore" counts as having an extension).
 */
function hasExtension(name: string): boolean {
  const lastDot = name.lastIndexOf(".");
  return lastDot > 0;
}

/**
 * Scan a physical directory and return entries filtered by config rules.
 *
 * - Entries matching `config.exclude` by name are skipped.
 * - The entry whose name equals `config.filename` is skipped (the marker
 *   file itself is not a disk entry to compare).
 */
function scanDisk(
  directoryPath: string,
  config: CheckConfig,
): DiskEntry[] {
  const entries = readdirSync(directoryPath, { withFileTypes: true });
  const result: DiskEntry[] = [];

  for (const entry of entries) {
    const name = entry.name;

    // Skip the marker file itself
    if (name === config.filename) {
      continue;
    }

    // Skip excluded names
    if (config.exclude.includes(name)) {
      continue;
    }

    if (entry.isFile()) {
      result.push({ name, type: "file" });
    } else if (entry.isDirectory()) {
      result.push({ name, type: "directory" });
    }
    // Ignore other entry types (symlinks, etc.)
  }

  return result;
}

/**
 * Extract the content between start and end markers using indexOf.
 * Returns `null` when markers are not found or are in wrong order.
 */
function extractMarkerContent(
  fileContent: string,
  markers: MarkerConfig,
): string | null {
  const startIdx = findMarkerIndex(fileContent, markers.start);
  if (startIdx === -1) {
    return null;
  }

  const contentStartIdx = startIdx + matchedMarkerLength(fileContent, markers.start, startIdx);
  const endIdx = findMarkerIndex(fileContent, markers.end, contentStartIdx);
  if (endIdx === -1) {
    return null;
  }

  return fileContent.slice(contentStartIdx, endIdx);
}

/**
 * Parse backtick-enclosed names from the marker content.
 *
 * Rules:
 * - Extract the first backtick-enclosed entry per line.
 * - Trailing '/' suffix on the name → directory type.
 * - Has an extension (contains '.' after position 0) → file type.
 * - No suffix, no extension → file type (rule 1).
 * - Empty backticks (``) are skipped and recorded as parse errors.
 * - @scope/package names are parsed correctly.
 * - Names with spaces are handled correctly.
 */
function parseMarkerContent(markerContent: string): {
  entries: DiskEntry[];
  parseErrors: string[];
} {
  const entries: DiskEntry[] = [];
  const parseErrors: string[] = [];
  const lines = markerContent.split("\n");

  for (const line of lines) {
    const firstBacktick = line.indexOf("`");
    if (firstBacktick === -1) {
      continue;
    }

    const secondBacktick = line.indexOf("`", firstBacktick + 1);
    if (secondBacktick === -1) {
      continue;
    }

    const rawName = line.slice(firstBacktick + 1, secondBacktick);

    // Empty backticks — record parse error and skip
    if (rawName.length === 0) {
      parseErrors.push(line.trim());
      continue;
    }

    // Determine type
    let name = rawName;
    let type: "file" | "directory";

    if (name.endsWith("/")) {
      type = "directory";
      name = name.slice(0, -1);
    } else if (hasExtension(name)) {
      type = "file";
    } else {
      // No suffix, no extension → file (rule 1)
      type = "file";
    }

    entries.push({ name, type });
  }

  return { entries, parseErrors };
}

/**
 * Compute the diff between disk entries and parsed entries.
 */
function diffEntries(
  diskEntries: DiskEntry[],
  parsedEntries: DiskEntry[],
): { unrecorded: string[]; nonexistent: string[] } {
  const parsedSet = new Set(parsedEntries.map((e) => `${e.name}\0${e.type}`));
  const diskSet = new Set(diskEntries.map((e) => `${e.name}\0${e.type}`));

  const unrecorded: string[] = [];
  for (const entry of diskEntries) {
    const key = `${entry.name}\0${entry.type}`;
    if (!parsedSet.has(key)) {
      unrecorded.push(entry.name);
    }
  }

  const nonexistent: string[] = [];
  for (const entry of parsedEntries) {
    const key = `${entry.name}\0${entry.type}`;
    if (!diskSet.has(key)) {
      nonexistent.push(entry.name);
    }
  }

  return { unrecorded, nonexistent };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check filesystem consistency between marker block content and disk.
 *
 * @param directoryPath - Absolute path to the directory to scan.
 * @param fileContent   - Full content of the marker file (including markers).
 * @param markers       - Marker delimiter configuration.
 * @param config        - Fully resolved check configuration.
 * @returns Consistency check result, or `null` when there is a perfect match
 *          and no parse errors.
 */
export function checkConsistency(
  directoryPath: string,
  fileContent: string,
  markers: MarkerConfig,
  config: CheckConfig,
): ConsistencyCheckResult | null {
  // Step 1: Scan the physical directory
  const diskEntries = scanDisk(directoryPath, config);

  // Step 2: Extract and parse marker content
  const markerContent = extractMarkerContent(fileContent, markers);
  const parsedResult = markerContent !== null
    ? parseMarkerContent(markerContent)
    : { entries: [] as DiskEntry[], parseErrors: [] as string[] };

  // Step 3: Diff
  const { unrecorded, nonexistent } = diffEntries(
    diskEntries,
    parsedResult.entries,
  );

  // Return null only when everything matches perfectly and no parse errors
  if (
    unrecorded.length === 0 &&
    nonexistent.length === 0 &&
    parsedResult.parseErrors.length === 0
  ) {
    return null;
  }

  return {
    directory: directoryPath,
    file: config.filename,
    unrecorded,
    nonexistent,
  };
}
