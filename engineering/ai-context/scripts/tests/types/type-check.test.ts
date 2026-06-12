/**
 * Compile-time type assertion tests.
 *
 * These tests verify that all type definitions compile correctly,
 * discriminated unions narrow as expected, DEFAULT_CONFIG matches
 * CheckConfig shape, and error classes have the correct inheritance chain.
 *
 * At runtime each test simply constructs values and performs instanceof
 * checks; the real value is that `tsc --noEmit` catches any type errors.
 */

import { describe, it, expect } from "@jest/globals";
import {
  DEFAULT_CONFIG,
  CliParseError,
  MissingRequiredArgError,
  InvalidArgValueError,
  HelpRequestedError,
} from "../../src/types/index.js";
import type {
  // Enum types
  MarkerIssueIdentifier,
  MarkerPositionClassification,
  CustomContentClassification,
  // Config types
  MarkerConfig,
  OutputConfig,
  CheckConfig,
  CliArgs,
  // Report types
  ForbiddenMatch,
  FilesystemMismatch,
  StaleFileInfo,
  StaleInfo,
  FileReport,
  DirectoryReport,
  ReportMeta,
  CustomContentStats,
  ReportSummary,
  DepthBucket,
  MissingFileEntry,
  MarkerIssueEntry,
  ContentIssueEntry,
  EncodingIssueEntry,
  OversizedFileEntry,
  RequiredAnyMissingEntry,
  RequiredAllMissingEntry,
  ForbiddenFoundEntry,
  PatternIssues,
  FilesystemMismatchEntry,
  StaleEntry,
  ReportDetails,
  CheckResult,
  // Validation types
  ValidationError,
  ValidatedConfig,
  InvalidConfig,
  ValidationResult,
  DirectoryInfo,
  FileExistenceResult,
  ContentLengthDetail,
  ContentIssueResult,
  PairedMarkerValidationResult,
  IllegalBytePosition,
  EncodingValidationResult,
  FileSizeValidationResult,
  DiskEntry,
  ParsedEntry,
  DiffResult,
  ConsistencyCheckResult,
  FileChangeDetectionError,
  FileChangeDetectionResult,
  DirectoryDepthEntry,
  DepthDistributionResult,
  PipelineResult,
} from "../../src/types/index.js";

// ---------------------------------------------------------------------------
// Helper: assert that a value of type T is assignable to itself.
// This function only compiles if the type argument resolves correctly.
// ---------------------------------------------------------------------------
function assertType<T>(_: T): void {
  /* compile-time only */
}

// ---------------------------------------------------------------------------
// 1. All type aliases compile correctly
// ---------------------------------------------------------------------------

describe("Type definitions compile correctly", () => {
  it("enum literal types accept valid values", () => {
    const issue: MarkerIssueIdentifier = "missing_start_marker";
    assertType<MarkerIssueIdentifier>(issue);

    const pos: MarkerPositionClassification = "head";
    assertType<MarkerPositionClassification>(pos);

    const cc: CustomContentClassification = "has_custom_content";
    assertType<CustomContentClassification>(cc);
  });

  it("config types accept well-shaped values", () => {
    const marker: MarkerConfig = {
      start: "<!-- start -->",
      end: "<!-- end -->",
      update_time_field: "update_time",
    };
    assertType<MarkerConfig>(marker);

    const output: OutputConfig = { json: "report.json" };
    assertType<OutputConfig>(output);

    const cli: CliArgs = {
      target: ".",
      exclude: [],
      include: [],
      filename: "CLAUDE.md",
    };
    assertType<CliArgs>(cli);
  });

  it("report types accept well-shaped values", () => {
    const fm: ForbiddenMatch = { pattern: "secret", context: "...secret..." };
    assertType<ForbiddenMatch>(fm);

    const fsm: FilesystemMismatch = { unrecorded: ["a"], nonexistent: ["b"] };
    assertType<FilesystemMismatch>(fsm);

    const sfi: StaleFileInfo = { name: "foo.ts", mtime: "2024-01-01" };
    assertType<StaleFileInfo>(sfi);

    const si: StaleInfo = {
      update_time: "2024-01-01",
      stale_files: [],
      fallback_to_file_mtime: false,
    };
    assertType<StaleInfo>(si);

    const db: DepthBucket = { total: 5, covered: 3, missing: 2 };
    assertType<DepthBucket>(db);
  });

  it("validation types accept well-shaped values", () => {
    const ve: ValidationError = {
      field: "target",
      message: "required",
      fatal: true,
    };
    assertType<ValidationError>(ve);

    const dep: DirectoryInfo = { directory: "/tmp", depth: 0 };
    assertType<DirectoryInfo>(dep);

    const fer: FileExistenceResult = {
      directory: "/tmp",
      depth: 0,
      fileExists: true,
      filePath: "/tmp/CLAUDE.md",
    };
    assertType<FileExistenceResult>(fer);

    const cld: ContentLengthDetail = { actual_length: 5, min_required: 10 };
    assertType<ContentLengthDetail>(cld);

    const ibp: IllegalBytePosition = { offset: 42, byteValue: 0xff };
    assertType<IllegalBytePosition>(ibp);

    const fsvr: FileSizeValidationResult = {
      passed: true,
      actual_size: 100,
      max_size: 51200,
    };
    assertType<FileSizeValidationResult>(fsvr);

    const de: DiskEntry = { name: "src", type: "directory" };
    assertType<DiskEntry>(de);

    const pe: ParsedEntry = { name: "src", type: "directory" };
    assertType<ParsedEntry>(pe);

    const dr: DiffResult = { unrecorded: [], nonexistent: [] };
    assertType<DiffResult>(dr);
  });
});

// ---------------------------------------------------------------------------
// 2. Discriminated unions narrow correctly
// ---------------------------------------------------------------------------

describe("Discriminated union narrowing", () => {
  it("ValidationResult narrows on isValid", () => {
    const fullConfig: CheckConfig = { target: ".", ...DEFAULT_CONFIG };
    const valid: ValidationResult = {
      isValid: true,
      config: fullConfig,
      errors: [],
    };
    const invalid: ValidationResult = {
      isValid: false,
      errors: [{ field: "target", message: "missing", fatal: true }],
    };

    // Valid branch — config is accessible
    if (valid.isValid) {
      assertType<CheckConfig>(valid.config);
      expect(valid.config.target).toBe(".");
    }

    // Invalid branch — errors is non-empty array
    if (!invalid.isValid) {
      assertType<ValidationError[]>(invalid.errors);
      expect(invalid.errors).toHaveLength(1);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. DEFAULT_CONFIG matches CheckConfig shape
// ---------------------------------------------------------------------------

describe("DEFAULT_CONFIG matches CheckConfig", () => {
  it("is assignable to CheckConfig (with target supplied)", () => {
    const config: CheckConfig = { target: ".", ...DEFAULT_CONFIG };
    assertType<CheckConfig>(config);
    expect(config.filename).toBe("CLAUDE.md");
    expect(config.max_file_size).toBe(51200);
    expect(config.expected_encoding).toBe("utf-8");
    expect(config.markers.start).toBe("<!-- skill: ai-context -->");
    expect(config.markers.end).toBe("<!-- /ai-context -->");
    expect(config.markers.update_time_field).toBe("update_time");
  });
});

// ---------------------------------------------------------------------------
// 4. Error classes have correct inheritance chain
// ---------------------------------------------------------------------------

describe("Error class inheritance chain", () => {
  it("CliParseError extends Error", () => {
    const err = new CliParseError("test");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(CliParseError);
    expect(err.name).toBe("CliParseError");
    expect(err.message).toBe("test");
  });

  it("MissingRequiredArgError extends CliParseError", () => {
    const err = new MissingRequiredArgError("target");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(CliParseError);
    expect(err).toBeInstanceOf(MissingRequiredArgError);
    expect(err.arg).toBe("target");
  });

  it("InvalidArgValueError extends CliParseError and carries value", () => {
    const err = new InvalidArgValueError("depth", "abc");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(CliParseError);
    expect(err).toBeInstanceOf(InvalidArgValueError);
    expect(err.arg).toBe("depth");
    expect(err.value).toBe("abc");
  });

  it("HelpRequestedError extends CliParseError", () => {
    const err = new HelpRequestedError();
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(CliParseError);
    expect(err).toBeInstanceOf(HelpRequestedError);
    expect(err.arg).toBeUndefined();
  });
});
