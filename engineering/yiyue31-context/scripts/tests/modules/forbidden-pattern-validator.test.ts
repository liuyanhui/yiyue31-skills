/**
 * Tests for the forbidden-pattern-validator module.
 */

import { validateForbiddenPatterns } from "../../src/modules/forbidden-pattern-validator.js";

// ---------------------------------------------------------------------------
// Test 1: No forbidden patterns → empty result
// ---------------------------------------------------------------------------
describe("validateForbiddenPatterns — no forbidden patterns", () => {
  it("returns empty array when forbidden_patterns is empty", () => {
    const result = validateForbiddenPatterns("test.txt", "some content", []);
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Test 2: One match → entry with context
// ---------------------------------------------------------------------------
describe("validateForbiddenPatterns — single match with context", () => {
  it("returns one entry with context around the match", () => {
    // 80 chars before + match "SECRET" (6) + 80 chars after = 166 total context
    const before = "A".repeat(80);
    const after = "B".repeat(80);
    const content = before + "SECRET" + after;

    const result = validateForbiddenPatterns("test.txt", content, ["SECRET"]);

    expect(result).toHaveLength(1);
    expect(result[0].file).toBe("test.txt");
    expect(result[0].matches).toHaveLength(1);

    const match = result[0].matches[0];
    expect(match.pattern).toBe("SECRET");

    // context = min(50, 80) before + "SECRET" + min(50, 80) after = 50+6+50 = 106
    expect(match.context).toHaveLength(50 + 6 + 50);
    expect(match.context.startsWith("A".repeat(50))).toBe(true);
    expect(match.context.endsWith("B".repeat(50))).toBe(true);
    expect(match.context).toContain("SECRET");
  });
});

// ---------------------------------------------------------------------------
// Test 3: Multiple matches for same pattern → multiple ForbiddenMatch entries
// ---------------------------------------------------------------------------
describe("validateForbiddenPatterns — multiple matches for same pattern", () => {
  it("returns one ForbiddenMatch per occurrence", () => {
    const content = "foo is here and foo is also there and foo again";
    const result = validateForbiddenPatterns("test.txt", content, ["foo"]);

    expect(result).toHaveLength(1);
    expect(result[0].matches).toHaveLength(3);

    for (const m of result[0].matches) {
      expect(m.pattern).toBe("foo");
      expect(m.context).toContain("foo");
    }
  });
});

// ---------------------------------------------------------------------------
// Test 4: Match near file start → context before shorter than 50 chars
// ---------------------------------------------------------------------------
describe("validateForbiddenPatterns — match near file start", () => {
  it("has less than 50 chars of context before the match", () => {
    // "SECRET" starts at index 5, so before context = min(50, 5) = 5 chars
    const content = "ABCDESECRET_rest_of_file";
    const result = validateForbiddenPatterns("test.txt", content, ["SECRET"]);

    expect(result[0].matches).toHaveLength(1);
    const match = result[0].matches[0];

    // before = "ABCDE" (5 chars), match = "SECRET" (6), after = "_rest_of_file" (13)
    // total context = 5 + 6 + 13 = 24
    expect(match.context).toBe("ABCDESECRET_rest_of_file");

    // Verify before portion is exactly 5 chars
    const secretIndex = match.context.indexOf("SECRET");
    expect(secretIndex).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// Test 5: Match near file end → context after shorter than 50 chars
// ---------------------------------------------------------------------------
describe("validateForbiddenPatterns — match near file end", () => {
  it("has less than 50 chars of context after the match", () => {
    const before = "X".repeat(60);
    const tail = "TAIL";
    const content = before + "END" + tail;
    // "END" starts at index 60, after = "TAIL" (4 chars) < 50

    const result = validateForbiddenPatterns("test.txt", content, ["END"]);

    expect(result[0].matches).toHaveLength(1);
    const match = result[0].matches[0];

    // before = min(50, 60) = 50 chars, match = "END" (3), after = 4 chars
    // total = 50 + 3 + 4 = 57
    expect(match.context).toHaveLength(50 + 3 + 4);
    expect(match.context.endsWith("ENDTAIL")).toBe(true);
    expect(match.context.startsWith("X".repeat(50))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Test 6: Empty forbidden_patterns → []  (same as test 1, explicit)
// ---------------------------------------------------------------------------
describe("validateForbiddenPatterns — explicitly empty patterns", () => {
  it("returns empty array regardless of content", () => {
    const result = validateForbiddenPatterns(
      "test.txt",
      "SECRET SECRET SECRET",
      [],
    );
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Test 7: Multi-byte UTF-8 characters in context are not truncated
// ---------------------------------------------------------------------------
describe("validateForbiddenPatterns — multi-byte UTF-8 context", () => {
  it("preserves multi-byte characters at context boundaries", () => {
    // Use CJK characters (3 bytes each in UTF-8, 1 char in JS)
    const cjkBefore = "你好世界"; // "你好世界" (4 chars)
    const cjkAfter = "再见再见"; // "再见再见" (4 chars)
    const content = cjkBefore + "TARGET" + cjkAfter;

    const result = validateForbiddenPatterns("test.txt", content, ["TARGET"]);

    expect(result[0].matches).toHaveLength(1);
    const match = result[0].matches[0];

    // before = all 4 CJK chars (4 < 50), match = "TARGET", after = all 4 CJK chars
    expect(match.context).toBe(
      "你好世界" + "TARGET" + "再见再见",
    );

    // Verify characters are whole (not garbled)
    const targetIdx = match.context.indexOf("TARGET");
    const beforePart = match.context.slice(0, targetIdx);
    const afterPart = match.context.slice(targetIdx + "TARGET".length);
    expect(beforePart).toHaveLength(4);
    expect(afterPart).toHaveLength(4);
  });

  it("handles emoji characters in context boundaries correctly", () => {
    const emojis = "😀😁😂"; // 3 emoji chars
    const content = emojis + "FORBIDDEN" + emojis;

    const result = validateForbiddenPatterns(
      "emoji.txt",
      content,
      ["FORBIDDEN"],
    );

    expect(result[0].matches).toHaveLength(1);
    const match = result[0].matches[0];
    expect(match.context).toBe(emojis + "FORBIDDEN" + emojis);
  });
});

// ---------------------------------------------------------------------------
// Test 8: No matches found → empty result
// ---------------------------------------------------------------------------
describe("validateForbiddenPatterns — pattern not found", () => {
  it("returns empty array when no forbidden pattern matches", () => {
    const result = validateForbiddenPatterns(
      "test.txt",
      "Hello World",
      ["NOT_HERE", "ALSO_MISSING"],
    );
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Test 9: Invalid regex → throws error
// ---------------------------------------------------------------------------
describe("validateForbiddenPatterns — invalid regex pattern", () => {
  it("throws an error for an invalid regex", () => {
    expect(() => {
      validateForbiddenPatterns("test.txt", "content", ["[invalid"]);
    }).toThrow(/Invalid regex pattern/);
  });
});

// ---------------------------------------------------------------------------
// Test 10: Multiple different patterns each matching
// ---------------------------------------------------------------------------
describe("validateForbiddenPatterns — multiple different patterns", () => {
  it("collects matches from all patterns", () => {
    const content = "alpha appears here and beta appears there";
    const result = validateForbiddenPatterns("test.txt", content, [
      "alpha",
      "beta",
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].matches).toHaveLength(2);

    const patterns = result[0].matches.map((m) => m.pattern);
    expect(patterns).toContain("alpha");
    expect(patterns).toContain("beta");
  });
});
