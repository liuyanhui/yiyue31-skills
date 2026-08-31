// verify-mech.test.mjs — verify-mech.mjs 单元测试（node --test，文件内默认串行，符合低内存纪律）
//
// 覆盖：
//   - 原五项硬判的通过/打回（fork 源行为继承）
//   - fork 源对照测试：同一夹具上本脚本与 yiyue31-translator/scripts/verify-mechanical.js 判定一致
//   - 新四项各有单测：数字保真 / 散文残留英文 / 中英间距 / 防空洞化
//   - CLI 冒烟：退出码 / --json / verify-results.json 落盘（含 _note 与译文 sha）/ brief 阈值生效
//
// 运行：node --test scripts/verify-mech.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

import { verify, parseBrief, numberVariants, extractNumbers, englishRuns, spacingViolations, paragraphUnits, stripMechanical } from "./verify-mech.mjs";

const require = createRequire(import.meta.url);
// fork 源只读引用（对照测试用；绝不回写）。路径：scripts/ → 上两级到 skills 根 → 兄弟 skill
const forkVerify = require("../../yiyue31-translator/scripts/verify-mechanical.js").verify;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(__dirname, "verify-mech.mjs");

// ---------- 共用夹具 ----------

// 全过基线：五项旧 + 四项新均干净
const O_BASE = `# Architecture Overview

The system verifies integrity before delivery. It supports 1,024 threads with an 85% hit rate. See https://example.com/docs for details.

\`\`\`js
const x = verify(1);
\`\`\`

Use \`verify()\` to check the result.`;

const T_BASE = `# 架构总览

系统在交付前验证完整性。它支持 1,024 个线程，命中率达 85%。详情见 https://example.com/docs 。

\`\`\`js
const x = verify(1);
\`\`\`

用 \`verify()\` 检查结果。`;

const KEEP = { keep: [], properNouns: ["integrity"], abbreviations: [] };

function checksOf(result) {
  return [...new Set(result.fails.map((f) => f.check))];
}

// 对照测试辅助：继承五项的判定须与 fork 源完全一致
function assertForkAgrees(name, o, t, opts = {}) {
  const mine = verify(o, t, opts);
  const fork = forkVerify(o, t, opts);
  assert.equal(mine.passed, fork.passed, `${name}: passed 与 fork 源不一致`);
  const INHERITED = ["code-block", "inline-code", "svg", "url", "keep-list", "marker-residue"];
  assert.deepEqual(
    checksOf(mine).filter((c) => INHERITED.includes(c)).sort(),
    checksOf(fork).sort(),
    `${name}: 继承项 FAIL 集合与 fork 源不一致`
  );
  return mine;
}

// ---------- 原五项（继承不回归） ----------

test("基线夹具全过（无 FAIL 无告警；不带 keepList——integrity 允许译出）", () => {
  const r = verify(O_BASE, T_BASE);
  assert.equal(r.passed, true);
  assert.deepEqual(r.fails, []);
  assert.equal(r.warns.length, 0);
  assertForkAgrees("基线", O_BASE, T_BASE);
});

test("代码块缺失 → code-block FAIL（与 fork 一致）", () => {
  const t = T_BASE.replace(/```js\nconst x = verify\(1\);\n```/, "");
  const r = assertForkAgrees("代码块缺失", O_BASE, t);
  assert.ok(checksOf(r).includes("code-block"));
});

test("行内代码被改动 → inline-code FAIL（与 fork 一致）", () => {
  const t = T_BASE.replace("`verify()`", "`verifyAll()`");
  const r = assertForkAgrees("行内代码误改", O_BASE, t);
  assert.ok(checksOf(r).includes("inline-code"));
});

test("SVG 字节不一致 → svg FAIL（与 fork 一致）", () => {
  const o = `Intro text.\n\n<svg width="10"><rect/></svg>`;
  const t = `引言文本。\n\n<svg width="20"><rect/></svg>`;
  const r = assertForkAgrees("SVG", o, t);
  assert.ok(checksOf(r).includes("svg"));
});

test("URL 缺失 → url FAIL（与 fork 一致）", () => {
  const t = T_BASE.replace("https://example.com/docs", "官方文档");
  const r = assertForkAgrees("URL 缺失", O_BASE, t);
  assert.ok(checksOf(r).includes("url"));
});

test("keep-list 条目被改写 → keep-list FAIL（与 fork 一致）", () => {
  // T_BASE 把 integrity 译成"完整性"，keep-list 要求原样保留
  const r = assertForkAgrees("keep-list", O_BASE, T_BASE, { keepList: KEEP });
  assert.ok(checksOf(r).includes("keep-list"));
});

test("«» 残留 → marker-residue FAIL（与 fork 一致）", () => {
  const t = T_BASE + "\n\n残标 «integrity» 示例。";
  const r = assertForkAgrees("«» 残留", O_BASE, t);
  assert.ok(checksOf(r).includes("marker-residue"));
});

// ---------- 新①：数字保真 ----------

test("数字缺失 → number-fidelity FAIL", () => {
  const o = "The budget is 500 dollars and latency is 200ms per call.";
  const t = "预算与延迟情况如上文所述。";
  const r = verify(o, t);
  assert.equal(r.passed, false);
  assert.ok(checksOf(r).includes("number-fidelity"));
  assert.deepEqual(r.stats.missingNumbers, 2);
});

test("千分位与 % 保真：1,024 / 85% 原样出现 → 过", () => {
  const o = "It supports 1,024 threads with an 85% hit rate.";
  const t = "它支持 1,024 个线程，命中率达 85%。";
  const r = verify(o, t);
  assert.ok(!checksOf(r).includes("number-fidelity"));
});

test("万/亿换算等价：1,000,000 → 100 万 → 过", () => {
  const o = "Total size is 1,000,000 bytes.";
  const t = "总大小为 100 万字节。";
  const r = verify(o, t);
  assert.ok(!checksOf(r).includes("number-fidelity"));
});

test("亿小数换算等价：350,000,000 → 3.5 亿 → 过", () => {
  const o = "Revenue reached 350,000,000 dollars.";
  const t = "营收达 3.5 亿美元。";
  const r = verify(o, t);
  assert.ok(!checksOf(r).includes("number-fidelity"));
});

test("有序列表序号不算数字：1./2. 改「一、二、」→ 过", () => {
  const o = "1. First point\n\n2. Second point";
  const t = "一、第一点\n\n二、第二点";
  const r = verify(o, t);
  assert.equal(r.passed, true);
});

test("numberVariants 等价集", () => {
  const wan = numberVariants("1,000,000");
  assert.ok(wan.includes("100万") && wan.includes("100 万"), wan.join("|"));
  const yi = numberVariants("350,000,000");
  assert.ok(yi.includes("3.5亿") && yi.includes("3.5 亿"), yi.join("|"));
  assert.ok(numberVariants("85%").includes("85%"));
  // % 不放宽：85% 认作 85 等于丢百分号放行，硬判失真
  assert.ok(!numberVariants("85%").includes("85"));
});

// ---------- 新②：散文残留英文 ----------

test("连续英文长 run（≥6 词）→ en-residue FAIL", () => {
  const o = "This chapter describes the overall process.";
  const t = "本章描述 The quick brown fox jumps over the lazy dog again 详细流程。";
  const r = verify(o, t);
  assert.equal(r.passed, false);
  assert.ok(checksOf(r).includes("en-residue"));
});

test("括注内英文不算漏译：（Context Window） → 过", () => {
  const o = "The context window is a key concept.";
  const t = "上下文窗口（Context Window）是关键概念。";
  const r = verify(o, t);
  assert.equal(r.passed, true);
});

test("短英文词组（Claude Code，2 词）→ 过", () => {
  const o = "The system is driven by Claude Code.";
  const t = "该系统由 Claude Code 驱动。";
  const r = verify(o, t);
  assert.equal(r.passed, true);
});

test("englishRuns 阈值边界：恰好 5 词过、6 词打回", () => {
  const prose = "这里 one two three four five 结束";
  assert.equal(englishRuns(prose, 6).length, 0);
  const prose6 = "这里 one two three four five six 结束";
  assert.equal(englishRuns(prose6, 6).length, 1);
});

// ---------- 新③：中英间距 ----------

test("中文紧贴 ASCII → spacing FAIL", () => {
  const o = "The system verifies integrity.";
  const t = "系统验证integrity，并输出报告。";
  const r = verify(o, t);
  assert.equal(r.passed, false);
  assert.ok(checksOf(r).includes("spacing"));
  assert.equal(r.stats.spacingViolations, 1); // 仅「证i」一处；y 与全角逗号相邻不算
});

test("有空格 → 过；maxSpacing 容忍可调", () => {
  const o = "The system verifies integrity.";
  const clean = "系统验证 integrity，并输出报告。";
  assert.equal(verify(o, clean).passed, true);
  const dirty = "系统验证integrity，并输出报告。";
  assert.equal(verify(o, dirty, { maxSpacing: 2 }).passed, true);
});

test("spacingViolations 与 stripMechanical：括注/代码内不算", () => {
  const t = "窗口（Context Window）与 `code01` 均剥离。";
  const prose = stripMechanical(t);
  assert.equal(spacingViolations(prose).length, 0);
});

// ---------- 新④：防空洞化 ----------

function parasOvn() {
  return [
    "The first paragraph introduces the topic.",
    "The second paragraph expands with detail.",
    "The third paragraph adds evidence.",
    "The fourth paragraph counters objections.",
    "The fifth paragraph concludes part one.",
    "The sixth paragraph looks ahead.",
  ].join("\n\n");
}

test("段落数骤减（6→2）→ structure FAIL", () => {
  const t = "第一段承接全部开篇内容。\n\n第二段收束全部论证。";
  const r = verify(parasOvn(), t);
  assert.equal(r.passed, false);
  assert.ok(checksOf(r).includes("structure"));
  assert.ok(r.fails.some((f) => f.message.includes("段落数骤减")));
});

test("小文档段落合并（3→1，差 2 < 容忍 3）→ 过", () => {
  const o = "First point here.\n\nSecond point here.\n\nThird point here.";
  const t = "三点合并为一段论述。";
  const r = verify(o, t);
  assert.equal(r.passed, true);
});

test("译文长度比过短（≥800B 原文）→ structure FAIL", () => {
  const sentence = "The verification pipeline re-executes every mechanical check before delivery to guarantee authenticity.";
  const o = Array(14).fill(sentence).join("\n\n"); // ≈1.4KB 散文
  const t = "本文概述校验流程。";
  const r = verify(o, t);
  assert.equal(r.passed, false);
  assert.ok(r.fails.some((f) => f.message.includes("译文过短")));
});

test("原文散文不足 800B 不做长度比（小样本跳过）→ 过", () => {
  const o = "Short intro only.";
  const t = "引言。";
  const r = verify(o, t);
  assert.equal(r.passed, true);
});

test("paragraphUnits：围栏整体不算段落单元", () => {
  const text = "Para one.\n\n```js\nlet a = 1;\nlet b = 2;\n```\n\nPara two.";
  assert.equal(paragraphUnits(text).length, 2);
});

// ---------- brief 阈值解析 ----------

test("parseBrief：key: value 行式与 JSON 式均可；越界键 clamp 安全域；max-spacing 不入键域", () => {
  assert.deepEqual(parseBrief("max-annotations: 5\nMax-En-Run: 5"), { maxAnnotations: 5, maxEnRun: 5 });
  assert.deepEqual(parseBrief('{"minLenRatio": 0.5, "note": "说明文字"}'), { minLenRatio: 0.5 });
  // G2 安全域：越界值按边界生效（不放宽到攻击值），间距不可经 brief 调
  assert.deepEqual(parseBrief("max-en-run: 999"), { maxEnRun: 10 });
  assert.deepEqual(parseBrief("min-len-ratio: 0"), { minLenRatio: 0.3 });
  assert.deepEqual(parseBrief("max-spacing: 5"), {});
  assert.deepEqual(parseBrief("未知键: abc"), {});
});

// ---------- CLI 冒烟 ----------

test("CLI：通过退出码 0 / 打回退出码 1 / --json 可解析", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vmtest-"));
  try {
    const o = path.join(tmp, "chunk-01-intro.md");
    const t = path.join(tmp, "t1.md");
    fs.writeFileSync(o, O_BASE);
    fs.writeFileSync(t, T_BASE);
    const { spawnSync } = require("node:child_process");

    const ok = spawnSync(process.execPath, [SCRIPT, o, t], { encoding: "utf-8" });
    assert.equal(ok.status, 0, ok.stdout + ok.stderr);

    // 一个真实打回夹具：译文丢数字
    const tBad = path.join(tmp, "t2.md");
    fs.writeFileSync(tBad, "系统支持若干线程，命中率较高。详见文档。");
    const badRun = spawnSync(process.execPath, [SCRIPT, o, tBad, "--json"], { encoding: "utf-8" });
    assert.equal(badRun.status, 1);
    const parsed = JSON.parse(badRun.stdout);
    assert.equal(parsed.passed, false);
    assert.ok(parsed.fails.some((f) => f.check === "number-fidelity"));
    assert.ok(parsed.stats && typeof parsed.stats.lenRatio === "number");
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("CLI：译文在 translated-chunks/ 下 → verify-results.json 落盘（含 sha 与 _note）", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vmlog-"));
  try {
    const root = path.join(tmp, "demo");
    const chunkDir = path.join(root, "translated-chunks");
    fs.mkdirSync(chunkDir, { recursive: true });
    const o = path.join(root, "chunk-01-intro.md");
    const t = path.join(chunkDir, "translated-chunk-01.md");
    fs.writeFileSync(o, O_BASE);
    fs.writeFileSync(t, T_BASE);
    const { spawnSync } = require("node:child_process");
    const run = spawnSync(process.execPath, [SCRIPT, o, t], { encoding: "utf-8" });
    assert.equal(run.status, 0, run.stdout + run.stderr);
    const logPath = path.join(root, "verify-results.json");
    assert.ok(fs.existsSync(logPath), "verify-results.json 应落盘");
    const entries = JSON.parse(fs.readFileSync(logPath, "utf-8"));
    assert.equal(Array.isArray(entries), true);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].translated, "translated-chunk-01.md");
    assert.match(entries[0].translatedSha1, /^[0-9a-f]{12}$/);
    assert.ok(entries[0]._note.includes("终检不信任"));
    assert.ok(entries[0].thresholds && entries[0].thresholds.maxEnRun === 6);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("CLI：--brief 阈值生效（max-en-run 收紧到安全域下界 4，4 词 run 打回）", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vmbrief-"));
  try {
    const o = path.join(tmp, "o.md");
    const t = path.join(tmp, "t.md");
    const brief = path.join(tmp, "brief.md");
    fs.writeFileSync(o, "The system is driven by a fast engine stack.");
    fs.writeFileSync(t, "该系统由 The quick brown fox 驱动。");
    fs.writeFileSync(brief, "# 翻译偏好\n\nmax-en-run: 1\n"); // 越界收紧 → clamp 到 4
    const { spawnSync } = require("node:child_process");
    const run = spawnSync(process.execPath, [SCRIPT, o, t, "--brief", brief, "--json"], { encoding: "utf-8" });
    assert.equal(run.status, 1);
    const parsed = JSON.parse(run.stdout);
    assert.ok(parsed.fails.some((f) => f.check === "en-residue"), JSON.stringify(parsed.fails));
    assert.equal(parsed.thresholds.maxEnRun, 4); // clamp 后生效值
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
