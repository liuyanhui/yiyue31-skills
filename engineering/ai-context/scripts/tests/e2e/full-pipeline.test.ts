/**
 * End-to-end integration tests for the AI Context Checker pipeline.
 *
 * Creates fixture directories programmatically in beforeAll, runs the
 * REAL pipeline (no mocking), and validates full CheckResult structures.
 * Fixtures are cleaned up in afterAll.
 *
 * Non-UTF-8 files are generated via Buffer.from, NOT committed as static files.
 */

import { runPipeline } from "../../src/modules/pipeline-orchestrator";
import {
  generateReport,
  generateJsonReport,
  generateMarkdownReport,
} from "../../src/modules/report-generator";
import { run } from "../../src/cli";
import type { CheckConfig, PipelineResult, CheckResult } from "../../src/types/index";
import { DEFAULT_CONFIG } from "../../src/types/index";
import {
  mkdirSync,
  writeFileSync,
  rmSync,
  existsSync,
  readFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const START_MARKER = "<!-- skill: ai-context -->";
const END_MARKER = "<!-- /ai-context -->";

/** Valid CLAUDE.md content with markers, listed files, and sufficient content. */
const VALID_CLAUDE_MD = [
  "# Test",
  START_MARKER,
  "- `helpers.ts`",
  "- `utils/`",
  END_MARKER,
].join("\n");

/** Valid CLAUDE.md content for nested directory. */
const VALID_NESTED_CLAUDE_MD = [
  "# Nested",
  START_MARKER,
  "Some content for the nested directory.",
  END_MARKER,
].join("\n");

/** Root CLAUDE.md for the full valid tree. */
const VALID_ROOT_CLAUDE_MD = [
  "# Root",
  START_MARKER,
  "Root level AI context content that is adequately long.",
  END_MARKER,
].join("\n");

/** CLAUDE.md with missing end marker. */
const MISSING_END_MARKER_CLAUDE_MD = [
  "# Marker Issue",
  START_MARKER,
  "Content without end marker.",
  // intentionally no end marker
].join("\n");

/** CLAUDE.md with valid markers but containing a forbidden "TODO" pattern. */
const PATTERN_ISSUE_CLAUDE_MD = [
  "# Pattern Issue",
  START_MARKER,
  "Some content with a TODO item that should be flagged.",
  END_MARKER,
].join("\n");

// ---------------------------------------------------------------------------
// Fixture root path — use a temp directory to avoid polluting the repo
// ---------------------------------------------------------------------------

let fixtureRoot: string;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(overrides: Partial<CheckConfig> = {}): CheckConfig {
  return {
    target: fixtureRoot,
    ...DEFAULT_CONFIG,
    markers: {
      start: START_MARKER,
      end: END_MARKER,
      update_time_field: "update_time",
    },
    ...overrides,
  } as CheckConfig;
}

/** Write a file, creating parent directories as needed. */
function writeFile(filePath: string, content: string | Buffer): void {
  const dir = resolve(filePath, "..");
  mkdirSync(dir, { recursive: true });
  writeFileSync(filePath, content);
}

// ---------------------------------------------------------------------------
// Fixture setup / teardown
// ---------------------------------------------------------------------------

beforeAll(() => {
  // Create a unique temp directory for this test run
  fixtureRoot = join(tmpdir(), `e2e-tree-${Date.now()}-${process.pid}`);
  mkdirSync(fixtureRoot, { recursive: true });

  // ----- 1. Root CLAUDE.md (valid) -----
  writeFile(join(fixtureRoot, "CLAUDE.md"), VALID_ROOT_CLAUDE_MD);

  // ----- 2. valid-dir/CLAUDE.md (valid: markers, content, listed files) -----
  writeFile(join(fixtureRoot, "valid-dir", "CLAUDE.md"), VALID_CLAUDE_MD);
  writeFile(join(fixtureRoot, "valid-dir", "helpers.ts"), "export function help() {}");
  writeFile(join(fixtureRoot, "valid-dir", "utils", "CLAUDE.md"), VALID_NESTED_CLAUDE_MD);
  // utils/ dir needs at least one file to be a real directory
  writeFile(join(fixtureRoot, "valid-dir", "utils", "index.ts"), "export {};");

  // ----- 3. missing-dir/ (NO CLAUDE.md) -----
  mkdirSync(join(fixtureRoot, "missing-dir"), { recursive: true });

  // ----- 4. oversized-dir/CLAUDE.md (>50KB content) -----
  // Pad with spaces to exceed 51200 bytes
  const oversizedPadding = " ".repeat(52000);
  const oversizedContent = [
    "# Oversized",
    START_MARKER,
    oversizedPadding,
    END_MARKER,
  ].join("\n");
  writeFile(join(fixtureRoot, "oversized-dir", "CLAUDE.md"), oversizedContent);

  // ----- 5. marker-issue-dir/CLAUDE.md (missing end marker) -----
  writeFile(join(fixtureRoot, "marker-issue-dir", "CLAUDE.md"), MISSING_END_MARKER_CLAUDE_MD);

  // ----- 6. pattern-issue-dir/CLAUDE.md (valid markers, contains "TODO") -----
  writeFile(join(fixtureRoot, "pattern-issue-dir", "CLAUDE.md"), PATTERN_ISSUE_CLAUDE_MD);

  // ----- 7. mixed-tree/ -----
  writeFile(
    join(fixtureRoot, "mixed-tree", "CLAUDE.md"),
    [
      "# Mixed Root",
      START_MARKER,
      "Mixed tree root content.",
      END_MARKER,
    ].join("\n"),
  );
  // has-file subdirectory with valid CLAUDE.md
  writeFile(
    join(fixtureRoot, "mixed-tree", "has-file", "CLAUDE.md"),
    [
      "# Has File",
      START_MARKER,
      "This directory has a valid file.",
      END_MARKER,
    ].join("\n"),
  );
  // no-file subdirectory — missing CLAUDE.md
  mkdirSync(join(fixtureRoot, "mixed-tree", "no-file"), { recursive: true });

  // ----- 8. encoding-dir/CLAUDE.md (non-UTF-8 — generated via Buffer.from) -----
  const encodingPath = join(fixtureRoot, "encoding-dir", "CLAUDE.md");
  mkdirSync(join(fixtureRoot, "encoding-dir"), { recursive: true });
  writeFileSync(
    encodingPath,
    Buffer.from([0x80, 0x81, 0x82, 0x48, 0x65, 0x6c, 0x6c, 0x6f]),
  );
});

afterAll(() => {
  if (fixtureRoot && existsSync(fixtureRoot)) {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Test 1: Fully-valid tree
// ---------------------------------------------------------------------------

describe("E2E: Fully-valid tree", () => {
  it("runPipeline returns passed=true, all FileReports populated, coverage_rate=1.0", () => {
    // Use only the valid subtree: valid-dir and its children
    const validRoot = join(fixtureRoot, "valid-dir");
    const config = makeConfig({ target: validRoot });

    // Provide directories explicitly so scanner only scans valid-dir
    const result = runPipeline(config, [validRoot]);

    // The root (valid-dir) and nested utils/ should both have file reports
    const reportsWithFiles = result.directoryReports.filter(
      (dr) => dr.file_report !== null,
    );
    expect(reportsWithFiles.length).toBeGreaterThanOrEqual(1);

    // Check that passed is true (no missing, no marker issues, no encoding, no oversized)
    expect(result.result.summary.passed).toBe(true);

    // coverage_rate should be 1.0 (all directories covered)
    expect(result.result.summary.coverage_rate).toBe(1.0);

    // No error arrays should be populated
    expect(result.result.details.missing_files).toHaveLength(0);
    expect(result.result.details.marker_issues).toHaveLength(0);
    expect(result.result.details.encoding_issues).toHaveLength(0);
    expect(result.result.details.oversized_files).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Test 2: Missing files
// ---------------------------------------------------------------------------

describe("E2E: Missing files", () => {
  it("pipeline populates details.missing_files with correct directories and passed=false", () => {
    // Use only the missing-dir subtree
    const missingRoot = join(fixtureRoot, "missing-dir");
    const config = makeConfig({ target: missingRoot });

    const result = runPipeline(config, [missingRoot]);

    expect(result.result.summary.passed).toBe(false);
    expect(result.result.details.missing_files.length).toBeGreaterThanOrEqual(1);

    // The missing-dir directory should appear in missing_files
    const missingDirs = result.result.details.missing_files.map(
      (e) => e.directory,
    );
    expect(missingDirs).toContain(".");

    // file_report should be null for missing directory
    const nullReports = result.directoryReports.filter(
      (dr) => dr.file_report === null,
    );
    expect(nullReports.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Test 3: Oversized file
// ---------------------------------------------------------------------------

describe("E2E: Oversized file", () => {
  it("pipeline skips content checks and populates details.oversized_files", () => {
    const oversizedRoot = join(fixtureRoot, "oversized-dir");
    const config = makeConfig({ target: oversizedRoot });

    const result = runPipeline(config, [oversizedRoot]);

    // Should have an oversized entry
    expect(result.result.details.oversized_files.length).toBeGreaterThanOrEqual(1);

    const oversizedEntry = result.result.details.oversized_files[0];
    expect(oversizedEntry.actual_size).toBeGreaterThan(51200);
    expect(oversizedEntry.max_size).toBe(51200);

    // The file_report should exist but have marker_count=0 (content checks skipped)
    const fr = result.directoryReports[0].file_report!;
    expect(fr).not.toBeNull();
    expect(fr.marker_count).toBe(0);
    expect(fr.passed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Test 4: Encoding issue (non-UTF-8)
// ---------------------------------------------------------------------------

describe("E2E: Encoding issue (non-UTF-8)", () => {
  it("pipeline skips content parsing and populates details.encoding_issues", () => {
    const encodingRoot = join(fixtureRoot, "encoding-dir");
    const config = makeConfig({ target: encodingRoot });

    const result = runPipeline(config, [encodingRoot]);

    // Should have an encoding issue
    expect(result.result.details.encoding_issues.length).toBeGreaterThanOrEqual(1);

    const encIssue = result.result.details.encoding_issues[0];
    expect(encIssue.expected_encoding).toBe("utf-8");

    // The file_report should have marker_count=0 (content parsing skipped)
    const fr = result.directoryReports[0].file_report!;
    expect(fr).not.toBeNull();
    expect(fr.marker_count).toBe(0);
    expect(fr.passed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Test 5: Marker issues
// ---------------------------------------------------------------------------

describe("E2E: Marker issues (missing end marker)", () => {
  it("pipeline skips marker-dependent checks and populates details.marker_issues", () => {
    const markerRoot = join(fixtureRoot, "marker-issue-dir");
    const config = makeConfig({ target: markerRoot });

    const result = runPipeline(config, [markerRoot]);

    // Should have a marker issue
    expect(result.result.details.marker_issues.length).toBeGreaterThanOrEqual(1);

    const markerIssue = result.result.details.marker_issues[0];
    expect(markerIssue.issues).toContain("missing_end_marker");

    // Marker-dependent checks should have been skipped
    const fr = result.directoryReports[0].file_report!;
    expect(fr).not.toBeNull();
    expect(fr.passed).toBe(false);
    expect(fr.required_any_missing).toEqual([]);
    expect(fr.required_all_missing).toEqual([]);
    expect(fr.forbidden_found).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Test 6: Mixed tree (all issue categories)
// ---------------------------------------------------------------------------

describe("E2E: Mixed tree with multiple issue categories", () => {
  it("populates correct issue categories and computes accurate coverage_rate", () => {
    // Run pipeline on the full fixture tree (all directories)
    const config = makeConfig({
      target: fixtureRoot,
      forbidden_patterns: ["TODO"],
    });

    const result = runPipeline(config);

    // Should have entries in multiple issue categories
    // - missing-dir and encoding-dir, no-file should trigger missing/encoding
    // - oversized-dir should trigger oversized
    // - marker-issue-dir should trigger marker issues
    // - pattern-issue-dir should trigger forbidden pattern

    // Verify missing files
    expect(result.result.details.missing_files.length).toBeGreaterThanOrEqual(1);

    // Verify oversized files
    expect(result.result.details.oversized_files.length).toBeGreaterThanOrEqual(1);

    // Verify marker issues
    expect(result.result.details.marker_issues.length).toBeGreaterThanOrEqual(1);

    // Verify encoding issues
    expect(result.result.details.encoding_issues.length).toBeGreaterThanOrEqual(1);

    // Verify forbidden pattern found (at least pattern-issue-dir)
    expect(
      result.result.details.pattern_issues.forbidden_found.length,
    ).toBeGreaterThanOrEqual(1);

    // Overall passed should be false
    expect(result.result.summary.passed).toBe(false);

    // coverage_rate should be less than 1.0 (some dirs missing or with issues)
    expect(result.result.summary.coverage_rate!).toBeLessThan(1.0);

    // But coverage should be > 0 (some dirs are valid)
    expect(result.result.summary.covered_directories).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Test 7: JSON report output
// ---------------------------------------------------------------------------

describe("E2E: JSON report output", () => {
  it("can be parsed and matches CheckResult schema", () => {
    const config = makeConfig({ target: fixtureRoot });

    const pipelineResult = runPipeline(config);
    const jsonStr = generateJsonReport(pipelineResult.result);

    // Should be parseable JSON
    const parsed = JSON.parse(jsonStr) as CheckResult;

    // Verify top-level keys match CheckResult schema
    expect(parsed).toHaveProperty("meta");
    expect(parsed).toHaveProperty("summary");
    expect(parsed).toHaveProperty("depth_distribution");
    expect(parsed).toHaveProperty("marker_position_stats");
    expect(parsed).toHaveProperty("details");

    // Verify meta structure
    expect(parsed.meta).toHaveProperty("tool_version");
    expect(parsed.meta).toHaveProperty("timestamp");
    expect(parsed.meta).toHaveProperty("target");
    expect(parsed.meta).toHaveProperty("config");

    // Verify summary structure
    expect(parsed.summary).toHaveProperty("total_directories");
    expect(parsed.summary).toHaveProperty("covered_directories");
    expect(parsed.summary).toHaveProperty("missing_directories");
    expect(parsed.summary).toHaveProperty("passed");
    expect(parsed.summary).toHaveProperty("custom_content_stats");

    // Verify details structure
    expect(parsed.details).toHaveProperty("missing_files");
    expect(parsed.details).toHaveProperty("marker_issues");
    expect(parsed.details).toHaveProperty("content_issues");
    expect(parsed.details).toHaveProperty("encoding_issues");
    expect(parsed.details).toHaveProperty("oversized_files");
    expect(parsed.details).toHaveProperty("pattern_issues");
    expect(parsed.details).toHaveProperty("filesystem_mismatches");
    expect(parsed.details).toHaveProperty("stale_entries");

    // pattern_issues sub-structure
    expect(parsed.details.pattern_issues).toHaveProperty("required_any_missing");
    expect(parsed.details.pattern_issues).toHaveProperty("required_all_missing");
    expect(parsed.details.pattern_issues).toHaveProperty("forbidden_found");
  });
});

// ---------------------------------------------------------------------------
// Test 8: Markdown report output
// ---------------------------------------------------------------------------

describe("E2E: Markdown report output", () => {
  it("contains mtime warning and summary table", () => {
    const config = makeConfig({ target: fixtureRoot });

    const pipelineResult = runPipeline(config);
    const md = generateMarkdownReport(pipelineResult.result);

    // Should contain title
    expect(md).toContain("# AI Context Checker Report");

    // Should contain mtime reliability warning
    expect(md).toContain("mtime reliability warning");

    // Should contain summary table with headers
    expect(md).toContain("## Summary");
    expect(md).toContain("| Metric | Value |");
    expect(md).toContain("Total directories");
    expect(md).toContain("Coverage rate");
    expect(md).toContain("Passed");

    // Should contain marker position stats
    expect(md).toContain("## Marker Position Stats");

    // Should contain custom content stats
    expect(md).toContain("## Custom Content Stats");
  });
});

// ---------------------------------------------------------------------------
// Test 9: Full workflow via CLI
// ---------------------------------------------------------------------------

describe("E2E: Full workflow via CLI", () => {
  it("call run(['--target', fixturePath]) returns exit code and produces reports", async () => {
    // Create a separate temp dir for CLI test with output paths
    const cliTestDir = join(
      tmpdir(),
      `e2e-cli-${Date.now()}-${process.pid}`,
    );
    mkdirSync(cliTestDir, { recursive: true });

    // Create a valid target directory for CLI test
    const cliTarget = join(cliTestDir, "target");
    mkdirSync(cliTarget, { recursive: true });
    writeFileSync(
      join(cliTarget, "CLAUDE.md"),
      [
        "# CLI Test",
        START_MARKER,
        "Valid content for CLI test run.",
        END_MARKER,
      ].join("\n"),
      "utf-8",
    );

    // Set up output paths
    const jsonOutput = join(cliTestDir, "report.json");
    const mdOutput = join(cliTestDir, "report.md");

    // Create a config file to specify output destinations
    const configPath = join(cliTestDir, "config.json");
    writeFileSync(
      configPath,
      JSON.stringify({
        output: {
          json: jsonOutput,
          markdown: mdOutput,
        },
      }),
      "utf-8",
    );

    try {
      // Suppress stderr output during CLI run
      const stderrSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const exitCode = await run([
        "--target",
        cliTarget,
        "--config",
        configPath,
      ]);

      stderrSpy.mockRestore();

      // Should return exit code 0 for valid target
      expect(exitCode).toBe(0);

      // Reports should have been written
      expect(existsSync(jsonOutput)).toBe(true);
      expect(existsSync(mdOutput)).toBe(true);

      // JSON report should be parseable
      const jsonContent = readFileSync(jsonOutput, "utf-8");
      const parsed = JSON.parse(jsonContent);
      expect(parsed.summary.passed).toBe(true);

      // Markdown report should contain expected sections
      const mdContent = readFileSync(mdOutput, "utf-8");
      expect(mdContent).toContain("# AI Context Checker Report");
      expect(mdContent).toContain("## Summary");
    } finally {
      // Cleanup
      rmSync(cliTestDir, { recursive: true, force: true });
    }
  });

  it("returns exit code 1 for target with issues", async () => {
    // Use the full fixture tree which has many issues
    const stderrSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const exitCode = await run(["--target", fixtureRoot]);

    stderrSpy.mockRestore();

    // Should return non-zero because there are issues
    expect(exitCode).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Additional test: generateReport writes files to disk
// ---------------------------------------------------------------------------

describe("E2E: generateReport writes files to disk", () => {
  it("writes JSON and Markdown files when configured", () => {
    const reportDir = join(
      tmpdir(),
      `e2e-report-${Date.now()}-${process.pid}`,
    );
    mkdirSync(reportDir, { recursive: true });

    const jsonPath = join(reportDir, "result.json");
    const mdPath = join(reportDir, "result.md");

    try {
      const config = makeConfig({
        target: fixtureRoot,
        output: {
          json: jsonPath,
          markdown: mdPath,
        },
      });

      const pipelineResult = runPipeline(config);
      generateReport(pipelineResult, config);

      expect(existsSync(jsonPath)).toBe(true);
      expect(existsSync(mdPath)).toBe(true);

      // Verify JSON content
      const json = JSON.parse(readFileSync(jsonPath, "utf-8"));
      expect(json.summary).toBeDefined();

      // Verify Markdown content
      const md = readFileSync(mdPath, "utf-8");
      expect(md).toContain("# AI Context Checker Report");
    } finally {
      rmSync(reportDir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// Additional test: Coverage rate accuracy on known tree
// ---------------------------------------------------------------------------

describe("E2E: Coverage rate accuracy on known tree", () => {
  it("computes correct coverage for tree with known valid and missing directories", () => {
    // Create a small controlled tree
    const testDir = join(
      tmpdir(),
      `e2e-coverage-${Date.now()}-${process.pid}`,
    );
    mkdirSync(testDir, { recursive: true });

    try {
      // Root: valid
      writeFileSync(
        join(testDir, "CLAUDE.md"),
        VALID_ROOT_CLAUDE_MD,
        "utf-8",
      );

      // sub-a: valid
      mkdirSync(join(testDir, "sub-a"), { recursive: true });
      writeFileSync(
        join(testDir, "sub-a", "CLAUDE.md"),
        VALID_NESTED_CLAUDE_MD,
        "utf-8",
      );

      // sub-b: missing
      mkdirSync(join(testDir, "sub-b"), { recursive: true });

      const config = makeConfig({ target: testDir });
      const result = runPipeline(config);

      // 3 directories total: root, sub-a, sub-b
      expect(result.result.summary.total_directories).toBe(3);

      // 2 covered: root and sub-a
      expect(result.result.summary.covered_directories).toBe(2);

      // 1 missing: sub-b
      expect(result.result.summary.missing_directories).toBe(1);

      // coverage_rate = 2/3
      expect(result.result.summary.coverage_rate).toBeCloseTo(2 / 3);

      // passed = false because of missing
      expect(result.result.summary.passed).toBe(false);
    } finally {
      rmSync(testDir, { recursive: true, force: true });
    }
  });
});
