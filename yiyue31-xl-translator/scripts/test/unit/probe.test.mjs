// probe.test.mjs — probe.mjs 单元测试（node --test，文件内默认串行，低内存纪律）
//
// 覆盖（HANDOFF §4 + §6 第 3 判据）：
//   - 默认四维各 ≥1（R20：每维度每 run ≥1 的生成端保证）
//   - 虚拟 NN ∈ 901-999，唯一递增，与 status.mjs 分配规则同构（truth 内嵌 virtualNn）
//   - expectedHit ⊆ text（真实报告引用缺陷特征串的机械可判性前提）
//   - 确定性：同 run + 同 seed 生成字节相同（truth 可复现，M5 同款纪律）
//   - truth 落源侧指定目录、已存在拒绝覆盖（--force 例外）
//   - 样本语形：真实中文 + 单一植入缺陷描述（defectType 非空）
//   - 探针上限：per-dim 超模板池 / 超虚拟 NN 段 → 报错
//
// 运行：node --test scripts/test/unit/probe.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { generate, writeTruth, defaultRunId } from "../../probe.mjs";
import { probeCheck } from "../../final-gate.mjs";

const SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "probe.mjs");

const DIMS = ["accuracy", "translationese", "ai-tone", "readability"];

test("默认四维各 ≥1；虚拟 NN 901-999 唯一递增（与 status.mjs 同规则）", () => {
  const entries = generate({ seed: 42 });
  assert.equal(entries.length, 4);
  const byDim = DIMS.map((d) => entries.filter((e) => e.dim === d).length);
  assert.deepEqual(byDim, [1, 1, 1, 1], "每维度恰 1 条");
  entries.forEach((e, i) => {
    assert.equal(e.virtualNn, 901 + i, "truth 内嵌 NN = 901 + index（status.mjs 同式）");
    assert.ok(e.half === undefined, "S2① 后探针条目不再携带 half（报告名无半块后缀）");
    assert.ok(e.text.length > 10, "样本非空");
    assert.ok(e.defectType.length > 0, "缺陷类型非空");
    assert.ok(e.text.includes(e.expectedHit), "expectedHit 须出现在样本内（报告可引用性）");
    assert.ok(/[一-鿿]/.test(e.text), "样本为真实中文语形");
  });
  assert.equal(new Set(entries.map((e) => e.virtualNn)).size, 4, "NN 唯一");
});

test("确定性：同 run + 同 seed 字节相同；不同 seed 可得不同选样", () => {
  const a = generate({ seed: 7 });
  const b = generate({ seed: 7 });
  assert.equal(JSON.stringify(a), JSON.stringify(b), "同种子字节相同");
  // 不同种子至少在大概率下改变选样（4 维 × 3 模板，碰撞概率 3^-4 ≈ 1.2%）
  const seeds = [1, 2, 3, 4, 5, 6, 7, 8];
  const sels = seeds.map((s) => generate({ seed: s }).map((e) => e.text).join("|"));
  assert.ok(new Set(sels).size >= 2, "不同种子应产生不同选样");
});

test("per-dim 2 → 8 条无放回（同维不重复模板）", () => {
  const entries = generate({ perDim: 2, seed: 99 });
  assert.equal(entries.length, 8);
  for (const d of DIMS) {
    const texts = entries.filter((e) => e.dim === d).map((e) => e.text);
    assert.equal(new Set(texts).size, 2, `${d} 两探针不重复`);
  }
  assert.ok(entries.every((e) => e.virtualNn <= 999), "不越虚拟段");
});

test("未知维度报错；探针数超虚拟 NN 段报错", () => {
  assert.throws(() => generate({ dims: ["nonsense"] }), /未知维度/);
  assert.throws(() => generate({ perDim: 30 }), /901-999/);
});

test("writeTruth：落源侧目录；已存在拒绝覆盖；--force 由调用方先删", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pb-"));
  try {
    const e1 = generate({ seed: 1 });
    const r1 = writeTruth(dir, "run-a", e1);
    assert.ok(r1.ok);
    assert.equal(path.basename(r1.file), "run-a.json");
    const raw = fs.readFileSync(r1.file, "utf-8");
    assert.deepEqual(JSON.parse(raw), e1, "truth 内容 = 条目数组（status.mjs probeTruth 直接消费）");
    const r2 = writeTruth(dir, "run-a", e1);
    assert.equal(r2.ok, false, "已存在不得静默覆盖");
    assert.equal(r2.reason, "exists");
    const r3 = writeTruth(dir, "run-b", generate({ seed: 1 }));
    assert.ok(r3.ok, "不同 run 各自落盘");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("defaultRunId：紧凑时间戳，文件系统安全", () => {
  const id = defaultRunId(new Date("2026-09-01T08:30:00.123Z"));
  assert.equal(id, "20260901T083000Z");
  assert.match(id, /^[\w-]+$/);
});

test("CLI 冒烟：--truth-dir 指到临时目录，退出码 0 且四维齐；同 run 重跑拒绝", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pbcli-"));
  try {
    const run = spawnSync(process.execPath, [SCRIPT, "--run", "smoke", "--seed", "5", "--truth-dir", dir], { encoding: "utf-8" });
    assert.equal(run.status, 0, run.stdout + run.stderr);
    const entries = JSON.parse(fs.readFileSync(path.join(dir, "smoke.json"), "utf-8"));
    assert.deepEqual([...new Set(entries.map((e) => e.dim))].sort(), [...DIMS].sort());
    const again = spawnSync(process.execPath, [SCRIPT, "--run", "smoke", "--seed", "5", "--truth-dir", dir], { encoding: "utf-8" });
    assert.equal(again.status, 2, "同 run 重复生成必须拒绝");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------- S2⑦：--run <name> 新审校轮命名 + --probe-truth 伪报告命中 ----------

test("S2⑦ --run soai-r2 命名生效：<name>.json 落盘四维齐、同 run 重跑拒绝、跨目录同 run 字节相同", () => {
  const dirA = fs.mkdtempSync(path.join(os.tmpdir(), "pbr2a-"));
  const dirB = fs.mkdtempSync(path.join(os.tmpdir(), "pbr2b-"));
  try {
    // 新审校轮新 run 的命名机制（soai-r2 形态；与既有 run 的 truth 互不相干——防覆盖钉死）
    const a = spawnSync(process.execPath, [SCRIPT, "--run", "soai-r2", "--truth-dir", dirA], { encoding: "utf-8" });
    assert.equal(a.status, 0, a.stdout + a.stderr);
    const file = path.join(dirA, "soai-r2.json");
    const entries = JSON.parse(fs.readFileSync(file, "utf-8"));
    assert.deepEqual([...new Set(entries.map((e) => e.dim))].sort(), [...DIMS].sort(), "四维各 ≥1");
    assert.ok(entries.every((e) => e.virtualNn >= 901 && e.virtualNn <= 999), "虚拟 NN 段不变");
    // 同 run 重跑拒绝（旧 truth 不得改写——新轮须换新名）
    const again = spawnSync(process.execPath, [SCRIPT, "--run", "soai-r2", "--truth-dir", dirA], { encoding: "utf-8" });
    assert.equal(again.status, 2, "同 run 防覆盖");
    // 确定性：缺省 seed = runId 哈希——同 run 两次生成（不同目录）字节相同
    const b = spawnSync(process.execPath, [SCRIPT, "--run", "soai-r2", "--truth-dir", dirB], { encoding: "utf-8" });
    assert.equal(b.status, 0, b.stdout + b.stderr);
    assert.equal(fs.readFileSync(file, "utf-8"), fs.readFileSync(path.join(dirB, "soai-r2.json"), "utf-8"), "同 run 字节相同（truth 可复现）");
  } finally {
    fs.rmSync(dirA, { recursive: true, force: true });
    fs.rmSync(dirB, { recursive: true, force: true });
  }
});

test("S2⑦ --probe-truth 伪报告命中：含 expectedHit → probeCheck 零 FAIL；缺报告/未含 → FAIL（注入缺陷被 truth 抓到）", () => {
  const truth = generate({ seed: 11 }); // 四维各 1
  const wdir = fs.mkdtempSync(path.join(os.tmpdir(), "pbhit-"));
  const nn2 = (n) => String(n).padStart(2, "0");
  const repPath = (t) => path.join(wdir, "reviews", `review-${t.dim}-chunk-${nn2(t.virtualNn)}.md`);
  try {
    fs.mkdirSync(path.join(wdir, "reviews"), { recursive: true });
    // 正：每份伪报告结论引用缺陷特征串 → 全命中
    for (const t of truth) {
      fs.writeFileSync(repPath(t), `sha: 000000000000\nmodel: test\ntime: 2026-10-17T00:00:00Z\n结论：发现植入缺陷「${t.expectedHit}」（${t.defectType}）。\n`, "utf-8");
    }
    assert.deepEqual(probeCheck(wdir, truth), [], "命中 → 零 FAIL");
    // 反一：缺报告 = 直接 FAIL
    fs.rmSync(repPath(truth[0]), { force: true });
    let fails = probeCheck(wdir, truth);
    assert.equal(fails.length, 1);
    assert.ok(fails[0].includes("缺报告"), "缺报告 FAIL");
    // 反二：报告在而未含 expectedHit（漏抓植入缺陷）→ 未命中 FAIL 并披露期望串
    fs.writeFileSync(repPath(truth[0]), "sha: 000000000000\nmodel: test\ntime: 2026-10-17T00:00:00Z\n结论：未发现问题，整体流畅。\n", "utf-8");
    fails = probeCheck(wdir, truth);
    assert.equal(fails.length, 1);
    assert.ok(fails[0].includes("未命中") && fails[0].includes(truth[0].expectedHit), "未命中 FAIL 披露 expectedHit");
  } finally {
    fs.rmSync(wdir, { recursive: true, force: true });
  }
});
