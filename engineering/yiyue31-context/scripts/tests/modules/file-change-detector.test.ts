/**
 * Tests for the file-change-detector module.
 */

import { detectFileChanges } from "../../src/modules/file-change-detector.js";
import {
  mkdirSync,
  rmSync,
  existsSync,
  writeFileSync,
  utimesSync,
} from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FIXTURE_ROOT = join(__dirname, "..", "fixtures", "file-change");

// Fixed timestamps for deterministic tests
const BASELINE_TS = "2026-06-11T20:30:00.000Z";
const BASELINE_DATE = new Date(BASELINE_TS);

// File mtimes: one older than baseline, one newer
const OLDER_MTIME = new Date("2026-06-10T10:00:00.000Z");
const NEWER_MTIME = new Date("2026-06-12T10:00:00.000Z");
const SAME_MTIME = new Date(BASELINE_TS);

// ---------------------------------------------------------------------------
// Fixture creation
// ---------------------------------------------------------------------------

function createFixtures(): void {
  // all-older/ — two files, both older than baseline → no stale files
  const allOlderDir = join(FIXTURE_ROOT, "all-older");
  mkdirSync(allOlderDir, { recursive: true });
  writeFileSync(join(allOlderDir, "file-a.ts"), "a");
  writeFileSync(join(allOlderDir, "file-b.ts"), "b");
  utimesSync(join(allOlderDir, "file-a.ts"), OLDER_MTIME, OLDER_MTIME);
  utimesSync(join(allOlderDir, "file-b.ts"), OLDER_MTIME, OLDER_MTIME);

  // one-newer/ — two files, one newer than baseline → one stale file
  const oneNewerDir = join(FIXTURE_ROOT, "one-newer");
  mkdirSync(oneNewerDir, { recursive: true });
  writeFileSync(join(oneNewerDir, "old.ts"), "old");
  writeFileSync(join(oneNewerDir, "new.ts"), "new");
  utimesSync(join(oneNewerDir, "old.ts"), OLDER_MTIME, OLDER_MTIME);
  utimesSync(join(oneNewerDir, "new.ts"), NEWER_MTIME, NEWER_MTIME);

  // empty-dir/ — no files → no stale files
  const emptyDir = join(FIXTURE_ROOT, "empty-dir");
  mkdirSync(emptyDir, { recursive: true });

  // multi-newer/ — three files, two newer than baseline → two stale files
  const multiNewerDir = join(FIXTURE_ROOT, "multi-newer");
  mkdirSync(multiNewerDir, { recursive: true });
  writeFileSync(join(multiNewerDir, "stale-1.ts"), "1");
  writeFileSync(join(multiNewerDir, "stale-2.ts"), "2");
  writeFileSync(join(multiNewerDir, "fresh.ts"), "fresh");
  utimesSync(join(multiNewerDir, "stale-1.ts"), NEWER_MTIME, NEWER_MTIME);
  utimesSync(join(multiNewerDir, "stale-2.ts"), NEWER_MTIME, NEWER_MTIME);
  utimesSync(join(multiNewerDir, "fresh.ts"), OLDER_MTIME, OLDER_MTIME);

  // with-subdir/ — has a subdirectory that should be skipped
  const withSubdirDir = join(FIXTURE_ROOT, "with-subdir");
  mkdirSync(withSubdirDir, { recursive: true });
  mkdirSync(join(withSubdirDir, "subdir"), { recursive: true });
  writeFileSync(join(withSubdirDir, "file.ts"), "content");
  utimesSync(join(withSubdirDir, "file.ts"), OLDER_MTIME, OLDER_MTIME);

  // same-mtime/ — file mtime exactly equals baseline → not stale
  const sameMtimeDir = join(FIXTURE_ROOT, "same-mtime");
  mkdirSync(sameMtimeDir, { recursive: true });
  writeFileSync(join(sameMtimeDir, "exact.ts"), "exact");
  utimesSync(join(sameMtimeDir, "exact.ts"), SAME_MTIME, SAME_MTIME);
}

function removeFixtures(): void {
  if (existsSync(FIXTURE_ROOT)) {
    rmSync(FIXTURE_ROOT, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeAll(() => {
  createFixtures();
});

afterAll(() => {
  removeFixtures();
});

// ---------------------------------------------------------------------------
// Helper to build a start marker content string
// ---------------------------------------------------------------------------

function markerContent(fields: Record<string, string>): string {
  return Object.entries(fields)
    .map(([k, v]) => `${k}: ${v}`)
    .join(" | ");
}

// ---------------------------------------------------------------------------
// Test 1: Valid timestamp, all files older → no stale files
// ---------------------------------------------------------------------------
describe("detectFileChanges — all files older than baseline", () => {
  it("returns no stale files when all files have mtime older than update_time", () => {
    const dir = join(FIXTURE_ROOT, "all-older");
    const content = markerContent({
      skill: "yiyue31-context",
      version: "0.0.1",
      update_time: BASELINE_TS,
    });

    const result = detectFileChanges(dir, content, "update_time", BASELINE_DATE);

    expect(result.errors).toEqual([]);
    expect(result.staleness).not.toBeNull();
    expect(result.staleness!.fallback_to_file_mtime).toBe(false);
    expect(result.staleness!.update_time).toBe(BASELINE_DATE.toISOString());
    expect(result.staleness!.stale_files).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Test 2: Valid timestamp, one file newer → stale file recorded
// ---------------------------------------------------------------------------
describe("detectFileChanges — one file newer than baseline", () => {
  it("records a single stale file when one file's mtime is newer", () => {
    const dir = join(FIXTURE_ROOT, "one-newer");
    const content = markerContent({
      skill: "yiyue31-context",
      version: "0.0.1",
      update_time: BASELINE_TS,
    });

    const result = detectFileChanges(dir, content, "update_time", BASELINE_DATE);

    expect(result.errors).toEqual([]);
    expect(result.staleness).not.toBeNull();
    expect(result.staleness!.stale_files.length).toBe(1);
    expect(result.staleness!.stale_files[0].name).toBe("new.ts");
    expect(result.staleness!.fallback_to_file_mtime).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Test 3: Missing update_time field → uses fallbackMtime, fallback flag set
// ---------------------------------------------------------------------------
describe("detectFileChanges — missing update_time field", () => {
  it("uses fallbackMtime as baseline and sets fallback_to_file_mtime=true", () => {
    const dir = join(FIXTURE_ROOT, "all-older");
    // Marker content without update_time field
    const content = markerContent({
      skill: "yiyue31-context",
      version: "0.0.1",
    });

    const result = detectFileChanges(dir, content, "update_time", BASELINE_DATE);

    expect(result.errors).toEqual([]);
    expect(result.staleness).not.toBeNull();
    expect(result.staleness!.fallback_to_file_mtime).toBe(true);
    expect(result.staleness!.update_time).toBe(BASELINE_DATE.toISOString());
    expect(result.staleness!.stale_files).toEqual([]);
  });

  it("accepts a string fallbackMtime", () => {
    const dir = join(FIXTURE_ROOT, "all-older");
    const content = markerContent({ skill: "yiyue31-context" });

    const result = detectFileChanges(dir, content, "update_time", BASELINE_TS);

    expect(result.errors).toEqual([]);
    expect(result.staleness).not.toBeNull();
    expect(result.staleness!.fallback_to_file_mtime).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Test 4: Invalid timestamp format → error result
// ---------------------------------------------------------------------------
describe("detectFileChanges — invalid timestamp format", () => {
  it("returns staleness=null with error when timestamp is invalid", () => {
    const dir = join(FIXTURE_ROOT, "all-older");
    const content = markerContent({
      skill: "yiyue31-context",
      update_time: "not-a-date",
    });

    const result = detectFileChanges(dir, content, "update_time", BASELINE_DATE);

    expect(result.staleness).toBeNull();
    expect(result.errors.length).toBe(1);
    expect(result.errors[0].code).toBe("invalid_timestamp_format");
    expect(result.errors[0].rawValue).toBe("not-a-date");
    expect(result.errors[0].directory).toBe(dir);
  });

  it("returns error when fallbackMtime string is invalid", () => {
    const dir = join(FIXTURE_ROOT, "all-older");
    const content = markerContent({ skill: "yiyue31-context" });

    const result = detectFileChanges(dir, content, "update_time", "bad-fallback");

    expect(result.staleness).toBeNull();
    expect(result.errors.length).toBe(1);
    expect(result.errors[0].code).toBe("invalid_timestamp_format");
    expect(result.errors[0].rawValue).toBe("bad-fallback");
  });
});

// ---------------------------------------------------------------------------
// Test 5: Empty directory → no stale files
// ---------------------------------------------------------------------------
describe("detectFileChanges — empty directory", () => {
  it("returns empty stale_files array for an empty directory", () => {
    const dir = join(FIXTURE_ROOT, "empty-dir");
    const content = markerContent({
      skill: "yiyue31-context",
      update_time: BASELINE_TS,
    });

    const result = detectFileChanges(dir, content, "update_time", BASELINE_DATE);

    expect(result.errors).toEqual([]);
    expect(result.staleness).not.toBeNull();
    expect(result.staleness!.stale_files).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Test 6: Multiple files newer than timestamp → all recorded
// ---------------------------------------------------------------------------
describe("detectFileChanges — multiple stale files", () => {
  it("records all files with mtime newer than baseline", () => {
    const dir = join(FIXTURE_ROOT, "multi-newer");
    const content = markerContent({
      skill: "yiyue31-context",
      update_time: BASELINE_TS,
    });

    const result = detectFileChanges(dir, content, "update_time", BASELINE_DATE);

    expect(result.errors).toEqual([]);
    expect(result.staleness).not.toBeNull();
    expect(result.staleness!.stale_files.length).toBe(2);

    const names = result.staleness!.stale_files.map((f) => f.name).sort();
    expect(names).toEqual(["stale-1.ts", "stale-2.ts"]);
  });
});

// ---------------------------------------------------------------------------
// Test 7: Directory entries are skipped (non-recursive, files only)
// ---------------------------------------------------------------------------
describe("detectFileChanges — subdirectories are skipped", () => {
  it("only considers files, not subdirectories", () => {
    const dir = join(FIXTURE_ROOT, "with-subdir");
    const content = markerContent({
      skill: "yiyue31-context",
      update_time: BASELINE_TS,
    });

    const result = detectFileChanges(dir, content, "update_time", BASELINE_DATE);

    expect(result.errors).toEqual([]);
    expect(result.staleness).not.toBeNull();
    // subdir should not appear; only file.ts which is older
    expect(result.staleness!.stale_files).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Test 8: Marker content with segment missing colon → skipped gracefully
// ---------------------------------------------------------------------------
describe("detectFileChanges — segments without colon", () => {
  it("skips segments that have no colon and still parses valid fields", () => {
    const dir = join(FIXTURE_ROOT, "all-older");
    // "no-colon-segment" has no colon → should be skipped
    const content = "no-colon-segment | update_time: " + BASELINE_TS;

    const result = detectFileChanges(dir, content, "update_time", BASELINE_DATE);

    expect(result.errors).toEqual([]);
    expect(result.staleness).not.toBeNull();
    expect(result.staleness!.fallback_to_file_mtime).toBe(false);
    expect(result.staleness!.stale_files).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Test 9: File mtime exactly equal to baseline → not stale
// ---------------------------------------------------------------------------
describe("detectFileChanges — file mtime equals baseline", () => {
  it("does not flag files whose mtime exactly equals the baseline", () => {
    const dir = join(FIXTURE_ROOT, "same-mtime");
    const content = markerContent({
      skill: "yiyue31-context",
      update_time: BASELINE_TS,
    });

    const result = detectFileChanges(dir, content, "update_time", BASELINE_DATE);

    expect(result.errors).toEqual([]);
    expect(result.staleness).not.toBeNull();
    expect(result.staleness!.stale_files).toEqual([]);
  });
});
