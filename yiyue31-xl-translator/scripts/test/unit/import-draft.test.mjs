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
import { runImport, classifyEntry } from "../../import-draft.mjs";
import { probeCheck } from "../../final-gate.mjs";

const DIMS = ["accuracy", "translationese", "ai-tone", "readability"];
const SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "import-draft.mjs");
const PROBE_SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "probe.mjs");

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
