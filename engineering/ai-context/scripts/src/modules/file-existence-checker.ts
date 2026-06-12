/**
 * File existence checker module.
 *
 * For each scanned directory, checks whether the expected target file
 * (e.g. `CLAUDE.md`) exists and returns the result.
 */

import type { DirectoryInfo, FileExistenceResult } from "../types/index.js";
import { existsSync, lstatSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * Check whether the target file exists in each of the given directories.
 *
 * For each directory in the input list, constructs the expected file path as
 * `path.join(targetRoot, dirInfo.directory, filename)` and checks whether a
 * regular file (not a symlink) exists at that location.
 *
 * @param directories - List of directories to check.
 * @param filename - Target filename to look for (e.g. `"CLAUDE.md"`).
 * @param targetRoot - Absolute path to the scan root directory.
 * @returns Per-directory existence results, same length and order as input.
 */
export function checkFileExistence(
  directories: DirectoryInfo[],
  filename: string,
  targetRoot: string,
): FileExistenceResult[] {
  return directories.map((dirInfo): FileExistenceResult => {
    const subPath = dirInfo.directory === "." ? "" : dirInfo.directory;
    const expectedPath = resolve(join(targetRoot, subPath, filename));

    let fileExists = false;

    if (existsSync(expectedPath)) {
      const stat = lstatSync(expectedPath);
      fileExists = stat.isFile() && !stat.isSymbolicLink();
    }

    return {
      directory: dirInfo.directory,
      depth: dirInfo.depth,
      fileExists,
      filePath: expectedPath,
    };
  });
}
