/**
 * Required pattern validator module.
 *
 * Checks file content against `required_any_patterns` and
 * `required_all_patterns` regex constraints, returning the list
 * of patterns that failed to match.
 */

/**
 * Build a RegExp from a pattern string, throwing if the pattern is invalid.
 */
function compilePattern(pattern: string): RegExp {
  try {
    return new RegExp(pattern);
  } catch {
    throw new Error(`Invalid regex pattern: ${pattern}`);
  }
}

/**
 * Validate required patterns against file content.
 *
 * @param filePath - Path of the file being validated (for reporting).
 * @param fileContent - Full text content of the file.
 * @param requiredAnyPatterns - Patterns where at least one must match.
 * @param requiredAllPatterns - Patterns where every one must match.
 * @returns Lists of patterns that did not match for each category.
 */
export function validateRequiredPatterns(
  filePath: string,
  fileContent: string,
  requiredAnyPatterns: string[],
  requiredAllPatterns: string[],
): {
  /** Patterns from `required_any_patterns` that did not match. */
  required_any_missing: string[];
  /** Patterns from `required_all_patterns` that did not match. */
  required_all_missing: string[];
} {
  const required_any_missing: string[] = [];
  const required_all_missing: string[] = [];

  // --- required_any: at least ONE pattern must match ---
  if (requiredAnyPatterns.length > 0) {
    let anyMatched = false;
    for (const pattern of requiredAnyPatterns) {
      const re = compilePattern(pattern);
      if (re.test(fileContent)) {
        anyMatched = true;
      }
    }
    if (!anyMatched) {
      required_any_missing.push(...requiredAnyPatterns);
    }
  }

  // --- required_all: EVERY pattern must match ---
  for (const pattern of requiredAllPatterns) {
    const re = compilePattern(pattern);
    if (!re.test(fileContent)) {
      required_all_missing.push(pattern);
    }
  }

  return { required_any_missing, required_all_missing };
}
