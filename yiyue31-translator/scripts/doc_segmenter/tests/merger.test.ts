/**
 * Unit tests for merger.ts.
 *
 * Ported from test_merger.py (11 tests).
 */

import { describe, test, expect } from "bun:test";
import { ChunkMergerImpl } from "../src/merger";
import { calcSizeKb } from "../src/utils";

function makeChunk(
  sourceSection: string = "Test",
  level: number = 1,
  content: string = "test content",
  sizeKb?: number,
  lineCount?: number
) {
  const computedSizeKb = sizeKb ?? calcSizeKb(content);
  const computedLineCount = lineCount ?? content.split("\n").length;
  return {
    sourceSection,
    level,
    content,
    sizeKb: computedSizeKb,
    lineCount: computedLineCount,
    startLine: 0,
    endLine: Math.max(0, computedLineCount - 1),
    isMerged: false as const,
    mergedSections: [] as string[],
    estimatedTokens: 0,
  };
}

describe("TestEmptyInput", () => {
  test("empty chunks returns empty", () => {
    const merger = new ChunkMergerImpl();
    const [chunks, ops] = merger.merge([], 40.0, 10.0);
    expect(chunks).toEqual([]);
    expect(ops).toEqual([]);
  });
});

describe("TestSingleChunk", () => {
  test("single chunk unchanged", () => {
    const merger = new ChunkMergerImpl();
    const chunk = makeChunk("A", 1, "content");
    const [chunks, ops] = merger.merge([chunk], 40.0, 10.0);
    expect(chunks.length).toBe(1);
    expect(chunks[0].sourceSection).toBe("A");
    expect(ops.length).toBe(0);
  });
});

describe("TestSameLevelMerge", () => {
  test("two small chunks merge", () => {
    const merger = new ChunkMergerImpl();
    const contentA = "a".repeat(5 * 1024);
    const contentB = "b".repeat(5 * 1024);
    const chunkA = makeChunk("A", 1, contentA);
    const chunkB = makeChunk("B", 1, contentB);
    const [chunks] = merger.merge([chunkA, chunkB], 40.0, 10.0);
    expect(chunks.length).toBe(1);
  });

  test("two medium chunks no merge", () => {
    const merger = new ChunkMergerImpl();
    const contentA = "a".repeat(10 * 1024);
    const contentB = "b".repeat(10 * 1024);
    const chunkA = makeChunk("A", 1, contentA);
    const chunkB = makeChunk("B", 1, contentB);
    const [chunks] = merger.merge([chunkA, chunkB], 15.0, 10.0);
    expect(chunks.length).toBe(2);
  });

  test("predecessor big current small merge", () => {
    const merger = new ChunkMergerImpl();
    const contentA = "a".repeat(10 * 1024);
    const contentB = "b".repeat(5 * 1024);
    const chunkA = makeChunk("A", 1, contentA);
    const chunkB = makeChunk("B", 1, contentB);
    const [chunks] = merger.merge([chunkA, chunkB], 20.0, 10.0);
    expect(chunks.length).toBe(1);
  });
});

describe("TestDifferentLevelNoMerge", () => {
  test("different levels no merge", () => {
    const merger = new ChunkMergerImpl();
    const contentA = "a".repeat(5 * 1024);
    const contentB = "b".repeat(5 * 1024);
    const chunkA = makeChunk("A", 1, contentA);
    const chunkB = makeChunk("B", 2, contentB);
    const [chunks] = merger.merge([chunkA, chunkB], 40.0, 10.0);
    expect(chunks.length).toBe(2);
  });
});

describe("TestMergedChunkProperties", () => {
  test("merged isMerged flag", () => {
    const merger = new ChunkMergerImpl();
    const contentA = "a".repeat(5 * 1024);
    const contentB = "b".repeat(5 * 1024);
    const chunkA = makeChunk("A", 1, contentA);
    const chunkB = makeChunk("B", 1, contentB);
    const [chunks] = merger.merge([chunkA, chunkB], 40.0, 10.0);
    expect(chunks[0].isMerged).toBe(true);
    expect(chunks[0].mergedSections).toEqual(["A", "B"]);
  });

  test("merged content separator", () => {
    const merger = new ChunkMergerImpl();
    const chunkA = makeChunk("A", 1, "content_A");
    const chunkB = makeChunk("B", 1, "content_B");
    const [chunks] = merger.merge([chunkA, chunkB], 40.0, 10.0);
    expect(chunks.length).toBe(1);
    expect(chunks[0].content).toBe("content_A\n\ncontent_B");
  });

  test("merged line count", () => {
    const merger = new ChunkMergerImpl();
    const contentA = "a".repeat(5 * 1024);
    const contentB = "b".repeat(5 * 1024);
    const chunkA = makeChunk("A", 1, contentA);
    const chunkB = makeChunk("B", 1, contentB);
    const [chunks] = merger.merge([chunkA, chunkB], 40.0, 10.0);
    const expectedLc = chunkA.lineCount + chunkB.lineCount + 2;
    expect(chunks[0].lineCount).toBe(expectedLc);
  });
});

describe("TestThreeChunkMerge", () => {
  test("three small chunks merge into 1", () => {
    const merger = new ChunkMergerImpl();
    const contentA = "a".repeat(3 * 1024);
    const contentB = "b".repeat(3 * 1024);
    const contentC = "c".repeat(3 * 1024);
    const chunkA = makeChunk("A", 1, contentA);
    const chunkB = makeChunk("B", 1, contentB);
    const chunkC = makeChunk("C", 1, contentC);
    const [chunks] = merger.merge([chunkA, chunkB, chunkC], 40.0, 10.0);
    expect(chunks.length).toBe(1);
    expect(chunks[0].mergedSections).toEqual(["A", "B", "C"]);
    expect(chunks[0].sourceSection).toBe("A + B + C");
  });
});

describe("TestMergeOperation", () => {
  test("merge operation format", () => {
    const merger = new ChunkMergerImpl();
    const chunkA = makeChunk("A", 1, "content_A");
    const chunkB = makeChunk("B", 1, "content_B");
    const [chunks, ops] = merger.merge([chunkA, chunkB], 40.0, 10.0);
    expect(ops.length).toBeGreaterThanOrEqual(1);
    const op = ops[0];
    expect(op.operation).toBe("merge");
    expect(op.detail).toMatch(/\d+KB \+ \d+KB -> \d+KB/);
  });
});
