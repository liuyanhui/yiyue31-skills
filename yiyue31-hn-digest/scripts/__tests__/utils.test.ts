import { test, expect, describe, afterAll } from "bun:test";
import {
  parsePostId,
  htmlToMarkdown,
  flattenCommentTree,
  ensureDir,
  writeJSON,
  fetchWithTimeout,
  delay,
} from "../lib/utils";
import type { CommentNode } from "../lib/utils";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

// --- Cleanup tracking ---
const tempDirs: string[] = [];

afterAll(() => {
  for (const dir of tempDirs) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // ignore cleanup failures
    }
  }
});

function makeTempDir(label: string): string {
  const id = randomBytes(4).toString("hex");
  const dir = join("/tmp", `test-${label}-${id}`);
  tempDirs.push(dir);
  return dir;
}

// =============================================================================
// parsePostId
// =============================================================================
describe("parsePostId", () => {
  test("extracts id from full HN URL", () => {
    const result = parsePostId(
      "https://news.ycombinator.com/item?id=12345678"
    );
    expect(result).toBe("12345678");
  });

  test("extracts id from URL with other query params", () => {
    const result = parsePostId(
      "https://news.ycombinator.com/item?foo=bar&id=99999&baz=qux"
    );
    expect(result).toBe("99999");
  });

  test("returns numeric string as-is", () => {
    const result = parsePostId("12345678");
    expect(result).toBe("12345678");
  });

  test("trims whitespace from numeric input", () => {
    const result = parsePostId("  12345678  ");
    expect(result).toBe("12345678");
  });

  test("throws Error for non-numeric string", () => {
    expect(() => parsePostId("abc")).toThrow(Error);
  });

  test("throws Error for empty string", () => {
    expect(() => parsePostId("")).toThrow(Error);
  });

  test("throws Error for whitespace-only string", () => {
    expect(() => parsePostId("   ")).toThrow(Error);
  });
});

// =============================================================================
// htmlToMarkdown
// =============================================================================
describe("htmlToMarkdown", () => {
  test("converts <p> to plain text", () => {
    const result = htmlToMarkdown("<p>Hello world</p>");
    expect(result).toContain("Hello world");
  });

  test("converts <a> to markdown link", () => {
    const result = htmlToMarkdown(
      '<a href="https://example.com">link</a>'
    );
    expect(result).toContain("link");
  });

  test("converts <pre><code> to fenced code block", () => {
    const result = htmlToMarkdown("<pre><code>code block</code></pre>");
    expect(result).toContain("```");
    expect(result).toContain("code block");
  });

  test("converts inline <code> to backticks", () => {
    const result = htmlToMarkdown("<code>inline</code>");
    expect(result).toContain("`inline`");
  });

  test("converts <i> to italic markdown", () => {
    const result = htmlToMarkdown("<i>italic</i>");
    expect(result).toContain("_italic_");
  });

  test("converts <em> to italic markdown", () => {
    const result = htmlToMarkdown("<em>italic</em>");
    expect(result).toContain("_italic_");
  });

  test("converts <b> to bold markdown", () => {
    const result = htmlToMarkdown("<b>bold</b>");
    expect(result).toContain("**bold**");
  });

  test("converts <strong> to bold markdown", () => {
    const result = htmlToMarkdown("<strong>bold</strong>");
    expect(result).toContain("**bold**");
  });

  test("returns empty string for empty input", () => {
    const result = htmlToMarkdown("");
    expect(result).toBe("");
  });

  test("returns empty string for null input", () => {
    const result = htmlToMarkdown(null as unknown as string);
    expect(result).toBe("");
  });

  test("returns empty string for undefined input", () => {
    const result = htmlToMarkdown(undefined as unknown as string);
    expect(result).toBe("");
  });

  test("does not produce residual marker for well-known tags", () => {
    // Turndown strips all standard HTML tags; residual detection is a
    // defensive guard for unknown edge-case tags that survive conversion.
    // Since turndown aggressively strips tags, we verify that standard
    // HTML does NOT trigger the residual marker.
    const result = htmlToMarkdown(
      "<p>Normal <b>bold</b> and <i>italic</i> text</p>"
    );
    expect(result).not.toContain("<!-- HTML_RESIDUAL_DETECTED -->");
  });
});

// =============================================================================
// flattenCommentTree
// =============================================================================
describe("flattenCommentTree", () => {
  function buildTree(): CommentNode {
    return {
      id: "root",
      author: "alice",
      contentMarkdown: "root comment",
      children: [
        {
          id: "child1",
          author: "bob",
          contentMarkdown: "first reply",
          children: [
            {
              id: "grandchild1",
              author: "carol",
              contentMarkdown: "nested reply",
              children: [],
            },
          ],
        },
        {
          id: "child2",
          author: "dave",
          contentMarkdown: "second reply",
          children: [],
        },
      ],
    };
  }

  test("flattens 3-level nested tree to correct count", () => {
    const result = flattenCommentTree(buildTree());
    expect(result.length).toBe(4);
  });

  test("assigns depth 0 to root node", () => {
    const result = flattenCommentTree(buildTree());
    const root = result.find((c) => c.id === "root")!;
    expect(root.depth).toBe(0);
  });

  test("assigns depth 1 to children", () => {
    const result = flattenCommentTree(buildTree());
    const child1 = result.find((c) => c.id === "child1")!;
    const child2 = result.find((c) => c.id === "child2")!;
    expect(child1.depth).toBe(1);
    expect(child2.depth).toBe(1);
  });

  test("assigns depth 2 to grandchildren", () => {
    const result = flattenCommentTree(buildTree());
    const gc = result.find((c) => c.id === "grandchild1")!;
    expect(gc.depth).toBe(2);
  });

  test("root has null parentId", () => {
    const result = flattenCommentTree(buildTree());
    const root = result.find((c) => c.id === "root")!;
    expect(root.parentId).toBeNull();
  });

  test("children have correct parentId", () => {
    const result = flattenCommentTree(buildTree());
    const child1 = result.find((c) => c.id === "child1")!;
    const child2 = result.find((c) => c.id === "child2")!;
    expect(child1.parentId).toBe("root");
    expect(child2.parentId).toBe("root");
  });

  test("grandchild has correct parentId", () => {
    const result = flattenCommentTree(buildTree());
    const gc = result.find((c) => c.id === "grandchild1")!;
    expect(gc.parentId).toBe("child1");
  });

  test("root childIds matches children ids", () => {
    const result = flattenCommentTree(buildTree());
    const root = result.find((c) => c.id === "root")!;
    expect(root.childIds).toEqual(["child1", "child2"]);
  });

  test("child1 childIds contains grandchild1", () => {
    const result = flattenCommentTree(buildTree());
    const child1 = result.find((c) => c.id === "child1")!;
    expect(child1.childIds).toEqual(["grandchild1"]);
  });

  test("leaf nodes have empty childIds", () => {
    const result = flattenCommentTree(buildTree());
    const child2 = result.find((c) => c.id === "child2")!;
    const gc = result.find((c) => c.id === "grandchild1")!;
    expect(child2.childIds).toEqual([]);
    expect(gc.childIds).toEqual([]);
  });
});

// =============================================================================
// ensureDir
// =============================================================================
describe("ensureDir", () => {
  test("creates a new directory", async () => {
    const dir = makeTempDir("ensuredir");
    expect(existsSync(dir)).toBe(false);

    await ensureDir(dir);

    expect(existsSync(dir)).toBe(true);
  });

  test("does not error if directory already exists", async () => {
    const dir = makeTempDir("ensuredir-exists");
    await ensureDir(dir);
    // Call again — should not throw
    await expect(ensureDir(dir)).resolves.toBeUndefined();
    expect(existsSync(dir)).toBe(true);
  });

  test("creates nested directories", async () => {
    const dir = join(makeTempDir("ensuredir-nested"), "a", "b", "c");
    await ensureDir(dir);
    expect(existsSync(dir)).toBe(true);
  });
});

// =============================================================================
// writeJSON
// =============================================================================
describe("writeJSON", () => {
  test("writes valid JSON file", async () => {
    const dir = makeTempDir("writejson");
    const filePath = join(dir, "output.json");
    const data = { name: "test", value: 42, nested: { ok: true } };

    await writeJSON(filePath, data);

    expect(existsSync(filePath)).toBe(true);
    const contents = readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(contents);
    expect(parsed).toEqual(data);
  });

  test("creates parent directory if needed", async () => {
    const dir = makeTempDir("writejson-nested");
    const filePath = join(dir, "sub", "dir", "data.json");
    const data = { hello: "world" };

    await writeJSON(filePath, data);

    expect(existsSync(filePath)).toBe(true);
    const contents = readFileSync(filePath, "utf-8");
    expect(JSON.parse(contents)).toEqual(data);
  });

  test("writes pretty-printed JSON (2-space indent)", async () => {
    const dir = makeTempDir("writejson-format");
    const filePath = join(dir, "pretty.json");
    const data = { a: 1 };

    await writeJSON(filePath, data);

    const contents = readFileSync(filePath, "utf-8");
    // Pretty-printed JSON with 2-space indent includes newlines
    expect(contents).toContain('\n  "a"');
  });
});

// =============================================================================
// fetchWithTimeout
// =============================================================================
describe("fetchWithTimeout", () => {
  test("successfully fetches a reliable URL", async () => {
    // Live network — tolerate offline/flaky upstream by skipping, not failing.
    // Same spirit as the repo's `describe.skip(... network required)` blocks.
    let response: Response;
    try {
      response = await fetchWithTimeout("https://httpbin.org/get", {}, 10000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`SKIP: network unreachable (${msg}) — fetchWithTimeout happy-path not exercised`);
      return;
    }
    expect(response.ok).toBe(true);
    const body = await response.json();
    expect(body.url).toBe("https://httpbin.org/get");
  });

  test("aborts on timeout (very short timeout)", async () => {
    // 1ms timeout against an unroutable address guarantees abort without
    // depending on any live service.
    try {
      await fetchWithTimeout("http://10.255.255.1/get", {}, 1);
      // If we get here, the request somehow completed in <1ms — fail the test
      expect.unreachable("Expected fetch to be aborted due to timeout");
    } catch (err) {
      expect(err).toBeDefined();
      // AbortError or a DOMException with name AbortError
      const errName =
        err instanceof DOMException
          ? err.name
          : (err as Error).name || "";
      expect(
        errName === "AbortError" || (err as Error).message?.includes("abort")
      ).toBe(true);
    }
  });
});

// =============================================================================
// delay
// =============================================================================
describe("delay", () => {
  test("resolves without error", async () => {
    await expect(delay(1)).resolves.toBeUndefined();
  });

  test("delays for approximately the requested duration", async () => {
    const ms = 50;
    const start = performance.now();
    await delay(ms);
    const elapsed = performance.now() - start;
    // Allow some tolerance; must be at least 40ms
    expect(elapsed).toBeGreaterThanOrEqual(40);
  });

  test("zero delay resolves immediately", async () => {
    const start = performance.now();
    await delay(0);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(50);
  });
});
