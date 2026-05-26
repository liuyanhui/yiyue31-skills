/**
 * End-to-end integration tests for the full doc-segmenter pipeline.
 *
 * Ported from test_integration_pipeline.py (10 tests).
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { SplitRunnerImpl } from "../src/runner";
import { sanitizeFilename } from "../src/utils";
import { writeFileSync, mkdirSync, rmSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { globSync } from "node:fs";

let tmpDir: string;

beforeEach(() => {
  tmpDir = join("D:/tmp", `integration-test-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

function buildIntegrationMarkdown(): { filePath: string; content: string } {
  const sections: string[] = [];

  // Section 1: Introduction with code block (~15KB)
  const lines1: string[] = ["# Introduction", ""];
  lines1.push("```python");
  for (let i = 0; i < 80; i++) {
    lines1.push(`def function_${i}():`);
    lines1.push(`    return ${i} * 2`);
  }
  lines1.push("```");
  lines1.push("");
  lines1.push("This section introduces the document with code examples. ".repeat(30));
  lines1.push("");
  sections.push(lines1.join("\n"));

  // Section 2: HTML table + content (~15KB)
  const lines2: string[] = ["## Data Analysis", ""];
  lines2.push("<table>");
  lines2.push("<tr><th>Metric</th><th>Value</th></tr>");
  for (let i = 0; i < 50; i++) {
    lines2.push(`<tr><td>Row ${i}</td><td>${(i * 1.5).toFixed(1)}</td></tr>`);
  }
  lines2.push("</table>");
  lines2.push("");
  lines2.push("Analysis of the data presented in the table above. ".repeat(50));
  lines2.push("");
  sections.push(lines2.join("\n"));

  // Section 3: Pipe table + content (~15KB)
  const lines3: string[] = ["## Results Summary", ""];
  lines3.push("| Category | Count | Percentage |");
  lines3.push("|----------|-------|------------|");
  for (let i = 0; i < 30; i++) {
    lines3.push(`| Cat-${i} | ${i * 10} | ${(i * 3.3).toFixed(1)}% |`);
  }
  lines3.push("");
  lines3.push("The results show significant trends across categories. ".repeat(50));
  lines3.push("");
  sections.push(lines3.join("\n"));

  // Section 4: Multi-level subheadings (~15KB)
  const lines4: string[] = ["## Methodology", ""];
  for (let j = 0; j < 5; j++) {
    lines4.push(`### Step ${j + 1}`);
    lines4.push("");
    lines4.push(`Detailed methodology description for step ${j + 1}. `.repeat(40));
    lines4.push("");
  }
  sections.push(lines4.join("\n"));

  // Section 5: Conclusion (~15KB)
  const lines5: string[] = ["## Conclusion", ""];
  lines5.push("```javascript");
  lines5.push("const result = data.filter(x => x.value > threshold);");
  lines5.push("console.log(result.length);");
  lines5.push("```");
  lines5.push("");
  lines5.push("Final conclusions drawn from the analysis. ".repeat(60));
  lines5.push("");
  sections.push(lines5.join("\n"));

  const content = sections.join("\n");
  const filePath = join(tmpDir, "integration-test.md");
  writeFileSync(filePath, content, "utf-8");
  return { filePath, content };
}

function getChunkFiles(dir: string): string[] {
  return readdirSync(dir)
    .filter(f => f.startsWith("chunk-") && f.endsWith(".md"))
    .sort();
}

describe("TestIntegrationPipeline", () => {
  test("runner returns success", () => {
    const runner = new SplitRunnerImpl();
    const { filePath } = buildIntegrationMarkdown();
    const outputDir = join(tmpDir, "output");
    const result = runner.run(filePath, outputDir, 40.0, 10.0);
    expect(result).toBe(0);
  });

  test("output files exist", () => {
    const runner = new SplitRunnerImpl();
    const { filePath } = buildIntegrationMarkdown();
    const outputDir = join(tmpDir, "output");
    runner.run(filePath, outputDir, 40.0, 10.0);
    const outputFiles = new Set(readdirSync(outputDir));
    const chunkFiles = [...outputFiles].filter(f => f.startsWith("chunk-") && f.endsWith(".md"));
    expect(chunkFiles.length).toBeGreaterThanOrEqual(1);
    expect(outputFiles.has("manifest.md")).toBe(true);
    expect(outputFiles.has("progress.json")).toBe(true);
    expect(outputFiles.has("report.md")).toBe(true);
  });

  test("chunks within max size", () => {
    const runner = new SplitRunnerImpl();
    const { filePath } = buildIntegrationMarkdown();
    const outputDir = join(tmpDir, "output");
    runner.run(filePath, outputDir, 40.0, 10.0);
    for (const cf of getChunkFiles(outputDir)) {
      const content = readFileSync(join(outputDir, cf), "utf-8");
      const sizeKb = new TextEncoder().encode(content).length / 1024;
      expect(sizeKb).toBeLessThanOrEqual(41.0); // small tolerance
    }
  });

  test("chunks non-empty", () => {
    const runner = new SplitRunnerImpl();
    const { filePath } = buildIntegrationMarkdown();
    const outputDir = join(tmpDir, "output");
    runner.run(filePath, outputDir, 40.0, 10.0);
    for (const cf of getChunkFiles(outputDir)) {
      expect(statSync(join(outputDir, cf)).size).toBeGreaterThan(0);
    }
  });

  test("chunk concatenation equals original", () => {
    const runner = new SplitRunnerImpl();
    const { filePath, content: original } = buildIntegrationMarkdown();
    const outputDir = join(tmpDir, "output");
    runner.run(filePath, outputDir, 40.0, 10.0);
    let reconstructed = "";
    for (const cf of getChunkFiles(outputDir)) {
      reconstructed += readFileSync(join(outputDir, cf), "utf-8");
    }
    expect(reconstructed).toBe(original);
  });

  test("progress.json fields", () => {
    const runner = new SplitRunnerImpl();
    const { filePath } = buildIntegrationMarkdown();
    const outputDir = join(tmpDir, "output");
    runner.run(filePath, outputDir, 40.0, 10.0);
    const progress = JSON.parse(readFileSync(join(outputDir, "progress.json"), "utf-8"));
    expect("source_size_kb" in progress).toBe(true);
    expect("threshold_kb" in progress).toBe(true);
    expect("total_chunks" in progress).toBe(true);
    expect("pending" in progress).toBe(true);
  });

  test("total chunks consistency", () => {
    const runner = new SplitRunnerImpl();
    const { filePath } = buildIntegrationMarkdown();
    const outputDir = join(tmpDir, "output");
    runner.run(filePath, outputDir, 40.0, 10.0);
    const progress = JSON.parse(readFileSync(join(outputDir, "progress.json"), "utf-8"));
    const chunkFiles = getChunkFiles(outputDir);
    expect(progress.total_chunks).toBe(chunkFiles.length);
  });

  test("manifest matches chunks", () => {
    const runner = new SplitRunnerImpl();
    const { filePath } = buildIntegrationMarkdown();
    const outputDir = join(tmpDir, "output");
    runner.run(filePath, outputDir, 40.0, 10.0);
    const manifest = readFileSync(join(outputDir, "manifest.md"), "utf-8");
    const chunkFiles = getChunkFiles(outputDir);
    for (const cf of chunkFiles) {
      expect(manifest).toContain(cf);
    }
  });

  test("code blocks intact", () => {
    const runner = new SplitRunnerImpl();
    const { filePath } = buildIntegrationMarkdown();
    const outputDir = join(tmpDir, "output");
    runner.run(filePath, outputDir, 40.0, 10.0);
    for (const cf of getChunkFiles(outputDir)) {
      const content = readFileSync(join(outputDir, cf), "utf-8");
      const backtickCount = (content.match(/```/g) || []).length;
      if (backtickCount > 0) {
        expect(backtickCount % 2).toBe(0);
      }
    }
  });

  test("filenames sanitized", () => {
    const runner = new SplitRunnerImpl();
    const { filePath } = buildIntegrationMarkdown();
    const outputDir = join(tmpDir, "output");
    runner.run(filePath, outputDir, 40.0, 10.0);
    const unsafe = new Set(['/','\\',':','*','?','"', '<','>','|']);
    for (const cf of getChunkFiles(outputDir)) {
      for (const ch of cf) {
        expect(unsafe.has(ch)).toBe(false);
      }
    }
  });
});
