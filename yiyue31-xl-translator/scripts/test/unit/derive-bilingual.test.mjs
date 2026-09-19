// derive-bilingual.test.mjs — derive-bilingual.mjs 单元测试（node --test，文件内默认串行，低内存纪律）
//
// 覆盖固定判据 B1-B8（契约登记于 scripts/test/README.md）：
//   B1 只读纪律（唯一产物，其余文件字节不变）
//   B2 chunk 配对精确（乱序/缺译文/多余译文/分母 sha 不符 → 退出码 3）
//   B3 交付物 sha ≠ REPORT 锚 / 正文 ≠ assemble(译文) → 照跑 + WARN
//   B4 fence 感知节切分（锚配对/锚关回退顺序/缺锚整体回退/标题数不等整 chunk 降级/围栏内 # 跳过）
//   B5 块按序配对 + 双级指纹（块数/代码块逐字/isCode/URL 集合 → 节降级）
//   B6 交错格式（头部仅一次/锚行保留/锚关插英文标题行/只交错不改动）
//   B7 幂等（同输入重跑字节相同）
//   B8 降级清单可见（文件尾注释 + stdout + 覆盖率）
//
// 运行：node --test scripts/test/unit/derive-bilingual.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { interleave, runDerive } from "../../derive-bilingual.mjs";

const SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "derive-bilingual.mjs");
const sha12 = (s) => crypto.createHash("sha1").update(s, "utf-8").digest("hex").slice(0, 12);
const sha12Of = (p) => sha12(fs.readFileSync(p, "utf-8"));

// ---------- interleave 纯函数（B4/B5/B6） ----------

const C1_ORIG = `# Alpha Intro

Alpha paragraph one mentions 42 items.

\`\`\`js
const x = verify(1);
\`\`\`

## Alpha Details

Details paragraph with https://example.com/alpha link.
`;

const C1_ZH = `# 阿尔法导言
*Alpha Intro*

阿尔法第一段提到 42 项条目。

\`\`\`js
const x = verify(1);
\`\`\`

## 阿尔法细节
*Alpha Details*

细节段落引用 https://example.com/alpha 链接。
`;

const C2_ORIG = `## Beta Notes

Beta workflow uses https://example.com/docs and achieves 85%.
`;

const C2_ZH = `## 贝塔注记
*Beta Notes*

贝塔工作流引用 https://example.com/docs，达到 85%。
`;

test("B4/B6：锚开对齐正常——锚行原样保留（紧随标题行）、中文在上英文在下、代码块逐字两侧各一份", () => {
  const r = interleave(C1_ORIG, C1_ZH);
  assert.equal(r.mode, "anchor");
  assert.deepEqual(r.degraded, []);
  assert.equal(r.totalSections, 2);
  // 锚行紧随标题行（原样，不插空行）
  assert.ok(r.text.includes("# 阿尔法导言\n*Alpha Intro*"));
  assert.ok(r.text.includes("## 阿尔法细节\n*Alpha Details*"));
  // 中文在上英文在下
  assert.ok(r.text.indexOf("阿尔法第一段") < r.text.indexOf("Alpha paragraph"));
  assert.ok(r.text.indexOf("细节段落") < r.text.indexOf("Details paragraph"));
  // 代码块两侧各一份（zh/en 逐字相同）
  assert.equal(r.text.split("const x = verify(1);").length, 3, "代码块出现两次（含围栏行内代码各一）");
});

test("B4：锚关 → 整体顺序配对 + 插英文标题行（英文标题信息恰好一次）", () => {
  const r = interleave(C1_ORIG, C1_ZH, { anchor: false });
  assert.equal(r.mode, "order");
  assert.deepEqual(r.degraded, []);
  // 锚关时 zh 侧锚行仍在（译文自带）——但 mode 为 order；去掉锚行的译文则插合成锚
  const zhNoAnchor = C1_ZH.replace(/\*Alpha Intro\*\n/, "").replace(/\*Alpha Details\*\n/, "");
  const r2 = interleave(C1_ORIG, zhNoAnchor, { anchor: false });
  assert.equal(r2.mode, "order");
  assert.deepEqual(r2.degraded, []);
  assert.ok(r2.text.includes("# 阿尔法导言\n*Alpha Intro*"), "缺锚时插 *English* 行");
  assert.ok(r2.text.includes("## 阿尔法细节\n*Alpha Details*"));
  assert.equal(r2.text.split("*Alpha Intro*").length, 2, "英文标题恰好一次");
});

test("B4：锚开但缺一锚行 → 整体回退顺序配对（仍对齐，不降级）", () => {
  const zhBad = C1_ZH.replace("*Alpha Details*\n", "");
  const r = interleave(C1_ORIG, zhBad);
  assert.equal(r.mode, "order");
  assert.deepEqual(r.degraded, []);
  assert.ok(r.text.includes("## 阿尔法细节\n*Alpha Details*"), "缺锚节插合成英文标题行");
});

test("B4：标题数不等 → 整 chunk 降级对照（zh 全文 + 注释标记 + en 全文）", () => {
  const zhOne = C1_ZH.split("## 阿尔法细节")[0];
  const r = interleave(C1_ORIG, zhOne);
  assert.equal(r.mode, "degraded");
  assert.equal(r.degraded.length, 1);
  assert.ok(r.degraded[0].reason.includes("标题数不等"));
  assert.ok(r.text.includes("双语对照·降级"));
  assert.ok(r.text.includes("阿尔法导言") && r.text.includes("Alpha Intro"));
});

test("B4：围栏内 # 不是标题——代码块整块不切分", () => {
  const orig = `# Real Heading

Before fence.

\`\`\`bash
# not a heading inside fence
echo hi
\`\`\`

After fence.
`;
  const zh = `# 真标题
*Real Heading*

围栏之前。

\`\`\`bash
# not a heading inside fence
echo hi
\`\`\`

围栏之后。
`;
  const r = interleave(orig, zh);
  assert.equal(r.mode, "anchor");
  assert.deepEqual(r.degraded, []);
  assert.equal(r.totalSections, 1, "围栏内 # 不产生节");
  assert.ok(r.text.includes("# not a heading inside fence\necho hi"), "围栏块整块保留");
});

test("B5：块数不匹配（译文一段拆两段）→ 该节降级节级对照", () => {
  const zh = C1_ZH.replace("细节段落引用 https://example.com/alpha 链接。", "细节段落。\n\n引用 https://example.com/alpha 链接。"); // 一段拆二
  const r = interleave(C1_ORIG, zh);
  assert.equal(r.degraded.length, 1);
  assert.ok(r.degraded[0].reason.includes("块数不匹配"));
  assert.ok(r.text.includes("双语对照·降级"));
  // 降级节内容双侧全量在场
  assert.ok(r.text.includes("Details paragraph"));
  assert.ok(r.text.includes("细节段落"));
});

test("B5：URL 集合不符 → 该节降级", () => {
  const zh = C1_ZH.replace("https://example.com/alpha", "https://example.com/other");
  const r = interleave(C1_ORIG, zh);
  assert.ok(r.degraded.some((d) => d.reason.includes("URL")));
});

test("B5：代码块被改（非逐字）→ 该节降级；isCode 不一致同理", () => {
  const zh = C1_ZH.replace("const x = verify(1);", "const x = verify(2);");
  const r = interleave(C1_ORIG, zh);
  assert.ok(r.degraded.some((d) => d.reason.includes("代码块")), "代码块指纹不符");
  const zh2 = C1_ZH.replace("```js\nconst x = verify(1);\n```", "普通段落不是代码块");
  const r2 = interleave(C1_ORIG, zh2);
  assert.ok(r2.degraded.length >= 1, "isCode 不一致/块形态变化触发降级");
});

// ---------- 工作目录夹具（runDerive） ----------

// 造一个已交付形态的工作目录：original + chunks + translated + manifest + 交付物 + REPORT + brief
function makeDir(opts = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dbl-"));
  const origs = { 1: C1_ORIG, 2: C2_ORIG };
  const zh = { 1: opts.zh1 ?? C1_ZH, 2: opts.zh2 ?? C2_ZH };
  const names = { 1: "chunk-01-alpha.md", 2: "chunk-02-beta.md" };
  for (const n of [1, 2]) {
    fs.mkdirSync(path.join(dir, "chunks"), { recursive: true });
    fs.mkdirSync(path.join(dir, "translated-chunks"), { recursive: true });
    fs.writeFileSync(path.join(dir, "chunks", names[n]), origs[n], "utf-8");
    if (!opts.missingTranslated?.includes(n)) {
      fs.writeFileSync(path.join(dir, "translated-chunks", `translated-chunk-${String(n).padStart(2, "0")}.md`), zh[n], "utf-8");
    }
  }
  const original = origs[1] + origs[2];
  fs.writeFileSync(path.join(dir, "original-demo.md"), original, "utf-8");
  const L = [
    "# 分段清单（manifest）",
    "",
    `- 原文：original-demo.md　sha1（前 12）：${sha12(original)}　1.0KB`,
    "",
    "| NN | 文件 | KB | 行 | sha1 |",
    "|----|------|----|----|------|",
    `| 01 | ${names[1]} | 0.5 | 1-9 | ${opts.manifestSha1 ?? sha12(origs[1])} |`,
    `| 02 | ${names[2]} | 0.5 | 1-3 | ${sha12(origs[2])} |`,
  ];
  fs.writeFileSync(path.join(dir, "manifest.md"), L.join("\n") + "\n", "utf-8");

  // 交付物（元信息头 + 纯拼接正文，裁决 B 形态）
  const body = zh[1] + zh[2];
  const deliverable = [
    "> **原文**：Alpha Doc",
    "> **作者**：Test Author",
    "> **来源**：https://example.com/src",
    "> **翻译日期**：2026-09-19",
    "> **风格**：意译",
    "> **字数**：123（汉字）",
    "",
    "---",
    "",
    body,
  ].join("\n");
  fs.writeFileSync(path.join(dir, "translated-demo-zh.md"), deliverable, "utf-8");
  // REPORT 锚（可错——B3 用）
  const anchoredSha = opts.reportAnchorOverride ?? sha12(deliverable);
  fs.writeFileSync(path.join(dir, "REPORT.md"), `# REPORT\n\n- 交付物：translated-demo-zh.md（sha1 前 12：${anchoredSha}）——内容锚\n`, "utf-8");
  if (opts.brief !== null) fs.writeFileSync(path.join(dir, "brief.md"), opts.brief ?? "受众：技术读者\n标题双语锚：开\n", "utf-8");
  return dir;
}

// ---------- runDerive 主路径（B1/B2/B3/B6/B7/B8） ----------

test("happy：生成双语文件——头部照抄+双语版行（源交付物 sha）、交错正文、尾注覆盖率；幂等重跑字节相同（B6/B7/B8）", () => {
  const dir = makeDir();
  try {
    const r1 = runDerive(dir);
    assert.equal(r1.exitCode, 0, JSON.stringify(r1.errors));
    assert.equal(r1.coverage.degraded, 0);
    assert.equal(r1.coverage.total, 3); // C1 两节 + C2 一节
    const out = path.join(dir, "translated-demo-bilingual.md");
    assert.ok(fs.existsSync(out));
    const text = fs.readFileSync(out, "utf-8");
    const dvSha = sha12Of(path.join(dir, "translated-demo-zh.md"));
    // 头部：交付物头照抄 + 引用块内追加双语版行（在 --- 之前）
    assert.ok(text.startsWith("> **原文**：Alpha Doc"));
    assert.ok(text.includes(`> **双语版**：`));
    assert.ok(text.includes(`源交付物 sha1（前 12）：${dvSha}`));
    const hrIdx = text.split("\n").findIndex((l) => /^---\s*$/.test(l));
    assert.ok(text.split("\n").slice(0, hrIdx).some((l) => l.startsWith("> **双语版**")), "双语版行在引用块内（--- 之前）");
    assert.ok(text.includes("翻译日期"));
    // 尾注（B8）：覆盖率 + 零降级
    assert.ok(text.includes("derive-bilingual：对齐覆盖率 3/3 节（100.0%）｜降级 0 节"));
    // 交错正文在头与尾注之间
    assert.ok(text.indexOf("阿尔法导言") < text.indexOf("Alpha Intro"));
    // 幂等（B7）
    const before = fs.readFileSync(out, "utf-8");
    const r2 = runDerive(dir);
    assert.equal(r2.exitCode, 0);
    assert.equal(fs.readFileSync(out, "utf-8"), before, "同输入重跑字节相同");
    // events 追加（audit 流水）
    const ev = fs.readFileSync(path.join(dir, "events.jsonl"), "utf-8").trim().split("\n").map((l) => JSON.parse(l));
    assert.ok(ev.some((e) => e.ev === "derive-bilingual"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("B1 只读纪律：交付物/原文/chunks/译文/manifest 运行前后字节不变", () => {
  const dir = makeDir();
  try {
    const snap = (rel) => fs.readFileSync(path.join(dir, rel), "utf-8");
    const before = {
      dv: snap("translated-demo-zh.md"),
      orig: snap("original-demo.md"),
      m: snap("manifest.md"),
      c1: snap("chunks/chunk-01-alpha.md"),
      t1: snap("translated-chunks/translated-chunk-01.md"),
    };
    runDerive(dir);
    assert.equal(snap("translated-demo-zh.md"), before.dv);
    assert.equal(snap("original-demo.md"), before.orig);
    assert.equal(snap("manifest.md"), before.m);
    assert.equal(snap("chunks/chunk-01-alpha.md"), before.c1);
    assert.equal(snap("translated-chunks/translated-chunk-01.md"), before.t1);
    assert.ok(fs.readdirSync(dir).filter((f) => f.startsWith("translated-demo-bilingual")).length <= 1, "唯一产物");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("B3：交付物手改（sha ≠ REPORT 锚 + 正文 ≠ assemble）→ 照跑 + WARN，头部锚当前交付物 sha", () => {
  const dir = makeDir();
  try {
    const dv = path.join(dir, "translated-demo-zh.md");
    fs.writeFileSync(dv, fs.readFileSync(dv, "utf-8").replace("阿尔法第一段", "手改后的第一段"), "utf-8");
    const r = runDerive(dir);
    assert.equal(r.exitCode, 0, "手改照跑，不阻塞");
    assert.ok(r.warnings.some((w) => w.includes("REPORT 锚")), "REPORT 锚 WARN");
    assert.ok(r.warnings.some((w) => w.includes("assemble")), "assemble diff WARN");
    const out = fs.readFileSync(path.join(dir, "translated-demo-bilingual.md"), "utf-8");
    assert.ok(out.includes(`源交付物 sha1（前 12）：${sha12Of(dv)}`), "头部锚 = 当前交付物 sha（status 三态数据源）");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("B2：无交付物 → 退出码 3 可操作报错", () => {
  const dir = makeDir();
  try {
    fs.rmSync(path.join(dir, "translated-demo-zh.md"));
    const r = runDerive(dir);
    assert.equal(r.exitCode, 3);
    assert.ok(r.errors.join("").includes("无交付物"));
    assert.ok(!fs.existsSync(path.join(dir, "translated-demo-bilingual.md")));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("B2：分母 sha 不符（manifest ≠ chunks/ 实文件）→ 退出码 3", () => {
  const dir = makeDir({ manifestSha1: "deadbeefdead" });
  try {
    const r = runDerive(dir);
    assert.equal(r.exitCode, 3);
    assert.ok(r.errors.join("").includes("sha"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("B2：缺译文 / 多余译文 → 退出码 3", () => {
  const dir = makeDir({ missingTranslated: [2] });
  try {
    let r = runDerive(dir);
    assert.equal(r.exitCode, 3);
    assert.ok(r.errors.join("").includes("缺译文"));
    // 补回 02 使目录自洽，再加孤儿 07（否则先命中缺译文分支）
    fs.writeFileSync(path.join(dir, "translated-chunks", "translated-chunk-02.md"), C2_ZH, "utf-8");
    fs.writeFileSync(path.join(dir, "translated-chunks", "translated-chunk-07.md"), "孤儿\n", "utf-8");
    r = runDerive(dir);
    assert.equal(r.exitCode, 3);
    assert.ok(r.errors.join("").includes("多余译文"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("退出码 2：工作目录异常（无 manifest）", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dbl2-"));
  try {
    fs.writeFileSync(path.join(dir, "original-demo.md"), "x", "utf-8");
    const r = runDerive(dir);
    assert.equal(r.exitCode, 2);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("B8：节降级随输出可见——文件尾注释清单 + stdout 明细 + 覆盖率", () => {
  const zh2Degraded = C2_ZH.replace("https://example.com/docs，达到 85%。", "没有链接的段落。"); // URL 集合不符
  const dir = makeDir({ zh2: zh2Degraded });
  try {
    const r = runDerive(dir);
    assert.equal(r.exitCode, 0);
    assert.equal(r.coverage.degraded, 1);
    assert.ok(r.coverage.pct.startsWith("66."));
    const text = fs.readFileSync(path.join(dir, "translated-demo-bilingual.md"), "utf-8");
    assert.ok(text.includes("- chunk 02「贝塔注记」：URL 集合不符"), "尾注清单点名降级节");
    assert.ok(text.includes("双语对照·降级：chunk 02「贝塔注记」"), "节内注释标记");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("brief 锚关 → 顺序配对（anchorPairing=false，仍可对齐）", () => {
  const dir = makeDir({ brief: "受众：技术读者\n标题双语锚: off\n" });
  try {
    const r = runDerive(dir);
    assert.equal(r.exitCode, 0);
    assert.equal(r.anchorPairing, false);
    assert.equal(r.coverage.degraded, 0, "锚关走顺序配对，不降级");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------- CLI 冒烟（守卫真实性：Windows 入口假绿教训） ----------

test("CLI：真实执行（产物落盘 + stdout 结论），非静默空转", () => {
  const dir = makeDir();
  try {
    const run = spawnSync(process.execPath, [SCRIPT, dir], { encoding: "utf-8" });
    assert.equal(run.status, 0, run.stdout + run.stderr);
    assert.ok(run.stdout.includes("双语对照已生成"), "CLI 应真实执行并给结论");
    assert.ok(fs.existsSync(path.join(dir, "translated-demo-bilingual.md")), "产物由 CLI 落盘");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("CLI：无参数 → 退出码 1 打印用法", () => {
  const run = spawnSync(process.execPath, [SCRIPT], { encoding: "utf-8" });
  assert.equal(run.status, 1);
  assert.ok(run.stdout.includes("用法"));
});
