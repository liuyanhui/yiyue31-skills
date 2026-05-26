/**
 * ReportGenerator implementation.
 *
 * Generates report.md from SplitContext with source info, split results,
 * operations, validation results, and file list.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { type SplitContext } from "./models";
import { sanitizeFilename } from "./utils";

export class ReportGeneratorImpl {
  /**
   * Generate report.md from the full pipeline context.
   *
   * @param context - The complete SplitContext with all pipeline data.
   */
  generateReport(context: SplitContext): void {
    const outputDir = context.outputDir;
    mkdirSync(outputDir, { recursive: true });

    const lines: string[] = [];
    lines.push("# File Split Report");
    lines.push("");

    // Source file information
    lines.push("## Source Information");
    lines.push("");
    lines.push("| Property | Value |");
    lines.push("|----------|-------|");
    lines.push(`| File | ${context.sourceInfo.filePath} |`);
    lines.push(`| Size | ${context.sourceInfo.fileSize.toFixed(1)} KB |`);
    lines.push(`| Lines | ${context.sourceInfo.fileLines} |`);
    lines.push(`| Chars | ${context.sourceInfo.fileChars} |`);
    lines.push(`| Encoding | ${context.sourceInfo.fileEncoding} |`);
    lines.push("");

    // Split results
    lines.push("## Split Results");
    lines.push("");
    lines.push(`Total chunks: ${context.chunks.length}`);
    lines.push("");

    if (context.chunks.length > 0) {
      lines.push("| # | Section | Size (KB) | Lines | Merged |");
      lines.push("|---|---------|-----------|-------|--------|");
      for (let i = 0; i < context.chunks.length; i++) {
        const chunk = context.chunks[i];
        const mergedTag = chunk.isMerged ? "Yes" : "No";
        lines.push(`| ${i + 1} | ${chunk.sourceSection} | ${chunk.sizeKb.toFixed(1)} | ${chunk.lineCount} | ${mergedTag} |`);
      }
      lines.push("");
    }

    // Operations
    if (context.operations.length > 0) {
      lines.push("## Operations");
      lines.push("");
      lines.push("| Type | Target | Detail |");
      lines.push("|------|--------|--------|");
      for (const op of context.operations) {
        lines.push(`| ${op.operation} | ${op.target} | ${op.detail} |`);
      }
      lines.push("");
    }

    // Validation results
    const validationKeys = Object.keys(context.validationResults);
    if (validationKeys.length > 0) {
      lines.push("## Validation");
      lines.push("");
      const allPass = validationKeys.every(k => context.validationResults[k]);
      for (const check of validationKeys) {
        const result = context.validationResults[check];
        const status = result ? "pass" : "FAIL";
        lines.push(`- **${check}**: ${status}`);
      }
      lines.push("");
      if (allPass) {
        lines.push("All checks passed.");
      } else {
        lines.push("Some checks failed.");
      }
      lines.push("");
    }

    // File list
    if (context.chunks.length > 0) {
      lines.push("## Output Files");
      lines.push("");
      for (let i = 0; i < context.chunks.length; i++) {
        const chunk = context.chunks[i];
        const filename = `chunk-${String(i + 1).padStart(2, "0")}-${sanitizeFilename(chunk.sourceSection)}.md`;
        lines.push(`${i + 1}. ${filename} (${chunk.sizeKb.toFixed(1)} KB)`);
      }
      lines.push("");
    }

    const reportPath = join(outputDir, "report.md");
    writeFileSync(reportPath, lines.join("\n"), "utf-8");
  }
}
