/**
 * Unit tests for utils.ts.
 *
 * Tests sanitizeFilename and calcSizeKb.
 * Ported from test_utils.py (13 tests).
 */

import { describe, test, expect } from "bun:test";
import { sanitizeFilename, calcSizeKb, normalizeNewlines } from "../src/utils";

describe("sanitizeFilename", () => {
  test("replaces / \\ : * ? with dashes", () => {
    expect(sanitizeFilename("a/b:c?d")).toBe("a-b-c-d");
  });

  test("collapses consecutive dashes", () => {
    expect(sanitizeFilename("a///b")).toBe("a-b");
  });

  test("returns empty string for empty input", () => {
    expect(sanitizeFilename("")).toBe("");
  });

  test("replaces backslash", () => {
    expect(sanitizeFilename("a\\b")).toBe("a-b");
  });

  test("replaces asterisk", () => {
    expect(sanitizeFilename("a*b")).toBe("a-b");
  });

  test("replaces pipe", () => {
    expect(sanitizeFilename("a|b")).toBe("a-b");
  });

  test("replaces angle brackets", () => {
    expect(sanitizeFilename("a<b>c")).toBe("a-b-c");
  });

  test("replaces double quote", () => {
    expect(sanitizeFilename('a"b')).toBe("a-b");
  });

  test("preserves safe characters", () => {
    expect(sanitizeFilename("hello-world_123.txt")).toBe("hello-world_123.txt");
  });
});

describe("calcSizeKb", () => {
  test("returns correct KB for ASCII string", () => {
    const content = "abc";
    const expected = new TextEncoder().encode(content).length / 1024;
    expect(Math.abs(calcSizeKb(content) - expected)).toBeLessThanOrEqual(0.001);
  });

  test("returns 0.0 for empty string", () => {
    expect(calcSizeKb("")).toBe(0.0);
  });

  test("returns correct KB for Chinese text", () => {
    const expected = 6 / 1024; // 2 Chinese chars * 3 bytes = 6 bytes
    expect(Math.abs(calcSizeKb("中文") - expected)).toBeLessThanOrEqual(0.001);
  });

  test("handles mixed ASCII and Chinese content", () => {
    const content = "abc中文";
    const expected = new TextEncoder().encode(content).length / 1024;
    expect(Math.abs(calcSizeKb(content) - expected)).toBeLessThanOrEqual(0.001);
  });
});
