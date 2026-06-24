import { fetchWithTimeout, delay, htmlToMarkdown, flattenCommentTree, parsePostId } from "./lib/utils";
import type { CommentNode } from "./lib/utils";

const FIREBASE_API_BASE = "https://hacker-news.firebaseio.com/v0";
const MAX_DEPTH = 5;
const REQUEST_DELAY_MS = 50;

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
  meta: FetchMeta
): Promise<CommentTreeNode[]> {
  if (currentDepth > maxDepth) {
    meta.maxDepthReached = true;
    return [];
  }

  const nodes: CommentTreeNode[] = [];

  for (const kidId of kidIds) {
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
      ? await fetchCommentTree(item.kids, currentDepth + 1, maxDepth, meta)
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

async function main(): Promise<void> {
  const input = process.argv[2];
  if (!input) {
    process.stderr.write("Usage: bun scripts/firebase.ts <postId>\n");
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
    const output = { error: "missing_required_fields" };
    process.stdout.write(JSON.stringify(output, null, 2) + "\n");
    process.exit(1);
  }

  // Fetch full comment tree
  const meta: FetchMeta = {
    totalFetched: 0,
    skippedDeleted: 0,
    skippedDead: 0,
    maxDepthReached: false,
    latestTime: 0,
  };

  const commentTrees = postItem.kids
    ? await fetchCommentTree(postItem.kids, 1, MAX_DEPTH, meta)
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

  // Build unified output
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
    meta: {
      totalFetched: meta.totalFetched,
      skippedDeleted: meta.skippedDeleted,
      skippedDead: meta.skippedDead,
      maxDepthReached: meta.maxDepthReached,
    },
  };

  process.stdout.write(JSON.stringify(output, null, 2) + "\n");
}

main().catch((err) => {
  process.stderr.write(
    `Unexpected error: ${err instanceof Error ? err.message : String(err)}\n`
  );
  process.exit(1);
});
