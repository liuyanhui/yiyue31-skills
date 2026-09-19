// derive-bilingual.mjs — xl-translator 双语对照派生视图（Phase 1，HANDOFF §3 T1.3）
//
// 定位（红线③二分）：PASS 后由（交付物 × 原文）机械派生的只读视图——非交付物、不经终检、
// sha 不锚、不受手修保护、幂等可重生成、命名永不以 -zh.md 结尾。
// 译文侧输入 = translated-chunks/（管线产物）× chunks/ 逐对交错——交付物未手改时
// assemble(translated-chunks) === 交付物正文，等价于"交付物 × 原文"；手改时照跑 + WARN，
// 双语版基于管线产物（§1.7）。
//
// 固定判据 B1-B8（契约登记于 scripts/test/README.md，测试按此写）：
//   B1 只读纪律：唯一产物 translated-<title>-bilingual.md；绝不写交付物/原文/chunks/译文
//   B2 chunk 配对精确：manifest NN 连续 + manifest sha × chunks/ 实文件 + translated 存在性；
//      配对失败 = 退出码 3（merge M6 同款绝不静默）
//   B3 交付物 sha ≠ REPORT 锚（疑手改）→ 照跑 + WARN 一行；assemble(译文) ≠ 交付物正文同款 WARN
//   B4 fence 感知节切分：锚开优先锚行配对（译文标题次行 *…* 剥星号逐字 === 原文标题，一对一）；
//      锚关或任一锚行缺失 → 整 chunk 回退标题顺序配对；标题数不等 → 整 chunk 降级对照
//   B5 节内块按序配对：protectedRanges 整块 + 空行分段；块级指纹 = 代码块逐字相等 + isCode 一致；
//      节级指纹 = URL 集合相等；块数不匹配或指纹不符 → 该节降级节级对照（宁降级不误导——
//      任务级裁量：按序错配的交错比对照更害读者）
//   B6 交错格式：元信息头仅文件头一次（交付物头部照抄至首个 --- + 引用块内追加双语版行）；
//      锚行原样保留（锚关时插英文标题行——英文标题信息恰好出现一次，不与锚行重复）；
//      只交错、不改动任何块内容
//   B7 幂等：同输入重跑字节相同（无时间戳无随机；头部源交付物 sha 是确定性字段）
//   B8 降级清单随输出可见：文件尾注释 + stdout + 对齐覆盖率
//
// CLI: node derive-bilingual.mjs <workdir> [--json]
// 退出码: 0 成功 / 1 用法错 / 2 工作目录异常 / 3 输入损坏（无交付物、chunk 配对失败——绝不静默）

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { scanWorkdir, appendEvents } from "./status.mjs";
import { fenceAwareHeadings, protectedRanges } from "./segment/segment.mjs";
import { manifestChunkShas, assemble } from "./merge.mjs";
import { anchorOff, stripMetaHeader } from "./final-gate.mjs";

const sha12 = (s) => crypto.createHash("sha1").update(s, "utf-8").digest("hex").slice(0, 12);
const fileSha = (p) => sha12(fs.readFileSync(p, "utf-8"));
const nn2 = (n) => String(n).padStart(2, "0");
const isFenceLine = (l) => /^\s{0,3}(`{3,}|~{3,})/.test(l);
// 锚行 = 单行弱化斜体 *English Heading*（Step 2 标题双语锚契约形态）
const ANCHOR_RE = /^\*([^*]+)\*$/;
// URL 集合指纹：排除空白/括号/引号/中文标点（截断于首个此类字符）
const URL_RE = /https?:\/\/[^\s()[\]<>"'`、。，；：！？）】》]+/g;

function safeRead(p) {
  try {
    return fs.readFileSync(p, "utf-8");
  } catch {
    return null;
  }
}

// ---------- interleave 纯函数（测试复用点，仿 merge.assemble 被 final-gate 复用的先例） ----------
//
// 单对 chunk 交错：origText（chunks/ 原文）× zhText（translated-chunks 译文）。
// 返回 { text, mode, totalSections, degraded }；degraded = [{ title, reason }]（B8 清单数据源）。

// 节 = 标题行起的行区间（含端点，fence 感知定界）；首标题前的非空内容为 preamble 节（heading=null）
function sectionRanges(lines, headings) {
  const secs = [];
  if (headings.length === 0) {
    if (lines.some((l) => l.trim() !== "")) secs.push({ heading: null, s: 0, e: lines.length - 1 });
    return secs;
  }
  if (headings[0].lineIdx > 0 && lines.slice(0, headings[0].lineIdx).some((l) => l.trim() !== "")) {
    secs.push({ heading: null, s: 0, e: headings[0].lineIdx - 1 });
  }
  headings.forEach((h, i) => {
    secs.push({ heading: h, s: h.lineIdx, e: i + 1 < headings.length ? headings[i + 1].lineIdx - 1 : lines.length - 1 });
  });
  return secs;
}

// 块切分（B5）：保护区（围栏/HTML 表/管道表）整块一个；其余按空行分段（空行仅作分隔不成块）
function splitBlocks(lines) {
  const prot = new Uint8Array(lines.length);
  for (const [s, e] of protectedRanges(lines)) for (let i = s; i <= e && i < lines.length; i++) prot[i] = 1;
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    if (lines[i].trim() === "") { i++; continue; }
    const s = i;
    if (prot[i] === 1) while (i < lines.length && prot[i] === 1) i++;
    else while (i < lines.length && prot[i] === 0 && lines[i].trim() !== "") i++;
    blocks.push({ text: lines.slice(s, i).join("\n"), code: isFenceLine(lines[s]) });
  }
  return blocks;
}

const urlSet = (text) => new Set(text.match(URL_RE) ?? []);

export function interleave(origText, zhText, opts = {}) {
  const anchor = opts.anchor !== false;
  const label = opts.label ?? "chunk";
  const origLines = origText.split("\n");
  const zhLines = zhText.split("\n");
  const origH = fenceAwareHeadings(origLines);
  const zhH = fenceAwareHeadings(zhLines);

  // 整 chunk 降级（B4）：标题数不等（en 侧配不齐）
  if (origH.length !== zhH.length) {
    const reason = `标题数不等（原文 ${origH.length} / 译文 ${zhH.length}）`;
    return {
      text: [zhLines.join("\n"), `<!-- 双语对照·降级：${label}——${reason}，整 chunk 节级对照 -->`, origLines.join("\n")].join("\n\n"),
      mode: "degraded",
      totalSections: 1,
      degraded: [{ title: label, reason }],
    };
  }

  const origSecs = sectionRanges(origLines, origH);
  const zhSecs = sectionRanges(zhLines, zhH);
  // 整 chunk 降级：节切分不匹配（标题前导内容单侧存在——内容块已不对齐；标题数已相等，差值只能来自 preamble）
  if (origSecs.length !== zhSecs.length) {
    const reason = `节切分不匹配（原文 ${origSecs.length} 节 / 译文 ${zhSecs.length} 节——标题前导内容单侧存在）`;
    return {
      text: [zhLines.join("\n"), `<!-- 双语对照·降级：${label}——${reason}，整 chunk 节级对照 -->`, origLines.join("\n")].join("\n\n"),
      mode: "degraded",
      totalSections: 1,
      degraded: [{ title: label, reason }],
    };
  }

  // 配对模式（B4）：锚开且锚行齐全可一对一 → 锚配对；否则整体回退标题顺序配对
  // （顺序配对下两两侧结构平行——同标题数 + 同 preamble 存在性 ⇒ zhSecs[i] ↔ origSecs[i]）
  let pairing = anchor ? "anchor" : "order";
  const anchorMap = new Map(); // zh 节 idx → orig 节 idx
  if (anchor) {
    const byTitle = new Map(); // origTitle → 未消耗的 orig 节 idx 队列（同名标题一对一消耗）
    origSecs.forEach((s, i) => {
      if (s.heading) byTitle.set(s.heading.title, [...(byTitle.get(s.heading.title) ?? []), i]);
    });
    const preIdx = origSecs.findIndex((s) => !s.heading); // -1 = 无 preamble（此时 zh 侧也必无，见上）
    for (let i = 0; i < zhSecs.length; i++) {
      const zs = zhSecs[i];
      if (!zs.heading) { anchorMap.set(i, preIdx); continue; } // preamble ↔ preamble
      const m = zhLines[zs.heading.lineIdx + 1]?.match(ANCHOR_RE);
      const cand = m ? (byTitle.get(m[1].trim()) ?? []) : [];
      const j = cand.shift();
      if (j === undefined) { pairing = "order"; break; } // 任一锚行缺失/不匹配 → 整体回退
      anchorMap.set(i, j);
    }
    // 一对一完备性（映射值全为有效下标且无重复）
    const vals = [...anchorMap.values()];
    if (pairing === "anchor" && (vals.some((v) => v == null || v < 0) || new Set(vals).size !== zhSecs.length)) pairing = "order";
  }
  const origIndexOf = (i) => (pairing === "anchor" ? anchorMap.get(i) : i);

  const parts = [];
  const degraded = [];
  for (let i = 0; i < zhSecs.length; i++) {
    const zs = zhSecs[i];
    const os = origSecs[origIndexOf(i)];
    const zTitle = zs.heading?.title ?? `${label}（标题前内容）`;

    // 标题呈现（B6）：中文标题行 + 锚行原样保留；锚行缺失（锚关或缺锚）时插 *English*——英文标题恰好一次
    const head = [];
    let bodyFrom = zs.s;
    if (zs.heading) {
      head.push(zhLines[zs.heading.lineIdx]);
      const next = zhLines[zs.heading.lineIdx + 1] ?? "";
      if (ANCHOR_RE.test(next)) { head.push(next); bodyFrom = zs.heading.lineIdx + 2; }
      else { head.push(`*${os.heading.title}*`); bodyFrom = zs.heading.lineIdx + 1; }
    }

    // 节内块切分（B5）：zh 侧去标题/锚行；en 侧去标题行；preamble 两侧全量
    const zhBody = zs.e >= bodyFrom ? splitBlocks(zhLines.slice(bodyFrom, zs.e + 1)) : [];
    const enFrom = os.heading ? os.heading.lineIdx + 1 : os.s;
    const enBody = os.e >= enFrom ? splitBlocks(origLines.slice(enFrom, os.e + 1)) : [];

    // 双级指纹（B5）：块数 + 块级（代码块逐字 & isCode 一致）+ 节级（URL 集合相等）
    const countOk = zhBody.length === enBody.length;
    const codeOk = countOk && zhBody.every((b, k) => b.code === enBody[k].code && (!b.code || b.text === enBody[k].text));
    const zhUrls = urlSet(zhLines.slice(bodyFrom, zs.e + 1).join("\n"));
    const enUrls = urlSet(origLines.slice(enFrom, os.e + 1).join("\n"));
    const urlOk = zhUrls.size === enUrls.size && [...zhUrls].every((u) => enUrls.has(u));

    if (!countOk || !codeOk || !urlOk) {
      const reason = !countOk ? `块数不匹配（中 ${zhBody.length} / 英 ${enBody.length}）` : !codeOk ? "代码块指纹不符（isCode 不一致或代码块非逐字）" : "URL 集合不符";
      degraded.push({ title: zTitle, reason });
      parts.push([zhLines.slice(zs.s, zs.e + 1).join("\n"), `<!-- 双语对照·降级：${label}「${zTitle}」——${reason}，该节节级对照 -->`, origLines.slice(os.s, os.e + 1).join("\n")].join("\n\n"));
      continue;
    }

    const sec = head.length ? [head.join("\n")] : [];
    for (let k = 0; k < zhBody.length; k++) sec.push(zhBody[k].text, enBody[k].text); // 中文在上英文在下
    parts.push(sec.join("\n\n"));
  }

  return { text: parts.join("\n\n"), mode: pairing, totalSections: zhSecs.length, degraded };
}

// ---------- 主流程 ----------

export function runDerive(dir, opts = {}) {
  const inv = scanWorkdir(dir);
  if (inv.errors.length) return { exitCode: 2, errors: inv.errors };
  const title = inv.title;
  const deliverable = `translated-${title}-zh.md`;
  const deliverablePath = path.join(dir, deliverable);
  const deliverableRaw = safeRead(deliverablePath);
  if (deliverableRaw == null) {
    return { exitCode: 3, errors: [`无交付物 ${deliverable}——双语派生是 PASS 后视图，先走完终检（绝不静默拼视图）`] };
  }
  const deliverableSha = fileSha(deliverablePath);
  const warns = [];

  // B2：chunk 配对精确（manifest NN 连续 × chunks 实文件 sha × translated 存在性）
  const nns = inv.chunks.map((c) => c.nn);
  const gapAt = nns.findIndex((n, i) => n !== i + 1);
  if (gapAt !== -1) {
    return { exitCode: 3, errors: [`乱序号：manifest 第 ${gapAt + 1} 行 NN=${nn2(nns[gapAt])}，应为 ${nn2(gapAt + 1)}（01..N 严格递增）`] };
  }
  const missing = nns.filter((n) => !inv.translated[n]);
  if (missing.length) {
    return { exitCode: 3, errors: [`缺译文：manifest 登记的 ${missing.map(nn2).join(", ")} 无 translated-chunk-NN.md——配对失败，绝不静默错配`] };
  }
  const extra = Object.keys(inv.translated).map(Number).filter((n) => !nns.includes(n));
  if (extra.length) {
    return { exitCode: 3, errors: [`多余译文 chunk ${extra.map(nn2).join(", ")}：不在 manifest 登记内——先清理`] };
  }
  const shaBad = [];
  for (const row of manifestChunkShas(inv.manifest)) {
    const p = path.join(dir, "chunks", row.name);
    if (fs.existsSync(p) && fileSha(p) !== row.sha) shaBad.push(row.name);
  }
  if (shaBad.length) {
    return { exitCode: 3, errors: [`sha 不符：manifest 记录与 chunks/ 实文件不一致（${shaBad.join(", ")}）——分母被改动，配对失败`] };
  }

  // B3：交付物 sha ≠ REPORT 锚 / 交付物正文 ≠ assemble(译文) → 照跑 + WARN（派生只读，不触发询问）
  const reportText = safeRead(path.join(dir, "REPORT.md"));
  if (reportText == null) {
    warns.push("REPORT.md 缺失——无交付物 sha 锚可核（照常派生）");
  } else {
    const anchorSha = reportText.match(/^-?\s*交付物：\S+（sha1 前 12：([0-9a-f]{12})）/m)?.[1] ?? null;
    if (anchorSha != null && anchorSha !== deliverableSha) {
      warns.push(`交付物 sha ${deliverableSha} ≠ REPORT 锚 ${anchorSha}（疑手改）——派生只读不覆盖交付物，本行即止`);
    }
  }
  const assembled = assemble(nns.map((n) => ({ nn: n, text: inv.translated[n].text }))).merged;
  if (assembled !== stripMetaHeader(deliverableRaw)) {
    warns.push("交付物正文 ≠ assemble(translated-chunks)——双语版基于管线产物（translated-chunks），与交付物手修部分不一致");
  }

  // 交错（锚开关解析复用 final-gate anchorOff——单一事实源；brief 缺失按开，SKILL 默认）
  const anchor = !anchorOff(safeRead(path.join(dir, "brief.md")));
  const degraded = [];
  let totalSections = 0;
  const chunkParts = [];
  for (const c of [...inv.chunks].sort((a, b) => a.nn - b.nn)) {
    const label = `chunk ${nn2(c.nn)}`;
    const r = interleave(safeRead(path.join(dir, "chunks", c.name)) ?? "", inv.translated[c.nn].text, { anchor, label });
    totalSections += r.totalSections;
    for (const d of r.degraded) degraded.push({ where: `${label}「${d.title}」`, reason: d.reason });
    chunkParts.push(r.text);
  }

  // 头部（B6）：交付物头部照抄（至首个 --- 行含）+ 引用块内追加双语版行（源交付物 sha——status 三态数据源，C3）
  const lines = deliverableRaw.split("\n");
  const hrIdx = lines.findIndex((l) => /^---\s*$/.test(l));
  const bilingualLine = `> **双语版**：由源交付物与原文机械交错的只读派生视图（非交付物、不经终检、不受手修保护）——源交付物 sha1（前 12）：${deliverableSha}；重说「双语对照 ${title}」可幂等重生成`;
  let header;
  if (hrIdx === -1) {
    warns.push("交付物无元信息头（无 --- 行）——双语版头以最小形态生成");
    header = [bilingualLine, "", "---"].join("\n");
  } else {
    let lastQ = -1; // 顶部引用块末行（> 开头的连续区，元信息头形态——renderMetaHeader）
    for (let i = 0; i < hrIdx; i++) {
      if (/^>/.test(lines[i])) lastQ = i;
      else if (lastQ >= 0) break;
    }
    header = lastQ >= 0
      ? [...lines.slice(0, lastQ + 1), bilingualLine, ...lines.slice(lastQ + 1, hrIdx + 1)].join("\n")
      : [bilingualLine, ...lines.slice(0, hrIdx + 1)].join("\n");
  }

  // 尾注（B8）：降级清单 + 覆盖率（恒输出——零降级也留覆盖率锚，幂等可 grep）
  const aligned = totalSections - degraded.length;
  const pct = totalSections ? ((aligned / totalSections) * 100).toFixed(1) : "0.0";
  const tail = degraded.length
    ? `<!-- derive-bilingual：对齐覆盖率 ${aligned}/${totalSections} 节（${pct}%）｜降级 ${degraded.length} 节\n${degraded.map((d) => `- ${d.where}：${d.reason}`).join("\n")}\n-->`
    : `<!-- derive-bilingual：对齐覆盖率 ${aligned}/${totalSections} 节（${pct}%）｜降级 0 节 -->`;

  const output = `${header}\n\n${chunkParts.join("\n\n")}\n\n${tail}\n`;
  const outputPath = path.join(dir, `translated-${title}-bilingual.md`);
  fs.writeFileSync(outputPath, output, "utf-8"); // B1：唯一产物

  appendEvents(dir, {
    ev: "derive-bilingual",
    bilingualSha: sha12(output),
    coverage: { aligned, total: totalSections, degraded: degraded.length },
    anchorPairing: anchor,
    warnings: warns.length,
  });

  return {
    exitCode: 0,
    outputPath,
    bilingualSha: sha12(output),
    anchorPairing: anchor,
    coverage: { aligned, total: totalSections, degraded: degraded.length, pct },
    degraded,
    warnings: warns,
    result: {
      passed: true,
      summary: `双语对照已生成：translated-${title}-bilingual.md（对齐覆盖率 ${aligned}/${totalSections} 节，${pct}%；降级 ${degraded.length} 节；锚配对${anchor ? "开" : "关"}）`,
    },
  };
}

// ---------- CLI ----------

function parseArgs(argv) {
  const pos = [];
  const opts = { json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") opts.json = true;
    else if (a === "-h" || a === "--help") opts.help = true;
    else pos.push(a);
  }
  return { pos, opts };
}

const __help = `derive-bilingual.mjs — xl-translator 双语对照派生视图（Phase 1）

用法:
  node derive-bilingual.mjs <workdir> [--json]

规则（固定判据 B1-B8，见 scripts/test/README.md）:
  - 译文侧 = translated-chunks × chunks 逐对交错（管线产物，非交付物本体）；手改交付物照跑 + WARN
  - 节配对：锚开优先锚行（*English* 逐字 === 原文标题）；锚关或缺锚回退标题顺序；配不齐整 chunk 降级对照
  - 块配对按序 + 双级指纹（代码块逐字 + isCode；URL 集合）；不符该节降级节级对照（宁降级不误导）
  - 只读纪律：唯一产物 translated-<title>-bilingual.md，绝不写交付物/原文/chunks/译文
  - 幂等：同输入重跑字节相同；头部嵌源交付物 sha（status 三态数据源）

产物: <workdir>/translated-<title>-bilingual.md + events.jsonl 追加 derive-bilingual 事件
退出码: 0 成功 / 1 用法 / 2 工作目录异常 / 3 输入损坏（无交付物、chunk 配对失败）`;

// CLI 守卫用 fileURLToPath：new URL().pathname 在 Windows 是 /D:/... 形态，
// path.resolve 会拼出 D:\D:\... 与 argv[1] 恒不等（入口静默空转、退出码 0 的假绿）
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const { pos, opts } = parseArgs(process.argv.slice(2));
  if (opts.help || pos.length < 1) {
    console.log(__help);
    process.exit(pos.length < 1 && !opts.help ? 1 : 0);
  }
  const r = runDerive(pos[0], opts);
  if (r.errors?.length) console.error(`❌ ${r.errors.join("\n  ")}`);
  if (r.result?.summary) console.log(`✅ ${r.result.summary}`);
  for (const d of r.degraded ?? []) console.log(`  ⚠ 降级 ${d.where}：${d.reason}`);
  for (const w of r.warnings ?? []) console.log(`  ⚠ ${w}`);
  if (opts.json) console.log(JSON.stringify({ ...r, result: undefined, errors: r.errors ?? [] }, null, 2));
  process.exit(r.exitCode);
}
