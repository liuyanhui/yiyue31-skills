// status.mjs — xl-translator 状态机与续跑（DESIGN §2 横切 + §5.1；M1b 交付）
//
// 一条状态命令 = resume oracle：冷启动入口 / 断点续跑 / 探针队列注入 / 用户动词响应。
// 核心纪律：
// 1. 状态纯推导自文件系统（chunks/manifest/translated/reviews/verify-results/events.jsonl），
//    推导结果**整体重写**进唯一续跑文档 status.md（固定名）——它是物化视图非事实源：
//    删掉可重建、伪造被下次推导覆盖（零信任不变）。
// 2. 双段契约输出（R13）：人话一段（用户视角）+ 动作指令一段（主 agent 视角
//    step/inputs[]/outputs[]）——探针在动作指令中与真单元**同构混排不可分辨**（R25/G5）。
// 3. 统一物化（R25）：所有送审单元（真 chunk/节 + 探针）先清空 staging/ 再以
//    review-<dim>-unit-<seq>.md 同构命名物化后派发；ground truth 只存源侧，不落工作区。
// 4. 节级 sha 锚（S2①）：审校锚 = 逐节 sha 表（节 = 标题节，与 segment 分段小节同款
//    fence 感知边界），从译文文件重算、不落盘；某节内容 sha 变化 → 仅该节 × 全部 4 维
//    报告 stale（未变节不级联——新鲜度豁免降至节级）；N+1 邻 chunk handoff 失效重生成（R1）。
// 5. 计数器全部由 events.jsonl 追加流水推导：机械打回 ≤2（R4）、重审 ≤3 轮、
//    每轮修复循环升级至多一次、升级后清零、累计升级 ≥2 转挂起（G6，跨轮不重置）。
// 6. 挂起旗标 pending.md（type: pending-user | rate-limit | sealed）；R18-③ 封存后
//    "继续翻译" = 解封续跑；新起走显式动词"重新翻译"。
// 7. 会话预算（R14）：unit = 一次 subagent 调用；自上次 session-end 事件起计数，
//    达预算即干净退出点（status.md 首屏提示下次口令）。基线 ~11 单元/chunk（§4：88/8，M3 校准）。
//
// CLI: node status.mjs <workdir> [--verb progress|continue|stop|retranslate|sample|restart]
//                     [--chapter N] [--budget N] [--probe-truth <file>] [--json]
// 退出码: 0 = 正常（含挂起/预算退出点）；1 = 用法错；2 = 工作目录异常（无 original/manifest）

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { buildIndex, parseSections } from "./segment/segment.mjs";

// ---------- 常量 ----------

const DIMS = ["accuracy", "translationese", "ai-tone", "readability"];
const UNITS_PER_CHUNK = 11; // §4 基线 88/8，M3 标定后改
const VIRTUAL_NN_MIN = 901; // 探针虚拟 NN 段（真实上界 640 = 5MB/8KB，永不冲突）
const EVENTS = "events.jsonl";
const PENDING = "pending.md";
const STATUS = "status.md";

// ---------- 基础工具 ----------

const sha1 = (s) => crypto.createHash("sha1").update(s, "utf-8").digest("hex");
const sha12 = (s) => sha1(s).slice(0, 12);
const fileSha = (p) => sha12(fs.readFileSync(p, "utf-8"));
const nowIso = () => new Date().toISOString();

function safeRead(p) {
  try {
    return fs.readFileSync(p, "utf-8");
  } catch {
    return null;
  }
}

// NN 数值解析排序（禁字典序——R29/G9）
export function nnKey(name) {
  const m = String(name).match(/(\d+)/);
  return m ? Number(m[1]) : -1;
}

// ---------- 事件流水（追加式；计数器/耗时/预算的事实源） ----------

export function appendEvents(dir, events) {
  const line = (events instanceof Array ? events : [events])
    .map((e) => JSON.stringify({ t: nowIso(), ...e }))
    .join("\n");
  fs.appendFileSync(path.join(dir, EVENTS), line + "\n", "utf-8");
}

export function readEvents(dir) {
  const raw = safeRead(path.join(dir, EVENTS));
  if (!raw) return [];
  return raw.split("\n").filter((l) => l.trim()).map((l) => {
    try {
      return JSON.parse(l);
    } catch {
      return null;
    }
  }).filter(Boolean);
}

// 计数器推导（G6/R4）：按 chunk 聚合
// - mechanicalRejects: 自最近一次 verify-pass 后的 reject 数（pass 即用途重置点）
// - reviewRounds:      自最近一次全维度齐后的 re-review 轮数（按 re-review 事件）
// - escalations:       累计升级次数（跨轮不重置——G6 条款 3）
// - sinceSessionEnd:   预算计数窗口
export function deriveCounters(events) {
  const c = { mechanicalRejects: {}, reviewRounds: {}, escalations: {}, dispatchedSinceSessionEnd: 0 };
  for (const e of events) {
    const nn = e.nn ?? null;
    switch (e.ev) {
      case "dispatch":
        c.dispatchedSinceSessionEnd++;
        break;
      case "session-end":
        c.dispatchedSinceSessionEnd = 0;
        break;
      case "reject":
        if (nn != null) c.mechanicalRejects[nn] = (c.mechanicalRejects[nn] ?? 0) + 1;
        break;
      case "verify-pass":
        if (nn != null) c.mechanicalRejects[nn] = 0;
        break;
      case "re-review":
        if (nn != null) c.reviewRounds[nn] = (c.reviewRounds[nn] ?? 0) + 1;
        break;
      case "escalate":
        if (nn != null) c.escalations[nn] = (c.escalations[nn] ?? 0) + 1;
        break;
      default:
        break;
    }
  }
  return c;
}

// ---------- 节级切片 + 报告头解析（S2①：节级 sha 锚；S2②：头三行机械校验） ----------

// 节级切片（S2①）：审校锚从"整报告单 sha（半块）"改为逐节 sha 表。节边界 = segment
// 基础设施 parseSections（fence 感知标题节；首标题前内容为 preamble 节；无标题全文单节）。
// 各节切片拼接恒等于原文（不增删一字节）；sha 按落盘字节原样计算。
export function sectionSlices(text) {
  const content = String(text ?? "");
  const idx = buildIndex(content);
  return parseSections(content, idx).map((s, i) => {
    const t = content.slice(s.startChar, s.endChar);
    return { id: `s${i + 1}`, title: s.title, text: t, sha: sha12(t) };
  });
}

// 报告头契约（S2① 冻结；status/final-gate 同源解析）：
//   sha: <被审单元整体 sha1 前 12>（首审=整 chunk 译文；delta 单节=该节文本；探针=样本文本）
//   model: <模型 id>
//   time: <ISO 8601>
//   sec: <节id> <12hex> <节标题>   ← 逐节 sha 表，仅整 chunk 首审报告需要（每被审节一行）
// 头三行齐备性 = S2② 机械校验（malformed 非空 → 报告按不 fresh 处理 + WARN）。
export function parseReportHead(text) {
  const head = { sha: null, model: null, time: null, secs: {}, secOrder: [], malformed: [] };
  for (const line of String(text ?? "").split(/\r?\n/)) {
    let m;
    if (head.sha == null && (m = line.match(/^sha:\s*([0-9a-f]{12})/i))) head.sha = m[1].toLowerCase();
    else if (head.model == null && (m = line.match(/^model:\s*(\S+)/))) head.model = m[1];
    else if (head.time == null && (m = line.match(/^time:\s*(\S+)/))) head.time = m[1];
    else if ((m = line.match(/^sec:\s*(s\d+)\s+([0-9a-f]{12})\s*(.*)$/i))) {
      const id = m[1].toLowerCase();
      head.secs[id] = m[2].toLowerCase();
      head.secOrder.push(id);
    }
  }
  if (head.sha == null) head.malformed.push("缺 sha: 行");
  if (head.model == null) head.malformed.push("缺 model: 行");
  if (head.time == null) head.malformed.push("缺 time: 行");
  return head;
}

// ---------- 工作目录扫描 ----------

export function scanWorkdir(dir) {
  const inv = { dir, errors: [] };
  const original = fs.existsSync(dir) ? fs.readdirSync(dir).find((f) => /^original-.*\.md$/.test(f)) : null;
  if (!original) {
    inv.errors.push("缺 original-<title>.md（未初始化的工作目录？）");
    return inv;
  }
  inv.title = original.replace(/^original-(.*)\.md$/, "$1");
  inv.originalFile = path.join(dir, original);
  inv.originalSha = fileSha(inv.originalFile); // R28：按落盘文件字节算

  // manifest chunk 表（分段唯一事实记录）
  inv.manifest = safeRead(path.join(dir, "manifest.md"));
  inv.chunks = [];
  if (inv.manifest) {
    inv.manifestSha = sha12(inv.manifest);
    for (const line of inv.manifest.split("\n")) {
      const m = line.match(/^\| (\d{2,3})(X?) \| (\S+\.md) \| ([\d.]+) \|/);
      if (m) inv.chunks.push({ nn: Number(m[1]), atomic: m[2] === "X", name: m[3], kb: Number(m[4]) });
    }
    const src = inv.manifest.match(/sha1（前 12）：([0-9a-f]{12})/);
    inv.manifestOriginalSha = src ? src[1] : null;
  } else {
    inv.errors.push("缺 manifest.md（Step 1 未跑？）");
  }

  // 译文 / 裁定 / 审校报告
  inv.translated = {};
  const tdir = path.join(dir, "translated-chunks");
  if (fs.existsSync(tdir)) {
    for (const f of fs.readdirSync(tdir).filter((f) => /^translated-chunk-(\d+)\.md$/.test(f))) {
      const nn = Number(f.match(/(\d+)/)[1]);
      const p = path.join(tdir, f);
      inv.translated[nn] = { file: p, sha: fileSha(p), text: fs.readFileSync(p, "utf-8") };
    }
  }
  inv.adjudicated = new Set(
    fs.existsSync(path.join(dir, "adjudications"))
      ? fs.readdirSync(path.join(dir, "adjudications")).map((f) => Number(f.match(/(\d+)/)?.[1] ?? -1)).filter((n) => n > 0)
      : []
  );
  inv.reviews = {}; // reviews[nn][dim] = { whole: 头|null, secs: { sK: 头 } }（S2① 节级锚）
  const rdir = path.join(dir, "reviews");
  if (fs.existsSync(rdir)) {
    for (const f of fs.readdirSync(rdir)) {
      const m = f.match(/^review-([\w-]+)-chunk-(\d+)(?:-s(\d+))?\.md$/); // dim 可含连字符（ai-tone）
      if (!m) continue;
      const [, dim, nnS, sK] = m;
      const nn = Number(nnS);
      const head = parseReportHead(safeRead(path.join(rdir, f)) ?? "");
      const slot = ((inv.reviews[nn] ??= {})[dim] ??= { whole: null, secs: {} });
      if (sK == null) slot.whole = head; // 整 chunk 首审报告（逐节 sha 表在 head.secs）
      else slot.secs[`s${sK}`] = head; // delta 单节报告（head.sha = 该节 sha）
    }
  }

  // 机械校验流水 / 全局产物 / 旗标
  const vr = safeRead(path.join(dir, "verify-results.json"));
  inv.verify = {};
  if (vr) {
    try {
      const rs = JSON.parse(vr).results ?? [];
      for (const r of rs) inv.verify[r.nn] = r; // { nn, passed, translationSha, thresholds }（同 nn 后写覆盖 = 末条最新）
      // R22 阈值披露：verify-mech 把 thresholds 写在每条记录内（非顶层），末条兜底取
      inv.verifyThresholds = JSON.parse(vr).thresholds ?? rs[rs.length - 1]?.thresholds ?? null;
    } catch { /* 损坏按缺省处理——终检会重执行 */ }
  }
  inv.globals = {
    brief: fs.existsSync(path.join(dir, "brief.md")),
    analysis: fs.readdirSync(dir).some((f) => /^analysis-/.test(f)),
    handoff: fs.existsSync(path.join(dir, "handoff")),
    merged: fs.existsSync(path.join(dir, "merged-draft.md")),
    consistency: fs.readdirSync(dir).some((f) => /^consistency-/.test(f)),
    coldRead: fs.readdirSync(dir).some((f) => /^cold-read-/.test(f)),
    pmReview: fs.readdirSync(dir).some((f) => /^pm-review-/.test(f)),
    report: fs.existsSync(path.join(dir, "REPORT.md")),
    delivered: fs.readdirSync(dir).some((f) => new RegExp(`^translated-${inv.title}-zh\\.md$`).test(f)),
    bilingual: fs.readdirSync(dir).some((f) => new RegExp(`^translated-${inv.title}-bilingual\\.md$`).test(f)),
  };
  // 双语派生视图三态数据源（C3）：头部嵌源交付物 sha（derive-bilingual 写入，正则与之间同源耦合）
  inv.bilingualSrcSha = inv.globals.bilingual
    ? (safeRead(path.join(dir, `translated-${inv.title}-bilingual.md`))?.match(/源交付物 sha1（前 12）：([0-9a-f]{12})/)?.[1] ?? null)
    : null;
  inv.pending = null;
  if (fs.existsSync(path.join(dir, PENDING))) {
    const t = safeRead(path.join(dir, PENDING))?.match(/type:\s*(\S+)/);
    inv.pending = t ? t[1] : "pending-user";
  }
  inv.events = readEvents(dir);
  return inv;
}

// 产物指纹：全部推导输入的摘要（status.md 头部锚——改动任一产物即可检测视图陈旧）
export function fingerprint(inv) {
  const parts = [`original:${inv.originalSha}`, `manifest:${inv.manifestSha ?? "-"}`];
  for (const nn of Object.keys(inv.translated).map(Number).sort((a, b) => a - b)) parts.push(`t${nn}:${inv.translated[nn].sha}`);
  for (const nn of Object.keys(inv.reviews).map(Number).sort((a, b) => a - b)) {
    for (const dim of DIMS) {
      const slot = inv.reviews[nn]?.[dim];
      parts.push(`r${nn}${dim}w:${slot?.whole?.sha ?? "-"}`);
      for (const sid of Object.keys(slot?.secs ?? {}).sort()) parts.push(`r${nn}${dim}${sid}:${slot.secs[sid].sha ?? "-"}`);
    }
  }
  parts.push(`pending:${inv.pending ?? "-"}`, `events:${inv.events.length}`);
  return sha12(parts.join("|"));
}

// ---------- 状态推导 ----------

// 每 chunk 阶段与 stale 分类（R1 节级（S2①）+ re-keying 检测）
export function deriveState(inv) {
  const st = { title: inv.title, originalSha: inv.originalSha, chunks: [], global: null, warnings: [] };
  st.counters = deriveCounters(inv.events);

  // re-keying 检测：原文 sha ≠ manifest 记录 → 分段过期（动作 = 重分段 + 内容 sha 匹配保成果）
  st.needsResegment = inv.manifestOriginalSha != null && inv.manifestOriginalSha !== inv.originalSha;

  for (const c of inv.chunks) {
    const t = inv.translated[c.nn] ?? null;
    const v = inv.verify[c.nn] ?? null;
    const s = { nn: c.nn, name: c.name, stage: "translate", staleSections: {}, reviewDone: 0 };
    if (!t) {
      st.chunks.push(s);
      continue;
    }
    s.translationSha = t.sha;
    s.unitSha = sha12(t.text);
    const secs = sectionSlices(t.text);
    s.sections = secs.map((x) => ({ id: x.id, title: x.title, sha: x.sha }));
    // 审校完备性（S2① 节级锚）：4 维 × 逐节。节 fresh = 首审报告 sec 表该节 sha 命中，
    // 或 delta 单节报告头 sha 命中；有记录但不 fresh → stale（未变节不级联）；
    // 无任何记录 → 首审缺席（不算 stale——首审按整 chunk 补派）。
    let done = 0;
    const stale = {};
    for (const dim of DIMS) {
      const slot = inv.reviews[c.nn]?.[dim];
      const whole = slot?.whole ?? null;
      const malformed = [
        ...(whole?.malformed ?? []).map((x) => `whole:${x}`),
        ...Object.entries(slot?.secs ?? {}).flatMap(([sid, h]) => (h.malformed ?? []).map((x) => `${sid}:${x}`)),
      ];
      if (malformed.length) st.warnings.push(`chunk ${c.nn} ${dim} 报告头不完整（${malformed.join("、")}）——S2② 头三行机械校验，按不 fresh 处理`);
      for (const sec of secs) {
        const secRep = slot?.secs?.[sec.id] ?? null;
        const fresh = (whole?.secs?.[sec.id] === sec.sha) || (secRep?.sha === sec.sha);
        if (fresh) done++;
        else if (whole != null || secRep != null) (stale[sec.id] ??= []).push(dim);
      }
    }
    s.reviewDone = done;
    s.staleSections = stale;
    if (!inv.adjudicated.has(c.nn)) s.stage = "adjudicate";
    else if (!v || v.passed !== true || v.translationSha !== t.sha) s.stage = "verify";
    else if (done < DIMS.length * secs.length) s.stage = Object.keys(stale).length ? "re-review" : "review";
    else s.stage = "done";
    st.chunks.push(s);
  }

  // 全局阶段（R1：任一 chunk 未完成前不进全局；进入后整体作废重走）
  const allDone = st.chunks.length > 0 && st.chunks.every((c) => c.stage === "done");
  const g = inv.globals;
  st.global = g.delivered ? "delivered" : g.report ? "final-gate" : g.pmReview ? "pm-review" : g.coldRead ? "cold-read"
    : g.consistency ? "consistency" : g.merged ? "merged" : allDone ? "ready-merge" : "per-chunk";

  // handoff②/串行增强失效（R1 冻结语义）：译文 sha 实际变化的 chunk → 仅 N+1 邻 chunk 失效重生成
  st.handoffStale = [];
  st.chunks.forEach((c, i) => {
    if (Object.keys(c.staleSections).length > 0) {
      const next = st.chunks[i + 1];
      if (next) st.handoffStale.push(next.nn);
    }
  });

  // 计数器超限 → 自动转挂起（G6/R4：机械打回 >2；累计升级 ≥2 跨轮不重置）
  st.overLimit = st.chunks
    .filter((c) => (st.counters.mechanicalRejects[c.nn] ?? 0) > 2 || (st.counters.escalations[c.nn] ?? 0) >= 2)
    .map((c) => c.nn);
  return st;
}

// 章 ↔ chunk 映射（R5 披露）：manifest heading 树按 level-2 子树收集 [NN]
export function chapterMap(inv) {
  const map = [];
  if (!inv.manifest) return map;
  let cur = null;
  for (const line of inv.manifest.split("\n")) {
    const m = line.match(/^(\s*)- \[(\d{2,3})X?\] (##) (.+)$/); // 章级 = H2（H1 视作书名）
    if (m) {
      cur = { chapter: map.length + 1, title: m[4], chunks: [] };
      map.push(cur);
      if (!cur.chunks.includes(Number(m[2]))) cur.chunks.push(Number(m[2]));
    } else if (cur) {
      const c = line.match(/^- \[(\d{2,3})X?\] /);
      if (c && !cur.chunks.includes(Number(c[1]))) cur.chunks.push(Number(c[1]));
    }
  }
  return map;
}

// ---------- 队列构建 + 统一物化（R25） ----------

// 队列元素：{ dim, nn(真实或虚拟), sec: 节id|null(null=整 chunk 首审), kind: real|probe, text(仅 probe) }
// probe 元素来自源侧 truth 文件（{ dim, text, ... }[]）——工作区不落任何真假映射。
export function buildQueue(state, inv, opts = {}) {
  const q = [];
  if (state.needsResegment) return { q, action: { step: "resegment", inputs: ["original-" + state.title + ".md"], outputs: ["manifest.md"] } };
  if (inv.pending) return { q, action: null };
  if (state.global !== "per-chunk") {
    const stepMap = {
      "ready-merge": ["merge", ["manifest.md"], ["merged-draft.md"]],
      merged: ["consistency", ["merged-draft.md"], ["consistency-" + state.title + ".md"]],
      consistency: ["cold-read", ["merged-draft.md"], ["cold-read-" + state.title + ".md"]],
      "cold-read": ["pm-review", ["merged-draft.md"], ["pm-review-" + state.title + ".md"]],
      "pm-review": ["final-gate", ["manifest.md"], ["REPORT.md"]],
      "final-gate": ["delivered", [], []],
      delivered: ["none", [], []],
    };
    const [step, inputs, outputs] = stepMap[state.global] ?? ["none", [], []];
    return { q, action: { step, inputs, outputs } };
  }
  const c = state.chunks.find((x) => x.stage !== "done");
  if (!c) return { q, action: { step: "merge", inputs: ["manifest.md"], outputs: ["merged-draft.md"] } };
  if (c.stage === "translate" || c.stage === "adjudicate" || c.stage === "verify") {
    const step = c.stage === "translate" ? "translate" : c.stage === "adjudicate" ? "adjudicate" : "verify";
    return { q, action: { step, inputs: [`chunks/${c.name}`, "brief.md"], outputs: [step === "translate" ? `translated-chunks/translated-chunk-${String(c.nn).padStart(2, "0")}.md` : step === "adjudicate" ? `adjudications/adjudication-chunk-${String(c.nn).padStart(2, "0")}.md` : "verify-results.json"] } };
  }
  // review / re-review（S2①：节级锚判定；S2② 起 stale 维度派 delta 单节单元）：
  // 首审缺席（无 whole 报告）→ 整 chunk 单元；有 whole 报告但存在不 fresh 节 → 该维度重审。
  for (const dim of DIMS) {
    const slot = inv.reviews[c.nn]?.[dim];
    if (!slot?.whole) {
      q.push({ dim, nn: c.nn, sec: null, kind: "real" });
      continue;
    }
    const needs = c.sections.some((sec) => {
      const secRep = slot.secs?.[sec.id] ?? null;
      return slot.whole.secs?.[sec.id] !== sec.sha && secRep?.sha !== sec.sha;
    });
    if (needs) q.push({ dim, nn: c.nn, sec: null, kind: "real" });
  }
  // 探针注入（源侧 truth 存在时）：混排在真单元之后，命名同构；text 随行携带（M1c 起
  // probe.mjs 生成的真实样本文本经 staging 物化派发，缺陷只存源侧 truth）
  // C2 fresh 探针去重（2026-09-14 M3 回写）：探针报告头 sha 与当前探针文本相符即不入队——
  // 可靠性信号已取得（truth 命中）后重派零信息增益（M3 两轮共 8 单元冗余实证）
  const truth = opts.probeTruth ? JSON.parse(safeRead(opts.probeTruth) ?? "[]") : [];
  truth.forEach((p, i) => {
    const vNn = VIRTUAL_NN_MIN + i;
    const repPath = path.join(inv.dir, "reviews", `review-${p.dim}-chunk-${String(vNn).padStart(2, "0")}.md`);
    const repHead = parseReportHead(safeRead(repPath) ?? "");
    const probeSha = sha12(p.text ?? "");
    if (repHead.sha === probeSha) return; // fresh，跳过
    q.push({ dim: p.dim, nn: vNn, sec: null, kind: "probe", text: p.text });
  });
  return { q, action: null };
}

// 统一物化：清空 staging/ 后把队列全部单元写成同构暂存件；返回派发清单（不区分真假）
export function materialize(dir, q) {
  const sdir = path.join(dir, "staging");
  fs.rmSync(sdir, { recursive: true, force: true });
  fs.mkdirSync(sdir, { recursive: true });
  const dispatch = [];
  q.forEach((u, i) => {
    const seq = String(i + 1).padStart(3, "0");
    const name = `review-${u.dim}-unit-${seq}.md`;
    const body = u.kind === "real"
      ? unitText(dir, u.nn, u.sec)
      : u.text ?? "__PROBE_BODY__"; // 探针样本文本来自源侧 truth（probe.mjs 生成）；缺 text 的旧 truth 退占位
    fs.writeFileSync(path.join(sdir, name), body ?? "", "utf-8");
    dispatch.push({
      input: `staging/${name}`,
      output: `reviews/review-${u.dim}-chunk-${String(u.nn).padStart(2, "0")}${u.sec ? `-${u.sec}` : ""}.md`,
    });
  });
  return dispatch;
}

function unitText(dir, nn, sec) {
  const p = path.join(dir, "translated-chunks", `translated-chunk-${String(nn).padStart(2, "0")}.md`);
  const raw = safeRead(p);
  if (raw == null) return null;
  if (sec == null) return raw; // 整 chunk 首审
  return sectionSlices(raw).find((x) => x.id === sec)?.text ?? null; // delta 单节
}

// ---------- status.md 渲染（双段契约 R13） ----------

export function renderStatus(dir, inv, state, queue, opts = {}) {
  const total = state.chunks.length;
  const done = state.chunks.filter((c) => c.stage === "done").length;
  const cur = state.chunks.find((c) => c.stage !== "done");
  const fp = fingerprint(inv);
  const firstT = inv.events[0]?.t ?? null;
  const elapsedH = firstT ? ((Date.now() - Date.parse(firstT)) / 3600000).toFixed(1) : "0";
  const remainUnits = state.chunks.reduce((a, c) => a + (c.stage === "done" ? 0 : UNITS_PER_CHUNK - unitCredit(c)), 0);
  const budget = opts.budget ?? null;
  const overBudget = budget != null && state.counters.dispatchedSinceSessionEnd >= budget;
  const pending = inv.pending;

  const L = [];
  L.push(`# status — ${state.title}（唯一续跑文档）`);
  L.push("");
  L.push(`> 推导锚：原文 sha1 ${state.originalSha}｜产物指纹 ${fp}｜推导时间 ${nowIso()}｜本文件为物化视图，可随时删除重建`);
  if (inv.verifyThresholds) L.push(`> 阈值披露（R22）：${JSON.stringify(inv.verifyThresholds)}`);
  L.push("");

  // ---- 段 1：人话 ----
  L.push("## 人话");
  L.push("");
  if (state.needsResegment) {
    L.push(`原文已变更（sha ${inv.manifestOriginalSha} → ${state.originalSha}），需重分段后按内容 sha 保留未变 chunk 成果。下次对我说：继续翻译 ${state.title}。`);
  } else if (pending === "sealed") {
    L.push(`已封存（停止翻译）。说"继续翻译 ${state.title}"解封续跑，说"重新翻译 ${state.title}"新起全量。`);
  } else if (pending) {
    L.push(`挂起中（${pending}）。菜单：① 说"继续翻译"由系统换模型/调参重试 ② 手修后说"继续翻译"（按新 sha 重审，间距类由脚本自动补空格，永不自动重翻）③ 说"停止翻译"封存。`);
  } else if (overBudget) {
    L.push(`本会话预算 ${budget} 单元已用完（干净退出点）。进度 ${done}/${total} chunk，已耗时 ${elapsedH}h。下次对我说：继续翻译 ${state.title}。`);
  } else if (state.global === "delivered") {
    L.push(`已交付（translated-${state.title}-zh.md）。`);
    // 双语版三态（C3）：restart / 术语统一再 PASS / re-keying 三路径都会让旧双语版静默滞留——
    // "是否已生成"一字段会掩盖过期，故按头部源交付物 sha 对当前交付物判 fresh/stale
    if (!inv.globals.bilingual) {
      L.push(`双语版：未生成——说"双语对照 ${state.title}"可派生只读双语对照视图。`);
    } else if (inv.bilingualSrcSha === fileSha(path.join(dir, `translated-${state.title}-zh.md`))) {
      L.push(`双语版：已生成（translated-${state.title}-bilingual.md，基于当前交付物）。`);
    } else {
      L.push(`双语版：已过期（交付物已更新）——重说"双语对照 ${state.title}"再生成。`);
    }
  } else if (state.global !== "per-chunk") {
    L.push(`全部 ${total} chunk 过审，当前全局阶段：${state.global}，已耗时 ${elapsedH}h。下次对我说：继续翻译 ${state.title}。`);
  } else if (cur) {
    L.push(`第 ${cur.nn}/${total} chunk（${stageCn(cur.stage)}），已完成 ${done}/${total}，已耗时 ${elapsedH}h，预计剩余 ~${remainUnits} 单元（M3 前基线 ${UNITS_PER_CHUNK} 单元/chunk）。下次对我说：继续翻译 ${state.title}。`);
  }
  L.push("");

  // ---- 段 2：动作指令 ----
  L.push("## 动作指令");
  L.push("");
  const a = queue.action;
  if (a && a.step !== "none") {
    L.push("```yaml");
    L.push(`step: ${a.step}`);
    L.push(`inputs: ${JSON.stringify(a.inputs)}`);
    L.push(`outputs: ${JSON.stringify(a.outputs)}`);
    L.push("```");
  } else if (queue.q.length) {
    L.push("```yaml");
    L.push(`step: review  # 本轮送审 ${queue.q.length} 个单元（同构混排，照单派发）`);
    for (const d of queue.dispatch) {
      L.push(`- in: ${d.input}`);
      L.push(`  out: ${d.output}`);
    }
    L.push("```");
  } else {
    L.push("（无待派发动作）");
  }
  if (overBudget) L.push("");
  if (overBudget) L.push("注：会话预算已到，本轮不派发；干净退出点。");
  return L.join("\n") + "\n";
}

function unitCredit(c) {
  // 已完成折算：有译文 1 + 已裁定 1 + 审校按维折算（满 = 4 维整 chunk 首审单元；S2① 起）
  let u = 0;
  if (c.translationSha) u += 1;
  if (c.stage === "adjudicate") return u;
  u += 1;
  if (c.stage === "verify") return u;
  const secs = Math.max(1, c.sections?.length ?? 1);
  u += Math.floor(c.reviewDone / secs);
  return u;
}

function stageCn(s) {
  return { translate: "待翻译", adjudicate: "待裁定", verify: "待机械校验", review: "审校中", "re-review": "重审中（节 stale）", done: "完成" }[s] ?? s;
}

// ---------- 用户动词 ----------

export function verb(dir, v, opts = {}) {
  const inv = scanWorkdir(dir);
  if (inv.errors.length && v !== "init") return { exitCode: 2, errors: inv.errors };
  switch (v) {
    case "progress":
    case "continue": {
      if (v === "continue") {
        if (inv.pending === "sealed") { // R18-③：解封续跑
          fs.rmSync(path.join(dir, PENDING), { force: true });
          appendEvents(dir, { ev: "unseal" });
        } else if (!inv.pending) {
          appendEvents(dir, { ev: "resume" });
        }
      }
      break;
    }
    case "dispatch": // C3（2026-09-14 M3 回写）：dispatch 只影响 run() 的物化行为，verb 层无额外动作
      break;
    case "stop": {
      fs.writeFileSync(path.join(dir, PENDING), `type: sealed\n封存于 ${nowIso()}；解封 = 继续翻译，新起 = 重新翻译\n`, "utf-8");
      appendEvents(dir, { ev: "seal" });
      break;
    }
    case "retranslate": {
      const map = chapterMap(inv);
      const ch = map.find((c) => c.chapter === opts.chapter);
      if (!ch) return { exitCode: 1, errors: [`第 ${opts.chapter} 章不存在；章↔chunk 映射：` + map.map((c) => `第${c.chapter}章=${c.chunks.map((n) => String(n).padStart(2, "0")).join(",")}`).join("；")] };
      // 作废 = 删该章 chunk 的全部成果（重翻动词是用户显式要求，非自动）
      const rdir = path.join(dir, "reviews");
      for (const nn of ch.chunks) {
        fs.rmSync(path.join(dir, "translated-chunks", `translated-chunk-${String(nn).padStart(2, "0")}.md`), { force: true });
        fs.rmSync(path.join(dir, "adjudications", `adjudication-chunk-${String(nn).padStart(2, "0")}.md`), { force: true });
        const pad = String(nn).padStart(2, "0");
        const victims = DIMS.map((dim) => `review-${dim}-chunk-${pad}.md`); // 整 chunk 首审报告
        if (fs.existsSync(rdir)) {
          for (const f of fs.readdirSync(rdir)) if (new RegExp(`^review-[\\w-]+-chunk-${pad}-s\\d+\\.md$`).test(f)) victims.push(f); // delta 单节报告
        }
        for (const f of victims) fs.rmSync(path.join(rdir, f), { force: true });
      }
      appendEvents(dir, ch.chunks.map((nn) => ({ ev: "invalidate", nn, detail: `重翻第${ch.chapter}章` })));
      return { exitCode: 0, disclosure: `第 ${ch.chapter} 章（${ch.title}）= chunk ${ch.chunks.join(", ")}——成果已作废，续跑将重译（R5 披露）` };
    }
    case "sample": { // R16：先翻第 N 章出样张
      const map = chapterMap(inv);
      const ch = map.find((c) => c.chapter === opts.chapter);
      if (!ch) return { exitCode: 1, errors: [`第 ${opts.chapter} 章不存在`] };
      appendEvents(dir, { ev: "sample", nn: ch.chunks[0], detail: `样张=第${ch.chapter}章首chunk` });
      return { exitCode: 0, disclosure: `样张模式：先译 chunk ${String(ch.chunks[0]).padStart(2, "0")}（第 ${ch.chapter} 章 ${ch.title}），过审后停住等用户确认风格；确认后说"继续翻译 ${inv.title}"放全量。` };
    }
    case "restart": { // R18-③：新起全量（保留 original 与 brief）
      for (const sub of ["chunks", "translated-chunks", "adjudications", "reviews", "staging", "handoff"]) fs.rmSync(path.join(dir, sub), { recursive: true, force: true });
      for (const f of ["manifest.md", "merged-draft.md", EVENTS, PENDING, STATUS]) fs.rmSync(path.join(dir, f), { force: true });
      appendEvents(dir, { ev: "restart" });
      return { exitCode: 0, disclosure: "已清空分段与全部成果（保留 original/brief），续跑将重新分段全量翻译。" };
    }
    default:
      return { exitCode: 1, errors: [`未知动词：${v}`] };
  }
  return { exitCode: 0 };
}

// ---------- 入口：推导 + 物化 + 重写 status.md ----------

export function run(dir, opts = {}) {
  const verbResult = opts.verb ? verb(dir, opts.verb, opts) : { exitCode: 0 };
  if (verbResult.exitCode !== 0) return verbResult;
  const inv = scanWorkdir(dir);
  if (inv.errors.length) return { exitCode: 2, errors: inv.errors };
  let state = deriveState(inv);

  // 计数器超限自动转挂起（G6/R4）——挂起是文件系统事实（pending.md），不是内存态
  if (state.overLimit.length && !inv.pending) {
    fs.writeFileSync(
      path.join(dir, PENDING),
      `type: pending-user\n原因：计数器超限（chunk ${state.overLimit.join(",")}——机械打回 >2 或累计升级 ≥2，G6/R4）\n`,
      "utf-8"
    );
    appendEvents(dir, { ev: "suspend", detail: `over-limit:${state.overLimit.join(",")}` });
    inv.pending = "pending-user";
  }

  const queue = buildQueue(state, inv, opts);
  queue.dispatch = [];
  // 预算到点 = 干净退出点：不物化、不派发（R14）
  const overBudget = opts.budget != null && state.counters.dispatchedSinceSessionEnd >= opts.budget;
  // C3 view/dispatch 拆分（2026-09-14 M3 回写）：默认只读渲染（零副作用），
  // 仅 verb="dispatch" 时物化 staging + 追加事件——"运行一次 = 派发一轮承诺"不再是默认行为
  // （M3 实证：三连跑产生 36 条幻影 dispatch 事件）
  const wantDispatch = opts.verb === "dispatch";
  if (wantDispatch && queue.q.length && !inv.pending && !overBudget) {
    queue.dispatch = materialize(dir, queue.q);
    appendEvents(dir, queue.q.map((u) => ({ ev: "dispatch", nn: u.nn, dim: u.dim, sec: u.sec ?? null })));
  }
  const text = renderStatus(dir, inv, state, queue, opts);
  fs.writeFileSync(path.join(dir, STATUS), text, "utf-8");
  return { exitCode: 0, statusText: text, state, inv, queue, disclosure: verbResult.disclosure ?? null };
}

// ---------- CLI ----------

function parseArgs(argv) {
  const pos = [];
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--verb") opts.verb = argv[++i];
    else if (a === "--chapter") opts.chapter = Number(argv[++i]);
    else if (a === "--budget") opts.budget = Number(argv[++i]);
    else if (a === "--probe-truth") opts.probeTruth = argv[++i];
    else if (a === "--json") opts.json = true;
    else if (a === "-h" || a === "--help") opts.help = true;
    else pos.push(a);
  }
  return { pos, opts };
}

const __help = `status.mjs — xl-translator 状态机与续跑（M1b）

用法:
  node status.mjs <workdir> [--verb progress|continue|stop|retranslate|sample|restart]
                            [--chapter N] [--budget N] [--probe-truth <file>] [--json]

动词（用户自然语言由主 agent 映射）:
  progress（默认）/ continue / stop / retranslate（--chapter，R5 披露章↔chunk）/
  sample（--chapter，R16 样张）/ restart（R18-③ 新起全量）

产物: status.md（唯一续跑文档，整体重写）+ staging/（统一物化，每轮先清后写）+ events.jsonl（追加）

退出码: 0 正常 / 1 用法或动词错 / 2 工作目录异常`;

// CLI 守卫用 fileURLToPath：new URL().pathname 在 Windows 是 /D:/... 形态，path.resolve
// 拼出 D:\D:\... 与 argv[1] 恒不等——M1c 实测抓到的 M1b 潜伏 bug（CLI 静默空转、退出码 0）
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const { pos, opts } = parseArgs(process.argv.slice(2));
  if (opts.help || pos.length < 1) {
    console.log(__help);
    process.exit(pos.length < 1 ? 1 : 0);
  }
  const r = run(pos[0], opts);
  if (r.errors?.length) console.error(`❌ ${r.errors.join("；")}`);
  if (r.disclosure) console.log(`📌 ${r.disclosure}`);
  if (opts.json) console.log(JSON.stringify({ exitCode: r.exitCode, state: r.state, queue: r.queue?.q?.length ?? 0 }, null, 2));
  else if (r.statusText) console.log(r.statusText);
  process.exit(r.exitCode);
}
