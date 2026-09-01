// merge.test.mjs — merge.mjs 单元测试（node --test，文件内默认串行，低内存纪律）
//
// 覆盖固定判据 M1-M7（契约登记于 scripts/test/README.md；真实译文快照回归见
// regression/merge.regression.test.mjs，本层用程序化合成夹具钉死算法行为与病态输入）：
//   M1 NN 数值序拼接（10 < 02 陷阱，禁字典序 R29）
//   M2 收录集合恰 = 最新 verify passed（failed / sha 过期 / 无记录 → 排除并披露）
//   M3 非空 «...» 拒绝；空 «» 对清除且有记录（events.jsonl）
//   M4 产物名 merged-draft.md 不命中 refined-stock classify 发布模式（实核模式表）
//   M5 同输入重跑字节相同
//   M6 缺 chunk / 多译文 / 乱序号 / 分母 sha 不符 / 无校验依据 / 空收录 → 非零退出 + 可操作报错
//   M7 零改写：无 BOM、无 EOL 归一、无 "\n\n" 插入（纯 join("")）
//
// 运行：node --test scripts/test/unit/merge.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { assemble, collectSet, manifestChunkShas, runMerge } from "../../merge.mjs";
import { scanWorkdir } from "../../status.mjs";

const SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "merge.mjs");

const sha12 = (s) => crypto.createHash("sha1").update(s, "utf-8").digest("hex").slice(0, 12);
const nn2 = (n) => String(n).padStart(2, "0");

// ---------- 程序化工作目录夹具 ----------

const ZH = (n) => `### 第 ${n} 节\n\n这是第 ${n} 块真实语形的中文译文段落。系统支持 1,024 线程，命中率 85%。\n\n第二段：术语 alpha 保留（alpha），数字 42 与单位 3km 保持。\n`;

// 造一个可合并的工作目录快照：original + chunks/ + manifest + translated-chunks/ + verify-results
// verifyState: { [nn]: "pass" | "fail" | "stale" | "none" }——pass = passed+sha 相符；
// stale = passed 但记录 sha 是旧值（修复后未重验）；fail = 末条 passed:false；none = 无记录
function makeDir(nChunks, verifyState = {}, opts = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mg-"));
  const names = [];
  const chunkTexts = [];
  for (let n = 1; n <= nChunks; n++) {
    const text = (opts.chunkText?.[n] !== undefined ? opts.chunkText[n] : ZH(n)) + "\n";
    chunkTexts[n] = text;
    const name = `chunk-${nn2(n)}-sec${n}.md`;
    names[n] = name;
    fs.mkdirSync(path.join(dir, "chunks"), { recursive: true });
    fs.writeFileSync(path.join(dir, "chunks", name), text, "utf-8");
    fs.mkdirSync(path.join(dir, "translated-chunks"), { recursive: true });
    if (!opts.missingTranslated?.includes(n)) {
      fs.writeFileSync(path.join(dir, "translated-chunks", `translated-chunk-${nn2(n)}.md`), text, "utf-8");
    }
  }
  // original = chunks 拼接（分母自洽）
  fs.writeFileSync(path.join(dir, "original-demo.md"), chunkTexts.slice(1).join(""), "utf-8");
  // manifest：NN/文件/KB/行/sha 表 + 原文 sha 行（status.mjs 解析口径）
  const L = ["# 分段清单（manifest）", "", `- 原文：original-demo.md　sha1（前 12）：${sha12(chunkTexts.slice(1).join(""))}　${(Buffer.byteLength(chunkTexts.slice(1).join(""), "utf-8") / 1024).toFixed(1)}KB`, "", "| NN | 文件 | KB | 行 | sha1 |", "|----|------|----|----|------|"];
  for (let n = 1; n <= nChunks; n++) {
    const sha = opts.manifestShaOverride?.[n] ?? sha12(chunkTexts[n]);
    L.push(`| ${nn2(n)} | ${names[n]} | 1.0 | 1-10 | ${sha} |`);
  }
  if (opts.manifestRowsOverride) L.push(...opts.manifestRowsOverride);
  fs.writeFileSync(path.join(dir, "manifest.md"), L.join("\n") + "\n", "utf-8");
  // verify-results.json
  const results = [];
  for (let n = 1; n <= nChunks; n++) {
    const st = verifyState[n] ?? "pass";
    if (st === "none") continue;
    const tPath = path.join(dir, "translated-chunks", `translated-chunk-${nn2(n)}.md`);
    const curSha = fs.existsSync(tPath) ? sha12(fs.readFileSync(tPath, "utf-8")) : "x";
    if (st === "pass") results.push({ nn: n, passed: true, translationSha: curSha });
    else if (st === "stale") results.push({ nn: n, passed: true, translationSha: "000000000000" });
    else if (st === "fail") results.push({ nn: n, passed: false, translationSha: curSha });
  }
  fs.writeFileSync(path.join(dir, "verify-results.json"), JSON.stringify({ results }), "utf-8");
  return dir;
}

// ---------- M1/M3/M7：assemble 纯函数 ----------

test("M1：NN 数值序拼接——10 排在 02 之后（禁字典序，R29）", () => {
  const { merged } = assemble([
    { nn: 10, text: "十\n" },
    { nn: 2, text: "二\n" },
    { nn: 1, text: "一\n" },
  ]);
  assert.equal(merged, "一\n二\n十\n");
});

test("M7：零改写——无 BOM、CRLF 原样保留、无结尾补行、无 \"\\n\\n\" 插入", () => {
  const a = "首段\r\n带 CRLF 的行\r\n结尾无换行";
  const b = "次块\n\n段落二";
  const { merged } = assemble([
    { nn: 1, text: a },
    { nn: 2, text: b },
  ]);
  assert.equal(merged, a + b, "纯 join(\"\")——任何归一/插行都是改写");
  assert.ok(!merged.startsWith("﻿"), "无 BOM");
});

test("M3：空 «» 对机械清除并计数；非空 «...» 逐条上报", () => {
  const { merged, cleared, residues } = assemble([
    { nn: 1, text: "前文«»中间«»后文\n" },
    { nn: 2, text: "带未裁定«术语»的块\n" },
  ]);
  assert.equal(merged, "前文中间后文\n带未裁定«术语»的块\n");
  assert.equal(cleared, 2, "两处空对清除");
  assert.deepEqual(residues, [{ nn: 2, mark: "«术语»" }]);
});

// ---------- M2：collectSet ----------

test("M2：收录 = 最新 passed——fail/stale/无记录三类排除，理由随附", () => {
  const dir = makeDir(4, { 1: "pass", 2: "stale", 3: "fail", 4: "none" });
  try {
    const inv = scanWorkdir(dir);
    const { included, excluded } = collectSet(inv);
    assert.deepEqual(included, [1]);
    assert.equal(excluded.length, 3);
    assert.ok(excluded.find((e) => e.nn === 2).reason.includes("sha"));
    assert.ok(excluded.find((e) => e.nn === 3).reason.includes("未过"));
    assert.ok(excluded.find((e) => e.nn === 4).reason.includes("无机械校验记录"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("M2：verify-results 取每 chunk 末条为最新（先 fail 后 pass = 过）", () => {
  const dir = makeDir(1, { 1: "pass" });
  try {
    const vr = JSON.parse(fs.readFileSync(path.join(dir, "verify-results.json"), "utf-8"));
    vr.results.unshift({ nn: 1, passed: false, translationSha: "000000000000" }); // 更早的失败
    fs.writeFileSync(path.join(dir, "verify-results.json"), JSON.stringify(vr), "utf-8");
    const { included } = collectSet(scanWorkdir(dir));
    assert.deepEqual(included, [1], "末条 pass 覆盖早先 fail");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------- 主流程 happy path（M1/M3/M4/M5） ----------

test("happy：全 passed 合并落盘 + 清标有记录 + 确定性重跑（M1/M3/M4/M5）", () => {
  const dir = makeDir(3, {}, { chunkText: { 2: ZH(2) + "尾部的空标记«»\n" } });
  try {
    const r1 = runMerge(dir);
    assert.equal(r1.exitCode, 0, JSON.stringify(r1.errors));
    assert.deepEqual(r1.included, [1, 2, 3]);
    assert.equal(r1.cleared, 1, "chunk 2 的空 «» 应被清除");
    const p = path.join(dir, "merged-draft.md");
    assert.ok(fs.existsSync(p), "产物落盘");
    assert.equal(path.basename(p), "merged-draft.md", "M4：临时名");

    // M1：字节 === 收录 chunk 按数值序、清标后拼接
    const expect = [1, 2, 3]
      .map((n) => fs.readFileSync(path.join(dir, "translated-chunks", `translated-chunk-${nn2(n)}.md`), "utf-8").replace(/«»/g, ""))
      .join("");
    assert.equal(fs.readFileSync(p, "utf-8"), expect);

    // M3：清标记录进 events.jsonl
    const ev = fs.readFileSync(path.join(dir, "events.jsonl"), "utf-8").trim().split("\n").map((l) => JSON.parse(l));
    const mergeEv = ev.find((e) => e.ev === "merge");
    assert.ok(mergeEv, "merge 事件已记");
    assert.equal(mergeEv.clearedMarkers, 1);
    assert.equal(mergeEv.mergedSha, sha12(fs.readFileSync(p, "utf-8")));

    // M5：同输入重跑字节相同
    const before = fs.readFileSync(p, "utf-8");
    const r2 = runMerge(dir);
    assert.equal(r2.exitCode, 0);
    assert.equal(fs.readFileSync(p, "utf-8"), before, "重跑字节相同");
    assert.equal(r2.mergedSha, r1.mergedSha);

    // M7：无 BOM / 无插入空行
    const buf = fs.readFileSync(p);
    assert.ok(!(buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf), "无 BOM");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// M4：不命中 refined-stock classify 发布模式（scripts/lib.mjs 实核过的模式表；
// merged-draft 的 "merged" 第 6 字符是 d，不匹配 ^merge-.+\.md$）
test("M4：merged-draft.md 不命中 refined-stock 发布模式", () => {
  const name = "merged-draft.md";
  const PATTERNS = [
    /^final-.+-\d{5,}\.md$/i,
    /^recommendation-.+-\d{5,}\.md$/i,
    /^talk-.+\.md$/i,
    /^merge-.+\.md$/i,
    /^summary-.+\.md$/i,
    /^.+-zh\.md$/i,
  ];
  for (const re of PATTERNS) assert.ok(!re.test(name), `${name} 不得命中 ${re}`);
});

// ---------- M6：病态输入逐类非零退出 ----------

test("M6：缺 chunk（manifest NN 无译文）→ 退出码 3，报错点名 NN，不落盘", () => {
  const dir = makeDir(4, {}, { missingTranslated: [3] });
  try {
    const r = runMerge(dir);
    assert.equal(r.exitCode, 3);
    assert.ok(r.errors.join("").includes("03"), "报错须点名缺的 NN");
    assert.ok(!fs.existsSync(path.join(dir, "merged-draft.md")), "绝不静默拼残稿");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("M6：多余译文 chunk（不在 manifest）→ 退出码 3", () => {
  const dir = makeDir(2, {});
  try {
    fs.writeFileSync(path.join(dir, "translated-chunks", "translated-chunk-07.md"), ZH(7), "utf-8");
    const r = runMerge(dir);
    assert.equal(r.exitCode, 3);
    assert.ok(r.errors.join("").includes("07"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("M6：NN 跳号乱序（01,02,04）→ 退出码 3", () => {
  const dir = makeDir(3, {});
  try {
    // 重写 manifest：跳过 03 行（登记 01,02,04 形态）
    const m = fs.readFileSync(path.join(dir, "manifest.md"), "utf-8").split("\n");
    const out = [];
    let seen = 0;
    for (const line of m) {
      const mm = line.match(/^\| (\d{2}) \|/);
      if (mm && Number(mm[1]) === 3) {
        seen = 1;
        out.push("| 04 | chunk-04-sec4.md | 1.0 | 1-10 | 000000000000 |");
        continue;
      }
      out.push(line);
    }
    assert.equal(seen, 1, "夹具应有 03 行");
    fs.writeFileSync(path.join(dir, "manifest.md"), out.join("\n"), "utf-8");
    fs.writeFileSync(path.join(dir, "chunks", "chunk-04-sec4.md"), ZH(4), "utf-8");
    fs.writeFileSync(path.join(dir, "translated-chunks", "translated-chunk-04.md"), ZH(4), "utf-8");
    fs.rmSync(path.join(dir, "translated-chunks", "translated-chunk-03.md"));
    fs.rmSync(path.join(dir, "chunks", "chunk-03-sec3.md"));
    const r = runMerge(dir);
    assert.equal(r.exitCode, 3);
    assert.ok(r.errors.join("").includes("乱序"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("M6：分母 sha 不符（manifest 记录 ≠ chunks/ 实文件）→ 退出码 3", () => {
  const dir = makeDir(3, {}, { manifestShaOverride: { 2: "deadbeefdead" } });
  try {
    const r = runMerge(dir);
    assert.equal(r.exitCode, 3);
    assert.ok(r.errors.join("").includes("sha"));
    assert.ok(!fs.existsSync(path.join(dir, "merged-draft.md")));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("M6：verify-results.json 缺失 → 退出码 3（无机械校验依据，拒绝盲拼）", () => {
  const dir = makeDir(3, {});
  try {
    fs.rmSync(path.join(dir, "verify-results.json"));
    const r = runMerge(dir);
    assert.equal(r.exitCode, 3);
    assert.ok(r.errors.join("").includes("机械校验依据"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("M6：收录集为空（全部 stale）→ 退出码 3，逐 chunk 给理由", () => {
  const dir = makeDir(2, { 1: "stale", 2: "fail" });
  try {
    const r = runMerge(dir);
    assert.equal(r.exitCode, 3);
    assert.ok(r.errors.join("").includes("收录集为空"));
    assert.ok(r.errors.join("").includes("01"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("M6：工作目录异常（无 manifest）→ 退出码 2", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mg2-"));
  try {
    fs.writeFileSync(path.join(dir, "original-demo.md"), "x", "utf-8");
    const r = runMerge(dir);
    assert.equal(r.exitCode, 2);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------- M3：非空残留拒绝 ----------

test("M3：非空 «...» 残留 → 退出码 4 拒绝，不落盘，报错指路 Step 4", () => {
  const dir = makeDir(2, {}, { chunkText: { 2: "段落中«未裁定术语»残留。\n" } });
  try {
    const r = runMerge(dir);
    assert.equal(r.exitCode, 4);
    assert.ok(r.errors.join("").includes("«未裁定术语»"));
    assert.ok(!fs.existsSync(path.join(dir, "merged-draft.md")), "拒绝落盘");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------- 辅助函数 ----------

test("manifestChunkShas：解析 chunk 表 sha 列（分母判据数据源）", () => {
  const rows = manifestChunkShas("| NN | 文件 | KB | 行 | sha1 |\n|----|------|----|----|------|\n| 01 | chunk-01-a.md | 1.0 | 1-10 | abc123def456 |\n| 02X | chunk-02X-b.md | 1.0 | 1-10 | 000000000000 |");
  assert.equal(rows.length, 2);
  assert.equal(rows[0].sha, "abc123def456");
  assert.equal(rows[1].atomic, true);
});

test("partial：部分未过审 → 只收 passed 且披露排除理由（M2 行为场景）", () => {
  const dir = makeDir(3, { 2: "stale" });
  try {
    const r = runMerge(dir);
    assert.equal(r.exitCode, 0);
    assert.deepEqual(r.included, [1, 3]);
    assert.equal(r.excluded.length, 1);
    assert.equal(r.excluded[0].nn, 2);
    const merged = fs.readFileSync(path.join(dir, "merged-draft.md"), "utf-8");
    const expect = [1, 3]
      .map((n) => fs.readFileSync(path.join(dir, "translated-chunks", `translated-chunk-${nn2(n)}.md`), "utf-8"))
      .join("");
    assert.equal(merged, expect, "只含 passed 的字节");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------- CLI 冒烟（守卫真实性：Windows 下 new URL().pathname 坑曾使入口静默空转） ----------

test("CLI：真实执行（产物落盘 + stdout 结论），非静默空转", () => {
  const dir = makeDir(2, {});
  try {
    const run = spawnSync(process.execPath, [SCRIPT, dir], { encoding: "utf-8" });
    assert.equal(run.status, 0, run.stdout + run.stderr);
    assert.ok(run.stdout.includes("合并完成"), "CLI 应真实执行并给结论");
    assert.ok(fs.existsSync(path.join(dir, "merged-draft.md")), "产物由 CLI 落盘");
    assert.ok(fs.existsSync(path.join(dir, "events.jsonl")), "事件由 CLI 追加");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
