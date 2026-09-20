"use strict";

// verify-pipeline.js — 过程真实性终检（Step 11① 强制关卡）
//
// 定位：任务结束时由脚本从文件系统事实生成"任务报告"，验证流程的过程真实性，
// 不依赖 LLM 自我汇报。对抗两类已实际发生的失败（2026-08 harness-v2 / abc-legal 事故）：
//   A. 静默跳过：某质检维度整维未执行、无报告产物（abc-legal 形态）
//   B. 伪造通过：批量生成的模板空壳报告（harness-v2 形态：同维度字节级相同、占位符未替换、
//      一分钟内几十份"通过快速审校"）
//
// 单文件模式（v3.0.0 起唯一模式）：译文 = translated-{title}-zh.md 全文一份，
// 工作稿 = translated-draft.md，报告 = review-{dimension}.md。
//
// 七类检查（反伪造骨架，逐项明示）：
//   1. 完备性矩阵（FAIL）：四维审校报告（review-{dimension}.md，Step 5/6/7/9）+ 共享产物
//      （analysis/glossary/keep-list/special-phrases/最终译文/pm-review）。
//      维度级缺失若在 pm-review 合规表有跳过披露（⏭️ SKIPPED(原因) / "跳过"）→ WARN-SKIPPED（合法降级）；
//      未披露 → FAIL（作弊）。
//   2. 占位符检测（FAIL）：报告含未替换的 `Chunk XX`、`{title}` 等模板变量。
//   3. 跨维度查重（FAIL）：四维报告两两字节级比对——一份模板 cp 四份维度报告（harness-v2 主杀器；
//      真独立审校不可能字节级一致）。
//   4. 尺寸下限（FAIL）：报告字节数 < max(200, 原文整篇字节/25)——基准 = 原文整篇。
//   5. 批量写入签名（WARN）：四维报告全部落在同一 60 秒窗口（串行独立 subagent 物理上做不到；
//      阈值 ≥3——一维合法降级后 3 份同窗仍是伪造形态）。
//   6. 时序一致性（WARN）：审校报告 mtime 早于工作稿 translated-draft.md mtime（= 修复后未重审
//      的信号；最终交付物被 Step 10 重写过，不作比对对象）。
//   7. 机械校验落盘核验（FAIL/可降 WARN）：verify-results.json 中该原文（original-{title}.md）
//      最新记录须 passed=true；无记录文件 → WARN；损坏 → FAIL（评审②-6）。
//      杀"声称已跑"式伪证。+ **零信任重跑（评审 R3-1/R3-2）**：另以当前工作稿 × 原文
//      重跑 verify() 同源校验（mechanical-rerun）——不信 agent 可写的明文记录，
//      手写 passed 记录 / 跑一次真校验后改稿不重跑均被抓（xl final-gate 哲学的最小移植）。
//
// CLI: node verify-pipeline.js <translation-dir> [--stdout]
//   --stdout  只打印报告，不写文件（回放验证用，避免污染现场）
// 输出: <translation-dir>/verify-pipeline-report.md + verify-report.json
// 退出码: 0 = PASS / WARN-SKIPPED；1 = FAIL；2 = 用法错误

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { verify, loadKeepList } = require("./verify-mechanical.js");

function safeRead(p) {
  try {
    return fs.readFileSync(p, "utf-8");
  } catch (_e) {
    return null;
  }
}

const DIMENSIONS = [
  { key: "translation", label: "准确性(Step5)", keywords: /准确性|translation|step\s*5/i },
  { key: "translationese", label: "翻译腔(Step6)", keywords: /翻译腔|translationese|step\s*6/i },
  { key: "ai-tone", label: "AI味(Step7)", keywords: /ai\s*味|ai-tone|step\s*7/i },
  { key: "readability", label: "可读性(Step9)", keywords: /可读性|readability|step\s*9/i },
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

// 从 pm-review 提取已披露跳过的维度集合。
// 兼容两种格式：新标准 `⏭️ SKIPPED(原因)`；旧自由文本（含"跳过"字样 + Step 范围如 "Step 5-7"）。
// 否定句不是披露（评审②-7）："未跳过/没有跳过"无 ⏭️/SKIPPED 标记时不计——一句反话不能换合法降级。
function disclosedSkipDims(pmReviewText) {
  if (!pmReviewText) return new Set();
  const disclosed = new Set();
  const stepToDim = { 5: "translation", 6: "translationese", 7: "ai-tone", 9: "readability" };
  for (const line of pmReviewText.split(/\r?\n/)) {
    if (!SKIP_LINE_RE.test(line)) continue;
    if (!/⏭️|SKIPPED/i.test(line) && /(未|没有|不曾)跳过/.test(line)) continue;
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
  const summary = { dims: {}, shared: [] };
  const title = discoverTitle(dir);
  if (!title) {
    fails.push({ check: "scene", message: "目录中找不到 original-{title}.md，不是有效的 translation 目录" });
    return { title: null, dir, fails, warns, skippedDims: new Set(), summary };
  }

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

  // 判定对象：原文整篇（尺寸下限基准）与工作稿（时序基准）
  const singleOriginalPath = path.join(dir, `original-${title}.md`);
  const draftPath = path.join(dir, "translated-draft.md");
  const crossDimMtimes = []; // 批量写入签名对象（四维报告同窗）
  // 工作稿是时序与机械校验重跑的比对对象——缺失即 FAIL（评审②-11/R3-4：删工作稿不得无声解除这两维）
  if (!fs.existsSync(draftPath)) {
    fails.push({ check: "scene", message: "缺工作稿 translated-draft.md——时序核验与机械校验重跑的比对对象不存在（SKILL Step 10 要求工作稿保留至终检）" });
  }

  // 1+2+4+6：逐维度完备性 + 真实性（每维度一份 review-{dimension}.md）
  for (const dim of DIMENSIONS) {
    const p = path.join(dir, `review-${dim.key}.md`);
    const info = { expected: 1, found: 0, missing: [], placeholder: [], undersize: [], lateWrite: [] };
    if (!fs.existsSync(p)) {
      info.missing.push("全文");
    } else {
      info.found++;
      const content = fs.readFileSync(p, "utf-8");
      const bytes = Buffer.byteLength(content, "utf-8");
      // 占位符
      if (PLACEHOLDER_RE.test(content)) info.placeholder.push("全文");
      // 尺寸下限（基准 = 原文整篇）
      if (fs.existsSync(singleOriginalPath)) {
        const floor = Math.max(200, Math.round(fileBytes(singleOriginalPath) / 25));
        if (bytes < floor) info.undersize.push(`全文(${bytes}B<${floor}B)`);
      }
      // 时序：报告须晚于工作稿 translated-draft.md（最终交付物被 Step 10 重写过不作对象）
      if (fs.existsSync(draftPath) && fs.statSync(p).mtimeMs < fs.statSync(draftPath).mtimeMs - 1000) {
        info.lateWrite.push("全文");
      }
      crossDimMtimes.push(fs.statSync(p).mtimeMs);
    }

    const dimLabel = dim.label;
    if (info.missing.length > 0) {
      if (skippedDims.has(dim.key)) {
        warns.push({ check: "skip-disclosed", message: `${dimLabel}：报告缺失，pm-review 已披露跳过 → 合法降级（WARN）` });
      } else {
        fails.push({ check: "skip-silent", message: `${dimLabel}：报告缺失（${info.missing.join(",")}）且 pm-review 无跳过披露 → 疑似静默跳过/未产出` });
      }
    }
    if (info.placeholder.length > 0) {
      fails.push({ check: "placeholder", message: `${dimLabel}：报告含未替换模板占位符（Chunk XX / {title}）→ 疑似批量伪造` });
    }
    if (info.undersize.length > 0) fails.push({ check: "undersize", message: `${dimLabel} 报告低于尺寸下限：${info.undersize.join(", ")}` });
    if (info.lateWrite.length > 0) warns.push({ check: "chronology", message: `${dimLabel}：${info.lateWrite.join(",")} 的报告时间早于译文（修复后未重审，或同步/搬运误报）` });
    summary.dims[dim.key] = info;
  }

  // 5. 批量写入签名（评审 R3-5：阈值 ≥3——一维合法降级后 3 份同窗仍是伪造形态）
  if (crossDimMtimes.length >= 3) {
    crossDimMtimes.sort((a, b) => a - b);
    const last = crossDimMtimes[crossDimMtimes.length - 1];
    const first = crossDimMtimes[0];
    if (last - first <= 60_000) {
      warns.push({ check: "mass-write", message: `${crossDimMtimes.length} 份审校报告全部落在同一 60 秒窗口内，串行独立 subagent 物理上做不到 → 请人工核查` });
    }
  }

  // 3. 跨维度查重（评审 R3-3：harness-v2 主杀器——一份模板 cp 四份维度报告；
  // 真独立审校不可能字节级一致）
  {
    const crossHashes = new Map();
    for (const dim of DIMENSIONS) {
      const p = path.join(dir, `review-${dim.key}.md`);
      if (!fs.existsSync(p)) continue;
      const h = md5(p);
      if (!crossHashes.has(h)) crossHashes.set(h, []);
      crossHashes.get(h).push(`review-${dim.key}.md`);
    }
    for (const [, names] of crossHashes) {
      if (names.length > 1) fails.push({ check: "duplicate", message: `跨维度报告内容字节级相同：${names.join("、")}——真实独立审校不可能字节级一致 → 疑似一份模板复制` });
    }
  }

  // 7. 机械校验落盘核验 + 零信任重跑
  const vrPath = path.join(dir, "verify-results.json");
  if (fs.existsSync(vrPath)) {
    try {
      const entries = JSON.parse(fs.readFileSync(vrPath, "utf-8"));
      const latest = new Map(); // 原文文件名 → 最新记录
      for (const e of entries) latest.set(String(e.original || ""), e);
      let e = latest.get(`original-${title}.md`);
      if (!e) { // 大小写变体兜底（评审②-12）：记录键 = 原文件名字节
        for (const [k, v] of latest) {
          if (k.toLowerCase() === `original-${title}.md`.toLowerCase()) { e = v; break; }
        }
      }
      const notPassed = [];
      if (!e) notPassed.push("全文(无记录)");
      else if (!e.passed) notPassed.push(`全文(FAIL:${(e.failChecks || []).join("/")})`);
      if (notPassed.length > 0) {
        fails.push({ check: "mechanical-log", message: `verify-mechanical 落盘记录不闭环：${notPassed.join(",")}` });
      }
    } catch (_e) {
      // 评审②-6：损坏即 FAIL——"把失败记录损坏化以降级终判"不得是一条通路
      fails.push({ check: "mechanical-log", message: "verify-results.json 存在但不可解析（损坏/非数组）——记录链断裂，须重建后重跑 Step 4.6" });
    }
  } else {
    warns.push({ check: "mechanical-log", message: "无 verify-results.json 落盘记录（机械校验未落盘），无法交叉核验 pm-review 的\"已通过\"声明" });
  }

  // 评审 R3-1/R3-2：机械校验腿零信任化——直接重跑 verify()（xl final-gate 哲学的最小移植）。
  // 只信"当前工作稿 × 原文"的重执行结果，不信 agent 可写的明文记录：
  // 手写 passed 记录、跑一次真校验后改稿不重跑（T2b 零信号通道）均在此被抓。
  {
    const draftText = safeRead(draftPath);
    const origText = safeRead(singleOriginalPath);
    if (draftText != null && origText != null) {
      let keepList = null;
      const klPath = path.join(dir, `keep-list-${title}.json`);
      if (fs.existsSync(klPath)) {
        try { keepList = loadKeepList(klPath); } catch (_e) { keepList = null; }
      }
      const rerun = verify(origText, draftText, { keepList });
      if (!rerun.passed) {
        fails.push({
          check: "mechanical-rerun",
          message: `终检重跑机械校验未过（${rerun.fails.length} 项）：${rerun.fails.slice(0, 3).map((f) => `[${f.check}] ${f.message}`).join("；")}${rerun.fails.length > 3 ? " …" : ""}——判以当前工作稿为准，改稿后须重跑 Step 4.6`,
        });
      }
      for (const w of rerun.warns) warns.push({ check: "mechanical-rerun", message: w });
    }
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

检查: 完备性矩阵 / 模板占位符 / 跨维度查重 / 尺寸下限 / 批量写入签名 / 时序 / 机械校验落盘
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
      JSON.stringify({ title: result.title, dir: result.dir, generatedAt: new Date().toISOString(), verdict, fails: result.fails, warns: result.warns, skippedDims: [...result.skippedDims], summary: { shared: result.summary.shared } }, null, 2),
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

module.exports = { analyze, buildReport, discoverTitle, disclosedSkipDims, DIMENSIONS };
