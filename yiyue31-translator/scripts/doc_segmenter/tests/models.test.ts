/**
 * Unit tests for models.ts.
 *
 * Tests SplitError, Chunk defaults, SplitContext defaults.
 * Ported from test_models.py (13 tests).
 */

import { describe, test, expect } from "bun:test";
import { SplitError, createChunk, createSplitContext, type SourceFileInfo } from "../src/models";

describe("SplitError", () => {
  test("exitCode=1 stores correctly", () => {
    const err = new SplitError("file not found", 1);
    expect(err.exitCode).toBe(1);
    expect(err.message).toBe("file not found");
  });

  test("exitCode=2 stores correctly", () => {
    const err = new SplitError("file too large", 2);
    expect(err.exitCode).toBe(2);
  });

  test("exitCode=3 stores correctly", () => {
    const err = new SplitError("validation failed", 3);
    expect(err.exitCode).toBe(3);
  });

  test("is catchable as Error", () => {
    const err = new SplitError("msg", 1);
    expect(err).toBeInstanceOf(Error);
    expect(() => { throw err; }).toThrow(SplitError);
  });
});

describe("ChunkDefaults", () => {
  test("isMerged defaults to false", () => {
    const chunk = createChunk({
      sourceSection: "Test",
      level: 1,
      content: "x",
      sizeKb: 0.001,
      lineCount: 1,
      startLine: 0,
      endLine: 0,
    });
    expect(chunk.isMerged).toBe(false);
  });

  test("mergedSections defaults to empty array", () => {
    const chunk = createChunk({
      sourceSection: "Test",
      level: 1,
      content: "x",
      sizeKb: 0.001,
      lineCount: 1,
      startLine: 0,
      endLine: 0,
    });
    expect(chunk.mergedSections).toEqual([]);
  });

  test("estimatedTokens defaults to 0", () => {
    const chunk = createChunk({
      sourceSection: "Test",
      level: 1,
      content: "x",
      sizeKb: 0.001,
      lineCount: 1,
      startLine: 0,
      endLine: 0,
    });
    expect(chunk.estimatedTokens).toBe(0);
  });
});

describe("SplitContextDefaults", () => {
  const sourceInfo: SourceFileInfo = {
    filePath: "f",
    fileSize: 1.0,
    fileLines: 1,
    fileChars: 1,
    fileEncoding: "utf-8",
  };

  test("sections defaults to empty array", () => {
    const ctx = createSplitContext({ sourceInfo });
    expect(ctx.sections).toEqual([]);
  });

  test("chunks defaults to empty array", () => {
    const ctx = createSplitContext({ sourceInfo });
    expect(ctx.chunks).toEqual([]);
  });

  test("operations defaults to empty array", () => {
    const ctx = createSplitContext({ sourceInfo });
    expect(ctx.operations).toEqual([]);
  });

  test("validationResults defaults to empty object", () => {
    const ctx = createSplitContext({ sourceInfo });
    expect(ctx.validationResults).toEqual({});
  });

  test("outputDir defaults to empty string", () => {
    const ctx = createSplitContext({ sourceInfo });
    expect(ctx.outputDir).toBe("");
  });
});

describe("SplitErrorMinimalChunk", () => {
  test("chunk with content='x' has correct defaults", () => {
    const chunk = createChunk({
      sourceSection: "S",
      level: 1,
      content: "x",
      sizeKb: 0.001,
      lineCount: 1,
      startLine: 0,
      endLine: 0,
    });
    expect(chunk.isMerged).toBe(false);
    expect(chunk.mergedSections).toEqual([]);
    expect(chunk.estimatedTokens).toBe(0);
  });
});
