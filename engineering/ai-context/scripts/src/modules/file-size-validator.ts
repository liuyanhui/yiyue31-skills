/**
 * File size validator module.
 *
 * Checks whether a file's byte size is within the configured limit.
 */

import type { FileSizeValidationResult } from "../types/index.js";
import { statSync } from "node:fs";

/**
 * Validate that a file's size does not exceed the configured maximum.
 *
 * Reads the actual file size from disk using `fs.statSync` and compares it
 * against `maxFileSize`. A file whose size is **greater than or equal to**
 * the limit is considered oversized (`passed: false`). A zero-byte file
 * always passes.
 *
 * **Note:** File existence is validated upstream by the File Existence
 * Checker. If the file does not exist, this function throws an `Error`
 * (the underlying Node.js `ENOENT` error from `statSync`).
 *
 * @param filePath - Absolute path to the file to validate.
 * @param maxFileSize - Maximum allowed file size in bytes.
 * @returns Validation result with pass/fail status and size details.
 * @throws {Error} If the file does not exist (ENOENT).
 */
export function validateFileSize(
  filePath: string,
  maxFileSize: number,
): FileSizeValidationResult {
  const actual_size = statSync(filePath).size;
  const passed = actual_size < maxFileSize;

  return {
    passed,
    actual_size,
    max_size: maxFileSize,
  };
}
