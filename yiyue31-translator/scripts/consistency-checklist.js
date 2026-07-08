"use strict";

// consistency-checklist.js — 全局一致性扫描，产出"小清单"供决策 subagent 只读清单下结论。
//
// 不读整篇译文（长文会上下文溢出），只扫三件事，输出一个紧凑清单：
//   ① 术语表面形式：glossary 中非 [KEEP] 条目，原文英文是否仍以"裸英文"残留在正文
//      （排除代码块/行内代码）——残留即"时而译、时而留英文"的不一致信号。
//   ② 注释密度离群 chunk：各 chunk （英文）括注计数，标出离群（> 2× 中位数）的 chunk。
//   ③ 格式一致性：标题层级是否跳级、列表符是否混用、代码围栏风格（``` vs ~~~）是否混用。
//
// CLI: node consistency-checklist.js <merged-zh.md> [--glossary <path>] [--chunks-dir <dir>] [--output <path>]
// Module: const cc = require('./consistency-checklist.js')

const fs = require("fs");
const path = require("path");
const verify = require("./verify-mechanical.js");

// ---------- glossary 解析 ----------

function parseGlossary(text) {
  const entries = [];
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|")) continue;
    if (/^\|[\s|:-]+\|?$/.test(trimmed)) continue; // 分隔行
    const cells = trimmed.slice(1, -1).split("|").map((c) => c.trim());
    if (cells.length < 2) continue;
    const english = cells[0];
    const translation = cells[1];
    if (!english || /english term|英文/i.test(english)) continue; // 表头
    entries.push({ english, translation, isKeep: /\[KEEP\]/i.test(translation) });
  }
  return entries;
}

// 去掉代码后的"正文"（用于裸英文残留检测）。
function proseOnly(text) {
  return verify.extractCode(text).blocks.length || verify.extractCode(text).inline.length
    ? text.replace(/```[^\n`]*\n?[\s\S]*?```/g, "").replace(/`[^`\n]+`/g, "")
    : text;
}

// ---------- ① 术语表面形式 ----------

function checkTerms(mergedProse, glossaryEntries) {
  const flags = [];
  for (const e of glossaryEntries) {
    if (e.isKeep) continue;
    // 只对"应译成纯中文"的术语报裸英文残留：glossary 译法本身含英文（如 "harness（脚手架）"、
    // "LLM（大型语言模型）"）意味着该词本就要保留英文，正文出现裸英文是预期的，不算不一致。
    if (/[a-zA-Z]/.test(e.translation)) continue;
    const term = e.english.trim();
    if (!term) continue;
    // 词边界（支持短语与含连字符的术语）；大小写不敏感以兼顾句首大写。
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(?<![\\w])${escaped}(?![\\w])`, "gi");
    const matches = mergedProse.match(re);
    if (matches && matches.length > 0) {
      flags.push({ term, declared: e.translation, rawCount: matches.length });
    }
  }
  return flags;
}

// ---------- ② 注释密度离群 ----------

function annotationOutliers(chunksDir) {
  if (!chunksDir || !fs.existsSync(chunksDir)) return [];
  const files = fs
    .readdirSync(chunksDir)
    .filter((f) => /^translated-chunk-\d+\.md$/.test(f))
    .sort();
  const counts = files.map((f) => {
    const text = fs.readFileSync(path.join(chunksDir, f), "utf-8");
    return { file: f, count: verify.countEnglishAnnotations(text) };
  });
  const total = counts.reduce((s, c) => s + c.count, 0);
  // 离群 = 该 chunk 注释数 > 其余 chunk 平均值的 2 倍，且绝对值 ≥ 2（避免单条散注误报）。
  return counts
    .filter((c) => {
      const othersMean = counts.length > 1 ? (total - c.count) / (counts.length - 1) : 0;
      return c.count >= 2 && c.count > othersMean * 2;
    })
    .map((c) => ({ ...c, total }));
}

// ---------- ③ 格式一致性 ----------

function checkFormat(text) {
  const lines = text.split(/\r?\n/);
  const headingLevels = [];
  const unorderedMarkers = new Set(); // - * + 混用才算问题；有序(1.)与无序并存是正常结构
  let fenceBack = 0;
  let fenceTilde = 0;
  for (const line of lines) {
    const h = line.match(/^(#{1,6})\s/);
    if (h) headingLevels.push(h[1].length);
    const li = line.match(/^\s*([-*+])\s/);
    if (li) unorderedMarkers.add(li[1]);
    if (/^```/.test(line.trim())) fenceBack++;
    else if (/^~~~/.test(line.trim())) fenceTilde++;
  }
  // 标题跳级：相邻标题层级差 > 1（如 # → ###）
  const skips = [];
  for (let i = 1; i < headingLevels.length; i++) {
    if (headingLevels[i] - headingLevels[i - 1] > 1) {
      skips.push(`${headingLevels[i - 1]} → ${headingLevels[i]}`);
    }
  }
  return {
    headingSkips: skips,
    listMarkersMixed: unorderedMarkers.size > 1 ? [...unorderedMarkers] : [],
    fenceMixed: fenceBack > 0 && fenceTilde > 0,
  };
}

// ---------- 汇总 ----------

function buildChecklist(mergedText, glossaryEntries, chunksDir) {
  const prose = proseOnly(mergedText);
  const termFlags = glossaryEntries ? checkTerms(prose, glossaryEntries) : [];
  const outliers = annotationOutliers(chunksDir);
  const fmt = checkFormat(mergedText);

  const sections = [];
  sections.push("# 全局一致性清单（供决策 subagent 只读此清单下结论）\n");

  sections.push("## ① 术语表面形式不一致（glossary 已定译，正文仍残留裸英文）\n");
  if (termFlags.length === 0) {
    sections.push("- 无残留。\n");
  } else {
    sections.push("| 术语 | 已定译法 | 正文裸英文出现次数 |");
    sections.push("|------|----------|----------------------|");
    for (const t of termFlags) sections.push(`| ${t.term} | ${t.declared} | ${t.rawCount} |`);
  }
  sections.push("");

  sections.push("## ② 注释密度离群 chunk（注释数 > 其余 chunk 平均的 2 倍）\n");
  if (outliers.length === 0) {
    sections.push("- 无离群。\n");
  } else {
    sections.push("| chunk | （英文）注释数 | 全篇总数 |");
    sections.push("|-------|----------------|-----------|");
    for (const o of outliers) sections.push(`| ${o.file} | ${o.count} | ${o.total} |`);
  }
  sections.push("");

  sections.push("## ③ 格式一致性\n");
  sections.push(`- 标题跳级：${fmt.headingSkips.length ? fmt.headingSkips.join("、") : "无"}`);
  sections.push(`- 列表符混用：${fmt.listMarkersMixed.length ? fmt.listMarkersMixed.join("、") : "无"}`);
  sections.push(`- 代码围栏混用（\`\`\` 与 ~~~ 并存）：${fmt.fenceMixed ? "是" : "否"}`);

  return sections.join("\n");
}

// ---------- CLI ----------

function parseArgs(argv) {
  const pos = [];
  const opts = { glossaryPath: null, chunksDir: null, outputPath: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--glossary") opts.glossaryPath = argv[++i];
    else if (a === "--chunks-dir") opts.chunksDir = argv[++i];
    else if (a === "--output") opts.outputPath = argv[++i];
    else if (a === "-h" || a === "--help") opts.help = true;
    else pos.push(a);
  }
  return { pos, opts };
}

function printHelp() {
  console.log(`consistency-checklist.js — 全局一致性扫描

用法:
  node consistency-checklist.js <merged-zh.md> [--glossary <path>] [--chunks-dir <dir>] [--output <path>]

产出: 一份紧凑清单（① 术语表面形式 ② 注释密度离群 ③ 格式一致性），
      供决策 subagent 只读清单下结论，不读整篇译文。`);
}

function runCli(args) {
  const { pos, opts } = parseArgs(args);
  if (opts.help || pos.length < 1) {
    printHelp();
    process.exit(pos.length < 1 && !opts.help ? 1 : 0);
  }
  let mergedText;
  try {
    mergedText = fs.readFileSync(pos[0], "utf-8");
  } catch (e) {
    console.error(`❌ 文件读取失败：${e.message}`);
    process.exit(1);
  }
  let glossaryEntries = null;
  if (opts.glossaryPath) {
    try {
      glossaryEntries = parseGlossary(fs.readFileSync(opts.glossaryPath, "utf-8"));
    } catch (e) {
      console.error(`⚠ glossary 读取/解析失败，跳过 ①：${e.message}`);
    }
  }
  const out = buildChecklist(mergedText, glossaryEntries, opts.chunksDir);
  if (opts.outputPath) {
    fs.writeFileSync(opts.outputPath, out, "utf-8");
    console.log(`✅ 清单已写入 ${opts.outputPath}`);
  } else {
    console.log(out);
  }
}

if (require.main === module) {
  runCli(process.argv.slice(2));
}

module.exports = {
  parseGlossary,
  proseOnly,
  checkTerms,
  annotationOutliers,
  checkFormat,
  buildChecklist,
  runCli,
};
