/**
 * Tests for the file-encoding-validator module.
 */

import { validateEncoding } from "../../src/modules/file-encoding-validator.js";
import {
  mkdirSync,
  rmSync,
  existsSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import type { EncodingValidationResult } from "../../src/types/index.js";

// ---------------------------------------------------------------------------
// Fixture root & constants
// ---------------------------------------------------------------------------

const FIXTURE_ROOT = join(__dirname, "..", "fixtures", "file-encoding");

const FIXTURES = {
  VALID_UTF8: join(FIXTURE_ROOT, "valid-utf8.txt"),
  INVALID_UTF8: join(FIXTURE_ROOT, "invalid-utf8.bin"),
  ASCII_ONLY: join(FIXTURE_ROOT, "ascii-only.txt"),
  UTF8_BOM: join(FIXTURE_ROOT, "utf8-bom.txt"),
  NON_EXISTENT: join(FIXTURE_ROOT, "does-not-exist.txt"),
  OVERLONG: join(FIXTURE_ROOT, "overlong.bin"),
  TRUNCATED: join(FIXTURE_ROOT, "truncated.bin"),
  MIXED_INVALID: join(FIXTURE_ROOT, "mixed-invalid.bin"),
  // Two-byte sequence with bad continuation
  TWO_BYTE_BAD_CONT: join(FIXTURE_ROOT, "two-byte-bad-cont.bin"),
  // Valid 3-byte via 0xE0 (U+0800 = E0 A0 80)
  VALID_E0: join(FIXTURE_ROOT, "valid-e0.bin"),
  // Invalid 0xE0 with second byte below 0xA0 (overlong)
  INVALID_E0_OVERLONG: join(FIXTURE_ROOT, "invalid-e0-overlong.bin"),
  // 0xE0 truncated (only 1 byte available)
  TRUNCATED_E0: join(FIXTURE_ROOT, "truncated-e0.bin"),
  // Valid 3-byte via 0xED (U+D7FF = ED 9F BF)
  VALID_ED: join(FIXTURE_ROOT, "valid-ed.bin"),
  // Invalid 0xED with second byte above 0x9F (surrogate)
  INVALID_ED_SURROGATE: join(FIXTURE_ROOT, "invalid-ed-surrogate.bin"),
  // 0xED truncated
  TRUNCATED_ED: join(FIXTURE_ROOT, "truncated-ed.bin"),
  // Normal 3-byte (0xE1–0xEF non-special) truncated
  TRUNCATED_E1: join(FIXTURE_ROOT, "truncated-e1.bin"),
  // Normal 3-byte with bad continuation at 3rd byte
  E1_BAD_THIRD: join(FIXTURE_ROOT, "e1-bad-third.bin"),
  // Valid 4-byte via 0xF0 (U+10000 = F0 90 80 80)
  VALID_F0: join(FIXTURE_ROOT, "valid-f0.bin"),
  // Invalid 0xF0 with second byte below 0x90 (overlong)
  INVALID_F0_OVERLONG: join(FIXTURE_ROOT, "invalid-f0-overlong.bin"),
  // 0xF0 truncated (only 1 byte)
  TRUNCATED_F0: join(FIXTURE_ROOT, "truncated-f0.bin"),
  // Valid 4-byte via 0xF4 (U+10FFFF = F4 8F BF BF)
  VALID_F4: join(FIXTURE_ROOT, "valid-f4.bin"),
  // Invalid 0xF4 with second byte above 0x8F (beyond U+10FFFF)
  INVALID_F4_ABOVE: join(FIXTURE_ROOT, "invalid-f4-above.bin"),
  // 0xF4 truncated
  TRUNCATED_F4: join(FIXTURE_ROOT, "truncated-f4.bin"),
  // Normal 4-byte (0xF1) truncated
  TRUNCATED_F1: join(FIXTURE_ROOT, "truncated-f1.bin"),
  // Normal 4-byte (0xF1) with bad continuation at 3rd byte
  F1_BAD_THIRD: join(FIXTURE_ROOT, "f1-bad-third.bin"),
  // 0xFE invalid byte
  FE_INVALID: join(FIXTURE_ROOT, "fe-invalid.bin"),
  // 0xFF invalid byte
  FF_INVALID: join(FIXTURE_ROOT, "ff-invalid.bin"),
  // 0xF5 invalid leading byte
  F5_INVALID: join(FIXTURE_ROOT, "f5-invalid.bin"),
  // Valid 2-byte sequence (U+00E9 = C3 A9, é)
  VALID_TWO_BYTE: join(FIXTURE_ROOT, "valid-two-byte.bin"),
  // Empty file
  EMPTY: join(FIXTURE_ROOT, "empty.bin"),
  // Mix of valid multi-byte + invalid byte to exercise scanner valid paths
  // valid 2-byte (C3 A9) + valid 3-byte (E1 80 80) + valid 4-byte (F1 80 80 80) + 0xFF invalid
  MIXED_VALID_PLUS_INVALID: join(FIXTURE_ROOT, "mixed-valid-plus-invalid.bin"),
} as const;

// ---------------------------------------------------------------------------
// Fixture creation
// ---------------------------------------------------------------------------

function createFixtures(): void {
  mkdirSync(FIXTURE_ROOT, { recursive: true });

  // 1. Valid UTF-8 file — contains multi-byte characters
  writeFileSync(FIXTURES.VALID_UTF8, "Hello, 世界! 🌍");

  // 2. Invalid UTF-8 — bare continuation byte 0x80 without leading byte
  writeFileSync(
    FIXTURES.INVALID_UTF8,
    Buffer.from([0x48, 0x65, 0x80, 0x6c, 0x6c, 0x6f]),
  );

  // 3. ASCII-only file
  writeFileSync(FIXTURES.ASCII_ONLY, "Hello, world!");

  // 4. UTF-8 with BOM (0xEF 0xBB 0xBF) followed by ASCII text
  writeFileSync(
    FIXTURES.UTF8_BOM,
    Buffer.from([0xef, 0xbb, 0xbf, 0x48, 0x69]),
  );

  // 5. Overlong encoding — 0xC0 0xAF
  writeFileSync(
    FIXTURES.OVERLONG,
    Buffer.from([0x48, 0xc0, 0xaf, 0x49]),
  );

  // 6. Truncated 2-byte — 0xC2 at end without continuation
  writeFileSync(
    FIXTURES.TRUNCATED,
    Buffer.from([0x48, 0xc2]),
  );

  // 7. Mixed invalid: 0xFF + 0xC0 + 0x80
  writeFileSync(
    FIXTURES.MIXED_INVALID,
    Buffer.from([0xff, 0xc0, 0x80]),
  );

  // 8. 2-byte sequence with bad continuation (0xC2 0x20)
  writeFileSync(
    FIXTURES.TWO_BYTE_BAD_CONT,
    Buffer.from([0xc2, 0x20]),
  );

  // 9. Valid 3-byte via 0xE0: U+0800 = E0 A0 80
  writeFileSync(
    FIXTURES.VALID_E0,
    Buffer.from([0xe0, 0xa0, 0x80]),
  );

  // 10. Invalid 0xE0 overlong: second byte 0x90 < 0xA0
  writeFileSync(
    FIXTURES.INVALID_E0_OVERLONG,
    Buffer.from([0xe0, 0x90, 0x80]),
  );

  // 11. 0xE0 truncated (only leading byte, no continuation)
  writeFileSync(
    FIXTURES.TRUNCATED_E0,
    Buffer.from([0xe0]),
  );

  // 12. Valid 3-byte via 0xED: U+D7FF = ED 9F BF
  writeFileSync(
    FIXTURES.VALID_ED,
    Buffer.from([0xed, 0x9f, 0xbf]),
  );

  // 13. Invalid 0xED surrogate: second byte 0xA0 > 0x9F
  writeFileSync(
    FIXTURES.INVALID_ED_SURROGATE,
    Buffer.from([0xed, 0xa0, 0x80]),
  );

  // 14. 0xED truncated
  writeFileSync(
    FIXTURES.TRUNCATED_ED,
    Buffer.from([0xed]),
  );

  // 15. Normal 3-byte (0xE1) truncated
  writeFileSync(
    FIXTURES.TRUNCATED_E1,
    Buffer.from([0xe1]),
  );

  // 16. Normal 3-byte (0xE1) with bad 3rd byte
  writeFileSync(
    FIXTURES.E1_BAD_THIRD,
    Buffer.from([0xe1, 0x80, 0x20]),
  );

  // 17. Valid 4-byte via 0xF0: U+10000 = F0 90 80 80
  writeFileSync(
    FIXTURES.VALID_F0,
    Buffer.from([0xf0, 0x90, 0x80, 0x80]),
  );

  // 18. Invalid 0xF0 overlong: second byte 0x80 < 0x90
  writeFileSync(
    FIXTURES.INVALID_F0_OVERLONG,
    Buffer.from([0xf0, 0x80, 0x80, 0x80]),
  );

  // 19. 0xF0 truncated
  writeFileSync(
    FIXTURES.TRUNCATED_F0,
    Buffer.from([0xf0]),
  );

  // 20. Valid 4-byte via 0xF4: U+10FFFF = F4 8F BF BF
  writeFileSync(
    FIXTURES.VALID_F4,
    Buffer.from([0xf4, 0x8f, 0xbf, 0xbf]),
  );

  // 21. Invalid 0xF4 above max: second byte 0x90 > 0x8F
  writeFileSync(
    FIXTURES.INVALID_F4_ABOVE,
    Buffer.from([0xf4, 0x90, 0x80, 0x80]),
  );

  // 22. 0xF4 truncated
  writeFileSync(
    FIXTURES.TRUNCATED_F4,
    Buffer.from([0xf4]),
  );

  // 23. Normal 4-byte (0xF1) truncated
  writeFileSync(
    FIXTURES.TRUNCATED_F1,
    Buffer.from([0xf1]),
  );

  // 24. Normal 4-byte (0xF1) with bad 3rd byte
  writeFileSync(
    FIXTURES.F1_BAD_THIRD,
    Buffer.from([0xf1, 0x80, 0x20, 0x80]),
  );

  // 25. 0xFE invalid byte
  writeFileSync(
    FIXTURES.FE_INVALID,
    Buffer.from([0xfe, 0x48]),
  );

  // 26. 0xFF invalid byte
  writeFileSync(
    FIXTURES.FF_INVALID,
    Buffer.from([0xff, 0x48]),
  );

  // 27. 0xF5 invalid leading byte
  writeFileSync(
    FIXTURES.F5_INVALID,
    Buffer.from([0xf5]),
  );

  // 28. Valid 2-byte: U+00E9 (é) = C3 A9
  writeFileSync(
    FIXTURES.VALID_TWO_BYTE,
    Buffer.from([0xc3, 0xa9]),
  );

  // 29. Empty file
  writeFileSync(FIXTURES.EMPTY, Buffer.alloc(0));

  // 30. Mix of valid multi-byte sequences + invalid byte at end to trigger scanner
  // C3 A9 (valid 2-byte) + E1 80 80 (valid 3-byte) + F1 80 80 80 (valid 4-byte) + FF (invalid)
  writeFileSync(
    FIXTURES.MIXED_VALID_PLUS_INVALID,
    Buffer.from([0xc3, 0xa9, 0xe1, 0x80, 0x80, 0xf1, 0x80, 0x80, 0x80, 0xff]),
  );
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
// Test 1: Valid UTF-8 file → passed: true
// ---------------------------------------------------------------------------
describe("validateEncoding — valid UTF-8 file", () => {
  it("returns passed=true and detectedEncoding='utf-8'", () => {
    const result = validateEncoding(FIXTURES.VALID_UTF8, "utf-8");

    expect(result.passed).toBe(true);
    expect(result.detectedEncoding).toBe("utf-8");
    expect(result.expectedEncoding).toBe("utf-8");
    expect(result.illegalBytes).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Test 2: Invalid UTF-8 (bare continuation byte 0x80)
// ---------------------------------------------------------------------------
describe("validateEncoding — invalid UTF-8 file", () => {
  it("returns passed=false with populated illegalBytes", () => {
    const result = validateEncoding(FIXTURES.INVALID_UTF8, "utf-8");

    expect(result.passed).toBe(false);
    expect(result.detectedEncoding).toBe("unknown");
    expect(result.illegalBytes.length).toBeGreaterThan(0);
  });

  it("reports the bare continuation byte at offset 2", () => {
    const result = validateEncoding(FIXTURES.INVALID_UTF8, "utf-8");

    const bare = result.illegalBytes.find(
      (b) => b.offset === 2 && b.byteValue === 0x80,
    );
    expect(bare).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Test 3: ASCII-only file → valid UTF-8
// ---------------------------------------------------------------------------
describe("validateEncoding — ASCII-only file", () => {
  it("returns passed=true (ASCII is valid UTF-8)", () => {
    const result = validateEncoding(FIXTURES.ASCII_ONLY, "utf-8");

    expect(result.passed).toBe(true);
    expect(result.detectedEncoding).toBe("utf-8");
    expect(result.illegalBytes).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Test 4: UTF-8 BOM → passes
// ---------------------------------------------------------------------------
describe("validateEncoding — UTF-8 BOM", () => {
  it("returns passed=true for BOM-prefixed file", () => {
    const result = validateEncoding(FIXTURES.UTF8_BOM, "utf-8");

    expect(result.passed).toBe(true);
    expect(result.detectedEncoding).toBe("utf-8");
    expect(result.illegalBytes).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Test 5: Non-existent file → error result
// ---------------------------------------------------------------------------
describe("validateEncoding — non-existent file", () => {
  it("returns passed=false with detectedEncoding='unknown'", () => {
    const result = validateEncoding(FIXTURES.NON_EXISTENT, "utf-8");

    expect(result.passed).toBe(false);
    expect(result.detectedEncoding).toBe("unknown");
    expect(result.expectedEncoding).toBe("utf-8");
    expect(result.illegalBytes).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Test 6: expectedEncoding match / mismatch
// ---------------------------------------------------------------------------
describe("validateEncoding — encoding match", () => {
  it("returns passed=true when expected matches detected", () => {
    const result = validateEncoding(FIXTURES.VALID_UTF8, "utf-8");

    expect(result.passed).toBe(true);
    expect(result.detectedEncoding).toBe("utf-8");
  });

  it("returns passed=false when expected does not match detected", () => {
    const result = validateEncoding(FIXTURES.VALID_UTF8, "latin-1");

    expect(result.passed).toBe(false);
    expect(result.detectedEncoding).toBe("utf-8");
    expect(result.expectedEncoding).toBe("latin-1");
  });
});

// ---------------------------------------------------------------------------
// Test 7: Overlong encoding (0xC0)
// ---------------------------------------------------------------------------
describe("validateEncoding — overlong encoding", () => {
  it("flags 0xC0 as illegal", () => {
    const result = validateEncoding(FIXTURES.OVERLONG, "utf-8");

    expect(result.passed).toBe(false);
    const overlong = result.illegalBytes.find(
      (b) => b.offset === 1 && b.byteValue === 0xc0,
    );
    expect(overlong).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Test 8: Truncated 2-byte sequence
// ---------------------------------------------------------------------------
describe("validateEncoding — truncated 2-byte sequence", () => {
  it("flags 0xC2 without continuation", () => {
    const result = validateEncoding(FIXTURES.TRUNCATED, "utf-8");

    expect(result.passed).toBe(false);
    const truncated = result.illegalBytes.find(
      (b) => b.offset === 1 && b.byteValue === 0xc2,
    );
    expect(truncated).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Test 9: Mixed invalid bytes
// ---------------------------------------------------------------------------
describe("validateEncoding — mixed invalid bytes", () => {
  it("flags 0xFF, 0xC0, and 0x80", () => {
    const result = validateEncoding(FIXTURES.MIXED_INVALID, "utf-8");

    expect(result.passed).toBe(false);
    expect(result.illegalBytes.length).toBeGreaterThanOrEqual(3);
    const offsets = result.illegalBytes.map((b) => b.offset);
    expect(offsets).toContain(0);
    expect(offsets).toContain(1);
    expect(offsets).toContain(2);
  });
});

// ---------------------------------------------------------------------------
// Test 10: Return shape
// ---------------------------------------------------------------------------
describe("validateEncoding — return shape", () => {
  it("has all EncodingValidationResult fields", () => {
    const result: EncodingValidationResult = validateEncoding(
      FIXTURES.VALID_UTF8,
      "utf-8",
    );

    expect(result).toHaveProperty("passed");
    expect(result).toHaveProperty("detectedEncoding");
    expect(result).toHaveProperty("expectedEncoding");
    expect(result).toHaveProperty("illegalBytes");
    expect(typeof result.passed).toBe("boolean");
    expect(typeof result.detectedEncoding).toBe("string");
    expect(typeof result.expectedEncoding).toBe("string");
    expect(Array.isArray(result.illegalBytes)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Test 11: Valid 2-byte sequence
// ---------------------------------------------------------------------------
describe("validateEncoding — valid 2-byte sequence", () => {
  it("returns passed=true for valid 2-byte (C3 A9 = é)", () => {
    const result = validateEncoding(FIXTURES.VALID_TWO_BYTE, "utf-8");

    expect(result.passed).toBe(true);
    expect(result.illegalBytes).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Test 12: 2-byte with bad continuation
// ---------------------------------------------------------------------------
describe("validateEncoding — 2-byte with bad continuation", () => {
  it("flags 0xC2 followed by non-continuation byte 0x20", () => {
    const result = validateEncoding(FIXTURES.TWO_BYTE_BAD_CONT, "utf-8");

    expect(result.passed).toBe(false);
    const bad = result.illegalBytes.find(
      (b) => b.offset === 0 && b.byteValue === 0xc2,
    );
    expect(bad).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Test 13: Valid 3-byte via 0xE0
// ---------------------------------------------------------------------------
describe("validateEncoding — valid E0 sequence", () => {
  it("returns passed=true for valid E0 A0 80", () => {
    const result = validateEncoding(FIXTURES.VALID_E0, "utf-8");

    expect(result.passed).toBe(true);
    expect(result.illegalBytes).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Test 14: Invalid E0 overlong (second byte < 0xA0)
// ---------------------------------------------------------------------------
describe("validateEncoding — invalid E0 overlong", () => {
  it("flags E0 with second byte 0x90 (below 0xA0)", () => {
    const result = validateEncoding(FIXTURES.INVALID_E0_OVERLONG, "utf-8");

    expect(result.passed).toBe(false);
    const bad = result.illegalBytes.find(
      (b) => b.offset === 0 && b.byteValue === 0xe0,
    );
    expect(bad).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Test 15: E0 truncated
// ---------------------------------------------------------------------------
describe("validateEncoding — E0 truncated", () => {
  it("flags lone E0 without continuation", () => {
    const result = validateEncoding(FIXTURES.TRUNCATED_E0, "utf-8");

    expect(result.passed).toBe(false);
    const bad = result.illegalBytes.find(
      (b) => b.offset === 0 && b.byteValue === 0xe0,
    );
    expect(bad).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Test 16: Valid ED sequence
// ---------------------------------------------------------------------------
describe("validateEncoding — valid ED sequence", () => {
  it("returns passed=true for valid ED 9F BF (U+D7FF)", () => {
    const result = validateEncoding(FIXTURES.VALID_ED, "utf-8");

    expect(result.passed).toBe(true);
    expect(result.illegalBytes).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Test 17: Invalid ED surrogate (second byte > 0x9F)
// ---------------------------------------------------------------------------
describe("validateEncoding — invalid ED surrogate", () => {
  it("flags ED with second byte 0xA0 (above 0x9F)", () => {
    const result = validateEncoding(FIXTURES.INVALID_ED_SURROGATE, "utf-8");

    expect(result.passed).toBe(false);
    const bad = result.illegalBytes.find(
      (b) => b.offset === 0 && b.byteValue === 0xed,
    );
    expect(bad).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Test 18: ED truncated
// ---------------------------------------------------------------------------
describe("validateEncoding — ED truncated", () => {
  it("flags lone ED without continuation", () => {
    const result = validateEncoding(FIXTURES.TRUNCATED_ED, "utf-8");

    expect(result.passed).toBe(false);
    const bad = result.illegalBytes.find(
      (b) => b.offset === 0 && b.byteValue === 0xed,
    );
    expect(bad).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Test 19: Normal 3-byte (E1) truncated
// ---------------------------------------------------------------------------
describe("validateEncoding — E1 truncated", () => {
  it("flags lone E1 without continuation", () => {
    const result = validateEncoding(FIXTURES.TRUNCATED_E1, "utf-8");

    expect(result.passed).toBe(false);
    const bad = result.illegalBytes.find(
      (b) => b.offset === 0 && b.byteValue === 0xe1,
    );
    expect(bad).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Test 20: E1 with bad 3rd byte
// ---------------------------------------------------------------------------
describe("validateEncoding — E1 bad third byte", () => {
  it("flags E1 80 20 (third byte is not continuation)", () => {
    const result = validateEncoding(FIXTURES.E1_BAD_THIRD, "utf-8");

    expect(result.passed).toBe(false);
    const bad = result.illegalBytes.find(
      (b) => b.offset === 0 && b.byteValue === 0xe1,
    );
    expect(bad).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Test 21: Valid 4-byte via F0
// ---------------------------------------------------------------------------
describe("validateEncoding — valid F0 sequence", () => {
  it("returns passed=true for F0 90 80 80 (U+10000)", () => {
    const result = validateEncoding(FIXTURES.VALID_F0, "utf-8");

    expect(result.passed).toBe(true);
    expect(result.illegalBytes).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Test 22: Invalid F0 overlong
// ---------------------------------------------------------------------------
describe("validateEncoding — invalid F0 overlong", () => {
  it("flags F0 with second byte 0x80 (below 0x90)", () => {
    const result = validateEncoding(FIXTURES.INVALID_F0_OVERLONG, "utf-8");

    expect(result.passed).toBe(false);
    const bad = result.illegalBytes.find(
      (b) => b.offset === 0 && b.byteValue === 0xf0,
    );
    expect(bad).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Test 23: F0 truncated
// ---------------------------------------------------------------------------
describe("validateEncoding — F0 truncated", () => {
  it("flags lone F0 without continuation", () => {
    const result = validateEncoding(FIXTURES.TRUNCATED_F0, "utf-8");

    expect(result.passed).toBe(false);
    const bad = result.illegalBytes.find(
      (b) => b.offset === 0 && b.byteValue === 0xf0,
    );
    expect(bad).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Test 24: Valid F4 sequence
// ---------------------------------------------------------------------------
describe("validateEncoding — valid F4 sequence", () => {
  it("returns passed=true for F4 8F BF BF (U+10FFFF)", () => {
    const result = validateEncoding(FIXTURES.VALID_F4, "utf-8");

    expect(result.passed).toBe(true);
    expect(result.illegalBytes).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Test 25: Invalid F4 above max
// ---------------------------------------------------------------------------
describe("validateEncoding — invalid F4 above max", () => {
  it("flags F4 with second byte 0x90 (above 0x8F)", () => {
    const result = validateEncoding(FIXTURES.INVALID_F4_ABOVE, "utf-8");

    expect(result.passed).toBe(false);
    const bad = result.illegalBytes.find(
      (b) => b.offset === 0 && b.byteValue === 0xf4,
    );
    expect(bad).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Test 26: F4 truncated
// ---------------------------------------------------------------------------
describe("validateEncoding — F4 truncated", () => {
  it("flags lone F4 without continuation", () => {
    const result = validateEncoding(FIXTURES.TRUNCATED_F4, "utf-8");

    expect(result.passed).toBe(false);
    const bad = result.illegalBytes.find(
      (b) => b.offset === 0 && b.byteValue === 0xf4,
    );
    expect(bad).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Test 27: Normal 4-byte (F1) truncated
// ---------------------------------------------------------------------------
describe("validateEncoding — F1 truncated", () => {
  it("flags lone F1 without continuation", () => {
    const result = validateEncoding(FIXTURES.TRUNCATED_F1, "utf-8");

    expect(result.passed).toBe(false);
    const bad = result.illegalBytes.find(
      (b) => b.offset === 0 && b.byteValue === 0xf1,
    );
    expect(bad).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Test 28: F1 with bad 3rd byte
// ---------------------------------------------------------------------------
describe("validateEncoding — F1 bad third byte", () => {
  it("flags F1 80 20 80 (third byte not continuation)", () => {
    const result = validateEncoding(FIXTURES.F1_BAD_THIRD, "utf-8");

    expect(result.passed).toBe(false);
    const bad = result.illegalBytes.find(
      (b) => b.offset === 0 && b.byteValue === 0xf1,
    );
    expect(bad).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Test 29: 0xFE invalid
// ---------------------------------------------------------------------------
describe("validateEncoding — 0xFE invalid", () => {
  it("flags 0xFE as illegal", () => {
    const result = validateEncoding(FIXTURES.FE_INVALID, "utf-8");

    expect(result.passed).toBe(false);
    const bad = result.illegalBytes.find(
      (b) => b.offset === 0 && b.byteValue === 0xfe,
    );
    expect(bad).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Test 30: 0xFF invalid
// ---------------------------------------------------------------------------
describe("validateEncoding — 0xFF invalid", () => {
  it("flags 0xFF as illegal", () => {
    const result = validateEncoding(FIXTURES.FF_INVALID, "utf-8");

    expect(result.passed).toBe(false);
    const bad = result.illegalBytes.find(
      (b) => b.offset === 0 && b.byteValue === 0xff,
    );
    expect(bad).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Test 31: 0xF5 invalid leading byte
// ---------------------------------------------------------------------------
describe("validateEncoding — 0xF5 invalid leading byte", () => {
  it("flags 0xF5 as illegal", () => {
    const result = validateEncoding(FIXTURES.F5_INVALID, "utf-8");

    expect(result.passed).toBe(false);
    const bad = result.illegalBytes.find(
      (b) => b.offset === 0 && b.byteValue === 0xf5,
    );
    expect(bad).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Test 32: Empty file → valid UTF-8
// ---------------------------------------------------------------------------
describe("validateEncoding — empty file", () => {
  it("returns passed=true for an empty file", () => {
    const result = validateEncoding(FIXTURES.EMPTY, "utf-8");

    expect(result.passed).toBe(true);
    expect(result.detectedEncoding).toBe("utf-8");
    expect(result.illegalBytes).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Test 33: Valid multi-byte sequences + invalid byte → scanner covers valid paths
// ---------------------------------------------------------------------------
describe("validateEncoding — valid multi-byte + invalid triggers scanner", () => {
  it("flags the trailing 0xFF while recognizing valid 2/3/4-byte sequences", () => {
    const result = validateEncoding(FIXTURES.MIXED_VALID_PLUS_INVALID, "utf-8");

    expect(result.passed).toBe(false);
    expect(result.illegalBytes.length).toBe(1);
    expect(result.illegalBytes[0].offset).toBe(9);
    expect(result.illegalBytes[0].byteValue).toBe(0xff);
  });
});
