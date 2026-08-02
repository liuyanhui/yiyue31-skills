import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import {
  depthTruncate,
  partitionByActivity,
  selectDiverse,
  type FilterComment,
  type FilterConfig,
} from "./lib/filter";

// Defaults mirror SKILL.md config defaults. The skill passes the resolved
// config values via flags.
const DEFAULT_DEPTH = 5;
const DEFAULT_MIN_REPLIES = 3;
const DEFAULT_MAX_COMMENTS = 80;

// The outlier pool feeds the standout pass. When it is large, pre-split it into
// batches so the standout pass can map-reduce (per-batch picks, then a final
// pick from the union) without any single LLM call going oversized.
const OUTLIER_BATCH_THRESHOLD = 60;
const OUTLIER_BATCH_SIZE = 40;

interface RawData {
  post?: { author?: string | null };
  comments?: FilterComment[];
}

interface PreprocessOptions {
  inputPath: string;
  config: FilterConfig;
}

// Usage: bun scripts/preprocess.ts <01-raw-data.json> [--depth N] [--minReplies N] [--maxComments N]
function parseArgs(argv: string[]): PreprocessOptions {
  let depth = DEFAULT_DEPTH;
  let minReplies = DEFAULT_MIN_REPLIES;
  let maxComments = DEFAULT_MAX_COMMENTS;
  const positional: string[] = [];

  const applyFlag = (name: string, raw: string | undefined): void => {
    const v = Number(raw);
    if (Number.isFinite(v) && v >= 0) {
      if (name === "depth") depth = Math.floor(v);
      else if (name === "minReplies") minReplies = Math.floor(v);
      else if (name === "maxComments") maxComments = Math.floor(v);
    }
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--depth") applyFlag("depth", argv[++i]);
    else if (a === "--minReplies") applyFlag("minReplies", argv[++i]);
    else if (a === "--maxComments") applyFlag("maxComments", argv[++i]);
    else if (a.startsWith("--depth=")) applyFlag("depth", a.slice(8));
    else if (a.startsWith("--minReplies=")) applyFlag("minReplies", a.slice(13));
    else if (a.startsWith("--maxComments=")) applyFlag("maxComments", a.slice(14));
    else positional.push(a);
  }

  return {
    inputPath: positional[0] ?? "",
    config: { depth, minReplies, maxComments },
  };
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function markOP(comments: FilterComment[], postAuthor: string): FilterComment[] {
  return comments.map((c) => ({ ...c, isOP: c.author === postAuthor }));
}

// 02-filtered.json is a slim index, not a second copy of the comments. We drop
// contentMarkdown (the body — ~90% of each entry, and a verbatim duplicate of
// 01-raw-data.json). The filter pipeline never reads contentMarkdown, so it is
// dead weight here; downstream steps (Step 6 grouping / 6.4 standouts / Step 7
// generation) join the body from 01 by id when they need it.
interface SlimComment {
  id: string;
  author: string;
  parentId: string | null;
  childIds: string[];
  depth: number;
  isOP?: boolean;
}

function slim(c: FilterComment): SlimComment {
  return {
    id: c.id,
    author: c.author,
    parentId: c.parentId,
    childIds: c.childIds,
    depth: c.depth,
    isOP: c.isOP,
  };
}

function main(): void {
  const { inputPath, config } = parseArgs(process.argv.slice(2));
  if (!inputPath) {
    process.stderr.write(
      "Usage: bun scripts/preprocess.ts <01-raw-data.json> [--depth N] [--minReplies N] [--maxComments N]\n"
    );
    process.exit(1);
  }

  // Single read. 01-raw-data.json is small JSON text (a comment is short; even
  // a maxed-out ~500-comment thread is well under 1MB), so a single JSON.parse
  // is 2GB-safe. Streaming is not warranted at these sizes; we make one pass
  // and avoid redundant in-memory copies.
  const raw = JSON.parse(readFileSync(resolve(inputPath), "utf-8")) as RawData;
  const comments: FilterComment[] = Array.isArray(raw.comments) ? raw.comments : [];
  const postAuthor = raw.post?.author ?? "";

  // Step 5 pipeline (deterministic, code-driven).
  const filtered = depthTruncate(comments, config.depth);
  const { active, outlierPool } = partitionByActivity(filtered, config.minReplies);
  const byId = new Map(filtered.map((c) => [c.id, c]));
  const selectedActive = markOP(selectDiverse(active, config, postAuthor, byId), postAuthor);
  const selectedOutliers = markOP(outlierPool, postAuthor);

  const batched = selectedOutliers.length > OUTLIER_BATCH_THRESHOLD;
  const outlierBatches = batched
    ? chunk(selectedOutliers, OUTLIER_BATCH_SIZE).map((batch) => batch.map((c) => c.id))
    : null;

  const output = {
    active: selectedActive.map(slim),
    outlierPool: selectedOutliers.map(slim),
    outlierBatches,
    meta: {
      inputCount: comments.length,
      activeCount: selectedActive.length,
      outlierCount: selectedOutliers.length,
      batched,
      batchCount: outlierBatches ? outlierBatches.length : 0,
      config,
    },
  };

  const outPath = resolve(dirname(resolve(inputPath)), "02-filtered.json");
  writeFileSync(outPath, JSON.stringify(output, null, 2) + "\n", "utf-8");

  process.stdout.write(
    `preprocess: ${selectedActive.length} active, ${selectedOutliers.length} outlier` +
      (batched ? ` (batched into ${outlierBatches!.length})` : "") +
      ` → ${outPath}\n`
  );
}

main();
