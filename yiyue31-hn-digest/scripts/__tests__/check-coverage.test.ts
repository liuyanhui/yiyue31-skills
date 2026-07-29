import { test, expect, describe } from "bun:test";
import { checkCoverage } from "../check-coverage";

// Build minimal fixtures matching the shapes checkCoverage reads.
const filtered = (ids: string[]) => ({ active: ids.map((id) => ({ id })) });
const sub = (ids: string[]) => ({ name: "x", dimension: "stance", summary: "s", commentIds: ids });
const group = (name: string, ids: string[], subs: string[][] = []) => ({
  name,
  dimension: "topic",
  summary: "s",
  commentIds: ids,
  subGroups: subs.map(sub),
});

describe("checkCoverage", () => {
  test("clean when every active id is in exactly one group", () => {
    const r = checkCoverage(filtered(["a", "b", "c"]), {
      groups: [group("g1", ["a", "b"]), group("g2", ["c"])],
    });
    expect(r.clean).toBe(true);
    expect(r.missing).toEqual([]);
    expect(r.duplicate).toEqual([]);
    expect(r.extra).toEqual([]);
  });

  test("a comment in a parent group AND its own subGroup is NOT a duplicate", () => {
    // Per spec, group.commentIds already unions its subGroups.
    const r = checkCoverage(filtered(["a", "b"]), {
      groups: [group("g1", ["a", "b"], [["a"]])],
    });
    expect(r.clean).toBe(true);
    expect(r.duplicate).toEqual([]);
  });

  test("reports active ids missing from every group", () => {
    const r = checkCoverage(filtered(["a", "b", "c"]), { groups: [group("g1", ["a"])] });
    expect(r.clean).toBe(false);
    expect(r.missing.sort()).toEqual(["b", "c"]);
    expect(r.duplicate).toEqual([]);
  });

  test("reports an id owned by two different top-level groups", () => {
    const r = checkCoverage(filtered(["a", "b"]), {
      groups: [group("g1", ["a"]), group("g2", ["a", "b"])],
    });
    expect(r.clean).toBe(false);
    expect(r.duplicate).toEqual(["a"]);
    expect(r.missing).toEqual([]);
  });

  test("reports grouped ids that are not in active (extra)", () => {
    const r = checkCoverage(filtered(["a"]), { groups: [group("g1", ["a", "z"])] });
    expect(r.clean).toBe(false);
    expect(r.extra).toEqual(["z"]);
  });

  test("handles missing active / groups gracefully", () => {
    const r = checkCoverage({ active: [] }, { groups: [] });
    expect(r.clean).toBe(true);
  });
});
