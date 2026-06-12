/**
 * Tests for the file-size-validator module.
 */

import { validateFileSize } from "../../src/modules/file-size-validator.js";
import {
  mkdirSync,
  rmSync,
  existsSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import type { FileSizeValidationResult } from "../../src/types/index.js";

// ---------------------------------------------------------------------------
// Fixture root & constants
// ---------------------------------------------------------------------------

const FIXTURE_ROOT = join(__dirname, "..", "fixtures", "file-size");
const MAX_FILE_SIZE = 51200; // 50 KB

const FIXTURES = {
  ZERO_BYTE: join(FIXTURE_ROOT, "zero-byte.txt"),
  BELOW_MAX: join(FIXTURE_ROOT, "below-max.txt"),
  EXACTLY_MAX: join(FIXTURE_ROOT, "exactly-max.txt"),
  ABOVE_MAX: join(FIXTURE_ROOT, "above-max.txt"),
  NON_EXISTENT: join(FIXTURE_ROOT, "does-not-exist.txt"),
} as const;

// ---------------------------------------------------------------------------
// Fixture creation
// ---------------------------------------------------------------------------

function createFixtures(): void {
  mkdirSync(FIXTURE_ROOT, { recursive: true });

  // 0-byte file
  writeFileSync(FIXTURES.ZERO_BYTE, Buffer.alloc(0));

  // 100-byte file (well below 51200)
  writeFileSync(FIXTURES.BELOW_MAX, Buffer.alloc(100));

  // Exactly 51200 bytes — at the boundary
  writeFileSync(FIXTURES.EXACTLY_MAX, Buffer.alloc(MAX_FILE_SIZE));

  // 51201 bytes — one byte over the limit
  writeFileSync(FIXTURES.ABOVE_MAX, Buffer.alloc(MAX_FILE_SIZE + 1));
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
// Test 1: File below max → passed: true
// ---------------------------------------------------------------------------
describe("validateFileSize — file below max", () => {
  it("returns passed=true for a file smaller than maxFileSize", () => {
    const result = validateFileSize(FIXTURES.BELOW_MAX, MAX_FILE_SIZE);

    expect(result.passed).toBe(true);
    expect(result.actual_size).toBe(100);
    expect(result.max_size).toBe(MAX_FILE_SIZE);
  });
});

// ---------------------------------------------------------------------------
// Test 2: File at exactly max → passed: false (oversized)
// ---------------------------------------------------------------------------
describe("validateFileSize — file at exactly max", () => {
  it("returns passed=false for a file whose size equals maxFileSize", () => {
    const result = validateFileSize(FIXTURES.EXACTLY_MAX, MAX_FILE_SIZE);

    expect(result.passed).toBe(false);
    expect(result.actual_size).toBe(MAX_FILE_SIZE);
    expect(result.max_size).toBe(MAX_FILE_SIZE);
  });
});

// ---------------------------------------------------------------------------
// Test 3: File above max → passed: false
// ---------------------------------------------------------------------------
describe("validateFileSize — file above max", () => {
  it("returns passed=false for a file larger than maxFileSize", () => {
    const result = validateFileSize(FIXTURES.ABOVE_MAX, MAX_FILE_SIZE);

    expect(result.passed).toBe(false);
    expect(result.actual_size).toBe(MAX_FILE_SIZE + 1);
    expect(result.max_size).toBe(MAX_FILE_SIZE);
  });
});

// ---------------------------------------------------------------------------
// Test 4: Zero-byte file → passed: true
// ---------------------------------------------------------------------------
describe("validateFileSize — zero-byte file", () => {
  it("returns passed=true for an empty (0-byte) file", () => {
    const result = validateFileSize(FIXTURES.ZERO_BYTE, MAX_FILE_SIZE);

    expect(result.passed).toBe(true);
    expect(result.actual_size).toBe(0);
    expect(result.max_size).toBe(MAX_FILE_SIZE);
  });
});

// ---------------------------------------------------------------------------
// Test 5: Non-existent file → throws Error
// ---------------------------------------------------------------------------
describe("validateFileSize — non-existent file", () => {
  it("throws an Error when the file does not exist", () => {
    expect(() => {
      validateFileSize(FIXTURES.NON_EXISTENT, MAX_FILE_SIZE);
    }).toThrow();
  });

  it("throws an error with ENOENT code", () => {
    try {
      validateFileSize(FIXTURES.NON_EXISTENT, MAX_FILE_SIZE);
      fail("Expected an error to be thrown");
    } catch (err: unknown) {
      expect(err).toBeDefined();
      const error = err as NodeJS.ErrnoException;
      expect(error.code).toBe("ENOENT");
    }
  });
});

// ---------------------------------------------------------------------------
// Test 6: Return shape matches FileSizeValidationResult interface
// ---------------------------------------------------------------------------
describe("validateFileSize — return shape", () => {
  it("returns an object with passed, actual_size, and max_size", () => {
    const result: FileSizeValidationResult = validateFileSize(
      FIXTURES.BELOW_MAX,
      MAX_FILE_SIZE,
    );

    expect(result).toHaveProperty("passed");
    expect(result).toHaveProperty("actual_size");
    expect(result).toHaveProperty("max_size");
    expect(typeof result.passed).toBe("boolean");
    expect(typeof result.actual_size).toBe("number");
    expect(typeof result.max_size).toBe("number");
  });
});
