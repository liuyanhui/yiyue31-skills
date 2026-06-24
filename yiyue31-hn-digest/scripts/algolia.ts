import { fetchWithTimeout, htmlToMarkdown, flattenCommentTree, parsePostId } from "./lib/utils";
import type { CommentNode } from "./lib/utils";

const ALGOLIA_API_BASE = "https://hn.algolia.com/api/v1";

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

async function main(): Promise<void> {
  const input = process.argv[2];
  if (!input) {
    process.stderr.write("Usage: bun scripts/algolia.ts <postId>\n");
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
    const output = { error: "missing_required_fields" };
    process.stdout.write(JSON.stringify(output, null, 2) + "\n");
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

  // Build unified output
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
    comments,
  };

  process.stdout.write(JSON.stringify(output, null, 2) + "\n");
}

main().catch((err) => {
  process.stderr.write(
    `Unexpected error: ${err instanceof Error ? err.message : String(err)}\n`
  );
  process.exit(1);
});
