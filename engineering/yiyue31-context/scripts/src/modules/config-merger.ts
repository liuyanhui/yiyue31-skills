/**
 * Configuration merger module.
 *
 * Merges CLI arguments, optional config file, and built-in defaults
 * into a single validated {@link CheckConfig} object.
 */

import { readFileSync } from "node:fs";
import type {
  CliArgs,
  CheckConfig,
} from "../types/index.js";
import { DEFAULT_CONFIG } from "../types/index.js";

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

/**
 * Base error for config file operations.
 *
 * Carries the file path that caused the error so callers can report
 * which config file was problematic.
 */
export class ConfigFileError extends Error {
  readonly filePath: string;

  constructor(message: string, filePath: string) {
    super(message);
    this.name = "ConfigFileError";
    this.filePath = filePath;
  }
}

/**
 * Thrown when the specified config file does not exist on disk.
 */
export class ConfigFileNotFoundError extends ConfigFileError {
  constructor(filePath: string) {
    super(`Config file not found: ${filePath}`, filePath);
    this.name = "ConfigFileNotFoundError";
  }
}

/**
 * Thrown when the config file exists but contains invalid JSON.
 *
 * When possible, carries the line and column of the parse error
 * extracted from the native `SyntaxError` message produced by `JSON.parse`.
 */
export class ConfigFileParseError extends ConfigFileError {
  readonly line?: number;
  readonly column?: number;
  readonly parseError: string;

  constructor(
    filePath: string,
    parseError: string,
    line?: number,
    column?: number,
  ) {
    const pos =
      line !== undefined ? ` at line ${line}, column ${column ?? "?"}` : "";
    super(
      `Failed to parse config file: ${filePath}${pos} — ${parseError}`,
      filePath,
    );
    this.name = "ConfigFileParseError";
    this.parseError = parseError;
    this.line = line;
    this.column = column;
  }
}

// ---------------------------------------------------------------------------
// loadConfigFile
// ---------------------------------------------------------------------------

/**
 * Load and parse a JSON config file from disk.
 *
 * @param filePath - Absolute or relative path to the config file.
 * @returns Parsed partial config object.
 * @throws {ConfigFileNotFoundError} If the file does not exist.
 * @throws {ConfigFileParseError}    If the file is not valid JSON.
 */
export function loadConfigFile(filePath: string): Partial<CheckConfig> {
  let raw: string;
  try {
    raw = readFileSync(filePath, "utf-8");
  } catch (err: unknown) {
    const nodeErr = err as NodeJS.ErrnoException;
    if (nodeErr.code === "ENOENT") {
      throw new ConfigFileNotFoundError(filePath);
    }
    throw new ConfigFileError(
      `Failed to read config file: ${filePath} — ${(err as Error).message}`,
      filePath,
    );
  }

  try {
    return JSON.parse(raw) as Partial<CheckConfig>;
  } catch (err: unknown) {
    throw new ConfigFileParseError(filePath, (err as Error).message);
  }
}

// ---------------------------------------------------------------------------
// mergeConfig
// ---------------------------------------------------------------------------

/**
 * Internal accumulator type that allows mutable indexed writes without
 * TS narrowing to `never` on computed key assignments.
 */
type Acc = { [K in keyof CheckConfig]: CheckConfig[K] };

/**
 * Merge CLI arguments with config file values and built-in defaults
 * to produce a fully resolved {@link CheckConfig}.
 *
 * Merging strategy (priority: CLI > config file > defaults):
 *
 * 1. **Array fields** (`exclude`, `include`, `required_any_patterns`,
 *    `required_all_patterns`, `forbidden_patterns`):
 *    CLI array **replaces** config array entirely — no concatenation.
 *
 * 2. **Scalar fields** (`target`, `filename`, `min_content_length`,
 *    `max_file_size`, `expected_encoding`):
 *    CLI value wins over config value.
 *
 * 3. **Nested objects** (`markers`, `output`):
 *    **Shallow per-field merge** — each sub-field independently:
 *    CLI sub-field wins, else config sub-field wins, else default.
 *
 * @param cliArgs      - Parsed CLI arguments.
 * @param configValues - Partial config loaded from file (may be `{}`).
 * @returns Fully resolved configuration object.
 */
export function mergeConfig(
  cliArgs: CliArgs,
  configValues: Partial<CheckConfig> = {},
): CheckConfig {
  // We accumulate into a Record to avoid TS "assigns to never" errors on
  // computed key writes, then cast back at the end.
  const acc: Record<string, unknown> = {};

  // ---------- 1. Array fields: CLI replaces config entirely ----------
  const arrayKeys = [
    "exclude",
    "include",
    "required_any_patterns",
    "required_all_patterns",
    "forbidden_patterns",
  ] as const;

  for (const key of arrayKeys) {
    const cliVal = cliArgs[key as keyof CliArgs] as string[] | undefined;
    const cfgVal = configValues[key] as string[] | undefined;
    const defVal = DEFAULT_CONFIG[key as keyof typeof DEFAULT_CONFIG] as string[];

    if (Array.isArray(cliVal) && cliVal.length > 0) {
      acc[key] = [...cliVal];
    } else if (Array.isArray(cfgVal) && cfgVal.length > 0) {
      acc[key] = [...cfgVal];
    } else {
      acc[key] = defVal;
    }
  }

  // ---------- 2. Scalar fields: CLI > config > default ----------
  const scalarKeys = [
    "target",
    "filename",
    "min_content_length",
    "max_file_size",
    "expected_encoding",
  ] as const;

  for (const key of scalarKeys) {
    const cliVal = cliArgs[key as keyof CliArgs] as string | number | undefined;
    const cfgVal = configValues[key] as string | number | undefined;

    if (cliVal !== undefined && cliVal !== "") {
      acc[key] = cliVal;
    } else if (cfgVal !== undefined) {
      acc[key] = cfgVal;
    } else if (key === "target") {
      acc[key] = cliArgs.target;
    } else {
      acc[key] = DEFAULT_CONFIG[key as keyof typeof DEFAULT_CONFIG];
    }
  }

  // ---------- 3. Nested objects: shallow per-field merge ----------
  const nestedKeys = ["markers", "output"] as const;

  for (const key of nestedKeys) {
    const cfgVal = configValues[key] as Record<string, unknown> | undefined;
    const defVal = DEFAULT_CONFIG[key as keyof typeof DEFAULT_CONFIG] as Record<
      string,
      unknown
    >;

    // Collect all sub-field keys across config and defaults
    const allSubKeys = new Set<string>([
      ...Object.keys(defVal),
      ...(cfgVal ? Object.keys(cfgVal) : []),
    ]);

    const merged: Record<string, unknown> = {};
    for (const subKey of allSubKeys) {
      const cfgSub = cfgVal ? cfgVal[subKey] : undefined;
      const defSub = defVal[subKey];

      // Config sub-field wins over default sub-field
      if (cfgSub !== undefined) {
        merged[subKey] = cfgSub;
      } else if (defSub !== undefined) {
        merged[subKey] = defSub;
      }
    }

    acc[key] = merged;
  }

  return acc as unknown as CheckConfig;
}
