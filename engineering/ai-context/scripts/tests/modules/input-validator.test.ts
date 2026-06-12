/**
 * Tests for the input-validator module.
 */

import { validateInput } from "../../src/modules/input-validator.js";
import { fsWrapper } from "../../src/utils/fs-wrapper.js";
import { mkdirSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { CheckConfig, ValidationResult } from "../../src/types/index.js";
import { DEFAULT_CONFIG } from "../../src/types/index.js";
import fs from "node:fs";

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
      start: "<!-- skill: ai-context -->",
      end: "<!-- /ai-context -->",
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
// Mock setup — intercept fsWrapper calls so we control fs behaviour
// ---------------------------------------------------------------------------

const mockExistsSync = jest.fn<boolean, [string]>();
const mockStatSync = jest.fn<fs.Stats, [string]>();
const mockAccessSync = jest.fn<void, [string, number?]>();

// Save originals so we can restore them for the fs-wrapper coverage tests
const originalExistsSync = fsWrapper.existsSync;
const originalStatSync = fsWrapper.statSync;
const originalAccessSync = fsWrapper.accessSync;

/** Create a fake Stats object with `isDirectory()` returning the given value. */
function fakeStats(isDir: boolean): fs.Stats {
  return { isDirectory: () => isDir } as unknown as fs.Stats;
}

beforeAll(() => {
  // Replace fsWrapper methods with mocks for the entire test suite
  fsWrapper.existsSync = mockExistsSync;
  fsWrapper.statSync = mockStatSync;
  fsWrapper.accessSync = mockAccessSync;
});

beforeEach(() => {
  // Default: everything passes
  mockExistsSync.mockReturnValue(true);
  mockStatSync.mockReturnValue(fakeStats(true));
  mockAccessSync.mockReturnValue(undefined);
});

afterAll(() => {
  // Restore originals so coverage tracks the real implementations
  fsWrapper.existsSync = originalExistsSync;
  fsWrapper.statSync = originalStatSync;
  fsWrapper.accessSync = originalAccessSync;
});

// ---------------------------------------------------------------------------
// 1. All valid → ValidatedConfig { isValid: true, config }
// ---------------------------------------------------------------------------
describe("validateInput — all valid", () => {
  it("returns ValidatedConfig when all checks pass", () => {
    const config = makeConfig();
    const result = validateInput(config);

    expect(result.isValid).toBe(true);
    if (result.isValid) {
      expect(result.config).toEqual(config);
      expect(result.errors).toEqual([]);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Non-existent target → error with field 'target'
// ---------------------------------------------------------------------------
describe("validateInput — non-existent target", () => {
  it("returns InvalidConfig with field 'target' when target does not exist", () => {
    mockExistsSync.mockReturnValue(false);
    const config = makeConfig({ target: "/no/such/path" });
    const result = validateInput(config);

    expect(result.isValid).toBe(false);
    if (!result.isValid) {
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe("target");
      expect(result.errors[0].fatal).toBe(true);
      expect(result.errors[0].message).toContain("does not exist");
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Target is a file (not a directory) → error with field 'target'
// ---------------------------------------------------------------------------
describe("validateInput — target is not a directory", () => {
  it("returns InvalidConfig when target is a file", () => {
    mockStatSync.mockReturnValue(fakeStats(false));
    const config = makeConfig({ target: "/some/file.txt" });
    const result = validateInput(config);

    expect(result.isValid).toBe(false);
    if (!result.isValid) {
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe("target");
      expect(result.errors[0].message).toContain("not a directory");
    }
  });
});

// ---------------------------------------------------------------------------
// 4. No read permission → error with field 'target'
// ---------------------------------------------------------------------------
describe("validateInput — no read permission", () => {
  it("returns InvalidConfig when target is not readable", () => {
    mockAccessSync.mockImplementation(() => {
      throw new Error("EACCES: permission denied");
    });
    const config = makeConfig({ target: "/no/access" });
    const result = validateInput(config);

    expect(result.isValid).toBe(false);
    if (!result.isValid) {
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe("target");
      expect(result.errors[0].message).toContain("not readable");
    }
  });
});

// ---------------------------------------------------------------------------
// 5. filename does not end with ".md" → error about .md extension
// ---------------------------------------------------------------------------
describe("validateInput — filename without .md extension", () => {
  it("returns InvalidConfig when filename is readme.txt", () => {
    const config = makeConfig({ filename: "readme.txt" });
    const result = validateInput(config);

    expect(result.isValid).toBe(false);
    if (!result.isValid) {
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe("filename");
      expect(result.errors[0].message).toContain(".md");
    }
  });
});

// ---------------------------------------------------------------------------
// 6. markers.start is empty → error with field 'markers.start'
// ---------------------------------------------------------------------------
describe("validateInput — markers.start empty", () => {
  it("returns InvalidConfig when markers.start is empty string", () => {
    const config = makeConfig({
      markers: { start: "", end: "<!-- end -->", update_time_field: "ut" },
    });
    const result = validateInput(config);

    expect(result.isValid).toBe(false);
    if (!result.isValid) {
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe("markers.start");
      expect(result.errors[0].message).toContain("must not be empty");
    }
  });
});

// ---------------------------------------------------------------------------
// 7. markers.end is empty → error with field 'markers.end'
// ---------------------------------------------------------------------------
describe("validateInput — markers.end empty", () => {
  it("returns InvalidConfig when markers.end is empty string", () => {
    const config = makeConfig({
      markers: { start: "<!-- start -->", end: "", update_time_field: "ut" },
    });
    const result = validateInput(config);

    expect(result.isValid).toBe(false);
    if (!result.isValid) {
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe("markers.end");
      expect(result.errors[0].message).toContain("must not be empty");
    }
  });
});

// ---------------------------------------------------------------------------
// 8. Invalid regex in required_any_patterns → error identifying field and pattern
// ---------------------------------------------------------------------------
describe("validateInput — invalid regex pattern", () => {
  it("returns InvalidConfig for invalid regex in required_any_patterns", () => {
    const config = makeConfig({
      required_any_patterns: ["[invalid"],
    });
    const result = validateInput(config);

    expect(result.isValid).toBe(false);
    if (!result.isValid) {
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe("required_any_patterns");
      expect(result.errors[0].message).toContain("[invalid");
    }
  });

  it("returns InvalidConfig for invalid regex in required_all_patterns", () => {
    const config = makeConfig({
      required_all_patterns: ["(unclosed"],
    });
    const result = validateInput(config);

    expect(result.isValid).toBe(false);
    if (!result.isValid) {
      expect(result.errors[0].field).toBe("required_all_patterns");
    }
  });

  it("returns InvalidConfig for invalid regex in forbidden_patterns", () => {
    const config = makeConfig({
      forbidden_patterns: ["+bad"],
    });
    const result = validateInput(config);

    expect(result.isValid).toBe(false);
    if (!result.isValid) {
      expect(result.errors[0].field).toBe("forbidden_patterns");
    }
  });
});

// ---------------------------------------------------------------------------
// 9. Empty regex arrays → returns valid (no error)
// ---------------------------------------------------------------------------
describe("validateInput — empty regex arrays are valid", () => {
  it("returns ValidatedConfig when all pattern arrays are empty", () => {
    const config = makeConfig({
      required_any_patterns: [],
      required_all_patterns: [],
      forbidden_patterns: [],
    });
    const result = validateInput(config);

    expect(result.isValid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 10. output.json parent dir doesn't exist → error
// ---------------------------------------------------------------------------
describe("validateInput — output.json parent dir missing", () => {
  it("returns InvalidConfig when output.json parent dir does not exist", () => {
    // existsSync returns true for most things, but false for the json parent dir
    mockExistsSync.mockImplementation((p: string) => {
      if (p === "/nonexistent/dir") return false;
      return true;
    });

    const config = makeConfig({
      output: { json: "/nonexistent/dir/report.json" },
    });
    const result = validateInput(config);

    expect(result.isValid).toBe(false);
    if (!result.isValid) {
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe("output.json");
      expect(result.errors[0].message).toContain("Parent directory");
    }
  });
});

// ---------------------------------------------------------------------------
// 11. First fatal error stops further checks (short-circuit)
// ---------------------------------------------------------------------------
describe("validateInput — short-circuit behaviour", () => {
  it("stops at the first error even when multiple fields are invalid", () => {
    // Target exists but is not a directory
    mockStatSync.mockReturnValue(fakeStats(false));

    // Also set invalid markers and invalid filename — but these should not be checked
    const config = makeConfig({
      filename: "readme.txt",
      markers: { start: "", end: "", update_time_field: "ut" },
    });
    const result = validateInput(config);

    expect(result.isValid).toBe(false);
    if (!result.isValid) {
      // Only one error — the target-is-not-directory check (case 2)
      // stopped before reaching filename (case 6) or markers (case 7)
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe("target");
      expect(result.errors[0].message).toContain("not a directory");
    }
  });
});

// ---------------------------------------------------------------------------
// 12. output.markdown parent dir doesn't exist → error
// ---------------------------------------------------------------------------
describe("validateInput — output.markdown parent dir missing", () => {
  it("returns InvalidConfig when output.markdown parent dir does not exist", () => {
    mockExistsSync.mockImplementation((p: string) => {
      if (p === "/missing/path") return false;
      return true;
    });

    const config = makeConfig({
      output: { markdown: "/missing/path/report.md" },
    });
    const result = validateInput(config);

    expect(result.isValid).toBe(false);
    if (!result.isValid) {
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe("output.markdown");
      expect(result.errors[0].message).toContain("Parent directory");
    }
  });
});

// ---------------------------------------------------------------------------
// 13. validatePatternArray returns null when all patterns are valid
//     (covers line 55 — the `return null` path)
// ---------------------------------------------------------------------------
describe("validateInput — valid regex patterns pass", () => {
  it("returns ValidatedConfig when all pattern arrays contain valid regexes", () => {
    const config = makeConfig({
      required_any_patterns: ["\\d+", "[a-z]+"],
      required_all_patterns: ["^hello"],
      forbidden_patterns: ["bad\\s+word"],
    });
    const result = validateInput(config);

    expect(result.isValid).toBe(true);
    if (result.isValid) {
      expect(result.errors).toEqual([]);
    }
  });
});

// ---------------------------------------------------------------------------
// 14. statSync throws → returns fatal error (covers line 94 catch block)
// ---------------------------------------------------------------------------
describe("validateInput — statSync throws", () => {
  it("returns InvalidConfig when statSync throws an error", () => {
    mockStatSync.mockImplementation(() => {
      throw new Error("EIO: I/O error");
    });

    const config = makeConfig({ target: "/io/error/path" });
    const result = validateInput(config);

    expect(result.isValid).toBe(false);
    if (!result.isValid) {
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe("target");
      expect(result.errors[0].message).toContain("Cannot stat");
    }
  });
});

// ---------------------------------------------------------------------------
// 15. fsWrapper real implementations (covers fs-wrapper.ts lines 18-23)
//     Temporarily restores the original implementations so the production
//     arrow-function bodies in fs-wrapper.ts are exercised for coverage.
// ---------------------------------------------------------------------------
describe("fsWrapper — real implementations", () => {
  const TMP_DIR = join(process.env.TEMP || "/tmp", "fs-wrapper-test");

  beforeAll(() => {
    if (!existsSync(TMP_DIR)) {
      mkdirSync(TMP_DIR, { recursive: true });
    }
    // Temporarily restore originals so coverage tracks the real implementations
    fsWrapper.existsSync = originalExistsSync;
    fsWrapper.statSync = originalStatSync;
    fsWrapper.accessSync = originalAccessSync;
  });

  afterAll(() => {
    // Put mocks back (not strictly needed since this is the last block,
    // but keeps things consistent in case tests are reordered)
    fsWrapper.existsSync = mockExistsSync;
    fsWrapper.statSync = mockStatSync;
    fsWrapper.accessSync = mockAccessSync;

    if (existsSync(TMP_DIR)) {
      rmSync(TMP_DIR, { recursive: true, force: true });
    }
  });

  it("existsSync returns true for existing directory", () => {
    expect(fsWrapper.existsSync(TMP_DIR)).toBe(true);
  });

  it("existsSync returns false for non-existent path", () => {
    expect(fsWrapper.existsSync("/no/such/path/ever")).toBe(false);
  });

  it("statSync returns Stats with isDirectory() for a directory", () => {
    const stat = fsWrapper.statSync(TMP_DIR);
    expect(stat.isDirectory()).toBe(true);
  });

  it("accessSync does not throw for a readable directory", () => {
    expect(() =>
      fsWrapper.accessSync(TMP_DIR, fs.constants.R_OK),
    ).not.toThrow();
  });
});
