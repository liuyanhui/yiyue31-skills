"use strict";

// verify-mechanical.js — 翻译后机械校验关卡（脚本管机械、审校管语义）
//
// 校验项（任一 FAIL → 退出码 1，打回重做）：
//   1. 代码块 / 行内代码（反引号定界）：原文 ⊆ 译文（逐个 code span 必须在译文中原样出现）。
//      缺失 = 遗漏；相似但不一致 = 误改；译文独有 = 疑似误改（WARN）。
//   2. 内联 SVG（<svg>...</svg>）：逐块字节比对，必须完全一致。
//   3. URL：正则提取，原文每个 URL 必须在译文中原样出现。
//   4. keep-list 存在性：原文 chunk 中出现的 keep-list 条目（[KEEP] 术语 / 专名 / 全大写缩写）必须在译文中原样保留，未被改写成中文。
//   5. «» 标记残留 = 0：阶段B 必须把所有 «english» 标记裁定完毕，残留即 FAIL。
//   6. 注释密度：译文（英文）括注计数，超阈值打回（默认 --max-annotations 10，可调）。
//
// CLI: node verify-mechanical.js <original.md> <translated.md> [--keep-list <path>] [--max-annotations N] [--json]
// Module: const verify = require('./verify-mechanical.js')

const fs = require("fs");

// ---------- 文本抽取 ----------

// 反引号定界代码：先抽 fenced 块（连内容），再从剩余文本抽 inline。
function extractCode(text) {
  const blocks = [];
  const inline = [];
  const fencedRe = /```[^\n`]*\n?([\s\S]*?)```/g;
  const stripped = text.replace(fencedRe, (_m, inner) => {
    blocks.push(inner.replace(/\n$/, ""));
    return "";
  });
  const inlineRe = /`([^`\n]+)`/g;
  let im;
  while ((im = inlineRe.exec(stripped)) !== null) {
    inline.push(im[1]);
  }
  return { blocks, inline };
}

function extractSvg(text) {
  const blocks = [];
  const svgRe = /<svg\b[\s\S]*?<\/svg>/g;
  let m;
  while ((m = svgRe.exec(text)) !== null) {
    blocks.push(m[0]);
  }
  return blocks;
}

function extractUrls(text) {
  const urls = [];
  const urlRe = /https?:\/\/[^\s)>"'`，。、）]+/g;
  let m;
  while ((m = urlRe.exec(text)) !== null) {
    urls.push(m[0]);
  }
  return urls;
}

// 统计（英文）括注：半角 ( ) 与全角（ ）都计入，括注内须含 ≥2 个连续 ASCII 字母。
function countEnglishAnnotations(text) {
  const re = /[（(]([^()（）]*?)[)）]/g;
  let count = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (/[a-zA-Z]{2,}/.test(m[1])) count++;
  }
  return count;
}

// ---------- 相似度（bag-of-chars Dice，用于判定"误改" vs "遗漏"）----------

function charBag(s) {
  const bag = new Map();
  for (const ch of s) bag.set(ch, (bag.get(ch) || 0) + 1);
  return bag;
}

function diceSimilarity(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const ba = charBag(a);
  const bb = charBag(b);
  let inter = 0;
  for (const [ch, n] of ba) {
    if (bb.has(ch)) inter += Math.min(n, bb.get(ch));
  }
  return (2 * inter) / (a.length + b.length);
}

const SIMILARITY_THRESHOLD = 0.6;

// 对一组原文字段，相对译文字段做子集 diff。
// 返回 { missing: [...], altered: [{original, closest, similarity}], extra: [...] }
function subsetDiff(originals, translations) {
  const tSet = new Set(translations);
  const missing = [];
  const altered = [];
  for (const o of originals) {
    if (tSet.has(o)) continue;
    let best = null;
    let bestSim = 0;
    for (const t of translations) {
      const sim = diceSimilarity(o, t);
      if (sim > bestSim) {
        bestSim = sim;
        best = t;
      }
    }
    if (bestSim >= SIMILARITY_THRESHOLD) {
      altered.push({ original: o, closest: best, similarity: Math.round(bestSim * 100) / 100 });
    } else {
      missing.push(o);
    }
  }
  const oSet = new Set(originals);
  const extra = translations.filter((t) => !oSet.has(t));
  return { missing, altered, extra };
}

// ---------- keep-list 校验 ----------

function loadKeepList(p) {
  if (!p) return null;
  let raw;
  try {
    raw = fs.readFileSync(p, "utf-8");
  } catch (e) {
    throw new Error(`keep-list 文件读取失败（${p}）：${e.message}`);
  }
  let json;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    throw new Error(`keep-list JSON 解析失败（${p}）：${e.message}`);
  }
  return {
    keep: Array.isArray(json.keep) ? json.keep : [],
    properNouns: Array.isArray(json.properNouns) ? json.properNouns : [],
    abbreviations: Array.isArray(json.abbreviations) ? json.abbreviations : [],
  };
}

// keep-list 条目在原文中出现、却在译文中消失（被改写）→ 违规。
function checkKeepList(original, translated, keepList) {
  const violations = [];
  for (const term of [...keepList.keep, ...keepList.properNouns, ...keepList.abbreviations]) {
    const t = String(term).trim();
    if (!t) continue;
    if (original.includes(t) && !translated.includes(t)) {
      violations.push(t);
    }
  }
  return violations;
}

// ---------- 主校验 ----------

function verify(originalText, translatedText, opts = {}) {
  const keepList = opts.keepList || null;
  const maxAnnotations = opts.maxAnnotations != null ? opts.maxAnnotations : 10;
  const fails = []; // {check, message, detail}
  const warns = [];

  // 1. 代码块 + inline 代码
  const oCode = extractCode(originalText);
  const tCode = extractCode(translatedText);
  const blockDiff = subsetDiff(oCode.blocks, tCode.blocks);
  const inlineDiff = subsetDiff(oCode.inline, tCode.inline);
  for (const b of blockDiff.missing) fails.push({ check: "code-block", message: `代码块缺失（原文有、译文无）：${preview(b)}`, detail: b });
  for (const i of inlineDiff.missing) fails.push({ check: "inline-code", message: `行内代码缺失（原文有、译文无）：${preview(i)}`, detail: i });
  for (const b of blockDiff.altered) fails.push({ check: "code-block", message: `代码块被改动（相似度 ${b.similarity}）：原文「${preview(b.original)}」→ 译文「${preview(b.closest)}」`, detail: b });
  for (const i of inlineDiff.altered) fails.push({ check: "inline-code", message: `行内代码被改动（相似度 ${i.similarity}）：原文「${preview(i.original)}」→ 译文「${preview(i.closest)}」`, detail: i });
  for (const b of blockDiff.extra) warns.push(`译文独有代码块（疑似误改，请人工确认）：${preview(b)}`);
  for (const i of inlineDiff.extra) warns.push(`译文独有行内代码（疑似误改，请人工确认）：${preview(i)}`);

  // 2. SVG
  const oSvg = extractSvg(originalText);
  const tSvg = extractSvg(translatedText);
  const tSvgSet = new Set(tSvg);
  for (const s of oSvg) {
    if (!tSvgSet.has(s)) fails.push({ check: "svg", message: `内联 SVG 字节不一致：原文块在译文中未原样出现`, detail: preview(s) });
  }

  // 3. URL
  const oUrls = extractUrls(originalText);
  const tUrlSet = new Set(extractUrls(translatedText));
  for (const u of oUrls) {
    if (!tUrlSet.has(u)) fails.push({ check: "url", message: `URL 改动或缺失：${u}`, detail: u });
  }

  // 4. keep-list
  if (keepList) {
    const violations = checkKeepList(originalText, translatedText, keepList);
    for (const v of violations) fails.push({ check: "keep-list", message: `keep-list 条目被改写（应原样保留英文）：${v}`, detail: v });
  }

  // 5. «» 残留
  const markerRe = /«[^»]+»/g;
  const residues = translatedText.match(markerRe) || [];
  for (const r of residues) fails.push({ check: "marker-residue", message: `阶段B 未裁定的 «» 标记残留：${r}`, detail: r });

  // 6. 注释密度
  const annCount = countEnglishAnnotations(translatedText);
  if (annCount > maxAnnotations) {
    fails.push({ check: "annotation-density", message: `（英文）注释密度超阈值：${annCount} > ${maxAnnotations}（--max-annotations 可调）`, detail: { annCount, maxAnnotations } });
  } else if (annCount > maxAnnotations * 0.7) {
    warns.push(`（英文）注释密度偏高：${annCount}/${maxAnnotations}，接近阈值`);
  }

  return { passed: fails.length === 0, fails, warns, stats: { annotationCount: annCount, maxAnnotations } };
}

function preview(s) {
  const one = String(s).replace(/\s+/g, " ").trim();
  return one.length > 80 ? one.slice(0, 80) + "…" : one;
}

// ---------- CLI ----------

function parseArgs(argv) {
  const pos = [];
  const opts = { keepListPath: null, maxAnnotations: null, json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--keep-list") opts.keepListPath = argv[++i];
    else if (a === "--max-annotations") opts.maxAnnotations = parseInt(argv[++i], 10);
    else if (a === "--json") opts.json = true;
    else if (a === "-h" || a === "--help") opts.help = true;
    else pos.push(a);
  }
  return { pos, opts };
}

function printHelp() {
  console.log(`verify-mechanical.js — 翻译后机械校验

用法:
  node verify-mechanical.js <original.md> <translated.md> [--keep-list <path>] [--max-annotations N] [--json]

校验项（FAIL 退出码 1）:
  1. 代码块 / 行内代码：原文 ⊆ 译文（抓遗漏与误改）
  2. 内联 SVG：逐块字节比对
  3. URL：原文每个 URL 须在译文中原样出现
  4. keep-list：原文出现的条目须原样保留英文
  5. «» 标记残留 = 0
  6. （英文）注释密度 ≤ 阈值（默认 10）

退出码: 0 = 通过, 1 = 打回重做`);
}

function runCli(args) {
  const { pos, opts } = parseArgs(args);
  if (opts.help || pos.length < 2) {
    printHelp();
    process.exit(pos.length < 2 && !opts.help ? 1 : 0);
  }
  let originalText, translatedText;
  try {
    originalText = fs.readFileSync(pos[0], "utf-8");
    translatedText = fs.readFileSync(pos[1], "utf-8");
  } catch (e) {
    console.error(`❌ 文件读取失败：${e.message}`);
    process.exit(1);
  }
  let keepList = null;
  if (opts.keepListPath) {
    try {
      keepList = loadKeepList(opts.keepListPath);
    } catch (e) {
      console.error(`❌ ${e.message}`);
      process.exit(1);
    }
  }
  const result = verify(originalText, translatedText, { keepList, maxAnnotations: opts.maxAnnotations });
  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    if (result.passed) {
      console.log(`✅ 机械校验通过（注释密度 ${result.stats.annotationCount}/${result.stats.maxAnnotations}）`);
    } else {
      console.log(`❌ 机械校验未通过（${result.fails.length} 项 FAIL）：`);
      for (const f of result.fails) console.log(`  • [${f.check}] ${f.message}`);
    }
    for (const w of result.warns) console.log(`  ⚠ ${w}`);
  }
  process.exit(result.passed ? 0 : 1);
}

if (require.main === module) {
  runCli(process.argv.slice(2));
}

module.exports = {
  extractCode,
  extractSvg,
  extractUrls,
  countEnglishAnnotations,
  diceSimilarity,
  subsetDiff,
  loadKeepList,
  checkKeepList,
  verify,
  runCli,
};
