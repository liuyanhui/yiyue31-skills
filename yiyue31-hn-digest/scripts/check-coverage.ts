// Verifies 02-grouped.json covers every active comment in 02-filtered.json exactly once.
// Step 6 runs this after writing 02-grouped.json and remediates until clean.
// Usage: bun scripts/check-coverage.ts <02-filtered.json> <02-grouped.json>
// Exit 0 = clean; exit 1 = gaps reported; exit 2 = usage/IO error.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export interface CoverageReport {
  /** active ids not present in any group. */
  missing: string[];
  /** ids owned by more than one top-level group (violates "exactly one group"). */
  duplicate: string[];
  /** grouped ids that are not in active. */
  extra: string[];
  clean: boolean;
}

interface CommentLike {
  id: string;
}
interface SubGroupLike {
  commentIds?: string[];
}
interface GroupLike {
  commentIds?: string[];
  subGroups?: SubGroupLike[];
}
interface FilteredLike {
  active?: CommentLike[];
}
interface GroupedLike {
  groups?: GroupLike[];
}

/**
 * The set of ids a top-level group owns. A group's `commentIds` already unions its
 * subGroups (per spec), but we union defensively — and dedupe within the group so a
 * comment listed in both a parent group and its own subGroup is NOT counted twice.
 */
function groupOwns(group: GroupLike): Set<string> {
  const s = new Set<string>(group.commentIds ?? []);
  for (const sub of group.subGroups ?? []) {
    for (const id of sub.commentIds ?? []) s.add(id);
  }
  return s;
}

export function checkCoverage(filtered: FilteredLike, grouped: GroupedLike): CoverageReport {
  const active = new Set((filtered.active ?? []).map((c) => c.id));

  const perGroup = (grouped.groups ?? []).map(groupOwns);
  const covered = new Set<string>();
  const ownerCount = new Map<string, number>();
  for (const s of perGroup) {
    for (const id of s) {
      covered.add(id);
      ownerCount.set(id, (ownerCount.get(id) ?? 0) + 1);
    }
  }

  const missing = [...active].filter((id) => !covered.has(id)).sort();
  const duplicate = [...covered].filter((id) => (ownerCount.get(id) ?? 0) > 1).sort();
  const extra = [...covered].filter((id) => !active.has(id)).sort();

  return {
    missing,
    duplicate,
    extra,
    clean: missing.length === 0 && duplicate.length === 0 && extra.length === 0,
  };
}

function readJSON<T>(path: string, label: string): T {
  try {
    return JSON.parse(readFileSync(resolve(path), "utf-8")) as T;
  } catch (e) {
    process.stderr.write(`无法读取/解析 ${label} (${path}): ${(e as Error).message}\n`);
    process.exit(2);
  }
}

function main() {
  const [filteredPath, groupedPath] = process.argv.slice(2);
  if (!filteredPath || !groupedPath) {
    process.stderr.write(
      "Usage: bun scripts/check-coverage.ts <02-filtered.json> <02-grouped.json>\n",
    );
    process.exit(2);
  }

  const filtered = readJSON<FilteredLike>(filteredPath, "02-filtered.json");
  const grouped = readJSON<GroupedLike>(groupedPath, "02-grouped.json");
  const report = checkCoverage(filtered, grouped);

  if (report.clean) {
    const n = (filtered.active ?? []).length;
    process.stdout.write(
      `check-coverage: clean — all ${n} active comments grouped, no duplicates.\n`,
    );
    process.exit(0);
  }

  process.stdout.write(`check-coverage: GAPS FOUND\n`);
  if (report.missing.length)
    process.stdout.write(`  missing (${report.missing.length}): ${report.missing.join(", ")}\n`);
  if (report.duplicate.length)
    process.stdout.write(`  duplicate (${report.duplicate.length}): ${report.duplicate.join(", ")}\n`);
  if (report.extra.length)
    process.stdout.write(`  extra (${report.extra.length}): ${report.extra.join(", ")}\n`);
  process.stdout.write(
    `  → 把 missing 归入主题组或「其他观点」兜底组、去重,再跑直到 clean。\n`,
  );
  process.exit(1);
}

if (import.meta.main) {
  main();
}
