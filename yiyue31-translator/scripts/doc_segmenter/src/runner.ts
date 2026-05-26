/**
 * SplitRunner implementation.
 *
 * Orchestrates all pipeline modules in sequence:
 * inspect -> parse -> split -> merge -> check -> generate -> report
 * When fileSize < maxSize, parse/split/merge stages are skipped (single chunk).
 */

import { basename, extname } from "node:path";
import { readFileSync } from "node:fs";

import { FileInspectorImpl } from "./inspector";
import { SectionParserImpl } from "./parser";
import { SectionSplitterImpl } from "./splitter";
import { ChunkMergerImpl } from "./merger";
import { IntegrityCheckerImpl } from "./checker";
import { FileGeneratorImpl } from "./generator";
import { ReportGeneratorImpl } from "./reporter";

import { type Chunk, type SplitContext, SplitError } from "./models";
import { normalizeNewlines } from "./utils";

export class SplitRunnerImpl {
  private inspector: FileInspectorImpl;
  private parser: SectionParserImpl;
  private splitter: SectionSplitterImpl;
  private merger: ChunkMergerImpl;
  private checker: IntegrityCheckerImpl;
  private generator: FileGeneratorImpl;
  private reporter: ReportGeneratorImpl;

  constructor() {
    this.inspector = new FileInspectorImpl();
    this.parser = new SectionParserImpl();
    this.splitter = new SectionSplitterImpl();
    this.merger = new ChunkMergerImpl();
    this.checker = new IntegrityCheckerImpl();
    this.generator = new FileGeneratorImpl();
    this.reporter = new ReportGeneratorImpl();
  }

  /**
   * Run the full splitting pipeline.
   *
   * @param filePath - Path to the source Markdown file.
   * @param outputDir - Directory for output files.
   * @param maxSize - Maximum chunk size in KB.
   * @param minSize - Minimum chunk size in KB.
   * @returns Exit code: 0 for success, 1-4 for errors.
   */
  run(
    filePath: string,
    outputDir: string = "./output",
    maxSize: number = 40.0,
    minSize: number = 10.0
  ): number {
    try {
      // Stage 0: Inspect
      const sourceInfo = this.inspector.inspect(filePath);

      // Read file content for later stages (MUST normalize newlines)
      const rawBytes = readFileSync(filePath);
      const decoder = new TextDecoder(sourceInfo.fileEncoding);
      let originalContent = decoder.decode(rawBytes);
      originalContent = normalizeNewlines(originalContent);

      // Small file shortcut: skip parse -> split -> merge
      let chunks: Chunk[];
      let allOps: import("./models").SplitOperation[];
      let sections: import("./models").Section[];

      if (sourceInfo.fileSize < maxSize) {
        const baseName = basename(filePath, extname(filePath));
        const chunk: Chunk = {
          sourceSection: baseName,
          level: 1,
          content: originalContent,
          sizeKb: sourceInfo.fileSize,
          lineCount: sourceInfo.fileLines,
          startLine: 1,
          endLine: sourceInfo.fileLines,
          isMerged: false,
          mergedSections: [],
          estimatedTokens: 0,
        };
        chunks = [chunk];
        allOps = [];
        sections = [];
      } else {
        // Stage 1: Parse
        sections = this.parser.parse(originalContent, sourceInfo.fileEncoding);

        // Stage 2: Split
        const [splitChunks, splitOps] = this.splitter.split(sections, maxSize);

        // Stage 3: Merge
        const [mergedChunks, mergeOps] = this.merger.merge(splitChunks, maxSize, minSize);

        chunks = mergedChunks;
        allOps = [...splitOps, ...mergeOps];
      }

      // Stage 4: Integrity check
      const validationResults = this.checker.check(chunks, originalContent, sourceInfo);

      if (!Object.values(validationResults).every(Boolean)) {
        // Validation failed
        const failedChecks = Object.entries(validationResults)
          .filter(([, passed]) => !passed)
          .map(([name]) => name);
        console.error(`Error: Validation failed: ${failedChecks.join(", ")}`);

        const context: SplitContext = {
          sourceInfo,
          sections,
          chunks,
          operations: allOps,
          validationResults,
          outputDir,
        };
        this.reporter.generateReport(context);
        return 3;
      }

      // Stage 5: Generate output files
      const context: SplitContext = {
        sourceInfo,
        sections,
        chunks,
        operations: allOps,
        validationResults,
        outputDir,
      };
      this.generator.generate(chunks, outputDir, sourceInfo, maxSize);

      // Stage 6: Generate report
      this.reporter.generateReport(context);

      return 0;
    } catch (e) {
      if (e instanceof SplitError) {
        console.error(`Error: ${e.message}`);
        return e.exitCode;
      }
      console.error(`Error: ${e}`);
      return 1;
    }
  }
}
