/**
 * Tests for the directory-scanner module.
 */

import { scanDirectories } from "../../src/modules/directory-scanner.js";
import { mkdirSync, rmSync, symlinkSync, existsSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { CheckConfig } from "../../src/types/index.js";
import { DEFAULT_CONFIG } from "../../src/types/index.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a fully-resolved CheckConfig with sensible defaults. */
function makeConfig(overrides: Partial<CheckConfig> = {}): CheckConfig {
  return {
    target: "/valid/target",
    filename: "CLAUDE.md",
    exclude: [],
    include: [],
    markers: {
      start: "<!-- skill: yiyue31-context -->",
      end: "<!-- /yiyue31-context -->",
      update_time_field: "update_time",
    },
    required_any_patterns: [],
    required_all_patterns: [],
    forbidden_patterns: [],
    min_content_length: 1,
    max_file_size: 51200,
    expected_encoding: "utf-8",
    output: {},
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Fixture root
// ---------------------------------------------------------------------------

const FIXTURE_ROOT = join(__dirname, "..", "fixtures", "directory-scanner");

// ---------------------------------------------------------------------------
// Fixture creation helpers
// ---------------------------------------------------------------------------

function createFlatStructure(base: string): void {
  mkdirSync(join(base, "flat", "subdir1"), { recursive: true });
  mkdirSync(join(base, "flat", "subdir2"), { recursive: true });
  // Place a file alongside the directories so the non-directory branch is exercised
  writeFileSync(join(base, "flat", "readme.txt"), "hello");
}

function createNestedStructure(base: string): void {
  mkdirSync(join(base, "nested", "level2a", "level3a"), { recursive: true });
  mkdirSync(join(base, "nested", "level2a", "level3b"), { recursive: true });
  mkdirSync(join(base, "nested", "level2b"), { recursive: true });
}

function createExcludeTestStructure(base: string): void {
  mkdirSync(join(base, "exclude-test", "node_modules", "inner"), { recursive: true });
  mkdirSync(join(base, "exclude-test", "src"), { recursive: true });
  mkdirSync(join(base, "exclude-test", "dist"), { recursive: true });
}

function createIncludeTestStructure(base: string): void {
  mkdirSync(join(base, "include-test", "test", "inner"), { recursive: true });
  mkdirSync(join(base, "include-test", "src"), { recursive: true });
}

function createSymlinkTestStructure(base: string): void {
  const realDir = join(base, "symlink-test", "real-dir");
  mkdirSync(realDir, { recursive: true });
  mkdirSync(join(base, "symlink-test", "other-dir"), { recursive: true });

  // Create symlink: link-dir -> real-dir
  const linkPath = join(base, "symlink-test", "link-dir");
  const target = realDir;
  try {
    symlinkSync(target, linkPath, "dir");
  } catch {
    // On some environments symlink creation may fail; the test will be skipped
  }
}

function createEmptyStructure(base: string): void {
  mkdirSync(join(base, "empty-target"), { recursive: true });
}

function createAllExcludedStructure(base: string): void {
  mkdirSync(join(base, "all-excluded", "node_modules"), { recursive: true });
  mkdirSync(join(base, "all-excluded", "dist"), { recursive: true });
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeAll(() => {
  // Create all fixture directories
  createFlatStructure(FIXTURE_ROOT);
  createNestedStructure(FIXTURE_ROOT);
  createExcludeTestStructure(FIXTURE_ROOT);
  createIncludeTestStructure(FIXTURE_ROOT);
  createSymlinkTestStructure(FIXTURE_ROOT);
  createEmptyStructure(FIXTURE_ROOT);
  createAllExcludedStructure(FIXTURE_ROOT);
});

afterAll(() => {
  // Clean up all fixtures
  if (existsSync(FIXTURE_ROOT)) {
    rmSync(FIXTURE_ROOT, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Test 1: Flat structure — target at depth 1, subdirs at depth 2
// ---------------------------------------------------------------------------
describe("scanDirectories — flat structure", () => {
  it("returns target at depth 1 and subdirs at depth 2", () => {
    const target = join(FIXTURE_ROOT, "flat");
    const config = makeConfig({ target });
    const result = scanDirectories(config);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ directory: ".", depth: 1 });

    const dirNames = result.slice(1).map((d) => d.directory);
    expect(dirNames).toContain("subdir1");
    expect(dirNames).toContain("subdir2");

    expect(result[1].depth).toBe(2);
    expect(result[2].depth).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Test 2: Nested dirs — correct depths (1, 2, 3)
// ---------------------------------------------------------------------------
describe("scanDirectories — nested structure", () => {
  it("returns directories at correct depths in breadth-first order", () => {
    const target = join(FIXTURE_ROOT, "nested");
    const config = makeConfig({ target });
    const result = scanDirectories(config);

    // Root at depth 1
    expect(result[0]).toEqual({ directory: ".", depth: 1 });

    // level2a and level2b at depth 2
    const depth2 = result.filter((d) => d.depth === 2);
    expect(depth2).toHaveLength(2);
    const depth2Names = depth2.map((d) => d.directory);
    expect(depth2Names).toContain("level2a");
    expect(depth2Names).toContain("level2b");

    // level3a and level3b at depth 3 (children of level2a)
    const depth3 = result.filter((d) => d.depth === 3);
    expect(depth3).toHaveLength(2);
    const depth3Names = depth3.map((d) => d.directory);
    expect(depth3Names).toContain(join("level2a", "level3a"));
    expect(depth3Names).toContain(join("level2a", "level3b"));

    // Total: 1 root + 2 at depth2 + 2 at depth3 = 5
    expect(result).toHaveLength(5);
  });

  it("orders results breadth-first", () => {
    const target = join(FIXTURE_ROOT, "nested");
    const config = makeConfig({ target });
    const result = scanDirectories(config);

    // All depth-2 entries must appear before any depth-3 entry
    const firstDepth3Index = result.findIndex((d) => d.depth === 3);
    const lastDepth2Index = result.map((d) => d.depth).lastIndexOf(2);
    expect(firstDepth3Index).toBeGreaterThan(lastDepth2Index);
  });
});

// ---------------------------------------------------------------------------
// Test 3: exclude=['node_modules'] skips dirs named 'node_modules'
// ---------------------------------------------------------------------------
describe("scanDirectories — exclude filtering", () => {
  it("skips directories named in exclude list", () => {
    const target = join(FIXTURE_ROOT, "exclude-test");
    const config = makeConfig({
      target,
      exclude: ["node_modules"],
    });
    const result = scanDirectories(config);

    // Root always included
    expect(result[0]).toEqual({ directory: ".", depth: 1 });

    // 'node_modules' and its children should not appear
    const allDirs = result.map((d) => d.directory);
    expect(allDirs).not.toContain("node_modules");
    expect(allDirs).not.toContain(join("node_modules", "inner"));

    // 'src' and 'dist' should be present
    expect(allDirs).toContain("src");
    expect(allDirs).toContain("dist");

    expect(result).toHaveLength(3); // root + src + dist
  });
});

// ---------------------------------------------------------------------------
// Test 4: include=['test'] overrides exclude=['test']
// ---------------------------------------------------------------------------
describe("scanDirectories — include overrides exclude", () => {
  it("includes directory named 'test' when it is in both exclude and include", () => {
    const target = join(FIXTURE_ROOT, "include-test");
    const config = makeConfig({
      target,
      exclude: ["test"],
      include: ["test"],
    });
    const result = scanDirectories(config);

    const allDirs = result.map((d) => d.directory);
    expect(allDirs).toContain("test");
    // 'inner' is a child of 'test', so it should also appear
    expect(allDirs).toContain(join("test", "inner"));
    expect(allDirs).toContain("src");

    // root + test + test/inner + src = 4
    expect(result).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// Test 5: Symlinks are skipped
// ---------------------------------------------------------------------------
describe("scanDirectories — symlink skipping", () => {
  it("does not include symlinked directories in results", () => {
    const linkPath = join(FIXTURE_ROOT, "symlink-test", "link-dir");
    // Skip this test if symlink creation failed (e.g. no permission on Windows)
    if (!existsSync(linkPath)) {
      return;
    }

    const target = join(FIXTURE_ROOT, "symlink-test");
    const config = makeConfig({ target });
    const result = scanDirectories(config);

    const allDirs = result.map((d) => d.directory);
    expect(allDirs).not.toContain("link-dir");
    // real-dir and other-dir should still appear
    expect(allDirs).toContain("real-dir");
    expect(allDirs).toContain("other-dir");
  });
});

// ---------------------------------------------------------------------------
// Test 6: Empty target returns only root at depth 1
// ---------------------------------------------------------------------------
describe("scanDirectories — empty target", () => {
  it("returns only the target root at depth 1 when no subdirs exist", () => {
    const target = join(FIXTURE_ROOT, "empty-target");
    const config = makeConfig({ target });
    const result = scanDirectories(config);

    expect(result).toEqual([{ directory: ".", depth: 1 }]);
  });
});

// ---------------------------------------------------------------------------
// Test 7: All subdirs excluded returns only target root
// ---------------------------------------------------------------------------
describe("scanDirectories — all subdirs excluded", () => {
  it("returns only target root when every subdir is excluded", () => {
    const target = join(FIXTURE_ROOT, "all-excluded");
    const config = makeConfig({
      target,
      exclude: ["node_modules", "dist"],
    });
    const result = scanDirectories(config);

    expect(result).toEqual([{ directory: ".", depth: 1 }]);
  });
});

// ---------------------------------------------------------------------------
// Test 8: Non-directory entries (files) are skipped
// ---------------------------------------------------------------------------
describe("scanDirectories — non-directory entries", () => {
  it("skips files and only returns directories", () => {
    const target = join(FIXTURE_ROOT, "flat");
    const config = makeConfig({ target });
    const result = scanDirectories(config);

    // Files like 'readme.txt' must not appear in results
    const allDirs = result.map((d) => d.directory);
    expect(allDirs).not.toContain("readme.txt");
    // Only root + subdir1 + subdir2
    expect(result).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// Test 9: Target that does not exist on disk
//   Passing a non-existent target directory. The first readdirSync call
//   will throw, and the catch block (line 60) skips it gracefully.
// ---------------------------------------------------------------------------
describe("scanDirectories — non-existent target path", () => {
  it("returns only the root entry when target cannot be read", () => {
    const target = join(FIXTURE_ROOT, "this-does-not-exist-at-all");
    const config = makeConfig({ target });
    const result = scanDirectories(config);

    // The root entry is always added; readdirSync on it throws,
    // so the catch block triggers and no subdirectories are found.
    expect(result).toEqual([{ directory: ".", depth: 1 }]);
  });
});
