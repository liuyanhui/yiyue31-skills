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
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { run as segRun } from "../../segment/segment.mjs";
import {
  run,
  verb,
  scanWorkdir,
  deriveState,
  buildQueue,
  sectionSlices,
  parseReportHead,
  nnKey,
  chapterMap,
  deriveCounters,
  appendEvents,
  readEvents,
  suspendTxn,
} from "../../status.mjs";

const DIMS = ["accuracy", "translationese", "ai-tone", "readability"];
const SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "status.mjs");

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

// 把 chunk nn 推进到审校前（译文 + 裁定 + 机械校验通过）。译文带 3 个 H2 节（S2① 节级夹具）
function pushThroughVerify(dir, n, textOverride) {
  const tdir = path.join(dir, "translated-chunks");
  fs.mkdirSync(tdir, { recursive: true });
  const text = textOverride ?? `## 一\n\n第 ${n} 块段一：术语 alpha 保留。\n\n## 二\n\n段二：数字 42 与单位 3km 保持。\n\n## 三\n\n段三：结尾。`;
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

// 为 chunk nn 写齐 4 维整 chunk 首审报告（头三行 + 逐节 sha 表，fresh）或指定失配节
function writeReviews(dir, n, breakSections = []) {
  const rdir = path.join(dir, "reviews");
  fs.mkdirSync(rdir, { recursive: true });
  const secs = sectionSlices(fs.readFileSync(path.join(dir, "translated-chunks", `translated-chunk-${nn2(n)}.md`), "utf-8"));
  for (const dim of DIMS) {
    const L = [`sha: ${sha12Of(path.join(dir, "translated-chunks", `translated-chunk-${nn2(n)}.md`))}`, "model: test", "time: 2026-10-16T00:00:00Z"];
    for (const s of secs) L.push(`sec: ${s.id} ${breakSections.includes(s.id) ? "000000000000" : s.sha} ${s.title}`);
    L.push(`结论：${dim} 审校通过。观察 ${n}-${dim}。`);
    fs.writeFileSync(path.join(rdir, `review-${dim}-chunk-${nn2(n)}.md`), L.join("\n") + "\n", "utf-8");
  }
}

// ---------- 基础 ----------

test("sectionSlices（S2①）：切片拼接恒等原文；preamble/无标题单节；fence 内标题不切节", () => {
  const text = "# 标题一\n\n正文一。\n\n## 标题二\n\n正文二。\n\n### 标题三\n\n正文三。\n";
  const secs = sectionSlices(text);
  assert.equal(secs.map((s) => s.text).join(""), text, "切片拼接恒等原文");
  assert.deepEqual(secs.map((s) => s.title), ["标题一", "标题二", "标题三"]);
  assert.deepEqual(secs.map((s, i) => s.id).slice(-1), [`s${secs.length}`]);
  // preamble：首标题前内容自成一级
  const pre = sectionSlices("前言段。\n\n## 甲\n\n正文。\n");
  assert.equal(pre[0].title, "preamble");
  assert.equal(pre.length, 2);
  // 无标题全文 = 单节（root）
  assert.equal(sectionSlices("只有一段。\n\n再一段。\n").length, 1);
  // fence 感知：围栏内 # 行不是标题（segment 同款状态机）
  const fenced = sectionSlices("## 甲\n\n```text\n## 围栏内假标题\n```\n\n正文。\n");
  assert.equal(fenced.length, 1, "围栏内标题不得切节");
});

test("parseReportHead（S2② 头三行机械校验）：sha/model/time + sec 表解析与缺行检出", () => {
  const ok = parseReportHead("sha: abc123def456\nmodel: test-model\ntime: 2026-10-16T01:02:03Z\nsec: s1 aaaaaaaaaaaa 引言\nsec: s2 bbbbbbbbbbbb 安装\n结论……\n");
  assert.equal(ok.sha, "abc123def456");
  assert.equal(ok.model, "test-model");
  assert.equal(ok.time, "2026-10-16T01:02:03Z");
  assert.deepEqual(ok.secs, { s1: "aaaaaaaaaaaa", s2: "bbbbbbbbbbbb" });
  assert.deepEqual(ok.malformed, []);
  // delta 单节报告：只写头三行（sha 即该节 sha）
  const delta = parseReportHead("sha: cccccc\ntime: x\n");
  assert.equal(delta.sha, null, "sha 须 12 位 hex");
  assert.deepEqual(delta.malformed.sort(), ["缺 model: 行", "缺 sha: 行"], "缺行逐项检出");
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
    writeReviews(dir, 1, ["s2"]); // 节 s2 报告表失配 → 未完成
    fs.rmSync(path.join(dir, "status.md"), { force: true });
    const r = run(dir, {});
    assert.equal(r.exitCode, 0);
    const md = fs.readFileSync(path.join(dir, "status.md"), "utf-8");
    assert.ok(/重审中|审校中/.test(md), "状态应重建为审校/重审阶段");
    assert.equal(r.state.chunks[0].reviewDone, DIMS.length * 2, "4 维 × 未变 2 节 fresh（s2 失配）");
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
      { dim: "accuracy", text: "探针样本内容（含植入缺陷）" },
      { dim: "readability", text: "探针样本内容二" },
    ]), "utf-8");
    const r = run(dir, { probeTruth: truthFile, verb: "dispatch" }); // C3：物化需 dispatch 动词
    // 真单元 4（整 chunk × 4 维首审，S2①）+ 探针 2
    assert.equal(r.queue.q.length, 4 + 2, "4 整 chunk 首审单元 + 2 探针");
    const staging = fs.readdirSync(path.join(dir, "staging"));
    assert.equal(staging.length, 6, "staging 全量物化");
    for (const f of staging) assert.match(f, /^review-[\w-]+-unit-\d{3}\.md$/, "同构命名");
    // M1c 延伸：探针真实样本文本须落 staging（占位符退场——审校者读到的是真缺陷样本）
    const stagedAll = staging.map((f) => fs.readFileSync(path.join(dir, "staging", f), "utf-8"));
    assert.ok(stagedAll.some((s) => s === "探针样本内容（含植入缺陷）"), "探针文本一已物化");
    assert.ok(stagedAll.some((s) => s === "探针样本内容二"), "探针文本二已物化");
    assert.ok(!stagedAll.some((s) => s.includes("__PROBE_BODY__")), "占位符不得再出现");
    const md = fs.readFileSync(path.join(dir, "status.md"), "utf-8");
    assert.ok(!/probe/.test(md), "status.md 不得出现 probe 字样（不可分辨）");
    assert.ok(!fs.existsSync(path.join(dir, "probes")), "工作区无 probes/ 目录");
    assert.ok(!staging.some((f) => f.includes("probe")), "暂存名不含 probe 标记");
    // 派发清单输出名 = 新命名（整 chunk 无半块后缀）
    assert.ok(r.queue.dispatch.every((d) => /reviews\/review-[\w-]+-chunk-\d+(-s\d+)?\.md$/.test(d.output)));
  } finally {
    fs.rmSync(truthFile, { force: true });
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------- stale 半块级分类（R1） ----------

test("译文变更 → 仅变化节（s2）4 维 stale、未变节豁免不级联、N+1 handoff 失效（S2①）", () => {
  const dir = makeWorkdir();
  try {
    pushThroughVerify(dir, 1);
    pushThroughVerify(dir, 2);
    writeReviews(dir, 1);
    writeReviews(dir, 2);
    // 只改第 2 节内容（节内段落追加），随后机械校验已按新 sha 重过（模拟修复后重验）
    const tp = path.join(dir, "translated-chunks", "translated-chunk-01.md");
    const old = fs.readFileSync(tp, "utf-8");
    const neu = old.replace("段二：数字 42", "段二：数字 42（修复补充说明）");
    assert.notEqual(neu, old, "夹具应实际改动节 2");
    fs.writeFileSync(tp, neu, "utf-8");
    const vr = JSON.parse(fs.readFileSync(path.join(dir, "verify-results.json"), "utf-8"));
    vr.results.find((x) => x.nn === 1).translationSha = sha12Of(tp);
    fs.writeFileSync(path.join(dir, "verify-results.json"), JSON.stringify(vr), "utf-8");

    const r = run(dir, {});
    const c1 = r.state.chunks[0];
    assert.equal(c1.stage, "re-review", "译文 sha 变化应进重审");
    // S2①：stale 精确到节——s2 四维全 stale；s1/s3 未变不级联
    assert.deepEqual(Object.keys(c1.staleSections), ["s2"], "仅节 s2 stale");
    assert.deepEqual(c1.staleSections.s2.sort(), [...DIMS].sort(), "s2 节 4 维全 stale");
    assert.equal(c1.reviewDone, DIMS.length * 2, "未变节 s1/s3 各维仍 fresh（4 维 × 2 节）");
    assert.ok(r.state.handoffStale.includes(2), "N+1（chunk 2）handoff 失效标记");
    // 队列（S2②）：4 维 × 变化节 s2 = delta 单节单元（变化节 × 4 维差集）
    assert.equal(r.queue.q.length, 4);
    assert.ok(r.queue.q.every((u) => u.sec === "s2" && u.kind === "real" && u.nn === 1), "delta 单元 = 变化节 s2");
    // 节 sha 可从 state 直接取（供派发指令随附）
    assert.equal(c1.sections.length, 3);
    for (const s of c1.sections) assert.match(s.sha, /^[0-9a-f]{12}$/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("S2② delta 全链路：队列=变化节×4 维；staging 物化节文本；dispatch 事件携 c4 detail；delta 报告落位 → fresh → done", () => {
  const dir = makeWorkdir();
  try {
    pushThroughVerify(dir, 1);
    pushThroughVerify(dir, 2);
    writeReviews(dir, 1);
    writeReviews(dir, 2);
    // 改节 2 + 机械校验重过
    const tp = path.join(dir, "translated-chunks", "translated-chunk-01.md");
    const neu = fs.readFileSync(tp, "utf-8").replace("段二：数字 42", "段二：数字 42（修复表述）");
    fs.writeFileSync(tp, neu, "utf-8");
    const vr = JSON.parse(fs.readFileSync(path.join(dir, "verify-results.json"), "utf-8"));
    vr.results.find((x) => x.nn === 1).translationSha = sha12Of(tp);
    fs.writeFileSync(path.join(dir, "verify-results.json"), JSON.stringify(vr), "utf-8");

    // 派发（C3 dispatch 动词）→ delta 单元物化
    const r = run(dir, { verb: "dispatch" });
    assert.equal(r.queue.q.length, 4, "变化节 s2 × 4 维");
    const staging = fs.readdirSync(path.join(dir, "staging"));
    assert.equal(staging.length, 4);
    const secs = sectionSlices(neu);
    const s2 = secs.find((s) => s.id === "s2");
    const bodies = staging.map((f) => fs.readFileSync(path.join(dir, "staging", f), "utf-8"));
    assert.ok(bodies.every((b) => b === s2.text), "staging 物化 = 节 s2 文本（被审单元恰为该节）");
    // 派发清单 c4 行（机械可验三件 + grep 提示）
    for (const d of r.queue.dispatch) {
      assert.equal(d.c4.lines, s2.text.split("\n").length, "c4 行数自内容派生");
      assert.equal(d.c4.secs.length, 1);
      assert.equal(d.c4.secs[0].sha, s2.sha, "c4 节 sha = 当前节 sha");
      assert.match(d.output, /reviews\/review-[\w-]+-chunk-01-s2\.md$/, "输出名 = delta 单节报告位");
    }
    const md = fs.readFileSync(path.join(dir, "status.md"), "utf-8");
    assert.ok(md.includes("c4: 共") && md.includes('grep -n "^#"'), "status.md 派发清单渲染 c4 行");
    // dispatch 事件携带 c4 detail（final-gate 抽核对象）
    const dispatches = scanWorkdir(dir).events.filter((e) => e.ev === "dispatch");
    assert.equal(dispatches.length, 4);
    for (const e of dispatches) {
      assert.equal(e.sec, "s2");
      const c4 = JSON.parse(e.detail);
      assert.equal(c4.sha, s2.sha, "事件 detail 与物化内容同源");
      assert.deepEqual(c4.range, [s2.title, s2.title]);
    }
    // 审校者按 delta 契约回报告（头三行，sha=节 sha）→ 该节 fresh → chunk done
    for (const dim of DIMS) {
      fs.writeFileSync(
        path.join(dir, "reviews", `review-${dim}-chunk-01-s2.md`),
        `sha: ${s2.sha}\nmodel: test\ntime: 2026-10-16T00:00:00Z\n结论：${dim} delta 补审通过（01-s2-${dim} 专属观察行）。\n`,
        "utf-8"
      );
    }
    const r2 = run(dir, {});
    assert.equal(r2.state.chunks[0].stage, "done", "delta 报告落位 → s2 fresh（whole 报告仍证 s1/s3）→ done");
    assert.equal(r2.state.chunks[0].reviewDone, DIMS.length * secs.length);
    assert.equal(r2.queue.q.length, 0, "无残余队列");
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

// ---------- 双语派生视图三态（C3，Phase 1） ----------

test("双语版三态：未生成 / 已生成（基于当前交付物）/ 已过期（重说动词再生成）", () => {
  const dir = makeWorkdir(1);
  try {
    const dv = path.join(dir, "translated-testdoc-zh.md");
    fs.writeFileSync(dv, "> **原文**：T\n\n---\n\n正文。\n", "utf-8");
    let r = run(dir, {});
    assert.equal(r.state.global, "delivered");
    assert.ok(r.statusText.includes("双语版：未生成"), "未生成态提示动词");
    // 生成后：头部源交付物 sha === 当前交付物 → fresh
    fs.writeFileSync(
      path.join(dir, "translated-testdoc-bilingual.md"),
      `> **双语版**：只读派生视图——源交付物 sha1（前 12）：${sha12Of(dv)}；重说可再生成\n\n---\n\n正文。\n`,
      "utf-8"
    );
    r = run(dir, {});
    assert.ok(r.statusText.includes("双语版：已生成"), r.statusText);
    // 交付物更新 → 头部锚过期（restart / 术语统一再 PASS / re-keying 三路径的静默滞留即此态）
    fs.writeFileSync(dv, "> **原文**：T\n\n---\n\n正文（更新）。\n", "utf-8");
    r = run(dir, {});
    assert.ok(r.statusText.includes("双语版：已过期"), r.statusText);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------- CLI 冒烟（守卫真实性：Windows pathname 坑曾使 M1b CLI 静默空转、退出码 0） ----------

test("CLI：真实执行（status.md 落盘 + stdout 输出），非静默空转", () => {
  const dir = makeWorkdir();
  try {
    const r = spawnSync(process.execPath, [SCRIPT, dir], { encoding: "utf-8" });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.ok(r.stdout.includes("status —"), "CLI 应输出 status.md 内容");
    assert.ok(fs.existsSync(path.join(dir, "status.md")), "status.md 由 CLI 落盘");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------- S2① 机械验收：3 节文档改节 2 → --json 仅节 2 stale ----------

test("S2① 验收：3 节文档改节 2 → status.mjs --json 仅节 s2 stale（未变节豁免）", () => {
  const dir = makeWorkdir(1);
  try {
    pushThroughVerify(dir, 1); // 默认译文 = 3 个 H2 节
    writeReviews(dir, 1); // 4 维首审报告全 fresh
    let r = run(dir, {});
    assert.equal(r.state.chunks[0].stage, "done", "前置：全 fresh 应 done");
    // 改节 2（节内追加），机械校验按新 sha 重过（模拟修复后重验）
    const tp = path.join(dir, "translated-chunks", "translated-chunk-01.md");
    const neu = fs.readFileSync(tp, "utf-8").replace("段二：数字 42", "段二：数字 42 修复后表述");
    fs.writeFileSync(tp, neu, "utf-8");
    const vr = JSON.parse(fs.readFileSync(path.join(dir, "verify-results.json"), "utf-8"));
    vr.results.find((x) => x.nn === 1).translationSha = sha12Of(tp);
    fs.writeFileSync(path.join(dir, "verify-results.json"), JSON.stringify(vr), "utf-8");
    // 验收口径：CLI --json 原始输出（非进程内调用）
    const cli = spawnSync(process.execPath, [SCRIPT, dir, "--json"], { encoding: "utf-8" });
    assert.equal(cli.status, 0, cli.stdout + cli.stderr);
    const j = JSON.parse(cli.stdout);
    const c = j.state.chunks[0];
    assert.equal(c.stage, "re-review");
    assert.deepEqual(Object.keys(c.staleSections), ["s2"], "仅节 s2 stale");
    assert.deepEqual(c.staleSections.s2.sort(), [...DIMS].sort(), "s2 × 4 维");
    assert.equal(j.queue, 4, "重审派发 4 维（① 整 chunk 单元）");
    // 未变节 sha 不变（豁免的机械基础：节表与报告 sec 表仍逐节相等）
    const fresh2 = run(dir, {});
    assert.equal(fresh2.state.chunks[0].reviewDone, 8, "s1/s3 × 4 维仍 fresh");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------- S2③ 内容冻结窗 + 双计数器 ----------

// 冻结窗夹具：全 chunk done + 统稿完成（consistency 落盘）+ 冷读产物在 → global=cold-read（窗开启）
function pushToFreeze(dir) {
  for (const c of scanWorkdir(dir).chunks) {
    pushThroughVerify(dir, c.nn);
    writeReviews(dir, c.nn);
  }
  fs.writeFileSync(path.join(dir, "merged-draft.md"), "# merged\n", "utf-8");
  fs.writeFileSync(path.join(dir, "consistency-testdoc.md"), "# 统稿清单\n", "utf-8");
  fs.writeFileSync(path.join(dir, "cold-read-testdoc.md"), "# 冷读台账\n", "utf-8");
}

// 冻结窗内"用户点名修复"：改节 2 + 机械校验按新 sha 重过（同 stale 夹具手法）
function freezeFix(dir) {
  const tp = path.join(dir, "translated-chunks", "translated-chunk-01.md");
  fs.writeFileSync(tp, fs.readFileSync(tp, "utf-8").replace("段二：数字 42", "段二：数字 42（点名修复）"), "utf-8");
  const vr = JSON.parse(fs.readFileSync(path.join(dir, "verify-results.json"), "utf-8"));
  vr.results.find((x) => x.nn === 1).translationSha = sha12Of(tp);
  fs.writeFileSync(path.join(dir, "verify-results.json"), JSON.stringify(vr), "utf-8");
}

test("S2③ 冻结窗复欠队列：窗内修复 → 变化节 × 4 维补审优先于全局动作；派发批记 freeze-round 轮", () => {
  const dir = makeWorkdir(1);
  try {
    pushToFreeze(dir);
    freezeFix(dir);
    let r = run(dir, {});
    assert.equal(r.state.global, "cold-read", "前置：统稿完成进入冻结窗（冷读阶段）");
    assert.ok(r.statusText.includes("内容冻结窗"), "人话段披露冻结窗与轮次");
    // 补审派发（第 1 轮，硬门内）→ 队列 = 变化节 s2 × 4 维，action 空（优先于 pm-review 动作）
    r = run(dir, { verb: "dispatch" });
    assert.equal(r.exitCode, 0);
    assert.equal(r.queue.q.length, 4, "s2 × 4 维补审单元");
    assert.ok(r.queue.q.every((u) => u.sec === "s2" && u.nn === 1));
    const evs = scanWorkdir(dir).events;
    assert.equal(evs.filter((e) => e.ev === "freeze-round").length, 1, "派发批落 freeze-round 事件（计数器事实源）");
    assert.equal(evs.filter((e) => e.ev === "dispatch").length, 4);
    // delta 报告落位 → 复欠清零 → 队列回到全局动作（pm-review）
    const s2 = sectionSlices(fs.readFileSync(path.join(dir, "translated-chunks", "translated-chunk-01.md"), "utf-8")).find((s) => s.id === "s2");
    for (const dim of DIMS) {
      fs.writeFileSync(path.join(dir, "reviews", `review-${dim}-chunk-01-s2.md`), `sha: ${s2.sha}\nmodel: test\ntime: 2026-10-16T00:00:00Z\n结论：${dim} 冻结窗补审通过。\n`, "utf-8");
    }
    r = run(dir, {});
    assert.equal(r.queue.q.length, 0, "复欠清零");
    assert.equal(r.queue.action.step, "pm-review", "回到全局阶段动作");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("S2③ 冻结窗补审轮 >2 硬门：第 3 轮 dispatch → 非零退出 + pending.md 上报 + 不物化", () => {
  const dir = makeWorkdir(1);
  try {
    pushToFreeze(dir);
    freezeFix(dir);
    appendEvents(dir, [{ ev: "freeze-round", units: 4 }, { ev: "freeze-round", units: 4 }]); // 已耗 2 轮（事件流事实）
    const r = run(dir, { verb: "dispatch" });
    assert.equal(r.exitCode, 3, "冻结窗补审轮超限须非零退出（S2③ 硬门）");
    const pend = fs.readFileSync(path.join(dir, "pending.md"), "utf-8");
    assert.ok(pend.includes("pending-user") && pend.includes("冻结窗"), "pending.md 上报在场");
    assert.ok(!fs.existsSync(path.join(dir, "staging")) || fs.readdirSync(path.join(dir, "staging")).length === 0, "超限不得物化");
    assert.ok(!scanWorkdir(dir).events.some((e) => e.ev === "dispatch"), "不得追加派发事件");
    assert.ok(scanWorkdir(dir).events.some((e) => e.ev === "suspend" && String(e.detail).includes("freeze")), "suspend 事件落流");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("S2③ 双计数器不挤占：冻结窗轮已耗 2 不影响 per-chunk 阶段派发；fix/freeze-round 分开派生", () => {
  const c = deriveCounters([
    { ev: "freeze-round", units: 4 }, { ev: "freeze-round", units: 4 },
    { ev: "fix", nn: 3 }, { ev: "fix", nn: 3 },
  ]);
  assert.equal(c.freezeRounds, 2, "项目级冻结窗轮");
  assert.equal(c.reviewRounds[3], 2, "每 chunk 修复环轮——互不挤占");
  const dir = makeWorkdir(2);
  try {
    pushThroughVerify(dir, 1);
    appendEvents(dir, [{ ev: "freeze-round", units: 4 }, { ev: "freeze-round", units: 4 }]);
    const r = run(dir, { verb: "dispatch" }); // per-chunk 首审派发——不受冻结窗轮牵连
    assert.equal(r.exitCode, 0, "per-chunk 阶段派发不受冻结窗硬门影响");
    assert.equal(r.queue.q.length, 4, "整 chunk 首审 4 单元照常物化");
    assert.equal(scanWorkdir(dir).events.filter((e) => e.ev === "freeze-round").length, 2, "per-chunk 派发不记冻结窗轮");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("S2③ grep 验收：SKILL.md Step 8 节含冻结语义、≤2 硬门与统稿先于终轮", () => {
  const md = fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "SKILL.md"), "utf-8");
  const sec = md.slice(md.indexOf("### Step 8"), md.indexOf("### Step 9"));
  assert.ok(sec.length > 0, "Step 8 节在场");
  assert.ok(sec.includes("冻结"), "冻结语义命中 Step 8");
  assert.ok(sec.includes("只登记不修") && sec.includes("用户点名才修"), "pm-review 类发现只登记不修");
  assert.ok(sec.includes("≤2"), "冻结窗补审轮 ≤2 硬门");
  assert.ok(sec.includes("统稿先于终轮"), "统稿先于终轮次序（源①④4）");
  assert.ok(sec.includes("unify.md"), "统稿细则迁出引用");
});

// ---------- S2④ fixer 闭环 ----------

const VM_SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "verify-mech.mjs");

// 六节可校验译文：数字 0-5 全数在场、无英文长串、中文间距合规（verify-mech 真跑可过）
function verifiableTranslation() {
  const L = [];
  for (let i = 0; i < 6; i++) L.push(`## 第 ${i} 部分标题\n\n段 ${i} 的译文内容：数字 ${i} 保持一致，术语落实。`);
  return L.join("\n\n") + "\n";
}

test("S2④ fixer 包物化：报告全文+译文+定位块进包；--dims 选维；fix 事件计轮；入参校验", () => {
  const dir = makeWorkdir(1);
  try {
    pushThroughVerify(dir, 1);
    writeReviews(dir, 1);
    fs.appendFileSync(path.join(dir, "reviews", "review-accuracy-chunk-01.md"), "\n| 1 | \"数字 42\" | 数字漂移：42 → 四十二 | 改回 42 |\n");
    // 入参校验
    assert.equal(run(dir, { verb: "fix" }).exitCode, 1, "缺 --nn 须用法错");
    assert.equal(run(dir, { verb: "fix", nn: 1, dims: "nope" }).exitCode, 1, "未知维度须用法错");
    assert.equal(run(dir, { verb: "fix", nn: 99 }).exitCode, 1, "不在 manifest 须用法错");
    // 物化（单维）
    const r = run(dir, { verb: "fix", nn: 1, dims: "accuracy" });
    assert.equal(r.exitCode, 0, r.errors?.join(";"));
    assert.ok(r.disclosure.includes("fixer 包已物化"), "披露包路径与轮次");
    const pkgPath = path.join(dir, "staging", "fixer-chunk-01.md");
    const pkg = fs.readFileSync(pkgPath, "utf-8");
    assert.match(pkg, /^unit-sha: [0-9a-f]{12}$/m);
    assert.match(pkg, /^fix-round: 1\/3$/m);
    assert.match(pkg, /^sec: s1 [0-9a-f]{12} /m, "逐节定位表（c4 同构）");
    assert.ok(pkg.includes("## 译文（修复对象，全文）"), "译文全文进包");
    assert.ok(pkg.includes("数字漂移：42 → 四十二"), "FAIL 报告全文进包（主上下文不进）");
    assert.ok(!pkg.includes("## 报告全文：translationese"), "--dims 选维：未选维度不进包");
    assert.ok(!pkg.includes("__chunk_original__") && !pkg.includes("chunks/chunk-"), "chunk 原文不占包（fixer 包外自取）");
    const evs = scanWorkdir(dir).events;
    const fix = evs.find((e) => e.ev === "fix");
    assert.ok(fix && fix.nn === 1 && fix.dims === "accuracy" && fix.freeze === false, "fix 事件落流（轮次事实源）");
    assert.equal(deriveCounters(evs).reviewRounds[1], 1, "修复环轮=1");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("S2④ 全链路：FAIL→fixer→verify→复欠（事件流各环节在场；verify 事件由 verify-mech CLI 落流）", () => {
  const dir = makeWorkdir(1);
  try {
    pushThroughVerify(dir, 1, verifiableTranslation());
    writeReviews(dir, 1); // 4 维 fresh 首审
    fs.appendFileSync(path.join(dir, "reviews", "review-readability-chunk-01.md"), "\n| 1 | \"段 2\" | 句式冗长 | 拆句 |\n");
    const tp = path.join(dir, "translated-chunks", "translated-chunk-01.md");
    const origChunk = path.join(dir, "chunks", fs.readdirSync(path.join(dir, "chunks"))[0]);

    // ① fixer 包物化（FAIL 发现驱动）
    let r = run(dir, { verb: "fix", nn: 1, dims: "readability" });
    assert.equal(r.exitCode, 0, r.errors?.join(";"));
    // ② fixer 修复：改节 2（s2 = "第 1 部分"——sha 变化），数字/结构保持
    const before = fs.readFileSync(tp, "utf-8");
    fs.writeFileSync(tp, before.replace("段 1 的译文内容：数字 1 保持一致，术语落实。", "段 1 的译文内容：数字 1 保持一致，术语已落实（fixer 修复）。"), "utf-8");
    // ③ verify-mech 真跑（CLI）：verify-pass 事件 + verify-results 新记录
    const v = spawnSync(process.execPath, [VM_SCRIPT, origChunk, tp], { encoding: "utf-8" });
    assert.equal(v.status, 0, "修复后机械校验应通过：\n" + v.stdout + v.stderr);
    const evs = scanWorkdir(dir).events;
    assert.ok(evs.some((e) => e.ev === "verify-pass" && e.nn === 1), "verify 环节进事件流");
    // ④ 复欠：dispatch → 变化节 s2 × 4 维 delta 队列自动回队列
    r = run(dir, { verb: "dispatch" });
    assert.equal(r.exitCode, 0);
    assert.equal(r.queue.q.length, 4, "复欠 = 变化节 × 4 维");
    assert.ok(r.queue.q.every((u) => u.sec === "s2" && u.nn === 1));
    const evs2 = scanWorkdir(dir).events;
    assert.ok(evs2.some((e) => e.ev === "fix" && e.nn === 1), "fixer 环节在场");
    assert.equal(evs2.filter((e) => e.ev === "dispatch").length, 4, "复欠派发在场");
    // ⑤ delta 报告落位 → 欠账清（chunk done）
    const s2 = sectionSlices(fs.readFileSync(tp, "utf-8")).find((s) => s.id === "s2");
    for (const dim of DIMS) {
      fs.writeFileSync(path.join(dir, "reviews", `review-${dim}-chunk-01-s2.md`), `sha: ${s2.sha}\nmodel: test\ntime: 2026-10-16T00:00:00Z\n结论：${dim} 复欠补审通过。\n`, "utf-8");
    }
    r = run(dir, {});
    assert.equal(r.state.chunks[0].stage, "done", "复欠清零 → done");
    assert.equal(r.state.global, "ready-merge");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("S2④ 修复环轮每 chunk ≤3：第 4 次物化被拒 → 停该 chunk + residue 登记，项目不停", () => {
  const dir = makeWorkdir(2);
  try {
    pushThroughVerify(dir, 1);
    writeReviews(dir, 1);
    // 三轮合法物化（fix 事件 = 轮次事实源）
    for (let i = 1; i <= 3; i++) assert.equal(run(dir, { verb: "fix", nn: 1 }).exitCode, 0, `第 ${i} 轮应允许`);
    assert.equal(deriveCounters(scanWorkdir(dir).events).reviewRounds[1], 3);
    // 第 4 次拒绝：exit 3 + residue 文件 + residue 事件
    const r = run(dir, { verb: "fix", nn: 1 });
    assert.equal(r.exitCode, 3, "修复环轮超限须非零退出");
    const rs = fs.readFileSync(path.join(dir, "residue-chunk-01.md"), "utf-8");
    assert.ok(rs.includes("rounds: 3/3") && rs.includes("unit-sha:"), "residue 登记在场");
    assert.ok(scanWorkdir(dir).events.some((e) => e.ev === "residue" && e.nn === 1), "residue 事件落流");
    // 项目不停：chunk 1 让位，队列推进 chunk 2；无 pending.md（区别于冻结窗上报与打回挂起）
    const r2 = run(dir, {});
    assert.equal(r2.exitCode, 0);
    assert.equal(r2.state.chunks[0].stage, "residue", "停修 chunk 标记 residue");
    assert.equal(r2.queue.action.step, "translate", "动作位让给 chunk 2（项目不受损）");
    assert.ok(!fs.existsSync(path.join(dir, "pending.md")), "不停项目——不写 pending.md");
    assert.ok(r2.statusText.includes("停修登记"), "人话段披露停修");
    // 停修后不再受理该 chunk 修复
    assert.equal(run(dir, { verb: "fix", nn: 1 }).exitCode, 1, "已停修 chunk 拒绝再派修复");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------- S2⑤ suspend/pending 同事务 + events 原子写 + 撕裂容错 + §9 mtime 对账 ----------

test("S2⑤ appendEvents 原子写：追加后全文逐行可解析、末行换行恒在；遗留 .tmp 被覆盖清理", () => {
  const dir = makeWorkdir(1);
  try {
    // 遗留 .tmp = 上次中断残影（rename 前被杀）——本次写入应覆盖清理，不入流不被扫
    fs.writeFileSync(path.join(dir, "events.jsonl.tmp"), "垃圾半行 {\"ev\":", "utf-8");
    appendEvents(dir, { ev: "resume" });
    appendEvents(dir, [{ ev: "dispatch", nn: 1 }, { ev: "dispatch", nn: 2 }]); // 数组形态逐事件分行
    const raw = fs.readFileSync(path.join(dir, "events.jsonl"), "utf-8");
    assert.ok(raw.endsWith("\n"), "末行换行恒在（原子替换不产撕裂）");
    for (const l of raw.split("\n").filter((x) => x.trim())) {
      assert.doesNotThrow(() => JSON.parse(l), "中断夹具后 events.jsonl 逐行可解析");
    }
    assert.ok(!fs.existsSync(path.join(dir, "events.jsonl.tmp")), "遗留 .tmp 已被覆盖清理");
    assert.equal(readEvents(dir).length, 3);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("S2⑤ 撕裂尾行容错：完整行照常解析、尾行 WARN 忽略（CLI stderr 在场，不阻塞）", () => {
  const dir = makeWorkdir(1);
  try {
    // 手工构造撕裂尾行（模拟旧机制写一半被杀）：两行完整 + 半行无换行
    fs.writeFileSync(
      path.join(dir, "events.jsonl"),
      `{"t":"2026-10-16T00:00:00.000Z","ev":"resume"}\n{"t":"2026-10-16T00:00:01.000Z","ev":"dispatch","nn":1}\n{"t":"2026-10-16T00:00:0`,
      "utf-8"
    );
    const evs = readEvents(dir);
    assert.equal(evs.length, 2, "完整行照常解析、撕裂行忽略");
    assert.equal(deriveCounters(evs).dispatchedSinceSessionEnd, 1, "计数器只吃完整行");
    const v = spawnSync(process.execPath, [SCRIPT, dir, "--json"], { encoding: "utf-8" });
    assert.equal(v.status, 0, "撕裂尾行不阻塞（exit 0）");
    assert.match(v.stderr, /WARN S2⑤: .*撕裂尾行/, "读侧 WARN 在 stderr 在场");
    assert.doesNotThrow(() => JSON.parse(v.stdout), "--json 输出照常可解析");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("S2⑤ 撕裂尾行追加隔离：不吞并新行、不改写历史字节", () => {
  const dir = makeWorkdir(1);
  try {
    const torn = `{"t":"2026-10-16T00:00:00.000Z","ev":"resume"}\n{"ev":"dispatch","t":"20`;
    fs.writeFileSync(path.join(dir, "events.jsonl"), torn, "utf-8");
    appendEvents(dir, { ev: "fix", nn: 3 });
    const raw = fs.readFileSync(path.join(dir, "events.jsonl"), "utf-8");
    assert.ok(raw.startsWith(torn + "\n"), "历史字节原样保留（撕裂行不吞并新行、不回改）");
    assert.ok(raw.endsWith("\n"), "追加后文件回到完整形态");
    const evs = readEvents(dir);
    assert.equal(evs.length, 2, "旧完整行 + 新行，撕裂行忽略");
    assert.ok(evs.some((e) => e.ev === "fix" && e.nn === 3), "新行完整解析");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("S2⑤ suspendTxn 同事务：suspend 事件（携 pending 载荷）+ pending.md 双双在场", () => {
  const dir = makeWorkdir(1);
  try {
    const text = `type: pending-user\n原因：计数器超限（chunk 1——机械打回 >2，G6/R4）\n`;
    suspendTxn(dir, text, { detail: "over-limit:1" });
    assert.ok(fs.existsSync(path.join(dir, "pending.md")), "suspend 后 pending.md 必在（验收钉死）");
    assert.equal(fs.readFileSync(path.join(dir, "pending.md"), "utf-8"), text, "pending 内容逐字一致");
    const e = readEvents(dir).find((x) => x.ev === "suspend");
    assert.ok(e, "suspend 事件落流");
    assert.equal(e.type, "pending-user");
    assert.equal(e.pending, text, "载荷携 pending.md 全文（自愈重建依据）");
    assert.equal(e.detail, "over-limit:1", "调用点 detail 保留");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("S2⑤ 同事务自愈：事件已提交而 pending 缺失（中断半态）→ scanWorkdir 重建；已消解不复活", () => {
  const dir = makeWorkdir(1);
  try {
    const text = `type: pending-user\n原因：终检连续 FAIL ≥3\n`;
    appendEvents(dir, { ev: "suspend", type: "pending-user", pending: text, detail: "final-gate 连续 FAIL ≥3" }); // 模拟提交后、物化前被杀
    assert.ok(!fs.existsSync(path.join(dir, "pending.md")), "前置：半态（事件在、pending 缺）");
    const inv = scanWorkdir(dir);
    assert.ok(fs.existsSync(path.join(dir, "pending.md")), "对账自愈——pending.md 按事件载荷重建（不留半套）");
    assert.equal(fs.readFileSync(path.join(dir, "pending.md"), "utf-8"), text, "重建逐字一致");
    assert.equal(inv.pending, "pending-user", "自愈后挂起态生效");
    // 消解（pending-clear 在后）→ 不再重建
    fs.rmSync(path.join(dir, "pending.md"), { force: true });
    appendEvents(dir, { ev: "pending-clear", detail: "终检 PASS——挂起旗标随终态消解" });
    scanWorkdir(dir);
    assert.ok(!fs.existsSync(path.join(dir, "pending.md")), "已消解的 suspend 不复活");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("S2⑤ 同事务反例（故障注入）：事件提交失败 → 事件与 pending 均不在（不留半套状态）", () => {
  const dir = makeWorkdir(1);
  try {
    fs.mkdirSync(path.join(dir, "events.jsonl")); // rename 落到目录恒败（EISDIR，root 亦然）= 提交点故障注入
    assert.throws(() => suspendTxn(dir, "type: pending-user\n原因：x\n", { detail: "over-limit:1" }), "提交点故障须抛出");
    assert.ok(!fs.existsSync(path.join(dir, "pending.md")), "提交失败 ⇒ pending 不写——要么都在要么都不在");
    assert.equal(readEvents(dir).length, 0, "事件流无 suspend（提交点未过）");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("S2⑤ 历史无载荷 suspend：只 WARN 不重建（禁补记——不凭空造 pending 内容）", () => {
  const dir = makeWorkdir(1);
  try {
    appendEvents(dir, { ev: "suspend", detail: "legacy-run" }); // 旧格式事件（无 pending 载荷）
    scanWorkdir(dir);
    assert.ok(!fs.existsSync(path.join(dir, "pending.md")), "无载荷历史 suspend 不重建 pending");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("S2⑤ §9 mtime 对账：脚本成对产物晚于末事件 → WARN 人话+--json 同源在场；对齐后不 WARN", () => {
  const dir = makeWorkdir(1);
  try {
    appendEvents(dir, { ev: "resume" });
    const lastT = readEvents(dir).at(-1).t;
    const m = path.join(dir, "merged-draft.md");
    fs.writeFileSync(m, "# merged\n", "utf-8");
    fs.utimesSync(m, new Date(), new Date(Date.parse(lastT) + 60000)); // 正例：mtime 晚于末事件 60s
    let r = run(dir, {});
    assert.equal(r.exitCode, 0, "只 WARN 不阻塞");
    assert.ok(r.statusText.includes("S2⑤ 对账 WARN"), "人话段 WARN 在场");
    assert.ok(r.state.warnings.some((w) => w.includes("对账 WARN") && w.includes("merged-draft.md")), "--json 通道（state.warnings）同源在场");
    // 反例：对齐（mtime 早于末事件）后不 WARN
    fs.utimesSync(m, new Date(), new Date(Date.parse(lastT) - 10000));
    r = run(dir, {});
    assert.ok(!r.state.warnings.some((w) => w.includes("对账 WARN")), "对齐后不 WARN");
    assert.ok(!r.statusText.includes("S2⑤ 对账 WARN"), "人话段同步干净");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------- S2⑦ 派发计数 >90 WARN（§12 重评线观测点） ----------

test("S2⑦ 派发计数 >90 WARN：91 → WARN 在场（人话+--json 同源、不阻塞）；90 → 不 WARN", () => {
  // 正例：91 次派发（事件流事实）
  const dir = makeWorkdir(1);
  try {
    appendEvents(dir, Array.from({ length: 91 }, (_, i) => ({ ev: "dispatch", nn: 1, dim: DIMS[i % 4], sec: null })));
    assert.equal(deriveCounters(readEvents(dir)).dispatchTotal, 91, "口径 = 事件流总派发（与现有派发计数同源）");
    const r = run(dir, {});
    assert.equal(r.exitCode, 0, "WARN 不阻塞（停不停重评由人按 §12 裁决）");
    const w = r.state.warnings.find((x) => x.includes(">90") && x.includes("§12"));
    assert.ok(w, "--json 通道 WARN 在场");
    assert.ok(w.includes("91"), "WARN 披露当前计数");
    assert.ok(r.statusText.includes("⚠") && r.statusText.includes(">90"), "人话段 ⚠ 行同源在场");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  // 反例：恰 90 → 不 WARN
  const dir2 = makeWorkdir(1);
  try {
    appendEvents(dir2, Array.from({ length: 90 }, (_, i) => ({ ev: "dispatch", nn: 1, dim: DIMS[i % 4], sec: null })));
    const r2 = run(dir2, {});
    assert.ok(!r2.state.warnings.some((x) => x.includes(">90")), "90 不 WARN（触发线 = >90）");
    assert.ok(!r2.statusText.includes(">90"), "人话段同步干净");
  } finally {
    fs.rmSync(dir2, { recursive: true, force: true });
  }
});
