/**
 * Tests for the pipeline-orchestrator module.
 *
 * Uses dependency injection via ModuleRegistry to mock all module
 * functions. No real filesystem access occurs in these tests.
 */

import {
  runPipeline,
  computePassed,
  computeSummary,
  computeCoverageRate,
  defaultReadFile,
} from "../../src/modules/pipeline-orchestrator";
import type { ModuleRegistry } from "../../src/modules/pipeline-orchestrator";
import type {
  CheckConfig,
  DirectoryInfo,
  FileExistenceResult,
  FileSizeValidationResult,
  EncodingValidationResult,
  PairedMarkerValidationResult,
  FileReport,
  ReportDetails,
  ConsistencyCheckResult,
  FileChangeDetectionResult,
  CustomContentClassification,
  MarkerPositionClassification,
} from "../../src/types/index";
import { DEFAULT_CONFIG } from "../../src/types/index";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const START_MARKER = "<!-- skill: yiyue31-context -->";
const END_MARKER = "<!-- /yiyue31-context -->";

function makeConfig(overrides: Partial<CheckConfig> = {}): CheckConfig {
  return {
    target: "/test/root",
    ...DEFAULT_CONFIG,
    markers: {
      start: START_MARKER,
      end: END_MARKER,
      update_time_field: "update_time",
    },
    ...overrides,
  } as CheckConfig;
}

/** Build a valid file content string with markers. */
function validFileContent(inner = "Some content that is long enough to pass validation."): string {
  return `# Project\n${START_MARKER}\n${inner}\n${END_MARKER}\n`;
}

/** Create a mock registry that returns all-pass results by default. */
function createMockRegistry(
  overrides: Partial<ModuleRegistry> = {},
): ModuleRegistry {
  return {
    scanDirectories: jest.fn().mockReturnValue([
      { directory: ".", depth: 1 },
    ]),
    checkFileExistence: jest.fn().mockReturnValue([
      { directory: ".", depth: 1, fileExists: true, filePath: "/test/root/CLAUDE.md" },
    ]),
    validateFileSize: jest.fn().mockReturnValue({
      passed: true,
      actual_size: 1024,
      max_size: 51200,
    }),
    validateEncoding: jest.fn().mockReturnValue({
      passed: true,
      detectedEncoding: "utf-8",
      expectedEncoding: "utf-8",
      illegalBytes: [],
    }),
    validatePairedMarkers: jest.fn().mockReturnValue({
      valid: true,
      issues: [],
      marker_count: 1,
      extracted_content: "Some content that is long enough to pass validation.",
      content_issue: null,
    }),
    validateRequiredPatterns: jest.fn().mockReturnValue({
      required_any_missing: [],
      required_all_missing: [],
    }),
    validateForbiddenPatterns: jest.fn().mockReturnValue([]),
    checkConsistency: jest.fn().mockReturnValue(null),
    detectFileChanges: jest.fn().mockReturnValue({
      staleness: null,
      errors: [],
    }),
    analyzeMarkerPosition: jest.fn().mockReturnValue("head" as MarkerPositionClassification),
    analyzeCustomContent: jest.fn().mockReturnValue("has_custom_content" as CustomContentClassification),
    readFile: jest.fn().mockReturnValue(validFileContent()),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test 1: File missing → file_report=null, missing_files populated
// ---------------------------------------------------------------------------
describe("Pipeline: file missing", () => {
  it("produces null file_report and populates missing_files", () => {
    const config = makeConfig();
    const registry = createMockRegistry({
      checkFileExistence: jest.fn().mockReturnValue([
        { directory: "subdir", depth: 2, fileExists: false, filePath: "/test/root/subdir/CLAUDE.md" },
      ]),
    });

    const result = runPipeline(config, undefined, registry);

    expect(result.directoryReports).toHaveLength(1);
    expect(result.directoryReports[0].file_report).toBeNull();
    expect(result.directoryReports[0].directory).toBe("subdir");
    expect(result.result.details.missing_files).toHaveLength(1);
    expect(result.result.details.missing_files[0].directory).toBe("subdir");
    expect(result.result.details.missing_files[0].depth).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Test 2: File oversized → oversized_files populated, content checks skipped
// ---------------------------------------------------------------------------
describe("Pipeline: file oversized", () => {
  it("records oversized_file entry and skips all content checks", () => {
    const config = makeConfig();
    const registry = createMockRegistry({
      validateFileSize: jest.fn().mockReturnValue({
        passed: false,
        actual_size: 100000,
        max_size: 51200,
      }),
    });

    const result = runPipeline(config, undefined, registry);

    // Oversized file entry should be recorded
    expect(result.result.details.oversized_files).toHaveLength(1);
    expect(result.result.details.oversized_files[0].actual_size).toBe(100000);

    // File report should exist but be minimal (no content checks run)
    expect(result.directoryReports[0].file_report).not.toBeNull();
    expect(result.directoryReports[0].file_report!.passed).toBe(false);
    expect(result.directoryReports[0].file_report!.marker_count).toBe(0);

    // Content-dependent checks should NOT have been called
    expect(registry.validatePairedMarkers).not.toHaveBeenCalled();
    expect(registry.validateRequiredPatterns).not.toHaveBeenCalled();
    expect(registry.validateForbiddenPatterns).not.toHaveBeenCalled();
    expect(registry.checkConsistency).not.toHaveBeenCalled();
    expect(registry.analyzeMarkerPosition).not.toHaveBeenCalled();
    expect(registry.analyzeCustomContent).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Test 3: Encoding mismatch → encoding_issues populated, content parsing skipped
// ---------------------------------------------------------------------------
describe("Pipeline: encoding mismatch", () => {
  it("records encoding_issue entry and skips content parsing", () => {
    const config = makeConfig();
    const registry = createMockRegistry({
      validateEncoding: jest.fn().mockReturnValue({
        passed: false,
        detectedEncoding: "latin-1",
        expectedEncoding: "utf-8",
        illegalBytes: [{ offset: 42, byteValue: 0xff }],
      }),
    });

    const result = runPipeline(config, undefined, registry);

    // Encoding issue entry should be recorded
    expect(result.result.details.encoding_issues).toHaveLength(1);
    expect(result.result.details.encoding_issues[0].detected_encoding).toBe("latin-1");
    expect(result.result.details.encoding_issues[0].expected_encoding).toBe("utf-8");

    // File report should exist but not have content checks
    expect(result.directoryReports[0].file_report).not.toBeNull();
    expect(result.directoryReports[0].file_report!.detected_encoding).toBe("latin-1");
    expect(result.directoryReports[0].file_report!.marker_count).toBe(0);

    // Content-dependent checks should NOT have been called
    expect(registry.validatePairedMarkers).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Test 4: Markers incomplete → marker_issues populated, marker-dependent checks skipped
// ---------------------------------------------------------------------------
describe("Pipeline: markers incomplete (structural)", () => {
  it("records marker_issue and skips marker-dependent checks", () => {
    const config = makeConfig();
    const registry = createMockRegistry({
      // Content includes the managed heading so this is NOT a hand-written
      // file; the skill-managed file simply has broken/missing markers.
      readFile: jest.fn().mockReturnValue(
        "# AI Coding Auto Sections\nsome content without markers",
      ),
      validatePairedMarkers: jest.fn().mockReturnValue({
        valid: false,
        issues: ["missing_start_marker", "missing_end_marker"],
        marker_count: 0,
        extracted_content: null,
        content_issue: null,
      }),
    });

    const result = runPipeline(config, undefined, registry);

    // Marker issue should be recorded (structural only)
    expect(result.result.details.marker_issues).toHaveLength(1);
    expect(result.result.details.marker_issues[0].issues).toEqual([
      "missing_start_marker",
      "missing_end_marker",
    ]);

    // Marker-dependent checks should NOT have been called
    expect(registry.validateRequiredPatterns).not.toHaveBeenCalled();
    expect(registry.validateForbiddenPatterns).not.toHaveBeenCalled();
    expect(registry.checkConsistency).not.toHaveBeenCalled();
    expect(registry.detectFileChanges).not.toHaveBeenCalled();
    expect(registry.analyzeMarkerPosition).not.toHaveBeenCalled();
    expect(registry.analyzeCustomContent).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Test 5: All checks pass → full FileReport with passed=true
// ---------------------------------------------------------------------------
describe("Pipeline: all checks pass", () => {
  it("produces a full FileReport with passed=true", () => {
    const config = makeConfig();
    const registry = createMockRegistry();

    const result = runPipeline(config, undefined, registry);

    const fr = result.directoryReports[0].file_report!;
    expect(fr).not.toBeNull();
    expect(fr.passed).toBe(true);
    expect(fr.file_size).toBe(1024);
    expect(fr.detected_encoding).toBe("utf-8");
    expect(fr.marker_count).toBe(1);
    expect(fr.marker_issues).toEqual([]);
    expect(fr.content_length).toBeGreaterThan(0);
    expect(fr.marker_position).toBe("head");
    expect(fr.content_classification).toBe("has_custom_content");
    expect(fr.required_any_missing).toEqual([]);
    expect(fr.required_all_missing).toEqual([]);
    expect(fr.forbidden_found).toEqual([]);
    expect(fr.filesystem_mismatch).toBeNull();
    expect(fr.stale_info).toBeNull();

    // No issues in details
    expect(result.result.details.missing_files).toHaveLength(0);
    expect(result.result.details.marker_issues).toHaveLength(0);
    expect(result.result.details.encoding_issues).toHaveLength(0);
    expect(result.result.details.oversized_files).toHaveLength(0);
    expect(result.result.details.content_issues).toHaveLength(0);
    expect(result.result.summary.passed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Test 6: Multiple directories with mixed results
// ---------------------------------------------------------------------------
describe("Pipeline: multiple directories with mixed results", () => {
  it("handles a mix of missing, oversized, and passing directories", () => {
    const config = makeConfig();

    const existenceResults: FileExistenceResult[] = [
      { directory: ".", depth: 1, fileExists: true, filePath: "/test/root/CLAUDE.md" },
      { directory: "subdir", depth: 2, fileExists: false, filePath: "/test/root/subdir/CLAUDE.md" },
      { directory: "deep", depth: 2, fileExists: true, filePath: "/test/root/deep/CLAUDE.md" },
    ];

    const registry = createMockRegistry({
      checkFileExistence: jest.fn().mockReturnValue(existenceResults),
      validateFileSize: jest.fn()
        .mockImplementationOnce(() => ({
          passed: true, actual_size: 1024, max_size: 51200,
        }))
        .mockImplementationOnce(() => ({
          passed: false, actual_size: 70000, max_size: 51200,
        })),
    });

    const result = runPipeline(config, undefined, registry);

    expect(result.directoryReports).toHaveLength(3);

    // First directory: passes
    expect(result.directoryReports[0].file_report).not.toBeNull();
    expect(result.directoryReports[0].file_report!.passed).toBe(true);

    // Second directory: missing file
    expect(result.directoryReports[1].file_report).toBeNull();
    expect(result.directoryReports[1].directory).toBe("subdir");

    // Third directory: oversized
    expect(result.directoryReports[2].file_report).not.toBeNull();
    expect(result.directoryReports[2].file_report!.passed).toBe(false);
    expect(result.directoryReports[2].file_report!.file_size).toBe(70000);

    // Details should reflect mixed issues
    expect(result.result.details.missing_files).toHaveLength(1);
    expect(result.result.details.oversized_files).toHaveLength(1);
    expect(result.result.summary.passed).toBe(false);
    expect(result.result.summary.total_directories).toBe(3);
    expect(result.result.summary.covered_directories).toBe(2);
    expect(result.result.summary.missing_directories).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Test 7: computePassed returns true only when error arrays all empty
// ---------------------------------------------------------------------------
describe("computePassed", () => {
  it("returns true when all error arrays are empty", () => {
    const details: ReportDetails = {
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
    };
    expect(computePassed(details)).toBe(true);
  });

  it("returns false when missing_files is non-empty", () => {
    const details: ReportDetails = {
      missing_files: [{ directory: "x", depth: 1 }],
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
    };
    expect(computePassed(details)).toBe(false);
  });

  it("returns false when marker_issues is non-empty", () => {
    const details: ReportDetails = {
      missing_files: [],
      marker_issues: [{ file: "f", issues: ["missing_start_marker"], marker_count: 0 }],
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
    };
    expect(computePassed(details)).toBe(false);
  });

  it("returns false when encoding_issues is non-empty", () => {
    const details: ReportDetails = {
      missing_files: [],
      marker_issues: [],
      content_issues: [],
      encoding_issues: [{ file: "f", detected_encoding: "x", expected_encoding: "y" }],
      oversized_files: [],
      pattern_issues: {
        required_any_missing: [],
        required_all_missing: [],
        forbidden_found: [],
      },
      disallowed_sections: [],
      filesystem_mismatches: [],
      stale_entries: [],
    };
    expect(computePassed(details)).toBe(false);
  });

  it("returns false when oversized_files is non-empty", () => {
    const details: ReportDetails = {
      missing_files: [],
      marker_issues: [],
      content_issues: [],
      encoding_issues: [],
      oversized_files: [{ file: "f", actual_size: 999, max_size: 100 }],
      pattern_issues: {
        required_any_missing: [],
        required_all_missing: [],
        forbidden_found: [],
      },
      disallowed_sections: [],
      filesystem_mismatches: [],
      stale_entries: [],
    };
    expect(computePassed(details)).toBe(false);
  });

  it("returns true when content_issues are present but the four key arrays are empty", () => {
    // content_issues do NOT affect computePassed — only the four key arrays matter
    const details: ReportDetails = {
      missing_files: [],
      marker_issues: [],
      content_issues: [{
        file: "f",
        issues: ["content_too_short"],
        detail: { actual_length: 0, min_required: 10 },
      }],
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
    };
    expect(computePassed(details)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Test 8: coverage_rate = covered/total
// ---------------------------------------------------------------------------
describe("computeCoverageRate", () => {
  it("returns covered/total when total > 0", () => {
    expect(computeCoverageRate(7, 10)).toBeCloseTo(0.7);
    expect(computeCoverageRate(0, 5)).toBe(0);
    expect(computeCoverageRate(5, 5)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Test 9: coverage_rate undefined when total=0
// ---------------------------------------------------------------------------
describe("computeCoverageRate with zero total", () => {
  it("returns undefined when total is 0", () => {
    expect(computeCoverageRate(0, 0)).toBeUndefined();
    expect(computeCoverageRate(5, 0)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Test 10: content_too_short alongside other marker issues
// ---------------------------------------------------------------------------
describe("Pipeline: content_too_short with structural marker issues", () => {
  it("populates both marker_issues AND content_issues when content_too_short and structural issues coexist", () => {
    const config = makeConfig();
    const registry = createMockRegistry({
      validatePairedMarkers: jest.fn().mockReturnValue({
        valid: false,
        issues: ["missing_start_marker", "content_too_short"],
        marker_count: 0,
        extracted_content: null,
        content_issue: {
          file: "/test/root/CLAUDE.md",
          issues: ["content_too_short"],
          detail: { actual_length: 2, min_required: 50 },
        },
      }),
    });

    const result = runPipeline(config, undefined, registry);

    // Structural issues go to marker_issues
    expect(result.result.details.marker_issues).toHaveLength(1);
    expect(result.result.details.marker_issues[0].issues).toEqual(["missing_start_marker"]);

    // content_too_short goes to content_issues
    expect(result.result.details.content_issues).toHaveLength(1);
    expect(result.result.details.content_issues[0].issues).toEqual(["content_too_short"]);
    expect(result.result.details.content_issues[0].detail.actual_length).toBe(2);
    expect(result.result.details.content_issues[0].detail.min_required).toBe(50);

    // Marker-dependent checks should be skipped (structural issues present)
    expect(registry.validateRequiredPatterns).not.toHaveBeenCalled();
    expect(registry.validateForbiddenPatterns).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Test 11: Injected mock module registry (no real filesystem access)
// ---------------------------------------------------------------------------
describe("Pipeline: dependency injection", () => {
  it("uses the injected registry and never touches the filesystem", () => {
    const config = makeConfig();
    const registry = createMockRegistry();

    // All mock functions are jest.fn — no real FS access
    const result = runPipeline(config, undefined, registry);

    // Verify mocks were called
    expect(registry.checkFileExistence).toHaveBeenCalledTimes(1);
    expect(registry.validateFileSize).toHaveBeenCalledTimes(1);
    expect(registry.validateEncoding).toHaveBeenCalledTimes(1);
    expect(registry.validatePairedMarkers).toHaveBeenCalledTimes(1);
    expect(registry.validateRequiredPatterns).toHaveBeenCalledTimes(1);
    expect(registry.validateForbiddenPatterns).toHaveBeenCalledTimes(1);
    expect(registry.checkConsistency).toHaveBeenCalledTimes(1);
    expect(registry.detectFileChanges).toHaveBeenCalledTimes(1);
    expect(registry.analyzeMarkerPosition).toHaveBeenCalledTimes(1);
    expect(registry.analyzeCustomContent).toHaveBeenCalledTimes(1);

    // Result should be well-formed
    expect(result.result.meta.target).toBe("/test/root");
    expect(result.result.summary.total_directories).toBe(1);
    expect(result.result.summary.passed).toBe(true);
    expect(result.result.marker_position_stats.head).toBe(1);
    expect(result.result.summary.custom_content_stats.has_custom_content).toBe(1);
  });

  it("produces correct marker_position_stats across multiple files", () => {
    const config = makeConfig();
    const registry = createMockRegistry({
      checkFileExistence: jest.fn().mockReturnValue([
        { directory: ".", depth: 1, fileExists: true, filePath: "/test/root/CLAUDE.md" },
        { directory: "a", depth: 2, fileExists: true, filePath: "/test/root/a/CLAUDE.md" },
        { directory: "b", depth: 2, fileExists: true, filePath: "/test/root/b/CLAUDE.md" },
      ]),
      scanDirectories: jest.fn().mockReturnValue([
        { directory: ".", depth: 1 },
        { directory: "a", depth: 2 },
        { directory: "b", depth: 2 },
      ]),
      analyzeMarkerPosition: jest.fn()
        .mockReturnValueOnce("head")
        .mockReturnValueOnce("middle")
        .mockReturnValueOnce("tail"),
    });

    const result = runPipeline(config, undefined, registry);

    expect(result.result.marker_position_stats).toEqual({
      head: 1,
      middle: 1,
      tail: 1,
    });
  });
});

// ---------------------------------------------------------------------------
// computeSummary integration
// ---------------------------------------------------------------------------
describe("computeSummary", () => {
  it("computes summary with correct coverage_rate", () => {
    const details: ReportDetails = {
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
    };
    const summary = computeSummary(10, 8, 2, details, {
      has_custom_content: 5,
      marker_only: 3,
    });
    expect(summary.total_directories).toBe(10);
    expect(summary.covered_directories).toBe(8);
    expect(summary.missing_directories).toBe(2);
    expect(summary.coverage_rate).toBeCloseTo(0.8);
    expect(summary.passed).toBe(true);
    expect(summary.custom_content_stats).toEqual({
      has_custom_content: 5,
      marker_only: 3,
    });
  });
});

// ---------------------------------------------------------------------------
// Test: readFile throws → encoding issue recorded
// ---------------------------------------------------------------------------
describe("Pipeline: readFile throws", () => {
  it("records encoding issue with unreadable when readFile throws", () => {
    const config = makeConfig();
    const registry = createMockRegistry({
      readFile: jest.fn().mockImplementation(() => {
        throw new Error("ENOENT");
      }),
    });

    const result = runPipeline(config, undefined, registry);

    expect(result.result.details.encoding_issues).toHaveLength(1);
    expect(result.result.details.encoding_issues[0].detected_encoding).toBe("unreadable");
    expect(result.directoryReports[0].file_report).not.toBeNull();
    expect(result.directoryReports[0].file_report!.detected_encoding).toBe("unreadable");
    expect(result.directoryReports[0].file_report!.passed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Test: directories parameter provided → uses those instead of scanning
// ---------------------------------------------------------------------------
describe("Pipeline: directories parameter", () => {
  it("uses provided directories instead of scanning when passed", () => {
    const config = makeConfig();
    const registry = createMockRegistry();

    const result = runPipeline(config, ["/test/root"], registry);

    // scanDirectories should NOT have been called
    expect(registry.scanDirectories).not.toHaveBeenCalled();

    // checkFileExistence should have been called with the mapped dir info
    expect(registry.checkFileExistence).toHaveBeenCalledTimes(1);

    // Result should have one directory report
    expect(result.directoryReports).toHaveLength(1);
    expect(result.directoryReports[0].directory).toBe(".");
  });

  it("maps subdirectory paths correctly", () => {
    const config = makeConfig();
    const registry = createMockRegistry({
      checkFileExistence: jest.fn().mockReturnValue([
        { directory: "sub/deep", depth: 4, fileExists: true, filePath: "/test/root/sub/deep/CLAUDE.md" },
      ]),
    });

    const result = runPipeline(config, ["/test/root/sub/deep"], registry);

    expect(result.directoryReports).toHaveLength(1);
    expect(result.directoryReports[0].directory).toBe("sub/deep");
  });
});

// ---------------------------------------------------------------------------
// Test: forbidden patterns found → recorded in details
// ---------------------------------------------------------------------------
describe("Pipeline: forbidden patterns found", () => {
  it("records forbidden_found entries in both file report and details", () => {
    const config = makeConfig({ forbidden_patterns: ["TODO"] });
    const registry = createMockRegistry({
      validateForbiddenPatterns: jest.fn().mockReturnValue([{
        file: "/test/root/CLAUDE.md",
        matches: [{ pattern: "TODO", context: "some TODO here" }],
      }]),
    });

    const result = runPipeline(config, undefined, registry);

    expect(result.result.details.pattern_issues.forbidden_found).toHaveLength(1);
    expect(result.result.details.pattern_issues.forbidden_found[0].matches[0].pattern).toBe("TODO");

    const fr = result.directoryReports[0].file_report!;
    expect(fr.forbidden_found).toHaveLength(1);
    expect(fr.forbidden_found[0].pattern).toBe("TODO");
    expect(fr.passed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Test: required patterns missing → recorded in details
// ---------------------------------------------------------------------------
describe("Pipeline: required patterns missing", () => {
  it("records required_any_missing and required_all_missing in details", () => {
    const config = makeConfig({
      required_any_patterns: ["MUST_HAVE_THIS"],
      required_all_patterns: ["ALWAYS_INCLUDE"],
    });
    const registry = createMockRegistry({
      validateRequiredPatterns: jest.fn().mockReturnValue({
        required_any_missing: ["MUST_HAVE_THIS"],
        required_all_missing: ["ALWAYS_INCLUDE"],
      }),
    });

    const result = runPipeline(config, undefined, registry);

    expect(result.result.details.pattern_issues.required_any_missing).toHaveLength(1);
    expect(result.result.details.pattern_issues.required_any_missing[0].patterns).toEqual(["MUST_HAVE_THIS"]);

    expect(result.result.details.pattern_issues.required_all_missing).toHaveLength(1);
    expect(result.result.details.pattern_issues.required_all_missing[0].missing_pattern).toBe("ALWAYS_INCLUDE");

    const fr = result.directoryReports[0].file_report!;
    expect(fr.required_any_missing).toEqual(["MUST_HAVE_THIS"]);
    expect(fr.required_all_missing).toEqual(["ALWAYS_INCLUDE"]);
    expect(fr.passed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Test: filesystem consistency mismatch → recorded
// ---------------------------------------------------------------------------
describe("Pipeline: filesystem mismatch", () => {
  it("records filesystem_mismatch in file report and details", () => {
    const config = makeConfig();
    const registry = createMockRegistry({
      checkConsistency: jest.fn().mockReturnValue({
        directory: "/test/root",
        file: "CLAUDE.md",
        unrecorded: ["new_file.ts"],
        nonexistent: ["old_file.ts"],
      }),
    });

    const result = runPipeline(config, undefined, registry);

    expect(result.result.details.filesystem_mismatches).toHaveLength(1);
    expect(result.result.details.filesystem_mismatches[0].unrecorded).toEqual(["new_file.ts"]);
    expect(result.result.details.filesystem_mismatches[0].nonexistent).toEqual(["old_file.ts"]);

    const fr = result.directoryReports[0].file_report!;
    expect(fr.filesystem_mismatch).not.toBeNull();
    expect(fr.filesystem_mismatch!.unrecorded).toEqual(["new_file.ts"]);
    expect(fr.filesystem_mismatch!.nonexistent).toEqual(["old_file.ts"]);
    expect(fr.passed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Test: staleness detected → recorded
// ---------------------------------------------------------------------------
describe("Pipeline: stale files detected", () => {
  it("records stale_entries in details and stale_info in file report", () => {
    const config = makeConfig();
    const registry = createMockRegistry({
      detectFileChanges: jest.fn().mockReturnValue({
        staleness: {
          directory: "/test/root",
          file: "",
          update_time: "2026-01-01T00:00:00.000Z",
          stale_files: [{ name: "changed.ts", mtime: "2026-06-01T00:00:00.000Z" }],
          fallback_to_file_mtime: false,
        },
        errors: [],
      }),
    });

    const result = runPipeline(config, undefined, registry);

    expect(result.result.details.stale_entries).toHaveLength(1);
    expect(result.result.details.stale_entries[0].update_time).toBe("2026-01-01T00:00:00.000Z");
    expect(result.result.details.stale_entries[0].stale_files).toHaveLength(1);

    const fr = result.directoryReports[0].file_report!;
    expect(fr.stale_info).not.toBeNull();
    expect(fr.stale_info!.update_time).toBe("2026-01-01T00:00:00.000Z");
    expect(fr.stale_info!.stale_files).toHaveLength(1);
    expect(fr.passed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Test: marker_only content classification
// ---------------------------------------------------------------------------
describe("Pipeline: marker_only classification", () => {
  it("counts marker_only files in custom_content_stats", () => {
    const config = makeConfig();
    const registry = createMockRegistry({
      analyzeCustomContent: jest.fn().mockReturnValue("marker_only" as CustomContentClassification),
    });

    const result = runPipeline(config, undefined, registry);

    expect(result.result.summary.custom_content_stats.marker_only).toBe(1);
    expect(result.result.summary.custom_content_stats.has_custom_content).toBe(0);

    const fr = result.directoryReports[0].file_report!;
    expect(fr.content_classification).toBe("marker_only");
  });
});

// ---------------------------------------------------------------------------
// Test: content_too_short only (no structural issues) → marker-dependent checks run
// ---------------------------------------------------------------------------
describe("Pipeline: content_too_short only (no structural issues)", () => {
  it("records content_issue but still runs marker-dependent checks", () => {
    const config = makeConfig();
    const registry = createMockRegistry({
      validatePairedMarkers: jest.fn().mockReturnValue({
        valid: false,
        issues: ["content_too_short"],
        marker_count: 1,
        extracted_content: "ab",
        content_issue: {
          file: "/test/root/CLAUDE.md",
          issues: ["content_too_short"],
          detail: { actual_length: 2, min_required: 50 },
        },
      }),
    });

    const result = runPipeline(config, undefined, registry);

    // No structural issues, so marker_issues should be empty
    expect(result.result.details.marker_issues).toHaveLength(0);

    // content_too_short goes to content_issues
    expect(result.result.details.content_issues).toHaveLength(1);
    expect(result.result.details.content_issues[0].issues).toEqual(["content_too_short"]);

    // Marker-dependent checks SHOULD have been called (no structural issues)
    expect(registry.validateRequiredPatterns).toHaveBeenCalled();
    expect(registry.validateForbiddenPatterns).toHaveBeenCalled();
    expect(registry.checkConsistency).toHaveBeenCalled();
    expect(registry.detectFileChanges).toHaveBeenCalled();
    expect(registry.analyzeMarkerPosition).toHaveBeenCalled();
    expect(registry.analyzeCustomContent).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Test: depth_distribution computed correctly
// ---------------------------------------------------------------------------
describe("Pipeline: depth distribution", () => {
  it("computes depth_distribution from directory reports", () => {
    const config = makeConfig();
    const registry = createMockRegistry({
      checkFileExistence: jest.fn().mockReturnValue([
        { directory: ".", depth: 1, fileExists: true, filePath: "/test/root/CLAUDE.md" },
        { directory: "a", depth: 2, fileExists: true, filePath: "/test/root/a/CLAUDE.md" },
        { directory: "b", depth: 2, fileExists: false, filePath: "/test/root/b/CLAUDE.md" },
      ]),
    });

    const result = runPipeline(config, undefined, registry);

    expect(result.result.depth_distribution["1"]).toEqual({ total: 1, covered: 1, missing: 0 });
    expect(result.result.depth_distribution["2"]).toEqual({ total: 2, covered: 1, missing: 1 });
  });
});

// ---------------------------------------------------------------------------
// Test: empty directories list
// ---------------------------------------------------------------------------
describe("Pipeline: empty directories", () => {
  it("handles zero directories gracefully", () => {
    const config = makeConfig();
    const registry = createMockRegistry({
      checkFileExistence: jest.fn().mockReturnValue([]),
    });

    const result = runPipeline(config, undefined, registry);

    expect(result.directoryReports).toHaveLength(0);
    expect(result.result.summary.total_directories).toBe(0);
    expect(result.result.summary.covered_directories).toBe(0);
    expect(result.result.summary.missing_directories).toBe(0);
    expect(result.result.summary.coverage_rate).toBeUndefined();
    expect(result.result.summary.passed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Test: defaultReadFile
// ---------------------------------------------------------------------------
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("defaultReadFile", () => {
  const tmpDir = join(tmpdir(), `pipeline-orch-test-${Date.now()}`);

  beforeAll(() => {
    mkdirSync(tmpDir, { recursive: true });
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("reads file content as UTF-8 string", () => {
    const filePath = join(tmpDir, "test-read.txt");
    writeFileSync(filePath, "Hello, world!", "utf-8");
    expect(defaultReadFile(filePath)).toBe("Hello, world!");
  });
});

// ---------------------------------------------------------------------------
// Tests: rewritten-skill behaviors (allowed sections + report-only hand-written)
// ---------------------------------------------------------------------------
import { validateAllowedSections } from "../../src/modules/allowed-section-validator.js";

/** Build marker-block content with the full bilingual six-section set. */
function sixSectionInner(): string {
  return (
    "## 目录职责 / Directory Purpose\n做X\n" +
    "## 关键文件 / Key Files\n表\n" +
    "## 设计要点与原因 / Design Notes & Why\n原因\n" +
    "## 约定与陷阱 / Conventions & Traps\n约定\n" +
    "## 依赖关系 / Dependencies\n依赖\n" +
    "## 扩展指南 / Extension Guide\n指南\n"
  );
}

// ---------------------------------------------------------------------------
// Test: hand-written file (no heading AND no markers) → report-only, non-failing
// ---------------------------------------------------------------------------
describe("Pipeline: hand-written file is report-only (non-failing)", () => {
  it("passes and skips marker validation when the file has no heading and no markers", () => {
    const config = makeConfig();
    const pairedMarkers = jest.fn().mockReturnValue({
      valid: true,
      issues: [],
      marker_count: 1,
      extracted_content: "x",
      content_issue: null,
    });
    const registry = createMockRegistry({
      readFile: jest.fn().mockReturnValue(
        "# Some Project\n\nHand-written notes.\n\n## Notes\n- a\n",
      ),
      validatePairedMarkers: pairedMarkers,
    });

    const result = runPipeline(config, undefined, registry);

    // A hand-written CLAUDE.md must not fail the run on a missing-marker /
    // missing-section error.
    expect(result.directoryReports[0].file_report!.passed).toBe(true);
    expect(result.directoryReports[0].file_report!.marker_count).toBe(0);
    // Marker checks are skipped entirely for a hand-written file.
    expect(pairedMarkers).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Test: managed file with all six allowed sections → passes
// ---------------------------------------------------------------------------
describe("Pipeline: managed six-section file passes", () => {
  it("passes when the marker block contains only allowed sections", () => {
    const config = makeConfig();
    const content = `# AI Coding Auto Sections\n${START_MARKER}\n${sixSectionInner()}\n${END_MARKER}\n`;
    const registry = createMockRegistry({
      readFile: jest.fn().mockReturnValue(content),
      validateAllowedSections,
    });

    const result = runPipeline(config, undefined, registry);

    expect(result.directoryReports[0].file_report!.passed).toBe(true);
    expect(result.result.details.disallowed_sections).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Test: managed file with an adaptive subset → still passes
// ---------------------------------------------------------------------------
describe("Pipeline: managed adaptive subset passes", () => {
  it("passes when the marker block contains a subset of the allowed sections", () => {
    const config = makeConfig();
    const inner = "## 目录职责\n做X\n## 关键文件\n表\n";
    const content = `# AI Coding Auto Sections\n${START_MARKER}\n${inner}\n${END_MARKER}\n`;
    const registry = createMockRegistry({
      readFile: jest.fn().mockReturnValue(content),
      validateAllowedSections,
    });

    const result = runPipeline(config, undefined, registry);

    expect(result.directoryReports[0].file_report!.passed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Test: managed file with a disallowed section → fails and is reported
// ---------------------------------------------------------------------------
describe("Pipeline: disallowed section fails and is reported", () => {
  it("fails and records a disallowed_sections entry when a section is outside the allowed set", () => {
    const config = makeConfig();
    const inner = "## 目录职责 / Directory Purpose\n做X\n## 非法段 / Illegal\nY\n";
    const content = `# AI Coding Auto Sections\n${START_MARKER}\n${inner}\n${END_MARKER}\n`;
    const registry = createMockRegistry({
      readFile: jest.fn().mockReturnValue(content),
      validateAllowedSections,
    });

    const result = runPipeline(config, undefined, registry);

    expect(result.directoryReports[0].file_report!.passed).toBe(false);
    expect(result.result.details.disallowed_sections).toHaveLength(1);
    expect(result.result.details.disallowed_sections[0].headings).toContain(
      "非法段 / Illegal",
    );
  });
});
