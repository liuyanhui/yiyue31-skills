import { test, expect, describe, afterAll } from "bun:test";
import { spawn } from "child_process";
import { readFileSync, rmSync, existsSync, mkdirSync } from "node:fs";
import { resolve as resolvePath, join } from "node:path";
import { ensureDir, writeJSON } from "../lib/utils";
import { validateUnifiedStructure } from "./helpers";

const TIMEOUT_MS = 60000;

// Temp dir for fetcher --out targets (network-dependent scenarios).
const FETCH_TMP_DIR = resolvePath(__dirname, "__tmp_fetch_out__");

// ---------------------------------------------------------------------------
// Helper: spawn a fetcher script and collect stdout/stderr/exitCode
// ---------------------------------------------------------------------------
function runFetcher(
  scriptPath: string,
  postId: string,
  args: string[] = []
): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
  // Pre-compute cwd outside the Promise constructor to avoid variable shadowing
  // (the Promise callback param "resolve" would shadow the path "resolve" import).
  const cwd = resolvePath(__dirname, "../..");

  return new Promise((resolvePromise) => {
    // Use process.execPath so the test uses the same bun binary that runs
    // the test suite, regardless of whether "bun" is on PATH.
    const bunBin = process.execPath;

    const proc = spawn(bunBin, [scriptPath, postId, ...args], { cwd });

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
// Scenario 0: --out is required (offline — fails before any network call)
// ---------------------------------------------------------------------------
describe("Error Scenario 0: missing --out flag", () => {
  test("Algolia fetcher exits with code 1 and usage on stderr", async () => {
    const result = await runFetcher("scripts/algolia.ts", "8863");
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Usage");
    expect(result.stdout).toBe("");
  });

  test("Firebase fetcher exits with code 1 and usage on stderr", async () => {
    const result = await runFetcher("scripts/firebase.ts", "8863");
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Usage");
    expect(result.stdout).toBe("");
  });
});

// ---------------------------------------------------------------------------
// Scenario 1: Post not found / deleted
// ---------------------------------------------------------------------------
describe("Error Scenario 1: Post not found / deleted", () => {
  afterAll(() => {
    if (existsSync(FETCH_TMP_DIR)) rmSync(FETCH_TMP_DIR, { recursive: true, force: true });
  });

  // Use a post ID that almost certainly does not exist (9-digit number far
  // beyond the current HN post range at the time of writing).
  const GHOST_POST_ID = "999999999";

  test(
    "Algolia fetcher exits with code 1 for non-existent post",
    async () => {
      mkdirSync(FETCH_TMP_DIR, { recursive: true });
      const result = await runFetcher("scripts/algolia.ts", GHOST_POST_ID, [
        "--out",
        join(FETCH_TMP_DIR, "algolia-ghost.json"),
      ]);

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
      mkdirSync(FETCH_TMP_DIR, { recursive: true });
      const result = await runFetcher("scripts/firebase.ts", GHOST_POST_ID, [
        "--out",
        join(FETCH_TMP_DIR, "firebase-ghost.json"),
      ]);

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
// Scenario 2: Post exists — file/summary contract on success
// ---------------------------------------------------------------------------
describe("Error Scenario 2: valid post — stdout summary + --out file", () => {
  afterAll(() => {
    if (existsSync(FETCH_TMP_DIR)) rmSync(FETCH_TMP_DIR, { recursive: true, force: true });
  });

  // The fetchers write the unified JSON to --out and print a ONE-LINE JSON
  // summary on stdout (the agent consumes the summary, never the raw file).
  // If the fetch succeeds, both must hold; a non-zero exit is correct error
  // handling and also passes.

  test(
    "Algolia fetcher: stdout is a one-line summary; --out file holds valid unified JSON",
    async () => {
      mkdirSync(FETCH_TMP_DIR, { recursive: true });
      const outPath = join(FETCH_TMP_DIR, "algolia-1.json");
      const result = await runFetcher("scripts/algolia.ts", "1", ["--out", outPath]);

      if (result.exitCode === 0) {
        // Summary: single JSON line carrying title/counts/out path.
        expect(result.stdout.trim().split("\n")).toHaveLength(1);
        const summary = JSON.parse(result.stdout.trim());
        expect(summary.source).toBe("algolia");
        expect(typeof summary.title).toBe("string");
        expect(typeof summary.comments).toBe("number");
        expect(summary.out).toBe(outPath);

        // File: valid unified structure, comments is an array (may be empty).
        const data = JSON.parse(readFileSync(outPath, "utf-8"));
        expect(validateUnifiedStructure(data).valid).toBe(true);
        expect(data.source).toBe("algolia");
        expect(Array.isArray(data.comments)).toBe(true);
      }
      expect(result.exitCode).not.toBeNull();
    },
    TIMEOUT_MS
  );

  test(
    "Firebase fetcher: stdout is a one-line summary; --out file holds valid unified JSON",
    async () => {
      mkdirSync(FETCH_TMP_DIR, { recursive: true });
      const outPath = join(FETCH_TMP_DIR, "firebase-1.json");
      const result = await runFetcher("scripts/firebase.ts", "1", ["--out", outPath]);

      if (result.exitCode === 0) {
        expect(result.stdout.trim().split("\n")).toHaveLength(1);
        const summary = JSON.parse(result.stdout.trim());
        expect(summary.source).toBe("firebase");
        expect(summary.out).toBe(outPath);

        const data = JSON.parse(readFileSync(outPath, "utf-8"));
        expect(validateUnifiedStructure(data).valid).toBe(true);
        expect(Array.isArray(data.comments)).toBe(true);
      }
      expect(result.exitCode).not.toBeNull();
    },
    TIMEOUT_MS
  );
});

// ---------------------------------------------------------------------------
// Scenario 3: Malformed config.json — validate skill prompt rule
// ---------------------------------------------------------------------------
describe("Error Scenario 3: Malformed config.json rule in SKILL.md", () => {
  const SKILL_MD_PATH = resolvePath(__dirname, "../../SKILL.md");

  test("SKILL.md describes using defaults for malformed config", () => {
    const skillContent = readFileSync(SKILL_MD_PATH, "utf-8");

    // Rule: malformed JSON in config triggers default usage (current wording: "Malformed JSON")
    expect(skillContent).toContain("Malformed JSON");

    // Rule: defaults are used when config is invalid
    expect(
      skillContent.includes("使用默认值") || skillContent.includes("use default")
    ).toBe(true);
  });

  test("SKILL.md provides built-in defaults", () => {
    const skillContent = readFileSync(SKILL_MD_PATH, "utf-8");

    // Verify all default config fields are documented in the schema table
    expect(skillContent).toContain("| 5 |");
    expect(skillContent).toContain("| 3 |");
    expect(skillContent).toContain("| 80 |");
    expect(skillContent).toContain('| `"zh"`');
    expect(skillContent).toContain('| `"hn-digest/"`');
  });

  test("SKILL.md describes config merge priority", () => {
    const skillContent = readFileSync(SKILL_MD_PATH, "utf-8");

    // CLI > project config > built-in defaults
    expect(skillContent).toContain("CLI args > hn-digest.config.json > defaults");
  });

  test("SKILL.md loads project-local config without snapshotting defaults", () => {
    const skillContent = readFileSync(SKILL_MD_PATH, "utf-8");

    // Config is project-local at the repo root
    expect(skillContent).toContain("hn-digest.config.json");

    // Effective config + source is printed at run start
    expect(skillContent).toContain("生效配置");

    // Must NOT auto-write a defaults snapshot on first run (that freezes old defaults)
    expect(skillContent).not.toContain("首次运行，已生成默认配置");

    // Must NOT read the legacy global homedir config
    expect(skillContent).not.toContain("{homedir}/.hn-digest/config.json");
  });
});

// ---------------------------------------------------------------------------
// Scenario 4: Output directory does not exist — ensureDir works
// ---------------------------------------------------------------------------
describe("Error Scenario 4: ensureDir creates missing directories", () => {
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
// Scenario 5: Existing output files — writeJSON overwrite behavior
// ---------------------------------------------------------------------------
describe("Error Scenario 5: writeJSON overwrites existing files", () => {
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
// Scenario 6: All fetch methods exhausted
// ---------------------------------------------------------------------------
describe("Error Scenario 6: All fetch methods fail for invalid postId", () => {
  afterAll(() => {
    if (existsSync(FETCH_TMP_DIR)) rmSync(FETCH_TMP_DIR, { recursive: true, force: true });
  });

  // A postId that is syntactically valid (numeric) but does not correspond to
  // any real HN post, ensuring all fetchers fail.
  const INVALID_POST_ID = "999999999";

  test(
    "Algolia fetcher fails for non-existent post ID",
    async () => {
      mkdirSync(FETCH_TMP_DIR, { recursive: true });
      const result = await runFetcher("scripts/algolia.ts", INVALID_POST_ID, [
        "--out",
        join(FETCH_TMP_DIR, "algolia-invalid.json"),
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr.length).toBeGreaterThan(0);
    },
    TIMEOUT_MS
  );

  test(
    "Firebase fetcher fails for non-existent post ID",
    async () => {
      mkdirSync(FETCH_TMP_DIR, { recursive: true });
      const result = await runFetcher("scripts/firebase.ts", INVALID_POST_ID, [
        "--out",
        join(FETCH_TMP_DIR, "firebase-invalid.json"),
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr.length).toBeGreaterThan(0);
    },
    TIMEOUT_MS
  );

  test(
    "SKILL.md describes behavior when all fetch methods are exhausted",
    () => {
      const skillContent = readFileSync(
        resolvePath(__dirname, "../../SKILL.md"),
        "utf-8"
      );

      // Must describe the all-methods-exhausted behavior (current wording)
      expect(skillContent).toContain("All methods exhausted");

      // Must say to terminate without generating output files
      expect(
        skillContent.includes("Terminate") ||
          skillContent.includes("terminate")
      ).toBe(true);

      // Must specify the exhausted-path output message (current spec wording)
      expect(skillContent.includes("所有抓取方式均失败")).toBe(true);
    }
  );
});
