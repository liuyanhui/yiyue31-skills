import { fetchWithTimeout, delay, htmlToMarkdown, flattenCommentTree, parsePostId, writeJSON } from "./lib/utils";
import type { CommentNode } from "./lib/utils";

const FIREBASE_API_BASE = "https://hacker-news.firebaseio.com/v0";
const REQUEST_DELAY_MS = 50;

// Defaults used when the caller passes no flags. The skill passes
// --fetchDepth / --maxFetchComments from config (SKILL.md Step 3).
const DEFAULT_FETCH_DEPTH = 10;
const DEFAULT_MAX_FETCH_COMMENTS = 500;

interface FirebaseItem {
  id: number;
  type?: string;
  by?: string;
  time?: number;
  text?: string;
  kids?: number[];
  title?: string;
  url?: string;
  score?: number;
  descendants?: number;
  deleted?: boolean;
  dead?: boolean;
  parent?: number;
}

interface FetchMeta {
  totalFetched: number;
  skippedDeleted: number;
  skippedDead: number;
  maxDepthReached: boolean;
  maxCommentsReached: boolean;
  latestTime: number;
}

async function fetchItem(id: number): Promise<FirebaseItem | null> {
  const url = `${FIREBASE_API_BASE}/item/${id}.json`;
  const response = await fetchWithTimeout(url);

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as FirebaseItem;
}

interface CommentTreeNode {
  item: FirebaseItem;
  children: CommentTreeNode[];
}

async function fetchCommentTree(
  kidIds: number[],
  currentDepth: number,
  maxDepth: number,
  maxFetchComments: number,
  meta: FetchMeta
): Promise<CommentTreeNode[]> {
  if (currentDepth > maxDepth) {
    meta.maxDepthReached = true;
    return [];
  }

  const nodes: CommentTreeNode[] = [];

  for (const kidId of kidIds) {
    // 2GB / time safety: stop once we have accepted enough live items.
    // meta is shared across recursion, so this caps the whole traversal.
    if (meta.totalFetched >= maxFetchComments) {
      meta.maxCommentsReached = true;
      break;
    }

    await delay(REQUEST_DELAY_MS);

    const item = await fetchItem(kidId);
    if (!item) continue;

    meta.totalFetched++;

    // Skip deleted items
    if (item.deleted) {
      meta.skippedDeleted++;
      continue;
    }

    // Skip dead items
    if (item.dead) {
      meta.skippedDead++;
      continue;
    }

    // Track latest live-comment timestamp (unix seconds)
    if (item.time && item.time > meta.latestTime) {
      meta.latestTime = item.time;
    }

    // Recurse into children
    const children = item.kids
      ? await fetchCommentTree(item.kids, currentDepth + 1, maxDepth, maxFetchComments, meta)
      : [];

    nodes.push({ item, children });
  }

  return nodes;
}

function convertTreeToCommentNodes(nodes: CommentTreeNode[]): CommentNode[] {
  return nodes.map((node) => {
    const content = node.item.text
      ? htmlToMarkdown(node.item.text)
      : "";

    return {
      id: String(node.item.id),
      author: node.item.by || null,
      contentMarkdown: content,
      children: convertTreeToCommentNodes(node.children),
    };
  });
}

interface FirebaseCliOptions {
  postId: string;
  outPath: string;
  fetchDepth: number;
  maxFetchComments: number;
}

// Usage: bun scripts/firebase.ts <postId> --out <path> [--fetchDepth N] [--maxFetchComments N]
// Flags accept both "--flag value" and "--flag=value" forms.
function parseArgs(argv: string[]): FirebaseCliOptions {
  let fetchDepth = DEFAULT_FETCH_DEPTH;
  let maxFetchComments = DEFAULT_MAX_FETCH_COMMENTS;
  let outPath = "";
  const positional: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = argv[i + 1];

    if (a === "--out") {
      outPath = next ?? "";
      i++;
    } else if (a.startsWith("--out=")) {
      outPath = a.slice(6);
    } else if (a === "--fetchDepth" || a === "--fetch-depth") {
      const v = Number(next);
      if (Number.isFinite(v) && v > 0) fetchDepth = Math.floor(v);
      i++;
    } else if (a.startsWith("--fetchDepth=") || a.startsWith("--fetch-depth=")) {
      const v = Number(a.split("=")[1]);
      if (Number.isFinite(v) && v > 0) fetchDepth = Math.floor(v);
    } else if (a === "--maxFetchComments" || a === "--max-fetch-comments") {
      const v = Number(next);
      if (Number.isFinite(v) && v > 0) maxFetchComments = Math.floor(v);
      i++;
    } else if (a.startsWith("--maxFetchComments=") || a.startsWith("--max-fetch-comments=")) {
      const v = Number(a.split("=")[1]);
      if (Number.isFinite(v) && v > 0) maxFetchComments = Math.floor(v);
    } else {
      positional.push(a);
    }
  }

  return { postId: positional[0] ?? "", outPath, fetchDepth, maxFetchComments };
}

async function main(): Promise<void> {
  const { postId: input, outPath, fetchDepth, maxFetchComments } = parseArgs(process.argv.slice(2));
  if (!input || !outPath) {
    process.stderr.write(
      "Usage: bun scripts/firebase.ts <postId> --out <path> [--fetchDepth N] [--maxFetchComments N]\n"
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

  // Fetch the post item
  let postItem: FirebaseItem | null;
  try {
    postItem = await fetchItem(Number(postId));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Fetch error: ${msg}\n`);
    process.exit(1);
  }

  if (!postItem) {
    process.stderr.write(`Post not found: ${postId}\n`);
    process.exit(1);
  }

  // Structural validation: post must have required fields
  if (!postItem.id || !postItem.title || !postItem.by) {
    process.stderr.write("Missing required fields in Firebase response\n");
    process.exit(1);
  }

  // Fetch full comment tree
  const meta: FetchMeta = {
    totalFetched: 0,
    skippedDeleted: 0,
    skippedDead: 0,
    maxDepthReached: false,
    maxCommentsReached: false,
    latestTime: 0,
  };

  const commentTrees = postItem.kids
    ? await fetchCommentTree(postItem.kids, 1, fetchDepth, maxFetchComments, meta)
    : [];

  // Convert to CommentNode format and flatten
  const commentNodes = convertTreeToCommentNodes(commentTrees);

  const syntheticRoot: CommentNode = {
    id: "__root__",
    author: null,
    contentMarkdown: "",
    children: commentNodes,
  };

  const allFlat = flattenCommentTree(syntheticRoot, null, -1);
  const comments = allFlat
    .filter((c) => c.id !== "__root__")
    .map((c) => ({
      ...c,
      parentId: c.parentId === "__root__" ? null : c.parentId,
    }));

  // Build unified output. truncated/originalCommentCount let downstream
  // (insert-header.ts) disclose the fetch cap to the reader; descendants is
  // the thread's true total, which maxCommentsReached cuts short.
  const truncated = meta.maxCommentsReached;
  const originalCommentCount = truncated
    ? postItem.descendants ?? comments.length
    : comments.length;

  const output = {
    source: "firebase",
    latestCommentAt: meta.latestTime ? new Date(meta.latestTime * 1000).toISOString() : null,
    post: {
      id: String(postItem.id),
      title: postItem.title,
      url: postItem.url || null,
      author: postItem.by,
      postScore: postItem.score || 0,
      textContent: postItem.text ? htmlToMarkdown(postItem.text) : null,
    },
    comments,
    truncated,
    originalCommentCount,
    meta: {
      totalFetched: meta.totalFetched,
      skippedDeleted: meta.skippedDeleted,
      skippedDead: meta.skippedDead,
      maxDepthReached: meta.maxDepthReached,
      maxCommentsReached: meta.maxCommentsReached,
      fetchDepth,
      maxFetchComments,
    },
  };

  // Write the full JSON to disk; stdout carries ONLY this one-line summary
  // (title for the slug, counts, snapshot fields) so the raw file never has
  // to be read whole.
  await writeJSON(outPath, output);
  process.stdout.write(
    JSON.stringify({
      source: "firebase",
      postId: String(postItem.id),
      title: postItem.title,
      author: postItem.by,
      postScore: postItem.score || 0,
      comments: comments.length,
      originalCommentCount,
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
