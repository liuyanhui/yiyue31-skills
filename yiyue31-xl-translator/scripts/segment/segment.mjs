// segment.mjs — xl-translator 大文档分段（DESIGN §2 Step 1）
//
// fork 自 yiyue31-translator/scripts/doc_segmenter/（TS 工程），一次性移植改造为单文件 ESM，
// 绝不回写源（零共享纪律）。移植保留的源算法：行偏移解析、保护区识别（围栏/HTML 表/管道表）、
// 最优切点搜索（距目标最近的合法边界）。本版关键改造：
//
// 1. fence 感知：标题解析跳过代码围栏（``` 与 ~~~）。源版把围栏内的 `# 注释` 当标题——
//    干跑实测 30 个标题行 11 个在围栏内，正是 53 碎片事故的同源病灶。
// 2. 目标带 8-15KB（min+max 双边界）：源版只切不合、合并限同级且用 "\n\n" 拼接破坏字节保真；
//    本版 chunk = 原文的连续字符区间（零插入零改写），跨级别贪心装包落带。
// 3. R11-B（2026-08-31 裁决）：仅围栏/表格**原子块**可超限单 chunk（文件名 X 标记）；
//    散文巨块强制再切（段落边界 → 行边界 → 字符边界三级回退，散文永不超限）。
// 4. 分布自检闭环（附录 A #1）：落带率不达标 → 按 unitTarget 阶梯（15/12/10/8KB）自动调参
//    重分段，评分选最优（落带数 → chunk 数 → 切分数）。
// 5. 拼接 sha === 原文 sha 关卡：区间切片使拼接恒等于原文，关卡仍显式校验（钉死分母，防偷删）。
//
// 产物（落 --out 目录）：
//   chunks/chunk-<NN>-<slug>.md   常规 chunk；超限原子块用 chunk-<NN>X-<slug>.md
//   manifest.md                   heading 树 → chunk 映射 + chunk 表 + 分布自检记录
//   progress.json                 缓存非事实源（文件内明文注明），state 字段供 M1b status.mjs 续用
//
// CLI: node segment.mjs <original.md> --out <dir> [--min 8] [--max 15] [--json]
// 退出码: 0 = 成功；1 = 用法错；2 = 文件缺失或超 5MB；3 = 拼接 sha 不符（理论不可达，仍防）；
//         4 = 输出路径超长（Windows 260 上限，见 safeChunkPath）

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

// ---------- 常量 ----------

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB 上限（继承 fork 源 inspector）
const BAND = { min: 8, max: 15 }; // 目标带（KB）——审校半块甜点区的保证来源
// 分布自检阶梯：unitTarget = 触发小节再切的字节上界（KB）。
// 首档 = max：只切超限小节（最大保留小节完整性）；落带失败逐级细切。这是"自动调参重分段"的参数空间。
const UNIT_TARGET_LADDER = [15, 12, 10, 8];
const HEAD_RE = /^(#{1,6})\s+(.+)$/;

// ---------- 行索引 ----------

// 行偏移与字节前缀和：全部分析基于它；多次调参尝试复用，500KB 文档也只算一遍。
export function buildIndex(content) {
  const lines = content.split("\n");
  const lineStart = new Uint32Array(lines.length + 1); // lineStart[i] = 第 i 行起始字符偏移
  const cumBytes = new Float64Array(lines.length + 1); // cumBytes[i] = 第 i 行起始处累计 UTF-8 字节
  let pos = 0;
  let bytes = 0;
  for (let i = 0; i < lines.length; i++) {
    lineStart[i] = pos;
    cumBytes[i] = bytes;
    pos += lines[i].length + 1;
    bytes += Buffer.byteLength(lines[i], "utf-8") + 1;
  }
  lineStart[lines.length] = pos;
  cumBytes[lines.length] = bytes;
  return { content, lines, lineStart, cumBytes, totalBytes: bytes };
}

// 字符偏移 → 从文首起累计字节（二分定位行 + 行内切片计字节）
export function byteAt(index, ch) {
  const { lineStart, cumBytes, lines, content } = index;
  let lo = 0;
  let hi = lines.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (lineStart[mid] <= ch) lo = mid + 1;
    else hi = mid;
  }
  const line = Math.max(0, lo - 1);
  if (ch >= content.length) return index.totalBytes;
  return cumBytes[line] + Buffer.byteLength(content.slice(lineStart[line], ch), "utf-8");
}

export function lineAt(index, ch) {
  const { lineStart, lines } = index;
  let lo = 0;
  let hi = lines.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (lineStart[mid] <= ch) lo = mid + 1;
    else hi = mid;
  }
  return Math.max(0, lo - 1);
}

function bytesBetween(index, a, b) {
  return byteAt(index, b) - byteAt(index, a);
}

// ---------- fence 感知标题解析 ----------

// 围栏状态机：``` 与 ~~~ 各自配对（开闭同字符）；围栏内的 # 行不是标题。
// 不处理缩进 4 空格的缩进代码块与 setext 标题——目标文档（技术文档）罕用，误判代价高于收益。
export function fenceAwareHeadings(lines) {
  const headings = [];
  let fence = null; // null | "```" | "~~~"
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fm = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (fm) {
      const marker = fm[1][0] === "`" ? "```" : "~~~";
      if (fence === null) fence = marker;
      else if (fence === marker) fence = null;
      continue; // 围栏行本身不是标题
    }
    if (fence !== null) continue;
    const m = line.match(HEAD_RE);
    if (m) headings.push({ lineIdx: i, level: m[1].length, title: m[2].trim() });
  }
  return headings;
}

// ---------- 保护区识别（fork 源继承 + ~~~ 围栏） ----------

// 保护区 = 原子不可切的行区间：代码围栏（```/~~~）、HTML 表（<table>..</table>）、管道表（连续 | 行）。
export function protectedRanges(lines) {
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
    if (inCode) ranges.push([start, lines.length - 1]); // 未闭合围栏：保守保护到文末
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

function makeProtMask(lines, ranges) {
  const mask = new Uint8Array(lines.length);
  for (const [s, e] of ranges) for (let i = s; i <= e && i < lines.length; i++) mask[i] = 1;
  return mask;
}

// ---------- 小节解析（fence 感知） ----------

// 小节 = 标题行起到下一标题行前的连续区间（含标题行）；首标题前的内容为 preamble（level 0）。
// 区间用字符偏移表达，内容 = 原文切片——拼接恒等于原文（sha 关卡的结构性保证）。
export function parseSections(content, index) {
  const { lineStart } = index;
  const headings = fenceAwareHeadings(index.lines);
  const sections = [];
  if (headings.length === 0) {
    return [{ level: 0, title: "root", startChar: 0, endChar: content.length }];
  }
  if (headings[0].lineIdx > 0) {
    sections.push({ level: 0, title: "preamble", startChar: 0, endChar: lineStart[headings[0].lineIdx] });
  }
  headings.forEach((h, idx) => {
    const startChar = lineStart[h.lineIdx];
    const endChar = idx + 1 < headings.length ? lineStart[headings[idx + 1].lineIdx] : content.length;
    sections.push({ level: h.level, title: h.title, startChar, endChar });
  });
  return sections;
}

// ---------- 区间 → 单元（R11-B 切分） ----------

// 把 [startChar, endChar) 切成单元序列：保护区整块一个单元（> maxBytes → 原子 X），
// 散文段按段界/行界/字符界切到 ≤ maxBytes（R11-B：散文永不超限）。
// 单元携带所属小节标题——再切分段自身无标题，命名时继承小节，避免落到误导性的 preamble。
export function splitRange(index, protMask, startChar, endChar, maxBytes, targetBytes, ops, title) {
  const { lines, lineStart } = index;
  const units = [];
  // 先切成 保护区/散文 交替的行段
  const fromLine = lineAt(index, startChar);
  const toLine = lineAt(index, Math.max(startChar, endChar - 1));
  const runs = []; // {prot, fromLine, toLine}
  for (let i = fromLine; i <= toLine; i++) {
    const p = protMask[i] === 1;
    const last = runs[runs.length - 1];
    if (last && last.prot === p) last.toLine = i;
    else runs.push({ prot: p, fromLine: i, toLine: i });
  }
  for (const r of runs) {
    const a = Math.max(startChar, lineStart[r.fromLine]);
    const b = Math.min(endChar, r.toLine + 1 <= lines.length ? lineStart[r.toLine + 1] : endChar);
    if (b <= a) continue;
    if (r.prot) {
      const size = bytesBetween(index, a, b);
      const atomic = size > maxBytes;
      units.push({ startChar: a, endChar: b, atomic, title });
      if (atomic) {
        ops.push({ op: "atomic", detail: `保护区整体 ${(size / 1024).toFixed(1)}KB 超上限 ${(maxBytes / 1024).toFixed(0)}KB，作超限原子单元（X 标记，R11-B）` });
      }
    } else {
      units.push(...splitProse(index, a, b, maxBytes, targetBytes, ops, title));
    }
  }
  return units;
}

// 散文区间切分：优先段界（空行后行首）与子标题行首，距 targetBytes 最近且 ≤ maxBytes；
// 无段界可用降级到任意行界；单行巨段最后手段按字节字符切（记录，请人工复核）。
export function splitProse(index, startChar, endChar, maxBytes, targetBytes, ops, title) {
  // 早退对 targetBytes：unitTarget 阶梯的意义就是细切"未超限但大于目标"的小节；
  // 若对 maxBytes 早退，8-15KB 之间的小节任何档位都不会被切，阶梯空转（尾块永远救不回）。
  if (bytesBetween(index, startChar, endChar) <= targetBytes) {
    return [{ startChar, endChar, atomic: false, title }];
  }
  const { lines, lineStart } = index;
  const units = [];
  let from = startChar;
  let guard = 0;
  while (from < endChar) {
    if (guard++ > 100000) break; // 病理保护
    // 剩余 ≤ target 整块收（对 target 判——对 max 判会让"≤max 但>target"的小节逃过细切，阶梯空转）
    if (bytesBetween(index, from, endChar) <= targetBytes) {
      units.push({ startChar: from, endChar, atomic: false, title });
      break;
    }
    const fromLine = lineAt(index, from);
    // 收集候选切点（行首字符偏移 + 起算字节数，增量累计避免重复扫描）
    const para = []; // 段界/子标题
    const any = []; // 任意行界
    let run = 0;
    for (let i = fromLine + 1; i < lines.length; i++) {
      if (lineStart[i] >= endChar) break;
      run += Buffer.byteLength(lines[i - 1], "utf-8") + 1;
      if (run > maxBytes) break; // 再远的候选必超限
      const ch = lineStart[i];
      any.push({ ch, bytes: run });
      const prevBlank = lines[i - 1].trim() === "";
      const isHeading = HEAD_RE.test(lines[i]);
      if (prevBlank || isHeading) para.push({ ch, bytes: run });
    }
    const pool = para.length > 0 ? para : any;
    if (pool.length > 0) {
      if (para.length === 0) ops.push({ op: "line-cut", detail: "无段界可用（无空行长散文），按行边界切分" });
      pool.sort((x, y) => Math.abs(x.bytes - targetBytes) - Math.abs(y.bytes - targetBytes));
      const cut = pool[0];
      units.push({ startChar: from, endChar: cut.ch, atomic: false, title });
      from = cut.ch;
      continue;
    }
    // 单行巨段：字符边界（最后手段，破坏段落结构与可能的行内标记）
    let acc = 0;
    let cutCh = from;
    for (let ch = from; ch < endChar; ch++) {
      acc += Buffer.byteLength(index.content[ch], "utf-8");
      if (acc >= maxBytes) {
        cutCh = ch + 1;
        break;
      }
      cutCh = ch + 1;
    }
    units.push({ startChar: from, endChar: Math.min(cutCh, endChar), atomic: false, title });
    ops.push({ op: "char-cut", detail: "单行巨段按字符边界切分（破坏段落结构，请人工复核该 chunk）" });
    from = Math.min(cutCh, endChar);
  }
  return units;
}

// ---------- 装包落带 ----------

// 贪心装包 + 尾块回收。装箱目标 targetBytes（= unitTarget，阶梯参数）：
// 当前包 < target 且加入后 ≤ max 才继续装——只按 max 封包会把细切出的单元重新并回去，阶梯调参失效。
// 末块 < min 且并入前包不超 max → 并入。跨级别合并：不区分小节层级（manifest 记 heading 树）。
// 原子单元（X）永不与邻块合并——超限本身即其形态。
export function packChunks(units, index, minKB, maxKB, targetKB) {
  const minBytes = minKB * 1024;
  const maxBytes = maxKB * 1024;
  const targetBytes = (targetKB ?? maxKB) * 1024;
  const sized = units.map((u) => ({ ...u, bytes: bytesBetween(index, u.startChar, u.endChar) }));
  const chunks = [];
  let cur = null;
  const flush = () => {
    if (cur) chunks.push(cur);
    cur = null;
  };
  for (const u of sized) {
    if (u.atomic) {
      flush();
      chunks.push({ startChar: u.startChar, endChar: u.endChar, atomic: true, bytes: u.bytes, unitCount: 1, title: u.title });
      continue;
    }
    if (cur && cur.bytes < targetBytes && cur.bytes + u.bytes <= maxBytes) {
      cur.endChar = u.endChar;
      cur.bytes += u.bytes;
      cur.unitCount++;
    } else {
      flush();
      cur = { startChar: u.startChar, endChar: u.endChar, atomic: false, bytes: u.bytes, unitCount: 1, title: u.title };
    }
  }
  flush();
  if (chunks.length >= 2) {
    const last = chunks[chunks.length - 1];
    const prev = chunks[chunks.length - 2];
    if (!last.atomic && !prev.atomic && last.bytes < minBytes && prev.bytes + last.bytes <= maxBytes) {
      prev.endChar = last.endChar;
      prev.bytes += last.bytes;
      prev.unitCount += last.unitCount;
      chunks.pop();
    }
  }
  return chunks;
}

// ---------- 分布自检闭环（附录 A #1） ----------

// 阶梯调参重分段，评分选最优：落带 chunk 数 → chunk 数少 → 切分单元少。
// 为什么允许细切未超限小节：落带纪律（审校甜点区）优先于小节完整性——阶梯只在落带失败时逐级升级，
// 首档（=max）仍最大保留小节完整。
export function segment(content, opts = {}) {
  const minKB = opts.minKB ?? BAND.min;
  const maxKB = opts.maxKB ?? BAND.max;
  const maxBytes = maxKB * 1024;
  const index = buildIndex(content);
  const protMask = makeProtMask(index.lines, protectedRanges(index.lines));
  const sections = parseSections(content, index);
  const headings = fenceAwareHeadings(index.lines);

  // 单 chunk 文档：总长 ≤ max 直接一整块（带检豁免——短文档单 chunk 是正确形态）
  if (index.totalBytes <= maxBytes) {
    return {
      chunks: [{ startChar: 0, endChar: content.length, atomic: false, bytes: index.totalBytes, unitCount: 1 }],
      attempts: [{ unitTarget: maxKB, inBand: 1, total: 1, note: "单 chunk 文档（总长 ≤ max），带检豁免" }],
      chosen: maxKB,
      ops: [],
      index,
      sections,
      headings,
      minKB,
      maxKB,
    };
  }

  const ladder = opts.ladder ?? UNIT_TARGET_LADDER;
  const attempts = [];
  let best = null;
  for (const unitTarget of ladder) {
    const ops = [];
    const units = [];
    for (const sec of sections) {
      if (sec.endChar <= sec.startChar) continue;
      const secBytes = bytesBetween(index, sec.startChar, sec.endChar);
      if (secBytes <= unitTarget * 1024) {
        units.push({ startChar: sec.startChar, endChar: sec.endChar, atomic: false, title: sec.title });
      } else {
        units.push(...splitRange(index, protMask, sec.startChar, sec.endChar, maxBytes, unitTarget * 1024, ops, sec.title));
      }
    }
    const chunks = packChunks(units, index, minKB, maxKB, unitTarget);
    const scoreable = chunks.filter((c) => !c.atomic);
    const minBytes = minKB * 1024;
    const inBand = scoreable.filter((c) => c.bytes >= minBytes && c.bytes <= maxBytes).length;
    attempts.push({ unitTarget, inBand, total: scoreable.length, note: `落带 ${inBand}/${scoreable.length}` });
    const cand = { chunks, inBand, total: scoreable.length, unitCount: units.length, unitTarget, ops };
    if (
      best === null ||
      cand.inBand > best.inBand ||
      (cand.inBand === best.inBand && cand.chunks.length < best.chunks.length) ||
      (cand.inBand === best.inBand && cand.chunks.length === best.chunks.length && cand.unitCount < best.unitCount)
    ) {
      best = cand;
    }
    if (cand.inBand === cand.total) break; // 全落带，无需继续调参
  }

  return {
    chunks: best.chunks,
    attempts,
    chosen: best.unitTarget,
    ops: best.ops,
    index,
    sections,
    headings,
    minKB,
    maxKB,
  };
}

// ---------- 命名（DESIGN §5.1：slug = 首 heading 前 3-4 词、连字符、≤30 字符） ----------

export function makeSlug(title) {
  const words = String(title)
    .trim()
    .split(/\s+/)
    .slice(0, 4)
    .join("-");
  let s = words
    .replace(/[/\\:*?"<>|]/g, "-")
    .replace(/[^A-Za-z0-9-]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  if (s.length > 30) {
    s = s.slice(0, 30);
    const cut = s.lastIndexOf("-");
    if (cut > 10) s = s.slice(0, cut); // 不截断词中
  }
  return s || "part";
}

function firstHeadingIn(chunk, headings, index) {
  for (const h of headings) {
    const ch = index.lineStart[h.lineIdx];
    if (ch >= chunk.startChar && ch < chunk.endChar) return h;
  }
  return null;
}

function chunkFileName(nn, chunk, headings, index) {
  // 命名源优先级：chunk 内首个真标题 > 所属小节标题（再切分段继承）> preamble
  const h = firstHeadingIn(chunk, headings, index);
  const slug = makeSlug(h ? h.title : chunk.title || "preamble");
  return `chunk-${String(nn).padStart(2, "0")}${chunk.atomic ? "X" : ""}-${slug}.md`;
}

// ---------- 路径超长防护 ----------

// Windows 路径上限 260（实用 259），不能假设系统开了长路径开关。阈值 240 给下游改名留余量
// （translated-chunk-NN.md / review-<dim>-chunk-NN<h>.md 与 chunk 文件同目录深度、长度相当）。
// 超限先缩 slug——slug 是装饰性的，唯一性由 <NN> 保证；目录本身超限无 slug 可缩，只能报错换短路径。
const MAX_PATH = 240;

// 返回 { filePath, fileName, shrunk }；无法缩到限内时抛错（含可操作建议）。
export function safeChunkPath(outDir, fileName, maxPath = MAX_PATH) {
  const dir = path.resolve(outDir, "chunks");
  let name = fileName;
  let abs = path.join(dir, name);
  let shrunk = false;
  while (abs.length > maxPath) {
    const m = name.match(/^(chunk-\d+X?-)([a-z0-9-]*)(\.md)$/);
    if (!m) break; // 非 chunk 命名（不应发生）——直接进入下方报错
    let slug = m[2];
    if (slug.includes("-")) slug = slug.slice(0, slug.lastIndexOf("-"));
    else if (slug.length > 0) slug = slug.slice(0, -1);
    else break; // slug 已空仍超限 → 目录问题
    name = m[1] + slug + m[3];
    abs = path.join(dir, name);
    shrunk = true;
  }
  if (abs.length > maxPath) {
    throw new Error(`输出路径超长（${abs.length} > ${maxPath} 字符）：${abs} —— 请缩短 --out 路径或 <title> 后重跑`);
  }
  return { filePath: abs, fileName: name, shrunk };
}

// 固定名产物（manifest.md/progress.json）：无 slug 可缩，目录超限直接报错。
function fixedPath(outDir, rel) {
  const abs = path.resolve(outDir, rel);
  if (abs.length > MAX_PATH) {
    throw new Error(`输出路径超长（${abs.length} > ${MAX_PATH} 字符）：${abs} —— 请缩短 --out 路径或 <title> 后重跑`);
  }
  return abs;
}

// ---------- 产物落盘 ----------

export function writeOutputs(result, outDir) {
  const { index, content, headings } = result;
  fs.mkdirSync(path.join(outDir, "chunks"), { recursive: true });
  const rows = [];
  result.chunks.forEach((c, i) => {
    const nn = i + 1;
    const name = chunkFileName(nn, c, headings, index);
    const body = content.slice(c.startChar, c.endChar);
    const sha = crypto.createHash("sha1").update(body, "utf-8").digest("hex").slice(0, 12);
    const placed = safeChunkPath(outDir, name);
    if (placed.shrunk) {
      result.ops.push({ op: "short-name", detail: `路径超长防护：${name} → ${placed.fileName}（slug 缩短，唯一性由 NN 保证）` });
    }
    fs.writeFileSync(placed.filePath, body, "utf-8");
    rows.push({
      nn,
      name: placed.fileName,
      bytes: c.bytes,
      sha,
      atomic: c.atomic,
      fromLine: lineAt(index, c.startChar) + 1,
      toLine: lineAt(index, Math.max(c.startChar, c.endChar - 1)) + 1,
      body,
    });
  });

  // manifest.md：元信息 + heading 树 → chunk 映射 + chunk 表 + 自检记录
  const chunkContaining = (char) => result.chunks.findIndex((c) => char >= c.startChar && char < c.endChar);
  const L = [];
  L.push("# 分段清单（manifest）");
  L.push("");
  L.push(`- 原文：${result.sourceFile ?? ""}　sha1（前 12）：${result.sourceSha ?? ""}　${(index.totalBytes / 1024).toFixed(1)}KB　${index.lines.length} 行`);
  L.push(`- 目标带：${result.minKB}-${result.maxKB}KB　chunk 数：${rows.length}（原子超限 X：${rows.filter((r) => r.atomic).length}）`);
  L.push(`- 分布自检：${result.attempts.map((a) => `unitTarget=${a.unitTarget}KB→${a.note}`).join("；")}；选中 unitTarget=${result.chosen}KB`);
  L.push("");
  L.push("## Heading 树 → chunk 映射");
  L.push("");
  if (headings.length === 0) L.push("- （无标题：单 root 区间）");
  for (const h of headings) {
    const ci = chunkContaining(index.lineStart[h.lineIdx]);
    const r = rows[ci < 0 ? rows.length - 1 : ci];
    const indent = "  ".repeat(Math.max(0, h.level - 1));
    L.push(`${indent}- [${String(r.nn).padStart(2, "0")}${r.atomic ? "X" : ""}] ${"#".repeat(h.level)} ${h.title}`);
  }
  L.push("");
  L.push("## Chunk 表");
  L.push("");
  L.push("| NN | 文件 | KB | 行 | sha1 |");
  L.push("|----|------|----|----|------|");
  for (const r of rows) {
    L.push(`| ${String(r.nn).padStart(2, "0")}${r.atomic ? "X" : ""} | ${r.name} | ${(r.bytes / 1024).toFixed(1)} | ${r.fromLine}-${r.toLine} | ${r.sha} |`);
  }
  fs.writeFileSync(fixedPath(outDir, "manifest.md"), L.join("\n") + "\n", "utf-8");

  // progress.json：缓存非事实源，明文注明（M1b status.mjs 以扫描文件系统为准）
  const progress = {
    _note: "缓存非事实源：进度事实以 status.mjs 扫描 chunks/、translated-chunks/、reviews/ 为准；本文件仅加速 resume，损坏/缺失可安全重建",
    source_file: result.sourceFile ?? null,
    source_sha1: result.sourceSha ?? null,
    source_size_kb: Math.round((index.totalBytes / 1024) * 100) / 100,
    band_kb: [result.minKB, result.maxKB],
    total_chunks: rows.length,
    chunks: rows.map((r) => ({
      index: r.nn,
      filename: r.name,
      sha1: r.sha,
      size_kb: Math.round((r.bytes / 1024) * 100) / 100,
      atomic: r.atomic,
      state: "pending",
    })),
  };
  fs.writeFileSync(fixedPath(outDir, "progress.json"), JSON.stringify(progress, null, 2), "utf-8");
  return { rows, progress };
}

// ---------- 关卡 + 入口 ----------

// 拼接 sha === 原文 sha：区间切片下结构性成立，仍显式校验并作为硬关卡（钉死分母，防任何路径偷删）。
export function run(filePath, outDir, opts = {}) {
  if (!fs.existsSync(filePath)) {
    console.error(`❌ 文件不存在：${filePath}`);
    return { exitCode: 2 };
  }
  const raw = fs.readFileSync(filePath);
  if (raw.length > MAX_FILE_BYTES) {
    console.error(`❌ 文件超 5MB 上限（${raw.length} 字节）`);
    return { exitCode: 2 };
  }
  const content = raw.toString("utf-8").replace(/\r\n?/g, "\n"); // 行尾归一（Windows 源常见）
  const result = segment(content, opts);
  result.sourceFile = path.resolve(filePath);
  result.sourceSha = crypto.createHash("sha1").update(content, "utf-8").digest("hex").slice(0, 12);
  result.content = content;

  const joined = result.chunks.map((c) => content.slice(c.startChar, c.endChar)).join("");
  const shaOk =
    crypto.createHash("sha1").update(joined, "utf-8").digest("hex") === crypto.createHash("sha1").update(content, "utf-8").digest("hex");
  if (!shaOk) {
    console.error(`❌ 拼接 sha !== 原文 sha（分母被改动；区间切片下理论不可达，属实现 bug）`);
    return { exitCode: 3, result };
  }

  let written;
  try {
    written = writeOutputs(result, outDir);
  } catch (e) {
    // 路径超长等落盘错误：退出码 4，信息含可操作建议
    console.error(`❌ ${e.message}`);
    return { exitCode: 4, result };
  }
  const { rows } = written;
  if (!opts.quiet) {
    const scoreable = rows.filter((r) => !r.atomic);
    const inBand = scoreable.filter((r) => r.bytes >= result.minKB * 1024 && r.bytes <= result.maxKB * 1024).length;
    console.log(
      `✅ 分段完成：${rows.length} chunk（X 原子超限 ${rows.filter((r) => r.atomic).length}），落带 ${inBand}/${scoreable.length}，选中 unitTarget=${result.chosen}KB`
    );
    for (const a of result.attempts) console.log(`   自检 unitTarget=${a.unitTarget}KB → ${a.note}`);
    for (const op of result.ops.slice(0, 10)) console.log(`   ⚙ [${op.op}] ${op.detail}`);
    if (result.ops.length > 10) console.log(`   ⚙ …另有 ${result.ops.length - 10} 条操作记录`);
    console.log(`   产物：${path.join(outDir, "chunks")} + manifest.md + progress.json（缓存非事实源）`);
  }
  return { exitCode: 0, result, rows };
}

// ---------- CLI ----------

function parseArgs(argv) {
  const pos = [];
  const opts = { out: null, min: null, max: null, json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--out") opts.out = argv[++i];
    else if (a === "--min") opts.min = parseFloat(argv[++i]);
    else if (a === "--max") opts.max = parseFloat(argv[++i]);
    else if (a === "--json") opts.json = true;
    else if (a === "-h" || a === "--help") opts.help = true;
    else pos.push(a);
  }
  return { pos, opts };
}

const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const { pos, opts } = parseArgs(process.argv.slice(2));
  if (opts.help || pos.length < 1 || !opts.out) {
    console.log(`segment.mjs — xl-translator 大文档分段（DESIGN §2 Step 1）

用法:
  node segment.mjs <original.md> --out <dir> [--min 8] [--max 15] [--json]

规则:
  - 目标带 8-15KB；跨级别合并落带；分布自检自动调参重分段（15/12/10/8KB 阶梯）
  - fence 感知：围栏内 # 行不是标题
  - 代码围栏/HTML 表/管道表原子不可切；仅原子块可超限单 chunk（X 标记，R11-B）
  - 散文巨块强制再切（段界→行界→字符界三级回退），永不超限
  - 关卡：拼接 sha === 原文 sha

产物: <out>/chunks/chunk-<NN>[-X]-<slug>.md + manifest.md + progress.json（缓存非事实源）
路径防护: 产物路径 >240 字符自动缩 slug；目录本身超限退出码 4
退出码: 0 成功 / 1 用法 / 2 文件问题 / 3 sha 关卡失败 / 4 路径超长`);
    process.exit(pos.length < 1 || !opts.out ? 1 : 0);
  }
  const r = run(pos[0], opts.out, { minKB: opts.min, maxKB: opts.max });
  if (opts.json && r.result) {
    console.log(
      JSON.stringify(
        {
          exitCode: r.exitCode,
          chunks: (r.rows ?? []).map((x) => ({ name: x.name, kb: Math.round(x.bytes / 10.24) / 100, atomic: x.atomic, sha: x.sha })),
          attempts: r.result.attempts,
          chosen: r.result.chosen,
        },
        null,
        2
      )
    );
  }
  process.exit(r.exitCode);
}
