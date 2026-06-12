/**
 * Directory scanner module.
 *
 * Recursively scans the target directory tree, applying include/exclude
 * filters, and returns a flat list of discovered directories with
 * their depth information.
 *
 * Filtering uses directory **name** matching (not full path).
 * Include patterns override exclude patterns.
 * Symlinks and non-directory entries are skipped.
 *
 * The target root is always included at depth 1 as the first entry.
 * Results are ordered breadth-first.
 */

import type { CheckConfig, DirectoryInfo } from "../types/index.js";
import { readdirSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Check whether a directory name should be excluded based on the
 * configured exclude/include lists.
 *
 * Exclude matches by name. Include overrides exclude.
 */
function isExcluded(name: string, exclude: string[], include: string[]): boolean {
  if (include.includes(name)) {
    return false;
  }
  return exclude.includes(name);
}

/**
 * Scan the target directory tree and return all directories that
 * match the configured include/exclude filters.
 *
 * @param config - Fully resolved configuration.
 * @returns Flat list of discovered directories with depth info,
 *          breadth-first ordered. The target root is always first
 *          at depth 1. `directory` holds a relative path to target root
 *          ("." for the root itself).
 */
export function scanDirectories(config: CheckConfig): DirectoryInfo[] {
  const root = config.target;
  const result: DirectoryInfo[] = [{ directory: ".", depth: 1 }];

  // BFS queue: entries are { absolutePath, relativePath, depth }
  const queue: Array<{ absolutePath: string; relativePath: string; depth: number }> = [
    { absolutePath: root, relativePath: ".", depth: 1 },
  ];

  while (queue.length > 0) {
    const current = queue.shift()!;

    let entries;
    try {
      entries = readdirSync(current.absolutePath, { withFileTypes: true });
    } catch {
      // If we cannot read a directory, skip it silently
      continue;
    }

    for (const dirent of entries) {
      // Skip symlinks
      if (dirent.isSymbolicLink()) {
        continue;
      }

      // Skip non-directories
      if (!dirent.isDirectory()) {
        continue;
      }

      // Check exclude/include by directory name
      if (isExcluded(dirent.name, config.exclude, config.include)) {
        continue;
      }

      const childRelative = join(current.relativePath, dirent.name);
      const childDepth = current.depth + 1;

      result.push({ directory: childRelative, depth: childDepth });

      // Enqueue for further scanning
      queue.push({
        absolutePath: join(root, childRelative),
        relativePath: childRelative,
        depth: childDepth,
      });
    }
  }

  return result;
}
