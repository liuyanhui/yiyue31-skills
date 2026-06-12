/**
 * Tests for the file-existence-checker module.
 */

import { checkFileExistence } from "../../src/modules/file-existence-checker.js";
import {
  mkdirSync,
  rmSync,
  existsSync,
  writeFileSync,
  symlinkSync,
} from "node:fs";
import { join, resolve } from "node:path";
import type { DirectoryInfo } from "../../src/types/index.js";

// ---------------------------------------------------------------------------
// Fixture root
// ---------------------------------------------------------------------------

const FIXTURE_ROOT = join(__dirname, "..", "fixtures", "file-existence");

// ---------------------------------------------------------------------------
// Fixture creation
// ---------------------------------------------------------------------------

function createFixtures(): void {
  // has-file/CLAUDE.md — file exists
  const hasFileDir = join(FIXTURE_ROOT, "has-file");
  mkdirSync(hasFileDir, { recursive: true });
  writeFileSync(join(hasFileDir, "CLAUDE.md"), "# test content");

  // no-file/ — empty directory
  mkdirSync(join(FIXTURE_ROOT, "no-file"), { recursive: true });

  // link-file/link.md -> ../has-file/CLAUDE.md (symlink)
  const linkFileDir = join(FIXTURE_ROOT, "link-file");
  mkdirSync(linkFileDir, { recursive: true });
  const linkTarget = join(FIXTURE_ROOT, "has-file", "CLAUDE.md");
  const linkPath = join(linkFileDir, "link.md");
  try {
    symlinkSync(linkTarget, linkPath, "file");
  } catch {
    // Symlink creation may fail on some Windows environments without privs
  }

  // multi/sub1/CLAUDE.md
  const sub1Dir = join(FIXTURE_ROOT, "multi", "sub1");
  mkdirSync(sub1Dir, { recursive: true });
  writeFileSync(join(sub1Dir, "CLAUDE.md"), "# sub1 content");

  // multi/sub2/ — no file
  mkdirSync(join(FIXTURE_ROOT, "multi", "sub2"), { recursive: true });
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeAll(() => {
  createFixtures();
});

afterAll(() => {
  if (existsSync(FIXTURE_ROOT)) {
    rmSync(FIXTURE_ROOT, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Test 1: File exists → fileExists=true with resolved filePath
// ---------------------------------------------------------------------------
describe("checkFileExistence — file exists", () => {
  it("returns fileExists=true with the resolved filePath", () => {
    const targetRoot = join(FIXTURE_ROOT, "has-file");
    const dirs: DirectoryInfo[] = [{ directory: ".", depth: 1 }];
    const result = checkFileExistence(dirs, "CLAUDE.md", targetRoot);

    expect(result).toHaveLength(1);
    expect(result[0].fileExists).toBe(true);
    expect(result[0].filePath).toBe(resolve(join(targetRoot, "CLAUDE.md")));
    expect(result[0].directory).toBe(".");
    expect(result[0].depth).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Test 2: File missing → fileExists=false
// ---------------------------------------------------------------------------
describe("checkFileExistence — file missing", () => {
  it("returns fileExists=false with expected filePath", () => {
    const targetRoot = join(FIXTURE_ROOT, "no-file");
    const dirs: DirectoryInfo[] = [{ directory: ".", depth: 1 }];
    const result = checkFileExistence(dirs, "CLAUDE.md", targetRoot);

    expect(result).toHaveLength(1);
    expect(result[0].fileExists).toBe(false);
    expect(result[0].filePath).toBe(resolve(join(targetRoot, "CLAUDE.md")));
  });
});

// ---------------------------------------------------------------------------
// Test 3: Symlink file treated as non-existent (fileExists=false)
// ---------------------------------------------------------------------------
describe("checkFileExistence — symlink file", () => {
  it("returns fileExists=false for a symlinked file", () => {
    const linkPath = join(FIXTURE_ROOT, "link-file", "link.md");
    // Skip test if symlink was not created (e.g. Windows without permissions)
    if (!existsSync(linkPath)) {
      return;
    }

    const targetRoot = join(FIXTURE_ROOT, "link-file");
    const dirs: DirectoryInfo[] = [{ directory: ".", depth: 1 }];
    const result = checkFileExistence(dirs, "link.md", targetRoot);

    expect(result).toHaveLength(1);
    expect(result[0].fileExists).toBe(false);
    expect(result[0].filePath).toBe(resolve(join(targetRoot, "link.md")));
  });
});

// ---------------------------------------------------------------------------
// Test 4: Multiple directories with mixed results — result length matches input
// ---------------------------------------------------------------------------
describe("checkFileExistence — multiple directories mixed results", () => {
  it("returns correct results for a mix of existing and missing files", () => {
    const targetRoot = join(FIXTURE_ROOT, "multi");
    const dirs: DirectoryInfo[] = [
      { directory: "sub1", depth: 1 },
      { directory: "sub2", depth: 1 },
    ];
    const result = checkFileExistence(dirs, "CLAUDE.md", targetRoot);

    // Result length matches input
    expect(result).toHaveLength(2);

    // sub1 has the file
    expect(result[0].fileExists).toBe(true);
    expect(result[0].directory).toBe("sub1");
    expect(result[0].filePath).toBe(
      resolve(join(targetRoot, "sub1", "CLAUDE.md")),
    );

    // sub2 does not have the file
    expect(result[1].fileExists).toBe(false);
    expect(result[1].directory).toBe("sub2");
    expect(result[1].filePath).toBe(
      resolve(join(targetRoot, "sub2", "CLAUDE.md")),
    );
  });
});

// ---------------------------------------------------------------------------
// Test 5: Target root directory check (directory: ".")
// ---------------------------------------------------------------------------
describe("checkFileExistence — root directory '.' handling", () => {
  it("correctly checks the root when directory is '.'", () => {
    // Place a file in the multi root itself
    const targetRoot = join(FIXTURE_ROOT, "multi");
    writeFileSync(join(targetRoot, "ROOT.md"), "root file");

    const dirs: DirectoryInfo[] = [{ directory: ".", depth: 0 }];
    const result = checkFileExistence(dirs, "ROOT.md", targetRoot);

    expect(result).toHaveLength(1);
    expect(result[0].fileExists).toBe(true);
    expect(result[0].filePath).toBe(resolve(join(targetRoot, "ROOT.md")));
    expect(result[0].directory).toBe(".");
    expect(result[0].depth).toBe(0);
  });
});
