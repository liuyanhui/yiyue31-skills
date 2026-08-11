import { test, expect, describe } from "bun:test";
import { buildHeader, injectHeader, formatTimestamp, snapshotFromRaw, type Snapshot } from "../insert-header";

// Reference article used across cases.
const ARTICLE = `# [HN] 某标题

## 背景
Some context.
`;

const SNAP_WITH_TS: Snapshot = {
  latestCommentAt: "2026-06-29T14:23:45.000Z",
  score: 312,
  commentCount: 487,
};

const SNAP_NO_TS: Snapshot = { latestCommentAt: null, score: 0, commentCount: 0 };

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

describe("snapshotFromRaw", () => {
  test("reads score and comment count from raw data", () => {
    const snap = snapshotFromRaw({
      latestCommentAt: "2026-06-29T14:23:45.000Z",
      post: { postScore: 312 },
      comments: new Array(487),
    });
    expect(snap.score).toBe(312);
    expect(snap.commentCount).toBe(487);
    expect(snap.latestCommentAt).toBe("2026-06-29T14:23:45.000Z");
  });

  test("defaults score and count when fields absent", () => {
    const snap = snapshotFromRaw({});
    expect(snap.score).toBe(0);
    expect(snap.commentCount).toBe(0);
    expect(snap.latestCommentAt).toBeNull();
  });
});

describe("buildHeader", () => {
  test("zh: disclaimer + methodology + snapshot (score, count) when timestamp present", () => {
    const out = buildHeader("zh", SNAP_WITH_TS);
    expect(out).toContain("本文由 Yiyue31");
    // Methodology/neutrality folded in.
    expect(out).toContain("非编辑倾向");
    // Snapshot data.
    expect(out).toContain("讨论截至：");
    expect(out).toContain("312 分");
    expect(out).toContain("487 条评论");
    // Single <small> paragraph.
    expect(out.startsWith("<small>")).toBe(true);
    expect(out.endsWith("</small>")).toBe(true);
    expect(out.match(/<small>/g)).toHaveLength(1);
    // Timestamp is reformatted, not the raw ISO.
    expect(out).not.toContain("T14:23:45.000Z");
  });

  test("zh: omits timestamp segment but keeps score/count when latestCommentAt is null", () => {
    const out = buildHeader("zh", SNAP_NO_TS);
    expect(out).toContain("本文由 Yiyue31");
    expect(out).not.toContain("讨论截至");
    expect(out).toContain("0 分");
    expect(out).toContain("0 条评论");
  });

  test("en: english labels", () => {
    const out = buildHeader("en", SNAP_WITH_TS);
    expect(out).toContain("This digest was summarized");
    expect(out).toContain("not editorial bias");
    expect(out).toContain("312 points");
    expect(out).toContain("487 comments");
    expect(out).toContain("Discussion as of:");
  });
});

describe("injectHeader", () => {
  test("inserts header after H1", () => {
    const out = injectHeader(ARTICLE, "zh", SNAP_WITH_TS);
    const lines = out.split("\n");
    expect(lines[0]).toBe("# [HN] 某标题");
    // Header block lands between H1 and the first ## section.
    const h1Idx = 0;
    const sectionIdx = lines.findIndex((l) => l.startsWith("## "));
    const headerIdx = lines.findIndex((l) => l.includes("本文由 Yiyue31"));
    expect(headerIdx).toBeGreaterThan(h1Idx);
    expect(headerIdx).toBeLessThan(sectionIdx);
    expect(out).toContain("312 分");
  });

  test("omits timestamp segment when latestCommentAt is null", () => {
    const out = injectHeader(ARTICLE, "zh", SNAP_NO_TS);
    expect(out).toContain("本文由 Yiyue31");
    expect(out).not.toContain("讨论截至");
  });

  test("idempotent: re-running is a no-op", () => {
    const once = injectHeader(ARTICLE, "zh", SNAP_WITH_TS);
    const twice = injectHeader(once, "zh", SNAP_WITH_TS);
    expect(twice).toBe(once);
  });
});
