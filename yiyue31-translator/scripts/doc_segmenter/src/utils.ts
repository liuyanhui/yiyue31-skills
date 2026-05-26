/**
 * Utility functions for the file splitting pipeline.
 *
 * - sanitizeFilename: replace unsafe characters for file names
 * - calcSizeKb: compute size in KB (UTF-8 bytes / 1024)
 * - normalizeNewlines: normalize \r\n and \r to \n
 */

/** Characters that are unsafe in file names on Windows (and generally) */
const UNSAFE_CHARS_PATTERN = /[/\\:*?"<>|]/g;

/** Pattern to collapse consecutive dashes into one */
const CONSECUTIVE_DASHES_PATTERN = /-{2,}/g;

/**
 * Replace unsafe file name characters with '-' and collapse consecutive dashes.
 *
 * Unsafe characters: / \ : * ? " < > |
 *
 * @param name - The raw name to sanitize.
 * @returns A sanitized string safe for use as a file name.
 */
export function sanitizeFilename(name: string): string {
  let result = name.replace(UNSAFE_CHARS_PATTERN, "-");
  result = result.replace(CONSECUTIVE_DASHES_PATTERN, "-");
  return result;
}

/**
 * Calculate the size of a string in KB (UTF-8 bytes / 1024).
 *
 * Uses TextEncoder which always produces UTF-8 bytes.
 * Equivalent to Python's `len(content.encode("utf-8")) / 1024`.
 *
 * @param content - The string content to measure.
 * @returns Size in KB as a number (UTF-8 encoded byte count / 1024).
 */
export function calcSizeKb(content: string): number {
  const byteCount = new TextEncoder().encode(content).length;
  return byteCount / 1024;
}

/**
 * Normalize line endings to \n.
 *
 * Converts \r\n and standalone \r to \n.
 * Python's `open(path, encoding=...)` auto-converts \r\n to \n;
 * Bun/Node do not, so we must apply this at every file-read point.
 *
 * @param content - The string content to normalize.
 * @returns Content with all line endings normalized to \n.
 */
export function normalizeNewlines(content: string): string {
  return content.replace(/\r\n?/g, "\n");
}
