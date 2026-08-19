import { test, expect, describe } from "bun:test";
import { spawn } from "child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { validateUnifiedStructure } from "./helpers";

const TIMEOUT_MS = 60000;

// Use a stable, low-comment-count HN post for testing
// HN post 8863 is one of the oldest posts on the site
const TEST_POST_ID = "8863";
const TMP_OUT = join(import.meta.dir, "__tmp_fetchers__", "out.json");

function runFetcher(scriptPath: string, postId: string, args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
  return new Promise((resolve) => {
    const proc = spawn("bun", [scriptPath, postId, ...args], {
      cwd: import.meta.dir + "/../..",
    });

    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });
    proc.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });
    proc.on("close", (code) => {
      resolve({ stdout, stderr, exitCode: code });
    });
    proc.on("error", (err) => {
      resolve({ stdout, stderr: err.message, exitCode: -1 });
    });
  });
}

describe.skip("Fetcher Integration Tests (network required)", () => {
  describe("Algolia fetcher", () => {
    test(
      "should write valid unified JSON to --out with a one-line stdout summary",
      async () => {
        const result = await runFetcher("scripts/algolia.ts", TEST_POST_ID, ["--out", TMP_OUT]);

        expect(result.exitCode).toBe(0);

        // stdout: exactly one JSON summary line (title/counts/out path).
        expect(result.stdout.trim().split("\n")).toHaveLength(1);
        const summary = JSON.parse(result.stdout.trim());
        expect(summary.source).toBe("algolia");
        expect(summary.truncated).toBe(false);

        // File: valid unified structure.
        const data = JSON.parse(readFileSync(TMP_OUT, "utf-8"));
        const validation = validateUnifiedStructure(data);
        expect(validation.valid).toBe(true);

        expect(data.source).toBe("algolia");
        expect(data.comments.length).toBeGreaterThan(0);

        // Verify childIds are populated for at least some comments
        const commentsWithChildren = data.comments.filter(
          (c: { childIds: string[] }) => c.childIds.length > 0
        );
        expect(commentsWithChildren.length).toBeGreaterThan(0);
      },
      TIMEOUT_MS
    );
  });

  describe("Firebase fetcher", () => {
    test(
      "should write valid unified JSON to --out with a one-line stdout summary",
      async () => {
        const result = await runFetcher("scripts/firebase.ts", TEST_POST_ID, ["--out", TMP_OUT]);

        expect(result.exitCode).toBe(0);

        expect(result.stdout.trim().split("\n")).toHaveLength(1);
        const summary = JSON.parse(result.stdout.trim());
        expect(summary.source).toBe("firebase");

        const data = JSON.parse(readFileSync(TMP_OUT, "utf-8"));
        const validation = validateUnifiedStructure(data);
        expect(validation.valid).toBe(true);

        expect(data.source).toBe("firebase");
        expect(data.comments.length).toBeGreaterThan(0);

        // Verify childIds are populated
        const commentsWithChildren = data.comments.filter(
          (c: { childIds: string[] }) => c.childIds.length > 0
        );
        expect(commentsWithChildren.length).toBeGreaterThan(0);

        // Verify meta field
        expect(data.meta).toBeDefined();
        expect(typeof data.meta.totalFetched).toBe("number");
        expect(typeof data.meta.skippedDeleted).toBe("number");
        expect(typeof data.meta.skippedDead).toBe("number");
        expect(typeof data.meta.maxDepthReached).toBe("boolean");
      },
      TIMEOUT_MS
    );
  });
});
