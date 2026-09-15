// consistency.mjs — xl-translator Step 8 统稿清单全量扫描（DESIGN §2 Step 8；§5.2 B 表）
//
// fork 自 yiyue31-translator/scripts/consistency-checklist.js（一次性拷贝改造，绝不回写源——
// 零共享纪律）：继承 ① 术语表面形式 ② 注释密度离群 ③ 格式一致性 三扫描；
// xl 扩展 ④ 标题译法一致性（双语锚对提取：同一英文锚对应多个中文译名 = 离群）
//        ⑤ 中英间距清点（供统稿机械补空格通道，G7 同型）
//        ⑥ 接缝拼料（相邻 chunk 边界首末段拼条——跨章不一致高发区，判读归决策）
//        ⑦ 文风遵从拼料（每 chunk 首段抽样 + 指向 style-card——决策 subagent 对照判偏离）。
//
// 清单哲学（fork 源不变）：机械只拼料不判语义——决策 subagent 只读清单下结论，不读整篇译文。
//
// CLI: node consistency.mjs <workdir> [--output <path>] [--json]
//   输入自工作目录推导：merged-draft.md（无则交付物去元信息头——final-gate 同款 strip）+
//   glossary-<title>.md + translated-chunks/ + style-card.md（存在时）
// 退出码: 0 正常出清单（清单无 FAIL 语义——统稿判定归决策 subagent）/ 1 用法错 / 2 工作目录异常

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractCode, countEnglishAnnotations, spacingViolations, stripMechanical } from "./verify-mech.mjs";

// ---------- ① 术语表面形式（fork 源继承） ----------

export function proseOnly(text) {
  const c = extractCode(text);
  return c.blocks.length || c.untagged?.length || c.inline.length
    ? text.replace(/```[^\n`]*\n?[\s\S]*?```/g, "").replace(/`[^`\n]+`/g, "")
    : text;
}

export function checkTerms(mergedProse, glossaryEntries) {
  const flags = [];
  for (const e of glossaryEntries) {
    if (e.isKeep) continue;
    // 只对"应译成纯中文"的术语报裸英文残留：译法本身含英文意味着该词本就保留英文，不算不一致
    if (/[a-zA-Z]/.test(e.translation)) continue;
    const term = String(e.english).trim();
    if (!term) continue;
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(?<![\\w])${escaped}(?![\\w])`, "gi");
    const matches = mergedProse.match(re);
    if (matches && matches.length > 0) flags.push({ term, declared: e.translation, rawCount: matches.length });
  }
  return flags;
}

// ---------- ② 注释密度离群（fork 源继承） ----------

export function annotationOutliers(chunkTexts) {
  const counts = chunkTexts.map(({ file, text }) => ({ file, count: countEnglishAnnotations(text) }));
  const total = counts.reduce((s, c) => s + c.count, 0);
  // 离群 = 该 chunk 注释数 > 其余 chunk 平均的 2 倍，且绝对值 ≥ 2（避免单条散注误报）
  return counts
    .filter((c) => {
      const othersMean = counts.length > 1 ? (total - c.count) / (counts.length - 1) : 0;
      return c.count >= 2 && c.count > othersMean * 2;
    })
    .map((c) => ({ ...c, total }));
}

// ---------- ③ 格式一致性（fork 源继承） ----------

export function checkFormat(text) {
  const headingLevels = [];
  const unorderedMarkers = new Set(); // - * + 混用才算问题
  let fenceBack = 0;
  let fenceTilde = 0;
  for (const line of text.split(/\r?\n/)) {
    const h = line.match(/^(#{1,6})\s/);
    if (h) headingLevels.push(h[1].length);
    const li = line.match(/^\s*([-*+])\s/);
    if (li) unorderedMarkers.add(li[1]);
    if (/^```/.test(line.trim())) fenceBack++;
    else if (/^~~~/.test(line.trim())) fenceTilde++;
  }
  const skips = [];
  for (let i = 1; i < headingLevels.length; i++) {
    if (headingLevels[i] - headingLevels[i - 1] > 1) skips.push(`${headingLevels[i - 1]} → ${headingLevels[i]}`);
  }
  return {
    headingSkips: skips,
    listMarkersMixed: unorderedMarkers.size > 1 ? [...unorderedMarkers] : [],
    fenceMixed: fenceBack > 0 && fenceTilde > 0,
  };
}

// ---------- ④ 标题译法一致性（xl 扩展；依赖标题双语锚形态：标题行中文 + 次行 *English*） ----------

// 提取双语锚对 {level, zh, en}；未检出任何锚对（brief 关闭锚或未执行）返回空并让调用方披露跳过
export function headingPairs(text) {
  const lines = text.split(/\r?\n/);
  const out = [];
  for (let i = 0; i < lines.length - 1; i++) {
    const h = lines[i].match(/^(#{1,6})\s+(.+)$/);
    if (!h) continue;
    const a = lines[i + 1].match(/^\s*\*([^*]+)\*\s*$/);
    if (a) out.push({ level: h[1].length, zh: h[2].trim(), en: a[1].trim() });
  }
  return out;
}

// 同一英文锚对应多个中文译名 = 标题译法不一致（目录↔正文/章↔章漂移）
export function headingInconsistencies(pairs) {
  const byEn = new Map();
  for (const p of pairs) {
    if (!byEn.has(p.en)) byEn.set(p.en, new Set());
    byEn.get(p.en).add(p.zh);
  }
  return [...byEn.entries()]
    .filter(([, zhs]) => zhs.size > 1)
    .map(([en, zhs]) => ({ en, zhs: [...zhs] }));
}

// ---------- ⑤ 中英间距清点（xl 扩展；供统稿机械补空格——G7 同型通道） ----------

export function spacingInventory(mergedText) {
  const prose = stripMechanical(mergedText);
  const violations = spacingViolations(prose);
  return { count: violations.length, samples: violations.slice(0, 10) };
}

// ---------- ⑥ 接缝拼料（xl 扩展；机械不判语义，拼给决策 subagent） ----------

export function seamEntries(chunkTexts) {
  const out = [];
  for (let i = 0; i < chunkTexts.length - 1; i++) {
    const tail = proseOnly(chunkTexts[i].text).trim().slice(-80);
    const head = proseOnly(chunkTexts[i + 1].text).trim().slice(0, 80);
    out.push({ seam: `${chunkTexts[i].file} ↔ ${chunkTexts[i + 1].file}`, tail, head });
  }
  return out;
}

// ---------- ⑦ 文风遵从拼料（xl 扩展；每 chunk 首个正文段抽样，判卷锚 = style-card） ----------

// 跳过标题/双语锚行/围栏/表格——文风样本要的是正文，不是结构行
export function styleSamples(chunkTexts) {
  return chunkTexts.map(({ file, text }) => {
    const paras = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
    const first = paras.find((p) => !/^(#{1,6}\s|\*[^*]+\*$|```|~~~|\|)/.test(p)) ?? paras[0] ?? "";
    return { file, opening: first.slice(0, 100) };
  });
}

// ---------- 汇总 ----------

export function buildChecklist({ mergedText, glossaryEntries, chunkTexts, hasStyleCard }) {
  const prose = proseOnly(mergedText);
  const termFlags = glossaryEntries ? checkTerms(prose, glossaryEntries) : [];
  const outliers = annotationOutliers(chunkTexts);
  const fmt = checkFormat(mergedText);
  const pairs = headingPairs(mergedText);
  const headingFlags = headingInconsistencies(pairs);
  const spacing = spacingInventory(mergedText);
  const seams = seamEntries(chunkTexts);
  const style = styleSamples(chunkTexts);

  const L = [];
  L.push("# 全局一致性清单（供决策 subagent 只读此清单下结论；统稿轮 ≤2 的扫描底料）", "");
  L.push(`- 底料锚：merged ${prose.length} 字符｜chunk ${chunkTexts.length} 个｜双语锚对 ${pairs.length} 个`, "");

  L.push("## ① 术语表面形式不一致（glossary 已定译，正文仍残留裸英文）", "");
  if (!termFlags.length) L.push("- 无残留。");
  else {
    L.push("| 术语 | 已定译法 | 正文裸英文出现次数 |", "|------|----------|----------------------|");
    for (const t of termFlags) L.push(`| ${t.term} | ${t.declared} | ${t.rawCount} |`);
  }
  L.push("");

  L.push("## ② 注释密度离群 chunk（注释数 > 其余 chunk 平均的 2 倍）", "");
  if (!outliers.length) L.push("- 无离群。");
  else {
    L.push("| chunk | （英文）注释数 | 全篇总数 |", "|-------|----------------|-----------|");
    for (const o of outliers) L.push(`| ${o.file} | ${o.count} | ${o.total} |`);
  }
  L.push("");

  L.push("## ③ 格式一致性", "");
  L.push(`- 标题跳级：${fmt.headingSkips.length ? fmt.headingSkips.join("、") : "无"}`);
  L.push(`- 列表符混用：${fmt.listMarkersMixed.length ? fmt.listMarkersMixed.join("、") : "无"}`);
  L.push(`- 代码围栏混用（\`\`\` 与 ~~~ 并存）：${fmt.fenceMixed ? "是" : "否"}`);
  L.push("");

  L.push("## ④ 标题译法一致性（双语锚对）", "");
  if (!pairs.length) L.push("- 未检出双语锚对（brief 关闭标题锚或未执行）——本节跳过，随 brief 披露。");
  else if (!headingFlags.length) L.push(`- ${pairs.length} 个锚对全部同文同译。`);
  else {
    L.push("| 英文锚 | 中文译名出现多个 |", "|--------|------------------|");
    for (const f of headingFlags) L.push(`| ${f.en} | ${f.zhs.join("／")} |`);
  }
  L.push("");

  L.push(`## ⑤ 中英间距清点（${spacing.count} 处；统稿机械补空格通道——G7 同型，补后重跑 Step 5）`, "");
  if (spacing.count) for (const s of spacing.samples) L.push(`- 「…${s}…」`);
  else L.push("- 无违规。");
  L.push("");

  L.push("## ⑥ 接缝拼料（chunk 边界首末段——跨章不一致高发区，逐条判读）", "");
  for (const s of seams) L.push(`- ${s.seam}\n  - 上文末：…${s.tail}\n  - 下文首：${s.head}…`);
  L.push("");

  L.push(`## ⑦ 文风遵从拼料（每 chunk 首段抽样；判卷锚 = style-card.md${hasStyleCard ? "" : "（⚠ 文件缺失）"}，文体变化轴明示的分章变化不算漂移）`, "");
  for (const s of style) L.push(`- ${s.file}：${s.opening}…`);

  return { checklist: L.join("\n") + "\n", stats: { termFlags, outliers, headingFlags, spacingCount: spacing.count, seams: seams.length } };
}

// ---------- glossary 解析（fork 源继承） ----------

export function parseGlossary(text) {
  const entries = [];
  for (const raw of String(text ?? "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line.startsWith("|")) continue;
    if (/^\|[\s|:-]+\|?$/.test(line)) continue; // 分隔行
    const cells = line.slice(1, -1).split("|").map((c) => c.trim());
    if (cells.length < 2) continue;
    const english = cells[0];
    const translation = cells[1];
    if (!english || /english term|英文/i.test(english)) continue; // 表头
    entries.push({ english, translation, isKeep: /\[KEEP\]/i.test(translation) });
  }
  return entries;
}

// ---------- 主流程 ----------

export function runConsistency(dir, opts = {}) {
  const title = (() => {
    const f = fs.readdirSync(dir).find((x) => /^original-/.test(x));
    return f ? f.replace(/^original-/, "").replace(/\.md$/, "") : null;
  })();
  if (title == null) return { exitCode: 2, errors: ["缺 original-<title>.md——非 xl 工作目录"] };

  let mergedText = (() => {
    const m = fs.existsSync(path.join(dir, "merged-draft.md"))
      ? fs.readFileSync(path.join(dir, "merged-draft.md"), "utf-8")
      : null;
    if (m != null) return m;
    const d = fs.existsSync(path.join(dir, `translated-${title}-zh.md`))
      ? fs.readFileSync(path.join(dir, `translated-${title}-zh.md`), "utf-8")
      : null;
    if (d == null) return null;
    // 交付物去元信息头（裁决 B：头以 `> **原文**：` 起、首个 `---` 止）
    if (!d.startsWith("> **原文**：")) return d;
    const idx = d.split(/\r?\n/).findIndex((l) => /^---\s*$/.test(l));
    return idx === -1 ? d : d.split(/\r?\n/).slice(idx + 1).join("\n").replace(/^\n/, "");
  })();
  if (mergedText == null) return { exitCode: 2, errors: ["缺 merged-draft.md（Step 8 merge 未跑）"] };

  const glossaryFile = fs.readdirSync(dir).find((f) => /^glossary-/.test(f)) ?? null;
  const glossaryEntries = glossaryFile ? parseGlossary(fs.readFileSync(path.join(dir, glossaryFile), "utf-8")) : null;

  const tdir = path.join(dir, "translated-chunks");
  const chunkTexts = fs.existsSync(tdir)
    ? fs.readdirSync(tdir).filter((f) => /^translated-chunk-\d+\.md$/.test(f))
        .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]))
        .map((f) => ({ file: f, text: fs.readFileSync(path.join(tdir, f), "utf-8") }))
    : [];

  const hasStyleCard = fs.existsSync(path.join(dir, "style-card.md"));
  const { checklist, stats } = buildChecklist({ mergedText, glossaryEntries, chunkTexts, hasStyleCard });

  const outPath = opts.output ?? path.join(dir, `consistency-${title}.md`);
  fs.writeFileSync(outPath, checklist, "utf-8");
  return { exitCode: 0, outPath, stats, checklist };
}

// ---------- CLI ----------

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const getOpt = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : null);
  const dir = args.find((a) => !a.startsWith("--"));
  if (!dir || args.includes("--help") || args.includes("-h")) {
    console.log(`consistency.mjs — Step 8 统稿清单全量扫描（fork + xl 扩展）

用法: node consistency.mjs <workdir> [--output <path>] [--json]

产出: consistency-<title>.md——① 术语表面形式 ② 密度离群 ③ 格式 ④ 标题译法（双语锚对）
      ⑤ 间距清点 ⑥ 接缝拼料 ⑦ 文风遵从拼料；供决策 subagent 只读清单下结论。
退出码: 0 出清单（无 FAIL 语义）/ 1 用法错 / 2 工作目录异常`);
    process.exit(dir ? 0 : 1);
  }
  const r = runConsistency(path.resolve(dir), { output: getOpt("--output") });
  if (json) console.log(JSON.stringify(r, null, 2));
  else if (r.exitCode === 0) console.log(`✅ 清单已写入 ${r.outPath}（术语残留 ${r.stats.termFlags.length}｜密度离群 ${r.stats.outliers.length}｜标题不一致 ${r.stats.headingFlags.length}｜间距 ${r.stats.spacingCount}｜接缝 ${r.stats.seams}）`);
  else for (const e of r.errors ?? []) console.error(`❌ ${e}`);
  process.exit(r.exitCode);
}
