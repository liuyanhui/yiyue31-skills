/**
 * Tests for directory depth distributor module.
 */

import { computeDepthDistribution } from "../../src/modules/directory-depth-distributor.js";
import type { DirectoryDepthEntry } from "../../src/types/index.js";

// ---------------------------------------------------------------------------
// 1. Empty input returns empty object
// ---------------------------------------------------------------------------
describe("computeDepthDistribution", () => {
  it("returns empty object for empty input", () => {
    const result = computeDepthDistribution([]);
    expect(result).toEqual({});
  });

  // ---------------------------------------------------------------------------
  // 2. Single depth level, all covered
  // ---------------------------------------------------------------------------
  it("produces correct bucket for single depth level with all covered", () => {
    const entries: DirectoryDepthEntry[] = [
      { path: "src/a", depth: 1, fileExists: true },
      { path: "src/b", depth: 1, fileExists: true },
    ];

    const result = computeDepthDistribution(entries);

    expect(result).toEqual({
      "1": { total: 2, covered: 2, missing: 0 },
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Multiple depths, mixed coverage
  // ---------------------------------------------------------------------------
  it("groups entries by depth with mixed coverage", () => {
    const entries: DirectoryDepthEntry[] = [
      { path: "root", depth: 0, fileExists: true },
      { path: "src/a", depth: 1, fileExists: true },
      { path: "src/b", depth: 1, fileExists: false },
      { path: "src/a/x", depth: 2, fileExists: false },
      { path: "src/a/y", depth: 2, fileExists: true },
      { path: "src/b/z", depth: 2, fileExists: false },
    ];

    const result = computeDepthDistribution(entries);

    expect(result).toEqual({
      "0": { total: 1, covered: 1, missing: 0 },
      "1": { total: 2, covered: 1, missing: 1 },
      "2": { total: 3, covered: 1, missing: 2 },
    });
  });

  // ---------------------------------------------------------------------------
  // 4. All missing at one depth
  // ---------------------------------------------------------------------------
  it("produces all-missing bucket when no files exist at a depth", () => {
    const entries: DirectoryDepthEntry[] = [
      { path: "src/a", depth: 1, fileExists: false },
      { path: "src/b", depth: 1, fileExists: false },
      { path: "src/c", depth: 1, fileExists: false },
    ];

    const result = computeDepthDistribution(entries);

    expect(result).toEqual({
      "1": { total: 3, covered: 0, missing: 3 },
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Invariant: total === covered + missing for every bucket
  // ---------------------------------------------------------------------------
  it("satisfies total === covered + missing for every bucket", () => {
    const entries: DirectoryDepthEntry[] = [
      { path: "a", depth: 0, fileExists: true },
      { path: "b", depth: 0, fileExists: false },
      { path: "c", depth: 3, fileExists: false },
      { path: "d", depth: 3, fileExists: true },
      { path: "e", depth: 3, fileExists: true },
      { path: "f", depth: 7, fileExists: false },
    ];

    const result = computeDepthDistribution(entries);

    for (const [key, bucket] of Object.entries(result)) {
      expect(bucket.total).toBe(bucket.covered + bucket.missing);
    }
  });

  // ---------------------------------------------------------------------------
  // 6. Depth keys are stringified numbers
  // ---------------------------------------------------------------------------
  it("uses stringified number keys for depth levels", () => {
    const entries: DirectoryDepthEntry[] = [
      { path: "a", depth: 5, fileExists: true },
      { path: "b", depth: 10, fileExists: false },
    ];

    const result = computeDepthDistribution(entries);

    const keys = Object.keys(result);
    expect(keys).toContain("5");
    expect(keys).toContain("10");
    expect(keys.every((k) => typeof k === "string")).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // 7. Single entry produces a single bucket
  // ---------------------------------------------------------------------------
  it("handles a single entry correctly", () => {
    const entries: DirectoryDepthEntry[] = [
      { path: "solo", depth: 3, fileExists: true },
    ];

    const result = computeDepthDistribution(entries);

    expect(result).toEqual({
      "3": { total: 1, covered: 1, missing: 0 },
    });
    expect(Object.keys(result)).toHaveLength(1);
  });
});
