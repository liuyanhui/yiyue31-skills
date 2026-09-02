// consistency.test.mjs — Step 8 统稿清单全量扫描（fork 三项继承 + xl 扩展四项；M3 前置②）
//
// 覆盖：
//   - fork 继承：① 术语裸英文残留（词边界/译法含英文豁免/[KEEP] 跳过）② 密度离群 ③ 格式（跳级/列表符/围栏）
//   - xl 扩展：④ 标题译法一致性（双语锚对提取；同锚不同译报离群；无锚披露跳过）
//              ⑤ 间距清点 ⑥ 接缝拼料（边界首末段）⑦ 文风抽样（每 chunk 首段）
//   - runConsistency：工作目录推导 + 交付物去头回退 + 清单落盘 consistency-<title>.md
//   - CLI 冒烟（--json / 异常目录退出 2）
//
// 运行：node --test scripts/test/unit/consistency.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import {
  parseGlossary,
  checkTerms,
  annotationOutliers,
  checkFormat,
  headingPairs,
  headingInconsistencies,
  spacingInventory,
  seamEntries,
  styleSamples,
  runConsistency,
} from "../../consistency.mjs";

const SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "consistency.mjs");

// ---------- fork 继承 ----------

test("checkTerms：裸英文残留（词边界）；译法含英文/[KEEP] 豁免", () => {
  const gl = parseGlossary("| English Term | Translation | C |\n|---|---|---|\n| pipeline | 管线 | c |\n| MCP | [KEEP] | c |\n| harness | harness（外壳） | c |\n");
  // 正文残留裸 pipeline → 报；MCP/harness 按豁免不报；代码块里的不算（proseOnly 由调用方先行）
  const flags = checkTerms("管线与 pipeline 并存，`pipeline` 在代码里。", gl);
  assert.equal(flags.length, 1);
  assert.equal(flags[0].term, "pipeline");
  // 词边界：pipelines 复数不计裸残留（有归一翻译路径）
  assert.equal(checkTerms("pipelines everywhere", gl).length, 0);
});

test("annotationOutliers：> 其余均值 2 倍且 ≥2 才报", () => {
  const chunks = [
    { file: "a", text: "一（aa）二（bb）" },
    { file: "b", text: "无注释" },
    { file: "c", text: "无注释" },
  ];
  const o = annotationOutliers(chunks);
  assert.equal(o.length, 1);
  assert.equal(o[0].file, "a");
  assert.equal(o[0].count, 2);
  // 全部相近 → 无离群
  assert.equal(annotationOutliers([{ file: "a", text: "（aa）" }, { file: "b", text: "（bb）" }]).length, 0);
});

test("checkFormat：标题跳级 / 列表符混用 / 围栏混用", () => {
  const fmt = checkFormat("# 一\n\n### 跳两级\n\n- 甲\n\n* 乙\n\n```\ncode\n```\n\n~~~\ntilde\n~~~\n");
  assert.deepEqual(fmt.headingSkips, ["1 → 3"]);
  assert.deepEqual(fmt.listMarkersMixed.sort(), ["*", "-"]);
  assert.equal(fmt.fenceMixed, true);
});

// ---------- xl 扩展 ----------

test("headingPairs + headingInconsistencies：同锚不同译报离群；同文同译不报", () => {
  const md = [
    "# 引言",
    "*Introduction*",
    "",
    "## 结论",
    "*Conclusion*",
    "",
    "## 再论结论",
    "*Conclusion*",
    "",
  ].join("\n");
  const pairs = headingPairs(md);
  assert.equal(pairs.length, 3);
  const flags = headingInconsistencies(pairs);
  assert.equal(flags.length, 1);
  assert.equal(flags[0].en, "Conclusion");
  assert.deepEqual(flags[0].zhs, ["结论", "再论结论"]);
  // 全部同文同译
  assert.equal(headingInconsistencies(headingPairs("# 甲\n*A*\n\n## 乙\n*B*\n")).length, 0);
});

test("spacingInventory：中文紧贴 ASCII 计数（机械元素先剥离）", () => {
  const inv = spacingInventory("系统验证integrity，`code01` 不算。");
  assert.equal(inv.count, 1);
  assert.equal(spacingInventory("系统验证 integrity。").count, 0);
});

test("seamEntries：每接缝拼 上文末 80 / 下文首 80", () => {
  const chunks = [
    { file: "chunk-01.md", text: "第一块收尾。".repeat(30) },
    { file: "chunk-02.md", text: "第二块开头。".repeat(30) },
  ];
  const seams = seamEntries(chunks);
  assert.equal(seams.length, 1);
  assert.equal(seams[0].seam, "chunk-01.md ↔ chunk-02.md");
  assert.ok(seams[0].tail.length <= 80 && seams[0].tail.endsWith("第一块收尾。"));
  assert.ok(seams[0].head.length <= 80 && seams[0].head.startsWith("第二块开头。"));
});

test("styleSamples：每 chunk 首段截 100 字", () => {
  const s = styleSamples([{ file: "f", text: "# 标题\n\n" + "正文甲".repeat(60) + "\n\n第二段" }]);
  assert.equal(s.length, 1);
  assert.ok(s[0].opening.startsWith("正文甲"));
  assert.ok(s[0].opening.length <= 100);
});

// ---------- runConsistency 集成 + CLI ----------

function workdir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cc-"));
  fs.mkdirSync(path.join(dir, "translated-chunks"), { recursive: true });
  fs.writeFileSync(path.join(dir, "original-cct.md"), "# T\n\nOriginal.\n", "utf-8");
  const c1 = "# 引言\n*Introduction*\n\n智能体（agent）启动管线。\n";
  const c2 = "## 结论\n*Conclusion*\n\n智能体运行管线，pipeline 裸残留一处。\n";
  fs.writeFileSync(path.join(dir, "translated-chunks", "translated-chunk-01.md"), c1, "utf-8");
  fs.writeFileSync(path.join(dir, "translated-chunks", "translated-chunk-02.md"), c2, "utf-8");
  fs.writeFileSync(path.join(dir, "merged-draft.md"), c1 + c2, "utf-8");
  fs.writeFileSync(path.join(dir, "glossary-cct.md"), "| English Term | Translation | C |\n|---|---|---|\n| pipeline | 管线 | c |\n", "utf-8");
  return { dir, c1, c2 };
}

test("runConsistency：清单落盘 + stats 汇总（术语残留/锚对/接缝）", () => {
  const { dir } = workdir();
  try {
    const r = runConsistency(dir);
    assert.equal(r.exitCode, 0);
    assert.ok(fs.existsSync(path.join(dir, "consistency-cct.md")));
    const text = fs.readFileSync(r.outPath, "utf-8");
    assert.ok(text.includes("pipeline") && text.includes("管线"), "① 术语残留入清单");
    assert.ok(text.includes("接缝拼料") && text.includes("chunk-01.md ↔ translated-chunk-02.md") || text.includes("translated-chunk-01.md ↔ translated-chunk-02.md"), "⑥ 接缝入清单");
    assert.ok(text.includes("文风遵从拼料"), "⑦ 文风拼料入清单");
    assert.ok(r.stats.termFlags.length === 1, "裸 pipeline 残留 1 条");
    assert.equal(r.stats.seams, 1);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("runConsistency：merged 缺失时回退交付物（去元信息头）；两者皆缺退出 2", () => {
  const { dir } = workdir();
  try {
    fs.rmSync(path.join(dir, "merged-draft.md"));
    const withHead = "> **原文**：T\n> **作者**：\n> **来源**：\n> **翻译日期**：2026-09-01\n> **风格**：意译\n> **字数**：1（汉字）\n\n---\n\n# 引言\n*Introduction*\n";
    fs.writeFileSync(path.join(dir, "translated-cct-zh.md"), withHead, "utf-8");
    const r = runConsistency(dir);
    assert.equal(r.exitCode, 0, JSON.stringify(r.errors));
    assert.ok(r.checklist.includes("*Introduction*"), "头被剥掉、正文进扫描");
    fs.rmSync(path.join(dir, "translated-cct-zh.md"));
    assert.equal(runConsistency(dir).exitCode, 2);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("CLI：--json 出 outPath/stats；非工作目录退出 2", () => {
  const { dir } = workdir();
  try {
    const run = spawnSync(process.execPath, [SCRIPT, dir, "--json"], { encoding: "utf-8" });
    assert.equal(run.status, 0, run.stderr);
    const j = JSON.parse(run.stdout);
    assert.ok(j.outPath.endsWith("consistency-cct.md"));
    const bad = spawnSync(process.execPath, [SCRIPT, dir, "--json"], { encoding: "utf-8" });
    assert.equal(bad.status, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), "cc2-"));
  try {
    const bad = spawnSync(process.execPath, [SCRIPT, empty], { encoding: "utf-8" });
    assert.equal(bad.status, 2);
  } finally {
    fs.rmSync(empty, { recursive: true, force: true });
  }
});
