// final-gate.test.mjs — final-gate.mjs 单元测试（node --test，文件内默认串行，低内存纪律）
//
// 覆盖（HANDOFF §5/§6 逐项）：
//   - 重执行一切：机械校验重跑打回（篡改数字 → scoped）、merged 重导出 diff、拼接 sha 复核（篡改分母 → global）
//   - 完备性矩阵：缺报告 → scoped；准确性维度缺失 = 无条件 FAIL 措辞
//   - G3 括注对账：ledger 保留缺兑现 / 译文未裁定直接括注 / 空集对非空台账
//   - R23 精选表兑现：形态不符 → FAIL；无 special-phrases 文件 → 跳过不报错
//   - 标题双语锚：次行锚逐字 / 级别序列 / 标题数；brief 关闭 → 披露跳过仍 PASS
//   - G4：冷读覆盖矩阵缺 chunk / pm-review 选样缺 / 维度 SKIPPED；R15 merged-sha 锚不豁免
//   - 探针命中判定：缺 truth / 缺报告 / 未命中；每维度 ≥1
//   - 新鲜度豁免 glob：产物 mtime 晚于 merged 只 WARN 不 FAIL
//   - 原子改名：PASS → translated-<title>-zh.md 出现、merged-draft 消失、REPORT 带 sha 锚与 G1 回显
//   - 手改交付物保护（R18-⑥）：已存在不一致交付物拒绝覆盖
//   - 连续 FAIL ≥3 → PENDING-USER；半径分级（scoped 退出码 3 / global 退出码 4）
//
// 夹具：程序化"全绿工作目录"（手写 manifest/chunks/译文/台账/报告——不依赖 segment 算法，完全确定）。
//
// 运行：node --test scripts/test/unit/final-gate.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { runMerge } from "../../merge.mjs";
import { runDerive } from "../../derive-bilingual.mjs";
import { generate } from "../../probe.mjs";
import {
  runGate,
  parseLedger,
  parseSpecialPhrases,
  parseColdRead,
  parsePmReview,
  anchorOff,
  requiredSamples,
  headingAnchorCheck,
  probeCheck,
  renderMetaHeader,
  stripMetaHeader,
} from "../../final-gate.mjs";

const sha12 = (s) => crypto.createHash("sha1").update(s, "utf-8").digest("hex").slice(0, 12);
const nn2 = (n) => String(n).padStart(2, "0");
const DIMS = ["accuracy", "translationese", "ai-tone", "readability"];
const SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "final-gate.mjs");

// ---------- 纯函数 ----------

test("parseLedger：保留/删除集合（→ 与 -> 均认）", () => {
  const { keep, drop } = parseLedger("# 台账\n- «alpha» → 保留\n- «beta» -> 删除\n- 无关行\n");
  assert.ok(keep.has("alpha"));
  assert.ok(drop.has("beta"));
  assert.equal(keep.size, 1);
});

test("parseSpecialPhrases：R23 冻结格式（# 注释/空行忽略）", () => {
  const ps = parseSpecialPhrases("# 精选表\n\nthe quick brown fox :: 敏捷的棕色狐狸\n\nanother :: 另一个\n");
  assert.deepEqual(ps, [
    { en: "the quick brown fox", zh: "敏捷的棕色狐狸" },
    { en: "another", zh: "另一个" },
  ]);
});

test("parseColdRead / parsePmReview / anchorOff / requiredSamples", () => {
  const cov = parseColdRead("# 冷读台账\n- chunk 01: sha abc123def456（发现 2）\n- chunk 02：sha 000000000000\n");
  assert.equal(cov[1], "abc123def456");
  assert.equal(cov[2], "000000000000");
  const pm = parsePmReview("# PM 通读\n\nmerged-sha: abc123def456\n\n- chunk 03: 选样结论：术语一致，可放行。\n");
  assert.equal(pm.mergedSha, "abc123def456");
  assert.ok(pm.samples[3].includes("术语"));
  assert.equal(anchorOff("标题双语锚: off"), true);
  assert.equal(anchorOff("标题双语锚： 关闭"), true);
  assert.equal(anchorOff(null), false);
  assert.equal(anchorOff("# brief\n受众：技术读者\n"), false);
  // 选样集：3 chunk 无升级 → 兜底末 chunk；8 chunk → 5 必抽；升级 2 → 2+3 接缝
  assert.deepEqual([...requiredSamples(3, [])], [3]);
  assert.deepEqual([...requiredSamples(8, [])].sort(), [5]);
  assert.deepEqual([...requiredSamples(8, [{ ev: "escalate", nn: 2 }])].sort(), [2, 3, 5]);
});

test("headingAnchorCheck：锚逐字/级别/数量三向判据", () => {
  const orig = "# Title One\n\n正文。\n\n## Section Two\n\n正文二。\n";
  const good = "# 标题一\n*Title One*\n\n正文。\n\n## 小节二\n*Section Two*\n\n正文二。\n";
  assert.deepEqual(headingAnchorCheck(orig, good), []);
  assert.ok(headingAnchorCheck(orig, "# 标题一\n*Title One Wrong*\n\n正文。\n\n## 小节二\n*Section Two*\n\n正文二。\n").some((f) => f.includes("逐字")));
  assert.ok(headingAnchorCheck(orig, "# 标题一\n*Title One*\n\n正文。\n\n### 小节二\n*Section Two*\n\n正文二。\n").some((f) => f.includes("级别")));
  assert.ok(headingAnchorCheck(orig, "# 标题一\n*Title One*\n").some((f) => f.includes("标题数")));
  assert.ok(headingAnchorCheck(orig, "# Title One\n*Title One*\n\n正文。\n\n## 小节二\n*Section Two*\n\n正文二。\n").some((f) => f.includes("非中文")));
});

test("probeCheck：缺维度/缺报告/未命中", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fgp-"));
  try {
    const truth = [
      { virtualNn: 901, dim: "accuracy", half: "a", text: "样本", defectType: "数字错", expectedHit: "18,000" },
      { virtualNn: 902, dim: "readability", half: "b", text: "样本二", defectType: "长句", expectedHit: "接着" },
    ];
    let fails = probeCheck(dir, truth);
    assert.equal(fails.length, 2 + 2); // 缺 accuracy/translationese/ai-tone 三维中缺二 + 两报告缺失
    assert.ok(fails.some((f) => f.includes("translationese") && f.includes("无探针")));
    assert.ok(fails.every((f) => !f.includes("未命中")), "报告都没有时不判未命中，判缺报告");
    fs.mkdirSync(path.join(dir, "reviews"), { recursive: true });
    fs.writeFileSync(path.join(dir, "reviews", "review-accuracy-chunk-901a.md"), "审校报告：未发现任何问题，通过。\n", "utf-8");
    fails = probeCheck(dir, truth);
    assert.ok(fails.some((f) => f.includes("未命中") && f.includes("18,000")));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------- 全绿夹具 ----------

const C1_ORIG = `# Test Doc Intro

Alpha section intro: the system handles 42 items with a special phrase "the quick brown fox" inside.

## Alpha Details

The system supports \`inline_code\` calls with number 1024.

\`\`\`js
const x = verify(1);
\`\`\`
`;

const C1_TRANS = `# 测试文档导言
*Test Doc Intro*

阿尔法导语：该系统（system）处理 42 项条目，内含精选短语敏捷的棕色狐狸（the quick brown fox）。

## 阿尔法细节
*Alpha Details*

系统支持 \`inline_code\` 调用，数量为 1024。

\`\`\`js
const x = verify(1);
\`\`\`
`;

const C2_ORIG = `## Beta Notes

Beta workflow uses URL https://example.com/docs and achieves an 85% hit rate across 30 days.
`;

const C2_TRANS = `## 贝塔注记
*Beta Notes*

贝塔工作流引用 https://example.com/docs，并在 30 天内达到 85% 命中率。
`;

const C3_ORIG = `## Gamma End

Final paragraph wrapping up: not a trivial change, verified twice.
`;

const C3_TRANS = `## 伽马收尾
*Gamma End*

收尾段落：这并非微不足道的改动，已验证两次。
`;

// 组装全绿工作目录（manifest/chunks/译文/裁定/verify 流水/24 份报告/merged/冷读/pm-review/探针 truth+报告）
function greenDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fg-"));
  const origs = { 1: C1_ORIG, 2: C2_ORIG, 3: C3_ORIG };
  const names = { 1: "chunk-01-alpha.md", 2: "chunk-02-beta.md", 3: "chunk-03-gamma.md" };
  const trans = { 1: C1_TRANS, 2: C2_TRANS, 3: C3_TRANS };
  for (const n of [1, 2, 3]) {
    fs.mkdirSync(path.join(dir, "chunks"), { recursive: true });
    fs.mkdirSync(path.join(dir, "translated-chunks"), { recursive: true });
    fs.writeFileSync(path.join(dir, "chunks", names[n]), origs[n], "utf-8");
    fs.writeFileSync(path.join(dir, "translated-chunks", `translated-chunk-${nn2(n)}.md`), trans[n], "utf-8");
  }
  const original = origs[1] + origs[2] + origs[3];
  fs.writeFileSync(path.join(dir, "original-fintest.md"), original, "utf-8");
  const L = [
    "# 分段清单（manifest）",
    "",
    `- 原文：original-fintest.md　sha1（前 12）：${sha12(original)}　1.0KB`,
    "",
    "| NN | 文件 | KB | 行 | sha1 |",
    "|----|------|----|----|------|",
    ...[1, 2, 3].map((n) => `| ${nn2(n)} | ${names[n]} | 0.5 | 1-9 | ${sha12(origs[n])} |`),
  ];
  fs.writeFileSync(path.join(dir, "manifest.md"), L.join("\n") + "\n", "utf-8");

  // 裁定台账（chunk 01 含保留+删除；02/03 空台账）
  fs.mkdirSync(path.join(dir, "adjudications"), { recursive: true });
  fs.writeFileSync(path.join(dir, "adjudications", "adjudication-chunk-01.md"), "# 台账 01\n- «system» → 保留\n- «intro» → 删除\n", "utf-8");
  fs.writeFileSync(path.join(dir, "adjudications", "adjudication-chunk-02.md"), "# 台账 02\n（本 chunk 无 » 标记）\n", "utf-8");
  fs.writeFileSync(path.join(dir, "adjudications", "adjudication-chunk-03.md"), "# 台账 03\n（本 chunk 无 » 标记）\n", "utf-8");

  // 精选表（R23：chunk 01 原文含左值）
  fs.writeFileSync(path.join(dir, "special-phrases-fintest.md"), "# 精选表\nthe quick brown fox :: 敏捷的棕色狐狸\n", "utf-8");

  // glossary（R8-c 重推导源：system 出现于 chunk 01 原文、译文含「系统」——正向兑现）
  fs.writeFileSync(path.join(dir, "glossary-fintest.md"), "# 术语表\n\n| English Term | Translation | Context |\n|---|---|---|\n| system | 系统 | 语境 |\n", "utf-8");

  // verify 流水（merge 的筛选依据；final-gate 不信它、自己重跑）
  fs.writeFileSync(
    path.join(dir, "verify-results.json"),
    JSON.stringify({ results: [1, 2, 3].map((n) => ({ nn: n, passed: true, translationSha: sha12(trans[n]) })) }),
    "utf-8"
  );

  // 全量审校报告（4 维 × 2 半块 × 3 chunk；头部 sha fresh；内容互异防模板签名）
  fs.mkdirSync(path.join(dir, "reviews"), { recursive: true });
  const halves = (n) => ({
    a: halfSha(trans[n], "a"),
    b: halfSha(trans[n], "b"),
  });
  const hmap = { 1: halves(1), 2: halves(2), 3: halves(3) };
  for (const n of [1, 2, 3]) {
    for (const dim of DIMS) {
      for (const h of ["a", "b"]) {
        const body = `sha: ${hmap[n][h]}\nmodel: test\n结论：本半块（${dim} ${h}，chunk ${nn2(n)}）审校通过。观察：术语一致、数字无误、指代清晰、行文自然，无阻断性发现。\n`;
        fs.writeFileSync(path.join(dir, "reviews", `review-${dim}-chunk-${nn2(n)}${h}.md`), body, "utf-8");
      }
    }
  }

  // 探针 truth + 报告（命中：报告引用 expectedHit）
  const truth = generate({ seed: 5 });
  const truthFile = path.join(dir, "..", `fg-truth-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.json`);
  fs.writeFileSync(truthFile, JSON.stringify(truth), "utf-8");
  for (const t of truth) {
    const body = `sha: ${sha12(t.text)}\nmodel: test\n发现：植入缺陷已抓到——${t.defectType}（特征串「${t.expectedHit}」出现在样本中）。判定打回，建议修复后复核该处。\n`;
    fs.writeFileSync(path.join(dir, "reviews", `review-${t.dim}-chunk-${nn2(t.virtualNn)}${t.half}.md`), body, "utf-8");
  }

  // merge（真实走 merge.mjs——final-gate 的 diff 复用其纯函数，此处顺带集成）
  const mr = runMerge(dir);
  assert.equal(mr.exitCode, 0, "夹具 merge 应成功：" + JSON.stringify(mr.errors));
  const mergedSha = mr.mergedSha;

  // 冷读台账（逐 chunk sha 覆盖）
  fs.writeFileSync(
    path.join(dir, "cold-read-fintest.md"),
    ["# 冷读台账（fintest）", "", ...[1, 2, 3].map((n) => `- chunk ${nn2(n)}: sha ${sha12(trans[n])}（发现 0）`), "", "结论：未发现文风断裂或跨章不一致。\n"].join("\n"),
    "utf-8"
  );

  // pm-review（R15 锚 + 必备选样 + 五维合规）
  fs.writeFileSync(
    path.join(dir, "pm-review-fintest.md"),
    [
      "# PM 通读（fintest）",
      "",
      `merged-sha: ${mergedSha}`,
      "",
      "## 选样清单",
      "- chunk 03: 选样结论：术语处理一致、数字无误、接缝自然，可放行。",
      "",
      "## 步骤合规表",
      "- 准确性（accuracy）：✅ 全覆盖，无阻断发现",
      "- 翻译腔（translationese）：✅ 连接词与指代达标",
      "- AI 味（ai-tone）：✅ 无套话堆叠",
      "- 可读性（readability）：✅ 断句合理",
      "- 冷读（cold-read）：✅ 发现已清零",
      "",
    ].join("\n"),
    "utf-8"
  );

  return { dir, truthFile, truth, mergedSha, trans, names };
}

function halfSha(text, h) {
  const paras = text.split(/\n{2,}/);
  const total = Buffer.byteLength(text, "utf-8");
  let acc = 0;
  let best = { idx: 0, diff: Infinity };
  for (let i = 0; i < paras.length; i++) {
    acc += Buffer.byteLength(paras[i], "utf-8") + (i < paras.length - 1 ? 2 : 0);
    const diff = Math.abs(acc - total / 2);
    if (diff < best.diff) best = { idx: i + 1, diff };
  }
  const t = h === "a" ? paras.slice(0, best.idx).join("\n\n") : paras.slice(best.idx).join("\n\n");
  return sha12(t);
}

// ---------- PASS 主路径 ----------

test("PASS：全绿目录 → 原子改名 + REPORT 定稿 + G1 回显 + events（重执行一切全过）", () => {
  const { dir, truthFile, truth } = greenDir();
  try {
    const r = runGate(dir, { probeTruth: truthFile });
    assert.deepEqual(r.fails, [], JSON.stringify(r.fails, null, 2));
    assert.equal(r.exitCode, 0);
    assert.equal(r.passed, true);
    // 原子改名
    const deliverable = path.join(dir, "translated-fintest-zh.md");
    assert.ok(fs.existsSync(deliverable), "交付物落盘");
    assert.ok(!fs.existsSync(path.join(dir, "merged-draft.md")), "临时名消失");
    // 裁决 B：元信息头前置（字段 = delivery-template 第二节；头在最前，标题 H1 由 chunk 01 自带）
    const dv = fs.readFileSync(deliverable, "utf-8");
    assert.ok(dv.startsWith("> **原文**："), "元信息块在最前");
    assert.ok(/^> \*\*风格\*\*：意译$/m.test(dv), "风格行（brief 缺省 = 意译）");
    assert.ok(/^> \*\*字数\*\*：\d+（汉字）$/m.test(dv), "字数行（CJK 计数）");
    assert.ok(/^---\s*$/m.test(dv), "分隔线");
    assert.ok(!fs.existsSync(deliverable + ".tmp"), "无临时件残留");
    // REPORT：sha 锚（R18-⑥）+ G1 回显 + 探针人话
    const report = fs.readFileSync(path.join(dir, "REPORT.md"), "utf-8");
    assert.ok(report.includes("可发布"));
    assert.ok(report.includes(`sha1 前 12：${sha12(fs.readFileSync(deliverable, "utf-8"))}`), "交付物 sha 内容锚");
    assert.ok(report.includes(`原文 sha1（前 12）：${sha12(fs.readFileSync(path.join(dir, "original-fintest.md"), "utf-8"))}`), "G1 回显");
    assert.ok(report.includes("故意埋错"), "探针人话括注（R20）");
    assert.ok(report.includes("探针：4 发命中 4/4"));
    // events
    const ev = fs.readFileSync(path.join(dir, "events.jsonl"), "utf-8").trim().split("\n").map((l) => JSON.parse(l));
    const fg = ev.filter((e) => e.ev === "final-gate");
    assert.equal(fg.length, 1);
    assert.equal(fg[0].passed, true);
    assert.ok(fg[0].deliverableSha);
    assert.ok(!fs.existsSync(path.join(dir, "pending.md")));
    // 摘要（stdout 内联件）
    assert.ok(r.summary.includes("translated-fintest-zh.md"));
    assert.ok(r.summary.includes("抽查"));
  } finally {
    fs.rmSync(truthFile, { force: true });
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("裁决 B：renderMetaHeader/stripMetaHeader 纯函数往返 + 字段来源", () => {
  const body = "# 中文标题\n*English Title*\n\n正文一段。\n";
  const header = renderMetaHeader({
    originalText: "# English Title\n\nBody…",
    briefText: "风格: 直译\n作者: Someone\n来源: https://example.com/a\n",
    mergedText: body,
  });
  assert.ok(header.startsWith("> **原文**：English Title"));
  assert.match(header, /^> \*\*作者\*\*：Someone$/m);
  assert.match(header, /^> \*\*来源\*\*：https:\/\/example\.com\/a$/m);
  assert.match(header, /^> \*\*风格\*\*：直译$/m);
  assert.match(header, /^> \*\*字数\*\*：\d+（汉字）$/m);
  assert.match(header, /\n---\n\n$/);
  // 往返：去头还原纯拼接正文
  assert.equal(stripMetaHeader(header + body), body);
  // 无头文本原样返回（手改件不误剥）
  assert.equal(stripMetaHeader("# 手改\n内容"), "# 手改\n内容");
  // brief 无风格行 → 缺省意译；作者/来源缺行 → 空值行仍在（delivery-template 形态）
  const h2 = renderMetaHeader({ originalText: "", briefText: "", mergedText: "中文字" });
  assert.match(h2, /^> \*\*风格\*\*：意译$/m);
  assert.match(h2, /^> \*\*作者\*\*：$/m);
});

test("裁决 B：幂等重入——PASS 后再跑（merged-draft 已删）→ 去头比对一致，不误报手改", () => {
  const { dir, truthFile } = greenDir();
  try {
    const first = runGate(dir, { probeTruth: truthFile });
    assert.equal(first.exitCode, 0);
    assert.ok(!fs.existsSync(path.join(dir, "merged-draft.md")), "首次 PASS 已删临时稿");
    const second = runGate(dir, { probeTruth: truthFile });
    assert.equal(second.exitCode, 0, JSON.stringify(second.fails, null, 2));
    assert.equal(second.passed, true);
    assert.equal(second.delivered, true);
    assert.ok(!second.fails.some((f) => f.check === "deliverable-guard"), "不得误报手改（R18-⑥）");
  } finally {
    fs.rmSync(truthFile, { force: true });
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// T1.4 回归 fixture（兑现 T1.1 勘察）：术语统一轻命令的终检重入模拟——PASS 后根级出现
// bilingual 派生文件再跑 runGate，判定必须不变（bilingual 不命中任何判定输入）
test("T1.1 兑现：PASS 后生成双语派生文件再跑终检 → 判定不变（bilingual 零影响）", () => {
  const { dir, truthFile } = greenDir();
  try {
    const first = runGate(dir, { probeTruth: truthFile });
    assert.equal(first.exitCode, 0, JSON.stringify(first.fails, null, 2));
    const d = runDerive(dir);
    assert.equal(d.exitCode, 0, JSON.stringify(d.errors));
    assert.ok(fs.existsSync(path.join(dir, "translated-fintest-bilingual.md")), "双语派生文件在位");
    const second = runGate(dir, { probeTruth: truthFile });
    assert.equal(second.exitCode, 0, JSON.stringify(second.fails, null, 2));
    assert.equal(second.passed, true);
    assert.ok(!JSON.stringify(second.fails).includes("bilingual"), "bilingual 文件不得进入任何判定");
  } finally {
    fs.rmSync(truthFile, { force: true });
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("R8-c：投影条目译名未兑现 → scoped FAIL（term-fidelity）；缺 glossary → global", () => {
  const { dir, truthFile } = greenDir();
  try {
    // 追加条目：hit rate 出现于 chunk 02 原文，译文只写「命中率」——既定译名「命中比率」未兑现
    fs.writeFileSync(
      path.join(dir, "glossary-fintest.md"),
      "# 术语表\n\n| English Term | Translation | Context |\n|---|---|---|\n| system | 系统 | 语境 |\n| hit rate | 命中比率 | 语境 |\n",
      "utf-8"
    );
    let r = runGate(dir, { probeTruth: truthFile });
    assert.ok(!r.passed);
    assert.ok(r.fails.some((f) => f.check === "verify" && f.message.includes("term-fidelity") && f.message.includes("hit rate")), `R8-c 打回：${JSON.stringify(r.fails.map((f) => [f.scope, f.check]))}`);
    assert.equal(r.exitCode, 3, "scoped（单 chunk 根因）");
    assert.ok(!fs.existsSync(path.join(dir, "translated-fintest-zh.md")), "FAIL 不得改名");
    // 缺 glossary → global（Step 2 产物破口）
    fs.rmSync(path.join(dir, "glossary-fintest.md"));
    r = runGate(dir, { probeTruth: truthFile });
    assert.equal(r.exitCode, 4);
    assert.ok(r.fails.some((f) => f.check === "completeness" && f.message.includes("glossary")));
  } finally {
    fs.rmSync(truthFile, { force: true });
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("R8-c 零信任：删/改落盘投影文件不影响判定（重推导为准，漂移仅 WARN）", () => {
  const { dir, truthFile } = greenDir();
  try {
    fs.mkdirSync(path.join(dir, "handoff"), { recursive: true });
    fs.writeFileSync(path.join(dir, "handoff", "projection-chunk-01.md"), "# 被篡改的投影\nwhatever :: 什么都行\n", "utf-8");
    const r = runGate(dir, { probeTruth: truthFile });
    assert.equal(r.exitCode, 0, JSON.stringify(r.fails, null, 2));
    assert.ok(r.warns.some((w) => w.includes("投影文件与重推导不一致")), "漂移 WARN");
    assert.ok(!fs.existsSync(path.join(dir, "handoff", "projection-chunk-02.md")), "未生成投影文件不构成 FAIL");
  } finally {
    fs.rmSync(truthFile, { force: true });
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------- 重执行一切 ----------

test("重执行：篡改译文数字（merge 后）→ verify 重跑打回 + merged diff 归因该 chunk（scoped，退出码 3）", () => {
  const { dir, truthFile } = greenDir();
  try {
    const tp = path.join(dir, "translated-chunks", "translated-chunk-02.md");
    fs.writeFileSync(tp, fs.readFileSync(tp, "utf-8").replace("85%", "58%"), "utf-8");
    const r = runGate(dir, { probeTruth: truthFile });
    assert.equal(r.exitCode, 3, JSON.stringify(r.fails.map((f) => f.message)));
    assert.equal(r.radius, "scoped");
    assert.deepEqual(r.scopedChunks, [2]);
    assert.ok(r.fails.some((f) => f.check === "verify" && f.message.includes("number-fidelity")));
    assert.ok(r.fails.some((f) => f.check === "merged" && f.message.includes("02")));
    assert.ok(!fs.existsSync(path.join(dir, "translated-fintest-zh.md")), "FAIL 不得改名");
    assert.ok(fs.existsSync(path.join(dir, "merged-draft.md")), "临时稿保留供修复");
  } finally {
    fs.rmSync(truthFile, { force: true });
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("重执行：篡改 merged 本体（译文全干净）→ global（merged 被改，退出码 4）", () => {
  const { dir, truthFile } = greenDir();
  try {
    const mp = path.join(dir, "merged-draft.md");
    fs.writeFileSync(mp, fs.readFileSync(mp, "utf-8").replace("收尾段落", "收尾段落（被改）"), "utf-8");
    const r = runGate(dir, { probeTruth: truthFile });
    assert.equal(r.exitCode, 4);
    assert.equal(r.radius, "global");
    assert.ok(r.fails.some((f) => f.check === "merged" && f.message.includes("本体被改动")));
  } finally {
    fs.rmSync(truthFile, { force: true });
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("重执行：篡改分母（original 追加）→ 拼接 sha 复核失败（global）", () => {
  const { dir, truthFile } = greenDir();
  try {
    fs.appendFileSync(path.join(dir, "original-fintest.md"), "Sneaky appendix.\n");
    const r = runGate(dir, { probeTruth: truthFile });
    assert.equal(r.exitCode, 4);
    assert.ok(r.fails.some((f) => f.check === "denominator"));
  } finally {
    fs.rmSync(truthFile, { force: true });
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("重执行：篡改 chunks/ 实文件（manifest↔磁盘不符 → 拼接复核 global）", () => {
  const { dir, truthFile, names } = greenDir();
  try {
    fs.appendFileSync(path.join(dir, "chunks", names[2]), "tampered\n");
    const r = runGate(dir, { probeTruth: truthFile });
    assert.equal(r.exitCode, 4);
    assert.ok(r.fails.some((f) => f.check === "denominator" && f.message.includes("拼接")));
  } finally {
    fs.rmSync(truthFile, { force: true });
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------- 完备性矩阵 ----------

test("完备性：删一份 accuracy 报告 → scoped FAIL + 准确性无条件措辞", () => {
  const { dir, truthFile } = greenDir();
  try {
    fs.rmSync(path.join(dir, "reviews", "review-accuracy-chunk-01a.md"));
    const r = runGate(dir, { probeTruth: truthFile });
    assert.equal(r.exitCode, 3);
    const f = r.fails.find((x) => x.check === "completeness");
    assert.ok(f.message.includes("accuracy"));
    assert.ok(f.message.includes("无条件 FAIL"), "准确性维度缺失不可降级");
  } finally {
    fs.rmSync(truthFile, { force: true });
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("完备性：报告头部 sha 过期（stale）→ scoped FAIL", () => {
  const { dir, truthFile } = greenDir();
  try {
    const p = path.join(dir, "reviews", "review-readability-chunk-03b.md");
    fs.writeFileSync(p, fs.readFileSync(p, "utf-8").replace(/sha: [0-9a-f]{12}/, "sha: 000000000000"), "utf-8");
    const r = runGate(dir, { probeTruth: truthFile });
    assert.equal(r.exitCode, 3);
    assert.ok(r.fails.some((f) => f.check === "completeness" && f.message.includes("stale")));
  } finally {
    fs.rmSync(truthFile, { force: true });
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("签名：undersize 报告 → FAIL；同内容模板签名 → FAIL", () => {
  const { dir, truthFile } = greenDir();
  try {
    // undersize：把一份报告截短到阈值下
    const p = path.join(dir, "reviews", "review-ai-tone-chunk-02a.md");
    fs.writeFileSync(p, "sha: x\nok\n", "utf-8");
    // 模板签名：两份报告内容相同
    const p2 = path.join(dir, "reviews", "review-ai-tone-chunk-02b.md");
    const p3 = path.join(dir, "reviews", "review-translationese-chunk-03a.md");
    const tpl = "sha: 000000000000\nmodel: t\n一样的模板内容，毫无信息量。\n";
    fs.writeFileSync(p2, tpl, "utf-8");
    fs.writeFileSync(p3, tpl, "utf-8");
    const r = runGate(dir, { probeTruth: truthFile });
    assert.ok(r.fails.some((f) => f.check === "signature" && f.message.includes("undersize")));
    assert.ok(r.fails.some((f) => f.check === "signature" && f.message.includes("模板签名")));
  } finally {
    fs.rmSync(truthFile, { force: true });
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------- G3 / R23 ----------

test("G3：台账保留缺兑现 / 未裁定直接括注 / 空集对非空台账（清判定不动译文，隔离归因）", () => {
  // a. ledger 增加保留条目（译文没有）→ 缺兑现
  const a = greenDir();
  try {
    fs.appendFileSync(path.join(a.dir, "adjudications", "adjudication-chunk-02.md"), "- «ghost» → 保留\n");
    const r = runGate(a.dir, { probeTruth: a.truthFile });
    assert.ok(r.fails.some((f) => f.check === "annotation" && f.message.includes("ghost") && f.message.includes("缺失")), JSON.stringify(r.fails.map((x) => x.message)));
    assert.equal(r.exitCode, 3, "单 chunk 半径");
  } finally {
    fs.rmSync(a.truthFile, { force: true });
    fs.rmSync(a.dir, { recursive: true, force: true });
  }
  // b. ledger 删除保留行（译文的括注变成未裁定）→ 直接括注违规
  const b = greenDir();
  try {
    fs.writeFileSync(path.join(b.dir, "adjudications", "adjudication-chunk-01.md"), "# 台账 01\n- «intro» → 删除\n");
    const r = runGate(b.dir, { probeTruth: b.truthFile });
    assert.ok(r.fails.some((f) => f.check === "annotation" && f.message.includes("system") && f.message.includes("未裁定")));
  } finally {
    fs.rmSync(b.truthFile, { force: true });
    fs.rmSync(b.dir, { recursive: true, force: true });
  }
  // c. 非空应兑现集 + 译文零括注 → 空集 FAIL（G3 条款）
  const c = greenDir();
  try {
    fs.writeFileSync(path.join(c.dir, "adjudications", "adjudication-chunk-03.md"), "# 台账 03\n- «ghost» → 保留\n");
    const r = runGate(c.dir, { probeTruth: c.truthFile });
    assert.ok(r.fails.some((f) => f.check === "annotation" && f.message.includes("空洞合规")));
  } finally {
    fs.rmSync(c.truthFile, { force: true });
    fs.rmSync(c.dir, { recursive: true, force: true });
  }
});

test("R23：精选表形态不符 → FAIL；无精选表文件 → 不报错", () => {
  const { dir, truthFile } = greenDir();
  try {
    fs.writeFileSync(path.join(dir, "special-phrases-fintest.md"), "the quick brown fox :: 另一个译法\n", "utf-8");
    const r = runGate(dir, { probeTruth: truthFile });
    assert.ok(r.fails.some((f) => f.check === "r23" && f.message.includes("精选表未兑现")), JSON.stringify(r.fails.map((x) => x.message)));
  } finally {
    fs.rmSync(truthFile, { force: true });
    fs.rmSync(dir, { recursive: true, force: true });
  }
  const b = greenDir();
  try {
    fs.rmSync(path.join(b.dir, "special-phrases-fintest.md"));
    const r = runGate(b.dir, { probeTruth: b.truthFile });
    // r23 判据无输入不误报；但原 R23 括注失去依据 → G3 报"未裁定直接括注"（零信任：删参数源不消解已交付括注）
    assert.ok(!r.fails.some((f) => f.check === "r23"), "无精选表 = 该判据无输入，不报错");
    assert.ok(r.fails.some((f) => f.check === "annotation" && f.message.includes("the quick brown fox")), "括注依据随文件消失 → G3 报未裁定");
  } finally {
    fs.rmSync(b.truthFile, { force: true });
    fs.rmSync(b.dir, { recursive: true, force: true });
  }
});

// ---------- 标题双语锚 ----------

test("标题锚：merged 缺锚行 → global FAIL", () => {
  const { dir, truthFile } = greenDir();
  try {
    const mp = path.join(dir, "merged-draft.md");
    fs.writeFileSync(mp, fs.readFileSync(mp, "utf-8").replace("*Alpha Details*\n", ""), "utf-8");
    const r = runGate(dir, { probeTruth: truthFile });
    assert.ok(r.fails.some((f) => f.check === "heading-anchor" && f.message.includes("锚")), JSON.stringify(r.fails.map((x) => `${x.check}:${x.message}`)));
    assert.equal(r.exitCode, 4);
  } finally {
    fs.rmSync(truthFile, { force: true });
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("标题锚：brief 关闭 → 跳过并披露，其余全过仍 PASS", () => {
  const { dir, truthFile } = greenDir();
  try {
    fs.writeFileSync(path.join(dir, "brief.md"), "# brief\n标题双语锚: off\n", "utf-8");
    const r = runGate(dir, { probeTruth: truthFile });
    assert.equal(r.exitCode, 0, JSON.stringify(r.fails.map((f) => f.message)));
    const report = fs.readFileSync(path.join(dir, "REPORT.md"), "utf-8");
    assert.ok(report.includes("跳过") && report.includes("brief"), "REPORT 记录跳过");
  } finally {
    fs.rmSync(truthFile, { force: true });
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------- G4 / R15 ----------

test("G4：冷读覆盖缺 chunk → global；pm-review 选样缺 → global；维度 SKIPPED → global", () => {
  const a = greenDir();
  try {
    const cp = path.join(a.dir, "cold-read-fintest.md");
    fs.writeFileSync(cp, fs.readFileSync(cp, "utf-8").replace(/- chunk 03: sha [0-9a-f]{12}（发现 0）\n/, ""), "utf-8");
    const r = runGate(a.dir, { probeTruth: a.truthFile });
    assert.ok(r.fails.some((f) => f.check === "g4" && f.message.includes("冷读覆盖矩阵缺")));
  } finally {
    fs.rmSync(a.truthFile, { force: true });
    fs.rmSync(a.dir, { recursive: true, force: true });
  }
  const b = greenDir();
  try {
    const pp = path.join(b.dir, "pm-review-fintest.md");
    fs.writeFileSync(pp, fs.readFileSync(pp, "utf-8").replace(/- chunk 03: .*。\n/, ""), "utf-8");
    const r = runGate(b.dir, { probeTruth: b.truthFile });
    assert.ok(r.fails.some((f) => f.check === "g4" && f.message.includes("选样缺")));
  } finally {
    fs.rmSync(b.truthFile, { force: true });
    fs.rmSync(b.dir, { recursive: true, force: true });
  }
  const c = greenDir();
  try {
    const pp = path.join(c.dir, "pm-review-fintest.md");
    fs.writeFileSync(pp, fs.readFileSync(pp, "utf-8").replace("- 准确性（accuracy）：✅ 全覆盖，无阻断发现", "- 准确性（accuracy）：SKIPPED（跳过）"), "utf-8");
    const r = runGate(c.dir, { probeTruth: c.truthFile });
    assert.ok(r.fails.some((f) => f.check === "g4" && f.message.includes("SKIPPED")));
  } finally {
    fs.rmSync(c.truthFile, { force: true });
    fs.rmSync(c.dir, { recursive: true, force: true });
  }
});

test("R15：pm-review 头部 merged-sha 过期 → global FAIL（不豁免）", () => {
  const { dir, truthFile } = greenDir();
  try {
    const pp = path.join(dir, "pm-review-fintest.md");
    fs.writeFileSync(pp, fs.readFileSync(pp, "utf-8").replace(/merged-sha: [0-9a-f]{12}/, "merged-sha: 000000000000"), "utf-8");
    const r = runGate(dir, { probeTruth: truthFile });
    assert.ok(r.fails.some((f) => f.check === "r15"));
    assert.equal(r.exitCode, 4);
  } finally {
    fs.rmSync(truthFile, { force: true });
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------- 探针 ----------

test("探针：缺 truth 文件 / 缺报告 / 报告未命中 → global FAIL", () => {
  const a = greenDir();
  try {
    const r = runGate(a.dir, {});
    assert.equal(r.exitCode, 4);
    assert.ok(r.fails.some((f) => f.check === "probe" && f.message.includes("--probe-truth")));
  } finally {
    fs.rmSync(a.truthFile, { force: true });
    fs.rmSync(a.dir, { recursive: true, force: true });
  }
  const b = greenDir();
  try {
    fs.rmSync(path.join(b.dir, "reviews", `review-${b.truth[0].dim}-chunk-${nn2(b.truth[0].virtualNn)}${b.truth[0].half}.md`));
    const r = runGate(b.dir, { probeTruth: b.truthFile });
    assert.ok(r.fails.some((f) => f.check === "probe" && f.message.includes("缺报告")));
    assert.equal(r.exitCode, 4);
  } finally {
    fs.rmSync(b.truthFile, { force: true });
    fs.rmSync(b.dir, { recursive: true, force: true });
  }
  const c = greenDir();
  try {
    const t = c.truth[0];
    const p = path.join(c.dir, "reviews", `review-${t.dim}-chunk-${nn2(t.virtualNn)}${t.half}.md`);
    fs.writeFileSync(p, "sha: x\nmodel: t\n审校报告：一切正常，通过，无发现。\n", "utf-8");
    const r = runGate(c.dir, { probeTruth: c.truthFile });
    assert.ok(r.fails.some((f) => f.check === "probe" && f.message.includes("未命中")));
    assert.equal(r.exitCode, 4);
  } finally {
    fs.rmSync(c.truthFile, { force: true });
    fs.rmSync(c.dir, { recursive: true, force: true });
  }
});

// ---------- 新鲜度 / 交付保护 / 连续 FAIL ----------

test("新鲜度：译文 mtime 晚于 merged → 仅 WARN 不 FAIL（硬判 = 内容 sha + 重执行）", () => {
  const { dir, truthFile } = greenDir();
  try {
    const tp = path.join(dir, "translated-chunks", "translated-chunk-02.md");
    const future = new Date(Date.now() + 60000);
    fs.utimesSync(tp, future, future);
    const r = runGate(dir, { probeTruth: truthFile });
    assert.equal(r.exitCode, 0, JSON.stringify(r.fails.map((f) => f.message)));
    assert.ok(r.warns.some((w) => w.includes("translated-chunks/translated-chunk-02.md")), "应有 WARN");
  } finally {
    fs.rmSync(truthFile, { force: true });
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("R18-⑥：已存在不一致交付物 → 拒绝覆盖（手修永不覆盖），exit 4", () => {
  const { dir, truthFile } = greenDir();
  try {
    fs.writeFileSync(path.join(dir, "translated-fintest-zh.md"), "# 用户手改过的版本\n", "utf-8");
    const r = runGate(dir, { probeTruth: truthFile });
    assert.equal(r.exitCode, 4);
    assert.ok(r.fails.some((f) => f.check === "deliverable-guard"));
    assert.equal(fs.readFileSync(path.join(dir, "translated-fintest-zh.md"), "utf-8"), "# 用户手改过的版本\n", "手改保留");
    assert.ok(fs.existsSync(path.join(dir, "merged-draft.md")), "临时稿保留");
  } finally {
    fs.rmSync(truthFile, { force: true });
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("连续 FAIL ≥3 → PENDING-USER（pending.md + suspend 事件）", () => {
  const { dir, truthFile } = greenDir();
  try {
    const cp = path.join(dir, "cold-read-fintest.md");
    fs.writeFileSync(cp, fs.readFileSync(cp, "utf-8").replace(/- chunk 03: sha [0-9a-f]{12}（发现 0）\n/, ""), "utf-8");
    let r;
    for (let i = 0; i < 3; i++) r = runGate(dir, { probeTruth: truthFile });
    assert.equal(r.exitCode, 4);
    assert.ok(fs.existsSync(path.join(dir, "pending.md")), "第 3 次连续 FAIL 转挂起");
    const pending = fs.readFileSync(path.join(dir, "pending.md"), "utf-8");
    assert.ok(pending.includes("pending-user"));
    assert.ok(pending.includes("连续 FAIL"));
    const ev = fs.readFileSync(path.join(dir, "events.jsonl"), "utf-8").trim().split("\n").map((l) => JSON.parse(l));
    assert.ok(ev.some((e) => e.ev === "suspend" && String(e.detail).includes("final-gate")));
  } finally {
    fs.rmSync(truthFile, { force: true });
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("M4 观测#1：挂起态（FAIL≥3 残留 pending.md）续跑至 PASS → 旗标消解；sealed 不被动解", () => {
  const { dir, truthFile } = greenDir();
  try {
    // 场景 a：FAIL≥3 产生 pending.md → 修复（恢复冷读覆盖行）→ 再跑 PASS → pending.md 应被清除
    const cp = path.join(dir, "cold-read-fintest.md");
    const cpText = fs.readFileSync(cp, "utf-8");
    fs.writeFileSync(cp, cpText.replace(/- chunk 03: sha [0-9a-f]{12}（发现 0）\n/, ""), "utf-8");
    for (let i = 0; i < 3; i++) runGate(dir, { probeTruth: truthFile });
    assert.ok(fs.existsSync(path.join(dir, "pending.md")), "前置：FAIL≥3 已挂起");
    fs.writeFileSync(cp, cpText, "utf-8"); // 修复根因
    const r = runGate(dir, { probeTruth: truthFile });
    assert.equal(r.exitCode, 0, JSON.stringify(r.fails.map((f) => f.message)));
    assert.ok(!fs.existsSync(path.join(dir, "pending.md")), "PASS 后挂起旗标应消解");
    const ev = fs.readFileSync(path.join(dir, "events.jsonl"), "utf-8").trim().split("\n").map((l) => JSON.parse(l));
    assert.ok(ev.some((e) => e.ev === "pending-clear"), "应记 pending-clear 事件");
    // 场景 b：sealed（用户显式封存）不由此路径解
    fs.writeFileSync(path.join(dir, "pending.md"), "type: sealed\n封存于 测试\n", "utf-8");
    assert.equal(runGate(dir, { probeTruth: truthFile }).exitCode, 0); // 幂等重入 PASS
    assert.ok(fs.existsSync(path.join(dir, "pending.md")), "sealed 不被 PASS 清除");
    assert.ok(fs.readFileSync(path.join(dir, "pending.md"), "utf-8").includes("sealed"));
  } finally {
    fs.rmSync(truthFile, { force: true });
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("工作目录异常 → 退出码 2；PASS 后再跑（幂等重入）按新产物对账", () => {
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), "fg2-"));
  try {
    const r = runGate(empty, {});
    assert.equal(r.exitCode, 2);
  } finally {
    fs.rmSync(empty, { recursive: true, force: true });
  }
  // PASS 后重跑：交付物 sha === 新产物 sha → 幂等通过（R18-⑥ 一致分支）
  const { dir, truthFile } = greenDir();
  try {
    assert.equal(runGate(dir, { probeTruth: truthFile }).exitCode, 0);
    const again = runGate(dir, { probeTruth: truthFile });
    assert.equal(again.exitCode, 0, JSON.stringify(again.fails.map((f) => f.message)));
  } finally {
    fs.rmSync(truthFile, { force: true });
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------- CLI 冒烟（守卫真实性：Windows pathname 坑曾使入口静默空转、退出码 0） ----------

test("CLI：真实执行——FAIL 目录退出码 4 + REPORT 落盘 + stdout 清单", () => {
  const { dir, truthFile } = greenDir();
  try {
    fs.rmSync(path.join(dir, "cold-read-fintest.md"));
    const r = spawnSync(process.execPath, [SCRIPT, dir, "--probe-truth", truthFile], { encoding: "utf-8" });
    assert.equal(r.status, 4, r.stdout + r.stderr);
    assert.ok(r.stdout.includes("终检 FAIL"), "CLI 应输出 FAIL 结论");
    assert.ok(r.stdout.includes("g4"), "stdout 含 FAIL 清单");
    assert.ok(fs.existsSync(path.join(dir, "REPORT.md")), "REPORT 由 CLI 落盘");
  } finally {
    fs.rmSync(truthFile, { force: true });
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
