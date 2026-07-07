/**
 * Tests for the report-generator module.
 *
 * Uses synthetic data (no real project scanning). Writes to a temp
 * directory and cleans up afterward.
 */

import {
  normalizeToPosixPath,
  generateJsonReport,
  generateMarkdownReport,
  generateReport,
} from "../../src/modules/report-generator";
import type {
  CheckConfig,
  CheckResult,
  PipelineResult,
  ReportSummary,
  ReportDetails,
  DepthBucket,
} from "../../src/types/index";
import { DEFAULT_CONFIG } from "../../src/types/index";
import { writeFileSync, mkdirSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDetails(overrides: Partial<ReportDetails> = {}): ReportDetails {
  return {
    missing_files: [],
    marker_issues: [],
    content_issues: [],
    encoding_issues: [],
    oversized_files: [],
    pattern_issues: {
      required_any_missing: [],
      required_all_missing: [],
      forbidden_found: [],
    },
    disallowed_sections: [],
    filesystem_mismatches: [],
    stale_entries: [],
    ...overrides,
  };
}

function makeSummary(overrides: Partial<ReportSummary> = {}): ReportSummary {
  return {
    total_directories: 3,
    covered_directories: 2,
    missing_directories: 1,
    coverage_rate: 2 / 3,
    passed: false,
    custom_content_stats: {
      has_custom_content: 1,
      marker_only: 1,
    },
    ...overrides,
  };
}

function makeCheckResult(overrides: Partial<CheckResult> = {}): CheckResult {
  return {
    meta: {
      tool_version: "0.1.0",
      timestamp: "2026-06-12T10:00:00.000Z",
      target: "C:\\project\\root",
      config: {
        target: "C:\\project\\root",
        ...DEFAULT_CONFIG,
      } as CheckConfig,
    },
    summary: makeSummary(),
    depth_distribution: {
      "1": { total: 1, covered: 1, missing: 0 } as DepthBucket,
      "2": { total: 2, covered: 1, missing: 1 } as DepthBucket,
    },
    marker_position_stats: { head: 1, middle: 0, tail: 1 },
    details: makeDetails(),
    ...overrides,
  };
}

function makeConfig(overrides: Partial<CheckConfig> = {}): CheckConfig {
  return {
    target: "/test/root",
    ...DEFAULT_CONFIG,
    ...overrides,
  } as CheckConfig;
}

function makePipelineResult(
  resultOverrides: Partial<CheckResult> = {},
): PipelineResult {
  return {
    result: makeCheckResult(resultOverrides),
    directoryReports: [],
  };
}

// Temp directory helpers — each describe block gets its own unique dir
let tmpCounter = 0;

function makeTmpDir(): string {
  return join(tmpdir(), `report-gen-test-${Date.now()}-${++tmpCounter}`);
}

function setupTmp(base: string): string {
  mkdirSync(base, { recursive: true });
  return base;
}

function teardownTmp(base: string): void {
  if (existsSync(base)) {
    rmSync(base, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Test 1: JSON output matches expected schema with all fields
// ---------------------------------------------------------------------------
describe("generateJsonReport: schema", () => {
  it("includes all top-level fields: meta, summary, depth_distribution, marker_position_stats, details", () => {
    const result = makeCheckResult();
    const json = generateJsonReport(result);
    const parsed = JSON.parse(json);

    expect(parsed).toHaveProperty("meta");
    expect(parsed).toHaveProperty("summary");
    expect(parsed).toHaveProperty("depth_distribution");
    expect(parsed).toHaveProperty("marker_position_stats");
    expect(parsed).toHaveProperty("details");

    // meta fields
    expect(parsed.meta.tool_version).toBe("0.1.0");
    expect(parsed.meta.timestamp).toBe("2026-06-12T10:00:00.000Z");
    expect(parsed.meta.target).toBe("C:/project/root"); // POSIX-normalised

    // summary fields
    expect(parsed.summary.total_directories).toBe(3);
    expect(parsed.summary.covered_directories).toBe(2);
    expect(parsed.summary.passed).toBe(false);
    expect(parsed.summary.custom_content_stats.has_custom_content).toBe(1);
    expect(parsed.summary.custom_content_stats.marker_only).toBe(1);

    // depth_distribution
    expect(parsed.depth_distribution["1"]).toEqual({ total: 1, covered: 1, missing: 0 });
    expect(parsed.depth_distribution["2"]).toEqual({ total: 2, covered: 1, missing: 1 });

    // marker_position_stats
    expect(parsed.marker_position_stats).toEqual({ head: 1, middle: 0, tail: 1 });

    // details
    expect(parsed.details).toHaveProperty("missing_files");
    expect(parsed.details).toHaveProperty("marker_issues");
    expect(parsed.details).toHaveProperty("content_issues");
    expect(parsed.details).toHaveProperty("encoding_issues");
    expect(parsed.details).toHaveProperty("oversized_files");
    expect(parsed.details).toHaveProperty("pattern_issues");
    expect(parsed.details).toHaveProperty("filesystem_mismatches");
    expect(parsed.details).toHaveProperty("stale_entries");
  });
});

// ---------------------------------------------------------------------------
// Test 2: Empty issue arrays output as [] not omitted (DEFER-005)
// ---------------------------------------------------------------------------
describe("generateJsonReport: empty arrays preserved (DEFER-005)", () => {
  it("outputs [] for all empty issue arrays instead of omitting them", () => {
    const result = makeCheckResult({
      details: makeDetails(), // all empty
    });
    const json = generateJsonReport(result);
    const parsed = JSON.parse(json);

    expect(parsed.details.missing_files).toEqual([]);
    expect(parsed.details.marker_issues).toEqual([]);
    expect(parsed.details.content_issues).toEqual([]);
    expect(parsed.details.encoding_issues).toEqual([]);
    expect(parsed.details.oversized_files).toEqual([]);
    expect(parsed.details.pattern_issues.required_any_missing).toEqual([]);
    expect(parsed.details.pattern_issues.required_all_missing).toEqual([]);
    expect(parsed.details.pattern_issues.forbidden_found).toEqual([]);
    expect(parsed.details.filesystem_mismatches).toEqual([]);
    expect(parsed.details.stale_entries).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Test 3: Markdown output includes summary table, detail sections, mtime warning
// ---------------------------------------------------------------------------
describe("generateMarkdownReport: structure", () => {
  it("includes title, summary table, mtime warning, depth distribution, marker position stats, custom content stats", () => {
    const result = makeCheckResult();
    const md = generateMarkdownReport(result);

    // Title
    expect(md).toContain("# AI Context Checker Report");

    // Summary section
    expect(md).toContain("## Summary");
    expect(md).toContain("| Metric | Value |");
    expect(md).toContain("| Total directories | 3 |");
    expect(md).toContain("| Covered directories | 2 |");
    expect(md).toContain("| Passed | false |");

    // mtime reliability warning
    expect(md).toContain("mtime reliability warning");
    expect(md).toContain("git checkout, git clone, tar extraction may reset mtime");

    // Depth distribution
    expect(md).toContain("## Depth Distribution");
    expect(md).toContain("| Depth | Total | Covered | Missing |");

    // Marker position stats
    expect(md).toContain("## Marker Position Stats");
    expect(md).toContain("| Position | Count |");
    expect(md).toContain("| head | 1 |");

    // Custom content stats
    expect(md).toContain("## Custom Content Stats");
    expect(md).toContain("| has_custom_content | 1 |");
    expect(md).toContain("| marker_only | 1 |");
  });

  it("includes detail sections when issues are present", () => {
    const result = makeCheckResult({
      details: makeDetails({
        missing_files: [{ directory: "sub\\dir", depth: 2 }],
        marker_issues: [
          {
            file: "C:\\project\\root\\CLAUDE.md",
            issues: ["missing_start_marker"],
            marker_count: 0,
          },
        ],
        encoding_issues: [
          {
            file: "C:\\project\\root\\bad.md",
            detected_encoding: "latin-1",
            expected_encoding: "utf-8",
          },
        ],
        oversized_files: [
          {
            file: "C:\\project\\root\\big.md",
            actual_size: 99999,
            max_size: 51200,
          },
        ],
      }),
    });
    const md = generateMarkdownReport(result);

    expect(md).toContain("## Missing Files");
    expect(md).toContain("sub/dir"); // POSIX-normalised
    expect(md).toContain("## Marker Issues");
    expect(md).toContain("C:/project/root/CLAUDE.md");
    expect(md).toContain("missing_start_marker");
    expect(md).toContain("## Encoding Issues");
    expect(md).toContain("latin-1");
    expect(md).toContain("## Oversized Files");
    expect(md).toContain("99999");
  });

  it("omits detail sections when all issue arrays are empty", () => {
    const result = makeCheckResult({
      details: makeDetails(), // all empty
    });
    const md = generateMarkdownReport(result);

    expect(md).not.toContain("## Missing Files");
    expect(md).not.toContain("## Marker Issues");
    expect(md).not.toContain("## Content Issues");
    expect(md).not.toContain("## Encoding Issues");
    expect(md).not.toContain("## Oversized Files");
    expect(md).not.toContain("## Pattern Issues");
    expect(md).not.toContain("## Filesystem Mismatches");
    expect(md).not.toContain("## Stale Entries");
  });

  it("includes pattern issues sections when present", () => {
    const result = makeCheckResult({
      details: makeDetails({
        pattern_issues: {
          required_any_missing: [
            { file: "C:\\project\\a.md", patterns: ["MUST_HAVE"] },
          ],
          required_all_missing: [
            { file: "C:\\project\\b.md", missing_pattern: "NEVER_MISS" },
          ],
          forbidden_found: [
            {
              file: "C:\\project\\c.md",
              matches: [{ pattern: "TODO", context: "some TODO here" }],
            },
          ],
        },
      }),
    });
    const md = generateMarkdownReport(result);

    expect(md).toContain("## Pattern Issues");
    expect(md).toContain("### Required Any Missing");
    expect(md).toContain("C:/project/a.md");
    expect(md).toContain("MUST_HAVE");
    expect(md).toContain("### Required All Missing");
    expect(md).toContain("NEVER_MISS");
    expect(md).toContain("### Forbidden Patterns Found");
    expect(md).toContain("TODO");
  });

  it("includes filesystem mismatches and stale entries", () => {
    const result = makeCheckResult({
      details: makeDetails({
        filesystem_mismatches: [
          {
            directory: "C:\\project\\root",
            file: "C:\\project\\root\\CLAUDE.md",
            unrecorded: ["new_file.ts"],
            nonexistent: ["old\\file.ts"],
          },
        ],
        stale_entries: [
          {
            directory: "C:\\project\\root",
            file: "C:\\project\\root\\CLAUDE.md",
            update_time: "2026-01-01T00:00:00.000Z",
            stale_files: [{ name: "changed.ts", mtime: "2026-06-01T00:00:00.000Z" }],
            fallback_to_file_mtime: true,
          },
        ],
      }),
    });
    const md = generateMarkdownReport(result);

    expect(md).toContain("## Filesystem Mismatches");
    expect(md).toContain("new_file.ts");
    expect(md).toContain("old/file.ts"); // POSIX-normalised
    expect(md).toContain("## Stale Entries");
    expect(md).toContain("fallback_to_file_mtime");
    expect(md).toContain("2026-01-01T00:00:00.000Z");
  });
});

// ---------------------------------------------------------------------------
// Test 4: POSIX path conversion: backslash strings → forward slashes
// ---------------------------------------------------------------------------
describe("normalizeToPosixPath", () => {
  it("converts backslashes to forward slashes", () => {
    expect(normalizeToPosixPath("path\\to\\file")).toBe("path/to/file");
    expect(normalizeToPosixPath("C:\\Users\\test\\project")).toBe("C:/Users/test/project");
    expect(normalizeToPosixPath("a\\b\\c\\d\\e")).toBe("a/b/c/d/e");
  });

  it("leaves forward-slash paths unchanged", () => {
    expect(normalizeToPosixPath("path/to/file")).toBe("path/to/file");
    expect(normalizeToPosixPath("/unix/abs/path")).toBe("/unix/abs/path");
  });

  it("handles strings with no path separators", () => {
    expect(normalizeToPosixPath("filename.ts")).toBe("filename.ts");
    expect(normalizeToPosixPath("")).toBe("");
  });

  it("handles mixed separators", () => {
    expect(normalizeToPosixPath("mixed\\path/to\\file")).toBe("mixed/path/to/file");
  });
});

// ---------------------------------------------------------------------------
// Test 5: Only json path configured → only JSON file written
// ---------------------------------------------------------------------------
describe("generateReport: JSON only", () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = setupTmp(makeTmpDir());
  });

  afterAll(() => {
    teardownTmp(tmpDir);
  });

  it("writes only JSON when only json path is configured", () => {
    const jsonPath = join(tmpDir, "report.json");
    const mdPath = join(tmpDir, "report.md");

    const config = makeConfig({
      output: { json: jsonPath },
    });
    const pipeline = makePipelineResult();

    generateReport(pipeline, config);

    // JSON file exists
    expect(existsSync(jsonPath)).toBe(true);
    const content = readFileSync(jsonPath, "utf-8");
    const parsed = JSON.parse(content);
    expect(parsed.meta.tool_version).toBe("0.1.0");

    // Markdown file does NOT exist
    expect(existsSync(mdPath)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Test 6: Only markdown path configured → only Markdown file written
// ---------------------------------------------------------------------------
describe("generateReport: Markdown only", () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = setupTmp(makeTmpDir());
  });

  afterAll(() => {
    teardownTmp(tmpDir);
  });

  it("writes only Markdown when only markdown path is configured", () => {
    const jsonPath = join(tmpDir, "report.json");
    const mdPath = join(tmpDir, "report.md");

    const config = makeConfig({
      output: { markdown: mdPath },
    });
    const pipeline = makePipelineResult();

    generateReport(pipeline, config);

    // Markdown file exists
    expect(existsSync(mdPath)).toBe(true);
    const content = readFileSync(mdPath, "utf-8");
    expect(content).toContain("# AI Context Checker Report");

    // JSON file does NOT exist
    expect(existsSync(jsonPath)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Test 7: Neither configured → no files written
// ---------------------------------------------------------------------------
describe("generateReport: neither configured", () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = setupTmp(makeTmpDir());
  });

  afterAll(() => {
    teardownTmp(tmpDir);
  });

  it("writes no files when neither output is configured", () => {
    const jsonPath = join(tmpDir, "report.json");
    const mdPath = join(tmpDir, "report.md");

    const config = makeConfig({
      output: {},
    });
    const pipeline = makePipelineResult();

    generateReport(pipeline, config);

    expect(existsSync(jsonPath)).toBe(false);
    expect(existsSync(mdPath)).toBe(false);
  });

  it("writes no files when output paths are empty strings", () => {
    const config = makeConfig({
      output: { json: "", markdown: "" },
    });
    const pipeline = makePipelineResult();

    // Should not throw and should not write anything
    expect(() => generateReport(pipeline, config)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Test 8: Parent directory missing → throws error
// ---------------------------------------------------------------------------
describe("generateReport: parent directory missing", () => {
  it("throws when JSON output parent dir does not exist", () => {
    const config = makeConfig({
      output: { json: "/nonexistent/dir/report.json" },
    });
    const pipeline = makePipelineResult();

    expect(() => generateReport(pipeline, config)).toThrow(
      /Parent directory does not exist/,
    );
  });

  it("throws when Markdown output parent dir does not exist", () => {
    const config = makeConfig({
      output: { markdown: "/nonexistent/dir/report.md" },
    });
    const pipeline = makePipelineResult();

    expect(() => generateReport(pipeline, config)).toThrow(
      /Parent directory does not exist/,
    );
  });
});

// ---------------------------------------------------------------------------
// Test: Both JSON and Markdown configured → both written
// ---------------------------------------------------------------------------
describe("generateReport: both outputs configured", () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = setupTmp(makeTmpDir());
  });

  afterAll(() => {
    teardownTmp(tmpDir);
  });

  it("writes both JSON and Markdown files", () => {
    const jsonPath = join(tmpDir, "report.json");
    const mdPath = join(tmpDir, "report.md");

    const config = makeConfig({
      output: { json: jsonPath, markdown: mdPath },
    });
    const pipeline = makePipelineResult();

    generateReport(pipeline, config);

    expect(existsSync(jsonPath)).toBe(true);
    expect(existsSync(mdPath)).toBe(true);

    const jsonContent = JSON.parse(readFileSync(jsonPath, "utf-8"));
    expect(jsonContent.meta.tool_version).toBe("0.1.0");

    const mdContent = readFileSync(mdPath, "utf-8");
    expect(mdContent).toContain("# AI Context Checker Report");
  });
});

// ---------------------------------------------------------------------------
// Test: JSON output normalises paths to POSIX
// ---------------------------------------------------------------------------
describe("generateJsonReport: path normalisation", () => {
  it("normalises backslash paths in all nested fields", () => {
    const result = makeCheckResult({
      meta: {
        tool_version: "0.1.0",
        timestamp: "2026-06-12T10:00:00.000Z",
        target: "C:\\project\\root",
        config: makeConfig({ target: "C:\\project\\root" }),
      },
      details: makeDetails({
        missing_files: [{ directory: "sub\\dir", depth: 2 }],
        marker_issues: [
          { file: "C:\\project\\root\\CLAUDE.md", issues: ["missing_start_marker"], marker_count: 0 },
        ],
        filesystem_mismatches: [
          {
            directory: "C:\\project\\root",
            file: "C:\\project\\root\\CLAUDE.md",
            unrecorded: ["new\\file.ts"],
            nonexistent: ["old\\file.ts"],
          },
        ],
      }),
    });

    const json = generateJsonReport(result);
    const parsed = JSON.parse(json);

    // meta.target
    expect(parsed.meta.target).toBe("C:/project/root");
    // missing_files directory
    expect(parsed.details.missing_files[0].directory).toBe("sub/dir");
    // marker_issues file
    expect(parsed.details.marker_issues[0].file).toBe("C:/project/root/CLAUDE.md");
    // filesystem_mismatches
    expect(parsed.details.filesystem_mismatches[0].directory).toBe("C:/project/root");
    expect(parsed.details.filesystem_mismatches[0].unrecorded[0]).toBe("new/file.ts");
    expect(parsed.details.filesystem_mismatches[0].nonexistent[0]).toBe("old/file.ts");
  });
});

// ---------------------------------------------------------------------------
// Test: Coverage rate shown as N/A when undefined
// ---------------------------------------------------------------------------
describe("generateMarkdownReport: coverage_rate undefined", () => {
  it("shows N/A for coverage_rate when total is zero", () => {
    const result = makeCheckResult({
      summary: makeSummary({
        total_directories: 0,
        covered_directories: 0,
        missing_directories: 0,
        coverage_rate: undefined,
        passed: true,
      }),
    });
    const md = generateMarkdownReport(result);

    expect(md).toContain("| Coverage rate | N/A |");
  });
});

// ---------------------------------------------------------------------------
// Test: Coverage rate shown as percentage when defined
// ---------------------------------------------------------------------------
describe("generateMarkdownReport: coverage_rate percentage", () => {
  it("shows coverage_rate as percentage", () => {
    const result = makeCheckResult({
      summary: makeSummary({
        coverage_rate: 0.6667,
      }),
    });
    const md = generateMarkdownReport(result);

    // Should be shown as percentage with one decimal
    expect(md).toMatch(/\| Coverage rate \| 66\.7% \|/);
  });
});

// ---------------------------------------------------------------------------
// Test: Empty depth distribution → no depth table
// ---------------------------------------------------------------------------
describe("generateMarkdownReport: empty depth distribution", () => {
  it("omits depth distribution section when empty", () => {
    const result = makeCheckResult({
      depth_distribution: {},
    });
    const md = generateMarkdownReport(result);

    expect(md).not.toContain("## Depth Distribution");
  });
});

// ---------------------------------------------------------------------------
// Test: Content issues section rendered
// ---------------------------------------------------------------------------
describe("generateMarkdownReport: content issues", () => {
  it("renders content issues with actual and min lengths", () => {
    const result = makeCheckResult({
      details: makeDetails({
        content_issues: [
          {
            file: "C:\\project\\short.md",
            issues: ["content_too_short"],
            detail: { actual_length: 2, min_required: 50 },
          },
        ],
      }),
    });
    const md = generateMarkdownReport(result);

    expect(md).toContain("## Content Issues");
    expect(md).toContain("C:/project/short.md");
    expect(md).toContain("actual: 2");
    expect(md).toContain("min: 50");
  });
});
