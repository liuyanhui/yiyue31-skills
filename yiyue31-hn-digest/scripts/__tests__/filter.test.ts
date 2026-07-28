import { test, expect, describe } from "bun:test";
import { applyFilters, type FilterComment, type FilterConfig } from "../lib/filter";

// applyFilters + helpers live in scripts/lib/filter.ts (shared with preprocess.ts).
// These tests exercise that one production implementation.

describe("Comment Filtering Pipeline", () => {
  const postAuthor = "testuser";

  describe("Step 5.1: Depth Truncation", () => {
    test("removes comments deeper than config.depth", () => {
      const comments: FilterComment[] = [
        { id: "1", author: "a", parentId: null, childIds: ["2", "3"], depth: 0, contentMarkdown: "" },
        { id: "2", author: "b", parentId: "1", childIds: ["4"], depth: 1, contentMarkdown: "" },
        { id: "3", author: "c", parentId: "1", childIds: [], depth: 1, contentMarkdown: "" },
        { id: "4", author: "d", parentId: "2", childIds: ["5"], depth: 2, contentMarkdown: "" },
        { id: "5", author: "e", parentId: "4", childIds: [], depth: 3, contentMarkdown: "" },
      ];

      const result = applyFilters(comments, { depth: 2, minReplies: 0, maxComments: 100 }, postAuthor);

      const ids = result.map((c) => c.id);
      expect(ids).toContain("1");
      expect(ids).toContain("2");
      expect(ids).toContain("3");
      expect(ids).toContain("4");
      expect(ids).not.toContain("5"); // depth 3 removed
    });

    test("recalculates childIds after depth truncation", () => {
      const comments: FilterComment[] = [
        { id: "1", author: "a", parentId: null, childIds: ["2"], depth: 0, contentMarkdown: "" },
        { id: "2", author: "b", parentId: "1", childIds: ["3"], depth: 1, contentMarkdown: "" },
        { id: "3", author: "c", parentId: "2", childIds: [], depth: 2, contentMarkdown: "" },
      ];

      // With depth=1, comment 3 is removed.
      // Comment 2's childIds should be recalculated to [] (since 3 is gone).
      const result = applyFilters(comments, { depth: 1, minReplies: 0, maxComments: 100 }, postAuthor);

      const comment1 = result.find((c) => c.id === "1");
      const comment2 = result.find((c) => c.id === "2");

      expect(comment1?.childIds).toEqual(["2"]); // 2 still exists
      expect(comment2?.childIds).toEqual([]); // 3 was removed
    });
  });

  describe("Step 5.2: Activity Filter", () => {
    test("removes comments with childIds.length < minReplies", () => {
      const comments: FilterComment[] = [
        { id: "1", author: "a", parentId: null, childIds: ["2", "3", "4"], depth: 0, contentMarkdown: "" },
        { id: "2", author: "b", parentId: "1", childIds: ["5", "6", "7"], depth: 1, contentMarkdown: "" },
        { id: "3", author: "c", parentId: "1", childIds: ["8"], depth: 1, contentMarkdown: "" },
        { id: "4", author: "d", parentId: "1", childIds: [], depth: 1, contentMarkdown: "" },
        { id: "5", author: "e", parentId: "2", childIds: [], depth: 2, contentMarkdown: "" },
        { id: "6", author: "f", parentId: "2", childIds: [], depth: 2, contentMarkdown: "" },
        { id: "7", author: "g", parentId: "2", childIds: [], depth: 2, contentMarkdown: "" },
        { id: "8", author: "h", parentId: "3", childIds: [], depth: 2, contentMarkdown: "" },
      ];

      const result = applyFilters(comments, { depth: 5, minReplies: 3, maxComments: 100 }, postAuthor);

      const ids = result.map((c) => c.id);
      expect(ids).toContain("1"); // 3 childIds (2,3,4 all exist)
      expect(ids).toContain("2"); // 3 childIds (5,6,7 all exist)
      expect(ids).not.toContain("3"); // only 1 childId
      expect(ids).not.toContain("4"); // 0 childIds
    });
  });

  describe("Step 5.3: Diversity-preserving selection", () => {
    test("respects maxComments cap and outputs heat order", () => {
      const comments: FilterComment[] = Array.from({ length: 50 }, (_, i) => ({
        id: `c${i}`,
        author: `author${i}`,
        parentId: null,
        childIds: Array.from({ length: 50 - i }, (_, j) => `child${i}-${j}`),
        depth: 0,
        contentMarkdown: `Comment ${i}`,
      }));

      const result = applyFilters(comments, { depth: 5, minReplies: 0, maxComments: 30 }, postAuthor);

      expect(result.length).toBe(30);
      // Output is heat-ordered (first has most childIds)
      expect(result[0].childIds.length).toBeGreaterThanOrEqual(result[result.length - 1].childIds.length);
    });

    test("always includes OP comments even with zero replies", () => {
      // OP has the fewest childIds; pure heat top-N would drop it, diversity selection keeps it.
      const comments: FilterComment[] = [
        { id: "hot1", author: "other", parentId: null, childIds: ["a", "b", "c"], depth: 0, contentMarkdown: "" },
        { id: "hot2", author: "other", parentId: null, childIds: ["d", "e"], depth: 0, contentMarkdown: "" },
        { id: "op", author: "testuser", parentId: null, childIds: [], depth: 0, contentMarkdown: "OP" },
      ];

      const result = applyFilters(comments, { depth: 5, minReplies: 0, maxComments: 2 }, postAuthor);

      expect(result.map((c) => c.id)).toContain("op");
      expect(result.length).toBe(2);
    });

    test("guarantees a representative per top-level subtree", () => {
      const comments: FilterComment[] = [
        // subtree A (root a1)
        { id: "a1", author: "x", parentId: null, childIds: ["a2", "a3"], depth: 0, contentMarkdown: "" },
        { id: "a2", author: "x", parentId: "a1", childIds: ["a4"], depth: 1, contentMarkdown: "" },
        { id: "a3", author: "x", parentId: "a1", childIds: [], depth: 1, contentMarkdown: "" },
        { id: "a4", author: "x", parentId: "a2", childIds: [], depth: 2, contentMarkdown: "" },
        // subtree B (root b1)
        { id: "b1", author: "y", parentId: null, childIds: ["b2"], depth: 0, contentMarkdown: "" },
        { id: "b2", author: "y", parentId: "b1", childIds: [], depth: 1, contentMarkdown: "" },
      ];

      const result = applyFilters(comments, { depth: 5, minReplies: 0, maxComments: 2 }, postAuthor);
      const ids = new Set(result.map((c) => c.id));
      expect(ids.has("a1")).toBe(true);
      expect(ids.has("b1")).toBe(true);
    });
  });

  describe("Step 5.4: OP Identification", () => {
    test("marks OP comments correctly", () => {
      const comments: FilterComment[] = [
        { id: "1", author: "testuser", parentId: null, childIds: ["2"], depth: 0, contentMarkdown: "OP reply" },
        { id: "2", author: "otheruser", parentId: "1", childIds: [], depth: 1, contentMarkdown: "Other reply" },
      ];

      const result = applyFilters(comments, { depth: 5, minReplies: 0, maxComments: 100 }, postAuthor);

      const opComment = result.find((c) => c.id === "1");
      const otherComment = result.find((c) => c.id === "2");

      expect(opComment?.isOP).toBe(true);
      expect(otherComment?.isOP).toBe(false);
    });
  });

  describe("Combined Pipeline", () => {
    test("full filter chain with realistic data", () => {
      const comments: FilterComment[] = [
        // Top-level comments
        { id: "c1", author: "testuser", parentId: null, childIds: ["c2", "c3", "c4"], depth: 0, contentMarkdown: "Top comment by OP" },
        { id: "c2", author: "user1", parentId: "c1", childIds: ["c5"], depth: 1, contentMarkdown: "Reply 1" },
        { id: "c3", author: "user2", parentId: "c1", childIds: [], depth: 1, contentMarkdown: "Reply 2" },
        { id: "c4", author: "user3", parentId: "c1", childIds: [], depth: 1, contentMarkdown: "Reply 3" },
        { id: "c5", author: "user4", parentId: "c2", childIds: ["c6"], depth: 2, contentMarkdown: "Reply 4" },
        { id: "c6", author: "user5", parentId: "c5", childIds: [], depth: 3, contentMarkdown: "Deep reply" },
        // Another top-level
        { id: "c7", author: "user6", parentId: null, childIds: ["c8", "c9", "c10"], depth: 0, contentMarkdown: "Another top" },
        { id: "c8", author: "user7", parentId: "c7", childIds: [], depth: 1, contentMarkdown: "Reply" },
        { id: "c9", author: "user8", parentId: "c7", childIds: [], depth: 1, contentMarkdown: "Reply" },
        { id: "c10", author: "user9", parentId: "c7", childIds: [], depth: 1, contentMarkdown: "Reply" },
      ];

      // depth=2, minReplies=1, maxComments=5
      const result = applyFilters(comments, { depth: 2, minReplies: 1, maxComments: 5 }, "testuser");

      // After depth truncation: c6 (depth 3) removed. c5's childIds recalculated to [].
      // c1: childIds=[c2,c3,c4] (3), c7: childIds=[c8,c9,c10] (3) — survive minReplies=1
      // c2: childIds=[c5] (1) — survives. c5: childIds=[] (0 after recalc) — removed.
      // So remaining: c1(3), c7(3), c2(1) = 3 comments
      expect(result.length).toBe(3);

      // OP check
      const opComment = result.find((c) => c.id === "c1");
      expect(opComment?.isOP).toBe(true);

      // Sorted by childIds.length desc
      expect(result[0].childIds.length).toBe(3);
      expect(result[1].childIds.length).toBe(3);
      expect(result[2].childIds.length).toBe(1);
    });
  });

  describe("Edge Cases", () => {
    test("0 comments after filtering", () => {
      const comments: FilterComment[] = [
        { id: "1", author: "a", parentId: null, childIds: [], depth: 0, contentMarkdown: "" },
        { id: "2", author: "b", parentId: null, childIds: [], depth: 0, contentMarkdown: "" },
      ];

      // minReplies=5 removes everything
      const result = applyFilters(comments, { depth: 5, minReplies: 5, maxComments: 100 }, postAuthor);

      expect(result.length).toBe(0);
    });
  });
});
