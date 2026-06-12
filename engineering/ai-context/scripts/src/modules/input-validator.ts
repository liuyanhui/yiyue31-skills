/**
 * Input validator module.
 *
 * Validates the fully resolved {@link CheckConfig} for structural
 * correctness, value ranges, and logical consistency before the
 * checking pipeline runs.
 *
 * Validation stops at the **first fatal error** (short-circuit) and
 * returns a single-element `errors` array.  This keeps error messages
 * actionable — the user fixes one thing at a time.
 */

import path from "node:path";
import fs from "node:fs";
import type {
  CheckConfig,
  ValidationError,
  ValidationResult,
} from "../types/index.js";
import { fsWrapper } from "../utils/fs-wrapper.js";

// ---------------------------------------------------------------------------
// Helper — build an InvalidConfig in one line
// ---------------------------------------------------------------------------

function invalid(field: string, message: string): ValidationResult {
  const error: ValidationError = { field, message, fatal: true };
  return { isValid: false, errors: [error] };
}

// ---------------------------------------------------------------------------
// Pattern-array regex validation
// ---------------------------------------------------------------------------

/**
 * Validate every pattern in an array compiles as a valid RegExp.
 * Returns the first error description, or `null` when all are valid.
 */
function validatePatternArray(
  patterns: string[],
  fieldName: string,
): ValidationError | null {
  for (const p of patterns) {
    try {
      // eslint-disable-next-line no-new
      new RegExp(p);
    } catch {
      return {
        field: fieldName,
        message: `Invalid regex pattern "${p}" in ${fieldName}`,
        fatal: true,
      };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validate a fully resolved configuration object.
 *
 * Checks are evaluated in a specific priority order; the function returns
 * immediately when the first fatal error is found (short-circuit).
 *
 * Validation cases (in order):
 * 1. `target` does not exist            → fatal
 * 2. `target` is not a directory        → fatal
 * 3. `target` has no read permission    → fatal
 * 4. _(skipped — handled by config-merger)_
 * 5. _(skipped — handled by config-merger)_
 * 6. `filename` does not end with ".md" → fatal
 * 7. `markers.start` or `markers.end` is empty string → fatal
 * 8. Invalid regex in any pattern array  → fatal
 * 9. Empty regex arrays are allowed      → no error
 * 10. `output.json` / `output.markdown` parent dir doesn't exist → fatal
 *
 * @param config - The configuration to validate.
 * @returns A discriminated-union result indicating success or listing errors.
 */
export function validateInput(config: CheckConfig): ValidationResult {
  // --- Case 1: target does not exist ---
  if (!fsWrapper.existsSync(config.target)) {
    return invalid("target", `Target path does not exist: ${config.target}`);
  }

  // --- Case 2: target is not a directory ---
  let stat;
  try {
    stat = fsWrapper.statSync(config.target);
  } catch {
    return invalid("target", `Cannot stat target path: ${config.target}`);
  }
  if (!stat.isDirectory()) {
    return invalid("target", `Target path is not a directory: ${config.target}`);
  }

  // --- Case 3: target has no read permission ---
  try {
    fsWrapper.accessSync(config.target, fs.constants.R_OK);
  } catch {
    return invalid("target", `Target path is not readable: ${config.target}`);
  }

  // --- Case 6: filename must end with ".md" ---
  if (!config.filename.endsWith(".md")) {
    return invalid(
      "filename",
      `Filename must end with ".md", got: ${config.filename}`,
    );
  }

  // --- Case 7: markers must not be empty strings ---
  if (config.markers.start === "") {
    return invalid("markers.start", "markers.start must not be empty");
  }
  if (config.markers.end === "") {
    return invalid("markers.end", "markers.end must not be empty");
  }

  // --- Case 8: validate regex patterns ---
  const patternFields: Array<{ patterns: string[]; name: string }> = [
    { patterns: config.required_any_patterns, name: "required_any_patterns" },
    { patterns: config.required_all_patterns, name: "required_all_patterns" },
    { patterns: config.forbidden_patterns, name: "forbidden_patterns" },
  ];

  for (const { patterns, name } of patternFields) {
    // Case 9: empty arrays are NOT an error — skip
    if (patterns.length === 0) continue;

    const err = validatePatternArray(patterns, name);
    if (err) return { isValid: false, errors: [err] };
  }

  // --- Case 10: output parent directory must exist ---
  if (config.output.json !== undefined) {
    const parentDir = path.dirname(config.output.json);
    if (parentDir && parentDir !== "." && !fsWrapper.existsSync(parentDir)) {
      return invalid(
        "output.json",
        `Parent directory for output.json does not exist: ${parentDir}`,
      );
    }
  }

  if (config.output.markdown !== undefined) {
    const parentDir = path.dirname(config.output.markdown);
    if (parentDir && parentDir !== "." && !fsWrapper.existsSync(parentDir)) {
      return invalid(
        "output.markdown",
        `Parent directory for output.markdown does not exist: ${parentDir}`,
      );
    }
  }

  // --- All checks passed ---
  return { isValid: true, config, errors: [] };
}
