// segment.test.mjs — segment.mjs 单元测试（node --test，文件内默认串行，符合低内存纪律）
//
// 覆盖（HANDOFF §6 完成判据）：
//   - fence 感知：≥30 标题行、≥11 个在代码围栏内的样例，无一误切
//   - 拼接 sha === 原文 sha：含围栏/表格/巨块样例，逐文件字节拼接比对
//   - 尺寸分布落 8-15KB 带；不落带自动调参重分段闭环可演示
//   - R11-B：散文巨块强制再切（非原子 chunk ≤ max）；围栏巨块超限单 chunk（X 标记）
//   - 产物：chunk 文件命名 / manifest.md（heading 树）/ progress.json（缓存非事实源注明）
//   - CLI：退出码与 --json
//
// 运行：node --test scripts/test/unit/segment.test.mjs
// 夹具全部程序化生成（确定性），不落盘提交；真实文档回归层见 test/regression/。

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { spawnSync } = require("node:child_process");

import {
  segment,
  run,
  buildIndex,
  fenceAwareHeadings,
  protectedRanges,
  parseSections,
  packChunks,
  makeSlug,
  safeChunkPath,
} from "../../segment/segment.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(__dirname, "..", "..", "segment", "segment.mjs");

// ---------- 夹具生成 ----------

const WORDS =
  "alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron pi rho sigma tau upsilon phi chi psi omega data model system signal vector tensor kernel buffer stream parser token scalar".split(
    " "
  );

// 一段英文散文：nWords 个词 ≈ 7B/词（60 词 ≈ 460B）
function para(nWords = 60, seed = 0) {
  const ws = [];
  let i = seed;
  while (ws.length < nWords) {
    ws.push(WORDS[i % WORDS.length]);
    i += 7;
  }
  return `The ${ws.join(" ")} value iterates across the pipeline boundary.`;
}

function paras(n, seed = 0) {
  // n 段 × 固定 60 词（≈390B/段）。注意：第二参是 seed 不是词数——曾因签名误读把夹具撑大 6 倍。
  return Array.from({ length: n }, (_, k) => para(60, seed + k)).join("\n\n");
}

// 代码行 ~100B
function codeLine(k) {
  return `const value_${String(k).padStart(5, "0")} = compute(seed_${k}, 123456); // padding padding padding`;
}

// 巨型围栏（nLines 行 ≈ nLines×100B）
function giantFence(nLines, lang = "js") {
  return ["```" + lang, ...Array.from({ length: nLines }, (_, k) => codeLine(k)), "```"].join("\n");
}

const PIPE_TABLE = ["| 列 A | 列 B | 列 C |", "|---|---|---|", ...Array.from({ length: 8 }, (_, k) => `| 数据 ${k} | 指标 ${k + 1} | 备注 ${k + 2} |`)].join("\n");

const HTML_TABLE = ["<table>", ...Array.from({ length: 6 }, (_, k) => `<tr><td>单元格 ${k}</td><td>值 ${k * 10}</td></tr>`), "</table>"].join("\n");

// fence 感知样例：30 个真标题 + 12 个含 `# 伪标题` 的围栏
function fenceAwareDoc() {
  const parts = ["# Real Root Document\n"];
  for (let s = 1; s <= 30; s++) {
    parts.push(`## Real Section ${String(s).padStart(2, "0")}\n\n${para(40, s)}\n`);
    if (s % 3 === 0) {
      parts.push("```python\n");
      parts.push(`# Fake Heading Inside Fence ${s}\n`);
      parts.push(`def fake_${s}():  # 又一行 # 形注释\n`);
      parts.push("    return None\n");
      parts.push("```\n");
    }
  }
  return parts.join("\n");
}

// 综合样例：常规小节 + 管道表 + 小围栏 + 20KB 散文巨块 + 17KB 围栏巨块 + HTML 表，总计 ~60KB
function integrationDoc() {
  const parts = [];
  parts.push("# Integration Specification\n");
  parts.push(`## Overview\n\n${paras(8)}\n`);
  parts.push(`## Concepts\n\n${paras(7, 100)}\n\n${PIPE_TABLE}\n`);
  parts.push(`## Code Walkthrough\n\n${paras(6, 200)}\n\n${giantFence(12)}\n\n${paras(5, 300)}\n`);
  parts.push(`## Giant Prose Section\n\n${paras(52, 400)}\n`); // ≈20KB，R11-B 须再切
  parts.push(`## Giant Data Dump\n\n${para(30, 500)}\n\n${giantFence(260)}\n\n${para(30, 600)}\n`); // ≈17KB 围栏 → X
  parts.push(`## API Reference\n\n${paras(7, 700)}\n\n${HTML_TABLE}\n`);
  parts.push(`## Usage Notes\n\n${paras(8, 800)}\n`);
  parts.push(`## Failure Modes\n\n${paras(7, 900)}\n`);
  parts.push(`## Roadmap\n\n${paras(6, 1000)}\n`);
  return parts.join("\n");
}

// 调参闭环演示样例：~13KB 小节 + ~3KB 小节（贪心首档必留 3KB 尾块，阶梯细切后才全落带）
function ladderDoc() {
  return `# Ladder Demo\n\n## Big Chapter\n\n${paras(34, 42)}\n\n## Small Tail\n\n${paras(8, 77)}\n`;
}

function tmpOut() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "segtest-"));
}

// ---------- fence 感知 ----------

test("fence 感知：31 真标题（根 + 30 小节）+ 12 围栏内伪标题，无一误切", () => {
  const doc = fenceAwareDoc();
  const index = buildIndex(doc);
  const headings = fenceAwareHeadings(index.lines);
  assert.equal(headings.length, 31, "围栏内 # 行不得计入标题");
  assert.ok(headings.every((h) => /^Real (Root Document|Section \d{2})$/.test(h.title)));
  const fakes = headings.filter((h) => /Fake/i.test(h.title));
  assert.equal(fakes.length, 0);
  // 小节数 = 31（文档以标题开头，无 preamble）
  const sections = parseSections(doc, index);
  assert.equal(sections.length, 31);
});

test("protectedRanges：围栏/管道表/HTML 表均识别为保护区", () => {
  const doc = "# T\n\n```js\n# not heading\n```\n\n" + PIPE_TABLE + "\n\n" + HTML_TABLE + "\n";
  const index = buildIndex(doc);
  const ranges = protectedRanges(index.lines);
  assert.equal(ranges.length, 3); // 1 围栏 + 1 管道表 + 1 HTML 表
});

// ---------- 综合分段 ----------

test("综合样例：sha 关卡 + 落带 + R11-B 巨块路径 + 产物三件套", () => {
  const doc = integrationDoc();
  assert.ok(Buffer.byteLength(doc, "utf-8") > 50 * 1024, "样例应 >50KB 才有代表性");
  const out = tmpOut();
  try {
    const srcPath = path.join(out, "src.md");
    fs.writeFileSync(srcPath, doc);
    const r = run(srcPath, path.join(out, "seg-out"));
    assert.equal(r.exitCode, 0);
    const outDir = path.join(out, "seg-out");

    // ① 拼接 sha 关卡：逐文件字节拼接 === 原文
    const chunkDir = path.join(outDir, "chunks");
    const files = fs.readdirSync(chunkDir).sort();
    assert.ok(files.length >= 4, `chunk 数应 ≥4，实际 ${files.length}`);
    const joined = files.map((f) => fs.readFileSync(path.join(chunkDir, f), "utf-8")).join("");
    assert.equal(joined, doc.replace(/\r\n?/g, "\n"), "chunk 拼接必须字节等于原文");

    // ② 尺寸分布：非 X chunk 全落 8-15KB 带
    for (const f of files) {
      const isX = /chunk-\d+X-/.test(f);
      const kb = fs.statSync(path.join(chunkDir, f)).size / 1024;
      if (isX) {
        assert.ok(kb > 15, `X chunk 应超限：${f} ${kb.toFixed(1)}KB`);
      } else {
        assert.ok(kb <= 15.01, `非 X chunk 不得超 15KB：${f} ${kb.toFixed(1)}KB`);
        assert.ok(kb >= 8, `非 X chunk 不得低于 8KB：${f} ${kb.toFixed(1)}KB`);
      }
    }

    // ③ X chunk 恰为围栏巨块，围栏完整不切
    const xFiles = files.filter((f) => /chunk-\d+X-/.test(f));
    assert.equal(xFiles.length, 1, "恰有一个原子超限 chunk（17KB 围栏）");
    const xBody = fs.readFileSync(path.join(chunkDir, xFiles[0]), "utf-8");
    assert.ok(xBody.includes("```js") && xBody.includes("value_00200"), "X chunk 应含围栏巨块主体");

    // ④ 每个 chunk 内围栏配对完整（无围栏被切断）
    for (const f of files) {
      const body = fs.readFileSync(path.join(chunkDir, f), "utf-8");
      const fenceLines = body.split("\n").filter((l) => l.trim().startsWith("```")).length;
      assert.equal(fenceLines % 2, 0, `chunk ${f} 内围栏未配对（被切断）`);
    }

    // ⑤ R11-B：散文巨块被再切——含其内容的各 chunk 均 ≤15KB 且无 X 标记
    const proseMarker = paras(52, 400).slice(0, 60);
    for (const f of files) {
      if (/chunk-\d+X-/.test(f)) continue;
      if (fs.readFileSync(path.join(chunkDir, f), "utf-8").includes(proseMarker)) {
        assert.ok(!/chunk-\d+X-/.test(f), "散文巨块不得走原子超限路径");
      }
    }

    // ⑥ 产物：manifest + progress
    const manifest = fs.readFileSync(path.join(outDir, "manifest.md"), "utf-8");
    assert.ok(manifest.includes("## Heading 树 → chunk 映射"));
    assert.ok(manifest.includes("# Integration Specification"));
    assert.ok(!manifest.includes("Fake"), "manifest 树不得混入围栏内伪标题");
    assert.ok(/落带 \d+\/\d+/.test(manifest), "manifest 应记录分布自检结果");
    const progress = JSON.parse(fs.readFileSync(path.join(outDir, "progress.json"), "utf-8"));
    assert.ok(progress._note.includes("非事实源"), "progress.json 须明文注明缓存非事实源");
    assert.equal(progress.total_chunks, files.length);
    assert.ok(progress.chunks.every((c) => files.includes(c.filename) && c.state === "pending"));
    assert.ok(progress.chunks.every((c) => /^[0-9a-f]{12}$/.test(c.sha1)));
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
});

// ---------- 分布自检闭环 ----------

test("调参闭环：13KB+3KB 样例首档必留尾块，阶梯细切后全落带", () => {
  const doc = ladderDoc();
  const result = segment(doc);
  const scoreable = result.chunks.filter((c) => !c.atomic);
  assert.ok(result.attempts.length >= 2, `应经历多轮调参（实际 ${result.attempts.length} 轮：${JSON.stringify(result.attempts)}）`);
  assert.equal(result.attempts[result.attempts.length - 1].inBand, scoreable.length, "末轮应全落带");
  assert.ok(result.chosen < 15, "选中参数应为更细档");
  for (const c of scoreable) {
    assert.ok(c.bytes >= 8 * 1024 && c.bytes <= 15 * 1024, `落带失败：${(c.bytes / 1024).toFixed(1)}KB`);
  }
  // 拼接仍守恒
  const joined = result.chunks.map((c) => doc.slice(c.startChar, c.endChar)).join("");
  assert.equal(joined, doc);
});

test("单 chunk 文档：总长 ≤ max 一整块，带检豁免", () => {
  const doc = `# Tiny\n\n${paras(6, 5)}\n`;
  const result = segment(doc);
  assert.equal(result.chunks.length, 1);
  assert.ok(result.attempts[0].note.includes("带检豁免"));
});

// ---------- R11-B 回退路径 ----------

test("单行巨段：无空行无行界 → 字符边界回退，仍不超限且守恒", () => {
  const giantLine = "x".repeat(20 * 1024);
  const doc = `# One Line Giant\n\n${giantLine}\n`;
  const result = segment(doc);
  assert.ok(result.ops.some((o) => o.op === "char-cut"), "应记录字符边界回退");
  for (const c of result.chunks) {
    assert.ok(!c.atomic, "散文不得走原子路径");
    assert.ok(c.bytes <= 15 * 1024 + 4, `散文 chunk 超限：${c.bytes}`);
  }
  const joined = result.chunks.map((c) => doc.slice(c.startChar, c.endChar)).join("");
  assert.equal(joined, doc);
});

test("无空行长散文：行边界回退可用", () => {
  // 20KB 每行 100B 无空行
  const lines = Array.from({ length: 200 }, (_, k) => `line ${String(k).padStart(3, "0")} ${para(12, k)}`);
  const doc = `# Wrapped Prose\n\n${lines.join("\n")}\n`;
  const result = segment(doc);
  assert.ok(result.ops.some((o) => o.op === "line-cut"), "应记录行边界回退");
  const joined = result.chunks.map((c) => doc.slice(c.startChar, c.endChar)).join("");
  assert.equal(joined, doc);
});

// ---------- 命名 ----------

test("makeSlug：前 3-4 词、连字符、≤30 字符、清理非法字符", () => {
  assert.equal(makeSlug("Getting Started with the Pipeline"), "getting-started-with-the");
  assert.equal(makeSlug("A/B: Quick *Start*"), "a-b-quick-start");
  const long = makeSlug("Internationalization Workflow Architecture Deep Dive Details");
  assert.ok(long.length <= 30 && !long.endsWith("-"), long);
  assert.equal(makeSlug("中文标题无 ASCII"), "ascii"); // 保留标题中的 ASCII 词
  assert.equal(makeSlug("纯中文标题"), "part"); // 无 ASCII 可用时兜底
});

test("chunk 文件名：NN 两位、X 标记、slug 来自首标题", () => {
  const doc = integrationDoc();
  const result = segment(doc);
  const out = tmpOut();
  try {
    fs.writeFileSync(path.join(out, "src.md"), doc);
    const r = run(path.join(out, "src.md"), path.join(out, "o"));
    assert.equal(r.exitCode, 0);
    for (const row of r.rows) {
      assert.match(row.name, /^chunk-\d{2}X?-[a-z0-9-]+\.md$/, `命名不符：${row.name}`);
    }
    assert.ok(r.rows.some((x) => /X/.test(x.name)));
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
});

// ---------- 路径超长防护 ----------

test("路径超长防护：缩 slug 保 NN 唯一性，目录超限报错，正常路径不动名", () => {
  // 正常路径：原名原样
  const normal = safeChunkPath(path.join(os.tmpdir(), "seg"), "chunk-01-intro.md");
  assert.equal(normal.fileName, "chunk-01-intro.md");
  assert.equal(normal.shrunk, false);

  // 构造指定总长的目录（机器无关）：dirFor(n) 的绝对路径长度恰为 n。
  // 旧版用字面 "C:\dd…" 假目录，path.resolve 落到运行时 cwd 上，长度随运行处漂移——
  // 搬进 scripts/test/ 后暴露为间歇失败。现以 os.tmpdir() 为基确定性构造。
  const dirFor = (n) => {
    const base = os.tmpdir();
    return path.join(base, "d".repeat(Math.max(1, n - base.length - 1)));
  };

  // 深目录 + 长 slug：目录 219 + "/chunks/"（9）+ 空 slug 名（12）= 240 ≤ 240，
  // 全 slug 名（38）= 266 > 240 → 触发缩且恰缩得进
  const longDir = dirFor(219);
  const r1 = safeChunkPath(longDir, "chunk-01-internationalization-workflow.md");
  assert.ok(r1.filePath.length <= 240, `缩后仍超限：${r1.filePath.length}`);
  assert.equal(r1.shrunk, true);
  assert.match(r1.fileName, /^chunk-01-[a-z0-9-]*\.md$/);

  // 唯一性由 NN 保证：不同 chunk 缩后不撞名
  const r2 = safeChunkPath(longDir, "chunk-02-internationalization-workflow.md");
  assert.notEqual(r1.fileName, r2.fileName);

  // 目录本身超限（无 slug 可救）：目录 225 + 9 + 最短名 12 = 246 > 240 → 报错并给可操作建议
  assert.throws(() => safeChunkPath(dirFor(225), "chunk-01-x.md"), /路径超长.*缩短/);
});

// ---------- CLI ----------

test("CLI：成功 0 / 缺文件 2 / 缺参数 1 / --json 可解析", () => {
  const tmp = tmpOut();
  try {
    const src = path.join(tmp, "doc.md");
    fs.writeFileSync(src, integrationDoc());

    const ok = spawnSync(process.execPath, [SCRIPT, src, "--out", path.join(tmp, "out1"), "--json"], { encoding: "utf-8" });
    assert.equal(ok.status, 0, ok.stdout + ok.stderr);
    const parsed = JSON.parse(ok.stdout.slice(ok.stdout.indexOf("{")));
    assert.ok(parsed.chunks.length >= 4);
    assert.ok(parsed.attempts.length >= 1);
    assert.ok(typeof parsed.chosen === "number");

    const missing = spawnSync(process.execPath, [SCRIPT, path.join(tmp, "nope.md"), "--out", path.join(tmp, "out2")], { encoding: "utf-8" });
    assert.equal(missing.status, 2);

    const noargs = spawnSync(process.execPath, [SCRIPT], { encoding: "utf-8" });
    assert.equal(noargs.status, 1);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
