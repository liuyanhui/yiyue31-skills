// handoff.test.mjs — 交接包机器件生成器（M3 前置④）
//
// 覆盖：
//   - parseGlossary：表行解析 / 表头分隔行跳过 / [KEEP] 跳过（keep-list 管辖） / "/" 双写法拆别名
//   - enVariants：单复数归一（+s / +es / y→ies）
//   - projectionFor：词边界匹配（agent 不误中 agentic）/ 大小写不敏感 / 复数命中 / 未出现不收 / 围栏代码块豁免
//   - renderProjection：别名 `|` 渲染并经 parseProjection 回环（`::` 连接会被解析方并入 zh——2026-09-04 实证）
//   - tailSegment：末段回取 300-500 字窗口
//   - renderContext：首 chunk 缺省 / 邻未过审缺省 / fresh 附 sha 锚
//   - runHandoff：产物落盘 + 幂等字节相同（M5 纪律）+ 缺 glossary 退出 2 + --nn 不在 manifest 退出 1
//   - CLI 冒烟（--help / 真实执行 --json）
//
// 运行：node --test scripts/test/unit/handoff.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import {
  parseGlossary,
  enVariants,
  projectionFor,
  renderProjection,
  tailSegment,
  renderContext,
  runHandoff,
} from "../../handoff.mjs";
import { parseProjection } from "../../verify-mech.mjs";

const sha12 = (s) => crypto.createHash("sha1").update(s, "utf-8").digest("hex").slice(0, 12);
const nn2 = (n) => String(n).padStart(2, "0");
const SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "handoff.mjs");

// ---------- 纯函数 ----------

test("parseGlossary：表行 / 表头与分隔行跳过 / [KEEP] 跳过 / 斜杠拆别名", () => {
  const g = parseGlossary(
    "# 术语表\n\n| English Term | Translation | Context |\n|---|---|---|\n" +
      "| pipeline | 管线 | 语境 |\n| MCP | [KEEP] | 缩写 |\n| harness | 外壳/客户端 | 语境 |\n"
  );
  assert.equal(g.length, 2, "[KEEP] 不进投影（keep-list 管辖）");
  assert.deepEqual(g[0], { en: "pipeline", zh: "管线", aliases: [] });
  assert.deepEqual(g[1], { en: "harness", zh: "外壳", aliases: ["客户端"] });
});

test("enVariants：+s / +es（s/x/z/ch/sh）/ y→ies", () => {
  assert.deepEqual(enVariants("pipeline").sort(), ["pipeline", "pipelines"]);
  assert.ok(enVariants("batch").includes("batches"));
  assert.ok(enVariants("pipeline").includes("pipelines"));
  assert.ok(enVariants("pipeline").includes("pipelines"));
  assert.ok(enVariants("capability").includes("capabilities"));
  assert.ok(enVariants("Agent").includes("agents"), "大小写归一");
});

test("projectionFor：词边界（agent 不误中 agentic）/ 复数命中 / 未出现不收", () => {
  const gl = parseGlossary("| English Term | Translation | Context |\n|---|---|---|\n| agent | 智能体 | c |\n| pipeline | 管线 | c |\n| vaporware | 雾件 | c |\n");
  // 原文只有 agentic 与 pipelines——agent 不应命中（词边界），pipeline 命中（复数归一）
  const hits = projectionFor(gl, "The agentic workflows use pipelines everywhere.");
  assert.deepEqual(hits.map((h) => h.en), ["pipeline"]);
  // 独立词 agent 命中；vaporware 未出现不收
  const hits2 = projectionFor(gl, "An agent evaluates. No mention of pipelines.");
  assert.deepEqual(hits2.map((h) => h.en).sort(), ["agent", "pipeline"]);
});

test("projectionFor：围栏代码块整体豁免（块内英文不构成须兑现项）", () => {
  const gl = parseGlossary("| English Term | Translation | Context |\n|---|---|---|\n| spec | 规格 | c |\n");
  // spec 仅出现于围栏代码块（SKILL.md 示例场景）——不收
  const fenced = projectionFor(gl, "Prose intro.\n\n```\ngenerating an OpenAPI spec.\n```\n\nMore prose.");
  assert.deepEqual(fenced, [], "围栏内命中不收（块内英文原样保留，无中文可兑现）");
  // 同一词出现在围栏外散文——照常收
  const mixed = projectionFor(gl, "The spec is approved.\n\n```\ngenerating an OpenAPI spec.\n```\n");
  assert.deepEqual(mixed.map((h) => h.en), ["spec"]);
});

test("renderProjection：别名 `|` 渲染并经 parseProjection 回环", () => {
  const entries = [
    { en: "agent", zh: "智能体", aliases: [] },
    { en: "steering", zh: "掌舵", aliases: ["引导"] },
  ];
  const text = renderProjection(entries, { glossarySha: "a".repeat(12), chunkSha: "b".repeat(12), nn: 3 });
  const line = text.split(/\r?\n/).find((l) => l.startsWith("steering ::"));
  assert.equal(line, "steering :: 掌舵 | 引导", "冻结格式 `English :: 中文 [| 别名]`");
  // 回环：渲染产物可被 verify-mech 解析方还原（`::` 连接别名会使 zh 吞并别名串——M3 实证）
  const parsed = parseProjection(text);
  assert.deepEqual(
    parsed.find((p) => p.en === "steering"),
    { en: "steering", zh: "掌舵", aliases: ["引导"] }
  );
  assert.deepEqual(parsed.find((p) => p.en === "agent"), { en: "agent", zh: "智能体", aliases: [] });
});

test("tailSegment：末段回取，凑满 ~300 止、超 ~500 截前留尾", () => {
  const p = (n, ch) => ch.repeat(n);
  const text = [p(100, "甲"), p(150, "乙"), p(200, "丙"), p(120, "丁")].join("\n\n");
  const seg = tailSegment(text);
  assert.ok(seg.length >= 300 && seg.length <= 501, `窗口 300-500（实际 ${seg.length}）`);
  assert.ok(seg.endsWith(p(120, "丁")), "含最后一段");
  assert.ok(!seg.includes(p(100, "甲")), "不回头吃满第一段（凑满即止）");
  // 段落不足 300：有多少取多少
  const short = tailSegment("短文一段。");
  assert.equal(short, "短文一段。");
});

test("renderContext：首 chunk / 邻未过审 / fresh 三分支", () => {
  assert.ok(renderContext({ nn: 1, prev: null, prevSha: null, segment: null, fresh: false }).includes("无前邻"));
  assert.ok(renderContext({ nn: 2, prev: 1, prevSha: "abc", segment: null, fresh: false }).includes("未过审"));
  const fresh = renderContext({ nn: 2, prev: 1, prevSha: "abc123def456", segment: "邻段正文。", fresh: true });
  assert.ok(fresh.includes("sha1 abc123def456"));
  assert.ok(fresh.includes("邻段正文。"));
});

// ---------- runHandoff 集成 ----------

function miniDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ho-"));
  const origs = {
    1: "# Doc\n\nThe agent uses a pipeline tool.\n",
    2: "## Two\n\nAgents run pipelines again.\n",
  };
  const trans = {
    1: "# 文档\n*Doc*\n\n智能体使用管线工具。\n",
    2: "## 二\n*Two*\n\n智能体再次运行管线。\n",
  };
  fs.mkdirSync(path.join(dir, "chunks"), { recursive: true });
  fs.mkdirSync(path.join(dir, "translated-chunks"), { recursive: true });
  const names = { 1: "chunk-01-doc.md", 2: "chunk-02-two.md" };
  for (const n of [1, 2]) {
    fs.writeFileSync(path.join(dir, "chunks", names[n]), origs[n], "utf-8");
    fs.writeFileSync(path.join(dir, "translated-chunks", `translated-chunk-${nn2(n)}.md`), trans[n], "utf-8");
  }
  const original = origs[1] + origs[2];
  fs.writeFileSync(path.join(dir, "original-ho.md"), original, "utf-8");
  fs.writeFileSync(
    path.join(dir, "manifest.md"),
    [
      "# 分段清单（manifest）",
      "",
      `- 原文：original-ho.md　sha1（前 12）：${sha12(original)}　0.1KB`,
      "",
      "| NN | 文件 | KB | 行 | sha1 |",
      "|----|------|----|----|------|",
      ...[1, 2].map((n) => `| ${nn2(n)} | ${names[n]} | 0.1 | 1-3 | ${sha12(origs[n])} |`),
    ].join("\n") + "\n",
    "utf-8"
  );
  fs.writeFileSync(path.join(dir, "glossary-ho.md"), "| English Term | Translation | Context |\n|---|---|---|\n| agent | 智能体 | c |\n| pipeline | 管线 | c |\n", "utf-8");
  // chunk 01 最新机械校验 passed 且 sha fresh；chunk 02 无记录
  fs.writeFileSync(
    path.join(dir, "verify-results.json"),
    JSON.stringify({ results: [{ nn: 1, passed: true, translationSha: sha12(trans[1]) }] }),
    "utf-8"
  );
  return { dir, trans };
}

test("runHandoff：投影+语境落盘；幂等字节相同；语境按 verify 新鲜口径", () => {
  const { dir } = miniDir();
  try {
    const r = runHandoff(dir);
    assert.equal(r.exitCode, 0);
    assert.equal(r.generated.length, 4, "2 chunk × 投影+语境");
    const p1 = fs.readFileSync(path.join(dir, "handoff", "projection-chunk-01.md"), "utf-8");
    assert.ok(p1.includes("agent :: 智能体"));
    assert.ok(p1.includes("pipeline :: 管线"));
    const p2 = fs.readFileSync(path.join(dir, "handoff", "projection-chunk-02.md"), "utf-8");
    assert.ok(p2.includes("agent :: 智能体"), "复数 Agents 归一命中");
    const c1 = fs.readFileSync(path.join(dir, "handoff", "context-chunk-01.md"), "utf-8");
    assert.ok(c1.includes("无前邻"), "首 chunk 语境缺省");
    const c2 = fs.readFileSync(path.join(dir, "handoff", "context-chunk-02.md"), "utf-8");
    assert.ok(c2.includes(`sha1 ${sha12(fs.readFileSync(path.join(dir, "translated-chunks", "translated-chunk-01.md"), "utf-8"))}`), "邻 chunk sha 锚");
    assert.ok(c2.includes("智能体使用管线工具"), "串行增强段正文");
    // 幂等：重跑字节相同（无时间戳入产物）
    const before = fs.readFileSync(path.join(dir, "handoff", "projection-chunk-01.md"), "utf-8");
    runHandoff(dir);
    assert.equal(fs.readFileSync(path.join(dir, "handoff", "projection-chunk-01.md"), "utf-8"), before);
    // 邻 chunk sha 过期（重译未重验）→ 语境退缺省
    fs.writeFileSync(path.join(dir, "translated-chunks", "translated-chunk-01.md"), "# 文档\n*Doc*\n\n智能体使用管线工具（改动）。\n", "utf-8");
    runHandoff(dir);
    const c2b = fs.readFileSync(path.join(dir, "handoff", "context-chunk-02.md"), "utf-8");
    assert.ok(c2b.includes("未过审"), "sha 过期退纯预生成");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("runHandoff：缺 glossary 退出 2；--nn 不在 manifest 退出 1；--nn 单 chunk 只生成两件", () => {
  const { dir } = miniDir();
  try {
    fs.rmSync(path.join(dir, "glossary-ho.md"));
    assert.equal(runHandoff(dir).exitCode, 2);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  const d2 = miniDir();
  try {
    assert.equal(runHandoff(d2.dir, { nn: 9 }).exitCode, 1);
    const r = runHandoff(d2.dir, { nn: 2 });
    assert.equal(r.exitCode, 0);
    assert.equal(r.generated.length, 2, "单 chunk 两件");
  } finally {
    fs.rmSync(d2.dir, { recursive: true, force: true });
  }
});

// ---------- CLI 冒烟 ----------

test("CLI：--help 退出 0；真实执行 --json 出 generated", () => {
  const help = spawnSync(process.execPath, [SCRIPT, "--help"], { encoding: "utf-8" });
  assert.equal(help.status, 0);
  assert.ok(help.stdout.includes("projection-chunk"));
  const { dir } = miniDir();
  try {
    const run = spawnSync(process.execPath, [SCRIPT, dir, "--json"], { encoding: "utf-8" });
    assert.equal(run.status, 0, run.stderr);
    const j = JSON.parse(run.stdout);
    assert.equal(j.exitCode, 0);
    assert.equal(j.generated.length, 4);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
