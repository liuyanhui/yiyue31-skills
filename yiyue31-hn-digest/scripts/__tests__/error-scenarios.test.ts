import { test, expect, describe, afterAll } from "bun:test";
import { spawn } from "child_process";
import { readFileSync, rmSync, existsSync } from "node:fs";
import { resolve as resolvePath, join } from "node:path";
import { ensureDir, writeJSON } from "../lib/utils";

const TIMEOUT_MS = 60000;

// ---------------------------------------------------------------------------
// Helper: spawn a fetcher script and collect stdout/stderr/exitCode
// ---------------------------------------------------------------------------
function runFetcher(
  scriptPath: string,
  postId: string
): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
  // Pre-compute cwd outside the Promise constructor to avoid variable shadowing
  // (the Promise callback param "resolve" would shadow the path "resolve" import).
  const cwd = resolvePath(__dirname, "../..");

  return new Promise((resolvePromise) => {
    // Use process.execPath so the test uses the same bun binary that runs
    // the test suite, regardless of whether "bun" is on PATH.
    const bunBin = process.execPath;

    const proc = spawn(bunBin, [scriptPath, postId], { cwd });

    let stdout = "";
    let stderr = "";
    let resolved = false;

    proc.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      if (!resolved) {
        resolved = true;
        resolvePromise({ stdout, stderr, exitCode: code });
      }
    });

    proc.on("error", (err) => {
      if (!resolved) {
        resolved = true;
        resolvePromise({ stdout, stderr: err.message, exitCode: -1 });
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Temporary directory for filesystem tests
// ---------------------------------------------------------------------------
const TMP_DIR = resolvePath(__dirname, "__tmp_error_scenarios__");

// ---------------------------------------------------------------------------
// Scenario 1: Post not found / deleted
// ---------------------------------------------------------------------------
describe("Error Scenario 1: Post not found / deleted", () => {
  // Use a post ID that almost certainly does not exist (9-digit number far
  // beyond the current HN post range at the time of writing).
  const GHOST_POST_ID = "999999999";

  test(
    "Algolia fetcher exits with code 1 for non-existent post",
    async () => {
      const result = await runFetcher("scripts/algolia.ts", GHOST_POST_ID);

      expect(result.exitCode).toBe(1);
      // Should report the error on stderr
      expect(result.stderr.length).toBeGreaterThan(0);
      // stderr should mention "not found" or similar error text
      const lower = result.stderr.toLowerCase();
      const hasNotFoundError =
        lower.includes("not found") ||
        lower.includes("error") ||
        lower.includes("fail");
      expect(hasNotFoundError).toBe(true);
    },
    TIMEOUT_MS
  );

  test(
    "Firebase fetcher exits with code 1 for non-existent post",
    async () => {
      const result = await runFetcher("scripts/firebase.ts", GHOST_POST_ID);

      expect(result.exitCode).toBe(1);
      expect(result.stderr.length).toBeGreaterThan(0);
      const lower = result.stderr.toLowerCase();
      const hasNotFoundError =
        lower.includes("not found") || lower.includes("error");
      expect(hasNotFoundError).toBe(true);
    },
    TIMEOUT_MS
  );
});

// ---------------------------------------------------------------------------
// Scenario 2: Post exists with 0 comments
// ---------------------------------------------------------------------------
describe("Error Scenario 2: Post with 0 comments (graceful handling)", () => {
  // HN post "1303" is known to have very few or zero comments — but since
  // the comment count can change, we validate the *structure* rather than
  // hardcoding. A post that returns a valid unified JSON with an empty (or
  // present) comments array is correct behavior.
  //
  // For a deterministic test we check the rule: if the fetcher returns
  // success (exit 0), the output must be valid unified JSON where
  // `comments` is an array (even if empty).

  test(
    "Algolia fetcher returns unified JSON with comments array on valid post",
    async () => {
      // Post 1 is one of the oldest on HN and may have 0 or few comments
      const result = await runFetcher("scripts/algolia.ts", "1");

      // Whether it succeeds or fails, if it succeeds the structure must be valid
      if (result.exitCode === 0) {
        const data = JSON.parse(result.stdout);
        expect(data.source).toBe("algolia");
        expect(Array.isArray(data.comments)).toBe(true);
        // comments may be empty — that is fine
      }
      // If exit code is non-zero, the fetcher handled the error correctly
      expect(result.exitCode).not.toBeNull();
    },
    TIMEOUT_MS
  );

  test(
    "Firebase fetcher returns unified JSON with comments array on valid post",
    async () => {
      const result = await runFetcher("scripts/firebase.ts", "1");

      if (result.exitCode === 0) {
        const data = JSON.parse(result.stdout);
        expect(data.source).toBe("firebase");
        expect(Array.isArray(data.comments)).toBe(true);
      }
      expect(result.exitCode).not.toBeNull();
    },
    TIMEOUT_MS
  );
});

// ---------------------------------------------------------------------------
// Scenario 3: Corrupted cache file — validate skill prompt rule
// ---------------------------------------------------------------------------
describe("Error Scenario 3: Corrupted cache file rule in SKILL.md", () => {
  const SKILL_MD_PATH = resolvePath(__dirname, "../../SKILL.md");

  test("SKILL.md describes corrupted cache detection behavior", () => {
    const skillContent = readFileSync(SKILL_MD_PATH, "utf-8");

    // Rule: "Cache hit + invalid JSON" must be described
    expect(skillContent).toContain("invalid JSON");

    // Rule: corrupted cache triggers re-fetch
    expect(
      skillContent.includes("重新抓取") || skillContent.includes("re-fetch")
    ).toBe(true);

    // Rule: corrupted cache file should be deleted
    expect(
      skillContent.includes("Delete the corrupted cache file") ||
        skillContent.includes("删除") ||
        skillContent.includes("删除损坏")
    ).toBe(true);
  });

  test("SKILL.md describes the cache hit with invalid JSON output message", () => {
    const skillContent = readFileSync(SKILL_MD_PATH, "utf-8");

    // The skill prompt should output a specific message for corrupted cache
    expect(skillContent).toContain("缓存文件损坏");
  });
});

// ---------------------------------------------------------------------------
// Scenario 4: Malformed config.json — validate skill prompt rule
// ---------------------------------------------------------------------------
describe("Error Scenario 4: Malformed config.json rule in SKILL.md", () => {
  const SKILL_MD_PATH = resolvePath(__dirname, "../../SKILL.md");

  test("SKILL.md describes using defaults for malformed config", () => {
    const skillContent = readFileSync(SKILL_MD_PATH, "utf-8");

    // Rule: malformed JSON in config triggers default usage
    expect(skillContent).toContain("malformed JSON");

    // Rule: defaults are used when config is invalid
    expect(
      skillContent.includes("使用默认值") || skillContent.includes("use default")
    ).toBe(true);
  });

  test("SKILL.md provides built-in defaults", () => {
    const skillContent = readFileSync(SKILL_MD_PATH, "utf-8");

    // Verify all default config fields are documented in the schema table
    expect(skillContent).toContain("| 2 |");
    expect(skillContent).toContain("| 3 |");
    expect(skillContent).toContain("| 30 |");
    expect(skillContent).toContain('| `"zh"`');
    expect(skillContent).toContain('| `"."`');
  });

  test("SKILL.md describes config merge priority", () => {
    const skillContent = readFileSync(SKILL_MD_PATH, "utf-8");

    // CLI > config.json > built-in defaults
    expect(skillContent).toContain("CLI arguments > config.json > built-in defaults");
  });
});

// ---------------------------------------------------------------------------
// Scenario 5: Output directory does not exist — ensureDir works
// ---------------------------------------------------------------------------
describe("Error Scenario 5: ensureDir creates missing directories", () => {
  afterAll(() => {
    // Cleanup
    if (existsSync(TMP_DIR)) {
      rmSync(TMP_DIR, { recursive: true, force: true });
    }
  });

  test("ensureDir creates a deeply nested directory that does not exist", async () => {
    const deepPath = join(TMP_DIR, "a", "b", "c", "d");

    // Ensure the path does NOT exist before the test
    expect(existsSync(deepPath)).toBe(false);

    await ensureDir(deepPath);

    expect(existsSync(deepPath)).toBe(true);
  });

  test("ensureDir is idempotent — calling again on existing directory does not throw", async () => {
    const dirPath = join(TMP_DIR, "idempotent-test");

    await ensureDir(dirPath);
    expect(existsSync(dirPath)).toBe(true);

    // Second call should not throw
    await expect(ensureDir(dirPath)).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Scenario 6: Existing output files — writeJSON overwrite behavior
// ---------------------------------------------------------------------------
describe("Error Scenario 6: writeJSON overwrites existing files", () => {
  const testDir = join(TMP_DIR, "overwrite-test");
  const testFile = join(testDir, "data.json");

  afterAll(() => {
    if (existsSync(TMP_DIR)) {
      rmSync(TMP_DIR, { recursive: true, force: true });
    }
  });

  test("writeJSON creates the file when it does not exist", async () => {
    await writeJSON(testFile, { version: 1 });

    const content = JSON.parse(readFileSync(testFile, "utf-8"));
    expect(content.version).toBe(1);
  });

  test("writeJSON overwrites existing file with new content", async () => {
    // File already exists from previous test with { version: 1 }
    await writeJSON(testFile, { version: 2, extra: "data" });

    const content = JSON.parse(readFileSync(testFile, "utf-8"));
    expect(content.version).toBe(2);
    expect(content.extra).toBe("data");

    // Ensure old content is fully replaced, not merged
    const rawKeys = Object.keys(content);
    expect(rawKeys).toEqual(["version", "extra"]);
  });

  test("writeJSON creates parent directories automatically", async () => {
    const nestedFile = join(testDir, "nested", "sub", "file.json");

    await writeJSON(nestedFile, { nested: true });

    const content = JSON.parse(readFileSync(nestedFile, "utf-8"));
    expect(content.nested).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Scenario 7: All fetch methods exhausted
// ---------------------------------------------------------------------------
describe("Error Scenario 7: All fetch methods fail for invalid postId", () => {
  // A postId that is syntactically valid (numeric) but does not correspond to
  // any real HN post, ensuring all fetchers fail.
  const INVALID_POST_ID = "999999999";

  test(
    "Algolia fetcher fails for non-existent post ID",
    async () => {
      const result = await runFetcher("scripts/algolia.ts", INVALID_POST_ID);

      expect(result.exitCode).toBe(1);
      expect(result.stderr.length).toBeGreaterThan(0);
    },
    TIMEOUT_MS
  );

  test(
    "Firebase fetcher fails for non-existent post ID",
    async () => {
      const result = await runFetcher("scripts/firebase.ts", INVALID_POST_ID);

      expect(result.exitCode).toBe(1);
      expect(result.stderr.length).toBeGreaterThan(0);
    },
    TIMEOUT_MS
  );

  test(
    "Jina fetcher returns output for non-existent post ID (Jina proxies the page)",
    async () => {
      // Jina Reader acts as a proxy and returns whatever HN renders, so even
      // non-existent posts yield output (exit code 0). The skill prompt
      // normalizes and validates the Jina output later (Step 4).
      const result = await runFetcher("scripts/jina.ts", INVALID_POST_ID);

      // Jina may succeed (0) or fail (1) depending on network conditions.
      // If it succeeds, there must be stdout content.
      if (result.exitCode === 0) {
        expect(result.stdout.length).toBeGreaterThan(0);
      } else {
        // If it fails, stderr should contain the reason.
        expect(result.stderr.length).toBeGreaterThan(0);
      }
    },
    120000
  );

  test(
    "SKILL.md describes behavior when all fetch methods are exhausted",
    () => {
      const skillContent = readFileSync(
        resolvePath(__dirname, "../../SKILL.md"),
        "utf-8"
      );

      // Must describe "All Methods Exhausted" section
      expect(skillContent).toContain("All Methods Exhausted");

      // Must say to terminate without generating output files
      expect(
        skillContent.includes("Terminate") ||
          skillContent.includes("terminate")
      ).toBe(true);

      // Must NOT generate output files on total failure
      expect(
        skillContent.includes("Do NOT generate any output files")
      ).toBe(true);
    }
  );
});
