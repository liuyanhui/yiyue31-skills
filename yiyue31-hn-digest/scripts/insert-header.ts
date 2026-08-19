import { readFileSync, writeFileSync } from "node:fs";

// The header block (disclaimer + methodology/neutrality + discussion snapshot)
// is pure boilerplate. It is injected into the final article by THIS script,
// never written by the model, so it stays out of the generate-evaluate loop
// entirely. The snapshot (timestamp, post score, comment count) is frozen at
// fetch time, like the timestamp — HN score and counts drift, so freezing them
// is the point.

const DISCLAIMER = {
  zh: "本文由 Yiyue31 开发的 Skill 基于 Hacker News 讨论总结而成，可能与原始评论存在差异，请自行甄别。",
  en: "This digest was summarized from a Hacker News thread by a Skill developed by Yiyue31. It may differ from the original comments; please judge for yourself.",
};

// Methodology + neutrality. Folded in from the former end-of-article coverage
// note so the whole declaration lives in one place at the top. The raw counts
// are NOT restated here (the snapshot below carries the comment count); only
// the selection principle and the editorial-neutrality guarantee remain.
const METHODOLOGY = {
  zh: "本摘要按回复数与讨论深度选取代表性观点，不同立场的比重反映其在原讨论中的份量，而非编辑倾向。",
  en: "Viewpoints are selected by reply volume and discussion depth; the weight given to each stance reflects its share of the original discussion, not editorial bias.",
};

const TIMESTAMP = {
  zh: (ts: string) => `讨论截至：${ts}`,
  en: (ts: string) => `Discussion as of: ${ts}`,
};

/** Format an ISO timestamp to "YYYY-MM-DD HH:mm:ss" in the viewer's local time.
 * Falls back to the raw string if parsing fails, so a bad value never blocks output. */
export function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** Snapshot data frozen at fetch time. Score and count always exist (default
 * 0); the timestamp may be absent if no comment carried a timestamp.
 * truncated/originalCommentCount are set by the fetchers when a fetch cap
 * (maxFetchComments / maxFetchAlgolia) cut the thread short. */
export interface Snapshot {
  latestCommentAt: string | null;
  score: number;
  commentCount: number;
  truncated: boolean;
  originalCommentCount: number;
}

interface RawData {
  latestCommentAt?: string | null;
  post?: { postScore?: number } | null;
  comments?: unknown[];
  truncated?: boolean;
  originalCommentCount?: number;
}

/** Extract the snapshot from the unified raw-data JSON. */
export function snapshotFromRaw(raw: RawData): Snapshot {
  const commentCount = Array.isArray(raw.comments) ? raw.comments.length : 0;
  return {
    latestCommentAt: raw.latestCommentAt ?? null,
    score: raw.post?.postScore ?? 0,
    commentCount,
    truncated: raw.truncated ?? false,
    originalCommentCount: raw.originalCommentCount ?? commentCount,
  };
}

/** Build the snapshot tail (e.g. "快照 · 2026-08-11 ... · 312 分 · 487 条评论").
 * The timestamp segment is omitted when absent; score and count are always shown. */
function buildSnapshotTail(lang: "zh" | "en", snap: Snapshot): string {
  const segments: string[] = [];
  if (snap.latestCommentAt) {
    segments.push(TIMESTAMP[lang](formatTimestamp(snap.latestCommentAt)));
  }
  if (lang === "zh") {
    segments.push(`${snap.score} 分`);
    segments.push(`${snap.commentCount} 条评论`);
    if (snap.truncated && snap.originalCommentCount > snap.commentCount) {
      segments.push(`评论已按抓取上限截断（保留 ${snap.commentCount}/${snap.originalCommentCount} 条）`);
    }
  } else {
    segments.push(`${snap.score} points`);
    segments.push(`${snap.commentCount} comments`);
    if (snap.truncated && snap.originalCommentCount > snap.commentCount) {
      segments.push(`comments truncated at fetch cap (kept ${snap.commentCount} of ${snap.originalCommentCount})`);
    }
  }
  const label = lang === "zh" ? "快照" : "Snapshot";
  return `　${label} · ${segments.join(" · ")}`;
}

/** Build the header as a single <small> paragraph: disclaimer + methodology +
 * snapshot tail. One paragraph per the design (no scattered small lines). */
export function buildHeader(lang: "zh" | "en", snap: Snapshot): string {
  const tail = buildSnapshotTail(lang, snap);
  return `<small>${DISCLAIMER[lang]}${METHODOLOGY[lang]}${tail}</small>`;
}

/**
 * Inject the header block immediately after the leading H1 of an article.
 * - Idempotent: a no-op if the disclaimer marker is already present.
 * - Assumes the markdown starts with an H1 (`# ...`).
 */
export function injectHeader(markdown: string, lang: "zh" | "en", snap: Snapshot): string {
  const marker = "<small>本文由 Yiyue31";
  if (markdown.includes(marker) || markdown.includes("<small>This digest was summarized")) {
    return markdown;
  }

  const header = buildHeader(lang, snap);
  const lines = markdown.split("\n");

  // Find the first H1 line.
  const h1Index = lines.findIndex((line) => /^#\s+\S/.test(line));
  if (h1Index === -1) {
    // No H1 — prepend at the very top.
    return `${header}\n\n${markdown.replace(/^\n+/, "")}`;
  }

  const before = lines.slice(0, h1Index + 1).join("\n");
  const after = lines.slice(h1Index + 1).join("\n");
  return `${before}\n\n${header}\n${after.replace(/^\n+/, "\n")}`;
}

async function main(): Promise<void> {
  const targetPath = process.argv[2];
  const rawJsonPath = process.argv[3];
  const langArg = process.argv[4] === "en" ? "en" : "zh";

  if (!targetPath || !rawJsonPath) {
    process.stderr.write(
      "Usage: bun scripts/insert-header.ts <target-md> <01-raw-data.json> [zh|en]\n"
    );
    process.exit(1);
  }

  const raw = JSON.parse(readFileSync(rawJsonPath, "utf-8")) as RawData;
  const markdown = readFileSync(targetPath, "utf-8");
  const next = injectHeader(markdown, langArg, snapshotFromRaw(raw));
  writeFileSync(targetPath, next, "utf-8");
}

// Run only when invoked directly as a script.
const isDirect = process.argv[1] && import.meta.path === process.argv[1];
if (isDirect) {
  main();
}
