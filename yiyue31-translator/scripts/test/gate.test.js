"use strict";

// gate.test.js — 门禁逻辑持久单测（node --test 运行，零依赖）
//   node --test "scripts/test/*.test.js"（Node v25 不吃目录参数，须用 glob 或直指定文件）
// 覆盖 2026-11-24 v3.0.4 三处修复的回归面（源自 automate-grok-bot 实战 + 对抗/多角色评审）：
//   P2 披露解析 a-strict / P4 注释密度计数防虚高 / P5 chronology 字节锚（经 CLI 端到端验证，此处单元级）。

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const { disclosedSkipDims } = require(path.join(__dirname, "..", "verify-pipeline.js"));
const { countEnglishAnnotations } = require(path.join(__dirname, "..", "verify-mechanical.js"));

// ---------- P2：披露解析 a-strict ----------

test("P2: 带标准标记的否定句不构成披露（实战事故形态）", () => {
  const lines = [
    "**跳过维度**：无（⏭️ SKIPPED：不适用——全部维度均实际执行）。",
    "| Step 6 翻译腔审校 | ✅ 完成 | 修复 17/18（#14 双你的跳过：表锁定） |",
    "翻译腔没有跳过，AI 味也没有跳过",
  ].join("\n");
  assert.deepEqual([...disclosedSkipDims(lines)], []);
});

test("P2: 自由文本'跳过'不再构成披露（含攻击形态与旧区间格式）", () => {
  assert.deepEqual([...disclosedSkipDims("Step 7 AI味审校跳过")], []);
  assert.deepEqual([...disclosedSkipDims("Step 5-7 因限流跳过")], []);
});

test("P2: 标准标记披露——单维 / 区间 / 全半角括号 / 零空白 / 裸⏭(无VS16)", () => {
  assert.deepEqual([...disclosedSkipDims("| Step 5 准确性审校 | ⏭️ SKIPPED(API 限流) | 未执行 |")], ["translation"]);
  assert.deepEqual([...disclosedSkipDims("Step 5-7 ⏭️ SKIPPED(限流)")].sort(), ["ai-tone", "translation", "translationese"]);
  assert.deepEqual([...disclosedSkipDims("Step 5—7 ⏭️ SKIPPED(限流)")].sort(), ["ai-tone", "translation", "translationese"]); // 中文破折号
  assert.deepEqual([...disclosedSkipDims("| Step 9 可读性 | ⏭️SKIPPED(x) |")], ["readability"]); // 零空白
  assert.deepEqual([...disclosedSkipDims("| Step 9 可读性 | ⏭️ SKIPPED(x) |")], ["readability"]); // 显式 VS16
  assert.deepEqual([...disclosedSkipDims("| Step 9 可读性 | ⏭ SKIPPED(x) |")], ["readability"]); // 裸 ⏭（无 VS16，R1 加固）
});

test("P2: 关键词子串碰撞——translationese 行不得误标 translation", () => {
  assert.deepEqual([...disclosedSkipDims("| Step 6 翻译腔审校 | ⏭️ SKIPPED(x) |")], ["translationese"]);
});

// ---------- P4：注释密度计数防虚高 ----------

test("P4: 机械类英文不计（图片/链接/行内代码/fenced/裸 URL）", () => {
  const text = [
    "![图](https://x.com/a.jpg)",
    "[译文](https://y.com/b)",
    "`code(v1)`",
    "```js\nfoo(bar)\n```",
    "裸 https://z.com/c.txt",
  ].join("\n");
  assert.equal(countEnglishAnnotations(text), 0);
});

test("P4: 纯英文括注计数；混排括注为文档化预期差（保留计数）", () => {
  const text = "例行任务（routine）\n（Automation is a way.）\n中文（Slack/Teams）";
  assert.equal(countEnglishAnnotations(text), 3);
});
