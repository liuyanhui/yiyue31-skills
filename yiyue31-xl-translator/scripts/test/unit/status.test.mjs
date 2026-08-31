// status.test.mjs — status.mjs 单元测试（node --test，文件内默认串行，低内存纪律）
//
// 覆盖（HANDOFF §6 完成判据逐项）：
//   - 物化视图非事实源：删掉 status.md 仍推导重建全部状态
//   - 双段契约（R13）：人话 + 动作指令两段；探针与真单元在派发清单中同构不可分辨（R25）
//   - stale 半块级分类：译文 sha 变化 → 半块全 4 维 stale；a 修复不级联 b；N+1 handoff 失效；re-keying 全局作废（R1）
//   - 动词响应：继续/进度/停止（封存+解封）/重翻（章↔chunk 披露 R5）/样张（R16）/重新翻译（R18-③）
//   - PENDING-USER 菜单（R2）+ 菜单②手修路径文案（G7：自动补空格、永不自动重翻）
//   - 计数器三条款（G6）+ 机械打回 ≤2 / 累计升级 ≥2 转挂起（R4）
//   - 会话预算干净退出点（R14）；progress.json 不再写出（status.md 吸收）
//
// 夹具程序化生成：segment.run 真跑出 chunks+manifest（min/max 调小造多 chunk 小文档），
// 再手工补 translated/adjudication/reviews/verify-results/events 模拟各阶段。
//
// 运行：node --test scripts/test/unit/status.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { run as segRun } from "../../segment/segment.mjs";
import {
  run,
  verb,
  scanWorkdir,
  deriveState,
  buildQueue,
  halfSlices,
  nnKey,
  chapterMap,
  deriveCounters,
  appendEvents,
} from "../../status.mjs";

const DIMS = ["accuracy", "translationese", "ai-tone", "readability"];

// ---------- 夹具 ----------

function doc(nParas) {
  const paras = [];
  for (let i = 0; i < nParas; i++) paras.push(`## Sec ${i}\n\nPara ${i} lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor.`);
  return paras.join("\n\n") + "\n";
}

// 造一个已分段的工作目录（3 chunk，带 H2 章结构）
function makeWorkdir(nChunks = 3) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "st-"));
  const nParas = nChunks * 6;
  const orig = path.join(dir, "original-testdoc.md");
  fs.writeFileSync(orig, doc(nParas), "utf-8");
  const r = segRun(orig, dir, { minKB: 0.5, maxKB: 1, quiet: true });
  assert.equal(r.exitCode, 0, "夹具分段失败");
  return dir;
}

const nn2 = (n) => String(n).padStart(2, "0");

// 把 chunk nn 推进到审校前（译文 + 裁定 + 机械校验通过）
function pushThroughVerify(dir, n, textOverride) {
  const tdir = path.join(dir, "translated-chunks");
  fs.mkdirSync(tdir, { recursive: true });
  const text = textOverride ?? `第 ${n} 块译文。段一：术语 alpha 保留。\n\n段二：数字 42 与单位 3km 保持。\n\n段三：结尾。`;
  const tp = path.join(tdir, `translated-chunk-${nn2(n)}.md`);
  fs.writeFileSync(tp, text, "utf-8");
  fs.mkdirSync(path.join(dir, "adjudications"), { recursive: true });
  fs.writeFileSync(path.join(dir, "adjudications", `adjudication-chunk-${nn2(n)}.md`), `# 台账 ${n}\n- «alpha» → 保留\n`, "utf-8");
  const vr = path.join(dir, "verify-results.json");
  let cur;
  try {
    cur = JSON.parse(fs.readFileSync(vr, "utf-8"));
  } catch {
    cur = { results: [] };
  }
  cur.results = (cur.results ?? []).filter((x) => x.nn !== n);
  cur.results.push({ nn: n, passed: true, translationSha: sha12Of(tp) });
  fs.writeFileSync(vr, JSON.stringify(cur), "utf-8");
}

function sha12Of(p) {
  return crypto.createHash("sha1").update(fs.readFileSync(p, "utf-8"), "utf-8").digest("hex").slice(0, 12);
}

// 为 chunk nn 写齐 4 维 × 2 半块报告（头部 sha: 取当前半块——fresh）或指定失配
function writeReviews(dir, n, breakHalves = []) {
  const rdir = path.join(dir, "reviews");
  fs.mkdirSync(rdir, { recursive: true });
  const halves = halfSlices(fs.readFileSync(path.join(dir, "translated-chunks", `translated-chunk-${nn2(n)}.md`), "utf-8"));
  for (const dim of DIMS) {
    for (const h of ["a", "b"]) {
      const sha = breakHalves.includes(h) ? "000000000000" : halves[h].sha;
      fs.writeFileSync(path.join(rdir, `review-${dim}-chunk-${nn2(n)}${h}.md`), `sha: ${sha}\nmodel: test\n结论：通过。\n`, "utf-8");
    }
  }
}

// ---------- 基础 ----------

test("halfSlices：a+b 拼接 === 原文；中点向段落边界取整", () => {
  const text = "一\n\n二\n\n三\n\n四\n\n五";
  const s = halfSlices(text);
  assert.equal(s.a.text + "\n\n" + s.b.text, text);
  const half = Buffer.byteLength(text, "utf-8") / 2;
  const da = Math.abs(Buffer.byteLength(s.a.text, "utf-8") - half);
  const db = Math.abs(Buffer.byteLength(s.b.text, "utf-8") - half);
  assert.ok(da <= half && db <= half);
});

test("nnKey：数值排序禁字典序（R29）", () => {
  assert.ok(nnKey("chunk-02-x.md") < nnKey("chunk-10-y.md"));
});

test("冷启动：双段契约 + 首个动作 = 翻译；progress.json 不再写出", () => {
  const dir = makeWorkdir();
  try {
    const r = run(dir, {});
    assert.equal(r.exitCode, 0);
    const md = fs.readFileSync(path.join(dir, "status.md"), "utf-8");
    assert.ok(md.includes("## 人话"), "缺人话段");
    assert.ok(md.includes("## 动作指令"), "缺动作指令段");
    assert.ok(/step: translate/.test(md), "首个动作应为翻译");
    assert.ok(md.includes("继续翻译 testdoc"), "缺下次口令");
    assert.ok(!fs.existsSync(path.join(dir, "progress.json")), "progress.json 必须不存在");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------- 物化视图非事实源（HANDOFF §6 第 1 判据） ----------

test("删掉 status.md 仍推导重建全部状态（物化视图证明）", () => {
  const dir = makeWorkdir();
  try {
    run(dir, {});
    pushThroughVerify(dir, 1);
    writeReviews(dir, 1, ["b"]); // b 半块报告失配 → 未完成
    fs.rmSync(path.join(dir, "status.md"), { force: true });
    const r = run(dir, {});
    assert.equal(r.exitCode, 0);
    const md = fs.readFileSync(path.join(dir, "status.md"), "utf-8");
    assert.ok(/重审中|审校中/.test(md), "状态应重建为审校/重审阶段");
    assert.equal(r.state.chunks[0].reviewDone, 4, "4 份 fresh 报告（b 失配）");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------- R25：统一物化 + 探针不可分辨 ----------

test("审校队列统一物化：探针与真单元同构混排，工作区无真假映射", () => {
  const dir = makeWorkdir();
  const truthFile = path.join(dir, "..", `truth-${Date.now()}.json`);
  try {
    pushThroughVerify(dir, 1);
    fs.writeFileSync(truthFile, JSON.stringify([
      { dim: "accuracy", half: "a", text: "探针样本内容（含植入缺陷）" },
      { dim: "readability", half: "b", text: "探针样本内容二" },
    ]), "utf-8");
    const r = run(dir, { probeTruth: truthFile });
    // 真单元 4（b 失配 4 维中——fresh a 4 份已写? 未写 reviews 时=8 真单元）+ 探针 2
    assert.equal(r.queue.q.length, 8 + 2, "8 真半块单元 + 2 探针");
    const staging = fs.readdirSync(path.join(dir, "staging"));
    assert.equal(staging.length, 10, "staging 全量物化");
    for (const f of staging) assert.match(f, /^review-[\w-]+-unit-\d{3}\.md$/, "同构命名");
    const md = fs.readFileSync(path.join(dir, "status.md"), "utf-8");
    assert.ok(!/probe/.test(md), "status.md 不得出现 probe 字样（不可分辨）");
    assert.ok(!fs.existsSync(path.join(dir, "probes")), "工作区无 probes/ 目录");
    assert.ok(!staging.some((f) => f.includes("probe")), "暂存名不含 probe 标记");
  } finally {
    fs.rmSync(truthFile, { force: true });
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------- stale 半块级分类（R1） ----------

test("译文变更 → 半块全维 stale、a 不级联 b、N+1 handoff 失效", () => {
  const dir = makeWorkdir();
  try {
    pushThroughVerify(dir, 1);
    pushThroughVerify(dir, 2);
    writeReviews(dir, 1);
    writeReviews(dir, 2);
    // 只改 a 半块内容（前段追加文字），随后机械校验已按新 sha 重过（模拟修复后重验）
    const old = fs.readFileSync(path.join(dir, "translated-chunks", "translated-chunk-01.md"), "utf-8");
    const paras = old.split("\n\n");
    paras[0] += " 修复补充。";
    const neu = paras.join("\n\n");
    fs.writeFileSync(path.join(dir, "translated-chunks", "translated-chunk-01.md"), neu, "utf-8");
    const vr = JSON.parse(fs.readFileSync(path.join(dir, "verify-results.json"), "utf-8"));
    vr.results.find((x) => x.nn === 1).translationSha = sha12Of(path.join(dir, "translated-chunks", "translated-chunk-01.md"));
    fs.writeFileSync(path.join(dir, "verify-results.json"), JSON.stringify(vr), "utf-8");

    const r = run(dir, {});
    const c1 = r.state.chunks[0];
    assert.equal(c1.stage, "re-review", "译文 sha 变化应进重审");
    // 旧报告 a 半全部失配、b 半仍匹配（不级联）
    const halves = halfSlices(neu);
    const staleDims = c1.staleHalves.a ?? [];
    assert.equal(staleDims.length, 4, "a 半块 4 维全 stale");
    assert.ok(!(c1.staleHalves.b ?? []).length, "b 半块不得级联");
    assert.ok(r.state.handoffStale.includes(2), "N+1（chunk 2）handoff 失效标记");
    // 队列只派 a 半 4 维
    assert.equal(r.queue.q.filter((u) => u.half === "a").length, 4);
    assert.equal(r.queue.q.filter((u) => u.half === "b").length, 0);
    assert.equal(halves.a.sha.length, 12);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("re-keying：原文变更 → 重分段动作 + 全局作废语义", () => {
  const dir = makeWorkdir();
  try {
    fs.appendFileSync(path.join(dir, "original-testdoc.md"), "\n## New Sec\n\n新增内容触发原文 sha 变化。\n");
    const r = run(dir, {});
    assert.ok(r.state.needsResegment, "应检出原文变更");
    assert.equal(r.queue.action.step, "resegment");
    assert.ok(r.statusText.includes("重分段"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------- 动词（HANDOFF §6 判据） ----------

test("停止=封存（两出口文案）；继续=解封续跑（R18-③）", () => {
  const dir = makeWorkdir();
  try {
    let r = verb(dir, "stop");
    assert.equal(r.exitCode, 0);
    assert.ok(fs.readFileSync(path.join(dir, "pending.md"), "utf-8").includes("type: sealed"));
    r = run(dir, {});
    assert.ok(r.statusText.includes("重新翻译"), "封存态须写明两出口");
    assert.equal(r.queue.q.length, 0, "封存不派发");
    r = verb(dir, "continue");
    assert.ok(!fs.existsSync(path.join(dir, "pending.md"), ), "解封应删旗标");
    r = run(dir, {});
    assert.ok(/step: translate/.test(r.statusText), "解封后续跑");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("重翻第 N 章：章↔chunk 披露 + 作废该章成果（R5）", () => {
  const dir = makeWorkdir();
  try {
    pushThroughVerify(dir, 1);
    pushThroughVerify(dir, 2);
    const r = verb(dir, "retranslate", { chapter: 1 });
    assert.equal(r.exitCode, 0);
    assert.ok(r.disclosure.includes("chunk"), "须披露章↔chunk 映射");
    assert.ok(!fs.existsSync(path.join(dir, "translated-chunks", "translated-chunk-01.md")), "第 1 章成果作废");
    assert.ok(fs.existsSync(path.join(dir, "translated-chunks", "translated-chunk-02.md")), "他章保留");
    const inv = scanWorkdir(dir);
    assert.ok(inv.events.some((e) => e.ev === "invalidate" && e.nn === 1));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("样张（R16）：披露首 chunk + 等确认文案；重新翻译（R18-③）：清产物保原文", () => {
  const dir = makeWorkdir();
  try {
    let r = verb(dir, "sample", { chapter: 1 });
    assert.equal(r.exitCode, 0);
    assert.ok(r.disclosure.includes("样张") && r.disclosure.includes("确认"));
    r = verb(dir, "restart");
    assert.equal(r.exitCode, 0);
    assert.ok(fs.existsSync(path.join(dir, "original-testdoc.md")), "原文保留");
    assert.ok(!fs.existsSync(path.join(dir, "manifest.md")), "分段作废");
    assert.ok(!fs.existsSync(path.join(dir, "chunks")), "chunks 清空");
    assert.ok(fs.existsSync(path.join(dir, "events.jsonl")), "事件流水保留（restart 记录）");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------- PENDING-USER 菜单（R2）+ 菜单②（G7） ----------

test("PENDING-USER：三选项菜单 + 菜单②文案（自动补空格、永不自动重翻）", () => {
  const dir = makeWorkdir();
  try {
    fs.writeFileSync(path.join(dir, "pending.md"), "type: pending-user\n原因：限流挂起\n", "utf-8");
    const r = run(dir, {});
    assert.ok(r.statusText.includes("①") && r.statusText.includes("②") && r.statusText.includes("③"), "三选项");
    assert.ok(r.statusText.includes("自动补空格"), "G7 间距条款");
    assert.ok(r.statusText.includes("永不自动重翻"), "G7 手修保护");
    assert.equal(r.queue.q.length, 0, "挂起不派发");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------- 计数器（G6/R4）与自动转挂起 ----------

test("deriveCounters：升级后清零语义（verify-pass 重置打回）、session-end 重置预算窗", () => {
  const ev = [
    { ev: "reject", nn: 1 }, { ev: "reject", nn: 1 },
    { ev: "escalate", nn: 1 },
    { ev: "verify-pass", nn: 1 },          // 打回清零（升级后该 chunk 计数器清零——G6 条款 1）
    { ev: "reject", nn: 1 },               // 1 次，未超限
    { ev: "dispatch", nn: 2 }, { ev: "dispatch", nn: 2 },
    { ev: "session-end" },                 // 预算窗重置
    { ev: "dispatch", nn: 3 },
  ];
  const c = deriveCounters(ev);
  assert.equal(c.mechanicalRejects[1], 1);
  assert.equal(c.escalations[1], 1, "累计升级跨轮不重置");
  assert.equal(c.dispatchedSinceSessionEnd, 1);
});

test("机械打回 >2 / 累计升级 ≥2 → 自动转挂起（G6/R4）", () => {
  const dir = makeWorkdir();
  try {
    appendEvents(dir, [{ ev: "reject", nn: 1 }, { ev: "reject", nn: 1 }, { ev: "reject", nn: 1 }]);
    let r = run(dir, {});
    assert.ok(fs.existsSync(path.join(dir, "pending.md")), "第 3 次打回应自动挂起");
    assert.ok(fs.readFileSync(path.join(dir, "pending.md"), "utf-8").includes("pending-user"));
    assert.ok(scanWorkdir(dir).events.some((e) => e.ev === "suspend"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  const dir2 = makeWorkdir();
  try {
    appendEvents(dir2, [{ ev: "escalate", nn: 2 }, { ev: "verify-pass", nn: 2 }, { ev: "escalate", nn: 2 }]);
    run(dir2, {});
    assert.ok(fs.existsSync(path.join(dir2, "pending.md")), "累计升级 ≥2 应自动挂起（不随清零重置）");
  } finally {
    fs.rmSync(dir2, { recursive: true, force: true });
  }
});

// ---------- 会话预算（R14） ----------

test("预算到点 = 干净退出点：不物化不派发 + 下次口令", () => {
  const dir = makeWorkdir();
  try {
    pushThroughVerify(dir, 1);
    appendEvents(dir, [{ ev: "dispatch", nn: 9 }, { ev: "dispatch", nn: 9 }]);
    const r = run(dir, { budget: 2 });
    assert.equal(r.queue.dispatch.length, 0, "预算到点不得派发");
    assert.ok(!fs.existsSync(path.join(dir, "staging")) || fs.readdirSync(path.join(dir, "staging")).length === 0, "无暂存");
    assert.ok(r.statusText.includes("干净退出点"), "首屏提示");
    assert.ok(r.statusText.includes("继续翻译"), "下次口令");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------- 章映射与全局阶段 ----------

test("chapterMap：H2 章结构解析；全局阶段推进", () => {
  const dir = makeWorkdir();
  try {
    const map = chapterMap(scanWorkdir(dir));
    assert.ok(map.length >= 3, "每 H2 一章");
    assert.ok(map[0].chunks.length >= 1);
    // 全部 done → ready-merge
    for (const c of scanWorkdir(dir).chunks) {
      pushThroughVerify(dir, c.nn);
      writeReviews(dir, c.nn);
    }
    const r = run(dir, {});
    assert.equal(r.state.global, "ready-merge");
    assert.equal(r.queue.action.step, "merge");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
