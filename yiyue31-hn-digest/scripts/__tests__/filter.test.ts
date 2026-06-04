import { test, expect, describe } from "bun:test";

interface FilterComment {
  id: string;
  author: string;
  parentId: string | null;
  childIds: string[];
  depth: number;
  contentMarkdown: string;
  isOP?: boolean;
}

interface FilterConfig {
  depth: number;
  minReplies: number;
  maxComments: number;
}

/**
 * Implements the 4-step filter pipeline from the skill prompt (T-009).
 * This mirrors the filtering rules described in SKILL.md Step 6.
 *
 * IMPORTANT: If SKILL.md filtering rules change, this implementation must be updated to match.
 */
function applyFilters(
  comments: FilterComment[],
  config: FilterConfig,
  postAuthor: string
): FilterComment[] {
  // Step 6.1: Depth Truncation
  let filtered = comments.filter((c) => c.depth <= config.depth);

  // Recalculate childIds based on remaining comments
  const remainingIds = new Set(filtered.map((c) => c.id));
  filtered = filtered.map((c) => ({
    ...c,
    childIds: c.childIds.filter((id) => remainingIds.has(id)),
  }));

  // Step 6.2: Activity Filter
  filtered = filtered.filter((c) => c.childIds.length >= config.minReplies);

  // Step 6.3: Quantity Cap
  filtered.sort((a, b) => b.childIds.length - a.childIds.length);
  filtered = filtered.slice(0, config.maxComments);

  // Step 6.4: OP Identification
  filtered = filtered.map((c) => ({
    ...c,
    isOP: c.author === postAuthor,
  }));

  return filtered;
}

describe("Comment Filtering Pipeline", () => {
  const postAuthor = "testuser";

  describe("Step 6.1: Depth Truncation", () => {
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

  describe("Step 6.2: Activity Filter", () => {
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

  describe("Step 6.3: Quantity Cap", () => {
    test("takes top maxComments by childIds.length", () => {
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
      // First result should have the most childIds
      expect(result[0].childIds.length).toBeGreaterThanOrEqual(result[result.length - 1].childIds.length);
    });
  });

  describe("Step 6.4: OP Identification", () => {
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
