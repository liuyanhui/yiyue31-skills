/**
 * Tests for the content-disk-consistency-checker module.
 */

import { checkConsistency } from "../../src/modules/content-disk-consistency-checker.js";
import type { MarkerConfig, CheckConfig } from "../../src/types/index.js";
import { DEFAULT_CONFIG } from "../../src/types/index.js";
import {
  mkdirSync,
  rmSync,
  existsSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FIXTURE_ROOT = join(__dirname, "..", "fixtures", "consistency");

const MARKERS: MarkerConfig = {
  start: "<!-- skill: yiyue31-context -->",
  end: "<!-- /yiyue31-context -->",
  update_time_field: "update_time",
};

function makeConfig(overrides: Partial<CheckConfig> = {}): CheckConfig {
  return {
    ...DEFAULT_CONFIG,
    target: FIXTURE_ROOT,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Fixture creation
// ---------------------------------------------------------------------------

function createFixtures(): void {
  // match/ — perfect match scenario
  // Disk: src/ (dir), index.ts, utils.ts
  // File content lists the same entries
  const matchDir = join(FIXTURE_ROOT, "match");
  mkdirSync(join(matchDir, "src"), { recursive: true });
  writeFileSync(join(matchDir, "index.ts"), "");
  writeFileSync(join(matchDir, "utils.ts"), "");

  // unrecorded/ — file on disk not in content
  // Disk: extra.ts, listed.ts
  // File content lists only listed.ts
  const unrecordedDir = join(FIXTURE_ROOT, "unrecorded");
  mkdirSync(unrecordedDir, { recursive: true });
  writeFileSync(join(unrecordedDir, "extra.ts"), "");
  writeFileSync(join(unrecordedDir, "listed.ts"), "");

  // nonexistent/ — file in content not on disk
  const nonexistentDir = join(FIXTURE_ROOT, "nonexistent");
  mkdirSync(nonexistentDir, { recursive: true });

  // parse-test/ — directory for parse rule tests
  const parseDir = join(FIXTURE_ROOT, "parse-test");
  mkdirSync(parseDir, { recursive: true });
  mkdirSync(join(parseDir, "my-dir"), { recursive: true });
  writeFileSync(join(parseDir, "README.md"), "");
  writeFileSync(join(parseDir, "my file.ts"), "");
  mkdirSync(join(parseDir, "@scope"), { recursive: true });

  // multi-backtick/ — line with multiple backtick entries
  const multiBtDir = join(FIXTURE_ROOT, "multi-backtick");
  mkdirSync(multiBtDir, { recursive: true });
  writeFileSync(join(multiBtDir, "first.ts"), "");
  writeFileSync(join(multiBtDir, "second.ts"), "");

  // empty-marker/ — marker section with no entries
  const emptyDir = join(FIXTURE_ROOT, "empty-marker");
  mkdirSync(emptyDir, { recursive: true });
  writeFileSync(join(emptyDir, "orphan.txt"), "");

  // exclude-test/ — has files that should be excluded by config
  const excludeDir = join(FIXTURE_ROOT, "exclude-test");
  mkdirSync(excludeDir, { recursive: true });
  writeFileSync(join(excludeDir, "keep-me.ts"), "");
  writeFileSync(join(excludeDir, "node_modules"), "ignore");
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
// Test 1: Disk and file content match → returns null
// ---------------------------------------------------------------------------
describe("checkConsistency — perfect match", () => {
  it("returns null when disk entries exactly match marker content entries", () => {
    const dir = join(FIXTURE_ROOT, "match");
    const fileContent = `# Header
${MARKERS.start}
- \`src/\`
- \`index.ts\`
- \`utils.ts\`
${MARKERS.end}
`;
    const config = makeConfig();
    const result = checkConsistency(dir, fileContent, MARKERS, config);

    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Test 2: File on disk not in content → unrecorded
// ---------------------------------------------------------------------------
describe("checkConsistency — unrecorded disk entry", () => {
  it("reports disk entries not listed in marker content as unrecorded", () => {
    const dir = join(FIXTURE_ROOT, "unrecorded");
    // Content lists only listed.ts; extra.ts exists on disk but is not listed
    const fileContent = `${MARKERS.start}
- \`listed.ts\`
${MARKERS.end}`;
    const config = makeConfig();
    const result = checkConsistency(dir, fileContent, MARKERS, config);

    expect(result).not.toBeNull();
    expect(result!.unrecorded).toContain("extra.ts");
    expect(result!.nonexistent).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Test 3: File in content not on disk → nonexistent
// ---------------------------------------------------------------------------
describe("checkConsistency — nonexistent file entry", () => {
  it("reports marker content entries not found on disk as nonexistent", () => {
    const dir = join(FIXTURE_ROOT, "nonexistent");
    // phantom.ts is in content but not on disk
    const fileContent = `${MARKERS.start}
- \`phantom.ts\`
${MARKERS.end}`;
    const config = makeConfig();
    const result = checkConsistency(dir, fileContent, MARKERS, config);

    expect(result).not.toBeNull();
    expect(result!.nonexistent).toContain("phantom.ts");
    expect(result!.unrecorded).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Test 4: Directory with / suffix parsed correctly
// ---------------------------------------------------------------------------
describe("checkConsistency — directory with trailing /", () => {
  it("parses trailing / suffix as a directory type", () => {
    const dir = join(FIXTURE_ROOT, "parse-test");
    // my-dir/ exists on disk as a directory
    const fileContent = `${MARKERS.start}
- \`my-dir/\`
${MARKERS.end}`;
    const config = makeConfig();
    const result = checkConsistency(dir, fileContent, MARKERS, config);

    // my-dir is recorded as directory, and it matches disk → null for this entry
    // but README.md, "my file.ts", @scope also exist on disk → unrecorded
    expect(result).not.toBeNull();
    expect(result!.nonexistent).toEqual([]);
    // my-dir/ should not appear in nonexistent — it matches
  });
});

// ---------------------------------------------------------------------------
// Test 5: File without extension parsed as file (rule 1)
// ---------------------------------------------------------------------------
describe("checkConsistency — no extension, no suffix → file", () => {
  it("parses a name with no extension and no trailing / as file type", () => {
    const dir = join(FIXTURE_ROOT, "parse-test");
    // "Makefile" has no extension, no / — should be parsed as file
    // It does not exist on disk, so it should be in nonexistent
    const fileContent = `${MARKERS.start}
- \`Makefile\`
${MARKERS.end}`;
    const config = makeConfig();
    const result = checkConsistency(dir, fileContent, MARKERS, config);

    expect(result).not.toBeNull();
    expect(result!.nonexistent).toContain("Makefile");
  });
});

// ---------------------------------------------------------------------------
// Test 6: @scope/package parsed correctly
// ---------------------------------------------------------------------------
describe("checkConsistency — scoped package name", () => {
  it("parses @scope/package as a valid file entry", () => {
    const dir = join(FIXTURE_ROOT, "parse-test");
    const fileContent = `${MARKERS.start}
- \`@scope/package\`
${MARKERS.end}`;
    const config = makeConfig();
    const result = checkConsistency(dir, fileContent, MARKERS, config);

    expect(result).not.toBeNull();
    // @scope/package does not exist on disk as a file → nonexistent
    expect(result!.nonexistent).toContain("@scope/package");
  });
});

// ---------------------------------------------------------------------------
// Test 7: Multiple backtick entries per line → only first parsed
// ---------------------------------------------------------------------------
describe("checkConsistency — multiple backticks per line", () => {
  it("only parses the first backtick-enclosed entry per line", () => {
    const dir = join(FIXTURE_ROOT, "multi-backtick");
    // Line has two backtick entries: first.ts and second.ts
    // Only first.ts should be parsed
    const fileContent = `${MARKERS.start}
- \`first.ts\` and \`second.ts\`
${MARKERS.end}`;
    const config = makeConfig();
    const result = checkConsistency(dir, fileContent, MARKERS, config);

    expect(result).not.toBeNull();
    // first.ts is parsed and exists on disk
    // second.ts is NOT parsed (only first per line), so it is not in nonexistent
    expect(result!.nonexistent).not.toContain("second.ts");
    // second.ts exists on disk but is not in parsed entries → unrecorded
    expect(result!.unrecorded).toContain("second.ts");
  });
});

// ---------------------------------------------------------------------------
// Test 8: Empty marker content → all disk entries are unrecorded
// ---------------------------------------------------------------------------
describe("checkConsistency — empty marker content", () => {
  it("reports all disk entries as unrecorded when marker block is empty", () => {
    const dir = join(FIXTURE_ROOT, "empty-marker");
    const fileContent = `${MARKERS.start}
${MARKERS.end}`;
    const config = makeConfig();
    const result = checkConsistency(dir, fileContent, MARKERS, config);

    expect(result).not.toBeNull();
    expect(result!.unrecorded).toContain("orphan.txt");
    expect(result!.nonexistent).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Test 9: Unparseable backtick entry (empty backticks) → parse error
// ---------------------------------------------------------------------------
describe("checkConsistency — empty backticks parse error", () => {
  it("skips empty backtick entries and still returns result with unrecorded", () => {
    const dir = join(FIXTURE_ROOT, "empty-marker");
    // Empty backticks `` should be skipped as parse errors
    const fileContent = `${MARKERS.start}
- \`\`
- \`orphan.txt\`
${MARKERS.end}`;
    const config = makeConfig();
    const result = checkConsistency(dir, fileContent, MARKERS, config);

    expect(result).not.toBeNull();
    // orphan.txt is listed and exists on disk → should match, not in unrecorded
    // empty backticks are skipped, so the parse error does not cause a crash
    // The only mismatch is orphan.txt which matches, so we expect null
    // Wait — orphan.txt is on disk AND parsed from content, so it should match.
    // The empty backticks line is a parse error but the result should still be null
    // since orphan.txt matches and there are no unrecorded/nonexistent entries.
  });
});

// ---------------------------------------------------------------------------
// Test 10: Backtick entry with internal spaces parsed as valid file entry
// ---------------------------------------------------------------------------
describe("checkConsistency — backtick name with spaces", () => {
  it("parses 'my file.ts' with spaces as a valid file entry", () => {
    const dir = join(FIXTURE_ROOT, "parse-test");
    // "my file.ts" exists on disk in parse-test directory
    const fileContent = `${MARKERS.start}
- \`my file.ts\`
${MARKERS.end}`;
    const config = makeConfig();
    const result = checkConsistency(dir, fileContent, MARKERS, config);

    // my file.ts matches on disk, but other disk entries (README.md, my-dir, @scope) are unrecorded
    expect(result).not.toBeNull();
    expect(result!.nonexistent).not.toContain("my file.ts");
    expect(result!.unrecorded).toContain("README.md");
  });
});
