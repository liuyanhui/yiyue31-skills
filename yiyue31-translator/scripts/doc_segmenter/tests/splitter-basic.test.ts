/**
 * Unit tests for splitter.ts basic splitting logic.
 *
 * Ported from test_splitter_basic.py (9 tests).
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

function generateParagraphContent(targetKb: number, paragraphSep: string = "\n\n"): string {
  const targetBytes = Math.floor(targetKb * 1024);
  const paragraph = "This is a test paragraph with some words for splitting tests. ".repeat(5);
  const parts: string[] = [];
  let currentBytes = 0;
  while (currentBytes < targetBytes) {
    parts.push(paragraph);
    currentBytes += new TextEncoder().encode(paragraph).length;
  }
  return parts.join(paragraphSep);
}

describe("TestSmallSection", () => {
  test("small section produces 1 chunk", () => {
    const splitter = new SectionSplitterImpl();
    const content = "small content";
    const section = makeSection("Small", content);
    const [chunks, ops] = splitter.split([section], 40.0);
    expect(chunks.length).toBe(1);
    expect(chunks[0].content).toBe(content);
    expect(ops.length).toBe(0);
  });
});

describe("TestLargeSectionSplitting", () => {
  test("all chunks within max size", () => {
    const splitter = new SectionSplitterImpl();
    const content = generateParagraphContent(100);
    const section = makeSection("Big", content);
    const [chunks] = splitter.split([section], 40.0);
    for (const chunk of chunks) {
      expect(chunk.sizeKb).toBeLessThanOrEqual(40.1);
    }
  });

  test("concatenation equals original", () => {
    const splitter = new SectionSplitterImpl();
    const content = generateParagraphContent(100);
    const section = makeSection("Big", content);
    const [chunks] = splitter.split([section], 40.0);
    const reconstructed = chunks.map(c => c.content).join("");
    expect(reconstructed).toBe(content);
  });
});

describe("TestExactSplitPoints", () => {
  test("two paragraphs split at blank line", () => {
    const splitter = new SectionSplitterImpl();
    const content = "para1 line1\npara1 line2\n\npara2 line1\npara2 line2";
    const section = makeSection("Test", content);
    const [chunks] = splitter.split([section], 0.025);
    expect(chunks.length).toBe(2);
    expect(chunks[0].content).toBe("para1 line1\npara1 line2\n\n");
    expect(chunks[1].content).toBe("para2 line1\npara2 line2");
  });
});

describe("TestChunkNaming", () => {
  test("split section naming with -p1, -p2, etc.", () => {
    const splitter = new SectionSplitterImpl();
    const content = generateParagraphContent(100);
    const section = makeSection("Intro", content);
    const [chunks] = splitter.split([section], 40.0);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    for (let i = 0; i < chunks.length; i++) {
      expect(chunks[i].sourceSection).toBe(`Intro-p${i + 1}`);
    }
  });

  test("unsplit section keeps original title", () => {
    const splitter = new SectionSplitterImpl();
    const section = makeSection("Small", "small content");
    const [chunks] = splitter.split([section], 40.0);
    expect(chunks.length).toBe(1);
    expect(chunks[0].sourceSection).toBe("Small");
  });
});

describe("TestSplitOperation", () => {
  test("split operation format", () => {
    const splitter = new SectionSplitterImpl();
    const content = generateParagraphContent(100);
    const section = makeSection("MySection", content);
    const [chunks, ops] = splitter.split([section], 40.0);
    expect(ops.length).toBeGreaterThanOrEqual(1);
    const op = ops[0];
    expect(op.operation).toBe("split");
    expect(op.target).toBe("MySection");
    expect(op.detail).toContain("p1(");
  });
});

describe("TestMultipleSections", () => {
  test("two sections split independently", () => {
    const splitter = new SectionSplitterImpl();
    const smallContent = generateParagraphContent(5);
    const largeContent = generateParagraphContent(80);
    const sectionA = makeSection("A", smallContent);
    const sectionB = makeSection("B", largeContent);
    const [chunks] = splitter.split([sectionA, sectionB], 40.0);
    const aChunks = chunks.filter(c => c.sourceSection.startsWith("A"));
    const bChunks = chunks.filter(c => c.sourceSection.startsWith("B"));
    expect(aChunks.length).toBe(1);
    expect(bChunks.length).toBeGreaterThan(1);
  });

  test("all chunks from large section within max size", () => {
    const splitter = new SectionSplitterImpl();
    const content = generateParagraphContent(100);
    const section = makeSection("Big", content);
    const [chunks] = splitter.split([section], 40.0);
    for (const chunk of chunks) {
      expect(chunk.sizeKb).toBeLessThanOrEqual(40.1);
    }
  });
});
