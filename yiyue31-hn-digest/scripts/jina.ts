import { fetchWithTimeout, parsePostId } from "./lib/utils";

const JINA_PRIMARY_BASE = "https://r.jina.ai";
const JINA_FALLBACK_BASE = "https://r.jinaai.cn";
const FETCH_TIMEOUT_MS = 60000; // Jina can be slow

async function fetchFromJina(base: string, postId: string): Promise<string | null> {
  const url = `${base}/https://news.ycombinator.com/item?id=${postId}`;

  let response: Response;
  try {
    response = await fetchWithTimeout(url, {}, FETCH_TIMEOUT_MS);
  } catch {
    return null;
  }

  if (!response.ok) {
    return null;
  }

  const text = await response.text();
  return text;
}

async function main(): Promise<void> {
  const input = process.argv[2];
  if (!input) {
    process.stderr.write("Usage: bun scripts/jina.ts <postId>\n");
    process.exit(1);
  }

  // Parse postId from URL or numeric input
  let postId: string;
  try {
    postId = parsePostId(input);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Invalid postId: ${msg}\n`);
    process.exit(1);
  }

  // Try primary URL first
  let markdown = await fetchFromJina(JINA_PRIMARY_BASE, postId);

  // Fallback to China mirror if primary failed
  if (markdown === null) {
    process.stderr.write("Primary Jina URL failed, trying fallback...\n");
    markdown = await fetchFromJina(JINA_FALLBACK_BASE, postId);
  }

  // Both URLs failed
  if (markdown === null) {
    process.stderr.write("All Jina URLs failed\n");
    process.exit(1);
  }

  // Minimal validation: output must be non-empty
  if (markdown.trim().length === 0) {
    const output = { error: "empty_response" };
    process.stdout.write(JSON.stringify(output, null, 2) + "\n");
    process.exit(1);
  }

  // Output raw markdown to stdout
  process.stdout.write(markdown);
}

main().catch((err) => {
  process.stderr.write(
    `Unexpected error: ${err instanceof Error ? err.message : String(err)}\n`
  );
  process.exit(1);
});
