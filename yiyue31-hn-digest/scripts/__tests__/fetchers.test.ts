import { test, expect, describe } from "bun:test";
import { spawn } from "child_process";
import { validateUnifiedStructure } from "./helpers";

const TIMEOUT_MS = 60000;

// Use a stable, low-comment-count HN post for testing
// HN post 1 is one of the oldest posts on the site
const TEST_POST_ID = "8863";

function runFetcher(scriptPath: string, postId: string): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
  return new Promise((resolve) => {
    const proc = spawn("bun", [scriptPath, postId], {
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
      "should return valid unified JSON with non-empty comments",
      async () => {
        const result = await runFetcher("scripts/algolia.ts", TEST_POST_ID);

        expect(result.exitCode).toBe(0);

        const data = JSON.parse(result.stdout);
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
      "should return valid unified JSON with recursive fetch",
      async () => {
        const result = await runFetcher("scripts/firebase.ts", TEST_POST_ID);

        expect(result.exitCode).toBe(0);

        const data = JSON.parse(result.stdout);
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

  describe("Jina fetcher", () => {
    test(
      "should return non-empty markdown output",
      async () => {
        const result = await runFetcher("scripts/jina.ts", TEST_POST_ID);

        expect(result.exitCode).toBe(0);
        expect(result.stdout.length).toBeGreaterThan(0);

        // Verify it contains some HN-like content
        const lower = result.stdout.toLowerCase();
        const hasContent =
          lower.includes("hacker") ||
          lower.includes("comment") ||
          lower.includes("point") ||
          lower.includes("test");
        expect(hasContent).toBe(true);
      },
      TIMEOUT_MS
    );
  });
});
