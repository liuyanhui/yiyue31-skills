/**
 * Directory depth distributor module.
 *
 * Groups scanned directories by their depth level and computes
 * coverage statistics (total / covered / missing) per depth bucket.
 */

import type {
  DirectoryDepthEntry,
  DepthDistributionResult,
} from "../types/index.js";

/**
 * Compute depth distribution from a list of directory entries.
 *
 * @param entries - List of directory entries with depth and file-existence info.
 * @returns Mapping from depth level (as string) to coverage counts.
 */
export function computeDepthDistribution(
  entries: DirectoryDepthEntry[],
): DepthDistributionResult {
  if (entries.length === 0) {
    return {};
  }

  const buckets: DepthDistributionResult = {};

  for (const entry of entries) {
    const key = String(entry.depth);

    if (!buckets[key]) {
      buckets[key] = { total: 0, covered: 0, missing: 0 };
    }

    buckets[key].total += 1;

    if (entry.fileExists) {
      buckets[key].covered += 1;
    } else {
      buckets[key].missing += 1;
    }
  }

  return buckets;
}
