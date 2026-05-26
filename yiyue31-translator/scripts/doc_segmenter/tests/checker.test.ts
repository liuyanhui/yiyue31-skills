/**
 * Unit tests for checker.ts.
 *
 * Ported from test_checker.py (13 tests).
 */

import { describe, test, expect } from "bun:test";
import { IntegrityCheckerImpl } from "../src/checker";
import type { Chunk, SourceFileInfo } from "../src/models";
import { calcSizeKb } from "../src/utils";

function makeChunk(
  content: string = "test",
  sourceSection: string = "Test",
  level: number = 1,
  isMerged: boolean = false,
  mergedSections?: string[]
): Chunk {
  return {
    sourceSection,
    level,
    content,
    sizeKb: calcSizeKb(content),
    lineCount: content.split("\n").length,
    startLine: 0,
    endLine: content.split("\n").length - 1,
    isMerged,
    mergedSections: mergedSections ?? (isMerged ? [sourceSection] : []),
    estimatedTokens: 0,
  };
}

function makeSourceInfo(fileLines: number = 1): SourceFileInfo {
  return {
    filePath: "/tmp/test.md",
    fileSize: 0.0,
    fileLines,
    fileChars: 0,
    fileEncoding: "utf-8",
  };
}

describe("TestLineCountCheck", () => {
  test("correct line count", () => {
    const checker = new IntegrityCheckerImpl();
    const chunks = [makeChunk("a\nb\nc")];
    const sourceInfo = makeSourceInfo(3);
    const result = checker.check(chunks, "a\nb\nc", sourceInfo);
    expect(result.line_count).toBe(true);
  });

  test("incorrect line count", () => {
    const checker = new IntegrityCheckerImpl();
    const chunks = [makeChunk("a\nb\nc")];
    const sourceInfo = makeSourceInfo(5);
    const result = checker.check(chunks, "a\nb\nc", sourceInfo);
    expect(result.line_count).toBe(false);
  });

  test("merged line count adjusted", () => {
    const checker = new IntegrityCheckerImpl();
    const chunk = makeChunk("a\nb\n\nc\nd", "Test", 1, true, ["A", "B"]);
    const sourceInfo = makeSourceInfo(3);
    const result = checker.check([chunk], "a\nb\n\nc\nd", sourceInfo);
    expect(result.line_count).toBe(true);
  });

  test("merged line count trailing newline", () => {
    const checker = new IntegrityCheckerImpl();
    const chunk = makeChunk("a\nb\n\nc\nd\n", "Test", 1, true, ["A", "B"]);
    const sourceInfo = makeSourceInfo(4);
    const result = checker.check([chunk], "a\nb\n\nc\nd\n", sourceInfo);
    expect(result.line_count).toBe(false);
  });
});

describe("TestContentConcatCheck", () => {
  test("concat matches original", () => {
    const checker = new IntegrityCheckerImpl();
    const chunks = [makeChunk("abc"), makeChunk("def")];
    const result = checker.check(chunks, "abcdef", makeSourceInfo());
    expect(result.content_concat).toBe(true);
  });

  test("concat does not match", () => {
    const checker = new IntegrityCheckerImpl();
    const chunks = [makeChunk("abc"), makeChunk("def")];
    const result = checker.check(chunks, "abcXYZ", makeSourceInfo());
    expect(result.content_concat).toBe(false);
  });

  test("merged content normalized", () => {
    const checker = new IntegrityCheckerImpl();
    const chunk = makeChunk("A\n\nB", "Test", 1, true, ["A", "B"]);
    const result = checker.check([chunk], "A\nB", makeSourceInfo());
    expect(result.content_concat).toBe(true);
  });
});

describe("TestNoDuplicatesCheck", () => {
  test("no duplicates", () => {
    const checker = new IntegrityCheckerImpl();
    const chunks = [makeChunk("abc"), makeChunk("def")];
    const result = checker.check(chunks, "abcdef", makeSourceInfo());
    expect(result.no_duplicates).toBe(true);
  });

  test("duplicate content", () => {
    const checker = new IntegrityCheckerImpl();
    const chunks = [makeChunk("abc"), makeChunk("abc")];
    const result = checker.check(chunks, "abcabc", makeSourceInfo());
    expect(result.no_duplicates).toBe(false);
  });

  test("substring overlap", () => {
    const checker = new IntegrityCheckerImpl();
    const chunks = [makeChunk("a"), makeChunk("xa")];
    const result = checker.check(chunks, "axa", makeSourceInfo());
    expect(result.no_duplicates).toBe(false);
  });
});

describe("TestFirstLastLineCheck", () => {
  test("matching first last", () => {
    const checker = new IntegrityCheckerImpl();
    const chunks = [makeChunk("first\nmiddle\nlast")];
    const result = checker.check(chunks, "first\nmiddle\nlast", makeSourceInfo());
    expect(result.first_last_line).toBe(true);
  });

  test("mismatching first line", () => {
    const checker = new IntegrityCheckerImpl();
    const chunks = [makeChunk("XXX\nmiddle\nlast")];
    const result = checker.check(chunks, "first\nmiddle\nlast", makeSourceInfo());
    expect(result.first_last_line).toBe(false);
  });
});

describe("TestEmptyInputCheck", () => {
  test("empty chunks and original", () => {
    const checker = new IntegrityCheckerImpl();
    const sourceInfo = makeSourceInfo(0);
    const result = checker.check([], "", sourceInfo);
    expect(result.first_last_line).toBe(true);
    expect(result.line_count).toBe(true);
  });
});
