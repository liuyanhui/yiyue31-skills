import { fetchWithTimeout, htmlToMarkdown, flattenCommentTree, parsePostId, writeJSON } from "./lib/utils";
import type { CommentNode, FlatComment } from "./lib/utils";

const ALGOLIA_API_BASE = "https://hn.algolia.com/api/v1";

// Safety net for extreme threads (Algolia returns the whole tree in one
// response, unlike Firebase's bounded recursive fetch). Normal threads stay
// untouched; on truncation the raw data carries truncated/originalCommentCount
// and the final article header discloses it.
const DEFAULT_MAX_FETCH_ALGOLIA = 2000;

interface AlgoliaChild {
  id: number;
  created_at?: string;
  author?: string;
  text?: string;
  story_id?: number;
  parent_id?: number | null;
  children?: AlgoliaChild[];
}

interface AlgoliaResponse {
  id: number;
  created_at?: string;
  author?: string;
  title?: string;
  url?: string;
  points?: number;
  text?: string | null;
  children?: AlgoliaChild[];
}

function convertAlgoliaTreeToCommentNode(child: AlgoliaChild): CommentNode {
  const content = child.text
    ? htmlToMarkdown(child.text)
    : "";

  return {
    id: String(child.id),
    author: child.author || null,
    contentMarkdown: content,
    children: (child.children || []).map(convertAlgoliaTreeToCommentNode),
  };
}

// Latest comment timestamp across the tree. ISO 8601 strings sort chronologically.
function latestCommentAt(children: AlgoliaChild[]): string | null {
  const times: string[] = [];
  const walk = (nodes: AlgoliaChild[]): void => {
    for (const n of nodes) {
      if (n.created_at) times.push(n.created_at);
      if (n.children?.length) walk(n.children);
    }
  };
  walk(children);
  return times.length ? (times.sort().pop() ?? null) : null;
}

// Keep the first `cap` comments in tree order (depth-first, so early subtrees
// stay intact) and drop childIds that point past the cut — a truncated tree
// must not reference comments it no longer contains.
export function capComments(comments: FlatComment[], cap: number): {
  kept: FlatComment[];
  originalCount: number;
  truncated: boolean;
} {
  if (comments.length <= cap) {
    return { kept: comments, originalCount: comments.length, truncated: false };
  }
  const kept = comments.slice(0, cap);
  const keptIds = new Set(kept.map((c) => c.id));
  return {
    kept: kept.map((c) => ({ ...c, childIds: c.childIds.filter((id) => keptIds.has(id)) })),
    originalCount: comments.length,
    truncated: true,
  };
}

interface AlgoliaCliOptions {
  postId: string;
  outPath: string;
  maxFetchAlgolia: number;
}

// Usage: bun scripts/algolia.ts <postId> --out <path> [--maxFetchAlgolia N]
// Flags accept both "--flag value" and "--flag=value" forms.
function parseArgs(argv: string[]): AlgoliaCliOptions {
  let maxFetchAlgolia = DEFAULT_MAX_FETCH_ALGOLIA;
  let outPath = "";
  const positional: string[] = [];

  const applyFlag = (name: string, raw: string | undefined): void => {
    const v = Number(raw);
    if (Number.isFinite(v) && v > 0) {
      if (name === "maxFetchAlgolia") maxFetchAlgolia = Math.floor(v);
    }
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--out") outPath = argv[++i] ?? "";
    else if (a.startsWith("--out=")) outPath = a.slice(6);
    else if (a === "--maxFetchAlgolia") applyFlag("maxFetchAlgolia", argv[++i]);
    else if (a.startsWith("--maxFetchAlgolia=")) applyFlag("maxFetchAlgolia", a.split("=")[1]);
    else positional.push(a);
  }

  return { postId: positional[0] ?? "", outPath, maxFetchAlgolia };
}

async function main(): Promise<void> {
  const { postId: input, outPath, maxFetchAlgolia } = parseArgs(process.argv.slice(2));
  if (!input || !outPath) {
    process.stderr.write(
      "Usage: bun scripts/algolia.ts <postId> --out <path> [--maxFetchAlgolia N]\n"
    );
    process.exit(1);
  }

  // Parse postId
  let postId: string;
  try {
    postId = parsePostId(input);
  } catch {
    process.stderr.write(`Invalid postId: ${input}\n`);
    process.exit(1);
  }

  // Fetch from Algolia
  const url = `${ALGOLIA_API_BASE}/items/${postId}`;

  let response: Response;
  try {
    response = await fetchWithTimeout(url);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Fetch error: ${msg}\n`);
    process.exit(1);
  }

  if (!response.ok) {
    if (response.status === 404) {
      process.stderr.write(`Post not found: ${postId}\n`);
    } else {
      process.stderr.write(`HTTP error ${response.status}\n`);
    }
    process.exit(1);
  }

  let data: AlgoliaResponse;
  try {
    data = (await response.json()) as AlgoliaResponse;
  } catch {
    process.stderr.write("Failed to parse Algolia response\n");
    process.exit(1);
  }

  // Structural validation: post must have required fields
  if (!data.id || !data.title || !data.author) {
    process.stderr.write("Missing required fields in Algolia response\n");
    process.exit(1);
  }

  // Convert nested tree to CommentNode tree
  const commentNodes: CommentNode[] = (data.children || []).map(
    convertAlgoliaTreeToCommentNode
  );

  // Flatten the tree into a flat comments array
  // We create a synthetic root to flatten all children
  const syntheticRoot: CommentNode = {
    id: "__root__",
    author: null,
    contentMarkdown: "",
    children: commentNodes,
  };

  const allFlat = flattenCommentTree(syntheticRoot, null, -1);
  // Filter out the synthetic root
  const comments = allFlat.filter((c) => c.id !== "__root__").map((c) => ({
    ...c,
    parentId: c.parentId === "__root__" ? null : c.parentId,
  }));

  const { kept, originalCount, truncated } = capComments(comments, maxFetchAlgolia);

  // Build unified output. truncated/originalCommentCount let downstream
  // (insert-header.ts) disclose the cut to the reader.
  const output = {
    source: "algolia",
    latestCommentAt: latestCommentAt(data.children || []),
    post: {
      id: String(data.id),
      title: data.title,
      url: data.url || null,
      author: data.author,
      postScore: data.points || 0,
      textContent: data.text ? htmlToMarkdown(data.text) : null,
    },
    comments: kept,
    truncated,
    originalCommentCount: originalCount,
  };

  // Write the full JSON to disk; stdout carries ONLY this one-line summary.
  // The summary carries everything the agent needs (title for the slug,
  // counts, snapshot fields) so the raw file never has to be read whole.
  await writeJSON(outPath, output);
  process.stdout.write(
    JSON.stringify({
      source: "algolia",
      postId: String(data.id),
      title: data.title,
      author: data.author,
      postScore: data.points || 0,
      comments: kept.length,
      originalCommentCount: originalCount,
      truncated,
      latestCommentAt: output.latestCommentAt,
      out: outPath,
    }) + "\n"
  );
}

main().catch((err) => {
  process.stderr.write(
    `Unexpected error: ${err instanceof Error ? err.message : String(err)}\n`
  );
  process.exit(1);
});
