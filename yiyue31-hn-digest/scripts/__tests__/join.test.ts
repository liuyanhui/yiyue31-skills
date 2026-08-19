import { test, expect, describe, afterAll } from "bun:test";
import { spawn } from "child_process";
import { readFileSync, writeFileSync, rmSync, existsSync, mkdirSync } from "node:fs";
import { resolve as resolvePath, join } from "node:path";
import {
  renderEntry,
  buildActiveBodies,
  buildOutlierFiles,
  type SlimEntry,
} from "../join";

// ---------------------------------------------------------------------------
// Fixtures (inline) — slim index entries + raw bodies
// ---------------------------------------------------------------------------
const RAW_COMMENTS = [
  { id: "a1", author: "u1", parentId: null, childIds: ["a2"], depth: 0, contentMarkdown: "Body A1" },
  { id: "a2", author: "u2", parentId: "a1", childIds: [], depth: 1, contentMarkdown: "Body A2" },
  { id: "o1", author: "v1", parentId: null, childIds: [], depth: 0, contentMarkdown: "Body O1" },
  { id: "o2", author: "v2", parentId: null, childIds: [], depth: 0, contentMarkdown: "  Body O2  " },
  { id: "o3", author: "v3", parentId: "o2", childIds: [], depth: 1, contentMarkdown: "Body O3" },
  { id: "o4", author: "v4", parentId: null, childIds: [], depth: 0, contentMarkdown: "Body O4" },
  { id: "o5", author: "v5", parentId: null, childIds: [], depth: 0, contentMarkdown: "Body O5" },
];

const BY_ID = new Map(RAW_COMMENTS.map((c) => [c.id, c]));

const ACTIVE: SlimEntry[] = [
  { id: "a1", author: "u1", parentId: null, childIds: ["a2"], depth: 0, isOP: false },
  { id: "a2", author: "u2", parentId: "a1", childIds: [], depth: 1, isOP: true },
];

const OUTLIER_POOL: SlimEntry[] = ["o1", "o2", "o3", "o4", "o5"].map((id, i) => ({
  id,
  author: `v${i + 1}`,
  parentId: id === "o3" ? "o2" : null,
  childIds: [],
  depth: id === "o3" ? 1 : 0,
}));

// ---------------------------------------------------------------------------
// renderEntry
// ---------------------------------------------------------------------------
describe("renderEntry", () => {
  test("full header carries grouping context fields + trimmed body", () => {
    const out = renderEntry(ACTIVE[0], "  Body A1  ", true);
    expect(out).toContain("### id=a1 author=u1 depth=0 parentId=null replies=1 isOP=false");
    expect(out).toContain("Body A1");
    expect(out).not.toContain("  Body A1  \n");
  });

  test("compact header for outlier entries", () => {
    const out = renderEntry(OUTLIER_POOL[2], "Body O3", false);
    expect(out).toContain("### id=o3 author=v3 depth=1");
    expect(out).not.toContain("parentId=");
  });

  test("missing body renders an explicit placeholder, not silence", () => {
    const slim: SlimEntry = { id: "zz", author: "u9", parentId: null, childIds: [], depth: 0 };
    const out = renderEntry(slim, null, true);
    expect(out).toContain("id=zz");
    expect(out).toContain("(missing in raw)");
  });
});

// ---------------------------------------------------------------------------
// buildActiveBodies
// ---------------------------------------------------------------------------
describe("buildActiveBodies", () => {
  test("joins every active body in order, one entry per comment", () => {
    const out = buildActiveBodies(BY_ID, ACTIVE);
    expect(out).toContain("Body A1");
    expect(out).toContain("Body A2");
    expect(out.split("### ")).toHaveLength(3); // leading text + 2 entries
    expect(out.indexOf("id=a1")).toBeLessThan(out.indexOf("id=a2"));
  });

  test("empty active set yields empty string", () => {
    expect(buildActiveBodies(BY_ID, [])).toBe("");
  });
});

// ---------------------------------------------------------------------------
// buildOutlierFiles
// ---------------------------------------------------------------------------
describe("buildOutlierFiles", () => {
  const BATCHES = [["o1", "o2"], ["o3"], ["o4", "o5"]];

  test("consolidates batches into N consecutive group files, no id lost or duplicated", () => {
    const files = buildOutlierFiles(BY_ID, OUTLIER_POOL, BATCHES, 2);
    expect(files).toHaveLength(2);
    expect(files[0].name).toBe("02-outlier-bodies-g1.md");
    expect(files[1].name).toBe("02-outlier-bodies-g2.md");
    // Group 1 = batches 1-2 (o1,o2,o3); group 2 = batch 3 (o4,o5).
    expect(files[0].content).toContain("batches 1-2, 3 comments");
    expect(files[1].content).toContain("batches 3-3, 2 comments");
    const all = files.map((f) => f.content).join("\n");
    for (const id of ["o1", "o2", "o3", "o4", "o5"]) {
      expect(all.split(`id=${id} `).length).toBe(2); // exactly once
    }
    expect(files[0].content).toContain("Body O1");
    expect(files[0].content).toContain("Body O3");
    expect(files[1].content).toContain("Body O5");
  });

  test("bodies are trimmed in outlier entries", () => {
    const files = buildOutlierFiles(BY_ID, OUTLIER_POOL, BATCHES, 2);
    expect(files[0].content).toContain("Body O2");
  });

  test("no batches → single file over the whole pool", () => {
    const files = buildOutlierFiles(BY_ID, OUTLIER_POOL, null, 4);
    expect(files).toHaveLength(1);
    expect(files[0].name).toBe("02-outlier-bodies.md");
    expect(files[0].content).toContain("# outlier bodies (5 comments)");
    expect(files[0].content).toContain("Body O5");
  });

  test("empty pool → no files", () => {
    expect(buildOutlierFiles(BY_ID, [], null, 4)).toHaveLength(0);
    expect(buildOutlierFiles(BY_ID, [], [], 4)).toHaveLength(0);
  });

  test("id missing from raw renders placeholder with fallback author", () => {
    const pool: SlimEntry[] = [{ id: "ghost", author: "vg", parentId: null, childIds: [], depth: 0 }];
    const files = buildOutlierFiles(new Map(RAW_COMMENTS.map((c) => [c.id, c])), pool, [["ghost"]], 1);
    expect(files[0].content).toContain("id=ghost");
    expect(files[0].content).toContain("(missing in raw)");
  });
});

// ---------------------------------------------------------------------------
// CLI integration (offline — no network, tiny fixtures in a tmp dir)
// ---------------------------------------------------------------------------
const TMP_DIR = resolvePath(__dirname, "__tmp_join__");

describe("join CLI", () => {
  afterAll(() => {
    if (existsSync(TMP_DIR)) rmSync(TMP_DIR, { recursive: true, force: true });
  });

  function runCli(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
    const cwd = resolvePath(__dirname, "../..");
    return new Promise((resolvePromise) => {
      const proc = spawn(process.execPath, ["scripts/join.ts", ...args], { cwd });
      let stdout = "";
      let stderr = "";
      proc.stdout.on("data", (d: Buffer) => (stdout += d.toString()));
      proc.stderr.on("data", (d: Buffer) => (stderr += d.toString()));
      proc.on("close", (code) => resolvePromise({ stdout, stderr, exitCode: code }));
      proc.on("error", (err) => resolvePromise({ stdout, stderr: err.message, exitCode: -1 }));
    });
  }

  test("writes 02-active-bodies.md and outlier group files, prints one summary line", async () => {
    mkdirSync(TMP_DIR, { recursive: true });
    const rawPath = join(TMP_DIR, "01-raw-data.json");
    const filteredPath = join(TMP_DIR, "02-filtered.json");
    writeFileSync(rawPath, JSON.stringify({ comments: RAW_COMMENTS }), "utf-8");
    writeFileSync(filteredPath, JSON.stringify({
      active: ACTIVE,
      outlierPool: OUTLIER_POOL,
      outlierBatches: [["o1", "o2"], ["o3"], ["o4", "o5"]],
      meta: {},
    }), "utf-8");

    const result = await runCli([rawPath, filteredPath]);
    expect(result.exitCode).toBe(0);

    expect(existsSync(join(TMP_DIR, "02-active-bodies.md"))).toBe(true);
    expect(existsSync(join(TMP_DIR, "02-outlier-bodies-g1.md"))).toBe(true);
    expect(existsSync(join(TMP_DIR, "02-outlier-bodies-g2.md"))).toBe(true);
    expect(readFileSync(join(TMP_DIR, "02-active-bodies.md"), "utf-8")).toContain("Body A1");

    // Exactly one summary line on stdout.
    expect(result.stdout.trim().split("\n")).toHaveLength(1);
    expect(result.stdout).toContain("join: 2 active bodies");
    expect(result.stdout).toContain("5 outlier bodies");
  });

  test("missing args → usage error on stderr, exit 1", async () => {
    const result = await runCli([]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Usage");
  });
});
