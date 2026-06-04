import TurndownService from "turndown";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";

// --- Type Definitions ---

export interface CommentNode {
  id: string;
  author?: string | null;
  contentMarkdown?: string;
  children?: CommentNode[];
}

export interface FlatComment {
  id: string;
  author: string | null;
  parentId: string | null;
  childIds: string[];
  depth: number;
  contentMarkdown: string;
}

// --- Turndown singleton (configured once) ---

const turndown = new TurndownService({
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
});

// Preserve <pre><code> blocks as fenced code blocks
turndown.addRule("preCodeBlock", {
  filter: ["pre"],
  replacement: (content, node) => {
    const codeNode = node as HTMLElement;
    const code = codeNode.querySelector("code");
    const text = code ? code.textContent : codeNode.textContent;
    return `\n\n\`\`\`\n${text || ""}\n\`\`\`\n\n`;
  },
});

// Convert inline <code> to backticks
turndown.addRule("inlineCode", {
  filter: (node) => {
    return node.nodeName === "CODE" && node.parentNode?.nodeName !== "PRE";
  },
  replacement: (content) => {
    return `\`${content}\``;
  },
});

// --- Functions ---

/**
 * Fetch wrapper that aborts after timeout (default 30s).
 */
export async function fetchWithTimeout(
  url: string,
  options?: RequestInit,
  timeoutMs: number = 30000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Promise-based delay for Firebase API rate limiting.
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Creates directory recursively if not exists (no error if exists).
 */
export async function ensureDir(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true });
}

/**
 * Writes JSON to file, creating parent directories via ensureDir.
 */
export async function writeJSON(
  filePath: string,
  data: unknown
): Promise<void> {
  const absPath = resolve(filePath);
  const dir = dirname(absPath);
  await ensureDir(dir);
  const json = JSON.stringify(data, null, 2);
  await writeFile(absPath, json, "utf-8");
}

/**
 * Convert HTML to Markdown using turndown with HN-specific configuration.
 * Handles edge cases: empty strings, null/undefined, residual HTML detection.
 */
export function htmlToMarkdown(html: string | null | undefined): string {
  if (!html || html.trim() === "") return "";

  // Convert via turndown
  let markdown = turndown.turndown(html);

  // Final strip pass: remove any remaining basic HTML tags that turndown missed
  markdown = markdown
    .replace(/<\/?(p|div|span|br|hr|table|tr|td|th|thead|tbody|ul|ol|li|blockquote|h[1-6])\b[^>]*>/gi, "")
    .trim();

  // Detect residual HTML tags
  const residualHtmlRegex = /<[a-zA-Z][^>]*>/;
  if (residualHtmlRegex.test(markdown)) {
    markdown += "\n\n<!-- HTML_RESIDUAL_DETECTED -->";
  }

  return markdown;
}

/**
 * Extract postId from URL or numeric string input.
 * - "https://news.ycombinator.com/item?id=12345678" -> "12345678"
 * - "12345678" -> "12345678"
 * - Invalid input -> throw Error
 */
export function parsePostId(input: string): string {
  if (!input || typeof input !== "string") {
    throw new Error(`Invalid postId input: ${input}`);
  }

  const trimmed = input.trim();

  // Try URL pattern
  const urlMatch = trimmed.match(/[?&]id=(\d+)/);
  if (urlMatch && urlMatch[1]) {
    return urlMatch[1];
  }

  // Try plain numeric
  if (/^\d+$/.test(trimmed)) {
    return trimmed;
  }

  throw new Error(`Invalid postId input: ${input}`);
}

/**
 * Recursively flatten nested comment tree.
 * Returns array of FlatComment with childIds extracted from node's children.
 */
export function flattenCommentTree(
  node: CommentNode,
  parentId: string | null = null,
  depth: number = 0
): FlatComment[] {
  const results: FlatComment[] = [];

  // Extract child IDs from children array
  const childIds: string[] = (node.children || [])
    .map((child) => child.id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);

  const flat: FlatComment = {
    id: node.id,
    author: node.author ?? null,
    parentId: parentId,
    childIds: childIds,
    depth: depth,
    contentMarkdown: node.contentMarkdown || "",
  };

  results.push(flat);

  // Recurse into children
  for (const child of node.children || []) {
    results.push(...flattenCommentTree(child, node.id, depth + 1));
  }

  return results;
}
