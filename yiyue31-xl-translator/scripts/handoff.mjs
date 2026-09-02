// handoff.mjs — xl-translator 交接包机器件生成器（DESIGN §2 Step 3 + §5.1；M3 前置④落点裁决）
//
// 落点分工（2026-09-01 裁决：机械归脚本、判断归主 agent）：
//   机器件（本脚本，幂等可重生成）：
//     handoff/projection-chunk-<NN>.md — 既定译法投影（R8-b）：glossary 条目 × 该 chunk 原文
//       扫描（大小写/单复数归一）取出现的条目子集；verify-mech R8-c 术语兑现硬判消费。
//       格式冻结：每行 `English :: 中文 [| 别名]`，`#` 注释行与空行忽略（与精选表同解析法）。
//     handoff/context-chunk-<NN>.md — 串行增强段：N-1 邻 chunk **最新机械校验 passed** 译文
//       末段 300-500 字 + sha 锚（源译文变更即重生成——与 status.mjs handoffStale 同语义）。
//   判断件（主 agent 组装，本脚本不碰）：handoff/chunk-<NN>.md（②"留下了什么"④贯穿台账
//     ⑤文风卡引用）与 map.md。标题条目/反复用语并入投影待 map.md 格式冻结（M3 标定观察）。
//
// [KEEP] 条目不进投影——keep-list 硬判（verify ⑷）已逐项管原样保留，重复判必误伤。
// 中文值含 "/"（种子拷贝遗留的双写法）自动拆为别名——R8-c 按别名放宽（2026-08-31 裁决）。
//
// 确定性：产物无时间戳（sha 锚是内容派生）；同输入重跑字节相同（M5 同款纪律）。
//
// CLI: node handoff.mjs <workdir> [--nn N] [--json]
//   --nn   只生成该 chunk（缺省 = manifest 全部 chunk 的机器件）
// 退出码: 0 成功 / 1 用法错 / 2 工作目录异常（无 original/manifest/译文目录按需判）

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { scanWorkdir } from "./status.mjs";

const sha12 = (s) => crypto.createHash("sha1").update(s, "utf-8").digest("hex").slice(0, 12);
const nn2 = (n) => String(n).padStart(2, "0");

// ---------- glossary 解析（表格式 `| English | Translation | Context |`） ----------

export function parseGlossary(text) {
  const out = [];
  for (const line of String(text ?? "").split(/\r?\n/)) {
    const m = line.match(/^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/);
    if (!m || m[1].toLowerCase() === "english term" || m[1].startsWith("-")) continue; // 表头/分隔行
    const en = m[1].trim();
    const zhRaw = m[2].trim();
    if (!en || !zhRaw || /^\[KEEP\]$/i.test(zhRaw)) continue; // [KEEP] 归 keep-list 硬判
    const parts = zhRaw.split("/").map((s) => s.trim()).filter(Boolean);
    out.push({ en, zh: parts[0], aliases: parts.slice(1) });
  }
  return out;
}

// 大小写/单复数归一变体（R8-b）：term / term+s / term+es / 末尾 y→ies
export function enVariants(en) {
  const t = en.toLowerCase();
  const vs = new Set([t]);
  if (/y$/.test(t)) vs.add(t.slice(0, -1) + "ies");
  else if (/(?:[sxz]|ch|sh)$/.test(t)) vs.add(t + "es");
  else vs.add(t + "s");
  return [...vs];
}

// ---------- 投影（纯函数） ----------

// 条目在该 chunk 原文出现（词边界匹配任一变体，大小写不敏感——"agent" 不误中 "agentic"）→ 收入投影
export function projectionFor(glossary, chunkText) {
  const lower = String(chunkText ?? "").toLowerCase();
  return glossary
    .filter((g) => enVariants(g.en).some((v) => new RegExp(`(^|[^a-z0-9])${escapeRe(v)}([^a-z0-9]|$)`, "i").test(lower)))
    .map((g) => ({ en: g.en, zh: g.zh, aliases: g.aliases }));
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function renderProjection(entries, { glossarySha, chunkSha, nn }) {
  const head = [
    "# 机器生成（handoff.mjs）——勿手改；重跑覆盖",
    `# 源锚：glossary sha ${glossarySha} × chunk ${nn2(nn)} 原文 sha ${chunkSha}`,
  ];
  const lines = entries.map((e) => [e.en, e.zh, ...e.aliases].join(" :: "));
  return [...head, ...lines, ""].join("\n");
}

// ---------- 串行增强段（纯函数） ----------

// 译文末段 300-500 字：按段落从尾部回取，凑满 ~300 即止、不超 ~500（超则截前段首）
export function tailSegment(text, max = 500, min = 300) {
  const paras = String(text ?? "").trim().split(/\n{2,}/).filter((p) => p.trim());
  const picked = [];
  let len = 0;
  for (let i = paras.length - 1; i >= 0 && len < min; i--) {
    picked.unshift(paras[i].trim());
    len += paras[i].trim().length;
    if (len > max) break;
  }
  let s = picked.join("\n\n");
  if (s.length > max) s = "…" + s.slice(s.length - max);
  return s;
}

export function renderContext({ nn, prev, prevSha, segment, fresh }) {
  const L = ["# 机器生成（handoff.mjs）——勿手改；重跑覆盖（串行增强段）"];
  if (prev == null) {
    L.push("", `chunk ${nn2(nn)} 无前邻（首 chunk）——串行增强段缺省，正常继续。`);
  } else if (!fresh) {
    L.push("", `邻 chunk ${nn2(prev)} 未过审（或 sha 过期）——串行增强段缺省，退纯预生成模式。`);
  } else {
    L.push(`邻 chunk：${nn2(prev)}（译文 sha1 ${prevSha}——源译文变更即失效重生成）`, "", "```", segment, "```");
  }
  return L.join("\n") + "\n";
}

// ---------- 主流程 ----------

// 语境段新鲜口径与 merge.mjs collectSet 同源：记录存在 + passed === true + sha === 当前译文
export function runHandoff(dir, opts = {}) {
  const inv = scanWorkdir(dir);
  if (inv.errors.length) return { exitCode: 2, errors: inv.errors };
  if (!inv.chunks.length) return { exitCode: 2, errors: ["manifest.md 无 chunk 登记"] };

  const glossaryFile = fs.readdirSync(dir).find((f) => /^glossary-/.test(f)) ?? null;
  if (!glossaryFile) return { exitCode: 2, errors: ["缺 glossary-<title>.md（Step 2 未跑）——投影无源"] };
  const glossary = parseGlossary(fs.readFileSync(path.join(dir, glossaryFile), "utf-8"));
  const glossarySha = sha12(fs.readFileSync(path.join(dir, glossaryFile), "utf-8"));

  const targets = opts.nn ? inv.chunks.filter((c) => c.nn === opts.nn) : inv.chunks;
  if (!targets.length) return { exitCode: 1, errors: [`chunk ${opts.nn} 不在 manifest 登记`] };

  fs.mkdirSync(path.join(dir, "handoff"), { recursive: true });
  const generated = [];
  for (const c of targets) {
    const chunkText = fs.readFileSync(path.join(dir, "chunks", c.name), "utf-8");
    const proj = renderProjection(projectionFor(glossary, chunkText), { glossarySha, chunkSha: sha12(chunkText), nn: c.nn });
    const projPath = path.join(dir, "handoff", `projection-chunk-${nn2(c.nn)}.md`);
    fs.writeFileSync(projPath, proj, "utf-8");
    generated.push(projPath);

    const prev = inv.chunks.find((x) => x.nn === c.nn - 1) ?? null;
    const pt = prev ? inv.translated[prev.nn] : null;
    const pv = prev ? inv.verify[prev.nn] ?? null : null;
    const fresh = !!(pt && pv && pv.passed === true && pv.translationSha === pt.sha);
    const ctx = renderContext({
      nn: c.nn,
      prev: prev?.nn ?? null,
      prevSha: pt?.sha ?? null,
      segment: fresh ? tailSegment(pt.text) : null,
      fresh,
    });
    const ctxPath = path.join(dir, "handoff", `context-chunk-${nn2(c.nn)}.md`);
    fs.writeFileSync(ctxPath, ctx, "utf-8");
    generated.push(ctxPath);
  }
  return { exitCode: 0, generated, glossaryEntries: glossary.length };
}

// ---------- CLI ----------

function parseArgs(argv) {
  const pos = [];
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--nn") opts.nn = Number(argv[++i]);
    else if (argv[i] === "--json") opts.json = true;
    else if (argv[i] === "--help" || argv[i] === "-h") opts.help = true;
    else pos.push(argv[i]);
  }
  return { pos, opts };
}

const __help = `handoff.mjs — 交接包机器件生成器（投影 + 串行增强段）

用法:
  node handoff.mjs <workdir> [--nn N] [--json]

产物（handoff/ 下，幂等重生成；判断件 chunk-<NN>.md 由主 agent 组装，本脚本不碰）:
  projection-chunk-<NN>.md   既定译法投影（R8-b；verify-mech --projection 消费，R8-c）
  context-chunk-<NN>.md      串行增强段（邻 chunk 已审末段 + sha 锚）

退出码: 0 成功 / 1 用法错（--nn 不在 manifest） / 2 工作目录异常`;

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const { pos, opts } = parseArgs(process.argv.slice(2));
  if (opts.help || pos.length < 1) {
    console.log(__help);
    process.exit(pos.length < 1 && !opts.help ? 1 : 0);
  }
  const r = runHandoff(path.resolve(pos[0]), opts);
  if (opts.json) console.log(JSON.stringify(r, null, 2));
  else if (r.exitCode === 0) {
    console.log(`✅ 交接包机器件 ${r.generated.length} 个（glossary ${r.glossaryEntries} 条）：`);
    for (const g of r.generated) console.log(`  - ${path.relative(path.resolve(pos[0]), g)}`);
  } else for (const e of r.errors ?? []) console.error(`❌ ${e}`);
  process.exit(r.exitCode);
}
