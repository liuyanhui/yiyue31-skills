/**
 * Tests for the marker-matcher module.
 *
 * Verifies flexible matching: a marker configured as the simple form
 * `<!-- skill: yiyue31-context -->` must also match the skill's attributed
 * (versioned) form `<!-- skill: yiyue31-context | version: .. | update_time: .. -->`.
 */

import {
  findMarkerIndex,
  matchedMarkerLength,
  containsMarker,
  extractMarkerMatch,
} from "../../src/modules/marker-matcher.js";

const SIMPLE_START = "<!-- skill: yiyue31-context -->";
const VERSIONED_START =
  "<!-- skill: yiyue31-context | version: 0.0.2 | update_time: 2026-07-07 -->";
const END = "<!-- /yiyue31-context -->";

describe("marker-matcher — containsMarker", () => {
  it("matches the simple start marker", () => {
    expect(containsMarker(`# x\n${SIMPLE_START}\nbody\n${END}`, SIMPLE_START)).toBe(true);
  });

  it("matches the versioned start marker when configured with the simple form", () => {
    expect(containsMarker(`# x\n${VERSIONED_START}\nbody\n${END}`, SIMPLE_START)).toBe(true);
  });

  it("returns false when the marker is absent", () => {
    expect(containsMarker("# just a file\n", SIMPLE_START)).toBe(false);
  });
});

describe("marker-matcher — findMarkerIndex", () => {
  it("finds the versioned start marker at the same index as a literal search would", () => {
    const content = `# x\n${VERSIONED_START}\nbody\n${END}`;
    expect(findMarkerIndex(content, SIMPLE_START)).toBe(content.indexOf(VERSIONED_START));
  });

  it("respects fromIndex (does not re-find an earlier occurrence)", () => {
    const content = `${SIMPLE_START} mid ${END}`;
    const first = findMarkerIndex(content, SIMPLE_START);
    expect(first).toBe(0);
    expect(findMarkerIndex(content, SIMPLE_START, first + 1)).toBe(-1);
  });

  it("returns -1 when the marker is absent", () => {
    expect(findMarkerIndex("# no markers\n", SIMPLE_START)).toBe(-1);
  });
});

describe("marker-matcher — matchedMarkerLength", () => {
  it("returns the versioned marker's full length (longer than the simple form)", () => {
    const content = `${VERSIONED_START} body ${END}`;
    const idx = findMarkerIndex(content, SIMPLE_START);
    expect(matchedMarkerLength(content, SIMPLE_START, idx)).toBe(VERSIONED_START.length);
    expect(VERSIONED_START.length).toBeGreaterThan(SIMPLE_START.length);
  });

  it("returns the simple form length for a simple marker", () => {
    const content = `${SIMPLE_START} body ${END}`;
    const idx = findMarkerIndex(content, SIMPLE_START);
    expect(matchedMarkerLength(content, SIMPLE_START, idx)).toBe(SIMPLE_START.length);
  });
});

describe("marker-matcher — extractMarkerMatch", () => {
  it("returns the full versioned marker text (enables update_time extraction)", () => {
    const content = `# x\n${VERSIONED_START}\nbody\n${END}`;
    expect(extractMarkerMatch(content, SIMPLE_START)).toBe(VERSIONED_START);
  });

  it("returns null when absent", () => {
    expect(extractMarkerMatch("# no markers\n", SIMPLE_START)).toBeNull();
  });
});
