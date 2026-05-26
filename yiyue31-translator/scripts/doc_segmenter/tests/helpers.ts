/**
 * Shared test helpers and fixtures.
 *
 * Ported from conftest.py. Provides reusable helpers for creating markdown
 * files, Section objects, SourceFileInfo objects, and other test infrastructure.
 */

import { writeFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { type Section, type SourceFileInfo, type Chunk } from "../src/models";
import { calcSizeKb } from "../src/utils";

/**
 * Create a small markdown file (~5KB) that triggers short-circuit.
 */
export function createSmallMarkdown(tmpDir: string, filename: string = "small-test.md"): string {
  const lines: string[] = ["# Small Test File", ""];
  for (let i = 0; i < 50; i++) {
    lines.push(`## Section ${i + 1}`);
    lines.push("");
    lines.push(`Paragraph content for section ${i + 1}. `.repeat(8));
    lines.push("");
  }
  const filePath = join(tmpDir, filename);
  writeFileSync(filePath, lines.join("\n"), "utf-8");
  return filePath;
}

/**
 * Create a large markdown file (~50KB) that goes through normal splitting.
 */
export function createLargeMarkdown(tmpDir: string, filename: string = "large-test.md"): string {
  const lines: string[] = ["# Large Test File", ""];
  for (let i = 0; i < 8; i++) {
    lines.push(`## Major Section ${i + 1}`);
    lines.push("");
    for (let j = 0; j < 10; j++) {
      lines.push(`### Subsection ${j + 1}`);
      lines.push("");
      lines.push(`Detailed content for subsection ${j + 1} of section ${i + 1}. `.repeat(50));
      lines.push("");
    }
  }
  const filePath = join(tmpDir, filename);
  writeFileSync(filePath, lines.join("\n"), "utf-8");
  return filePath;
}

/**
 * Create a markdown file close to the max_size boundary.
 */
export function createBoundaryMarkdown(tmpDir: string, targetKb: number = 40, filename: string = "boundary-test.md"): string {
  const lines: string[] = ["# Boundary Test File", ""];
  for (let i = 0; i < 4; i++) {
    lines.push(`## Section ${i + 1}`);
    lines.push("");
    lines.push(`Content for section ${i + 1}. `.repeat(350));
    lines.push("");
  }
  const filePath = join(tmpDir, filename);
  writeFileSync(filePath, lines.join("\n"), "utf-8");
  return filePath;
}

/**
 * Create a Section object with computed sizeKb.
 */
export function makeSection(content: string = "hello\nworld", level: number = 1, title: string = "Test"): Section {
  return {
    level,
    title,
    content,
    sizeKb: calcSizeKb(content),
    startLine: 0,
    endLine: content.split("\n").length - 1,
  };
}

/**
 * Create a SourceFileInfo object with defaults.
 */
export function makeSourceInfo(
  filePath: string = "/tmp/f.md",
  fileLines: number = 10,
  fileChars: number = 100
): SourceFileInfo {
  return {
    filePath,
    fileSize: 0.0,
    fileLines,
    fileChars,
    fileEncoding: "utf-8",
  };
}

/**
 * Create a Chunk object with computed sizeKb and lineCount.
 */
export function makeChunk(params: {
  sourceSection?: string;
  level?: number;
  content?: string;
  sizeKb?: number;
  lineCount?: number;
  startLine?: number;
  endLine?: number;
  isMerged?: boolean;
  mergedSections?: string[];
  estimatedTokens?: number;
}): Chunk {
  const content = params.content ?? "test content";
  const computedSizeKb = params.sizeKb ?? calcSizeKb(content);
  const computedLineCount = params.lineCount ?? content.split("\n").length;
  return {
    sourceSection: params.sourceSection ?? "Test",
    level: params.level ?? 1,
    content,
    sizeKb: computedSizeKb,
    lineCount: computedLineCount,
    startLine: params.startLine ?? 0,
    endLine: params.endLine ?? Math.max(0, computedLineCount - 1),
    isMerged: params.isMerged ?? false,
    mergedSections: params.mergedSections ?? [],
    estimatedTokens: params.estimatedTokens ?? 0,
  };
}

/**
 * Write lines as a markdown file and return the path string.
 */
export function createMarkdown(lines: string[], tmpDir: string, filename: string): string {
  const filePath = join(tmpDir, filename);
  writeFileSync(filePath, lines.join("\n"), "utf-8");
  return filePath;
}

/**
 * Create a temporary directory for tests.
 */
export function createTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "doc-seg-test-"));
  return dir;
}

/**
 * Remove a temporary directory.
 */
export function cleanupTempDir(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
}
