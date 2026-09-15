// final-gate.mjs — xl-translator Step 10 终检与交付（交付门，流程真正的最后一个动作）
//
// 零信任纪律：**重执行一切确定性检查，不信任何落盘日志**（verify-results.json 是流水缓存、
// 报告头部 sha 是自述——全部重算）。硬判锚 = 内容 sha + 重执行结果；mtime 只作 WARN。
//
// 检查面（DESIGN §2 Step 10；HANDOFF M1c）：
//   1. 分母复核（global）：chunks/ 按 NN 数值序拼接 sha === original 文件 sha；manifest 钉死
//   2. 机械校验全项重跑（scoped/chunk）：verify() 同源重跑每 chunk（keep-list + brief clamp +
//      R8-c 投影同参——投影从 glossary × chunk 原文**重推导**（handoff.mjs 纯函数），不信任
//      落盘 projection-chunk 文件：防"删投影灭判"；落盘件与重推导不一致仅 WARN，以重推导为准）
//   3. merged 重导出 diff（global）：assemble(全部译文)（merge.mjs 纯函数）vs merged-draft.md 字节比较
//   4. 完备性矩阵（分母 = 原文钉死；scoped/chunk）：裁定台账 + 4 维 × 2 半块报告全存在且
//      头部 sha fresh；**准确性维度缺失 = 无条件 FAIL（不可降级）**
//   5. 报告签名扫描：undersize（阈值缩放公式 M1c 具体化：base 240B × unitKB/4，绝对下限 120B）
//      + 跨报告同内容模板签名
//   6. G3 括注对账（scoped/chunk）：译文括注集合 === 台账"保留" ∪ R23 必兑现集（双向相等，
//      空集对非空台账即 FAIL）；R23 精选表兑现：chunk 原文含左值 → 译文须以 中文（English）括注形态
//   7. 标题双语锚（global）：分母 = 原文 fence 感知标题扫描（segment.mjs 同款状态机）；
//      逐标题核对中文标题行 + 次行锚 `*English*` 逐字相等 + 级别序列一致；brief 关闭时随披露跳过
//   8. G4 结构化核验（global）：冷读台账覆盖矩阵 = 全稿（逐 chunk sha）；pm-review 选样全覆盖
//      且逐样本有实质结论、五质量维度无 SKIPPED；R15：pm-review 头部 merged-sha 锚不豁免
//   9. 探针命中（global；缺 truth = FAIL）：每维度每 run ≥1；探针单元缺报告 = 直接 FAIL；
//      报告须实际命中 expectedHit（比对源侧 truth）
//  10. 新鲜度（WARN only）：产物 mtime 晚于 merged-draft → WARN；豁免 glob 不计（见 EXEMPT）
//
// 判定：PASS → 原子改名 translated-<title>-zh.md + REPORT 定稿（交付物 sha 内容锚——R18-⑥）+
//   交付摘要内联回显原文 sha1 + chunk 数（G1 分母外锚对照端）。FAIL → 故障半径分级（干跑 C-7）：
//   scoped（单 chunk 报告 stale/签名/verify FAIL → 该 chunk 回退 Step 6/7）/ global（拼接 sha/
//   完备性全局缺/探针未命中 → 全局阶段作废重走）；连续 FAIL ≥3 转 PENDING-USER（不无限空转）。
//   已存在不一致交付物时拒绝覆盖（R18-⑥ 手修永不覆盖，转人工裁决）。
//
// 结构化解析契约（M1c 冻结，M2 各 prompt 对齐）：
//   裁定台账行  `- «english» → 保留|删除`（→ 与 -> 均认）
//   精选表      `<英文原句> :: <既定中文>`（# 注释/空行忽略——R23 M1b 冻结）
//   冷读覆盖行  `- chunk <NN>: sha <12hex>`（发现数人读，机械只对覆盖+sha）
//   pm-review   头部 `merged-sha: <12hex>`（R15）+ 选样行 `- chunk <NN>: <实质结论>`
//   brief 开关  `标题双语锚: off|false|关|关闭`（缺省开——全有或全无，非译者裁量）
//
// CLI: node final-gate.mjs <workdir> [--probe-truth <file>] [--json]
// 退出码（沿用 verify-mech 非零分类）: 0 PASS / 1 用法 / 2 工作目录异常 /
//   3 FAIL（全部失败项可归因单 chunk 集）/ 4 FAIL（含全局性根因）

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { scanWorkdir, halfSlices, appendEvents, chapterMap } from "./status.mjs";
import { fenceAwareHeadings } from "./segment/segment.mjs";
import { verify, loadKeepList, loadBrief, fenceAwareAnnotationMatches } from "./verify-mech.mjs";
import { assemble } from "./merge.mjs";
import { parseGlossary, projectionFor, renderProjection } from "./handoff.mjs";

const DIMS = ["accuracy", "translationese", "ai-tone", "readability"];
const PM_QUALITY_DIMS = [
  { dim: "accuracy", re: /准确性|accuracy/i, cn: "准确性" },
  { dim: "translationese", re: /翻译腔|translationese/i, cn: "翻译腔" },
  { dim: "ai-tone", re: /AI\s*味|ai-tone/i, cn: "AI 味" },
  { dim: "readability", re: /可读性|readability/i, cn: "可读性" },
  { dim: "cold-read", re: /冷读|cold[- ]read/i, cn: "冷读" },
];
// 签名/undersize 阈值缩放公式（§5.1 C-9 M1c 具体化）：base 240B × unitKB / 4，绝对下限 120B
const SIGNATURE_BASE = 240;
const SIGNATURE_FLOOR = 120;
// 新鲜度豁免 glob（DESIGN §2 Step 10）：整目录/文件不计 mtime，且非终检查账对象
const EXEMPT_GLOBS = [
  /^status\.md$/,
  /^verify-results\.json$/,
  /^staging\//,
  /^pm-review-/,
  /^REPORT\.md$/,
  /^events\.jsonl$/,
  /^pending\.md$/,
];

const sha12 = (s) => crypto.createHash("sha1").update(s, "utf-8").digest("hex").slice(0, 12);
const fileSha = (p) => sha12(fs.readFileSync(p, "utf-8"));
const nn2 = (n) => String(n).padStart(2, "0");

function safeRead(p) {
  try {
    return fs.readFileSync(p, "utf-8");
  } catch {
    return null;
  }
}

// ---------- 结构化解析（M1c 冻结契约，见文件头注） ----------

export function parseLedger(text) {
  const keep = new Set();
  const drop = new Set();
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^-\s*«(.+?)»\s*(?:→|->)\s*(保留|删除)/);
    if (m) (m[2] === "保留" ? keep : drop).add(m[1].trim());
  }
  return { keep, drop };
}

export function parseSpecialPhrases(text) {
  const out = [];
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("::");
    if (i > 0) out.push({ en: t.slice(0, i).trim(), zh: t.slice(i + 2).trim() });
  }
  return out;
}

export function parseColdRead(text) {
  const cov = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^-\s*chunk\s+(\d+)\s*[:：]\s*sha[:：]?\s*([0-9a-f]{12})/i);
    if (m) cov[Number(m[1])] = m[2];
  }
  return cov;
}

export function parsePmReview(text) {
  const lines = text.split(/\r?\n/);
  const head = lines.slice(0, 15).find((l) => /^\s*merged-sha[:：]\s*[0-9a-f]{12}/i.test(l));
  const mergedSha = head ? head.match(/([0-9a-f]{12})/i)[1].toLowerCase() : null;
  const samples = {};
  for (const line of lines) {
    const m = line.match(/^-\s*chunk\s+(\d+)\s*[:：]\s*(.+)$/);
    if (m) samples[Number(m[1])] = m[2].trim();
  }
  return { mergedSha, samples, lines };
}

// brief 关闭标题双语锚（缺省开——2026-08-31 裁决：全有或全无）
export function anchorOff(briefText) {
  if (!briefText) return false;
  return /^标题双语锚\s*[:：]\s*(off|false|关|关闭)\s*$/im.test(briefText);
}

// ---------- 交付物元信息头（§7-0 裁决 B：PASS 改名时前置；字段 = delivery-template.md 第二节） ----------
// 块置于全文最前（frontmatter 位），其后 `---` 分隔——不插 H1（标题 H1 由 chunk 01 译文自带，
// 前插块不得插在 H1 与其锚行之间，否则标题双语锚硬判破坏）。merged-draft 本体仍纯拼接（M5 确定性不变）。

export function renderMetaHeader({ originalText, briefText, mergedText }) {
  const origTitle = originalText?.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? "";
  const grab = (re) => briefText?.match(re)?.[1]?.trim() ?? "";
  const style = grab(/^风格\s*[:：]\s*(意译|直译)\s*$/m) || "意译";
  const author = grab(/^作者\s*[:：]\s*(.+)$/m);
  const source = grab(/^来源\s*[:：]\s*(.+)$/m);
  const date = new Date().toISOString().slice(0, 10);
  const cjk = (mergedText?.match(/[一-鿿]/g) ?? []).length;
  return [
    `> **原文**：${origTitle}`,
    `> **作者**：${author}`,
    `> **来源**：${source}`,
    `> **翻译日期**：${date}`,
    `> **风格**：${style}`,
    `> **字数**：${cjk}（汉字）`,
    "",
    "---",
    "",
    "",
  ].join("\n");
}

// 交付物去头（幂等重入比对用）：块以 `> **原文**：` 起、首个 `---` 行止，其后为纯拼接正文
export function stripMetaHeader(text) {
  if (!text?.startsWith("> **原文**：")) return text;
  const idx = text.split(/\r?\n/).findIndex((l) => /^---\s*$/.test(l));
  return idx === -1 ? text : text.split(/\r?\n/).slice(idx + 1).join("\n").replace(/^\n/, "");
}

// pm-review 必备选样集（Step 9"脚本化分层选样 ≥20%"的同规则重推导——零信任：
// 不信任何落盘清单，终检自己算）：每 5 个 chunk 必抽 + 升级 chunk 及其 N+1 接缝必抽；
// 空则兜底抽末 chunk（小文档 ≥1 样本）
export function requiredSamples(totalN, events) {
  const req = new Set();
  for (let nn = 5; nn <= totalN; nn += 5) req.add(nn);
  for (const e of events) {
    if (e.ev === "escalate" && e.nn) {
      req.add(e.nn);
      if (e.nn + 1 <= totalN) req.add(e.nn + 1);
    }
  }
  if (!req.size && totalN > 0) req.add(totalN);
  return req;
}

// ---------- 标题双语锚（segment.mjs 同款 fence 感知状态机做分母） ----------

export function headingAnchorCheck(originalText, translatedText) {
  const fails = [];
  const origH = fenceAwareHeadings(originalText.split("\n"));
  const transLines = translatedText.split("\n");
  const transH = fenceAwareHeadings(transLines);
  if (origH.length !== transH.length) {
    fails.push(`标题数不一致：原文 ${origH.length} vs 译文 ${transH.length}（锚行本身即标题奇偶校验）`);
    return fails;
  }
  const n = Math.min(origH.length, transH.length);
  for (let i = 0; i < n; i++) {
    if (origH[i].level !== transH[i].level) {
      fails.push(`第 ${i + 1} 个标题级别不一致：原文 H${origH[i].level} vs 译文 H${transH[i].level}`);
      continue;
    }
    const zh = transH[i].title;
    // 文件名标题豁免（2026-09-11 M3 实证）：keep-list 文件名作标题（如 `### CLAUDE.md`，源 "The CLAUDE.md"）
    // 合法无 CJK——"非中文标题"判的意图是抓未翻译标题，文件名标题本就无译。形 = 含点扩展名的 ASCII 串。
    const filenameHeading = !/[一-鿿]/.test(zh) && /^[\w .\/:@-]+\.[A-Za-z]{2,4}$/.test(zh.trim());
    if (!filenameHeading && (zh === origH[i].title || !/[一-鿿]/.test(zh))) {
      fails.push(`第 ${i + 1} 个标题非中文标题行：${zh}`);
      continue;
    }
    const next = transLines[transH[i].lineIdx + 1] ?? "";
    if (next !== `*${origH[i].title}*`) {
      fails.push(`第 ${i + 1} 个标题次行锚不逐字相等：期望 *${origH[i].title}*，实得 ${next === "" ? "（无次行）" : next}`);
    }
  }
  return fails;
}

// ---------- 探针命中（R20：每维度每 run ≥1；缺报告 = 直接 FAIL；比对源侧 truth） ----------

export function probeCheck(dir, truth) {
  const fails = [];
  const dimsCovered = new Set(truth.map((t) => t.dim));
  for (const dim of DIMS) {
    if (!dimsCovered.has(dim)) fails.push(`维度 ${dim} 无探针（每维度每 run ≥1——R20）`);
  }
  for (const t of truth) {
    const report = safeRead(path.join(dir, "reviews", `review-${t.dim}-chunk-${nn2(t.virtualNn)}${t.half}.md`));
    if (!report) {
      fails.push(`探针单元缺报告（${t.dim} #${t.virtualNn}）= 终检直接 FAIL`);
      continue;
    }
    if (!report.includes(t.expectedHit)) {
      fails.push(`探针未命中：${t.dim} #${t.virtualNn} 报告未抓到植入缺陷（期望含「${t.expectedHit}」，缺陷：${t.defectType}）`);
    }
  }
  return fails;
}

// ---------- 主检 ----------

export function runGate(dir, opts = {}) {
  const inv = scanWorkdir(dir);
  if (inv.errors.length) return { exitCode: 2, errors: inv.errors };
  const title = inv.title;
  const total = inv.chunks.length;
  const fails = []; // { scope: "global" | nn, check, message }
  const warns = [];
  const push = (scope, check, message) => fails.push({ scope, check, message });
  const scopedSet = () => new Set(fails.filter((f) => f.scope !== "global").map((f) => f.scope));

  // ---- 1. 分母复核（global） ----
  if (inv.manifestOriginalSha != null && inv.manifestOriginalSha !== inv.originalSha) {
    push("global", "denominator", `原文 sha ${inv.originalSha} ≠ manifest 钉死 ${inv.manifestOriginalSha}——分母已变更（re-keying：重分段 + 内容 sha 对账保成果）`);
  }
  const chunkJoin = [...inv.chunks].sort((a, b) => a.nn - b.nn).map((c) => safeRead(path.join(dir, "chunks", c.name)) ?? "").join("");
  if (!inv.chunks.every((c) => safeRead(path.join(dir, "chunks", c.name)) != null)) {
    push("global", "denominator", "chunks/ 有缺失文件——无法复核分母，全局作废重走");
  } else if (sha12(chunkJoin) !== inv.originalSha) {
    push("global", "denominator", `chunks/ 拼接 sha ${sha12(chunkJoin)} ≠ 原文 ${inv.originalSha}——分母被改动（偷删/改写），全局作废重走`);
  }

  // ---- 参数源（被防对象可写范围——G2：verify 同参含 clamp；解析失败即 FAIL） ----
  let keepList = null;
  const keepPath = path.join(dir, `keep-list-${title}.json`);
  if (fs.existsSync(keepPath)) {
    try {
      keepList = loadKeepList(keepPath);
    } catch (e) {
      push("global", "params", `keep-list 解析失败：${e.message}`);
    }
  }
  let briefTh = {};
  const briefPath = path.join(dir, "brief.md");
  const briefText = safeRead(briefPath);
  if (briefText != null) {
    try {
      briefTh = loadBrief(briefPath);
    } catch (e) {
      push("global", "params", `brief 解析失败：${e.message}`);
    }
  }

  // ---- 2. 机械校验全项重跑（不信 verify-results.json；scoped/chunk；R8-c 投影同参——重推导） ----
  // R8-c 零信任口径：投影从 glossary × chunk 原文重推导（handoff.mjs 纯函数），不信任落盘
  // projection-chunk 文件（防"删投影灭判"）；落盘件与重推导不一致仅 WARN，判以重推导为准。
  const glossaryFile = fs.readdirSync(dir).find((f) => /^glossary-/.test(f)) ?? null;
  const glossaryText = glossaryFile != null ? safeRead(path.join(dir, glossaryFile)) : null;
  if (glossaryText == null) push("global", "completeness", "缺 glossary-<title>.md——Step 2 产物破口（R8-c 投影无源）");
  const glossaryEntries = glossaryText != null ? parseGlossary(glossaryText) : [];
  const glossarySha = glossaryText != null ? sha12(glossaryText) : "-";
  for (const c of inv.chunks) {
    const orig = safeRead(path.join(dir, "chunks", c.name));
    const t = inv.translated[c.nn];
    if (!t) {
      push(c.nn, "completeness", `chunk ${nn2(c.nn)} 缺译文——完备性破口`);
      continue;
    }
    if (orig == null) continue; // 分母缺已在 global 记
    const projectionText = renderProjection(projectionFor(glossaryEntries, orig), { glossarySha, chunkSha: sha12(orig), nn: c.nn });
    const onDiskProj = safeRead(path.join(dir, "handoff", `projection-chunk-${nn2(c.nn)}.md`));
    if (onDiskProj != null && onDiskProj !== projectionText) {
      warns.push(`投影文件与重推导不一致（chunk ${nn2(c.nn)}）——判以重推导为准，建议重跑 handoff.mjs`);
    }
    const result = verify(orig, t.text, { keepList, projectionText, ...briefTh });
    if (!result.passed) {
      push(c.nn, "verify", `chunk ${nn2(c.nn)} 机械校验重跑未过（${result.fails.length} 项）：${result.fails.slice(0, 3).map((f) => `[${f.check}] ${f.message}`).join("；")}${result.fails.length > 3 ? " …" : ""}`);
    }
  }

  // ---- 3. merged 重导出 diff（复用 merge.mjs 纯函数；归因规则见下） ----
  // 幂等重入：PASS 改名后 merged-draft.md 不在，交付物去元信息头后即 merged 内容（裁决 B——头是改名时前置的）
  const deliverable = `translated-${title}-zh.md`;
  const deliverablePath = path.join(dir, deliverable);
  const mergedOnDisk = safeRead(path.join(dir, "merged-draft.md"));
  const deliverableRaw = safeRead(deliverablePath);
  const mergedText = mergedOnDisk ?? (deliverableRaw != null ? stripMetaHeader(deliverableRaw) : null);
  const mergedIsDeliverable = mergedOnDisk == null && mergedText != null;
  const mergedLabel = mergedIsDeliverable ? `交付物 ${deliverable}` : "merged-draft.md";
  const reassembled = assemble(inv.chunks.map((c) => ({ nn: c.nn, text: inv.translated[c.nn]?.text ?? "" })));
  if (mergedText == null) {
    push("global", "merged", "缺 merged-draft.md 且无交付物——Step 8 未跑或产物被删，全局阶段重走");
  } else if (mergedText !== reassembled.merged) {
    // 归因（C-7）：有 chunk 重验/完备性 FAIL → 差异可归因该 chunk 集（译文 post-merge 变更或缺译文），scoped；
    // 全部 chunk 干净 → merged 本体被改，global
    const vs = [...new Set(fails.filter((f) => f.scope !== "global" && (f.check === "verify" || f.check === "completeness")).map((f) => f.scope))];
    if (vs.length) {
      for (const nn of vs) push(nn, "merged", `chunk ${nn2(nn)} 译文在 merge 后已变更（merged 未重导）——重跑 merge 与下游`);
    } else if (reassembled.residues.length) {
      push("global", "merged", `${mergedLabel} 与重导出不一致且译文含非空 «» 残留：${reassembled.residues.slice(0, 5).map((r) => `chunk ${nn2(r.nn)} ${r.mark}`).join("；")}`);
    } else {
      push("global", "merged", `${mergedLabel} ≠ 从 translated-chunks 重导出的组装（译文全过重验）——${mergedIsDeliverable ? "交付物被改动（疑手改，R18-⑥）" : "merged 本体被改动"}，全局作废重走`);
    }
  }

  // ---- 4. 完备性矩阵（scoped/chunk；准确性缺失无条件 FAIL） ----
  const matrix = inv.chunks.map((c) => ({ nn: c.nn, adjudication: false, reviews: 0, fresh: 0, missingDims: new Set() }));
  for (const row of matrix) {
    const c = inv.chunks.find((x) => x.nn === row.nn);
    row.adjudication = inv.adjudicated.has(c.nn);
    if (!row.adjudication) push(c.nn, "completeness", `chunk ${nn2(c.nn)} 缺裁定台账（adjudications/）`);
    const t = inv.translated[c.nn];
    if (!t) continue;
    const halves = halfSlices(t.text);
    for (const dim of DIMS) {
      for (const h of ["a", "b"]) {
        const rep = inv.reviews[c.nn]?.[dim]?.[h] ?? null;
        if (rep == null) {
          row.missingDims.add(dim);
          push(c.nn, "completeness", `chunk ${nn2(c.nn)} 缺 ${dim} 半块 ${h} 报告${dim === "accuracy" ? "（准确性维度缺失 = 无条件 FAIL，不可降级）" : ""}`);
        } else if (rep !== halves[h].sha) {
          row.missingDims.add(dim);
          push(c.nn, "completeness", `chunk ${nn2(c.nn)} ${dim} 半块 ${h} 报告 sha 失配（stale——重审）`);
        } else {
          row.fresh++;
        }
        row.reviews++;
      }
    }
  }

  // ---- 5. 报告签名扫描（undersize 阈值随送审单元缩放 + 模板签名） ----
  const unitBytes = (nn, h) => {
    const t = inv.translated[nn];
    return t ? Buffer.byteLength(halfSlices(t.text)[h].text, "utf-8") : 0;
  };
  const rdir = path.join(dir, "reviews");
  const reviewFiles = fs.existsSync(rdir) ? fs.readdirSync(rdir).filter((f) => /^review-[\w-]+-chunk-\d+[ab]\.md$/.test(f)) : [];
  const byContent = new Map();
  const probeTruth = opts.probeTruth ? JSON.parse(safeRead(opts.probeTruth) ?? "[]") : null;
  for (const f of reviewFiles) {
    const m = f.match(/^review-([\w-]+)-chunk-(\d+)([ab])\.md$/);
    const [, dim, nnS, h] = m;
    const nn = Number(nnS);
    const content = safeRead(path.join(rdir, f)) ?? "";
    const bytes = nn >= 901
      ? Buffer.byteLength((probeTruth?.find((t) => t.virtualNn === nn)?.text) ?? "", "utf-8") // 探针单元
      : unitBytes(nn, h);
    const minBytes = Math.max(SIGNATURE_FLOOR, Math.round((SIGNATURE_BASE * (bytes / 1024)) / 4));
    if (Buffer.byteLength(content, "utf-8") < minBytes) {
      push(nn >= 901 ? "global" : nn, "signature", `${f} 疑似 undersize（${Buffer.byteLength(content, "utf-8")}B < 缩放阈值 ${minBytes}B）——签名不足`);
    }
    const key = content.trim();
    if (byContent.has(key)) byContent.get(key).push(f);
    else byContent.set(key, [f]);
  }
  for (const [key, files] of byContent) {
    if (files.length > 1) {
      push("global", "signature", `报告模板签名：${files.length} 份报告内容完全相同（${files.slice(0, 3).join("、")}${files.length > 3 ? " …" : ""}）——批量盖章`);
    }
  }

  // ---- 6. G3 括注对账 + R23 精选表兑现（scoped/chunk） ----
  const spPath = path.join(dir, `special-phrases-${title}.md`);
  const phrases = fs.existsSync(spPath) ? parseSpecialPhrases(safeRead(spPath) ?? "") : [];
  for (const c of inv.chunks) {
    const t = inv.translated[c.nn];
    const orig = safeRead(path.join(dir, "chunks", c.name));
    if (!t || orig == null) continue;
    const ledger = parseLedger(safeRead(path.join(dir, "adjudications", `adjudication-chunk-${nn2(c.nn)}.md`)) ?? "");
    // R23 必兑现集：左值出现于该 chunk 原文的条目
    const r23 = phrases.filter((p) => orig.includes(p.en));
    const expected = new Set([...ledger.keep, ...r23.map((p) => p.en)]);
    const actual = new Set(fenceAwareAnnotationMatches(t.text).map((s) => s.trim()));
    const missing = [...expected].filter((e) => !actual.has(e));
    const extra = [...actual].filter((a) => !expected.has(a));
    if (expected.size && !actual.size) {
      push(c.nn, "annotation", `chunk ${nn2(c.nn)} 译文括注为空但应兑现集合非空（${expected.size} 条）——空洞合规（G3：空集对非空台账即 FAIL）`);
    }
    for (const m of missing) push(c.nn, "annotation", `chunk ${nn2(c.nn)} 括注缺失：${m}（台账保留/R23 必兑现）`);
    for (const e of extra) push(c.nn, "annotation", `chunk ${nn2(c.nn)} 未裁定直接括注：${e}（阶段A 硬禁止——须走 «» 裁定或 R23 精选表）`);
    // R23 形态硬判：右值（左值）紧邻括注
    for (const p of r23) {
      const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(`${esc(p.zh)}\\s*[（(]${esc(p.en)}[)）]`);
      if (!re.test(t.text)) push(c.nn, "r23", `chunk ${nn2(c.nn)} 精选表未兑现：${p.en} 须以「${p.zh}（${p.en}）」括注形态呈现`);
    }
  }

  // ---- 7. 标题双语锚（global；brief 关闭时披露跳过） ----
  const anchorSkipped = anchorOff(briefText);
  const anchorFails = [];
  if (!anchorSkipped && mergedText != null) {
    anchorFails.push(...headingAnchorCheck(safeRead(inv.originalFile) ?? "", mergedText));
    for (const f of anchorFails) push("global", "heading-anchor", f);
  }

  // ---- 8. G4 冷读/pm-review 结构化核验 + R15 锚（global） ----
  const coldPath = path.join(dir, `cold-read-${title}.md`);
  const coldText = safeRead(coldPath);
  if (coldText == null) {
    push("global", "g4", "缺冷读台账（cold-read-<title>.md）——Step 9 未完成");
  } else {
    const cov = parseColdRead(coldText);
    for (const c of inv.chunks) {
      const t = inv.translated[c.nn];
      const want = t?.sha;
      const got = cov[c.nn];
      if (got == null) push("global", "g4", `冷读覆盖矩阵缺 chunk ${nn2(c.nn)}（逐段覆盖 = 全稿，"无发现"自述不算数）`);
      else if (want != null && got !== want) push(c.nn, "g4", `冷读覆盖 chunk ${nn2(c.nn)} sha ${got} ≠ 当前译文 ${want}——台账过期（该 chunk 复核后刷新台账）`);
    }
  }
  const pmPath = path.join(dir, `pm-review-${title}.md`);
  const pmText = safeRead(pmPath);
  if (pmText == null) {
    push("global", "g4", "缺 pm-review（pm-review-<title>.md）——Step 9 未完成");
  } else {
    const pm = parsePmReview(pmText);
    const mergedSha = mergedText != null ? sha12(mergedText) : null;
    if (pm.mergedSha == null) push("global", "r15", "pm-review 头部缺 merged-sha 锚（R15）");
    else if (mergedSha != null && pm.mergedSha !== mergedSha) {
      push("global", "r15", `pm-review 头部 merged-sha ${pm.mergedSha} ≠ 当前 merged-draft ${mergedSha}——旧稿结论不得携入终检（R15 不豁免）`);
    }
    const req = requiredSamples(total, inv.events);
    for (const nn of req) {
      const concl = pm.samples[nn];
      if (concl == null) push("global", "g4", `pm-review 选样缺 chunk ${nn2(nn)}（脚本必备选样集：每 5 抽 1 + 升级/接缝必抽）`);
      else if (/跳过|skip/i.test(concl) || concl.length < 10) push("global", "g4", `pm-review 选样 chunk ${nn2(nn)} 无实质结论：${concl}`);
    }
    for (const d of PM_QUALITY_DIMS) {
      const lines = pm.lines.filter((l) => d.re.test(l));
      if (!lines.length) push("global", "g4", `pm-review 步骤合规表缺质量维度「${d.cn}」${d.dim === "accuracy" ? "（准确性维度缺失 = 无条件 FAIL）" : ""}`);
      else if (lines.some((l) => /跳过|SKIPPED/i.test(l))) push("global", "g4", `pm-review 质量维度「${d.cn}」标 SKIPPED（质量维度不存在 SKIPPED 合法标记——FR-7）`);
    }
  }

  // ---- 9. 探针命中（global；缺 truth = FAIL——每维度每 run ≥1 是硬判） ----
  if (!opts.probeTruth) {
    push("global", "probe", "未提供 --probe-truth：探针核对无 ground truth（每维度每 run ≥1 是硬判，不可豁免）");
  } else if (!fs.existsSync(opts.probeTruth)) {
    push("global", "probe", `probe truth 文件不存在：${opts.probeTruth}`);
  } else if (!Array.isArray(probeTruth) || !probeTruth.length) {
    push("global", "probe", "probe truth 为空——本轮 run 无探针即无审校有效性证据");
  } else {
    for (const f of probeCheck(dir, probeTruth)) push("global", "probe", f);
  }

  // ---- 10. 新鲜度（WARN only；豁免 glob 精确到文件/目录） ----
  const mergedStat = fs.existsSync(path.join(dir, "merged-draft.md")) ? fs.statSync(path.join(dir, "merged-draft.md")).mtimeMs : null;
  if (mergedStat != null) {
    const walk = [];
    for (const root of ["translated-chunks", "chunks", "adjudications", "reviews"]) {
      const p = path.join(dir, root);
      if (fs.existsSync(p)) for (const f of fs.readdirSync(p)) walk.push(path.join(root, f));
    }
    for (const f of ["manifest.md", ...fs.readdirSync(dir).filter((x) => /^cold-read-/.test(x))]) walk.push(f);
    for (const rel of walk) {
      const relPosix = rel.replace(/\\/g, "/");
      if (EXEMPT_GLOBS.some((g) => g.test(relPosix))) continue;
      const st = fs.statSync(path.join(dir, rel));
      if (st.mtimeMs > mergedStat) warns.push(`新鲜度（仅提示，硬判为内容 sha + 重执行）：${relPosix} 晚于 merged-draft.md——疑 merge 后改动`);
    }
    const pmStat = fs.existsSync(pmPath) ? fs.statSync(pmPath).mtimeMs : null;
    if (pmStat != null && pmStat < mergedStat) warns.push("新鲜度：pm-review 早于 merged-draft（固定顺序应为 pm-review 最后写）");
  }

  // ---- 判定与交付 ----
  const passed = fails.length === 0;
  let delivered = false;

  if (passed) {
    const existing = safeRead(deliverablePath);
    if (existing != null && stripMetaHeader(existing) !== mergedText) {
      // R18-⑥：已存在不一致交付物 = 用户手改 → 拒绝覆盖，转人工裁决（手修永不覆盖）
      fails.push({ scope: "global", check: "deliverable-guard", message: `已存在交付物 ${deliverable} 与本次产物 sha 不一致（疑用户手改）——保留手修或删除后重跑，终检不自动覆盖（R18-⑥）` });
    } else if (mergedIsDeliverable) {
      delivered = true; // 幂等重入：交付物在位且去头后 = 重导出组装，无需动作
    } else {
      // 落盘（裁决 B）：元信息头 + merged 内容。写临时件再原子改名——交付物要么完整出现要么不出现；
      // merged-draft 删除在交付物就位之后。merged-draft 本体保持纯拼接（M5 确定性不变）。
      const header = renderMetaHeader({ originalText: safeRead(inv.originalFile), briefText, mergedText });
      const tmp = deliverablePath + ".tmp";
      fs.writeFileSync(tmp, header + mergedText, "utf-8");
      fs.renameSync(tmp, deliverablePath);
      fs.rmSync(path.join(dir, "merged-draft.md"));
      delivered = true;
    }
  }

  // 半径在交付守卫之后计算（守卫失败属全局半径）
  const hasGlobal = fails.some((f) => f.scope === "global");
  const scoped = scopedSet();

  const finalPassed = fails.length === 0;
  const eventsNote = { ev: "final-gate", passed: finalPassed, radius: finalPassed ? null : hasGlobal ? "global" : "scoped", failCount: fails.length };
  if (finalPassed) eventsNote.deliverableSha = fileSha(deliverablePath);
  appendEvents(dir, eventsNote);

  // 连续 FAIL ≥3 → PENDING-USER（不无限空转）。计数 = 事件流末尾连续 fail 的 final-gate 段
  //（inv.events 是本次追加前读的快照，故 +1 计入本次）
  let consecutiveFails = 0;
  for (let i = inv.events.length - 1; i >= 0; i--) {
    const e = inv.events[i];
    if (e.ev !== "final-gate") continue;
    if (e.passed === false) consecutiveFails++;
    else break;
  }
  if (!finalPassed && consecutiveFails + 1 >= 3) {
    if (!fs.existsSync(path.join(dir, "pending.md"))) {
      fs.writeFileSync(path.join(dir, "pending.md"), `type: pending-user\n原因：终检连续 FAIL ≥3——不无限空转（C-7）\n菜单：①继续（按半径分级重走：${hasGlobal ? "全局阶段作废重走" : `scoped chunk ${[...scoped].map(nn2).join(",")} 回退 Step 6/7` }）②手修后"继续翻译"（按新 sha 重审）③停止翻译\n`, "utf-8");
      appendEvents(dir, { ev: "suspend", detail: "final-gate 连续 FAIL ≥3" });
    }
  }

  // ---- REPORT 定稿（PASS/FAIL 均落盘；终检报告自身在新鲜度豁免 glob 内） ----
  const report = renderReport({ title, inv, total, fails, warns, finalPassed, delivered, deliverable, deliverablePath, briefTh, anchorSkipped, matrix, probeTruth, dir });
  fs.writeFileSync(path.join(dir, "REPORT.md"), report, "utf-8");

  const summary = finalPassed
    ? `终检 PASS：${total} chunk 全部判据通过，已原子改名为 ${deliverable}（sha1 ${fileSha(deliverablePath)}——R18-⑥ 内容锚）。原文 sha1 ${inv.originalSha}（对照 Step 0 预算公告，G1）。本会话退出时将自动发布，请现在抽查，不满意可"重翻第 N 章"（R17）。`
    : `终检 FAIL（${fails.length} 项；半径：${hasGlobal ? "全局作废重走" : `scoped chunk ${[...scoped].map(nn2).join(", ")} 回退 Step 6/7 + 接缝复查 + pm-review 重生成`}）——见 REPORT.md`;

  return {
    exitCode: finalPassed ? 0 : hasGlobal ? 4 : 3,
    passed: finalPassed,
    delivered,
    deliverablePath: finalPassed ? deliverablePath : null,
    fails,
    warns,
    summary,
    report,
    radius: finalPassed ? null : hasGlobal ? "global" : "scoped",
    scopedChunks: finalPassed ? [] : [...scoped],
  };
}

// ---------- REPORT 渲染 ----------

function renderReport({ title, inv, total, fails, warns, finalPassed, delivered, deliverable, deliverablePath, briefTh, anchorSkipped, matrix, probeTruth, dir }) {
  const L = [];
  const scopedNn = [...new Set(fails.filter((f) => f.scope !== "global").map((f) => f.scope))].sort((a, b) => a - b);
  L.push(`# REPORT — ${title} 交付体检报告`);
  L.push("");
  L.push(finalPassed
    ? `> **结论：可发布。** ${total} chunk 全部判据通过；交付物 ${deliverable}${delivered ? `（sha1 前 12：${fileSha(deliverablePath)}，内容锚——R18-⑥）` : ""}。`
    : `> **结论：不可发布（FAIL，${fails.length} 项）。** 半径分级（C-7）：${fails.some((f) => f.scope === "global") ? "全局性根因——全局阶段作废重走" : `根因限单 chunk 集（${scopedNn.map((n) => String(n).padStart(2, "0")).join(", ")}）——scoped 重做：该 chunk 回退 Step 6/7 + 接缝复查 + pm-review 重生成`}`);
  L.push("");
  L.push(`- 原文 sha1（前 12）：${inv.originalSha}｜chunk 数：${total}（G1：与 Step 0 预算公告对照）`);
  if (delivered) L.push(`- 交付物：${deliverable}（sha1 前 12：${fileSha(deliverablePath)}）——再入不符 = 用户手改，询问保留或重交（R18-⑥）`);
  const nonDefault = Object.entries(briefTh).filter(([, v]) => v != null);
  L.push(`- 阈值披露（R22）：${nonDefault.length ? nonDefault.map(([k, v]) => `${k}=${v}（安全域 clamp 生效）`).join("；") : "brief 全默认"}`);
  L.push(`- 标题双语锚：${anchorSkipped ? "**跳过**（brief 关闭——随 brief 披露，2026-08-31 裁定）" : "开启（逐标题：中文行 + 次行锚逐字 + 级别序列）"}`);
  L.push("");
  L.push("## 覆盖明细（完备性矩阵，分母 = 原文钉死）");
  L.push("");
  L.push("| chunk | 裁定 | 报告（fresh/应） | 状态 |");
  L.push("|-------|------|------------------|------|");
  for (const row of matrix) {
    const bad = fails.some((f) => f.scope === row.nn);
    L.push(`| ${String(row.nn).padStart(2, "0")} | ${row.adjudication ? "✅" : "❌"} | ${row.fresh}/${DIMS.length * 2} | ${bad ? "❌ 见 FAIL 清单" : "✅"} |`);
  }
  L.push("");
  const dimFresh = DIMS.map((d) => `${d} ${matrix.filter((r) => !r.missingDims.has(d)).length}/${total}`).join("；");
  L.push(`- 四维各一句：${dimFresh}${DIMS.includes("accuracy") && matrix.some((r) => r.missingDims.has("accuracy")) ? "——**准确性维度缺失 = 无条件 FAIL**" : ""}`);
  L.push("");
  if (probeTruth) {
    const hit = probeTruth.filter((t) => (safeRead(path.join(dir, "reviews", `review-${t.dim}-chunk-${String(t.virtualNn).padStart(2, "0")}${t.half}.md`)) ?? "").includes(t.expectedHit)).length;
    L.push(`- 探针：${probeTruth.length} 发命中 ${hit}/${probeTruth.length}（探针 = 故意埋错看审校能否全抓到——R20 人话括注）`);
  } else {
    L.push("- 探针：**无 truth（FAIL 项）**");
  }
  L.push("");
  const map = chapterMap(inv);
  if (map.length) {
    L.push("## 章 ↔ chunk 映射对账（R5）");
    L.push("");
    for (const c of map) L.push(`- 第 ${c.chapter} 章 ${c.title} = chunk ${c.chunks.map((n) => String(n).padStart(2, "0")).join(", ")}`);
    L.push("");
  }
  const dispatched = inv.events.filter((e) => e.ev === "dispatch").length;
  const escalations = inv.events.filter((e) => e.ev === "escalate").length;
  L.push(`## 消耗对账（events.jsonl 推导）`);
  L.push("");
  L.push(`- 单元派发 ${dispatched} 次｜升级 ${escalations} 次｜final-gate 执行 ${inv.events.filter((e) => e.ev === "final-gate").length + 1} 次（含本次）`);
  L.push("");
  if (fails.length) {
    L.push("## FAIL 清单与打回指令");
    L.push("");
    for (const f of fails) L.push(`- [${f.check}]（半径：${f.scope === "global" ? "全局" : `chunk ${String(f.scope).padStart(2, "0")}`}）${f.message}`);
    L.push("");
  }
  if (warns.length) {
    L.push("## 遗留 WARN");
    L.push("");
    for (const w of warns) L.push(`- ${w}`);
    L.push("");
  }
  L.push("## audit 使用说明");
  L.push("");
  L.push("- 用户可随时运行 audit（指向源仓只读脚本，M5 落地）：输出人话 PASS/FAIL，不阻塞交付。");
  L.push("");
  return L.join("\n");
}

// ---------- CLI ----------

function parseArgs(argv) {
  const pos = [];
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--probe-truth") opts.probeTruth = argv[++i];
    else if (a === "--json") opts.json = true;
    else if (a === "-h" || a === "--help") opts.help = true;
    else pos.push(a);
  }
  return { pos, opts };
}

const __help = `final-gate.mjs — xl-translator Step 10 终检与交付（交付门，M1c）

用法:
  node final-gate.mjs <workdir> [--probe-truth <truth.json>] [--json]

规则（重执行一切，不信任何落盘日志）:
  - 机械校验全项重跑（verify-mech 同源）+ 拼接 sha 复核 + merged 重导出 diff（merge 纯函数）
  - 完备性矩阵（裁定 + 4 维 × 2 半块 fresh）；准确性维度缺失 = 无条件 FAIL
  - G3 括注对账双向相等（台账保留 ∪ R23 必兑现）；R23 精选表兑现硬判
  - 标题双语锚（fence 感知分母；brief 关闭时披露跳过）；G4 冷读覆盖矩阵 + pm-review 选样；
    R15 pm-review merged-sha 锚不豁免；探针命中比对（每维度每 run ≥1）
  - 新鲜度 mtime 仅 WARN（豁免 glob：status.md / verify-results.json / staging/ / pm-review /
    REPORT.md / events.jsonl / pending.md）
  - PASS → 原子改名 translated-<title>-zh.md + REPORT 定稿（交付物 sha 内容锚）；
    手改交付物不被覆盖（R18-⑥）；FAIL → 半径分级（scoped/global），连续 ≥3 转 PENDING-USER

退出码: 0 PASS / 1 用法 / 2 工作目录异常 / 3 FAIL(scoped) / 4 FAIL(global)`;

// CLI 守卫用 fileURLToPath（Windows 下 new URL().pathname 形态不匹配，见 merge.mjs 同注）
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const { pos, opts } = parseArgs(process.argv.slice(2));
  if (opts.help || pos.length < 1) {
    console.log(__help);
    process.exit(pos.length < 1 && !opts.help ? 1 : 0);
  }
  const r = runGate(pos[0], opts);
  if (r.errors?.length) console.error(`❌ ${r.errors.join("；")}`);
  console.log(r.passed ? `✅ ${r.summary}` : `❌ ${r.summary}`);
  for (const f of r.fails ?? []) console.log(`  • [${f.check}] ${f.message}`);
  for (const w of r.warns ?? []) console.log(`  ⚠ ${w}`);
  if (opts.json) {
    const { report, ...rest } = r;
    console.log(JSON.stringify({ ...rest, errors: rest.errors ?? [] }, null, 2));
  }
  process.exit(r.exitCode);
}
