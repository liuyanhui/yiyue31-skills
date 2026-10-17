// sizes.test.mjs — 三档尺寸断言（S2 批次挂 run.sh；口径 = 十进制，KB = 1000B，S1 已钉此口径）
//
// 三档（improvement-proposal §5 红线 + ③v4-6）：
//   1. SKILL.md ≤ 20,000B 硬上限（16,000B 软目标仅 WARN 不断言——20KB 硬上限批批断言）
//   2. references/*.md 单件 ≤ 6,000B（懒加载预算；含本批新增 unify/fix-loop/env-playbook/verbs/analysis）
//   3. fixer 包 / 审校单元包 ≤ 40,000B（夹具实测口径）：
//      - fixer 包：max 尺寸 chunk（译文 ~16.7KB）+ 四维报告全文 → status.mjs --verb fix 实测物化字节
//      - 审校单元包：staging 被审单元 + chunk 原文 + 附件预算 3,800B
//        （风格卡投影 ≤2,000[S3 已落地——档 3b 用 renderStyleProjection 实测] + handoff 投影 ~1,400 + brief ~400）
//
// 运行：node --test scripts/test/unit/sizes.test.mjs（run.sh glob unit/*.test.mjs 自动纳入）

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { run as segRun } from "../../segment/segment.mjs";
import { renderStyleProjection } from "../../handoff.mjs";
import { run } from "../../status.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const SKILL_MD = path.join(ROOT, "SKILL.md");
const REFS_DIR = path.join(ROOT, "references");
const DIMS = ["accuracy", "translationese", "ai-tone", "readability"];
const KB = 1000; // 十进制（S1 钉死口径：KB = 1000B，非 1024）

const sha12Of = (p) => crypto.createHash("sha1").update(fs.readFileSync(p, "utf-8"), "utf-8").digest("hex").slice(0, 12);
const nn2 = (n) => String(n).padStart(2, "0");
const sizeOf = (p) => fs.statSync(p).size;

// ---------- 档 1：SKILL.md ≤ 20KB 硬上限（16KB 软目标 WARN） ----------

test("档 1：SKILL.md ≤ 20,000B 硬上限（批末交付态口径）；>16,000B 软目标仅 WARN", () => {
  const b = sizeOf(SKILL_MD);
  if (b > 16 * KB) console.warn(`⚠ SKILL.md ${b}B > 16,000B 软目标（硬上限 20,000B 内不阻断；后续批次继续迁出）`);
  assert.ok(b <= 20 * KB, `SKILL.md ${b}B 超 20,000B 硬上限（§5 红线；迁出映射 §6.1 + 措辞压缩）`);
});

// ---------- 档 2：references 单件 ≤ 6KB ----------

test("档 2：references/*.md 单件 ≤ 6,000B（懒加载预算，glob 全量）", () => {
  const files = fs.readdirSync(REFS_DIR).filter((f) => f.endsWith(".md"));
  assert.ok(files.length >= 14, `references 应 ≥14 件（S2 后），实得 ${files.length}`);
  for (const f of files) {
    const b = sizeOf(path.join(REFS_DIR, f));
    assert.ok(b <= 6 * KB, `references/${f} ${b}B 超 6,000B`);
  }
});

// ---------- 档 3：fixer 包 / 审校单元包 ≤ 40KB（夹具实测） ----------

// 夹具：单 chunk 目标带文档（原文 ~14.5KB 落带内）+ max 尺寸译文（~16.5KB > 实测最大 chunk 16,676B 同量级）
//   + >6,000B 合成风格卡（S3 §3 注——7 维度 × 各 5 条"这样写/不这样写"对照，仿 references/style-card.md 指引）
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

function bigWorkdir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sz-"));
  const paras = [];
  for (let i = 0; i < 145; i++) paras.push(`## Sec ${i}\n\nPara ${i} lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore.`);
  fs.writeFileSync(path.join(dir, "original-bigdoc.md"), paras.join("\n\n") + "\n", "utf-8");
  const r = segRun(path.join(dir, "original-bigdoc.md"), dir, { quiet: true });
  assert.equal(r.exitCode, 0, "夹具分段失败");
  const card = bigStyleCard();
  fs.writeFileSync(path.join(dir, "style-card.md"), card, "utf-8");
  assert.ok(Buffer.byteLength(card, "utf-8") > 6 * KB, `夹具自证：风格卡 ${Buffer.byteLength(card, "utf-8")}B >6KB（防空转）`);
  return dir;
}

function bigTranslation() {
  const secs = [];
  for (let s = 0; s < 3; s++) {
    const paras = [];
    for (let p = 0; p < 40; p++) paras.push(`本节第 ${p} 段：术语 alpha 与数字 ${p} 保持一致，行文风格稳定、信息密度对齐原文，用作尺寸夹具的填充段落，不参与语义判分。`);
    secs.push(`## 第 ${s} 部分标题\n\n${paras.join("\n\n")}`);
  }
  return secs.join("\n\n") + "\n";
}

function bigReport(nn, dim, findingRows) {
  const L = [`sha: ${"0".repeat(12)}`, "model: test", "time: 2026-10-16T00:00:00Z", "sec: s1 aaaaaaaaaaaa 甲", "sec: s2 bbbbbbbbbbbb 乙", "sec: s3 cccccccccccc 丙", "", "## 甲", ""];
  for (let i = 1; i <= findingRows; i++) L.push(`| ${i} | "lorem paragraph ${i}" | 数字漂移：${i} → 约数 | 改回精确值 |`);
  L.push("", "## 乙", "", "无问题", "", "## 丙", "", "无问题", "");
  return L.join("\n");
}

test("档 3a：fixer 包 ≤ 40,000B（max 尺寸译文 + 四维报告全文，--verb fix 实测物化）", () => {
  const dir = bigWorkdir();
  try {
    const t = bigTranslation();
    const tp = path.join(dir, "translated-chunks", "translated-chunk-01.md");
    fs.mkdirSync(path.dirname(tp), { recursive: true });
    fs.writeFileSync(tp, t, "utf-8");
    fs.mkdirSync(path.join(dir, "adjudications"), { recursive: true });
    fs.writeFileSync(path.join(dir, "adjudications", "adjudication-chunk-01.md"), "# 台账\n- «alpha» → 保留\n", "utf-8");
    fs.writeFileSync(path.join(dir, "verify-results.json"), JSON.stringify({ results: [{ nn: 1, passed: true, translationSha: sha12Of(tp) }] }), "utf-8");
    fs.mkdirSync(path.join(dir, "reviews"), { recursive: true });
    for (const dim of DIMS) fs.writeFileSync(path.join(dir, "reviews", `review-${dim}-chunk-01.md`), bigReport(1, dim, 20), "utf-8");
    const r = run(dir, { verb: "fix", nn: 1 }); // 四维缺省全量进包
    assert.equal(r.exitCode, 0, (r.errors ?? []).join(";"));
    const pkg = path.join(dir, "staging", "fixer-chunk-01.md");
    const b = sizeOf(pkg);
    const parts = `译文 ${Buffer.byteLength(t)}B + 四维报告 ${DIMS.reduce((a, d) => a + sizeOf(path.join(dir, "reviews", `review-${d}-chunk-01.md`)), 0)}B + 定位块`;
    console.log(`  fixer 包实测 ${b}B（${parts}）`);
    assert.ok(b <= 40 * KB, `fixer 包 ${b}B 超 40,000B（构成=定位块+译文全文+FAIL 报告全文；超限出口=报告瘦身/分维派发）`);
    assert.ok(b > 16 * KB, "夹具自证：译文本体已 >16KB（防夹具缩水使断言空转）");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("档 3b：审校单元包 ≤ 40,000B（staging 单元 + chunk 原文 + 附件预算——投影实测口径，S3 已落地）", () => {
  const dir = bigWorkdir();
  try {
    const t = bigTranslation();
    const tp = path.join(dir, "translated-chunks", "translated-chunk-01.md");
    fs.mkdirSync(path.dirname(tp), { recursive: true });
    fs.writeFileSync(tp, t, "utf-8");
    fs.mkdirSync(path.join(dir, "adjudications"), { recursive: true });
    fs.writeFileSync(path.join(dir, "adjudications", "adjudication-chunk-01.md"), "# 台账\n- «alpha» → 保留\n", "utf-8");
    fs.writeFileSync(path.join(dir, "verify-results.json"), JSON.stringify({ results: [{ nn: 1, passed: true, translationSha: sha12Of(tp) }] }), "utf-8");
    const r = run(dir, { verb: "dispatch" }); // 整 chunk 首审 × 4 维物化
    assert.equal(r.exitCode, 0, (r.errors ?? []).join(";"));
    assert.equal(r.queue.q.length, 4);
    const staging = path.join(dir, "staging", "review-accuracy-unit-001.md");
    const unit = sizeOf(staging);
    const chunkFile = path.join(dir, "chunks", fs.readdirSync(path.join(dir, "chunks")).find((f) => /chunk-01/.test(f)));
    const orig = sizeOf(chunkFile);
    // S3 已落地：风格卡投影用 handoff.mjs 同一纯函数现算（与 runHandoff 写盘同源），附件预算改投影实测口径
    const cardPath = path.join(dir, "style-card.md");
    const cardText = fs.readFileSync(cardPath, "utf-8");
    const proj = renderStyleProjection(cardText, { cardSha: sha12Of(cardPath) });
    const projBytes = Buffer.byteLength(proj, "utf-8");
    assert.ok(projBytes <= 2 * KB, `风格卡投影 ${projBytes}B 超 2,000B（S3 §3 注红线）`);
    for (const h of cardText.split(/\r?\n/).filter((l) => /^#{1,6}\s/.test(l))) {
      assert.ok(proj.includes(h), `投影保留全部标题行：${h}`);
    }
    assert.ok(proj.includes(sha12Of(cardPath)), "投影含源卡 sha 锚");
    const ATTACH_BUDGET = projBytes + 1400 + 400; // 风格卡投影实测 + handoff 投影 ~1,400 + brief ~400
    assert.ok(ATTACH_BUDGET <= 3800, `附件预算 ${ATTACH_BUDGET}B 超 3,800B（= 投影实测 +1,400+400 的上界）`);
    const total = unit + orig + ATTACH_BUDGET;
    console.log(`  审校单元包实测口径 ${total}B（staging ${unit}B + 原文 ${orig}B + 附件预算 ${ATTACH_BUDGET}B——风格卡投影实测 ${projBytes}B）`);
    assert.ok(total <= 40 * KB, `审校单元包 ${total}B 超 40,000B（超限出口=首审切半送审，delta 仍节级）`);
    assert.ok(unit > 16 * KB, "夹具自证：被审单元本体已 >16KB");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
