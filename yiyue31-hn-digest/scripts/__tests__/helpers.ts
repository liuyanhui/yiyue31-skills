import { readFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";

/**
 * Load a test fixture JSON file by name.
 */
export function loadFixture<T = unknown>(name: string): T {
  const filePath = resolve(__dirname, "fixtures", name);
  if (!existsSync(filePath)) {
    throw new Error(`Fixture not found: ${filePath}`);
  }
  const raw = readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as T;
}

/**
 * Resolve a path relative to the hn-digest project root.
 */
export function projectRoot(): string {
  return resolve(__dirname, "..");
}

/**
 * Resolve a path relative to the hn-digest/fixtures directory.
 */
export function fixturePath(name: string): string {
  return join(__dirname, "fixtures", name);
}

/**
 * Validate that a value is valid JSON.
 */
export function isValidJSON(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate unified JSON structure has required top-level fields.
 */
export function validateUnifiedStructure(data: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const d = data as Record<string, unknown>;

  if (!d || typeof d !== "object") {
    return { valid: false, errors: ["Data is not an object"] };
  }

  if (!d.source || typeof d.source !== "string") {
    errors.push("Missing or invalid 'source' field");
  }

  if (!d.post || typeof d.post !== "object") {
    errors.push("Missing 'post' field");
  } else {
    const post = d.post as Record<string, unknown>;
    if (!post.id) errors.push("Post missing 'id'");
    if (!post.title) errors.push("Post missing 'title'");
    if (!post.author) errors.push("Post missing 'author'");
  }

  if (!Array.isArray(d.comments)) {
    errors.push("Missing or invalid 'comments' field");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Create a mock comment for testing purposes.
 */
export function createMockComment(overrides: Partial<{
  id: string;
  author: string;
  parentId: string | null;
  childIds: string[];
  depth: number;
  contentMarkdown: string;
  isOP: boolean;
}> = {}) {
  return {
    id: overrides.id ?? `mock-${Date.now()}`,
    author: overrides.author ?? "mockuser",
    parentId: overrides.parentId ?? null,
    childIds: overrides.childIds ?? [],
    depth: overrides.depth ?? 0,
    contentMarkdown: overrides.contentMarkdown ?? "Mock comment content",
    isOP: overrides.isOP ?? false,
  };
}
