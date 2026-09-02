// word-counter.mjs — 字数统计（fork 自 yiyue31-translator/scripts/word-counter.js，一次性拷贝
// 改造为 ESM + 增字节数与 --json，绝不回写源——零共享纪律）
//
// xl 用途：Step 0 规模预检（>40KB 单条件按**字节**判 xl/translator 分流）与预算公告数据源；
// 交付元信息"字数"取 countChineseChars（final-gate 同口径自算，本脚本供人工核对与公告）。
//
// CLI: node word-counter.mjs <file> [--json]
// Module: import { getTextStatistics } from "./word-counter.mjs"

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function countWords(text) {
  if (!text || text.trim().length === 0) return 0;
  return text.trim().split(/\s+/).filter((w) => w.length > 0).length;
}

export function countChars(text, includeSpaces = false) {
  if (!text) return 0;
  return includeSpaces ? text.length : text.replace(/\s/g, "").length;
}

export function countLines(text) {
  if (!text || text.trim().length === 0) return 0;
  return text.split("\n").filter((line) => line.trim().length > 0).length;
}

export function countChineseChars(text) {
  if (!text) return 0;
  const matches = text.match(/[一-鿿㐀-䶿]/gu);
  return matches ? matches.length : 0;
}

// 只计英文字母（a-z/A-Z）；数字另计
export function countEnglishChars(text) {
  if (!text) return 0;
  const matches = text.match(/[a-zA-Z]/g);
  return matches ? matches.length : 0;
}

export function countOtherChars(text) {
  if (!text) return 0;
  const totalChars = text.replace(/\s/g, "").length;
  const chineseChars = countChineseChars(text);
  const englishChars = countEnglishChars(text);
  const numbers = (text.match(/\d/g) || []).length;
  const punctuation = (text.match(/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/g) || []).length;
  return Math.max(0, totalChars - chineseChars - englishChars - numbers - punctuation);
}

export function getTextStatistics(text) {
  const chineseChars = countChineseChars(text);
  const totalWords = countWords(text);
  return {
    bytes: Buffer.byteLength(text, "utf-8"),
    totalWords,
    totalCharacters: countChars(text, false),
    charactersWithSpaces: countChars(text, true),
    chineseChars,
    englishChars: countEnglishChars(text),
    otherChars: countOtherChars(text),
    numbers: (text.match(/\d/g) || []).length,
    lines: countLines(text),
    paragraphs: text.split(/\n\s*\n/).filter((p) => p.trim().length > 0).length,
    // 加权阅读时长：中文 ~300 字/分 + 英文 ~200 词/分
    readingTimeMinutes: Math.ceil(chineseChars / 300 + totalWords / 200),
  };
}

export function getFileStatistics(filePath) {
  return getTextStatistics(fs.readFileSync(filePath, "utf-8"));
}

export function formatStatistics(stats, filePath) {
  const L = [];
  if (filePath) L.push(`📄 File: ${filePath}`, "");
  L.push(
    "📊 Text Statistics:",
    "",
    `   字节（xl 规模判据）: ${stats.bytes.toLocaleString()} B`,
    `   📝 Total Words: ${stats.totalWords.toLocaleString()} words`,
    "",
    "   🔤 Character Breakdown:",
    `      中文: ${stats.chineseChars.toLocaleString()} chars`,
    `      English: ${stats.englishChars.toLocaleString()} chars`,
    `      其他: ${stats.otherChars.toLocaleString()} chars`,
    `      Numbers: ${stats.numbers.toLocaleString()}`,
    "",
    `   📏 Total Characters（不含空格）: ${stats.totalCharacters.toLocaleString()}`,
    `   📐 Lines: ${stats.lines.toLocaleString()}｜Paragraphs: ${stats.paragraphs.toLocaleString()}`,
    "",
    `   ⏱️  Estimated reading time: ${stats.readingTimeMinutes} min`,
  );
  return L.join("\n");
}

// ---------- CLI ----------

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const file = args.find((a) => !a.startsWith("--"));
  if (!file || args.includes("--help") || args.includes("-h")) {
    console.log("用法: node word-counter.mjs <file> [--json]");
    process.exit(file ? 0 : 1);
  }
  try {
    const stats = getFileStatistics(path.resolve(file));
    if (json) console.log(JSON.stringify(stats, null, 2));
    else console.log(formatStatistics(stats, file));
  } catch (e) {
    console.error(`❌ ${e.message}`);
    process.exit(1);
  }
}
