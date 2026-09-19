"use strict";

// verify-pipeline.js — 过程真实性终检（Step 12 强制关卡）
//
// 定位：任务结束时由脚本从文件系统事实生成"任务报告"，验证流程的过程真实性，
// 不依赖 LLM 自我汇报。对抗两类已实际发生的失败（2026-08 harness-v2 / abc-legal 事故）：
//   A. 静默跳过：某质检维度整维未执行、无报告产物（abc-legal 形态）
//   B. 伪造通过：批量生成的模板空壳报告（harness-v2 形态：同维度字节级相同、占位符未替换、
//      一分钟内几十份"通过快速审校"）
//
// 双模式（v3.0.0）：目录无 chunks/ → **单文件模式**（译文 = translated-{title}-zh.md 全文一份，
// 工作稿 = translated-draft.md，报告 = review-{dimension}.md）；有 chunks/ → 旧多 chunk 模式
// （仅供存量工程回放核验，v3.0.0 起不再产生该结构——见 SKILL.md 旧结构披露）。
//
// 七类检查在单文件模式下的去留（反伪造骨架保留，逐项明示）：
//   1. 完备性矩阵（FAIL）：四维审校报告（review-{dimension}.md，Step 5/6/7/9）+ 共享产物
//      （analysis/glossary/keep-list/special-phrases/最终译文/pm-review）。
//      维度级缺失若在 pm-review 合规表有跳过披露（⏭️ SKIPPED(原因) / "跳过"）→ WARN-SKIPPED（合法降级）；
//      未披露 → FAIL（作弊）。【保留】
//   2. 占位符检测（FAIL）：报告含未替换的 `Chunk XX`、`{title}` 等模板变量。【保留】
//   3. 同维度查重（FAIL）：单文件下每维度仅一份报告，无跨单元比对对象 → 自动不触发
//      （代码保留，旧多 chunk 回放时仍生效）。
//   4. 尺寸下限（FAIL）：报告字节数 < max(200, 原文整篇字节/25)——判定对象从 chunk 换成整篇。【保留】
//   5. 批量写入签名（WARN）：单文件下改判"四维报告全部落在同一 60 秒窗口"（串行独立 subagent
//      物理上做不到）；旧模式维持同维度 ≥5 份同窗。【保留，对象重定义】
//   6. 时序一致性（WARN）：审校报告 mtime 早于工作稿 translated-draft.md mtime（= 修复后未重审
//      的信号；最终交付物被 Step 10 重写过，不作比对对象）。【保留，对象换工作稿】
//   7. 机械校验落盘核验（FAIL/可降 WARN）：verify-results.json 中该原文（original-{title}.md）
//      最新记录须 passed=true；无记录文件 → WARN（旧运行兼容）；损坏 → FAIL（评审②-6）。
//      杀"声称已跑"式伪证。【保留】+ **单文件模式零信任重跑（评审 R3-1/R3-2）**：另以当前
//      工作稿 × 原文重跑 verify() 同源校验（mechanical-rerun）——不信 agent 可写的明文记录，
//      手写 passed 记录 / 跑一次真校验后改稿不重跑均被抓。信任边界披露：旧 chunk 回放模式
//      仍"信落盘记录"（回放兼容；xl final-gate 的"重执行一切"哲学只在单文件模式最小移植）。
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
  const summary = { mode: null, chunks: 0, dims: {}, shared: [] };
  const title = discoverTitle(dir);
  if (!title) {
    fails.push({ check: "scene", message: "目录中找不到 original-{title}.md，不是有效的 translation 目录" });
    return { title: null, dir, fails, warns, skippedDims: new Set(), summary };
  }
  const chunks = loadChunks(dir);
  // 模式判定（评审②-8）：以 chunks/ 内有无 chunk 证据为准——空目录/清单损坏回落单文件模式并 WARN
  const single = chunks.length === 0;
  if (single && fs.existsSync(path.join(dir, "chunks"))) {
    warns.push({ check: "mode", message: "chunks/ 目录存在但无 chunk 证据（空目录或清单损坏）——按单文件模式核验，请人工确认是否旧结构残留" });
  }
  summary.mode = single ? "single" : "chunk";
  summary.chunks = single ? 1 : chunks.length;

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

  // 单文件模式的判定对象：原文整篇（尺寸下限基准）与工作稿（时序基准）
  const singleOriginalPath = path.join(dir, `original-${title}.md`);
  const draftPath = path.join(dir, "translated-draft.md");
  const crossDimMtimes = []; // 单文件模式批量写入签名对象（四维报告同窗）
  // 工作稿是时序与机械校验重跑的比对对象——缺失即 FAIL（评审②-11/R3-4：删工作稿不得无声解除这两维）
  if (single && !fs.existsSync(draftPath)) {
    fails.push({ check: "scene", message: "缺工作稿 translated-draft.md——时序核验与机械校验重跑的比对对象不存在（SKILL Step 10 要求工作稿保留至终检）" });
  }

  // 1+2+3+4+6：逐维度完备性 + 真实性
  for (const dim of DIMENSIONS) {
    const units = single ? [null] : chunks.map((c) => c.nn);
    const info = { expected: units.length, found: 0, missing: [], placeholder: [], duplicates: [], undersize: [], lateWrite: [] };
    const hashes = new Map();
    const mtimes = [];
    for (const nn of units) {
      const p = single ? path.join(dir, `review-${dim.key}.md`) : path.join(dir, `${dim.file}-${nn}.md`);
      if (!fs.existsSync(p)) {
        info.missing.push(single ? "全文" : nn);
        continue;
      }
      info.found++;
      const content = fs.readFileSync(p, "utf-8");
      const bytes = Buffer.byteLength(content, "utf-8");
      // 占位符
      if (PLACEHOLDER_RE.test(content)) info.placeholder.push(single ? "全文" : nn);
      // 查重（单文件每维一份，无跨单元对象——代码保留供旧结构回放）
      const h = md5(p);
      if (!hashes.has(h)) hashes.set(h, []);
      hashes.get(h).push(single ? "全文" : nn);
      // 尺寸下限（相对原文：单文件=整篇；旧模式=对应 chunk）
      const basisPath = single ? singleOriginalPath : path.join(dir, "chunks", chunks.find((c) => c.nn === nn)?.filename || "");
      if (fs.existsSync(basisPath)) {
        const floor = Math.max(200, Math.round(fileBytes(basisPath) / 25));
        if (bytes < floor) info.undersize.push(`${single ? "全文" : nn}(${bytes}B<${floor}B)`);
      }
      // 时序：报告须晚于译文（单文件比对工作稿 translated-draft.md——最终交付物被 Step 10 重写过不作对象）
      const translatedPath = single ? draftPath : path.join(dir, "translated-chunks", `translated-chunk-${nn}.md`);
      if (fs.existsSync(translatedPath) && fs.statSync(p).mtimeMs < fs.statSync(translatedPath).mtimeMs - 1000) {
        info.lateWrite.push(single ? "全文" : nn);
      }
      mtimes.push(fs.statSync(p).mtimeMs);
      if (single) crossDimMtimes.push(fs.statSync(p).mtimeMs);
    }
    // 查重汇总
    for (const [h, nns] of hashes) if (nns.length > 1) info.duplicates.push(`${nns.length}×${nns.join(",")}`);
    // 批量写入：旧模式 = 同维度 60s 窗口 ≥5 份；单文件 = 四维报告全落同一 60s 窗（crossDimMtimes 于文末判）
    mtimes.sort((a, b) => a - b);
    let massWrite = false;
    for (let i = 0; i + 4 < mtimes.length; i++) {
      if (mtimes[i + 4] - mtimes[i] <= 60_000) { massWrite = true; break; }
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
    if (info.duplicates.length > 0) fails.push({ check: "duplicate", message: `${dimLabel} 报告内容字节级重复：${info.duplicates.join("；")} → 疑似批量伪造` });
    if (info.undersize.length > 0) fails.push({ check: "undersize", message: `${dimLabel} 报告低于尺寸下限：${info.undersize.join(", ")}` });
    if (massWrite) warns.push({ check: "mass-write", message: `${dimLabel}：≥5 份报告落在同一 60 秒窗口内，物理上不可能是独立 subagent 审校 → 请人工核查` });
    if (info.lateWrite.length > 0) warns.push({ check: "chronology", message: `${dimLabel}：${info.lateWrite.join(",")} 的报告时间早于译文（修复后未重审，或同步/搬运误报）` });
    summary.dims[dim.key] = info;
  }

  // 单文件批量写入签名（评审 R3-5：阈值 ≥3——一维合法降级后 3 份同窗仍是伪造形态）
  if (single && crossDimMtimes.length >= 3) {
    crossDimMtimes.sort((a, b) => a - b);
    const last = crossDimMtimes[crossDimMtimes.length - 1];
    const first = crossDimMtimes[0];
    if (last - first <= 60_000) {
      warns.push({ check: "mass-write", message: `${crossDimMtimes.length} 份审校报告全部落在同一 60 秒窗口内，串行独立 subagent 物理上做不到 → 请人工核查` });
    }
  }

  // 单文件跨维度查重（评审 R3-3：旧模式的 harness-v2 主杀器在单文件下的等价对象——
  // 一份模板 cp 四份维度报告；真独立审校不可能字节级一致）
  if (single) {
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

  // 译文完备性（无披露豁免——译文本体缺失必 FAIL；单文件由共享产物 translated-{title}-zh.md 覆盖）
  if (!single) {
    const missingTranslated = chunks.filter((c) => !fs.existsSync(path.join(dir, "translated-chunks", `translated-chunk-${c.nn}.md`)));
    if (missingTranslated.length > 0) {
      fails.push({ check: "translated-missing", message: `译文 chunk 缺失：${missingTranslated.map((c) => c.nn).join(",")}` });
    }
  }

  // 7. 机械校验落盘核验 + 单文件零信任重跑
  const vrPath = path.join(dir, "verify-results.json");
  if (fs.existsSync(vrPath)) {
    try {
      const entries = JSON.parse(fs.readFileSync(vrPath, "utf-8"));
      const latest = new Map(); // 原文文件名（chunk 模式归约为 NN）→ 最新记录
      for (const e of entries) {
        const key = String(e.original || "").replace(/^chunk-(\d+)-.*$/, "$1");
        latest.set(key, e);
      }
      const notPassed = [];
      if (single) {
        let e = latest.get(`original-${title}.md`);
        if (!e) { // 大小写变体兜底（评审②-12）：记录键 = 原文件名字节
          for (const [k, v] of latest) {
            if (k.toLowerCase() === `original-${title}.md`.toLowerCase()) { e = v; break; }
          }
        }
        if (!e) notPassed.push("全文(无记录)");
        else if (!e.passed) notPassed.push(`全文(FAIL:${(e.failChecks || []).join("/")})`);
      } else {
        for (const c of chunks) {
          const e = latest.get(c.nn);
          if (!e) notPassed.push(`${c.nn}(无记录)`);
          else if (!e.passed) notPassed.push(`${c.nn}(FAIL:${(e.failChecks || []).join("/")})`);
        }
      }
      if (notPassed.length > 0) {
        fails.push({ check: "mechanical-log", message: `verify-mechanical 落盘记录不闭环：${notPassed.join(",")}` });
      }
    } catch (_e) {
      // 评审②-6：损坏即 FAIL——"把失败记录损坏化以降级终判"不得是一条通路
      fails.push({ check: "mechanical-log", message: "verify-results.json 存在但不可解析（损坏/非数组）——记录链断裂，须重建后重跑 Step 4.6" });
    }
  } else {
    warns.push({ check: "mechanical-log", message: "无 verify-results.json 落盘记录（旧版本运行或机械校验未落盘），无法交叉核验 pm-review 的\"已通过\"声明" });
  }

  // 评审 R3-1/R3-2：机械校验腿零信任化——单文件模式直接重跑 verify()（xl final-gate 哲学的
  // 最小移植）。只信"当前工作稿 × 原文"的重执行结果，不信 agent 可写的明文记录：
  // 手写 passed 记录、跑一次真校验后改稿不重跑（T2b 零信号通道）均在此被抓。
  // 旧 chunk 回放模式维持"信落盘记录"边界（回放兼容，见文件头披露）。
  if (single) {
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
  lines.push(`- **模式**：${summary.mode === "single" ? "单文件（v3.0.0，全文 1 单元）" : "旧多 chunk（回放核验）"}`);
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
      JSON.stringify({ title: result.title, dir: result.dir, generatedAt: new Date().toISOString(), verdict, fails: result.fails, warns: result.warns, skippedDims: [...result.skippedDims], summary: { mode: result.summary.mode, chunks: result.summary.chunks, shared: result.summary.shared } }, null, 2),
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
