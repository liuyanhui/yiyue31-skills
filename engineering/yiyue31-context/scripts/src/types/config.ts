import type { MarkerIssueIdentifier } from "./enums.js";

/**
 * Configuration for paired marker delimiters used to identify
 * yiyue31-context blocks within target files.
 */
export interface MarkerConfig {
  /** The opening marker string, e.g. `<!-- skill: yiyue31-context -->`. */
  start: string;
  /** The closing marker string, e.g. `<!-- /yiyue31-context -->`. */
  end: string;
  /**
   * Name of the YAML-like field inside the marker block that stores
   * the last update timestamp (e.g. `"update_time"`).
   */
  update_time_field: string;
}

/**
 * Output destination configuration for generated reports.
 *
 * At least one of `json` or `markdown` should be specified for
 * the tool to produce visible output.
 */
export interface OutputConfig {
  /** File path for JSON report output. Omit or leave undefined to skip. */
  json?: string;
  /** File path for Markdown report output. Omit or leave undefined to skip. */
  markdown?: string;
}

/**
 * Fully resolved configuration object used throughout the checking pipeline.
 *
 * Created by merging CLI arguments with an optional config file and
 * falling back to {@link DEFAULT_CONFIG} values.
 */
export interface CheckConfig {
  /** Root directory to scan for yiyue31-context coverage. */
  target: string;
  /** Glob patterns of directory names to exclude from scanning. */
  exclude: string[];
  /** Glob patterns of directory names to include even if they would otherwise be excluded. */
  include: string[];
  /**
   * Filename to look for in each directory (e.g. `"CLAUDE.md"`).
   * The tool checks whether every scanned directory contains this file
   * with a valid yiyue31-context marker block.
   */
  filename: string;
  /** Marker delimiter configuration. */
  markers: MarkerConfig;
  /**
   * List of regex patterns. The file passes if **at least one** pattern
   * matches somewhere in its content. An empty array means no constraint.
   */
  required_any_patterns: string[];
  /**
   * List of regex patterns. The file passes only if **every** pattern
   * matches somewhere in its content. An empty array means no constraint.
   */
  required_all_patterns: string[];
  /**
   * List of regex patterns. The file fails if **any** pattern matches
   * anywhere in its content. An empty array means no constraint.
   */
  forbidden_patterns: string[];
  /**
   * Minimum number of characters that must appear between the start
   * and end markers to be considered valid content.
   */
  min_content_length: number;
  /** Maximum allowed file size in bytes. Files exceeding this are flagged. */
  max_file_size: number;
  /** Expected text encoding of target files (e.g. `"utf-8"`). */
  expected_encoding: string;
  /** Report output destinations. */
  output: OutputConfig;
}

/**
 * Raw CLI argument values parsed from `process.argv` (or a custom array).
 *
 * These are later merged with config-file values and defaults to
 * produce a complete {@link CheckConfig}.
 */
export interface CliArgs {
  /** Root directory to scan. */
  target: string;
  /** Glob patterns of directory names to exclude. */
  exclude: string[];
  /** Glob patterns of directory names to include. */
  include: string[];
  /** Filename to look for in each directory. */
  filename: string;
  /** Optional path to a JSON/YAML config file that overrides defaults. */
  config?: string;
}

/**
 * Sensible default values for every field of {@link CheckConfig} except `target`.
 *
 * The `target` field is always provided via CLI args or config file,
 * so it has no meaningful default. Use `Omit<CheckConfig, 'target'>` as
 * the type so the constant is valid without a `target` value.
 *
 * Used as the base layer when merging configuration sources:
 * ```ts
 * const config: CheckConfig = { target: cliArgs.target, ...DEFAULT_CONFIG };
 * ```
 */
export const DEFAULT_CONFIG: Omit<CheckConfig, "target"> = {
  filename: "CLAUDE.md",
  exclude: [],
  include: [],
  min_content_length: 1,
  max_file_size: 51200,
  expected_encoding: "utf-8",
  markers: {
    start: "<!-- skill: yiyue31-context -->",
    end: "<!-- /yiyue31-context -->",
    update_time_field: "update_time",
  },
  output: {},
  required_any_patterns: [],
  required_all_patterns: [],
  forbidden_patterns: [],
};

/**
 * Re-export enum types needed by config consumers.
 * @internal Only used for type inference.
 */
export type { MarkerIssueIdentifier };
