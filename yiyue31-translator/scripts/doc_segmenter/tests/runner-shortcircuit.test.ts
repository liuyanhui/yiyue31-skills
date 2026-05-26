/**
 * Tests for short-circuit behavior in SplitRunnerImpl.
 *
 * Ported from test_runner_shortcircuit.py (9 tests).
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { SplitRunnerImpl } from "../src/runner";
import { createSmallMarkdown, createLargeMarkdown, createBoundaryMarkdown } from "./helpers";
import { readdirSync, readFileSync, statSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";

let tmpDir: string;

beforeEach(() => {
  tmpDir = join("D:/tmp", `runner-test-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

function getChunkFiles(dir: string): string[] {
  return readdirSync(dir)
    .filter(f => f.startsWith("chunk-") && f.endsWith(".md"))
    .sort();
}

describe("TestSmallFileShortCircuit", () => {
  test("small file single chunk", () => {
    const runner = new SplitRunnerImpl();
    const smallFile = createSmallMarkdown(tmpDir, "s.md");
    const outputDir = join(tmpDir, "output_small");
    const result = runner.run(smallFile, outputDir, 40.0);
    expect(result).toBe(0);
    const chunkFiles = getChunkFiles(outputDir);
    expect(chunkFiles.length).toBe(1);
    expect(statSync(join(outputDir, chunkFiles[0])).size).toBeGreaterThan(0);
  });

  test("single chunk content integrity", () => {
    const runner = new SplitRunnerImpl();
    const smallFile = createSmallMarkdown(tmpDir, "s.md");
    const outputDir = join(tmpDir, "output_integrity");
    const originalContent = readFileSync(smallFile, "utf-8");
    const result = runner.run(smallFile, outputDir, 40.0);
    expect(result).toBe(0);
    const chunkFiles = getChunkFiles(outputDir);
    expect(chunkFiles.length).toBe(1);
    const chunkContent = readFileSync(join(outputDir, chunkFiles[0]), "utf-8");
    expect(chunkContent).toBe(originalContent);
  });

  test("small file output structure", () => {
    const runner = new SplitRunnerImpl();
    const smallFile = createSmallMarkdown(tmpDir, "s.md");
    const outputDir = join(tmpDir, "output_structure");
    const result = runner.run(smallFile, outputDir, 40.0);
    expect(result).toBe(0);
    const outputFiles = new Set(readdirSync(outputDir));
    expect(outputFiles.has("manifest.md")).toBe(true);
    expect(outputFiles.has("progress.json")).toBe(true);
    expect(outputFiles.has("report.md")).toBe(true);
    const chunkFiles = [...outputFiles].filter(f => f.startsWith("chunk-") && f.endsWith(".md"));
    expect(chunkFiles.length).toBe(1);
  });
});

describe("TestLargeFileNormalPath", () => {
  test("large file multiple chunks", () => {
    const runner = new SplitRunnerImpl();
    const largeFile = createLargeMarkdown(tmpDir, "l.md");
    const outputDir = join(tmpDir, "output_large");
    const result = runner.run(largeFile, outputDir, 40.0);
    expect(result).toBe(0);
    const chunkFiles = getChunkFiles(outputDir);
    expect(chunkFiles.length).toBeGreaterThan(1);
    for (const cf of chunkFiles) {
      expect(statSync(join(outputDir, cf)).size).toBeGreaterThan(0);
    }
  });
});

describe("TestBoundaryCondition", () => {
  test("boundary goes through normal splitting", () => {
    const runner = new SplitRunnerImpl();
    const boundaryFile = createBoundaryMarkdown(tmpDir);
    const fileSizeKb = statSync(boundaryFile).size / 1024;
    const outputDir = join(tmpDir, "output_boundary");
    const result = runner.run(boundaryFile, outputDir, fileSizeKb);
    expect(result).toBe(0);
    const chunkFiles = getChunkFiles(outputDir);
    expect(chunkFiles.length).toBeGreaterThanOrEqual(1);
  });
});

describe("TestProgressJsonMetadata", () => {
  test("progress.json has metadata fields", () => {
    const runner = new SplitRunnerImpl();
    const smallFile = createSmallMarkdown(tmpDir, "s.md");
    const outputDir = join(tmpDir, "output_progress");
    const result = runner.run(smallFile, outputDir, 40.0);
    expect(result).toBe(0);
    const progress = JSON.parse(readFileSync(join(outputDir, "progress.json"), "utf-8"));
    expect("source_size_kb" in progress).toBe(true);
    expect("threshold_kb" in progress).toBe(true);
    expect(progress.threshold_kb).toBe(40.0);
    expect(progress.total_chunks).toBe(1);
  });

  test("progress.json metadata large file", () => {
    const runner = new SplitRunnerImpl();
    const largeFile = createLargeMarkdown(tmpDir, "l.md");
    const outputDir = join(tmpDir, "output_progress_large");
    const result = runner.run(largeFile, outputDir, 40.0);
    expect(result).toBe(0);
    const progress = JSON.parse(readFileSync(join(outputDir, "progress.json"), "utf-8"));
    expect("source_size_kb" in progress).toBe(true);
    expect("threshold_kb" in progress).toBe(true);
    expect(progress.threshold_kb).toBe(40.0);
    expect(progress.total_chunks).toBeGreaterThan(1);
  });

  test("progress.json preserves existing fields", () => {
    const runner = new SplitRunnerImpl();
    const smallFile = createSmallMarkdown(tmpDir, "s.md");
    const outputDir = join(tmpDir, "output_fields");
    const result = runner.run(smallFile, outputDir, 40.0);
    expect(result).toBe(0);
    const progress = JSON.parse(readFileSync(join(outputDir, "progress.json"), "utf-8"));
    expect("source_file" in progress).toBe(true);
    expect("total_chunks" in progress).toBe(true);
    expect("completed" in progress).toBe(true);
    expect("in_progress" in progress).toBe(true);
    expect("pending" in progress).toBe(true);
  });
});

describe("TestOutputStructureConsistency", () => {
  test("both paths produce same file types", () => {
    const runner = new SplitRunnerImpl();
    const smallFile = createSmallMarkdown(tmpDir, "s.md");
    const largeFile = createLargeMarkdown(tmpDir, "l.md");
    const smallOut = join(tmpDir, "out_s");
    const largeOut = join(tmpDir, "out_l");
    runner.run(smallFile, smallOut, 40.0);
    runner.run(largeFile, largeOut, 40.0);
    const smallFiles = new Set(readdirSync(smallOut).filter(f => !f.startsWith("chunk-")));
    const largeFiles = new Set(readdirSync(largeOut).filter(f => !f.startsWith("chunk-")));
    expect(smallFiles).toEqual(largeFiles);
    expect(smallFiles.has("manifest.md")).toBe(true);
    expect(smallFiles.has("progress.json")).toBe(true);
    expect(smallFiles.has("report.md")).toBe(true);
  });
});
