"use strict";

// verify-pipeline.js — 过程真实性终检（Step 12 强制关卡）
//
// 定位：任务结束时由脚本从文件系统事实生成"任务报告"，验证 12 步流程的过程真实性，
// 不依赖 LLM 自我汇报。对抗两类已实际发生的失败（2026-08 harness-v2 / abc-legal 事故）：
//   A. 静默跳过：某质检维度整维未执行、无报告产物（abc-legal 形态）
//   B. 伪造通过：批量生成的模板空壳报告（harness-v2 形态：同维度字节级相同、占位符未替换、
//      一分钟内几十份"通过快速审校"）
//
// 七类检查：
//   1. 完备性矩阵（FAIL）：按 chunks 清单枚举应存在产物——每 chunk 译文 + 四维审校报告
//      （Step 5/6/7/9）+ 共享产物（analysis/glossary/keep-list/special-phrases/最终译文/pm-review）。
//      维度级缺失若在 pm-review 合规表有跳过披露（⏭️ SKIPPED(原因) / "跳过"）→ WARN-SKIPPED（合法降级）；
//      未披露 → FAIL（作弊）。
//   2. 占位符检测（FAIL）：报告含未替换的 `Chunk XX`、`{title}` 等模板变量。
//   3. 同维度查重（FAIL）：同维度报告 MD5 相同（不同 chunk 的真实审校不可能字节级一致）。
//   4. 尺寸下限（FAIL）：报告字节数 < max(200, 对应原文 chunk 字节/25)。
//   5. 批量写入签名（WARN）：同维度 ≥5 份报告 mtime 落在同一 60 秒窗口（物理上不可能是独立 subagent）。
//   6. 时序一致性（WARN）：审校报告 mtime 早于对应译文 mtime（先有译文才能审校；同步/搬运会造成误报，故仅 WARN）。
//   7. 机械校验落盘核验（FAIL/可降 WARN）：verify-results.json 中每 chunk 最新记录须 passed=true；
//      无记录文件 → WARN（旧运行兼容）。杀"声称 verify-mechanical 已跑"式伪证。
//
// CLI: node verify-pipeline.js <translation-dir> [--stdout]
//   --stdout  只打印报告，不写文件（回放验证用，避免污染现场）
// 输出: <translation-dir>/verify-pipeline-report.md + verify-report.json
// 退出码: 0 = PASS / WARN-SKIPPED；1 = FAIL；2 = 用法错误

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DIMENSIONS = [
  { key: "translation", file: "review-translation-chunk", label: "准确性(Step5)", keywords: /准确性|translation|step\s*5/i },
  { key: "translationese", file: "review-translationese-chunk", label: "翻译腔(Step6)", keywords: /翻译腔|translationese|step\s*6/i },
  { key: "ai-tone", file: "review-ai-tone-chunk", label: "AI味(Step7)", keywords: /ai\s*味|ai-tone|step\s*7/i },
  { key: "readability", file: "review-readability-chunk", label: "可读性(Step9)", keywords: /可读性|readability|step\s*9/i },
];

const PLACEHOLDER_RE = /Chunk XX|\{title\}|\{nn\}|\{dimension\}/i;
const SKIP_LINE_RE = /⏭️|SKIPPED|跳过/i;

// ---------- 场景发现 ----------

function discoverTitle(dir) {
  const files = fs.readdirSync(dir);
  const m = files.find((f) => /^original-(.+)\.md$/i.test(f));
  if (!m) return null;
  return m.replace(/^original-(.+)\.md$/i, "$1");
}

function loadChunks(dir) {
  const chunks = [];
  const progPath = path.join(dir, "chunks", "progress.json");
  if (fs.existsSync(progPath)) {
    try {
      const prog = JSON.parse(fs.readFileSync(progPath, "utf-8"));
      for (const c of prog.pending || []) {
        if (c.index != null) chunks.push({ nn: String(c.index).padStart(2, "0"), filename: c.filename });
      }
    } catch (_e) { /* fall through to glob */ }
  }
  if (chunks.length === 0) {
    const chunkDir = path.join(dir, "chunks");
    if (fs.existsSync(chunkDir)) {
      for (const f of fs.readdirSync(chunkDir)) {
        const m = f.match(/^chunk-(\d+)-/);
        if (m) chunks.push({ nn: m[1].padStart(2, "0"), filename: f });
      }
    }
  }
  chunks.sort((a, b) => a.nn.localeCompare(b.nn));
  return chunks;
}

// 从 pm-review 提取已披露跳过的维度集合。
// 兼容两种格式：新标准 `⏭️ SKIPPED(原因)`；旧自由文本（含"跳过"字样 + Step 范围如 "Step 5-7"）。
function disclosedSkipDims(pmReviewText) {
  if (!pmReviewText) return new Set();
  const disclosed = new Set();
  const stepToDim = { 5: "translation", 6: "translationese", 7: "ai-tone", 9: "readability" };
  for (const line of pmReviewText.split(/\r?\n/)) {
    if (!SKIP_LINE_RE.test(line)) continue;
    for (const dim of DIMENSIONS) {
      if (dim.keywords.test(line)) disclosed.add(dim.key);
    }
    // Step 区间（如 "Step 5-7"）：命中区间即视为区间内所有已知 step 均披露
    const range = line.match(/step\s*(\d+)\s*[-–~]\s*(\d+)/i);
    if (range) {
      const lo = parseInt(range[1], 10);
      const hi = parseInt(range[2], 10);
      for (let s = lo; s <= hi; s++) {
        if (stepToDim[s]) disclosed.add(stepToDim[s]);
      }
    }
  }
  return disclosed;
}

// ---------- 检查器 ----------

function md5(p) {
  return crypto.createHash("md5").update(fs.readFileSync(p)).digest("hex");
}

function fileBytes(p) {
  return fs.statSync(p).size;
}

function analyze(dir) {
  const fails = [];
  const warns = [];
  const summary = { chunks: 0, dims: {}, shared: [] };
  const title = discoverTitle(dir);
  if (!title) {
    fails.push({ check: "scene", message: "目录中找不到 original-{title}.md，不是有效的 translation 目录" });
    return { title: null, dir, fails, warns, skippedDims: new Set(), summary };
  }
  const chunks = loadChunks(dir);
  if (chunks.length === 0) {
    fails.push({ check: "scene", message: "chunks/ 下无 chunk 清单（progress.json 与文件名均未发现）" });
  }
  summary.chunks = chunks.length;

  // 共享产物
  const sharedExpected = [
    `analysis-${title}.md`,
    `glossary-${title}.md`,
    `keep-list-${title}.json`,
    `special-phrases-${title}.md`,
    `translated-${title}-zh.md`,
    `pm-review-${title}.md`,
  ];
  for (const name of sharedExpected) {
    let found = fs.existsSync(path.join(dir, name));
    if (!found && name.startsWith("translated-")) found = fs.existsSync(path.join(dir, "..", name)); // 交付文件放在父目录的变体
    if (found) summary.shared.push(name);
    else fails.push({ check: "shared", message: `共享产物缺失：${name}` });
  }

  // pm-review 披露
  const pmPath = path.join(dir, `pm-review-${title}.md`);
  const pmText = fs.existsSync(pmPath) ? fs.readFileSync(pmPath, "utf-8") : null;
  const skippedDims = disclosedSkipDims(pmText);

  // 1+2+3+4+6：逐维度完备性 + 真实性
  for (const dim of DIMENSIONS) {
    const info = { expected: chunks.length, found: 0, missing: [], placeholder: [], duplicates: [], undersize: [], lateWrite: [] };
    const hashes = new Map();
    const mtimes = [];
    for (const c of chunks) {
      const p = path.join(dir, `${dim.file}-${c.nn}.md`);
      if (!fs.existsSync(p)) {
        info.missing.push(c.nn);
        continue;
      }
      info.found++;
      const content = fs.readFileSync(p, "utf-8");
      const bytes = Buffer.byteLength(content, "utf-8");
      // 占位符
      if (PLACEHOLDER_RE.test(content)) info.placeholder.push(c.nn);
      // 查重
      const h = md5(p);
      if (!hashes.has(h)) hashes.set(h, []);
      hashes.get(h).push(c.nn);
      // 尺寸下限（相对原文 chunk）
      const chunkPath = path.join(dir, "chunks", c.filename || "");
      if (fs.existsSync(chunkPath)) {
        const floor = Math.max(200, Math.round(fileBytes(chunkPath) / 25));
        if (bytes < floor) info.undersize.push(`${c.nn}(${bytes}B<${floor}B)`);
        // 时序：报告须晚于译文
        const translatedPath = path.join(dir, "translated-chunks", `translated-chunk-${c.nn}.md`);
        if (fs.existsSync(translatedPath) && fs.statSync(p).mtimeMs < fs.statSync(translatedPath).mtimeMs - 1000) {
          info.lateWrite.push(c.nn);
        }
      }
      mtimes.push(fs.statSync(p).mtimeMs);
    }
    // 查重汇总
    for (const [h, nns] of hashes) if (nns.length > 1) info.duplicates.push(`${nns.length}×${nns.join(",")}`);
    // 批量写入：60s 滑动窗口 ≥5 份
    mtimes.sort((a, b) => a - b);
    let massWrite = false;
    for (let i = 0; i + 4 < mtimes.length; i++) {
      if (mtimes[i + 4] - mtimes[i] <= 60_000) { massWrite = true; break; }
    }

    const dimLabel = dim.label;
    if (info.missing.length > 0) {
      if (skippedDims.has(dim.key)) {
        warns.push({ check: "skip-disclosed", message: `${dimLabel}：${info.missing.length}/${chunks.length} 份报告缺失，pm-review 已披露跳过 → 合法降级（WARN）` });
      } else {
        fails.push({ check: "skip-silent", message: `${dimLabel}：${info.missing.length}/${chunks.length} 份报告缺失（${info.missing.join(",")}）且 pm-review 无跳过披露 → 疑似静默跳过/未产出` });
      }
    }
    if (info.placeholder.length > 0) {
      fails.push({ check: "placeholder", message: `${dimLabel}：${info.placeholder.length} 份报告含未替换模板占位符（Chunk XX / {title}）：chunk ${info.placeholder.join(",")} → 疑似批量伪造` });
    }
    if (info.duplicates.length > 0) fails.push({ check: "duplicate", message: `${dimLabel} 报告内容字节级重复：${info.duplicates.join("；")} → 疑似批量伪造` });
    if (info.undersize.length > 0) fails.push({ check: "undersize", message: `${dimLabel} 报告低于尺寸下限：${info.undersize.join(", ")}` });
    if (massWrite) warns.push({ check: "mass-write", message: `${dimLabel}：≥5 份报告落在同一 60 秒窗口内，物理上不可能是独立 subagent 审校 → 请人工核查` });
    if (info.lateWrite.length > 0) warns.push({ check: "chronology", message: `${dimLabel}：chunk ${info.lateWrite.join(",")} 的报告时间早于译文（同步/搬运可能误报）` });
    summary.dims[dim.key] = info;
  }

  // 译文 chunk 完备性（无披露豁免——译文本体缺失必 FAIL）
  const missingTranslated = chunks.filter((c) => !fs.existsSync(path.join(dir, "translated-chunks", `translated-chunk-${c.nn}.md`)));
  if (missingTranslated.length > 0) {
    fails.push({ check: "translated-missing", message: `译文 chunk 缺失：${missingTranslated.map((c) => c.nn).join(",")}` });
  }

  // 7. 机械校验落盘核验
  const vrPath = path.join(dir, "verify-results.json");
  if (fs.existsSync(vrPath)) {
    try {
      const entries = JSON.parse(fs.readFileSync(vrPath, "utf-8"));
      const latest = new Map(); // original chunk 文件名 → 最新记录
      for (const e of entries) {
        const key = String(e.original || "").replace(/^chunk-(\d+)-.*$/, "$1");
        latest.set(key, e);
      }
      const notPassed = [];
      for (const c of chunks) {
        const e = latest.get(c.nn);
        if (!e) notPassed.push(`${c.nn}(无记录)`);
        else if (!e.passed) notPassed.push(`${c.nn}(FAIL:${(e.failChecks || []).join("/")})`);
      }
      if (notPassed.length > 0) {
        fails.push({ check: "mechanical-log", message: `verify-mechanical 落盘记录不闭环：${notPassed.join(",")}` });
      }
    } catch (_e) {
      warns.push({ check: "mechanical-log", message: "verify-results.json 解析失败（忽略）" });
    }
  } else {
    warns.push({ check: "mechanical-log", message: "无 verify-results.json 落盘记录（旧版本运行或机械校验未落盘），无法交叉核验 pm-review 的\"已通过\"声明" });
  }

  return { title, dir, fails, warns, skippedDims, summary };
}

// ---------- 报告 ----------

function buildReport(result) {
  const { title, dir, fails, warns, skippedDims, summary } = result;
  const verdict = fails.length > 0 ? "FAIL" : skippedDims.size > 0 ? "WARN-SKIPPED" : "PASS";
  const lines = [];
  lines.push(`# 过程真实性终检报告：${title || "(未知)"}`);
  lines.push("");
  lines.push(`- **目录**：${dir}`);
  lines.push(`- **生成时间**：${new Date().toISOString()}`);
  lines.push(`- **chunks**：${summary.chunks}`);
  lines.push(`- **终判**：${verdict}`);
  lines.push("");
  lines.push("## ① 完备性矩阵（按维度汇总）");
  lines.push("");
  lines.push("| 维度 | 应查 | 实有 | 缺失 | 披露跳过 |");
  lines.push("|---|---|---|---|---|");
  for (const dim of DIMENSIONS) {
    const info = summary.dims[dim.key];
    if (!info) { lines.push(`| ${dim.label} | - | - | - | - |`); continue; }
    lines.push(`| ${dim.label} | ${info.expected} | ${info.found} | ${info.missing.length} | ${skippedDims.has(dim.key) ? "是" : "否"} |`);
  }
  lines.push(`| 共享产物 | ${6} | ${summary.shared.length} | ${6 - summary.shared.length} | - |`);
  lines.push("");
  if (fails.length > 0) {
    lines.push("## ❌ FAIL（阻断交付）");
    lines.push("");
    for (const f of fails) lines.push(`- **[${f.check}]** ${f.message}`);
    lines.push("");
  }
  if (warns.length > 0) {
    lines.push("## ⚠ WARN（需人工过目）");
    lines.push("");
    for (const w of warns) lines.push(`- **[${w.check}]** ${w.message}`);
    lines.push("");
  }
  lines.push("---");
  lines.push(`终判依据：FAIL=存在未披露缺失/伪造签名；WARN-SKIPPED=仅有已披露的维度跳过；PASS=过程完整（可含警告）。`);
  lines.push(`本报告由 verify-pipeline.js 从文件系统事实生成，可被用户独立复核：node verify-pipeline.js "${dir}"`);
  return { verdict, text: lines.join("\n") };
}

// ---------- CLI ----------

function runCli(args) {
  const dir = args.find((a) => !a.startsWith("--"));
  const stdoutOnly = args.includes("--stdout");
  if (!dir || args.includes("-h") || args.includes("--help")) {
    console.log(`verify-pipeline.js — 过程真实性终检

用法:
  node verify-pipeline.js <translation-dir> [--stdout]

检查: 完备性矩阵 / 模板占位符 / 同维度查重 / 尺寸下限 / 批量写入签名 / 时序 / 机械校验落盘
输出: verify-pipeline-report.md + verify-report.json（--stdout 时只打印不写盘）
退出码: 0 = PASS/WARN-SKIPPED, 1 = FAIL, 2 = 用法错误`);
    process.exit(dir ? 0 : 2);
  }
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    console.error(`❌ 目录不存在：${dir}`);
    process.exit(2);
  }
  const result = analyze(path.resolve(dir));
  const { verdict, text } = buildReport(result);
  if (stdoutOnly) {
    console.log(text);
  } else {
    fs.writeFileSync(path.join(result.dir, "verify-pipeline-report.md"), text, "utf-8");
    fs.writeFileSync(
      path.join(result.dir, "verify-report.json"),
      JSON.stringify({ title: result.title, dir: result.dir, generatedAt: new Date().toISOString(), verdict, fails: result.fails, warns: result.warns, skippedDims: [...result.skippedDims], summary: { chunks: result.summary.chunks, shared: result.summary.shared } }, null, 2),
      "utf-8"
    );
    console.log(text);
    console.log(`\n报告已写入：${path.join(result.dir, "verify-pipeline-report.md")}`);
  }
  process.exit(verdict === "FAIL" ? 1 : 0);
}

if (require.main === module) {
  runCli(process.argv.slice(2));
}

module.exports = { analyze, buildReport, discoverTitle, loadChunks, disclosedSkipDims, DIMENSIONS };
