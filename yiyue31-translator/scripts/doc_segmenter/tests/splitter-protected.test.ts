/**
 * Unit tests for splitter.ts protected region detection.
 *
 * Ported from test_splitter_protected.py (9 tests).
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

function padToKb(baseContent: string, targetKb: number): string {
  const targetBytes = Math.floor(targetKb * 1024);
  const paragraph = "Padding text to increase section size. ".repeat(20);
  const parts = [baseContent];
  let currentBytes = new TextEncoder().encode(baseContent).length;
  while (currentBytes < targetBytes) {
    parts.push("\n\n" + paragraph);
    currentBytes += new TextEncoder().encode("\n\n" + paragraph).length;
  }
  return parts.join("");
}

function countTripleBackticks(text: string): number {
  let count = 0;
  let pos = 0;
  while ((pos = text.indexOf("```", pos)) !== -1) {
    count++;
    pos += 3;
  }
  return count;
}

describe("TestCodeBlockProtection", () => {
  test("code block markers paired in every chunk", () => {
    const splitter = new SectionSplitterImpl();
    const codeBlock = "```python\ndef hello():\n    print('world')\n```";
    const content = padToKb(codeBlock, 60);
    const section = makeSection("CodeSection", content);
    const [chunks] = splitter.split([section], 40.0);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(countTripleBackticks(chunk.content) % 2).toBe(0);
    }
  });

  test("code block preserved intact", () => {
    const splitter = new SectionSplitterImpl();
    const codeLines: string[] = ["```python"];
    for (let i = 0; i < 2000; i++) {
      codeLines.push(`x[${i}] = ${i} * 2`);
    }
    codeLines.push("```");
    const codeBlock = codeLines.join("\n");
    const content = padToKb(codeBlock, 55);
    const section = makeSection("BigCode", content);
    const [chunks] = splitter.split([section], 40.0);
    const codeChunks = chunks.filter(c => c.content.includes("```python"));
    expect(codeChunks.length).toBeGreaterThanOrEqual(1);
    for (const cc of codeChunks) {
      expect(countTripleBackticks(cc.content) % 2).toBe(0);
    }
  });

  test("two separate code blocks preserved", () => {
    const splitter = new SectionSplitterImpl();
    const code1 = "```python\ncode1\n```";
    const code2 = "```javascript\ncode2\n```";
    const gap = "Paragraph between code blocks. ".repeat(200);
    const content = padToKb(code1 + "\n\n" + gap + "\n\n" + code2, 60);
    const section = makeSection("TwoCode", content);
    const [chunks] = splitter.split([section], 40.0);
    for (const chunk of chunks) {
      expect(countTripleBackticks(chunk.content) % 2).toBe(0);
    }
  });

  test("pipe inside code block not confused", () => {
    const splitter = new SectionSplitterImpl();
    const content = "```\ndata = a | b\n```\n";
    const section = makeSection("PipeCode", content);
    const [chunks] = splitter.split([section], 40.0);
    expect(chunks.length).toBe(1);
    expect(countTripleBackticks(chunks[0].content) % 2).toBe(0);
  });

  test("unclosed code block not protected", () => {
    const splitter = new SectionSplitterImpl();
    const codeStart = "```\nunclosed code here";
    const content = padToKb(codeStart, 50);
    const section = makeSection("Unclosed", content);
    const [chunks] = splitter.split([section], 40.0);
    expect(chunks.length).toBeGreaterThan(1);
  });

  test("split point respects code boundary", () => {
    const splitter = new SectionSplitterImpl();
    const para1 = "para1 content ".repeat(200);
    const code = "```py\ncode line 1\ncode line 2\n```";
    const para2 = "para2 content ".repeat(200);
    const content = para1 + "\n\n" + code + "\n\n" + para2;
    const section = makeSection("Boundary", content);
    const [chunks] = splitter.split([section], 4.0);
    for (const chunk of chunks) {
      const backtickCount = countTripleBackticks(chunk.content);
      if (backtickCount > 0) {
        expect(backtickCount % 2).toBe(0);
      }
    }
  });
});

describe("TestHtmlTableProtection", () => {
  test("HTML table preserved", () => {
    const splitter = new SectionSplitterImpl();
    const table = "<table>\n<tr>\n<td>data</td>\n</tr>\n</table>";
    const content = padToKb(table, 60);
    const section = makeSection("HtmlTable", content);
    const [chunks] = splitter.split([section], 40.0);
    const tableChunks = chunks.filter(
      c => c.content.includes("<table") && c.content.includes("</table>")
    );
    expect(tableChunks.length).toBeGreaterThanOrEqual(1);
  });
});

describe("TestPipeTableProtection", () => {
  test("pipe table preserved", () => {
    const splitter = new SectionSplitterImpl();
    const table = "| A | B |\n|---|---|\n| 1 | 2 |";
    const content = padToKb(table, 60);
    const section = makeSection("PipeTable", content);
    const [chunks] = splitter.split([section], 40.0);
    const tableChunks = chunks.filter(
      c => c.content.includes("| A | B |") && c.content.includes("| 1 | 2 |")
    );
    expect(tableChunks.length).toBeGreaterThanOrEqual(1);
  });

  test("two pipe tables separate chunks", () => {
    const splitter = new SectionSplitterImpl();
    const table1 = "| A | B |\n|---|---|\n| 1 | 2 |";
    const table2 = "| C | D |\n|---|---|\n| 3 | 4 |";
    const gap = "Some paragraph text between tables. ".repeat(200);
    const content = padToKb(table1 + "\n\n" + gap + "\n\n" + table2, 60);
    const section = makeSection("TwoTables", content);
    const [chunks] = splitter.split([section], 40.0);
    const t1 = chunks.filter(c => c.content.includes("| A | B |") && c.content.includes("| 1 | 2 |"));
    const t2 = chunks.filter(c => c.content.includes("| C | D |") && c.content.includes("| 3 | 4 |"));
    expect(t1.length).toBeGreaterThanOrEqual(1);
    expect(t2.length).toBeGreaterThanOrEqual(1);
  });
});
