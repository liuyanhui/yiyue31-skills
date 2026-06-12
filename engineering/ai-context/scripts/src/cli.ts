/**
 * CLI entry point module.
 *
 * Exports an async `run()` function that orchestrates the full
 * ai-context-checker pipeline: parse args, load config, validate input,
 * scan directories, run the validation pipeline, and generate a report.
 *
 * Returns an exit code (0 = success, 1 = failure) for testability.
 * Does NOT call `process.exit` — that is the responsibility of `index.ts`.
 */

import { parseCliArgs, HelpRequestedError } from "./modules/cli-parser.js";
import {
  loadConfigFile,
  mergeConfig,
  ConfigFileNotFoundError,
  ConfigFileParseError,
} from "./modules/config-merger.js";
import { validateInput } from "./modules/input-validator.js";
import { scanDirectories } from "./modules/directory-scanner.js";
import { runPipeline } from "./modules/pipeline-orchestrator.js";
import { generateReport } from "./modules/report-generator.js";

// ---------------------------------------------------------------------------
// Usage text
// ---------------------------------------------------------------------------

const USAGE = `Usage: ai-context-checker [options]

Options:
  -t, --target <path>       Target directory to scan (required)
  -e, --exclude <names>     Directory names to exclude (comma-separated, repeatable)
  -i, --include <names>     Directory names to force-include (comma-separated, repeatable)
  -f, --filename <name>     Target filename (default: CLAUDE.md)
  -c, --config <path>       Path to config file (JSON)
  -h, --help                Show this help message`;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run the CLI tool.
 *
 * @param argv - Argument array (typically `process.argv.slice(2)`).
 *               If omitted, `parseCliArgs` will use `process.argv.slice(2)`.
 * @returns Exit code: 0 for success or help, 1 for any error.
 */
export async function run(argv?: string[]): Promise<number> {
  // Step 1: Parse CLI arguments
  let args;
  try {
    args = parseCliArgs(argv ?? process.argv.slice(2));
  } catch (err: unknown) {
    if (err instanceof HelpRequestedError) {
      process.stdout.write(USAGE + "\n");
      return 0;
    }
    // MissingRequiredArgError, InvalidArgValueError, etc.
    console.error(err instanceof Error ? err.message : String(err));
    return 1;
  }

  // Step 2: Load config file if --config is provided
  let configValues: Partial<import("./types/index.js").CheckConfig> = {};
  if (args.config) {
    try {
      configValues = loadConfigFile(args.config);
    } catch (err: unknown) {
      if (
        err instanceof ConfigFileNotFoundError ||
        err instanceof ConfigFileParseError
      ) {
        console.error(err.message);
        return 1;
      }
      console.error(
        `Failed to load config file: ${err instanceof Error ? err.message : String(err)}`,
      );
      return 1;
    }
  }

  // Step 3: Merge config (CLI > config file > defaults)
  const config = mergeConfig(args, configValues);

  // Step 4: Validate input
  const validation = validateInput(config);
  if (!validation.isValid) {
    for (const error of validation.errors) {
      console.error(`Validation error [${error.field}]: ${error.message}`);
    }
    return 1;
  }

  // Step 5: Scan directories
  const directories = scanDirectories(config);

  // Step 6: Run the validation pipeline
  const pipelineResult = runPipeline(
    config,
    directories.map((d) => d.directory),
  );

  // Step 7: Generate report (writes files if configured)
  generateReport(pipelineResult, config);

  // Step 8: Return exit code based on pass/fail
  return pipelineResult.result.summary.passed ? 0 : 1;
}
