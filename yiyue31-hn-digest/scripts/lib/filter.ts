// Production Step 5 filter (mirrors SKILL.md Step 5). Extracted to a shared
// module so preprocess.ts (production) and filter.test.ts (tests) use ONE
// implementation — no manual mirror to keep in sync.

export interface FilterComment {
  id: string;
  author: string;
  parentId: string | null;
  childIds: string[];
  depth: number;
  contentMarkdown: string;
  isOP?: boolean;
}

export interface FilterConfig {
  depth: number;
  minReplies: number;
  maxComments: number;
}

// Walk the parentId chain (over depth-survivors) up to the top-level root id.
export function rootOf(
  comment: FilterComment,
  byId: Map<string, FilterComment>
): string {
  let cur = comment;
  while (cur.parentId !== null && byId.has(cur.parentId)) {
    cur = byId.get(cur.parentId)!;
  }
  return cur.id;
}

// Step 5.1: depth truncation + childIds recalculation.
export function depthTruncate(
  comments: FilterComment[],
  depth: number
): FilterComment[] {
  let filtered = comments.filter((c) => c.depth <= depth);
  const remainingIds = new Set(filtered.map((c) => c.id));
  filtered = filtered.map((c) => ({
    ...c,
    childIds: c.childIds.filter((id) => remainingIds.has(id)),
  }));
  return filtered;
}

// Step 5.2: activity partition → { active, outlierPool }.
// The outlier pool (depth-survivors that fail the activity filter) is consumed
// by the standout pass; it is NOT discarded.
export function partitionByActivity(
  filtered: FilterComment[],
  minReplies: number
): { active: FilterComment[]; outlierPool: FilterComment[] } {
  const active: FilterComment[] = [];
  const outlierPool: FilterComment[] = [];
  for (const c of filtered) {
    if (c.childIds.length >= minReplies) active.push(c);
    else outlierPool.push(c);
  }
  return { active, outlierPool };
}

// Step 5.3: diversity-preserving selection (OP + subtree rep + heat fill),
// capped at maxComments. Returns selected comments in heat order.
export function selectDiverse(
  active: FilterComment[],
  config: FilterConfig,
  postAuthor: string,
  byId: Map<string, FilterComment>
): FilterComment[] {
  const selected = new Map<string, FilterComment>();
  const tryAdd = (c?: FilterComment): void => {
    if (!c || selected.size >= config.maxComments || selected.has(c.id)) return;
    selected.set(c.id, c);
  };

  // (a) OP first
  for (const c of active) {
    if (c.author === postAuthor) tryAdd(c);
  }

  // (b) one representative per top-level subtree (hottest active per root)
  const byRoot = new Map<string, FilterComment[]>();
  for (const c of active) {
    const r = rootOf(c, byId);
    if (!byRoot.has(r)) byRoot.set(r, []);
    byRoot.get(r)!.push(c);
  }
  for (const rootId of byRoot.keys()) {
    const members = byRoot
      .get(rootId)!
      .slice()
      .sort((a, b) => b.childIds.length - a.childIds.length);
    tryAdd(members.find((m) => !selected.has(m.id)));
  }

  // (c) heat fill
  const rest = active
    .filter((c) => !selected.has(c.id))
    .sort((a, b) => b.childIds.length - a.childIds.length);
  for (const c of rest) tryAdd(c);

  return [...selected.values()].sort((a, b) => b.childIds.length - a.childIds.length);
}

// Full Step 5 pipeline → selected active set (for grouping), with OP marked.
export function applyFilters(
  comments: FilterComment[],
  config: FilterConfig,
  postAuthor: string
): FilterComment[] {
  const filtered = depthTruncate(comments, config.depth);
  const { active } = partitionByActivity(filtered, config.minReplies);
  const byId = new Map(filtered.map((c) => [c.id, c]));
  const selected = selectDiverse(active, config, postAuthor, byId);
  return selected.map((c) => ({ ...c, isOP: c.author === postAuthor }));
}
