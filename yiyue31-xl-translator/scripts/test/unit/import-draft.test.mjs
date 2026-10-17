// import-draft.test.mjs — import-draft.mjs 单元测试（node --test，文件内默认串行，低内存纪律）
//
// S2⑥ 判据 D1-D5（钉死于 scripts/test/README.md，边界清单权威 = 提案 §7）：
//   D1 版本戳：status.md 头 schema: 行；旧格式（无戳）/版本不识 → 非零拒收且零副作用
//   D2 §7 边界数据驱动执行：受类保留 / 拒类 sibling 归档 -r1 / 隔离类+缺省入 quarantine /
//      staging 清空
//   D3 events 禁补记：旧流归档不迁移，新流自零新建（首事件 = import）；幂等重入
//   D4 verify-results 强制重跑：归档 ⇒ chunk 回 verify 阶段
//   D5 探针小文档全流程：导入 → status 可派发 → dispatch（真+探针同构）→ 伪审校报告
//      落位 → truth 命中（正反）→ 状态机推进至 ready-merge
//      （覆盖深度止于 ready-merge；merge 之后归既有 merge/final-gate 用例域，P1 实跑不属 S2⑥）
//
// 运行：node --test scripts/test/unit/import-draft.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { run as segRun } from "../../segment/segment.mjs";
import { run as statusRun, readEvents, parseStatusSchema, SCHEMA_VERSION, sectionSlices } from "../../status.mjs";
import { runImport, classifyEntry, isCompletedMarker } from "../../import-draft.mjs";
import { probeCheck } from "../../final-gate.mjs";

const DIMS = ["accuracy", "translationese", "ai-tone", "readability"];
const SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "import-draft.mjs");
const PROBE_SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "probe.mjs");

// S3① RAM 守卫测试环境钉死（status.mjs availableRamMb 注入点）：真实系统读数随机器波动，
// 不进断言路径——D5 全流程含 in-process dispatch，守卫须恒放行。
// E1+Q2（S3b）：无条件赋值（??= 会被外层 shell 残留值放行）+ 剥 GUARD_CTX_PCT（外层残留
// 会让 in-process 用例整体假红）+ 自证行（钉死失败即文件级失败，不静默）。
process.env.GUARD_RAM_MB = "99999";
delete process.env.GUARD_CTX_PCT;
assert.equal(process.env.GUARD_RAM_MB, "99999", "守卫 env 钉死自证：GUARD_RAM_MB");
assert.equal(process.env.GUARD_CTX_PCT, undefined, "守卫 env 钉死自证：GUARD_CTX_PCT 已剥");

const sha12Of = (p) => crypto.createHash("sha1").update(fs.readFileSync(p, "utf-8"), "utf-8").digest("hex").slice(0, 12);
const sha12Text = (s) => crypto.createHash("sha1").update(s, "utf-8").digest("hex").slice(0, 12);
const nn2 = (n) => String(n).padStart(2, "0");

// ---------- 夹具：旧流程 draft 工作目录（未导入态，含旧格式 status.md） ----------

const TRANSLATION = "## 一\n\n第 1 块段一：术语 alpha 保留。\n\n## 二\n\n段二：数字 42 与单位 3km 保持。\n\n## 三\n\n段三：结尾。";
const LEGACY_EVENTS = `{"t":"2026-10-15T05:04:00.000Z","ev":"dispatch","nn":1}\n{"t":"2026-10-15T06:00:00.000Z","ev":"resume"}\n`;

function makeDraft() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "imp-"));
  const paras = [];
  for (let i = 0; i < 6; i++) paras.push(`## Sec ${i}\n\nPara ${i} lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor.`);
  fs.writeFileSync(path.join(dir, "original-testdoc.md"), paras.join("\n\n") + "\n", "utf-8");
  const r = segRun(path.join(dir, "original-testdoc.md"), dir, { minKB: 0.5, maxKB: 1, quiet: true });
  assert.equal(r.exitCode, 0, "夹具分段失败");
  // 受类
  fs.mkdirSync(path.join(dir, "translated-chunks"), { recursive: true });
  fs.writeFileSync(path.join(dir, "translated-chunks", "translated-chunk-01.md"), TRANSLATION, "utf-8");
  fs.mkdirSync(path.join(dir, "adjudications"), { recursive: true });
  fs.writeFileSync(path.join(dir, "adjudications", "adjudication-chunk-01.md"), "# 台账 1\n- «alpha» → 保留\n", "utf-8");
  fs.writeFileSync(path.join(dir, "brief.md"), "读者: 技术读者\n风格: 意译\n", "utf-8");
  fs.writeFileSync(path.join(dir, "style-card.md"), "# 文风基准卡\n简洁、信息密度高。\n", "utf-8");
  fs.writeFileSync(path.join(dir, "glossary-testdoc.md"), "| en | zh |\n|---|---|\n| agent | 智能体 |\n", "utf-8");
  // 拒/隔离类（旧流程形态）
  fs.mkdirSync(path.join(dir, "reviews"), { recursive: true });
  fs.writeFileSync(path.join(dir, "reviews", "review-accuracy-chunk-01-a.md"), "旧半块锚报告（-a 半块时代）\n", "utf-8");
  fs.writeFileSync(path.join(dir, "events.jsonl"), LEGACY_EVENTS, "utf-8");
  const tp = path.join(dir, "translated-chunks", "translated-chunk-01.md");
  fs.writeFileSync(path.join(dir, "verify-results.json"), JSON.stringify({ results: [{ nn: 1, passed: true, translationSha: sha12Of(tp) }] }), "utf-8");
  fs.mkdirSync(path.join(dir, "staging"), { recursive: true });
  fs.writeFileSync(path.join(dir, "staging", "review-accuracy-unit-001.md"), "在途单元残影\n", "utf-8");
  fs.writeFileSync(path.join(dir, "merged-draft.md"), "# 旧合并稿\n", "utf-8");
  fs.writeFileSync(path.join(dir, "consistency-testdoc.md"), "# 旧统稿清单\n", "utf-8");
  fs.writeFileSync(path.join(dir, "cold-read-testdoc.md"), "# 旧冷读台账\n", "utf-8");
  fs.writeFileSync(path.join(dir, "pm-review-testdoc.md"), "# 旧 PM 通读\n", "utf-8");
  fs.writeFileSync(path.join(dir, "REPORT.md"), "# 旧 REPORT\n", "utf-8");
  fs.mkdirSync(path.join(dir, "handoff"), { recursive: true });
  fs.writeFileSync(path.join(dir, "handoff", "projection-chunk-01.md"), "旧投影\n", "utf-8");
  // 缺省类（未列产物）
  fs.writeFileSync(path.join(dir, "stray-notes.txt"), "来历不明件\n", "utf-8");
  // 旧格式 status.md（无 schema 戳——"delivered" 误报形态）
  fs.writeFileSync(path.join(dir, "status.md"), "# status — testdoc\n\n> 推导锚：旧锚\n\n## 人话\n\n已交付（误报形态）。\n", "utf-8");
  return dir;
}

// ---------- D1 版本戳门 ----------

test("D1 旧格式 status.md（无 schema 戳）导入 → 非零拒收且零副作用；版本不识同拒", () => {
  const dir = makeDraft();
  try {
    const reviewsBefore = fs.readdirSync(path.join(dir, "reviews"));
    const eventsBefore = fs.readFileSync(path.join(dir, "events.jsonl"), "utf-8");
    const r = runImport(dir);
    assert.equal(r.exitCode, 1, "无戳旧格式必须非零拒收（验收钉死）");
    assert.ok(r.errors[0].includes("拒收"), "报错须含拒收语义与处置指引");
    // 零副作用：未归档、未隔离、未动事件流
    assert.deepEqual(fs.readdirSync(path.join(dir, "reviews")), reviewsBefore, "reviews/ 不动");
    assert.equal(fs.readFileSync(path.join(dir, "events.jsonl"), "utf-8"), eventsBefore, "events.jsonl 字节不变");
    assert.ok(!fs.existsSync(path.join(dir, "quarantine")), "不得建隔离区");
    assert.ok(!fs.existsSync(path.join(dir, "reviews-r1")) && !fs.existsSync(path.join(dir, "events-r1.jsonl")), "不得归档");
    // 已盖章但版本不识（未来版本）→ 同拒收
    fs.writeFileSync(path.join(dir, "status.md"), `# status — testdoc\n\n> schema: 99\n`, "utf-8");
    const r2 = runImport(dir);
    assert.equal(r2.exitCode, 1, "版本不识拒收（跨版本迁移属 S4①）");
    assert.ok(r2.errors[0].includes("S4①"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("D1 version 在场：renderStatus 头带 schema 行，parseStatusSchema 同源解析", () => {
  const dir = makeDraft();
  try {
    fs.rmSync(path.join(dir, "status.md"), { force: true }); // 移除旧格式件后可导入
    const r = runImport(dir);
    assert.equal(r.exitCode, 0, r.errors?.join(";"));
    const md = fs.readFileSync(path.join(dir, "status.md"), "utf-8");
    assert.ok(md.includes(`> schema: ${SCHEMA_VERSION}`), "status 头 schema: 行在场（细化项验收）");
    assert.equal(parseStatusSchema(md), SCHEMA_VERSION, "解析器与渲染同源");
    assert.equal(parseStatusSchema("# status — 旧\n> 推导锚：x\n"), null, "无戳旧格式解析为 null");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------- D2/D3/D4 边界执行 + events 禁补记 + verify 强制重跑 ----------

test("D2-D4 边界执行：受保留/拒归档 -r1/隔离入 quarantine/staging 清空/缺省隔离 WARN/verify 回阶段", () => {
  const dir = makeDraft();
  try {
    fs.rmSync(path.join(dir, "status.md"), { force: true }); // 旧格式件已归档移除（D1 拒收路径的反面）
    const r = runImport(dir);
    assert.equal(r.exitCode, 0, r.errors?.join(";"));
    // 受类原样保留
    for (const p of ["original-testdoc.md", "manifest.md", "chunks", "translated-chunks", "adjudications", "brief.md", "style-card.md", "glossary-testdoc.md"]) {
      assert.ok(fs.existsSync(path.join(dir, p)), `受类 ${p} 须保留`);
    }
    // 拒类 sibling 归档 -r1
    assert.ok(fs.existsSync(path.join(dir, "reviews-r1", "review-accuracy-chunk-01-a.md")), "reviews → reviews-r1/（§11）");
    assert.ok(!fs.existsSync(path.join(dir, "reviews")), "原 reviews/ 不在");
    assert.equal(fs.readFileSync(path.join(dir, "events-r1.jsonl"), "utf-8"), LEGACY_EVENTS, "旧事件流归档逐字节保留");
    assert.ok(fs.existsSync(path.join(dir, "verify-results-r1.json")), "verify-results 归档（强制重跑标记）");
    assert.ok(!fs.existsSync(path.join(dir, "verify-results.json")), "旧 verify-results 不再参与判定");
    // staging 清空
    assert.ok(!fs.existsSync(path.join(dir, "staging")), "staging 清空（无条件重物化）");
    // 隔离类 + 缺省
    const q = fs.readdirSync(path.join(dir, "quarantine"));
    for (const name of ["merged-draft.md", "pm-review-testdoc.md", "cold-read-testdoc.md", "REPORT.md", "consistency-testdoc.md", "handoff", "stray-notes.txt"]) {
      assert.ok(q.includes(name), `隔离区含 ${name}`);
    }
    assert.ok(r.warns.some((w) => w.includes("stray-notes.txt") && w.includes("WARN")), "缺省隔离附 WARN");
    // D3 禁补记：新流自零新建，首事件 = import（携对账明细）
    const evs = readEvents(dir);
    assert.equal(evs.length, 1, "新事件流恰 1 条（不迁移旧事件）");
    assert.equal(evs[0].ev, "import");
    assert.equal(evs[0].schema, SCHEMA_VERSION);
    assert.ok(JSON.parse(evs[0].detail).verifyRerun === true, "对账明细携 verifyRerun 标记");
    // D4 verify 强制重跑：verify-results 缺位 ⇒ chunk 回 verify 阶段，status 可派发（动作 = verify）
    const c = r.state.chunks[0];
    assert.equal(c.stage, "verify", "归档后 chunk 推回 verify（强制重跑）");
    const r2 = statusRun(dir, {});
    assert.equal(r2.queue.action.step, "verify", "status 派发口径 = verify 重跑");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("D3 幂等：事件流首事件 = import ⇒ 重跑跳过移动（归档不重复、事件不追加）", () => {
  const dir = makeDraft();
  try {
    fs.rmSync(path.join(dir, "status.md"), { force: true }); // 旧格式件已归档移除
    assert.equal(runImport(dir).exitCode, 0);
    const archived = fs.readdirSync(path.join(dir, "reviews-r1"));
    const r = runImport(dir);
    assert.equal(r.exitCode, 0, "幂等重入 exit 0");
    assert.equal(r.alreadyImported, true, "披露幂等跳过");
    assert.deepEqual(fs.readdirSync(path.join(dir, "reviews-r1")), archived, "归档不重复执行");
    assert.equal(readEvents(dir).length, 1, "事件流不追加");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------- CLI 冒烟（真实进程钉退出码） ----------

test("CLI：旧格式拒收 exit 1（stderr 报错）；移除后导入 exit 0（stdout 披露）", () => {
  const dir = makeDraft();
  try {
    const bad = spawnSync(process.execPath, [SCRIPT, dir], { encoding: "utf-8" });
    assert.equal(bad.status, 1, "CLI 旧格式须 exit 1");
    assert.ok(bad.stderr.includes("拒收"), "stderr 含拒收报错");
    fs.rmSync(path.join(dir, "status.md"), { force: true });
    const ok = spawnSync(process.execPath, [SCRIPT, dir, "--json"], { encoding: "utf-8" });
    assert.equal(ok.status, 0, ok.stdout + ok.stderr);
    const j = JSON.parse(ok.stdout.slice(ok.stdout.indexOf("{"))); // stdout 首行 📌 披露，JSON 在其后
    assert.equal(j.exitCode, 0);
    assert.equal(j.schema, SCHEMA_VERSION, "--json 携版本戳");
    assert.deepEqual(j.state.chunks.map((c) => c.stage), ["verify"], "--json 携 verify 重跑态");
    assert.ok(ok.stdout.includes("📌"), "披露行在场");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------- D5 探针小文档全流程（配合 S2⑦ 新 run：--run soai-r2 + --probe-truth 命中） ----------

test("D5 探针小文档全流程：导入→verify 重跑→dispatch（真+探针同构）→伪审校落位→truth 命中正反→ready-merge", () => {
  const dir = makeDraft();
  const truthDir = fs.mkdtempSync(path.join(os.tmpdir(), "truth-"));
  try {
    fs.rmSync(path.join(dir, "status.md"), { force: true });
    // ① 导入（D1-D4 已钉，此处为链路起点）
    const imp = runImport(dir);
    assert.equal(imp.exitCode, 0, imp.errors?.join(";"));
    // ② verify 强制重跑（模拟 verify-mech 重跑落新结果）
    const tp = path.join(dir, "translated-chunks", "translated-chunk-01.md");
    fs.writeFileSync(path.join(dir, "verify-results.json"), JSON.stringify({ results: [{ nn: 1, passed: true, translationSha: sha12Of(tp) }] }), "utf-8");
    let r = statusRun(dir, {});
    assert.equal(r.state.chunks[0].stage, "review", "verify 重过后进入审校（首审缺席=整 chunk 首审）");
    // ③ S2⑦ 新 run：probe --run soai-r2 生成源侧 truth（不落工作区）
    const pr = spawnSync(process.execPath, [PROBE_SCRIPT, "--run", "soai-r2", "--truth-dir", truthDir], { encoding: "utf-8" });
    assert.equal(pr.status, 0, pr.stdout + pr.stderr);
    const truthFile = path.join(truthDir, "soai-r2.json");
    const truth = JSON.parse(fs.readFileSync(truthFile, "utf-8"));
    assert.equal(truth.length, DIMS.length, "四维各 1 探针");
    assert.ok(!fs.existsSync(path.join(dir, "probe")), "truth 不落工作区");
    // ④ dispatch：真 4（整 chunk 首审）+ 探针 4 同构物化
    r = statusRun(dir, { verb: "dispatch", probeTruth: truthFile });
    assert.equal(r.exitCode, 0, r.errors?.join(";"));
    assert.equal(r.queue.q.length, 4 + 4, "真 4 + 探针 4 同构混排");
    assert.equal(fs.readdirSync(path.join(dir, "staging")).length, 8, "staging 全量物化");
    // ⑤ 伪审校报告落位：真单元 = 头三行 + 逐节 sec 表；探针 = 头三行 + 结论命中 expectedHit
    fs.mkdirSync(path.join(dir, "reviews"), { recursive: true }); // 导入后 reviews/ 由归档移走，审校落位时重建
    const secs = sectionSlices(fs.readFileSync(tp, "utf-8"));
    for (const dim of DIMS) {
      const L = [`sha: ${sha12Of(tp)}`, "model: test", `time: 2026-10-17T00:00:00Z`];
      for (const s of secs) L.push(`sec: ${s.id} ${s.sha} ${s.title}`);
      L.push(`结论：${dim} 首审通过。观察 01-${dim}。`);
      fs.writeFileSync(path.join(dir, "reviews", `review-${dim}-chunk-01.md`), L.join("\n") + "\n", "utf-8");
    }
    truth.forEach((t) => {
      fs.writeFileSync(
        path.join(dir, "reviews", `review-${t.dim}-chunk-${nn2(t.virtualNn)}.md`),
        `sha: ${sha12Text(t.text)}\nmodel: test\ntime: 2026-10-17T00:00:00Z\n结论：发现植入缺陷「${t.expectedHit}」（${t.defectType}）——建议修正。\n`,
        "utf-8"
      );
    });
    // truth 命中（正）
    assert.deepEqual(probeCheck(dir, truth), [], "伪报告命中 expectedHit → probeCheck 零 FAIL");
    // truth 命中（反）：抽走一条报告的命中串 → 注入缺陷被抓
    const probe0 = path.join(dir, "reviews", `review-${truth[0].dim}-chunk-${nn2(truth[0].virtualNn)}.md`);
    fs.writeFileSync(probe0, `sha: ${sha12Text(truth[0].text)}\nmodel: test\ntime: 2026-10-17T00:00:00Z\n结论：未发现明显问题，整体流畅。\n`, "utf-8");
    const miss = probeCheck(dir, truth);
    assert.equal(miss.length, 1, "未含 expectedHit → FAIL");
    assert.ok(miss[0].includes("未命中") && miss[0].includes(truth[0].expectedHit), "FAIL 披露期望命中串");
    fs.writeFileSync(probe0, `sha: ${sha12Text(truth[0].text)}\nmodel: test\ntime: 2026-10-17T00:00:00Z\n结论：发现植入缺陷「${truth[0].expectedHit}」——建议修正。\n`, "utf-8");
    assert.deepEqual(probeCheck(dir, truth), [], "复写命中后恢复零 FAIL");
    // ⑥ 状态机推进：报告 fresh → chunk done → ready-merge（全流程断言覆盖至 ready-merge）
    r = statusRun(dir, {});
    assert.equal(r.state.chunks[0].stage, "done", "4 维 × 3 节全 fresh → done");
    assert.equal(r.state.global, "ready-merge", "全局阶段推进至 ready-merge");
    assert.equal(r.queue.action.step, "merge", "下一动作 = merge");
    const evs = readEvents(dir);
    assert.equal(evs.filter((e) => e.ev === "dispatch").length, 8, "事件流记 8 次派发（含探针）");
    assert.equal(evs[0].ev, "import", "新流自 import 起（禁补记不变式）");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(truthDir, { recursive: true, force: true });
  }
});

// ---------- S3b：ARCH-A 重入收敛 + ENG-3 失败码传播 ----------
//
// ARCH-A（G3 架构位 major）：边界执行中断后的半态重入必须收敛——已移件（-r1 sibling /
// quarantine 居民 / writeAtomic *.tmp 残留）识别为已完成标记跳过（①）；events 已迁而
// import 未落 → 以 import 事件为提交点续完（③）；源+目标并存 = 真冲突保留 exit 1（④）。
// ② 收敛性机械枚举（QA 收紧版）：monkey-patch fs 变异计数器，k=1..N 全遍历。

test("ARCH-A①③ 在途半态重入续完：已移件识别（-r1/tmp 跳过不隔离）+ events 已迁而 import 未落 → exit 0 收敛", () => {
  // 纯函数口径：已完成标记谓词
  assert.ok(isCompletedMarker("reviews-r1") && isCompletedMarker("events-r1.jsonl") && isCompletedMarker("verify-results-r1.json"), "-r1 归档产物 = 已完成标记");
  assert.ok(isCompletedMarker("events.jsonl.tmp") && isCompletedMarker("status.md.tmp"), "writeAtomic 中断残留（*.tmp）= 已完成标记");
  assert.ok(!isCompletedMarker("reviews") && !isCompletedMarker("events.jsonl") && !isCompletedMarker("stray-notes.txt"), "源名/缺省产物不是已完成标记");
  assert.equal(classifyEntry("reviews-r1"), null, "r1 产物不命中任何边界规则（无已完成标记则落缺省隔离——缺陷入口）");
  const dir = makeDraft();
  try {
    fs.rmSync(path.join(dir, "status.md"), { force: true });
    // 手工构造中断半态：三条归档已完成、一条隔离已完成、events 已迁而新流未建（③ 在途态）、
    // 顶层 writeAtomic *.tmp 残留（appendEvents 中断形态）
    fs.renameSync(path.join(dir, "reviews"), path.join(dir, "reviews-r1"));
    fs.renameSync(path.join(dir, "verify-results.json"), path.join(dir, "verify-results-r1.json"));
    fs.renameSync(path.join(dir, "events.jsonl"), path.join(dir, "events-r1.jsonl"));
    fs.mkdirSync(path.join(dir, "quarantine"));
    fs.renameSync(path.join(dir, "REPORT.md"), path.join(dir, "quarantine", "REPORT.md"));
    fs.writeFileSync(path.join(dir, "events.jsonl.tmp"), '{"t":"2026-10-17T', "utf-8");
    const r = runImport(dir);
    assert.equal(r.exitCode, 0, (r.errors ?? []).join(";"));
    // ①：已移件不进缺省隔离（无针对 r1/tmp 的 WARN；它们绝不出现在 quarantine/ 内）
    assert.ok(!(r.warns ?? []).some((w) => /reviews-r1|events-r1|verify-results-r1|\.tmp/.test(w)), "已完成标记不触发缺省隔离 WARN");
    const q = fs.readdirSync(path.join(dir, "quarantine"));
    assert.ok(!q.includes("reviews-r1") && !q.includes("events-r1.jsonl") && !q.includes("verify-results-r1.json"), "r1 产物不入 quarantine");
    assert.ok(!q.some((f) => f.endsWith(".tmp")), "tmp 残留不入 quarantine（下次写入覆盖清理）");
    assert.ok(fs.existsSync(path.join(dir, "reviews-r1", "review-accuracy-chunk-01-a.md")), "已归档 reviews 保持在 sibling 位");
    assert.equal(fs.readFileSync(path.join(dir, "events-r1.jsonl"), "utf-8"), LEGACY_EVENTS, "已迁移旧流逐字节保留（不重做）");
    // ③：在途态以 import 事件为提交点续完——新流自零、首事件 = import
    const evs = readEvents(dir);
    assert.equal(evs.length, 1, "新流恰 1 条");
    assert.equal(evs[0].ev, "import", "import 事件 = 提交点");
    // 未移件照常执行（续完而非全跳过）
    assert.ok(!fs.existsSync(path.join(dir, "merged-draft.md")) && q.includes("merged-draft.md"), "未移隔离件照常隔离");
    assert.ok(!fs.existsSync(path.join(dir, "staging")), "staging 照常清空");
    assert.ok(fs.existsSync(path.join(dir, "verify-results-r1.json")), "未迁 verify-results 照常归档");
    assert.ok(r.warns.some((w) => w.includes("stray-notes.txt")), "缺省隔离 WARN 照常（来历不明新产物仍受捕）");
    // 二次重入 = 幂等不动点
    const r2 = runImport(dir);
    assert.equal(r2.exitCode, 0);
    assert.equal(r2.alreadyImported, true, "续完后重入走幂等分支");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("ARCH-A④ 真冲突保留：源+目标并存 → 重入 exit 1 不\"修复\"（归档/隔离区/events 三形态）", () => {
  const dir = makeDraft();
  try {
    fs.rmSync(path.join(dir, "status.md"), { force: true });
    assert.equal(runImport(dir).exitCode, 0, "前置：干净导入完成");
    // 形态 1：events 两侧并存（导入后旧流被人为恢复——真冲突，人工裁决域）
    fs.copyFileSync(path.join(dir, "events-r1.jsonl"), path.join(dir, "events.jsonl"));
    let r = runImport(dir);
    assert.equal(r.exitCode, 1, "events 两侧并存须 exit 1");
    assert.ok(r.errors.some((e) => e.includes("归档目标已存在") && e.includes("events-r1.jsonl")), "可操作文案");
    assert.equal(fs.readFileSync(path.join(dir, "events-r1.jsonl"), "utf-8"), LEGACY_EVENTS, "冲突不覆盖既有归档");
    fs.rmSync(path.join(dir, "events.jsonl"));
    // 形态 2：隔离区同名（源重新出现在顶层而隔离区已有同名件）
    fs.writeFileSync(path.join(dir, "REPORT.md"), "# 重新出现的 REPORT\n", "utf-8");
    r = runImport(dir);
    assert.equal(r.exitCode, 1, "隔离区同名须 exit 1");
    assert.ok(r.errors.some((e) => e.includes("隔离区已存在同名") && e.includes("REPORT.md")), "可操作文案");
    fs.rmSync(path.join(dir, "REPORT.md"));
    // 形态 3：reviews 源再现而 reviews-r1 已在场（sibling 归档目标冲突）
    fs.mkdirSync(path.join(dir, "reviews"));
    fs.writeFileSync(path.join(dir, "reviews", "review-accuracy-chunk-01.md"), "新出现的审校报告\n", "utf-8");
    r = runImport(dir);
    assert.equal(r.exitCode, 1, "归档目标并存须 exit 1");
    assert.ok(r.errors.some((e) => e.includes("归档目标已存在") && e.includes("reviews-r1")), "可操作文案");
    // 处置后（移走来历不明源）重入恢复收敛 exit 0——exit 1 是可操作出口而非死路
    fs.rmSync(path.join(dir, "reviews"), { recursive: true, force: true });
    const r2 = runImport(dir);
    assert.equal(r2.exitCode, 0, "人工处置后重入恢复收敛（events 已迁 → 以 import 事件续完）");
    const evs = readEvents(dir);
    assert.ok(evs.length >= 1 && evs[0].ev === "import", "新流首事件 = import");
    const r3 = runImport(dir);
    assert.equal(r3.exitCode, 0);
    assert.equal(r3.alreadyImported, true, "续完后重入走幂等分支");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// 归一化树快照：path → sha（目录记 "dir"）；归一化两处跨运行差异——① 夹具根路径（manifest
// "- 原文：<abs>/" 行内嵌 mkdtemp 随机目录）→ <ROOT>；② ISO 时间戳（status.md 推导时间 /
// events.jsonl t 字段）→ <TS>。归一后不同夹具实例的终态可逐件比对。
function treeSnapshot(rootDir) {
  const map = new Map();
  const rootRe = new RegExp(rootDir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
  const walk = (rel) => {
    const abs = path.join(rootDir, rel);
    if (fs.statSync(abs).isDirectory()) {
      map.set(rel, "dir");
      for (const c of fs.readdirSync(abs).sort()) walk(rel ? `${rel}/${c}` : c);
    } else {
      const norm = fs.readFileSync(abs, "utf-8")
        .replace(rootRe, "<ROOT>")
        .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/g, "<TS>")
        .replace(/产物指纹 [0-9a-f]{12}/g, "产物指纹 <FP>") // 指纹内嵌 manifest 原始 sha（含 mkdtemp 路径）→ 跨夹具实例必然不同
        .replace(/("ev":"import","schema":\d+,"detail":)"(?:[^"\\]|\\.)*"/g, "$1\"<IMPORT>\""); // 对账明细 = 本执行的动作计数（重入续完只计本轮剩余，与一次执行天然不同——非placement语义）
      map.set(rel, sha12Text(norm));
    }
  };
  for (const c of fs.readdirSync(rootDir).sort()) walk(c);
  return map;
}

// monkey-patch fs 变异计数器：包住 import-draft 执行路径上的 fs 变异调用（mkdir/rename/rm/
// writeFile/writeSync/fsync/write 型 open），第 k 次变异**执行前**抛错模拟中断（已执行的
// 变异全部完整落地 = fs 一致前缀态）；只读调用与 closeSync 不计。N 随实现自动演进——新增
// fs 变异点自动纳入枚举范围。
function installMutationCounter(k) {
  let count = 0;
  const saved = [];
  const wrapPlain = (name) => {
    const orig = fs[name];
    fs[name] = function (...args) {
      count++;
      if (count === k) throw new Error(`interrupt-at-mutation-${k}`);
      return orig.apply(fs, args);
    };
    saved.push([name, orig]);
  };
  for (const n of ["mkdirSync", "renameSync", "rmSync", "writeFileSync", "writeSync", "fsyncSync", "appendFileSync", "copyFileSync", "unlinkSync"]) wrapPlain(n);
  const origOpen = fs.openSync;
  fs.openSync = function (p, flags, ...rest) {
    if (/[wax+]/.test(String(flags ?? "r"))) {
      count++;
      if (count === k) throw new Error(`interrupt-at-mutation-${k}`);
    }
    return origOpen.call(fs, p, flags, ...rest);
  };
  saved.push(["openSync", origOpen]);
  return {
    count: () => count,
    uninstall: () => { for (const [n, o] of saved) fs[n] = o; },
  };
}

test("ARCH-A② 收敛性机械枚举：k=1..N 全遍历——重入 ∈ {exit 0 二次重入不动点+零漂移, exit 1 可操作文案}", () => {
  // N 发现：干净跑一次数变异总数（k=Infinity 永不触发 = 只计数）
  let N = 0;
  {
    const dir = makeDraft();
    try {
      fs.rmSync(path.join(dir, "status.md"), { force: true });
      const c = installMutationCounter(Infinity);
      try {
        assert.equal(runImport(dir).exitCode, 0, "计数跑须正常完成");
      } finally {
        c.uninstall();
      }
      N = c.count();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
  assert.ok(N >= 15, `夹具自证：变异点 N=${N} 足够多（防枚举空转）`);
  // 参照终态：无中断干净导入的归一化树快照（一切再分桶/错位都表现为与它的树差）
  const refDir = makeDraft();
  let refSnap;
  try {
    fs.rmSync(path.join(refDir, "status.md"), { force: true });
    assert.equal(runImport(refDir).exitCode, 0);
    refSnap = treeSnapshot(refDir);
  } finally {
    fs.rmSync(refDir, { recursive: true, force: true });
  }
  const refQuar = [...refSnap.keys()].filter((p) => p.startsWith("quarantine/")).sort();
  const R1_ARTIFACTS = ["reviews-r1", "events-r1.jsonl", "verify-results-r1.json"];
  const outcomes = { fixedPoint: 0, conflictExit1: 0 };
  let swallowed = 0; // best-effort 容错吞没的变异点（writeAtomic 目录 fsync catch——非可观测中断点）
  for (let k = 1; k <= N; k++) {
    const dir = makeDraft();
    try {
      fs.rmSync(path.join(dir, "status.md"), { force: true });
      // 首次部分执行：第 k 次变异前中断
      const c = installMutationCounter(k);
      let interrupted = false;
      try {
        runImport(dir);
        // 正常返回的两种情形：① 第 k 次变异的抛错被 best-effort 容错吞没（writeAtomic 目录
        // fsync 的 catch——E3 语义：平台不支持时跳过）——不构成可观测中断点，跳过该 k；
        // ② k 从未到达（计数口径漂移）——须 fail 暴露
        assert.ok(c.count() >= k, `k=${k}：正常返回而第 ${k} 次变异未发生（计数 N 漂移：实计 ${c.count()}）`);
        swallowed++;
        continue;
      } catch (e) {
        assert.match(String(e.message), new RegExp(`interrupt-at-mutation-${k}$`), `k=${k}：中断注入（前 ${k - 1} 次变异已落地）`);
        interrupted = true;
      } finally {
        c.uninstall();
      }
      assert.ok(interrupted);
      const snap1 = treeSnapshot(dir);
      const quar1 = [...snap1.keys()].filter((p) => p.startsWith("quarantine/"));
      // 重入
      const r2 = runImport(dir);
      if (r2.exitCode === 0) {
        outcomes.fixedPoint++;
        // 出口一（成员判定前半）：二次重入不动点
        const r3 = runImport(dir);
        assert.equal(r3.exitCode, 0, `k=${k}：二次重入 exit 0`);
        assert.equal(r3.alreadyImported, true, `k=${k}：二次重入走幂等分支`);
        assert.ok(String(r3.disclosure ?? "").includes("已导入过"), `k=${k}：输出含"已导入过"披露`);
        const snap2 = treeSnapshot(dir);
        const snap3 = treeSnapshot(dir);
        assert.deepEqual([...snap3.keys()].sort(), [...snap2.keys()].sort(), `k=${k}：二次重入文件集合不动点`);
        for (const [p, h] of snap2) assert.equal(snap3.get(p), h, `k=${k}：二次重入 ${p} sha 不动点`);
        const evs = readEvents(dir);
        assert.ok(evs.length >= 1 && evs[0].ev === "import", `k=${k}：events 首事件 = import`);
        // 终态 = 参照终态（归一化时间戳后逐件全等）
        assert.deepEqual([...snap2.keys()].sort(), [...refSnap.keys()].sort(), `k=${k}：重入终态文件集合 = 参照`);
        for (const [p, h] of refSnap) assert.equal(snap2.get(p), h, `k=${k}：终态 ${p} 与参照归一化逐字节相同`);
        // 零漂移（钉死静默再分桶死路）：partial 已在场件不被二次挪动 + quarantine 终集 = 参照
        const quar2 = [...snap2.keys()].filter((p) => p.startsWith("quarantine/")).sort();
        assert.deepEqual(quar2, refQuar, `k=${k}：quarantine 终集 = 参照（相对 partial 零漂移：partial=${quar1.length} → final=${quar2.length} = ref）`);
        for (const p of quar1) assert.equal(snap2.get(p), snap1.get(p), `k=${k}：partial 已隔离件 ${p} 原路径原样（不再挪动）`);
        for (const a of R1_ARTIFACTS) {
          if (snap1.has(a)) assert.equal(snap2.get(a), snap1.get(a), `k=${k}：已归档产物 ${a} 保持在 sibling 位`);
        }
        assert.ok(!quar2.some((p) => /(^|\/)(reviews-r1|events-r1\.jsonl|verify-results-r1\.json)$/.test(p) || p.endsWith(".tmp")), `k=${k}：r1/tmp 残件绝不在 quarantine 内`);
      } else {
        // 出口二：真冲突/拒收类合法中断态——exit 1 且 errors 含可操作文案
        outcomes.conflictExit1++;
        assert.equal(r2.exitCode, 1, `k=${k}：非 0 重入只允许 exit 1（实得 ${r2.exitCode}：${(r2.errors ?? []).join(";")}）`);
        assert.ok((r2.errors ?? []).length > 0 && r2.errors.some((e) => /归档目标已存在|隔离区已存在同名|拒收/.test(e)), `k=${k}：exit 1 须含可操作文案`);
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
  console.log(`  ARCH-A② 机械枚举：N=${N}（exit0 不动点 ${outcomes.fixedPoint} / exit1 真冲突 ${outcomes.conflictExit1} / 容错吞没跳过 ${swallowed}）`);
});

test("ENG-3 已导入分支失败码传播：manifest 损毁 → 重入返回 statusRun 非零码 + errors（--json 通道同断言）", () => {
  const dir = makeDraft();
  try {
    fs.rmSync(path.join(dir, "status.md"), { force: true });
    assert.equal(runImport(dir).exitCode, 0, "前置：导入完成");
    // 确定性损毁夹具：manifest.md 目录化——runImport 预检（existsSync）通过、statusRun 读侧失败
    fs.rmSync(path.join(dir, "manifest.md"));
    fs.mkdirSync(path.join(dir, "manifest.md"));
    const r = runImport(dir);
    assert.equal(r.exitCode, 2, "幂等分支传播 statusRun 失败码（原恒 exit 0 吞码）");
    assert.ok((r.errors ?? []).some((e) => e.includes("manifest")), "errors 传播（含可操作处置）");
    assert.equal(r.alreadyImported, true, "仍披露幂等上下文");
    // --json 通道（CLI 真实进程）：exitCode 与 errors 同出
    const cli = spawnSync(process.execPath, [SCRIPT, dir, "--json"], { encoding: "utf-8" });
    assert.equal(cli.status, 2, "CLI exit 2" + cli.stdout + cli.stderr);
    const j = JSON.parse(cli.stdout.slice(cli.stdout.indexOf("{")));
    assert.equal(j.exitCode, 2, "--json exitCode 传播");
    assert.ok((j.errors ?? []).some((e) => e.includes("manifest")), "--json errors 传播");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
