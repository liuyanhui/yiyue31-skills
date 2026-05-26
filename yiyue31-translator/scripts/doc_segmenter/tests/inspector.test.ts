/**
 * Unit tests for inspector.ts.
 *
 * Ported from test_inspector.py (7 tests).
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { FileInspectorImpl } from "../src/inspector";
import { SplitError } from "../src/models";
import { writeFileSync, mkdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

let tmpDir: string;

beforeEach(() => {
  tmpDir = join("D:/tmp", `inspector-test-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("TestFileNotFound", () => {
  test("nonexistent file raises SplitError with exitCode=1", () => {
    const inspector = new FileInspectorImpl();
    expect(() => inspector.inspect("/nonexistent/file.md")).toThrow();
    try {
      inspector.inspect("/nonexistent/file.md");
    } catch (e) {
      expect((e as SplitError).exitCode).toBe(1);
    }
  });
});

describe("TestOversizedFile", () => {
  test("file larger than 5MB raises SplitError with exitCode=2", () => {
    const inspector = new FileInspectorImpl();
    const bigFile = join(tmpDir, "big.md");
    const size = 5 * 1024 * 1024 + 1;
    const buf = Buffer.alloc(size, "x");
    writeFileSync(bigFile, buf);
    try {
      inspector.inspect(bigFile);
      expect.unreachable("Should have thrown");
    } catch (e) {
      expect((e as SplitError).exitCode).toBe(2);
    }
  });
});

describe("TestNormalFileInspection", () => {
  test("UTF-8 file metadata", () => {
    const inspector = new FileInspectorImpl();
    const filePath = join(tmpDir, "test.md");
    const content = "# Hello\nWorld";
    writeFileSync(filePath, content, "utf-8");
    const result = inspector.inspect(filePath);
    expect(result.filePath).toBe(filePath);
    expect(Math.abs(result.fileSize - statSync(filePath).size / 1024.0)).toBeLessThan(0.001);
    expect(result.fileLines).toBe(2);
    expect(result.fileChars).toBe(content.length);
    expect(result.fileEncoding).toBe("utf-8");
  });

  test("CRLF normalization", () => {
    const inspector = new FileInspectorImpl();
    const filePath = join(tmpDir, "crlf.md");
    writeFileSync(filePath, Buffer.from("line1\r\nline2"));
    const result = inspector.inspect(filePath);
    expect(result.fileSize).toBeGreaterThan("line1\nline2".length / 1024);
  });

  test("no trailing newline", () => {
    const inspector = new FileInspectorImpl();
    const filePath = join(tmpDir, "noeol.md");
    writeFileSync(filePath, "line1\nline2", "utf-8");
    const result = inspector.inspect(filePath);
    expect(result.fileLines).toBe(2);
  });

  test("BOM detection", () => {
    const inspector = new FileInspectorImpl();
    const filePath = join(tmpDir, "bom.md");
    writeFileSync(filePath, Buffer.from([0xef, 0xbb, 0xbf, 0x23, 0x20, 0x48, 0x65, 0x6c, 0x6c, 0x6f]));
    const result = inspector.inspect(filePath);
    expect(result.fileEncoding).toBe("utf-8");
  });

  test("empty file", () => {
    const inspector = new FileInspectorImpl();
    const filePath = join(tmpDir, "empty.md");
    writeFileSync(filePath, "", "utf-8");
    const result = inspector.inspect(filePath);
    expect(result.fileLines).toBe(0);
    expect(result.fileChars).toBe(0);
    expect(result.fileSize).toBe(0.0);
  });
});
