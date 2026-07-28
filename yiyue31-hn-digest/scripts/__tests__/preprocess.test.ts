import { test, expect, describe } from "bun:test";
import { spawnSync } from "child_process";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Skill root: scripts/__tests__ -> ../.. = yiyue31-hn-digest/
const SKILL_ROOT = import.meta.dir + "/../..";

function runPreprocess(
  inputPath: string | null,
  flags: string[] = []
): { stdout: string; stderr: string; exitCode: number | null } {
  const args = inputPath ? ["scripts/preprocess.ts", inputPath, ...flags] : ["scripts/preprocess.ts", ...flags];
  const result = spawnSync("bun", args, { cwd: SKILL_ROOT, encoding: "utf-8" });
  return { stdout: result.stdout ?? "", stderr: result.stderr ?? "", exitCode: result.status };
}

// Build a unified-JSON-shaped input with `count` flat top-level comments (each
// 0 replies → all land in the outlier pool under the default minReplies=3).
function writeRawData(dir: string, count: number): string {
  const comments = Array.from({ length: count }, (_, i) => ({
    id: `c${i}`,
    author: i === 0 ? "op" : `user${i}`,
    parentId: null,
    childIds: [],
    depth: 0,
    contentMarkdown: `comment ${i}`,
  }));
  const data = {
    source: "algolia",
    post: { id: "1", title: "t", author: "op", url: null, postScore: 1, textContent: null },
    comments,
  };
  const inputPath = join(dir, "01-raw-data.json");
  writeFileSync(inputPath, JSON.stringify(data), "utf-8");
  return inputPath;
}

describe("preprocess.ts", () => {
  let dir: string;

  // manual temp-dir management (keeps tests independent)
  function freshDir(): string {
    return mkdtempSync(join(tmpdir(), "preprocess-"));
  }

  test("no-arg invocation prints usage and exits 1", () => {
    const result = runPreprocess(null);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Usage");
  });

  test("writes 02-filtered.json with required shape; no batching under threshold", () => {
    dir = freshDir();
    try {
      const inputPath = writeRawData(dir, 10);
      const result = runPreprocess(inputPath);

      expect(result.exitCode).toBe(0);
      const outPath = join(dir, "02-filtered.json");
      expect(existsSync(outPath)).toBe(true);

      const out = JSON.parse(readFileSync(outPath, "utf-8"));
      expect(Array.isArray(out.active)).toBe(true);
      expect(Array.isArray(out.outlierPool)).toBe(true);
      expect(out.outlierBatches).toBeNull(); // 10 <= 60 threshold
      expect(out.meta.inputCount).toBe(10);
      expect(out.meta.outlierCount).toBe(10);
      expect(out.meta.activeCount).toBe(0); // all flat, 0 replies, minReplies=3
      expect(out.meta.batched).toBe(false);
      // isOP marked (c0 is the OP)
      const op = out.outlierPool.find((c: { id: string }) => c.id === "c0");
      expect(op.isOP).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("batches the outlier pool when it exceeds the threshold", () => {
    dir = freshDir();
    try {
      const inputPath = writeRawData(dir, 95); // > 60 threshold
      const result = runPreprocess(inputPath);

      expect(result.exitCode).toBe(0);
      const out = JSON.parse(readFileSync(join(dir, "02-filtered.json"), "utf-8"));

      expect(out.meta.batched).toBe(true);
      expect(Array.isArray(out.outlierBatches)).toBe(true);
      // batch size 40 → ceil(95/40) = 3 batches
      expect(out.meta.batchCount).toBe(3);
      expect(out.outlierBatches.length).toBe(3);
      // union of batched IDs == outlier pool IDs (nothing lost or duplicated)
      const pooled = new Set(out.outlierPool.map((c: { id: string }) => c.id));
      const batched = new Set(out.outlierBatches.flat());
      expect(batched.size).toBe(pooled.size);
      for (const id of batched) expect(pooled.has(id)).toBe(true);
      // no batch exceeds the size cap
      for (const b of out.outlierBatches) expect(b.length).toBeLessThanOrEqual(40);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("outlierBatches stays null exactly at the threshold (60)", () => {
    dir = freshDir();
    try {
      const inputPath = writeRawData(dir, 60); // not > 60
      runPreprocess(inputPath);
      const out = JSON.parse(readFileSync(join(dir, "02-filtered.json"), "utf-8"));
      expect(out.outlierBatches).toBeNull();
      expect(out.meta.batched).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
