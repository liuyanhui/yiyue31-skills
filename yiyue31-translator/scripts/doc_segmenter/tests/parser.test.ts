/**
 * Unit tests for parser.ts.
 *
 * Ported from test_parser.py (9 tests).
 */

import { describe, test, expect } from "bun:test";
import { SectionParserImpl } from "../src/parser";
import { calcSizeKb } from "../src/utils";

describe("TestParseEmpty", () => {
  test("empty content returns single root section", () => {
    const parser = new SectionParserImpl();
    const result = parser.parse("", "utf-8");
    expect(result.length).toBe(1);
    expect(result[0].level).toBe(0);
    expect(result[0].title).toBe("root");
    expect(result[0].content).toBe("");
    expect(result[0].sizeKb).toBe(0.0);
    expect(result[0].startLine).toBe(0);
    expect(result[0].endLine).toBe(0);
  });
});

describe("TestParsePlainText", () => {
  test("plain text returns root section with full content", () => {
    const parser = new SectionParserImpl();
    const content = "hello world";
    const result = parser.parse(content, "utf-8");
    expect(result.length).toBe(1);
    expect(result[0].level).toBe(0);
    expect(result[0].title).toBe("root");
    expect(result[0].content).toBe("hello world");
    expect(Math.abs(result[0].sizeKb - calcSizeKb("hello world"))).toBeLessThan(0.001);
    expect(result[0].startLine).toBe(0);
    expect(result[0].endLine).toBe(0);
  });
});

describe("TestParseSingleHeading", () => {
  test("single heading returns one section with level=1", () => {
    const parser = new SectionParserImpl();
    const result = parser.parse("# Title\nbody", "utf-8");
    expect(result.length).toBe(1);
    expect(result[0].level).toBe(1);
    expect(result[0].title).toBe("Title");
    expect(result[0].content).toBe("# Title\nbody");
  });
});

describe("TestParseMultipleHeadings", () => {
  const content = "# A\na\n\n## B\nb\n\n### C\nc";

  test("three heading levels with correct levels and titles", () => {
    const parser = new SectionParserImpl();
    const result = parser.parse(content, "utf-8");
    expect(result.length).toBe(3);
    expect(result.map(s => s.level)).toEqual([1, 2, 3]);
    expect(result.map(s => s.title)).toEqual(["A", "B", "C"]);
  });

  test("content concatenation reproduces original", () => {
    const parser = new SectionParserImpl();
    const result = parser.parse(content, "utf-8");
    const reconstructed = result.map(s => s.content).join("");
    expect(reconstructed).toBe(content);
  });

  test("correct line numbers", () => {
    const parser = new SectionParserImpl();
    const result = parser.parse(content, "utf-8");
    expect(result[0].startLine).toBe(0);
    expect(result[0].endLine).toBe(2);
    expect(result[1].startLine).toBe(3);
    expect(result[1].endLine).toBe(5);
    expect(result[2].startLine).toBe(6);
    expect(result[2].endLine).toBe(7);
  });
});

describe("TestParsePreamble", () => {
  test("preamble section before first heading", () => {
    const parser = new SectionParserImpl();
    const content = "intro\n\n# Title\nbody";
    const result = parser.parse(content, "utf-8");
    expect(result.length).toBe(2);
    expect(result[0].level).toBe(0);
    expect(result[0].title).toBe("preamble");
    expect(result[0].content).toBe("intro\n\n");
    expect(result[1].level).toBe(1);
    expect(result[1].title).toBe("Title");
  });
});

describe("TestParseChinese", () => {
  test("Chinese heading preserved", () => {
    const parser = new SectionParserImpl();
    const result = parser.parse("# 中文标题\n内容", "utf-8");
    expect(result[0].title).toBe("中文标题");
  });
});

describe("TestParseConsecutiveHeadings", () => {
  test("three consecutive headings each get own section", () => {
    const parser = new SectionParserImpl();
    const content = "# A\n# B\n# C";
    const result = parser.parse(content, "utf-8");
    expect(result.length).toBe(3);
    expect(result[0].content).toBe("# A\n");
    expect(result[1].content).toBe("# B\n");
    expect(result[2].content).toBe("# C");
  });
});
