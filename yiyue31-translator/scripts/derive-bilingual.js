"use strict";

// derive-bilingual.js — 双语对照派生视图（v3.0.0；fork 自 yiyue31-xl-translator/scripts/
// derive-bilingual.mjs 的 interleave 算法，一次性移植为单文件 CJS，绝不回写源——零共享纪律）。
//
// 定位：交付后由（交付物 × 原文）机械派生的只读视图——非交付物、不经终检、不受手修保护、
// 幂等可重生成、命名不以 -zh.md 结尾（refined-stock 根级 ^.+-zh\.md$ 发布模式只匹配根级裸 .md，
// 嵌套 translation/ 目录天然不命中）。
//
// 与 xl 版差异：无 chunk 层（original-{title}.md × translated-{title}-zh.md 两文件整篇交错）；
// translator 无标题双语锚契约——锚行识别只认"紧随标题的无 CJK 斜体行"（恰为英文标题形态），
// 否则插合成 *English Heading* 行（英文标题信息恰好出现一次）。
//
// 判据（对齐 xl B1-B8，单文件形态）：
//   B1 只读纪律：唯一产物 translated-{title}-bilingual.md，绝不写交付物/原文
//   B2 输入配对：original-{title}.md + translated-{title}-zh.md 缺一即退出码 3（绝不静默）
//   B3 交付物手改无从核对（translator 无 REPORT sha 锚）——不设；如需核对重跑 verify-mechanical
//   B4 fence 感知节切分 + 标题顺序配对；标题数不等 → 整篇降级对照
//   B5 节内块按序配对 + 双级指纹（代码块逐字 + isCode 一致；URL 集合相等）；不符 → 节级对照
//      （宁降级不误导——按序错配的交错比对照更害读者）
//   B6 交错格式：元信息头照抄（至首个 --- 行含）+ 引用块内追加双语版行；只交错不改动任何块内容
//   B7 幂等：同输入重跑字节相同（无时间戳无随机；头部源交付物 sha 是确定性字段）
//   B8 降级清单随输出可见：文件尾注释 + stdout + 对齐覆盖率
//
// CLI: node derive-bilingual.js <translation-dir> [--json]
// 退出码: 0 成功 / 1 用法错 / 2 目录异常 / 3 输入损坏（缺原文或交付物）

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const sha12 = (s) => crypto.createHash("sha1").update(s, "utf-8").digest("hex").slice(0, 12);
const fileSha = (p) => sha12(fs.readFileSync(p, "utf-8"));
const isFenceLine = (l) => /^\s{0,3}(`{3,}|~{3,})/.test(l);
// 锚行候选 = 单行弱化斜体 *...*（xl 标题双语锚同形态）；仅当逐字 === 原文标题的 *…* 形态才作锚行
// 消费（评审②-10/R3-7：CJK 斜体行是译文内容，吞作锚行会偷走一个内容块）
const ANCHOR_RE = /^\*([^*]+)\*$/;
// URL 集合指纹：排除空白/括号/引号/中文标点；scheme 大小写不敏感（i）
const URL_RE = /https?:\/\/[^\s()[\]<>"'`、。，；：！？）】》]+/gi;

function safeRead(p) {
  try {
    return fs.readFileSync(p, "utf-8");
  } catch (_e) {
    return null;
  }
}

// 结构分析前归一：CRLF→LF + 剥头部 BOM（HEAD_RE/ANCHOR_RE 的 `.` 不匹配 \r——CRLF 输入整体失配标题）。
// 产物统一 LF（幂等不受影响：同输入同输出）。
const readNorm = (p) => {
  const t = safeRead(p);
  return t == null ? null : t.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
};

// URL 指纹归一：剥尾部 ASCII 句读（英文句点收尾 vs 中文句号收尾是翻译常态，不剥则伪降级）；
// scheme+host 大小写归一（URL 语法里这两段大小写不敏感）
function urlSet(text) {
  const out = new Set();
  for (const raw of text.match(URL_RE) || []) {
    const u = raw.replace(/[.,;:!?]+$/, "");
    const m = u.match(/^([a-zA-Z]+):\/\/([^/?#]*)(.*)$/);
    out.add(m ? `${m[1].toLowerCase()}://${m[2].toLowerCase()}${m[3]}` : u);
  }
  return out;
}

// ---------- fork 自 xl segment.mjs（fence 感知标题 + 保护区识别） ----------

const HEAD_RE = /^(#{1,6})\s+(.+)$/;

// 围栏状态机：``` 与 ~~~ 各自配对；围栏内的 # 行不是标题。
function fenceAwareHeadings(lines) {
  const headings = [];
  let fence = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fm = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (fm) {
      const marker = fm[1][0] === "`" ? "```" : "~~~";
      if (fence === null) fence = marker;
      else if (fence === marker) fence = null;
      continue;
    }
    if (fence !== null) continue;
    const m = line.match(HEAD_RE);
    if (m) headings.push({ lineIdx: i, level: m[1].length, title: m[2].trim() });
  }
  return headings;
}

// 保护区 = 原子不可切的行区间：代码围栏、HTML 表、管道表。
function protectedRanges(lines) {
  const ranges = [];
  let inTable = false;
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    const s = lines[i].trim().toLowerCase();
    if (s.includes("<table")) {
      inTable = true;
      start = i;
    }
    if (s.includes("</table>") && inTable) {
      ranges.push([start, i]);
      inTable = false;
    }
  }
  for (const mark of ["```", "~~~"]) {
    let inCode = false;
    start = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith(mark)) {
        if (!inCode) {
          inCode = true;
          start = i;
        } else {
          ranges.push([start, i]);
          inCode = false;
        }
      }
    }
    if (inCode) ranges.push([start, lines.length - 1]);
  }
  let i = 0;
  while (i < lines.length) {
    const t = lines[i].trim();
    if (t.startsWith("|") && t.endsWith("|") && t.length > 1) {
      const ts = i;
      while (i < lines.length && lines[i].trim().startsWith("|") && lines[i].trim().endsWith("|")) i++;
      ranges.push([ts, i - 1]);
    } else i++;
  }
  return ranges;
}

// ---------- 节/块切分（与 xl derive-bilingual.mjs 同构） ----------

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

// ---------- interleave 纯函数 ----------
//
// 整篇交错：origText（original-{title}.md 全文）× zhText（交付物去元信息头后的正文）。
// 返回 { text, totalSections, degraded }；degraded = [{ title, reason }]（B8 清单数据源）。

function interleave(origText, zhText) {
  // 结构分析前归一：CRLF→LF + 剥 BOM（评审②-3/②-4/②-9）
  const origLines = String(origText).replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").split("\n");
  const zhLines = String(zhText).replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").split("\n");
  const origH = fenceAwareHeadings(origLines);
  const zhH = fenceAwareHeadings(zhLines);

  // 整篇降级（B4）：标题数不等（顺序配对配不齐）
  if (origH.length !== zhH.length) {
    const reason = `标题数不等（原文 ${origH.length} / 译文 ${zhH.length}）`;
    return {
      text: [zhLines.join("\n"), `<!-- 双语对照·降级：${reason}，整篇节级对照 -->`, origLines.join("\n")].join("\n\n"),
      totalSections: 1,
      degraded: [{ title: "全文", reason }],
    };
  }

  const origSecs = sectionRanges(origLines, origH);
  const zhSecs = sectionRanges(zhLines, zhH);
  if (origSecs.length !== zhSecs.length) {
    const reason = `节切分不匹配（原文 ${origSecs.length} 节 / 译文 ${zhSecs.length} 节——标题前导内容单侧存在）`;
    return {
      text: [zhLines.join("\n"), `<!-- 双语对照·降级：${reason}，整篇节级对照 -->`, origLines.join("\n")].join("\n\n"),
      totalSections: 1,
      degraded: [{ title: "全文", reason }],
    };
  }

  const parts = [];
  const degraded = [];
  for (let i = 0; i < zhSecs.length; i++) {
    const zs = zhSecs[i];
    const os = origSecs[i]; // 顺序配对（标题数相等 ⇒ 两两平行）
    const zTitle = zs.heading ? zs.heading.title : "（标题前内容）";

    // 标题呈现（B6）：中文标题行 + 锚行保留；锚行仅当逐字 === 原文标题的 *…* 形态才保留
    // （评审②-1/②-10：else 分支必须推 bodyFrom 过标题行——fork 时遗漏导致常规无锚译文
    //  把标题行计入内容块，几乎全量伪降级或零警告错配；CJK 斜体/错锚行同理不吞），
    // 否则插合成 *English*——英文标题恰好一次
    const head = [];
    let bodyFrom = zs.s;
    if (zs.heading) {
      head.push(zhLines[zs.heading.lineIdx]);
      const next = zhLines[zs.heading.lineIdx + 1] || "";
      const synth = `*${os.heading.title}*`;
      if (next === synth) { head.push(next); bodyFrom = zs.heading.lineIdx + 2; }
      else { head.push(synth); bodyFrom = zs.heading.lineIdx + 1; }
    }

    // 节内块切分与配对（B5）
    const zhBody = zs.e >= bodyFrom ? splitBlocks(zhLines.slice(bodyFrom, zs.e + 1)) : [];
    const enFrom = os.heading ? os.heading.lineIdx + 1 : os.s;
    const enBody = os.e >= enFrom ? splitBlocks(origLines.slice(enFrom, os.e + 1)) : [];

    const countOk = zhBody.length === enBody.length;
    const codeOk = countOk && zhBody.every((b, k) => b.code === enBody[k].code && (!b.code || b.text === enBody[k].text));
    const zhUrls = urlSet(zhLines.slice(bodyFrom, zs.e + 1).join("\n"));
    const enUrls = urlSet(origLines.slice(enFrom, os.e + 1).join("\n"));
    const urlOk = zhUrls.size === enUrls.size && [...zhUrls].every((u) => enUrls.has(u));

    if (!countOk || !codeOk || !urlOk) {
      const reason = !countOk ? `块数不匹配（中 ${zhBody.length} / 英 ${enBody.length}）` : !codeOk ? "代码块指纹不符（isCode 不一致或代码块非逐字）" : "URL 集合不符";
      degraded.push({ title: zTitle, reason });
      parts.push([zhLines.slice(zs.s, zs.e + 1).join("\n"), `<!-- 双语对照·降级：「${zTitle}」——${reason}，该节节级对照 -->`, origLines.slice(os.s, os.e + 1).join("\n")].join("\n\n"));
      continue;
    }

    const sec = head.length ? [head.join("\n")] : [];
    for (let k = 0; k < zhBody.length; k++) sec.push(zhBody[k].text, enBody[k].text); // 中文在上英文在下
    parts.push(sec.join("\n\n"));
  }

  return { text: parts.join("\n\n"), totalSections: zhSecs.length, degraded };
}

// ---------- 主流程 ----------

// 交付物去元信息头：块以首个 `> **` 行区起、首个 `---` 行止（v3.0.0 头 = 引用块 + ---；
// 旧形态 H1 在头前亦兼容）。头边界前置条件：--- 前须有 > 引用行——正文里的 --- 分隔线
// 不作头边界（评审②-14：无头交付物的首个正文 --- 误切会把标题并进"头"）。
function stripMetaHeader(text) {
  const lines = text.split(/\r?\n/);
  const hrIdx = lines.findIndex((l) => /^---\s*$/.test(l));
  if (hrIdx === -1 || !lines.slice(0, hrIdx).some((l) => /^>/.test(l))) return { body: text, headerLines: null };
  return { body: lines.slice(hrIdx + 1).join("\n").replace(/^\n/, ""), headerLines: lines.slice(0, hrIdx + 1) };
}

function discoverTitle(dir) {
  const m = fs.readdirSync(dir).find((f) => /^original-(.+)\.md$/i.test(f));
  return m ? m.replace(/^original-(.+)\.md$/i, "$1") : null;
}

function runDerive(dir, opts = {}) {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    return { exitCode: 2, errors: [`目录不存在或非目录：${dir}`] };
  }
  const title = discoverTitle(dir);
  if (!title) {
    return { exitCode: 2, errors: ["目录中找不到 original-{title}.md，不是有效的 translation 目录"] };
  }
  const deliverableName = `translated-${title}-zh.md`;
  const deliverablePath = path.join(dir, deliverableName);
  const deliverableRaw = readNorm(deliverablePath);
  if (deliverableRaw == null) {
    return { exitCode: 3, errors: [`无交付物 ${deliverableName}——双语派生是交付后视图（先走完 Step 10/12）`] };
  }
  const deliverableSha = fileSha(deliverablePath);
  const warns = [];

  const { body: zhBody, headerLines } = stripMetaHeader(deliverableRaw);
  const r = interleave(readNorm(path.join(dir, `original-${title}.md`)) || "", zhBody);

  // 头部（B6）：交付物头照抄（至首个 --- 含）+ 引用块内追加双语版行（源交付物 sha——确定性字段）
  const bilingualLine = `> **双语版**：由源交付物与原文机械交错的只读派生视图（非交付物、不经终检、不受手修保护）——源交付物 sha1（前 12）：${deliverableSha}；重说「要双语对照」可幂等重生成`;
  let header;
  if (headerLines == null) {
    warns.push("交付物无元信息头（无 --- 行）——双语版头以最小形态生成");
    header = [bilingualLine, "", "---"].join("\n");
  } else {
    let lastQ = -1; // 头部引用块末行（> 开头的连续区——兼容头前有 H1 的旧形态）
    for (let i = 0; i < headerLines.length; i++) {
      if (/^>/.test(headerLines[i])) lastQ = i;
      else if (lastQ >= 0) break;
    }
    header = lastQ >= 0
      ? [...headerLines.slice(0, lastQ + 1), bilingualLine, ...headerLines.slice(lastQ + 1)].join("\n")
      : [bilingualLine, ...headerLines].join("\n");
  }

  // 尾注（B8）：降级清单 + 覆盖率（恒输出——零降级也留覆盖率锚，幂等可 grep）
  const aligned = r.totalSections - r.degraded.length;
  const pct = r.totalSections ? ((aligned / r.totalSections) * 100).toFixed(1) : "0.0";
  const tail = r.degraded.length
    ? `<!-- derive-bilingual：对齐覆盖率 ${aligned}/${r.totalSections} 节（${pct}%）｜降级 ${r.degraded.length} 节\n${r.degraded.map((d) => `- 「${d.title}」：${d.reason}`).join("\n")}\n-->`
    : `<!-- derive-bilingual：对齐覆盖率 ${aligned}/${r.totalSections} 节（${pct}%）｜降级 0 节 -->`;

  const output = `${header}\n\n${r.text}\n\n${tail}\n`;
  const outputPath = path.join(dir, `translated-${title}-bilingual.md`);
  fs.writeFileSync(outputPath, output, "utf-8"); // B1：唯一产物

  return {
    exitCode: 0,
    outputPath,
    bilingualSha: sha12(output),
    coverage: { aligned, total: r.totalSections, degraded: r.degraded.length, pct },
    degraded: r.degraded,
    warnings: warns,
    result: {
      passed: true,
      summary: `双语对照已生成：translated-${title}-bilingual.md（对齐覆盖率 ${aligned}/${r.totalSections} 节，${pct}%；降级 ${r.degraded.length} 节）`,
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

function printHelp() {
  console.log(`derive-bilingual.js — 双语对照派生视图（v3.0.0）

用法:
  node derive-bilingual.js <translation-dir> [--json]

规则（对齐 xl B1-B8，单文件形态）:
  - original-{title}.md × translated-{title}-zh.md 两文件整篇交错；中文在上英文在下
  - 节配对 = 标题顺序（fence 感知）；标题数不等 → 整篇降级对照
  - 块配对按序 + 双级指纹（代码块逐字 + isCode；URL 集合）；不符该节降级节级对照（宁降级不误导）
  - 只读纪律：唯一产物 translated-{title}-bilingual.md；幂等重跑字节相同
  - 触发：发起时说了要双语 → 交付后自动跑；交付后随时补说「要双语对照」重生成

退出码: 0 成功 / 1 用法 / 2 目录异常 / 3 输入损坏（缺原文或交付物）`);
}

function runCli(args) {
  const { pos, opts } = parseArgs(args);
  if (opts.help || pos.length < 1) {
    printHelp();
    process.exit(pos.length < 1 && !opts.help ? 1 : 0);
  }
  const r = runDerive(pos[0], opts);
  if (r.errors && r.errors.length) console.error(`❌ ${r.errors.join("\n  ")}`);
  if (r.result && r.result.summary) console.log(`✅ ${r.result.summary}`);
  for (const d of r.degraded || []) console.log(`  ⚠ 降级「${d.title}」：${d.reason}`);
  for (const w of r.warnings || []) console.log(`  ⚠ ${w}`);
  if (opts.json) console.log(JSON.stringify({ ...r, result: undefined, errors: r.errors || [] }, null, 2));
  process.exit(r.exitCode);
}

if (require.main === module) {
  runCli(process.argv.slice(2));
}

module.exports = { interleave, stripMetaHeader, runDerive, fenceAwareHeadings, protectedRanges, splitBlocks };
