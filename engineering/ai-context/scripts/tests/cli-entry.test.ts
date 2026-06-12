/**
 * Tests for the CLI entry point (src/cli.ts).
 *
 * Covers:
 * 1. Successful run with valid target dir → exit code 0
 * 2. Validation failure (non-existent target) → exit code 1
 * 3. Missing --target → exit code 1
 * 4. --help → prints usage to stdout, exit code 0
 * 5. -h short form → prints usage, exit code 0
 */

import { run } from "../src/cli";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const START_MARKER = "<!-- skill: ai-context -->";
const END_MARKER = "<!-- /ai-context -->";

/**
 * Create a temporary directory with a valid CLAUDE.md file.
 * Returns the temp directory path for cleanup.
 */
function createValidTargetDir(): string {
  const base = mkdtempSync(join(tmpdir(), "ai-ctx-test-"));
  const content = [
    "# Project",
    START_MARKER,
    "Some valid AI context content that is long enough.",
    END_MARKER,
  ].join("\n");
  writeFileSync(join(base, "CLAUDE.md"), content, "utf-8");
  return base;
}

// Collect temp dirs for cleanup
const tempDirs: string[] = [];

afterAll(() => {
  for (const d of tempDirs) {
    try {
      rmSync(d, { recursive: true, force: true });
    } catch {
      // ignore cleanup failures
    }
  }
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CLI entry point (run)", () => {
  // ----- Test 1: Successful run with valid target dir -----
  it("returns exit code 0 for a valid target directory with proper CLAUDE.md", async () => {
    const targetDir = createValidTargetDir();
    tempDirs.push(targetDir);

    const exitCode = await run(["--target", targetDir]);

    expect(exitCode).toBe(0);
  });

  // ----- Test 2: Validation failure (non-existent target) -----
  it("returns exit code 1 when target directory does not exist", async () => {
    const exitCode = await run([
      "--target",
      "/nonexistent/path/that/does/not/exist",
    ]);

    expect(exitCode).toBe(1);
  });

  // ----- Test 3: Missing --target -----
  it("returns exit code 1 when --target is not provided", async () => {
    const exitCode = await run([]);

    expect(exitCode).toBe(1);
  });

  // ----- Test 4: --help -----
  it("prints usage to stdout and returns exit code 0 with --help", async () => {
    const stdoutSpy = jest
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);

    const exitCode = await run(["--help"]);

    expect(exitCode).toBe(0);
    expect(stdoutSpy).toHaveBeenCalledWith(
      expect.stringContaining("Usage: ai-context-checker"),
    );

    stdoutSpy.mockRestore();
  });

  // ----- Test 5: -h short form -----
  it("prints usage to stdout and returns exit code 0 with -h", async () => {
    const stdoutSpy = jest
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);

    const exitCode = await run(["-h"]);

    expect(exitCode).toBe(0);
    expect(stdoutSpy).toHaveBeenCalledWith(
      expect.stringContaining("Usage: ai-context-checker"),
    );

    stdoutSpy.mockRestore();
  });

  // ----- Additional edge case: --help takes precedence over --target -----
  it("prints usage even when --target is also provided", async () => {
    const stdoutSpy = jest
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);

    const exitCode = await run(["--target", "/some/path", "--help"]);

    expect(exitCode).toBe(0);
    expect(stdoutSpy).toHaveBeenCalledWith(
      expect.stringContaining("Usage: ai-context-checker"),
    );

    stdoutSpy.mockRestore();
  });

  // ----- Config file error: non-existent config -----
  it("returns exit code 1 when config file does not exist", async () => {
    const targetDir = createValidTargetDir();
    tempDirs.push(targetDir);

    const stderrSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const exitCode = await run([
      "--target",
      targetDir,
      "--config",
      "/nonexistent/config.json",
    ]);

    expect(exitCode).toBe(1);
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining("Config file not found"),
    );

    stderrSpy.mockRestore();
  });

  // ----- Config file error: invalid JSON -----
  it("returns exit code 1 when config file has invalid JSON", async () => {
    const targetDir = createValidTargetDir();
    tempDirs.push(targetDir);

    // Create a temp config file with invalid JSON
    const configDir = mkdtempSync(join(tmpdir(), "ai-ctx-cfg-"));
    tempDirs.push(configDir);
    const configPath = join(configDir, "bad.json");
    writeFileSync(configPath, "{ invalid json !!!", "utf-8");

    const stderrSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const exitCode = await run([
      "--target",
      targetDir,
      "--config",
      configPath,
    ]);

    expect(exitCode).toBe(1);
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining("Failed to parse config file"),
    );

    stderrSpy.mockRestore();
  });

  // ----- Missing target prints error to stderr -----
  it("prints error to stderr when --target is missing", async () => {
    const stderrSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const exitCode = await run([]);

    expect(exitCode).toBe(1);
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining("Missing required argument"),
    );

    stderrSpy.mockRestore();
  });

  // ----- Non-existent target prints validation error -----
  it("prints validation error to stderr for non-existent target", async () => {
    const stderrSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const exitCode = await run([
      "--target",
      "/nonexistent/path/that/does/not/exist",
    ]);

    expect(exitCode).toBe(1);
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining("Target path does not exist"),
    );

    stderrSpy.mockRestore();
  });
});
