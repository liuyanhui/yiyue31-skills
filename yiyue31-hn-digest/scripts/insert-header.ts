import { readFileSync, writeFileSync } from "node:fs";

// Disclaimer + discussion-snapshot timestamp are pure boilerplate. They are
// injected into the final article by THIS script, never written by the model,
// so they stay out of the generate-evaluate loop entirely.

const DISCLAIMER = {
  zh: "本文由 Yiyue31 开发的 Skill 基于 Hacker News讨论总结而成，可能与原始评论存在差异，请自行甄别。",
  en: "This digest was summarized from a Hacker News thread by a Skill developed by Yiyue31. It may differ from the original comments; please judge for yourself.",
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

interface RawData {
  latestCommentAt?: string | null;
}

/** Build the header block (disclaimer + optional timestamp) as <small> lines. */
export function buildHeader(lang: "zh" | "en", latestCommentAt: string | null): string {
  const lines: string[] = [`<small>${DISCLAIMER[lang]}</small>`];
  if (latestCommentAt) {
    lines.push(`<small>${TIMESTAMP[lang](formatTimestamp(latestCommentAt))}</small>`);
  }
  return lines.join("\n\n");
}

/**
 * Inject the header block immediately after the leading H1 of an article.
 * - Idempotent: a no-op if the disclaimer marker is already present.
 * - Assumes the markdown starts with an H1 (`# ...`).
 */
export function injectHeader(markdown: string, lang: "zh" | "en", latestCommentAt: string | null): string {
  const marker = "<small>本文由 Yiyue31";
  if (markdown.includes(marker) || markdown.includes("<small>This digest was summarized")) {
    return markdown;
  }

  const header = buildHeader(lang, latestCommentAt);
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
  const next = injectHeader(markdown, langArg, raw.latestCommentAt ?? null);
  writeFileSync(targetPath, next, "utf-8");
}

// Run only when invoked directly as a script.
const isDirect = process.argv[1] && import.meta.path === process.argv[1];
if (isDirect) {
  main();
}
