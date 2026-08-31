// verify-mech.mjs — xl-translator 翻译后机械校验关卡（DESIGN §2 Step 5；Step 10 终检重执行同源）
//
// fork 自 yiyue31-translator/scripts/verify-mechanical.js（一次性拷贝改造，绝不回写源——零共享纪律）。
//
// 校验项（任一 FAIL → 退出码 1，打回）：
//   1. 代码块 / 行内代码：原文 ⊆ 译文（缺失 = 遗漏；相似不一致 = 误改；译文独有 = WARN）
//   2. 内联 SVG：逐块字节一致
//   3. URL：原文每个 URL 须在译文原样出现
//   4. keep-list：原文出现的条目须原样保留英文
//   5. «» 残留 = 0
//   6. 数字保真（新）：原文散文中每个数字（含千分位/%）须在译文出现；万/亿换算视作等价。
//      单位不硬判——hours→小时、1.5x→1.5 倍是合法转换，硬判必误伤；单位缺失留给审校准确性维度。
//   7. 散文残留英文（新）：剥离机械元素（代码/URL/SVG/括注/keep-list）后，连续英文词 ≥ max-en-run
//      视为整句漏译。括注不算：阶段B 合法产物「中文（English）」里的英文不是漏译。
//   8. 中英间距（新）：中文表意字符与 ASCII 字母/数字直接相邻 = 违规（排版硬判，修完重跑即过）。
//   9. 防空洞化（新）：译文段落数 / 散文长度相对原文低于下限 → 疑似整段漏译或缩写。
//
// 单次判定语义：本脚本只做一次判定 + 明确退出码（0=过 / 1=打回+FAIL 清单）。
// 「同 chunk 机械打回 ≤2 次升级」的计数归 status.mjs（M1b），本脚本不读不写计数。
// R8-c 术语兑现硬判已裁决采纳（2026-08-31，见 DESIGN §2 Step 5/§9.3 R22 同源）：该 chunk 投影条目的
// 既定译名或登记别名未在译文出现即打回；实现随 M1b 投影文件格式冻结后落地（先定接口再编码）。
//
// 结果落盘：译文位于 */translated-chunks/ 下时，每次运行追加一条记录到上级 verify-results.json。
//   ⚠ 该文件是流水缓存非事实源：终检（final-gate）不信任它，会对最终译文重跑本脚本。
//
// CLI: node verify-mech.mjs <original.md> <translated.md> [--keep-list <path>] [--brief <path>] [--max-annotations N] [--json]
// Module: import { verify } from "./verify-mech.mjs"

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

// ---------- 文本抽取（fork 源继承，行为不回归） ----------

// 反引号定界代码：先抽 fenced 块（连内容），再从剩余文本抽 inline。
export function extractCode(text) {
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

export function extractSvg(text) {
  const blocks = [];
  const svgRe = /<svg\b[\s\S]*?<\/svg>/g;
  let m;
  while ((m = svgRe.exec(text)) !== null) {
    blocks.push(m[0]);
  }
  return blocks;
}

export function extractUrls(text) {
  const urls = [];
  const urlRe = /https?:\/\/[^\s)>"'`，。、）]+/g;
  let m;
  while ((m = urlRe.exec(text)) !== null) {
    urls.push(m[0]);
  }
  return urls;
}

// 统计（英文）括注：半角 ( ) 与全角（ ）都计入，括注内须含 ≥2 个连续 ASCII 字母。
export function countEnglishAnnotations(text) {
  const re = /[（(]([^()（）]*?)[)）]/g;
  let count = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (/[a-zA-Z]{2,}/.test(m[1])) count++;
  }
  return count;
}

// ---------- 相似度（bag-of-chars Dice，用于判定"误改" vs "遗漏"） ----------

function charBag(s) {
  const bag = new Map();
  for (const ch of s) bag.set(ch, (bag.get(ch) || 0) + 1);
  return bag;
}

export function diceSimilarity(a, b) {
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
export function subsetDiff(originals, translations) {
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

// ---------- keep-list 校验（fork 源继承） ----------

export function loadKeepList(p) {
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
export function checkKeepList(original, translated, keepList) {
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

// ---------- 散文视图（新四项共用） ----------

// 剥离机械元素后的"纯散文"视图，供漏译/间距/长度检测。
// 剥离序：~~~/``` 围栏 → SVG → 行内代码 → URL → markdown 链接定义行 → 括注 → keep-list 条目 → HTML 标签。
// 每项替换为空格而非空串，防止拼接出新的伪相邻（如间距误报）。
export function stripMechanical(text, keepTerms = []) {
  let s = text;
  s = s.replace(/```[^\n`]*\n?[\s\S]*?```/g, " ").replace(/~~~[^\n~]*\n?[\s\S]*?~~~/g, " ");
  s = s.replace(/<svg\b[\s\S]*?<\/svg>/g, " ");
  s = s.replace(/`[^`\n]+`/g, " ");
  s = s.replace(/https?:\/\/[^\s)"'`，。、）]+/g, " ");
  s = s.replace(/^\[[^\]]*\]:\s.*$/gm, " ");
  s = s.replace(/[（(][^()（）]*[)）]/g, " ");
  for (const t of keepTerms) {
    const esc = String(t).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (esc) s = s.replace(new RegExp(esc, "g"), " ");
  }
  s = s.replace(/<\/?[a-zA-Z][^>]*>/g, " ");
  return s;
}

// ---------- ⑥ 数字保真 ----------

// 原文数字 token：整数/千分位/小数，可带 %。
const NUM_RE = /\d+(?:,\d{3})*(?:\.\d+)?%?/g;

// 一个数字的等价变体集：原样（含千分位）、去逗号、万/亿换算。
// 1,000,000 合法译作 "100 万"，不认换算会误打回。按中英间距规则合规写法是 "100 万"（带空格），
// 带空格与不带两种形式都收。商限 2 位小数内（3.5 亿 认，1.2345 万 不认）。
export function numberVariants(token) {
  const cands = new Set([token]);
  const core = token.replace(/%$/, "");
  const noComma = core.replace(/,/g, "");
  const pct = token.endsWith("%");
  cands.add(pct ? noComma + "%" : noComma);
  const v = parseFloat(noComma);
  if (Number.isFinite(v) && v > 0) {
    const dec = (x) => {
      const r = Math.round(x * 100) / 100;
      return String(r);
    };
    const decimals = (x) => (String(x).split(".")[1] || "").length;
    const addZh = (x, unit) => {
      const s = dec(x) + unit;
      cands.add(s);
      cands.add(dec(x) + " " + unit); // 间距规则要求合规写法带空格
    };
    const wan = v / 1e4;
    const yi = v / 1e8;
    if (Number.isInteger(v) && v % 1e8 === 0) addZh(yi, "亿");
    if (Number.isInteger(v) && v % 1e4 === 0) addZh(wan, "万");
    else if (v >= 1e6 && decimals(wan) <= 1) addZh(wan, "万");
    if (v >= 1e8 && decimals(yi) <= 2) addZh(yi, "亿");
  }
  return [...cands];
}

// 抽取原文散文数字（剥离列表序号：译文改用"一、"式序号不算数字缺失）。
export function extractNumbers(prose) {
  const deListed = prose.replace(/^[ \t]*(?:\d+[.)、]|[-*+])[ \t]+/gm, " ");
  return deListed.match(NUM_RE) || [];
}

// ---------- ⑦ 散文残留英文 ----------

// 连续英文词 run：纯字母词（允许词内连字符/撇号）序列。词边界用标点/空白切。
// maxRun 默认 6：keep-list 与括注已剥离，6 词连续几乎必是整句漏译；长书名/引用句误报可 brief 放宽。
export function englishRuns(prose, maxRun) {
  const tokens = prose.split(/[\s,.;:!?，。；：！？、"'“”‘’()[\]{}|/\\_~<>=+@#^&*]+/).filter(Boolean);
  const isEnWord = (t) => /^[A-Za-z][A-Za-z'’-]*$/.test(t);
  const runs = [];
  let cur = [];
  for (const t of tokens) {
    if (isEnWord(t)) {
      cur.push(t);
    } else {
      if (cur.length >= maxRun) runs.push(cur.join(" "));
      cur = [];
    }
  }
  if (cur.length >= maxRun) runs.push(cur.join(" "));
  return runs;
}

// ---------- ⑧ 中英间距 ----------

// CJK 表意字符与 ASCII 字母/数字直接相邻 = 违规（盘古之白）。全角标点相邻不算。
export function spacingViolations(prose) {
  const re = /([一-鿿])([A-Za-z0-9])|([A-Za-z0-9])([一-鿿])/g;
  const hits = [];
  let m;
  while ((m = re.exec(prose)) !== null) {
    const i = m.index;
    hits.push(prose.slice(Math.max(0, i - 4), i + 5).replace(/\s+/g, " "));
  }
  return hits;
}

// ---------- ⑨ 防空洞化 ----------

// 段落单元：剥离围栏后按空行切；表格/列表各算 1 单元（两侧同口径，比值才有意义）。
export function paragraphUnits(text) {
  const noFence = text.replace(/```[^\n`]*\n?[\s\S]*?```/g, " ").replace(/~~~[^\n~]*\n?[\s\S]*?~~~/g, " ");
  return noFence
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

// ---------- 阈值 ----------

function num(v, d) {
  return v != null && Number.isFinite(Number(v)) ? Number(v) : d;
}

export function defaultThresholds(overrides = {}) {
  return {
    maxAnnotations: num(overrides.maxAnnotations, 10),
    maxEnRun: num(overrides.maxEnRun, 6),
    minParaRatio: num(overrides.minParaRatio, 0.6),
    minLenRatio: num(overrides.minLenRatio, 0.35),
    maxSpacing: num(overrides.maxSpacing, 0),
    // 小样本保护：段落差 < paraAbsTol 不判（小 chunk 合并段落属正常笔法）；
    // 原文散文 < lenFloor 字节不做长度比（小样本噪声大，误打回代价高于收益）。
    paraAbsTol: num(overrides.paraAbsTol, 3),
    lenFloor: num(overrides.lenFloor, 800),
  };
}

// ---------- brief 阈值解析 ----------

// brief.md（M1b 产物契约）作为阈值来源：整体 JSON 或逐行 `key: value` 均收（camel/kebab 不拘）。
// 宽松解析保证前后兼容：只认已知数值键，其余内容忽略。
// **安全域 clamp（G2，2026-08-31 对抗审查，DESIGN §2 Step 5）**：brief 属被防对象可写范围，
// 阈值只能收紧不能无界放宽——越界值按安全域边界静默生效（不报错，报错反而给造假者探测口）；
// 中英间距不可经 brief 放宽（maxSpacing 不入键域），防"塞 max-en-run:999 灭掉三道硬判"。
const BRIEF_KEYMAP = {
  maxannotations: "maxAnnotations",
  "max-annotations": "maxAnnotations",
  maxenrun: "maxEnRun",
  "max-en-run": "maxEnRun",
  minpararatio: "minParaRatio",
  "min-para-ratio": "minParaRatio",
  minlenratio: "minLenRatio",
  "min-len-ratio": "minLenRatio",
};
const BRIEF_CLAMP = {
  maxAnnotations: [3, 30],
  maxEnRun: [4, 10],
  minParaRatio: [0.4, 0.95],
  minLenRatio: [0.3, 0.9],
};

export function parseBrief(text) {
  const out = {};
  const grab = (key, val) => {
    const k = BRIEF_KEYMAP[key.toLowerCase()];
    if (k && val !== "" && Number.isFinite(Number(val))) {
      const [lo, hi] = BRIEF_CLAMP[k];
      out[k] = Math.min(Math.max(Number(val), lo), hi);
    }
  };
  try {
    const json = JSON.parse(text);
    for (const [k, v] of Object.entries(json || {})) grab(k, String(v));
    return out;
  } catch (_e) {
    // 非 JSON：逐行 key: value
  }
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z-]+)\s*[:：]\s*(\S+)\s*$/);
    if (m) grab(m[1], m[2]);
  }
  return out;
}

export function loadBrief(p) {
  if (!p) return {};
  let raw;
  try {
    raw = fs.readFileSync(p, "utf-8");
  } catch (e) {
    throw new Error(`brief 文件读取失败（${p}）：${e.message}`);
  }
  return parseBrief(raw);
}

// ---------- 主校验 ----------

export function verify(originalText, translatedText, opts = {}) {
  const keepList = opts.keepList || null;
  const th = defaultThresholds(opts);
  const fails = []; // {check, message, detail}
  const warns = [];
  const keepTerms = keepList
    ? [...keepList.keep, ...keepList.properNouns, ...keepList.abbreviations].map((t) => String(t).trim()).filter(Boolean)
    : [];

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

  // 6. 数字保真：原文散文数字 ⊆ 译文（等价变体任一命中即过；代码/URL 内数字由 1/3 项另行保证，
  //    且译文代码块原样保留时其数字自然可被搜到，故直接在全文搜索）。
  const oProse = stripMechanical(originalText, keepTerms);
  const oNums = extractNumbers(oProse);
  const missingNums = [];
  for (const n of oNums) {
    const vs = numberVariants(n);
    if (!vs.some((cand) => translatedText.includes(cand))) missingNums.push(n);
  }
  if (missingNums.length) {
    const shown = missingNums.slice(0, 10).join("、");
    const more = missingNums.length > 10 ? ` …等共 ${missingNums.length} 项` : "";
    fails.push({ check: "number-fidelity", message: `数字缺失或被改写：${shown}${more}`, detail: missingNums });
  }

  // 7. 散文残留英文
  const tProse = stripMechanical(translatedText, keepTerms);
  const enRuns = englishRuns(tProse, th.maxEnRun);
  for (const r of enRuns.slice(0, 5)) fails.push({ check: "en-residue", message: `疑似整句漏译（连续 ${r.split(/\s+/).length} 个英文词）：${preview(r)}`, detail: r });
  if (enRuns.length > 5) fails.push({ check: "en-residue", message: `…另有 ${enRuns.length - 5} 处连续英文长 run` });
  const enWords = (tProse.match(/[A-Za-z][A-Za-z'’-]*/g) || []).length;
  const latinChars = (tProse.match(/[A-Za-z]/g) || []).length;
  const totalChars = tProse.replace(/\s/g, "").length;
  const latinRatio = totalChars ? latinChars / totalChars : 0;
  if (latinRatio > 0.35) warns.push(`散文英文字母占比 ${(latinRatio * 100).toFixed(0)}%：表格/keep 密集 chunk 正常，请结合 ⑦ 判定`);

  // 8. 中英间距
  const spacings = spacingViolations(tProse);
  if (spacings.length > th.maxSpacing) {
    const shown = spacings.slice(0, 5).map((s) => `「…${s}…」`).join(" ");
    fails.push({ check: "spacing", message: `中英间距违规 ${spacings.length} 处（> 容忍 ${th.maxSpacing}）：${shown}${spacings.length > 5 ? " …" : ""}`, detail: spacings });
  }

  // 9. 防空洞化：段落计数比 + 散文长度比双下限
  const oParas = paragraphUnits(originalText).length;
  const tParas = paragraphUnits(translatedText).length;
  const lenO = Buffer.byteLength(oProse, "utf-8");
  const lenT = Buffer.byteLength(tProse, "utf-8");
  const paraRatio = oParas ? tParas / oParas : 1;
  const lenRatio = lenO ? lenT / lenO : 1;
  if (oParas - tParas >= th.paraAbsTol && paraRatio < th.minParaRatio) {
    fails.push({ check: "structure", message: `段落数骤减：原文 ${oParas} 段 → 译文 ${tParas} 段（比值 ${paraRatio.toFixed(2)} < ${th.minParaRatio}），疑似整段漏译`, detail: { oParas, tParas } });
  }
  if (lenO >= th.lenFloor && lenRatio < th.minLenRatio) {
    fails.push({ check: "structure", message: `译文过短：散文长度 ${lenO}B → ${lenT}B（比值 ${lenRatio.toFixed(2)} < ${th.minLenRatio}），疑似缩写漏译`, detail: { lenO, lenT } });
  }

  // 10. 注释密度（仅 WARN，不硬判）
  //    计数无法区分"金句原文括注 / 引用 / 专名括注 / 数据列表"与真正的"词级 spam"；
  //    能机械硬判的已在上面的 FAIL；过注与否的硬判留给语义层（审校 + 阶段B）。
  const annCount = countEnglishAnnotations(translatedText);
  if (annCount > th.maxAnnotations) {
    warns.push(`（英文）括注数 ${annCount} > ${th.maxAnnotations}：含金句原文/引用/专名括注时正常，需语义层判定是否真过注（--max-annotations / brief 可调）`);
  } else if (annCount > th.maxAnnotations * 0.7) {
    warns.push(`（英文）括注数偏高：${annCount}/${th.maxAnnotations}，接近阈值`);
  }

  return {
    passed: fails.length === 0,
    fails,
    warns,
    stats: {
      annotationCount: annCount,
      maxAnnotations: th.maxAnnotations,
      originalNumbers: oNums.length,
      missingNumbers: missingNums.length,
      enWords,
      latinRatio: Math.round(latinRatio * 100) / 100,
      spacingViolations: spacings.length,
      oParas,
      tParas,
      paraRatio: Math.round(paraRatio * 100) / 100,
      proseBytesO: lenO,
      proseBytesT: lenT,
      lenRatio: Math.round(lenRatio * 100) / 100,
    },
    thresholds: th,
  };
}

function preview(s) {
  const one = String(s).replace(/\s+/g, " ").trim();
  return one.length > 80 ? one.slice(0, 80) + "…" : one;
}

// ---------- 结果落盘 ----------

// 追加一条运行记录到 translation 根目录的 verify-results.json。
// 仅当译文位于 */translated-chunks/ 下时生效；任何异常静默跳过（落盘是旁路功能，不能拖垮校验）。
function appendResultLog(translatedPath, record) {
  try {
    const dir = path.dirname(translatedPath);
    if (path.basename(dir) !== "translated-chunks") return null;
    const root = path.resolve(dir, "..");
    const logPath = path.join(root, "verify-results.json");
    let entries = [];
    try {
      entries = JSON.parse(fs.readFileSync(logPath, "utf-8"));
      if (!Array.isArray(entries)) entries = [];
    } catch (_e) {
      entries = []; // 不存在或损坏 → 重建
    }
    entries.push(record);
    fs.writeFileSync(logPath, JSON.stringify(entries, null, 2));
    return logPath;
  } catch (_e) {
    return null;
  }
}

// ---------- CLI ----------

function parseArgs(argv) {
  const pos = [];
  const opts = { keepListPath: null, briefPath: null, maxAnnotations: null, json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--keep-list") opts.keepListPath = argv[++i];
    else if (a === "--brief") opts.briefPath = argv[++i];
    else if (a === "--max-annotations") opts.maxAnnotations = parseInt(argv[++i], 10);
    else if (a === "--json") opts.json = true;
    else if (a === "-h" || a === "--help") opts.help = true;
    else pos.push(a);
  }
  return { pos, opts };
}

function printHelp() {
  console.log(`verify-mech.mjs — xl-translator 翻译后机械校验（单次判定）

用法:
  node verify-mech.mjs <original.md> <translated.md> [--keep-list <path>] [--brief <path>] [--max-annotations N] [--json]

校验项（FAIL 退出码 1）:
  1. 代码块 / 行内代码：原文 ⊆ 译文（抓遗漏与误改）
  2. 内联 SVG：逐块字节比对
  3. URL：原文每个 URL 须在译文中原样出现
  4. keep-list：原文出现的条目须原样保留英文
  5. «» 标记残留 = 0
  6. 数字保真：原文散文数字 ⊆ 译文（万/亿换算等价；单位留给审校）
  7. 散文残留英文：剥离机械元素后连续英文词 ≥ 6（--max-en-run 经 brief 调）
  8. 中英间距：中文与 ASCII 字母/数字间须有空格
  9. 防空洞化：段落计数比 < 0.6 或散文长度比 < 0.35（brief 可调）
  10. （英文）注释密度超阈值 → 仅 WARN

输入: chunk 原文 + 译文 + keep-list + brief（阈值来源；优先级 CLI > brief > 默认）
输出: 退出码 0=过 / 1=打回；--json 出完整结果；译文在 */translated-chunks/ 下时追加 verify-results.json
      （终检不信任该文件，会对最终译文重跑）

升级计数（同 chunk ≤2 次打回）归 status.mjs（M1b），本脚本不计数。`);
}

export function runCli(args) {
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
  let briefTh = {};
  if (opts.briefPath) {
    try {
      briefTh = loadBrief(opts.briefPath);
    } catch (e) {
      console.error(`❌ ${e.message}`);
      process.exit(1);
    }
  }
  // 优先级：CLI 显式旗标 > brief > 默认
  if (opts.maxAnnotations != null) briefTh.maxAnnotations = opts.maxAnnotations;
  const result = verify(originalText, translatedText, { keepList, ...briefTh });
  appendResultLog(pos[1], {
    time: new Date().toISOString(),
    original: path.basename(pos[0]),
    translated: path.basename(pos[1]),
    originalSha1: crypto.createHash("sha1").update(originalText).digest("hex").slice(0, 12),
    translatedSha1: crypto.createHash("sha1").update(translatedText).digest("hex").slice(0, 12),
    passed: result.passed,
    failChecks: [...new Set(result.fails.map((f) => f.check))],
    failCount: result.fails.length,
    warnCount: result.warns.length,
    thresholds: result.thresholds,
    _note: "流水缓存非事实源：final-gate 终检不信任本文件，会对最终译文重跑 verify-mech",
  });
  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    if (result.passed) {
      console.log(`✅ 机械校验通过（注释 ${result.stats.annotationCount}/${result.stats.maxAnnotations}，间距违规 ${result.stats.spacingViolations}，长度比 ${result.stats.lenRatio}）`);
    } else {
      console.log(`❌ 机械校验未通过（${result.fails.length} 项 FAIL）：`);
      for (const f of result.fails) console.log(`  • [${f.check}] ${f.message}`);
    }
    for (const w of result.warns) console.log(`  ⚠ ${w}`);
  }
  process.exit(result.passed ? 0 : 1);
}

const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  runCli(process.argv.slice(2));
}
