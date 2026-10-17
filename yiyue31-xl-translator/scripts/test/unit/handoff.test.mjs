// handoff.test.mjs — 交接包机器件生成器（M3 前置④）
//
// 覆盖：
//   - parseGlossary：表行解析 / 表头分隔行跳过 / [KEEP] 跳过（keep-list 管辖） / "/" 双写法拆别名
//   - enVariants：单复数归一（+s / +es / y→ies）
//   - projectionFor：词边界匹配（agent 不误中 agentic）/ 大小写不敏感 / 复数命中 / 未出现不收 / 围栏代码块豁免
//   - renderProjection：别名 `|` 渲染并经 parseProjection 回环（`::` 连接会被解析方并入 zh——2026-09-04 实证）
//   - tailSegment：末段回取 300-500 字窗口
//   - renderContext：首 chunk 缺省 / 邻未过审缺省 / fresh 附 sha 锚
//   - renderStyleProjection：风格卡投影（S3 §3 注）确定性蒸馏——全标题逐字 + 每节首条主干 +
//     超预算自末节弃内容（标题保留）+ 尾行截断披露（未截断同款）+ 源卡 sha 锚 + 恒 ≤ budget + 幂等
//   - runHandoff：产物落盘 + 幂等字节相同（M5 纪律）+ 缺 glossary 退出 2 + --nn 不在 manifest 退出 1
//     + 第三机器件 style-card-proj.md（SP1 有卡 / SP2 缺卡 WARN 不阻断）
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
  renderStyleProjection,
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

test("projectionFor：B2 最长匹配吸收（M4 译前评审 2.8/2.9 回归对）", () => {
  const gl = parseGlossary(
    "| English Term | Translation | Context |\n|---|---|---|\n" +
      "| token | 词元 | c |\n| scoped token | 受限令牌 | c |\n" +
      "| Nit | 小毛病 | c |\n| review | 评审 | c |\n| security review | 安全审查 | c |\n"
  );
  // token 的唯一出现都在 "scoped tokens" 内 → 被长者吸收，不进投影
  const absorbed = projectionFor(gl, "Jobs run with short-lived scoped tokens.");
  assert.deepEqual(absorbed.map((h) => h.en), ["scoped token"], "短词条全被长词条覆盖时吸收");
  // token 另有独立出现 → 两条都收（各自须兑现）
  const both = projectionFor(gl, "Jobs run with short-lived scoped tokens. Each token is short-lived.");
  assert.deepEqual(both.map((h) => h.en).sort(), ["scoped token", "token"]);
  // Nit 大小写不敏匹配 + 词边界：不误中 monitoring；独立 Nit 命中
  const nit = projectionFor(gl, "The monitoring stack flags one Nit per review.");
  assert.ok(nit.map((h) => h.en).includes("Nit"), "独立 Nit 命中（大小写不敏）");
  assert.ok(!nit.map((h) => h.en).includes("monitoring"), "词边界防子串误收");
  // review 部分吸收：security review 出现 + review 独立出现 → review 保留（删长词后仍有独立出现）
  const rev = projectionFor(gl, "A security review and a plain review pass.");
  assert.deepEqual(rev.map((h) => h.en).sort(), ["review", "security review"]);
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

// ---------- 风格卡投影（S3 §3 注：第三机器件） ----------

// >6KB 合成卡：7 维度（references/style-card.md 生成指引）各一节 × 5 条"这样写/不这样写"对照规则行
function bigStyleCard() {
  const dims = ["句式节奏", "语体", "修辞习惯", "标点习惯", "称谓与人称", "比喻处理策略", "文体变化轴"];
  const L = ["# 文风基准卡（合成夹具）", "", "> 判卷锚：7 维度规则，译者/审校/统稿/冷读共用（内容 lorem）。"];
  dims.forEach((d, i) => {
    L.push("", `## ${d}`);
    for (let r = 1; r <= 5; r++) {
      L.push(
        `- ${d}规则${r}：这样写「lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna（${i}-${r}）」` +
          `；不这样写「sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium（${i}-${r}）」。`
      );
    }
  });
  return L.join("\n") + "\n";
}

test("SP1：风格卡投影——>6KB 卡蒸馏 ≤2,000B、全标题逐字、尾行披露、sha 锚、超预算弃末节内容、幂等", () => {
  const { dir } = miniDir();
  try {
    const card = bigStyleCard();
    fs.writeFileSync(path.join(dir, "style-card.md"), card, "utf-8");
    assert.ok(Buffer.byteLength(card, "utf-8") > 6000, `夹具自证：卡 ${Buffer.byteLength(card, "utf-8")}B >6KB`);
    const cardSha = sha12(card);
    const r = runHandoff(dir);
    assert.equal(r.exitCode, 0);
    assert.equal(r.warns.length, 0, "有卡不 WARN");
    // 第三机器件与既有两件并列落盘（projection/context 不回归）
    const projPath = path.join(dir, "handoff", "style-card-proj.md");
    assert.ok(fs.existsSync(projPath), "style-card-proj.md 落盘");
    assert.ok(r.generated.includes(projPath), "入 generated（与既有两件并列）");
    assert.ok(fs.existsSync(path.join(dir, "handoff", "projection-chunk-01.md")), "既有投影件不回归");
    assert.ok(fs.existsSync(path.join(dir, "handoff", "context-chunk-01.md")), "既有语境件不回归");
    assert.equal(r.generated.length, 5, "2 chunk × 2 件 + 风格卡投影 1 件");
    const proj = fs.readFileSync(projPath, "utf-8");
    const projB = Buffer.byteLength(proj, "utf-8");
    assert.ok(projB <= 2000, `投影 ${projB}B ≤2,000B（§5 红线：卡全文进每包属超红线）`);
    assert.equal(r.styleCardProj?.bytes, projB, "--json 结果附字节数");
    const heads = card.split(/\r?\n/).filter((l) => /^#{1,6}\s/.test(l));
    assert.equal(heads.length, 8, "夹具自证：1 主标题 + 7 维度节");
    for (const h of heads) assert.ok(proj.includes(h), `标题逐字保留：${h}`);
    assert.ok(proj.includes(cardSha), "源卡 sha 锚");
    assert.ok(proj.includes("style-card.md"), "判卷全文指针（全文仅进主上下文）");
    assert.ok(proj.includes("截断披露"), "尾行披露在场（未截断也附同款——口径统一）");
    assert.equal(Number(proj.match(/投影 (\d+) B/)[1]), projB, "披露 M = 投影实际字节");
    // 幂等：同输入重跑字节相同（确定性蒸馏、无时间戳）
    runHandoff(dir);
    assert.equal(fs.readFileSync(projPath, "utf-8"), proj);
    // 超预算路径（判据"自最后一个节起逐节弃内容行，标题保留"）：收紧预算直接驱动同一纯函数
    const tight = renderStyleProjection(card, { cardSha, budget: 500 });
    assert.ok(Buffer.byteLength(tight, "utf-8") <= 500, "收紧预算仍恒 ≤ budget");
    for (const h of heads) assert.ok(tight.includes(h), "弃内容不弃标题");
    assert.ok(!tight.includes("这样写「"), "节内容已弃尽（仅剩头两行 + 全标题 + 披露尾行）");
    assert.ok(tight.includes("截断披露"), "弃内容后披露尾行仍在场");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("SP2：缺 style-card.md——WARN 不阻断（exit 0）、投影不落盘、既有两件不受影响", () => {
  const { dir } = miniDir();
  try {
    const r = runHandoff(dir);
    assert.equal(r.exitCode, 0, "缺卡不阻断");
    assert.ok(r.warns.some((w) => w.includes("style-card.md") && w.includes("Step 2")), "warns 含缺卡提示");
    assert.ok(!fs.existsSync(path.join(dir, "handoff", "style-card-proj.md")), "投影不落盘");
    assert.equal(r.styleCardProj, null);
    assert.equal(r.generated.length, 4, "既有 projection/context 两件照常（2 chunk × 2）");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
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

// ---------- S3b rider：E4 风格卡投影 BOM ----------

test("SP3（E4, S3b）：BOM 开头卡首节不丢——前导 U+FEFF 剥后再 split；只剥前导（节内容内 BOM 原样）；无 BOM 卡输出字节不变", () => {
  const card = bigStyleCard();
  const cardSha = sha12(card);
  // 反例钉死（无 BOM 卡输出字节不变）：BOM 剥离对无 BOM 输入必须是恒等变换——
  // 带 BOM 版与无 BOM 版投影逐字节相等（任何多余剥离/改写都会破坏该等式）
  const noBom = renderStyleProjection(card, { cardSha });
  const bomLed = renderStyleProjection("﻿" + card, { cardSha });
  assert.equal(bomLed, noBom, "BOM 开头卡投影 = 无 BOM 卡投影（前导 BOM 完全中和）");
  const heads = card.split(/\r?\n/).filter((l) => /^#{1,6}\s/.test(l));
  for (const h of heads) assert.ok(bomLed.includes(h), `BOM 卡首节不丢（标题逐字保留）：${h}`);
  assert.ok(noBom.includes(heads[0]), "夹具自证：主标题（原被\"标题前正文\"静默丢弃位）在场");
  // 只剥前导一个：节内容行内的 BOM 原样保留（零改写纪律——不扩散成全局清洗）
  const midBom = "## 甲\n\n- 规则﻿行（BOM 居中）\n";
  const mid = renderStyleProjection(midBom, { cardSha: "x" });
  assert.ok(mid.includes("规则﻿行"), "行内 BOM 原样保留（只剥前导）");
  assert.ok(!mid.startsWith("﻿"), "输出自身不带前导 BOM");
});
