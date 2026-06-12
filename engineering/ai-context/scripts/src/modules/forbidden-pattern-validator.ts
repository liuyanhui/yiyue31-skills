/**
 * Forbidden pattern validator module.
 *
 * Scans file content for patterns that must NOT be present,
 * returning match details with surrounding context.
 */

import type { ForbiddenFoundEntry, ForbiddenMatch } from "../types/index.js";

/** Number of characters to capture before and after a match for context. */
const CONTEXT_RADIUS = 50;

/**
 * Build a global RegExp from a pattern string.
 *
 * @param pattern - Regex pattern string.
 * @returns A global, case-sensitive RegExp.
 * @throws Error if the pattern is not a valid regex.
 */
function compileGlobal(pattern: string): RegExp {
  try {
    return new RegExp(pattern, "g");
  } catch {
    throw new Error(`Invalid regex pattern: ${pattern}`);
  }
}

/**
 * Validate that no forbidden patterns appear in the file content.
 *
 * For each forbidden pattern, finds ALL occurrences in the content using
 * global, case-sensitive regex matching. Each match is reported with
 * surrounding context (up to 50 characters before and after the match).
 *
 * Context extraction uses `String.prototype.slice` so multi-byte UTF-8
 * characters are never truncated mid-character.
 *
 * @param filePath - Path of the file being validated.
 * @param fileContent - Full text content of the file.
 * @param forbiddenPatterns - Regex patterns that must not appear.
 * @returns List of forbidden-pattern matches with context (empty if clean).
 */
export function validateForbiddenPatterns(
  filePath: string,
  fileContent: string,
  forbiddenPatterns: string[],
): ForbiddenFoundEntry[] {
  if (forbiddenPatterns.length === 0) {
    return [];
  }

  const matches: ForbiddenMatch[] = [];

  for (const pattern of forbiddenPatterns) {
    const re = compileGlobal(pattern);
    let execResult: RegExpExecArray | null;

    while ((execResult = re.exec(fileContent)) !== null) {
      const matchStart = execResult.index;
      const matchEnd = matchStart + execResult[0].length;

      const beforeStart = Math.max(0, matchStart - CONTEXT_RADIUS);
      const afterEnd = Math.min(fileContent.length, matchEnd + CONTEXT_RADIUS);

      const before = fileContent.slice(beforeStart, matchStart);
      const matched = execResult[0];
      const after = fileContent.slice(matchEnd, afterEnd);

      matches.push({
        pattern,
        context: before + matched + after,
      });
    }
  }

  if (matches.length === 0) {
    return [];
  }

  return [{ file: filePath, matches }];
}
