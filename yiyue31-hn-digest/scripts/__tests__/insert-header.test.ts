import { test, expect, describe } from "bun:test";
import { buildHeader, injectHeader, formatTimestamp } from "../insert-header";

// Reference article used across cases.
const ARTICLE = `# [Hacker News] Some Title

## 背景 / Background
Some context.
`;

describe("formatTimestamp", () => {
  test("formats ISO to YYYY-MM-DD HH:mm:ss", () => {
    const iso = "2026-06-29T14:23:45.000Z";
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    const expected =
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
      `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    expect(formatTimestamp(iso)).toBe(expected);
  });

  test("falls back to raw string on unparseable input", () => {
    expect(formatTimestamp("not-a-date")).toBe("not-a-date");
  });
});

describe("buildHeader", () => {
  test("zh: disclaimer + timestamp when latestCommentAt present", () => {
    const out = buildHeader("zh", "2026-06-29T14:23:45.000Z");
    expect(out).toContain("本文由 Yiyue31");
    expect(out).toContain("讨论截至：");
    // Timestamp is reformatted, not the raw ISO.
    expect(out).not.toContain("T14:23:45.000Z");
  });

  test("disclaimer only when latestCommentAt is null", () => {
    const out = buildHeader("zh", null);
    expect(out).toContain("本文由 Yiyue31");
    expect(out).not.toContain("讨论截至");
  });
});

describe("injectHeader", () => {
  test("inserts header after H1", () => {
    const out = injectHeader(ARTICLE, "zh", "2026-06-29T14:23:45.000Z");
    const lines = out.split("\n");
    expect(lines[0]).toBe("# [Hacker News] Some Title");
    // Header block lands between H1 and the first ## section.
    const h1Idx = 0;
    const sectionIdx = lines.findIndex((l) => l.startsWith("## "));
    const headerIdx = lines.findIndex((l) => l.includes("本文由 Yiyue31"));
    expect(headerIdx).toBeGreaterThan(h1Idx);
    expect(headerIdx).toBeLessThan(sectionIdx);
    expect(out).toContain("讨论截至：");
  });

  test("omits timestamp line when latestCommentAt is null", () => {
    const out = injectHeader(ARTICLE, "zh", null);
    expect(out).toContain("本文由 Yiyue31");
    expect(out).not.toContain("讨论截至");
  });

  test("idempotent: re-running is a no-op", () => {
    const once = injectHeader(ARTICLE, "zh", "2026-06-29T14:23:45.000Z");
    const twice = injectHeader(once, "zh", "2026-06-29T14:23:45.000Z");
    expect(twice).toBe(once);
  });
});
