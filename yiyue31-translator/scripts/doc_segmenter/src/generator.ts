/**
 * FileGenerator implementation.
 *
 * Writes chunk files, manifest.md, and progress.json to the output directory.
 * Filename format: chunk-{NN:02d}-{sanitize(source_section)}.md
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import { type Chunk, type SourceFileInfo, SplitError } from "./models";
import { sanitizeFilename } from "./utils";

export class FileGeneratorImpl {
  /**
   * Generate output files for all chunks.
   *
   * @param chunks - The final chunk list.
   * @param outputDir - Directory to write files into.
   * @param sourceInfo - Metadata about the source file.
   * @param maxSize - Maximum chunk size threshold in KB.
   * @throws SplitError exitCode=4 if output directory write fails.
   */
  generate(
    chunks: Chunk[],
    outputDir: string,
    sourceInfo: SourceFileInfo,
    maxSize: number = 40.0
  ): void {
    // Create output directory if not exists
    mkdirSync(outputDir, { recursive: true });

    // Write each chunk file
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const filename = `chunk-${String(i + 1).padStart(2, "0")}-${sanitizeFilename(chunk.sourceSection)}.md`;
      const filepath = join(outputDir, filename);
      try {
        writeFileSync(filepath, chunk.content, "utf-8");
      } catch (e) {
        throw new SplitError(
          `Failed to write chunk file: ${e}`,
          4
        );
      }
    }

    // Write manifest.md
    this.writeManifest(chunks, outputDir, sourceInfo);

    // Write progress.json
    this.writeProgress(chunks, outputDir, sourceInfo, maxSize);
  }

  private writeManifest(
    chunks: Chunk[],
    outputDir: string,
    sourceInfo: SourceFileInfo
  ): void {
    const lines: string[] = [];
    lines.push("# Split Manifest");
    lines.push("");
    lines.push(`Source: ${sourceInfo.filePath}`);
    lines.push(`Size: ${sourceInfo.fileSize.toFixed(1)} KB`);
    lines.push(`Lines: ${sourceInfo.fileLines}`);
    lines.push(`Total chunks: ${chunks.length}`);
    lines.push("");
    lines.push("| 序号 | File | Section | Size (KB) | Lines |");
    lines.push("|------|------|---------|-----------|-------|");

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const filename = `chunk-${String(i + 1).padStart(2, "0")}-${sanitizeFilename(chunk.sourceSection)}.md`;
      lines.push(`| ${i + 1} | ${filename} | ${chunk.sourceSection} | ${chunk.sizeKb.toFixed(1)} | ${chunk.lineCount} |`);
    }

    lines.push("");

    const manifestPath = join(outputDir, "manifest.md");
    writeFileSync(manifestPath, lines.join("\n"), "utf-8");
  }

  private writeProgress(
    chunks: Chunk[],
    outputDir: string,
    sourceInfo: SourceFileInfo,
    maxSize: number
  ): void {
    const pending: Array<{
      index: number;
      filename: string;
      section: string;
      size_kb: number;
    }> = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const filename = `chunk-${String(i + 1).padStart(2, "0")}-${sanitizeFilename(chunk.sourceSection)}.md`;
      pending.push({
        index: i + 1,
        filename,
        section: chunk.sourceSection,
        size_kb: Math.round(chunk.sizeKb * 100) / 100,
      });
    }

    // Note: snake_case field names for backward compatibility with translator skill
    const progress = {
      source_file: sourceInfo.filePath,
      source_size_kb: Math.round(sourceInfo.fileSize * 100) / 100,
      threshold_kb: Math.round(maxSize * 100) / 100,
      total_chunks: chunks.length,
      completed: [] as Array<Record<string, unknown>>,
      in_progress: null as string | null,
      pending,
    };

    const progressPath = join(outputDir, "progress.json");
    writeFileSync(progressPath, JSON.stringify(progress, null, 2), "utf-8");
  }
}
