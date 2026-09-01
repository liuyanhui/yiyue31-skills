// merge.mjs — xl-translator Step 8 确定性组装（DESIGN §2 Step 8；§5.2 B 表 2026-08-31 裁决补登记）
//
// 职责边界（Step 8 两职责拆分）：组装归本脚本，统稿扫描归 consistency.mjs。
// final-gate"从 translated-chunks 重导出 merged 做 diff"复用本文件导出的 assemble 纯函数
// （重执行 = 换调用点，不重写逻辑——2026-08-31 Yiyue 裁决）。
//
// 固定判据 M1-M7（契约登记于 scripts/test/README.md，测试按此写）：
//   M1 chunk 按 NN **数值序**拼接（禁字典序——R29），字节保真零改写
//   M2 收录集合恰好 = "最新机械校验 passed"：verify-results.json 中该 chunk 最后一条记录
//      passed === true 且 translationSha === 当前译文文件 sha（与 status.mjs deriveState 同口径）；
//      未过审 / 修复后未重验（记录 sha 过期）的 chunk **排除并披露**，不多收不少收
//   M3 非空 «...» 残留 = 0（>0 即拒绝——merge 绝不替阶段B 做裁定决定）；
//      空 «» 对（去标遗留，verify-mech 正则 /«[^»]+»/ 不拦的形态）机械清除并记录（events + stdout）
//   M4 产物 = merged-draft.md 临时名，不命中任何发布模式（refined-stock lib.mjs classify 实核：
//      merged- 不匹配 ^merge-.+\.md$——第 6 字符是 d 不是 -；嵌套路径不命中根级裸 .md 规则）
//   M5 同输入重跑字节相同（无时间戳无随机——时间只进 events.jsonl 不进产物）
//   M6 输入损坏非零退出绝不静默拼残稿：
//      - 缺 chunk：manifest 登记的 NN 无译文文件；译文 chunk 的 NN 不在 manifest
//      - 乱序号：manifest NN 序列非 01..N 严格递增
//      - sha 不符：manifest 记录的 chunk 原文 sha ≠ chunks/ 实文件 sha（分母被改动）。
//        译文侧 sha 过期不属此类——那是"修复后未重验"的正常流水态，走 M2 排除披露
//      - verify-results.json 缺失或无任何记录（无筛选依据）；收录集为空
//   M7 零改写：无 BOM、无 EOL 归一、无 "\n\n" 插入——纯 join("")（旧 doc_segmenter 同款拼接病）
//
// CLI: node merge.mjs <workdir> [--json]
// 退出码: 0 成功 / 1 用法错 / 2 工作目录异常 / 3 输入损坏（M6）/ 4 «» 非空残留（M3 拒绝）

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { scanWorkdir, appendEvents } from "./status.mjs";

const MERGED = "merged-draft.md";
const sha12 = (s) => crypto.createHash("sha1").update(s, "utf-8").digest("hex").slice(0, 12);
const fileSha = (p) => sha12(fs.readFileSync(p, "utf-8"));
const nn2 = (n) => String(n).padStart(2, "0");

// ---------- 纯函数：组装（final-gate 复用点） ----------

// entries: [{ nn, text }] → 按 NN 数值序零改写拼接。
// 空串标记 «» 机械清除（清标动作计数，M3）；非空 «...» 逐条上报由调用方决定拒绝。
export function assemble(entries) {
  const sorted = [...entries].sort((a, b) => a.nn - b.nn);
  const residues = [];
  let cleared = 0;
  const parts = sorted.map((e) => {
    for (const m of e.text.match(/«[^»]+»/g) ?? []) residues.push({ nn: e.nn, mark: m });
    const t = e.text.replace(/«»/g, ""); // 清标：只删空对，不触碰任何内容
    cleared += (e.text.length - t.length) / 2;
    return t;
  });
  return { merged: parts.join(""), cleared: Math.round(cleared), residues };
}

// ---------- 收录集合（M2） ----------

// "最新 passed" 判定与 status.mjs deriveState 的 verify 阶段判定同口径：
// 记录存在 + passed === true + translationSha === 当前译文文件 sha，三者缺一即排除并给理由。
export function collectSet(inv) {
  const included = [];
  const excluded = [];
  for (const c of inv.chunks) {
    const t = inv.translated[c.nn];
    const v = inv.verify[c.nn] ?? null;
    if (!t) excluded.push({ nn: c.nn, reason: "缺译文文件" }); // runMerge 前置硬拦，此处双保险
    else if (!v) excluded.push({ nn: c.nn, reason: "无机械校验记录" });
    else if (v.passed !== true) excluded.push({ nn: c.nn, reason: "最新机械校验未过" });
    else if (v.translationSha !== t.sha) excluded.push({ nn: c.nn, reason: "校验 sha 与当前译文不符（修复后未重验）" });
    else included.push(c.nn);
  }
  return { included, excluded };
}

// ---------- manifest chunk 原文 sha 列（M6 分母侧） ----------

// status.mjs 的 manifest 解析只取到 KB 列；此处补取行区间 + sha 列（分母完整性判据）。
export function manifestChunkShas(manifestText) {
  const out = [];
  for (const line of manifestText.split("\n")) {
    const m = line.match(/^\| (\d{2,3})(X?) \| (\S+\.md) \| ([\d.]+) \| (\d+)-(\d+) \| ([0-9a-f]{12}) \|$/);
    if (m) out.push({ nn: Number(m[1]), atomic: m[2] === "X", name: m[3], sha: m[7] });
  }
  return out;
}

// ---------- 主流程 ----------

export function runMerge(dir, opts = {}) {
  const inv = scanWorkdir(dir);
  if (inv.errors.length) return { exitCode: 2, errors: inv.errors };
  if (!inv.chunks.length) return { exitCode: 2, errors: ["manifest.md 无 chunk 登记（Step 1 未跑？）"] };

  // M6：NN 连续性（01..N 严格递增——乱序号即损坏）
  const nns = inv.chunks.map((c) => c.nn);
  const gapAt = nns.findIndex((n, i) => n !== i + 1);
  if (gapAt !== -1) {
    return {
      exitCode: 3,
      errors: [`乱序号：manifest 第 ${gapAt + 1} 行 NN=${nn2(nns[gapAt])}，应为 ${nn2(gapAt + 1)}（01..N 严格递增）——重新分段或修复 manifest`],
    };
  }

  // M6：缺 chunk（manifest NN 无译文）/ 多译文（不在 manifest）
  const missing = nns.filter((n) => !inv.translated[n]);
  if (missing.length) {
    return { exitCode: 3, errors: [`缺 chunk：manifest 登记的 ${missing.map(nn2).join(", ")} 无译文文件（translated-chunks/translated-chunk-NN.md）——先补译，绝不静默拼残稿`] };
  }
  const extra = Object.keys(inv.translated).map(Number).filter((n) => !nns.includes(n));
  if (extra.length) {
    return { exitCode: 3, errors: [`多余译文 chunk ${extra.map(nn2).join(", ")}：不在 manifest 登记内——孤儿产物，先清理`] };
  }

  // M6：分母侧 sha（manifest 记录 ↔ chunks/ 实文件）
  const shaRows = manifestChunkShas(inv.manifest);
  const shaBad = [];
  for (const row of shaRows) {
    const p = path.join(dir, "chunks", row.name);
    if (fs.existsSync(p) && fileSha(p) !== row.sha) shaBad.push(row.name);
  }
  if (shaBad.length) {
    return { exitCode: 3, errors: [`sha 不符：manifest 记录与 chunks/ 实文件不一致（${shaBad.join(", ")}）——分母被改动，重跑分段并按内容 sha 对账`] };
  }

  // M6：机械校验依据存在性
  if (!Object.keys(inv.verify).length) {
    return { exitCode: 3, errors: ["verify-results.json 缺失或无任何记录——无机械校验依据，拒绝盲拼（先跑 Step 5）"] };
  }

  // M2：收录集合
  const { included, excluded } = collectSet(inv);
  if (!included.length) {
    return { exitCode: 3, errors: ["收录集为空：无任何 chunk 处于最新机械校验 passed 状态——先过 Step 5", ...excluded.map((e) => `  chunk ${nn2(e.nn)}：${e.reason}`)] };
  }

  // M1/M3/M7：组装（纯函数）
  const { merged, cleared, residues } = assemble(included.map((nn) => ({ nn, text: inv.translated[nn].text })));
  if (residues.length) {
    return {
      exitCode: 4,
      errors: residues.slice(0, 10).map((r) => `«» 残留：chunk ${nn2(r.nn)} 含未裁定标记 ${r.mark}——回 Step 4 裁定后重跑`),
      residues,
    };
  }

  // M4/M5：临时名落盘（字节 = 纯函数输出，无时间戳无随机）
  const mergedPath = path.join(dir, MERGED);
  fs.writeFileSync(mergedPath, merged, "utf-8");

  // M3：清标有记录（events.jsonl 是流水事实源，status.mjs 计数器忽略未知事件类型）
  const mergedSha = sha12(merged);
  appendEvents(dir, {
    ev: "merge",
    included,
    excluded: excluded.map((e) => ({ nn: e.nn, reason: e.reason })),
    clearedMarkers: cleared,
    mergedSha,
    bytes: Buffer.byteLength(merged, "utf-8"),
  });

  return {
    exitCode: 0,
    mergedPath,
    mergedSha,
    included,
    excluded,
    cleared,
    bytes: Buffer.byteLength(merged, "utf-8"),
    result: {
      passed: true,
      summary: `合并完成：收录 ${included.length}/${nns.length} chunk（NN 数值序），清标 ${cleared} 处，产物 ${MERGED}`,
      excluded,
      cleared,
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

const __help = `merge.mjs — xl-translator Step 8 确定性组装（M1c）

用法:
  node merge.mjs <workdir> [--json]

规则（固定判据 M1-M7，见 scripts/test/README.md）:
  - NN 数值序拼接，零改写（无 BOM/EOL 改写/无 "\\n\\n" 插入）
  - 只收"最新机械校验 passed"chunk（verify-results.json 末条记录 passed 且 sha 与译文相符）
  - 非空 «...» 残留即拒绝；空 «» 对机械清除并记录
  - 输入损坏（缺 chunk/乱序号/分母 sha 不符/无校验依据）非零退出，绝不静默拼残稿

产物: <workdir>/merged-draft.md（临时名，不命中任何发布模式）+ events.jsonl 追加 merge 事件
退出码: 0 成功 / 1 用法 / 2 工作目录异常 / 3 输入损坏 / 4 «» 残留`;

// CLI 守卫用 fileURLToPath：new URL().pathname 在 Windows 是 /D:/... 形态，
// path.resolve 会拼出 D:\D:\... 与 argv[1] 恒不等（入口静默空转、退出码 0 的假绿）
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const { pos, opts } = parseArgs(process.argv.slice(2));
  if (opts.help || pos.length < 1) {
    console.log(__help);
    process.exit(pos.length < 1 && !opts.help ? 1 : 0);
  }
  const r = runMerge(pos[0], opts);
  if (r.errors?.length) console.error(`❌ ${r.errors.join("\n  ")}`);
  if (r.result?.summary) console.log(`✅ ${r.result.summary}`);
  for (const e of r.result?.excluded ?? []) console.log(`  ⚠ 排除 chunk ${nn2(e.nn)}：${e.reason}`);
  if (r.result && r.result.cleared > 0) console.log(`  ⚙ 清标：清除空 «» 对 ${r.result.cleared} 处（已记 events.jsonl）`);
  if (opts.json) console.log(JSON.stringify({ ...r, result: undefined, errors: r.errors ?? [] }, null, 2));
  process.exit(r.exitCode);
}
