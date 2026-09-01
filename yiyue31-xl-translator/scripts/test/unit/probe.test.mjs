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

const SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "probe.mjs");

const DIMS = ["accuracy", "translationese", "ai-tone", "readability"];

test("默认四维各 ≥1；虚拟 NN 901-999 唯一递增（与 status.mjs 同规则）", () => {
  const entries = generate({ seed: 42 });
  assert.equal(entries.length, 4);
  const byDim = DIMS.map((d) => entries.filter((e) => e.dim === d).length);
  assert.deepEqual(byDim, [1, 1, 1, 1], "每维度恰 1 条");
  entries.forEach((e, i) => {
    assert.equal(e.virtualNn, 901 + i, "truth 内嵌 NN = 901 + index（status.mjs 同式）");
    assert.ok(e.half === "a" || e.half === "b");
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
