import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";

// join.ts — the deferred-body join for Steps 6/7. 01-raw-data.json holds every
// comment body; 02-filtered.json holds only a slim index (no contentMarkdown).
// This script joins bodies back by id into small, purpose-scoped files so no
// agent ever reads the raw file whole: a large thread's raw JSON alone can
// approach the context window, while what Steps 6/7 actually need is a small
// subset (active bodies for grouping/generation, grouped outlier bodies for
// the standout scan).

const DEFAULT_OUTLIER_GROUPS = 4;

export interface SlimEntry {
  id: string;
  author: string;
  parentId: string | null;
  childIds: string[];
  depth: number;
  isOP?: boolean;
}

interface RawComment {
  id: string;
  author?: string | null;
  parentId?: string | null;
  childIds?: string[];
  depth?: number;
  contentMarkdown?: string;
}

interface RawData {
  comments?: RawComment[];
}

interface FilteredData {
  active?: SlimEntry[];
  outlierPool?: SlimEntry[];
  outlierBatches?: string[][] | null;
}

export interface OutlierFile {
  name: string;
  content: string;
}

function byIdOf(raw: RawData): Map<string, RawComment> {
  return new Map((raw.comments || []).map((c) => [c.id, c]));
}

/** One comment as a compact markdown entry: a metadata header line + body.
 * The header carries the grouping context (author, depth, thread position);
 * a missing body (id absent from raw) renders as an explicit placeholder so
 * gaps are visible instead of silently dropped. */
export function renderEntry(slim: SlimEntry, body: string | null, full: boolean): string {
  const fields = full
    ? `id=${slim.id} author=${slim.author} depth=${slim.depth} parentId=${slim.parentId} replies=${slim.childIds.length} isOP=${slim.isOP ?? false}`
    : `id=${slim.id} author=${slim.author} depth=${slim.depth}`;
  return `### ${fields}\n${body === null ? "(missing in raw)" : body.trim()}`;
}

/** Active-set bodies in one file — the sole body source for Step 6 grouping
 * and Step 7 generation. */
export function buildActiveBodies(byId: Map<string, RawComment>, active: SlimEntry[]): string {
  return active
    .map((a) => renderEntry(a, byId.get(a.id)?.contentMarkdown ?? null, true))
    .join("\n\n");
}

/** Outlier bodies consolidated into ~N files (default 4). Each standout-scan
 * subagent reads one file — bounded per call, while N stays small enough that
 * the map-reduce does not become one dispatch per batch. Small pools (no
 * batches) collapse to a single file. */
export function buildOutlierFiles(
  byId: Map<string, RawComment>,
  outlierPool: SlimEntry[],
  outlierBatches: string[][] | null,
  groups: number
): OutlierFile[] {
  const poolById = new Map(outlierPool.map((o) => [o.id, o]));

  const renderIds = (ids: string[]): string =>
    ids
      .map((id) => renderEntry(poolById.get(id) ?? { id, author: "?", parentId: null, childIds: [], depth: 0 }, byId.get(id)?.contentMarkdown ?? null, false))
      .join("\n\n");

  if (!outlierBatches || outlierBatches.length === 0) {
    if (outlierPool.length === 0) return [];
    return [
      {
        name: "02-outlier-bodies.md",
        content: `# outlier bodies (${outlierPool.length} comments)\n\n${renderIds(outlierPool.map((o) => o.id))}`,
      },
    ];
  }

  const total = outlierBatches.length;
  const per = Math.ceil(total / groups);
  const files: OutlierFile[] = [];
  for (let g = 0; g * per < total; g++) {
    const slice = outlierBatches.slice(g * per, (g + 1) * per);
    const ids = slice.flat();
    files.push({
      name: `02-outlier-bodies-g${g + 1}.md`,
      content:
        `# outlier bodies group ${g + 1} (batches ${g * per + 1}-${g * per + slice.length}, ${ids.length} comments)\n\n` +
        renderIds(ids),
    });
  }
  return files;
}

interface JoinOptions {
  rawPath: string;
  filteredPath: string;
  outlierGroups: number;
}

// Usage: bun scripts/join.ts <01-raw-data.json> <02-filtered.json> [--outlier-groups N]
function parseArgs(argv: string[]): JoinOptions {
  let outlierGroups = DEFAULT_OUTLIER_GROUPS;
  const positional: string[] = [];

  const applyGroups = (raw: string | undefined): void => {
    const v = Number(raw);
    if (Number.isFinite(v) && v > 0) outlierGroups = Math.floor(v);
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--outlier-groups") applyGroups(argv[++i]);
    else if (a.startsWith("--outlier-groups=")) applyGroups(a.split("=")[1]);
    else positional.push(a);
  }

  return { rawPath: positional[0] ?? "", filteredPath: positional[1] ?? "", outlierGroups };
}

function main(): void {
  const { rawPath, filteredPath, outlierGroups } = parseArgs(process.argv.slice(2));
  if (!rawPath || !filteredPath) {
    process.stderr.write(
      "Usage: bun scripts/join.ts <01-raw-data.json> <02-filtered.json> [--outlier-groups N]\n"
    );
    process.exit(1);
  }

  // Single read each — same size rationale as preprocess.ts: even a
  // maxed-out thread is well under 1MB of JSON text.
  const raw = JSON.parse(readFileSync(resolve(rawPath), "utf-8")) as RawData;
  const filtered = JSON.parse(readFileSync(resolve(filteredPath), "utf-8")) as FilteredData;
  const byId = byIdOf(raw);

  const outDir = dirname(resolve(rawPath));

  const activePath = join(outDir, "02-active-bodies.md");
  writeFileSync(activePath, buildActiveBodies(byId, filtered.active || []) + "\n", "utf-8");

  const outlierFiles = buildOutlierFiles(
    byId,
    filtered.outlierPool || [],
    filtered.outlierBatches ?? null,
    outlierGroups
  );
  for (const f of outlierFiles) {
    writeFileSync(join(outDir, f.name), f.content + "\n", "utf-8");
  }

  const outlierDesc =
    outlierFiles.length === 0
      ? "no outliers"
      : `${outlierFiles.length} file${outlierFiles.length > 1 ? "s" : ""} (${outlierFiles.map((f) => f.name).join(", ")})`;
  process.stdout.write(
    `join: ${filtered.active?.length ?? 0} active bodies → 02-active-bodies.md; ` +
      `${filtered.outlierPool?.length ?? 0} outlier bodies → ${outlierDesc}\n`
  );
}

// Run only when invoked directly as a script.
const isDirect = process.argv[1] && import.meta.path === process.argv[1];
if (isDirect) {
  main();
}
