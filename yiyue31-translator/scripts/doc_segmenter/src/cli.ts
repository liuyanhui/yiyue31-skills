/**
 * CLI entry point for the file splitting tool.
 *
 * Provides a minimal custom argument parser (no external dependencies).
 * Usage: bun run src/cli.ts <file_path> [--output-dir <dir>] [--max-size <kb>] [--min-size <kb>]
 */

import { SplitRunnerImpl } from "./runner";
import { SplitError } from "./models";

interface ParsedArgs {
  filePath: string;
  outputDir: string;
  maxSize: number;
  minSize: number;
}

function parseArgs(argv: string[]): ParsedArgs | null {
  // Skip first 2 args (bun and script path)
  const args = argv.slice(2);

  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    return null;
  }

  let filePath = "";
  let outputDir = "./output";
  let maxSize = 40.0;
  let minSize = 10.0;

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg === "--output-dir" && i + 1 < args.length) {
      outputDir = args[i + 1];
      i += 2;
    } else if (arg === "--max-size" && i + 1 < args.length) {
      maxSize = parseFloat(args[i + 1]);
      i += 2;
    } else if (arg === "--min-size" && i + 1 < args.length) {
      minSize = parseFloat(args[i + 1]);
      i += 2;
    } else if (!arg.startsWith("--")) {
      filePath = arg;
      i++;
    } else {
      i++;
    }
  }

  if (!filePath) {
    return null;
  }

  return { filePath, outputDir, maxSize, minSize };
}

function printUsage(): void {
  console.log(`Usage: doc-segmenter <file_path> [options]

Split a Markdown file into smaller chunks for translation.

Arguments:
  file_path             Path to the source Markdown file to split.

Options:
  --output-dir <dir>    Output directory for split files (default: ./output).
  --max-size <kb>       Maximum chunk size in KB (default: 40).
  --min-size <kb>       Minimum chunk size in KB for merging (default: 10).
  --help, -h            Show this help message.
`);
}

function main(): void {
  const parsed = parseArgs(process.argv);

  if (!parsed) {
    printUsage();
    process.exit(1);
  }

  const runner = new SplitRunnerImpl();
  const exitCode = runner.run(
    parsed.filePath,
    parsed.outputDir,
    parsed.maxSize,
    parsed.minSize
  );
  process.exit(exitCode);
}

main();
