import { test, expect, describe } from "bun:test";
import { spawn } from "child_process";

const TIMEOUT_MS = 60000;
const TEST_POST_ID = "8863";

function runFetcher(
  scriptPath: string,
  postId: string
): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
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

describe.skip("Jina Integration Tests (network required)", () => {
  test(
    "should fetch a real HN post via Jina primary URL and return non-empty markdown",
    async () => {
      const result = await runFetcher("scripts/jina.ts", TEST_POST_ID);

      expect(result.exitCode).toBe(0);
      expect(result.stdout.length).toBeGreaterThan(0);

      // Output should be markdown (plain text from Jina), not JSON error
      const trimmed = result.stdout.trim();
      expect(trimmed.length).toBeGreaterThan(0);

      // Should not contain a JSON error object
      expect(trimmed.startsWith('{')).toBe(false);
    },
    TIMEOUT_MS
  );

  test(
    "should return markdown containing post title or comment-like content",
    async () => {
      const result = await runFetcher("scripts/jina.ts", TEST_POST_ID);

      expect(result.exitCode).toBe(0);
      expect(result.stdout.length).toBeGreaterThan(0);

      const lower = result.stdout.toLowerCase();
      const hasHNContent =
        lower.includes("hacker") ||
        lower.includes("comment") ||
        lower.includes("point") ||
        lower.includes("y combinator") ||
        lower.includes("repl") ||
        lower.includes("test");

      expect(hasHNContent).toBe(true);
    },
    TIMEOUT_MS
  );

  test(
    "should handle fetch gracefully (primary or fallback succeeds)",
    async () => {
      const result = await runFetcher("scripts/jina.ts", TEST_POST_ID);

      // The script should exit 0 whether primary or fallback was used.
      // If primary fails, stderr will mention the fallback attempt.
      // Either way, we expect a successful result.
      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim().length).toBeGreaterThan(0);

      // If primary failed and fallback was used, stderr should mention it
      // but the script should still succeed
      if (result.stderr.includes("Primary Jina URL failed")) {
        expect(result.stderr).toContain("trying fallback");
        // Fallback should have succeeded
        expect(result.exitCode).toBe(0);
      }
    },
    TIMEOUT_MS
  );
});
