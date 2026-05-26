/**
 * Unit tests for splitter.ts recursive splitting behavior.
 *
 * Ported from test_splitter_recursive.py (4 tests).
 */

import { describe, test, expect } from "bun:test";
import { SectionSplitterImpl } from "../src/splitter";
import type { Section } from "../src/models";
import { calcSizeKb } from "../src/utils";

function makeSection(title: string, content: string, level: number = 1): Section {
  return {
    level,
    title,
    content,
    sizeKb: calcSizeKb(content),
    startLine: 0,
    endLine: content.split("\n").length - 1,
  };
}

function generateContinuousText(targetKb: number): string {
  const targetBytes = Math.floor(targetKb * 1024);
  const base = "ContinuousTextLineWithoutSplitPointsThatForcesRecursiveSplitting";
  const lines: string[] = [];
  let currentBytes = 0;
  while (currentBytes < targetBytes) {
    lines.push(base);
    currentBytes += new TextEncoder().encode(base).length + 1;
  }
  return lines.join("\n");
}

describe("TestContinuousTextSplitting", () => {
  test("large continuous text splits and concat equals original", () => {
    const splitter = new SectionSplitterImpl();
    const content = generateContinuousText(80);
    const section = makeSection("NoSplit", content);
    const [chunks] = splitter.split([section], 40.0);
    expect(chunks.length).toBeGreaterThan(1);
    const reconstructed = chunks.map(c => c.content).join("");
    expect(reconstructed).toBe(content);
  });

  test("very large forces oversized chunk", () => {
    const splitter = new SectionSplitterImpl();
    const base = "X".repeat(70);
    const targetBytes = Math.floor(200 * 1024);
    const content = base.repeat(Math.ceil(targetBytes / base.length));
    const section = makeSection("VeryLarge", content);
    const [chunks] = splitter.split([section], 40.0);
    const oversized = chunks.filter(c => c.sizeKb > 40.0);
    expect(oversized.length).toBeGreaterThanOrEqual(1);
  });

  test("code block with continuous text has paired markers", () => {
    const splitter = new SectionSplitterImpl();
    const codeBlock = "```py\ncode_here\n```";
    const continuous = generateContinuousText(50);
    const content = codeBlock + "\n" + continuous;
    const section = makeSection("CodeContinuous", content);
    const [chunks] = splitter.split([section], 40.0);
    for (const chunk of chunks) {
      const backtickCount = (chunk.content.match(/```/g) || []).length;
      if (backtickCount > 0) {
        expect(backtickCount % 2).toBe(0);
      }
    }
  });

  test("split operation recorded with pN pattern", () => {
    const splitter = new SectionSplitterImpl();
    const content = generateContinuousText(80);
    const section = makeSection("ForceSplit", content);
    const [chunks, ops] = splitter.split([section], 40.0);
    expect(ops.length).toBeGreaterThanOrEqual(1);
    for (const op of ops) {
      if (op.operation === "split") {
        expect(op.detail).toMatch(/p\d+\(/);
      }
    }
  });
});
