/**
 * CLI argument parser module.
 *
 * Parses raw `process.argv` (or a custom string array) into a structured
 * {@link CliArgs} object, applying basic validation and short-flag expansion.
 */

import type { CliArgs } from "../types/index.js";
import {
  MissingRequiredArgError,
  InvalidArgValueError,
  HelpRequestedError,
} from "../types/index.js";

export {
  CliParseError,
  MissingRequiredArgError,
  InvalidArgValueError,
  HelpRequestedError,
} from "../types/index.js";

/**
 * Mapping from short flag to its long-form counterpart.
 */
const SHORT_TO_LONG: Record<string, string> = {
  "-t": "--target",
  "-e": "--exclude",
  "-i": "--include",
  "-f": "--filename",
  "-c": "--config",
  "-h": "--help",
};

/**
 * Flags that accept a value (as opposed to boolean flags like --help).
 */
const VALUE_FLAGS = new Set(["--target", "--exclude", "--include", "--filename", "--config"]);

/**
 * Parse CLI arguments into a structured object.
 *
 * @param argv - Argument array to parse (defaults to `process.argv.slice(2)`).
 * @returns Parsed CLI arguments.
 * @throws {MissingRequiredArgError} When --target is not provided.
 * @throws {InvalidArgValueError} When an unknown flag is encountered.
 * @throws {HelpRequestedError} When --help or -h is present.
 */
export function parseCliArgs(argv?: string[]): CliArgs {
  const args = argv ?? process.argv.slice(2);

  const exclude: string[] = [];
  const include: string[] = [];
  let target: string | undefined;
  let filename = "CLAUDE.md";
  let config: string | undefined;

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    // Normalize short flags to long form
    const normalized = SHORT_TO_LONG[arg] ?? arg;

    // Check if this looks like a flag at all
    if (!normalized.startsWith("--")) {
      throw new InvalidArgValueError(arg, arg);
    }

    // Handle --help
    if (normalized === "--help") {
      throw new HelpRequestedError();
    }

    // Validate known flags
    if (!VALUE_FLAGS.has(normalized)) {
      throw new InvalidArgValueError(arg, arg);
    }

    // Value-requiring flag — grab the next token
    i++;
    if (i >= args.length) {
      throw new MissingRequiredArgError(normalized);
    }
    const value = args[i];

    switch (normalized) {
      case "--target":
        target = value;
        break;
      case "--exclude":
        exclude.push(...value.split(",").map((s) => s.trim()).filter((s) => s.length > 0));
        break;
      case "--include":
        include.push(...value.split(",").map((s) => s.trim()).filter((s) => s.length > 0));
        break;
      case "--filename":
        filename = value;
        break;
      case "--config":
        config = value;
        break;
    }

    i++;
  }

  if (target === undefined) {
    throw new MissingRequiredArgError("--target");
  }

  return {
    target,
    exclude,
    include,
    filename,
    ...(config !== undefined && { config }),
  };
}
