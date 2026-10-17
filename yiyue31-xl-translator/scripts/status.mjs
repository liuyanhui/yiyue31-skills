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
//    S2③ 双计数器（分开计数、P1 并行不挤占）：冻结窗补审轮（项目级 ≤2——统稿完成后的
//    冷读/PM 通读/终检阶段，一轮 = 冻结窗内一次补审派发批；超限 dispatch 非零退出 +
//    pending.md 上报）vs 修复环轮（Step 7 每 chunk ≤3——超限停该 chunk 登 residue，项目不停）。
// 6. 挂起旗标 pending.md（type: pending-user | rate-limit | sealed）；R18-③ 封存后
//    "继续翻译" = 解封续跑；新起走显式动词"重新翻译"。
// 7. 会话预算（R14）：unit = 一次 subagent 调用；自上次 session-end 事件起计数，
//    达预算即干净退出点（status.md 首屏提示下次口令）。基线 ~11 单元/chunk（§4：88/8，M3 校准）。
//
// CLI: node status.mjs <workdir> [--verb progress|continue|stop|retranslate|sample|restart|fix|dispatch]
//                     [--chapter N] [--budget N] [--nn N] [--dims a,b] [--probe-truth <file>] [--json]
// 退出码: 0 = 正常（含挂起/预算退出点/水位退出 S3②）；1 = 用法错；2 = 工作目录异常（无 original/manifest）；
//         3 = 计数器硬门拒绝（S2③ 冻结窗补审轮 >2 / S2④ 修复环轮 >3）；
//         4 = S3 守卫拒绝（RAM <500MB / symlink 调用防呆）

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { buildIndex, parseSections } from "./segment/segment.mjs";
import { symlinkCliGuard } from "./cli-guard.mjs";

// ---------- 常量 ----------

const DIMS = ["accuracy", "translationese", "ai-tone", "readability"];
const UNITS_PER_CHUNK = 11; // §4 基线 88/8，M3 标定后改
const VIRTUAL_NN_MIN = 901; // 探针虚拟 NN 段（真实上界 640 = 5MB/8KB，永不冲突）
const EVENTS = "events.jsonl";
const PENDING = "pending.md";
const STATUS = "status.md";
const FIX_ROUND_MAX = 3; // S2③ 修复环轮上限（Step 7 每 chunk；超限停该 chunk 登 residue，项目不停）
// S2③ 内容冻结窗：统稿（consistency 三段式）完成后开启——冷读/PM 通读/终检阶段。
// 窗内 pm-review 类发现只登记不修（SKILL.md Step 8）；用户点名修复的 delta 补审在本窗内派发计数。
const FREEZE_STAGES = ["cold-read", "pm-review", "final-gate"];
const FREEZE_ROUND_MAX = 2; // 冻结窗补审轮项目级硬门（超限 → dispatch 非零退出 + pending.md 上报）
// S2⑥ state schema 版本戳：status.md 头部 `schema:` 行（物化视图自述版本）——import-draft
// 拒收无戳旧格式（旧状态不可信，"delivered" 系误报；跨版本迁移语义属 S4①）。
export const SCHEMA_VERSION = 1;
// S2⑦ §12 tripwire 观测点：事件流派生总派发 >90 → WARN（P1 审校派发 >90 即停重评——
// 迁移+重审成本逼近重头译；只 WARN 不阻塞，停不停由人按 §12 裁决）。含探针派发。
const DISPATCH_WARN_MAX = 90;
// S3① RAM 守卫线（低内存机器纪律——CLAUDE.md：内存打满会 OOM 死机）：dispatch 前可用内存
// < 500MB → 拒绝派发收尾退出（exit 4，不物化不派新单元），释放后重跑 dispatch 续派。
const GUARD_RAM_MIN_MB = 500;
// S3② 上下文水位线：剩余上下文百分比（主 agent preflight 注入 GUARD_CTX_PCT）< 20% →
// 干净退出点（exit 0，跳过物化走正常收尾）。水位为主信号，budget 降级为兜底上限
//（保险丝语义——只改措辞与文档，budget 判定逻辑不动）。
const GUARD_CTX_MIN_PCT = 20;

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

// S2⑤ 原子写（③v3健3）：tmp + fsync + rename——任一中断时刻目标文件要么旧内容要么新内容，
// 不产生撕裂行。并发前提 = 工作流恒单会话串行（CLAUDE.md），跨进程并发不加锁。
function writeAtomic(file, data) {
  const tmp = `${file}.tmp`;
  const fd = fs.openSync(tmp, "w");
  try {
    fs.writeSync(fd, data);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmp, file); // 原子替换；遗留 .tmp（中断残留）下次写入时被覆盖清理，不入流不被扫
  // ENG-2（G2 工程师位）：rename 后无目录 fsync——文件内容已 fsync 而目录项未持久，断电下
  // rename 本身可能丢失（目标文件回退为旧内容或缺失）。补 best-effort 目录 fsync：
  // E3（G3 工程师位，S3b 修）：目录 fd 的 closeSync 移入 finally——原实现 fsyncSync 抛出时
  // closeSync 被 catch 吞 → fd 泄漏一次/调用（best-effort 容错 ≠ 句柄泄漏）。
  let dfd = null;
  try {
    dfd = fs.openSync(path.dirname(file), "r");
    fs.fsyncSync(dfd);
  } catch { /* 目录 fsync best-effort：平台不支持（如 Windows 目录句柄）跳过 */ } finally {
    if (dfd != null) {
      try { fs.closeSync(dfd); } catch { /* close 也 best-effort */ }
    }
  }
}

// S2⑤ events 追加收口：唯一写点（status/final-gate/merge/derive-bilingual/verify-mech 全经此）。
// 原子语义 = 读旧全文 + 新行 → 一次性原子替换：任何中断时刻文件均为完整行集合。
// 既存撕裂尾行（历史/外部中断遗留）不吞并新行、不改写历史字节——补换行隔离另起，读侧 WARN 忽略。
export function appendEvents(dir, events) {
  const file = path.join(dir, EVENTS);
  const adds = (events instanceof Array ? events : [events])
    .map((e) => JSON.stringify({ t: nowIso(), ...e }))
    .join("\n") + "\n";
  let prev = safeRead(file) ?? "";
  if (prev && !prev.endsWith("\n")) {
    console.error(`WARN S2⑤: events.jsonl 既存尾行无换行（撕裂遗留）——追加前补换行隔离，该撕裂行由读侧 WARN 忽略`);
    prev += "\n";
  }
  writeAtomic(file, prev + adds);
}

// ENG-1（G2 工程师位：双追加窗可超 ≤2 门一格，有界于崩溃次数——合并后同批原子落流）：
// dispatch 批事件与 freeze-round 轮记原为两次 appendEvents——两追加窗之间崩溃，可使冻结窗
// ≤2 硬门超格一格（freeze-round 落而 dispatch 未落，或反之）。合并为单批事件数组（冻结窗时
// 末尾追加一条 freeze-round），run() 一次 appendEvents 原子落流——双追加窗关闭。
export function dispatchEventsBatch(q, dispatch, inFreeze) {
  const evs = q.map((u, i) => ({
    ev: "dispatch",
    nn: u.nn,
    dim: u.dim,
    sec: u.sec ?? null,
    detail: JSON.stringify(dispatch[i].c4),
  }));
  if (inFreeze) evs.push({ ev: "freeze-round", units: q.length });
  return evs;
}

// ---------- S3①② 守卫信号（RAM / 上下文水位） ----------

// A2（G3 架构位，S3b 修）：守卫 env 解析纯函数——空串/纯空白视同缺省（null）。原实现
// `Number("")` = 0：GUARD_RAM_MB="" → 假性 0MB < 500 → 假 exit 4；GUARD_CTX_PCT="" → 假性
// 0% < 20% → 假水位退出。外层 shell `GUARD_X=` 形态残留即触发，故缺省判定必须显式。
// 修复形态限定：**勿用 isInteger 收紧**（合法值如 "500"、"12.5" 不得被拒）——可解析为有限
// 数则返回该数，否则 null（缺省语义交还调用方）。
export function parseGuardEnv(raw) {
  const t = raw == null ? "" : String(raw).trim();
  if (t === "") return null; // 空串/纯空白 = 缺省（非 0）
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

// S3① 可用内存（MB）：
// ① env GUARD_RAM_MB 可解析为有限数 ≥0 → 直接返回（测试注入点，优先级最高）；
// ② spawn free -m 解析 Mem: 行 available 列（无 available 列的旧版退 buff/cache）；
// ③ free 不可用/不可解析 → Math.round(os.freemem()/1048576)；
// ④ 彻底失败 → null（fail-open——守卫信号缺失不阻塞派发）。
export function availableRamMb() {
  const env = parseGuardEnv(process.env.GUARD_RAM_MB); // A2：空串/纯空白视同缺省
  if (env != null && env >= 0) return env;
  try {
    // E2（G3 工程师位，S3b 修）：LC_ALL=C 钉死输出列形——非 C locale 下 free 的表头/小数
    // 形态本地化（如逗号小数、译表头）会误判 available 列
    const out = spawnSync("free", ["-m"], { encoding: "utf-8", timeout: 5000, env: { ...process.env, LC_ALL: "C" } });
    if (out.status === 0 && out.stdout) {
      const rows = out.stdout.split("\n");
      const memRow = rows.find((l) => /^Mem:/.test(l));
      const header = rows.find((l) => /\btotal\b/.test(l)) ?? "";
      if (memRow) {
        const cols = memRow.trim().split(/\s+/).slice(1).map(Number);
        const val = /available/.test(header) ? cols[5] : cols[4]; // 无 available 列退 buff/cache
        if (Number.isFinite(val) && val >= 0) return val;
      }
    }
  } catch { /* free 不可用 → 退 os.freemem */ }
  try {
    return Math.round(os.freemem() / 1048576);
  } catch {
    return null; // ④ 彻底失败 → fail-open
  }
}

// S3② 剩余上下文水位（%）：主 agent preflight 注入 env GUARD_CTX_PCT（按已处理单元 × 实测
// 成本估算；代理计数 = events dispatchedSinceSessionEnd）；可解析为 0-100 有限数 → 值，
// 否则 null（缺省 → WARN 放行，不阻塞）。
export function ctxPctFromEnv() {
  const v = parseGuardEnv(process.env.GUARD_CTX_PCT); // A2：空串/纯空白视同缺省（原 Number("")=0 假水位）
  return v != null && v >= 0 && v <= 100 ? v : null;
}

// S2⑤ 撕裂尾行容错（①7）：不可解析行 WARN + 忽略，其余完整行照常解析——
// 尾行 = 中断撕裂遗留；中段异常行 = 疑似外部改写（更强披露，同样跳过不阻塞）。
export function readEvents(dir) {
  const raw = safeRead(path.join(dir, EVENTS));
  if (!raw) return [];
  const lines = raw.split("\n");
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!l.trim()) continue;
    try {
      out.push(JSON.parse(l));
    } catch {
      const isTail = i === lines.length - 1;
      console.error(`WARN S2⑤: events.jsonl 第 ${i + 1} 行不可解析（${isTail ? "撕裂尾行——中断遗留" : "中段异常行——疑似外部改写"}）——忽略该行，其余完整行照常解析`);
    }
  }
  return out;
}

// S2⑤ suspend/pending 同事务（①6）：提交序 = suspend 事件先行（原子追加 = 提交点，载荷
// 携 pending.md 全文，可重建）→ pending.md 原子物化。任一中断时刻：提交前 → 两者皆不在；
// 提交后物化前 → 事件在而 pending 缺，由 scanWorkdir 对账自愈（reconcileSuspend）——
// 收敛不变式：suspend 事件已提交且未消解 ⇒ pending.md 必在。
export function suspendTxn(dir, pendingText, eventFields = {}) {
  const type = pendingText.match(/^type:\s*(\S+)/m)?.[1] ?? "pending-user";
  appendEvents(dir, { ev: "suspend", type, pending: pendingText, ...eventFields });
  writeAtomic(path.join(dir, PENDING), pendingText);
}

// S2⑤ 同事务对账自愈（scanWorkdir 调用）：未消解 suspend（其后无 pending-clear/unseal/
// restart/resume——A4〔S3b〕补 resume：verb continue 对无 pending 挂起史本就落 resume 事件，
// 消解集缺它 = "继续翻译"后仍按未消解挂起处理）而 pending.md 缺失 → 有载荷则重建（WARN
// 披露）；无载荷历史事件只 WARN 不重建（禁补记——不凭空造 pending 内容）。
// 返回 null=无需处理，否则 { warn, pendingType }。
const SUSPEND_RESOLVERS = new Set(["pending-clear", "unseal", "restart", "resume"]); // A4：两处消解集同源常量
function reconcileSuspend(dir, events, pendingExists) {
  if (pendingExists) return null;
  let last = null;
  let cleared = true;
  for (const e of events) {
    if (e.ev === "suspend") { last = e; cleared = false; }
    else if (SUSPEND_RESOLVERS.has(e.ev)) cleared = true;
  }
  if (!last || cleared) return null;
  if (typeof last.pending !== "string") {
    return { warn: `WARN S2⑤: 事件流存在未消解 suspend（${last.t}）而 pending.md 缺失，且事件无重建载荷（历史事件，禁补记）——请人工核对`, pendingType: null };
  }
  writeAtomic(path.join(dir, PENDING), last.pending);
  const pendingType = last.pending.match(/^type:\s*(\S+)/m)?.[1] ?? "pending-user";
  return { warn: `WARN S2⑤: suspend 事件已提交（${last.t}）而 pending.md 缺失——同事务自愈：已按事件载荷重建 pending.md（type: ${pendingType}）`, pendingType };
}

// 计数器推导（G6/R4）：按 chunk 聚合
// - mechanicalRejects: 自最近一次 verify-pass 后的 reject 数（pass 即用途重置点）
// - reviewRounds:      修复环轮（S2④：fix 事件派生——每 chunk ≤3，超限停该 chunk 登 residue）
// - freezeRounds:      冻结窗补审轮（S2③：freeze-round 事件派生——项目级 ≤2 硬门；一轮 =
//                      冻结窗内一次补审派发批；与 reviewRounds 分开计数，P1 并行不挤占）
// - escalations:       累计升级次数（跨轮不重置——G6 条款 3）
// - sinceSessionEnd:   预算计数窗口
// - dispatchTotal:     事件流总派发（S2⑦ §12 观测点——与 dispatchedSinceSessionEnd 同源派生）
export function deriveCounters(events) {
  const c = { mechanicalRejects: {}, reviewRounds: {}, escalations: {}, freezeRounds: 0, dispatchedSinceSessionEnd: 0, dispatchTotal: 0 };
  for (const e of events) {
    const nn = e.nn ?? null;
    switch (e.ev) {
      case "dispatch":
        c.dispatchedSinceSessionEnd++;
        c.dispatchTotal++;
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
      case "fix":
        if (nn != null) c.reviewRounds[nn] = (c.reviewRounds[nn] ?? 0) + 1;
        break;
      case "freeze-round":
        c.freezeRounds++;
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

// ARCH-B 节新鲜度谓词单点收敛（S3④）：节 fresh = 整 chunk 首审报告 sec 表该节 sha 命中，
// 或 delta 单节报告头 sha 命中。deriveState 审校完备性 / buildQueue 冻结窗队列 / buildQueue
// review 队列 / final-gate 完备性矩阵四消费点同源调用——禁再拷贝该表达式（两侧对立裁判即此病）。
export function secFresh(slot, sec) {
  const secRep = slot?.secs?.[sec.id] ?? null;
  return (slot?.whole?.secs?.[sec.id] === sec.sha) || (secRep?.sha === sec.sha);
}

// C4 派发口径（S2② 机械归属拆分）：行数/起止标题/节名枚举/sha 全部从物化单元内容派生——
// status.mjs 自动生成进派发清单与 events detail（防造假红线：报告锚由脚本从内容派生，
// 禁止人工拼接）；第四项 grep 节序核对留 agent 派发前自觉 + final-gate 随机抽核兜底。
export function c4Facts(body, file = null) {
  const secs = sectionSlices(body);
  return {
    file,
    lines: String(body ?? "").split("\n").length,
    range: secs.length ? [secs[0].title, secs[secs.length - 1].title] : [null, null],
    secs: secs.map((s) => ({ id: s.id, sha: s.sha, title: s.title })),
    sha: sha12(body),
  };
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

// S2⑥ status.md 头版本戳解析：`> schema: <n>` 行 → n；无戳/不可解析 → null（旧格式）。
// import-draft 以此拒收旧格式（非零退出）；renderStatus 渲染恒带当前版本。
export function parseStatusSchema(text) {
  const m = String(text ?? "").match(/^>\s*schema:\s*(\d+)\b/m);
  return m ? Number(m[1]) : null;
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
  // S2⑤：同事务对账——suspend 事件已提交而 pending.md 缺失（提交后物化前被中断）→ 自愈重建
  const healed = reconcileSuspend(dir, inv.events, inv.pending != null);
  if (healed) {
    console.error(healed.warn);
    if (healed.pendingType) inv.pending = healed.pendingType;
  }
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
  // S2⑦ §12 tripwire 观测点：总派发 >90 → WARN（人话段 ⚠ 行 + --json state.warnings 同源；
  // 只 WARN 不阻塞——停不停重评由人按 §12 裁决，脚本不代决）
  if (st.counters.dispatchTotal > DISPATCH_WARN_MAX) {
    st.warnings.push(`审校派发 ${st.counters.dispatchTotal} >90（§12 重评线：迁移+重审成本逼近重头译，即停重评）——观测点 WARN，不阻塞`);
  }
  // S2④ residue 停修集（事件流事实源：residue 事件 / 修复环轮超限）——停该 chunk，项目不停
  const residueSet = new Set(inv.events.filter((e) => e.ev === "residue").map((e) => e.nn));

  // S3④ 挂起史未消解：事件流存在未消解 suspend（其后无 SUSPEND_RESOLVERS 消解事件——与
  // reconcileSuspend 的 cleared 扫描同源常量，A4 补 resume）而 pending.md 缺失 → 人话段按
  // 挂起态给 PENDING-USER 菜单（无载荷历史事件不可重建 pending，禁补记——菜单兜底出口，
  // 防状态机无出口卡死）。
  let suspUncleared = false;
  for (const e of inv.events) {
    if (e.ev === "suspend") suspUncleared = true;
    else if (SUSPEND_RESOLVERS.has(e.ev)) suspUncleared = false;
  }
  st.suspendUnresolved = suspUncleared && inv.pending == null;

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
        const fresh = secFresh(slot, sec); // ARCH-B 单点谓词（S3④）
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
    if (residueSet.has(c.nn) || (st.counters.reviewRounds[c.nn] ?? 0) > FIX_ROUND_MAX) {
      s.stage = "residue"; // S2④：修复环超限停修（事件流事实源派生，非内存态）
      st.warnings.push(`chunk ${c.nn} 修复环超限停修（residue 登记）——项目继续（S2③ 双计数器）`);
    }
    st.chunks.push(s);
  }

  // 全局阶段（R1：任一 chunk 未完成前不进全局；进入后整体作废重走；S2④ residue 停修 chunk 不阻塞推进）
  const allDone = st.chunks.length > 0 && st.chunks.every((c) => c.stage === "done" || c.stage === "residue");
  st.residue = st.chunks.filter((c) => c.stage === "residue").map((c) => c.nn);
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
    // S2③ 冻结窗补审队列：统稿完成后（冷读/PM 通读/终检）存在节 stale（用户点名修复的复欠）
    // → 变化节 × 4 维 delta 补审单元优先于全局阶段动作；residue 停修 chunk 不回队。
    if (FREEZE_STAGES.includes(state.global)) {
      const fq = [];
      for (const c of state.chunks) {
        if (c.stage === "residue") continue;
        for (const dim of DIMS) {
          const slot = inv.reviews[c.nn]?.[dim];
          if (!slot?.whole) continue; // 首审缺席非冻结窗场景（进窗前已全 done）
          for (const sec of c.sections ?? []) {
            if (secFresh(slot, sec)) continue; // ARCH-B 单点谓词（S3④）
            fq.push({ dim, nn: c.nn, sec: sec.id, kind: "real" });
          }
        }
      }
      if (fq.length) return { q: fq, action: null };
    }
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
  const c = state.chunks.find((x) => x.stage !== "done" && x.stage !== "residue"); // S2④：residue 停修 chunk 跳过，项目不停
  if (!c) return { q, action: { step: "merge", inputs: ["manifest.md"], outputs: ["merged-draft.md"] } };
  if (c.stage === "translate" || c.stage === "adjudicate" || c.stage === "verify") {
    const step = c.stage === "translate" ? "translate" : c.stage === "adjudicate" ? "adjudicate" : "verify";
    return { q, action: { step, inputs: [`chunks/${c.name}`, "brief.md"], outputs: [step === "translate" ? `translated-chunks/translated-chunk-${String(c.nn).padStart(2, "0")}.md` : step === "adjudicate" ? `adjudications/adjudication-chunk-${String(c.nn).padStart(2, "0")}.md` : "verify-results.json"] } };
  }
  // review / re-review（S2① 节级锚 + S2② delta 队列 = 变化节 × 4 维差集）：
  // 首审缺席（该维无 whole 报告）→ 整 chunk 单元（首审全量四维、整 chunk 粒度——§8 选型）；
  // 首审在但存在不 fresh 节 → 仅该维的变化节 delta 单节单元（未变节豁免）。
  for (const dim of DIMS) {
    const slot = inv.reviews[c.nn]?.[dim];
    if (!slot?.whole) {
      q.push({ dim, nn: c.nn, sec: null, kind: "real" });
      continue;
    }
    for (const sec of c.sections) {
      if (secFresh(slot, sec)) continue; // ARCH-B 单点谓词（S3④）
      q.push({ dim, nn: c.nn, sec: sec.id, kind: "real" });
    }
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

// 统一物化：清空 staging/ 后把队列全部单元写成同构暂存件；返回派发清单（不区分真假）。
// 每单元附 c4 口径（S2②：行数/起止/节枚举由脚本从物化内容派生，随清单渲染、随事件落 detail）。
export function materialize(dir, q) {
  const sdir = path.join(dir, "staging");
  fs.rmSync(sdir, { recursive: true, force: true });
  fs.mkdirSync(sdir, { recursive: true });
  const dispatch = [];
  q.forEach((u, i) => {
    const seq = String(i + 1).padStart(3, "0");
    const name = `review-${u.dim}-unit-${seq}.md`;
    const rel = `staging/${name}`;
    const body = u.kind === "real"
      ? unitText(dir, u.nn, u.sec)
      : u.text ?? "__PROBE_BODY__"; // 探针样本文本来自源侧 truth（probe.mjs 生成）；缺 text 的旧 truth 退占位
    fs.writeFileSync(path.join(sdir, name), body ?? "", "utf-8");
    dispatch.push({
      input: rel,
      output: `reviews/review-${u.dim}-chunk-${String(u.nn).padStart(2, "0")}${u.sec ? `-${u.sec}` : ""}.md`,
      c4: c4Facts(body ?? "", rel),
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

// ---------- S2④ fixer 闭环：fix 动词物化 fixer 包（主上下文不进报告全文） ----------

const nn2 = (n) => String(n).padStart(2, "0");

// 包构成（≤40KB，sizes 夹具钉死）：头部定位块（unit-sha / fix-round / 逐节 sec: sha 表——与
// 派发 c4 口径同构）+ 译文全文 + 所选维度 FAIL 报告全文（whole + delta 单节，逐字照抄）。
// **不含 chunk 原文**：报告逐条自带"原文引用"；fixer 需整节原文对照时只读工作目录 chunks/<name>
//（包外自取，不占包预算——主上下文纪律由"派 fixer 只给包路径"保证）。
export function renderFixerPkg(inv, chunkState, dims, round, freeze) {
  const t = inv.translated[chunkState.nn];
  const L = [
    "# fixer 包（status.mjs --verb fix 物化，S2④）——主上下文不进报告全文，fixer 只读本包 + 工作目录",
    `unit-sha: ${t.sha}`,
    `fix-round: ${round}/${FIX_ROUND_MAX}${freeze ? "（冻结窗内用户点名修复）" : ""}`,
  ];
  for (const s of chunkState.sections) L.push(`sec: ${s.id} ${s.sha} ${s.title}`);
  L.push("", "## 译文（修复对象，全文）", "", String(t.text).replace(/\n$/, ""));
  const rdir = path.join(inv.dir, "reviews");
  for (const dim of dims) {
    const whole = safeRead(path.join(rdir, `review-${dim}-chunk-${nn2(chunkState.nn)}.md`));
    L.push("", `## 报告全文：${dim}（reviews/review-${dim}-chunk-${nn2(chunkState.nn)}.md 照抄）`, "", (whole ?? "（缺报告——该维首审未回）").replace(/\n$/, ""));
    const deltas = fs.existsSync(rdir)
      ? fs.readdirSync(rdir).filter((f) => new RegExp(`^review-${dim}-chunk-${nn2(chunkState.nn)}-s\\d+\\.md$`).test(f)).sort(nnKey)
      : [];
    for (const d of deltas) {
      L.push("", `## 报告全文：${dim} delta（reviews/${d} 照抄）`, "", String(safeRead(path.join(rdir, d))).replace(/\n$/, ""));
    }
  }
  return L.join("\n") + "\n";
}

// fix 动词：物化 fixer 包 + 落 fix 事件（修复环轮计数器事实源）。
// 硬门：每 chunk 修复环 ≤FIX_ROUND_MAX 轮——超限停该 chunk（登记 residue-chunk-NN.md +
// residue 事件），项目不停（S2③ 双计数器之二；挂起态不派发）。
export function fixDispatch(dir, inv, state, opts = {}) {
  if (opts.nn == null) return { exitCode: 1, errors: ["--verb fix 需要 --nn <N>（修复对象 chunk）"] };
  const c = state.chunks.find((x) => x.nn === opts.nn);
  if (!c) return { exitCode: 1, errors: [`chunk ${opts.nn} 不在 manifest 登记`] };
  if (c.stage === "residue") return { exitCode: 1, errors: [`chunk ${opts.nn} 已停修（residue 登记）——不再派发修复`] };
  if (!c.translationSha) return { exitCode: 1, errors: [`chunk ${opts.nn} 尚无译文，无可修复对象`] };
  const dims = opts.dims ? String(opts.dims).split(",").map((s) => s.trim()).filter(Boolean) : [...DIMS];
  for (const d of dims) if (!DIMS.includes(d)) return { exitCode: 1, errors: [`未知维度 ${d}（合法：${DIMS.join(",")}）`] };
  const rdir = path.join(dir, "reviews");
  const hasReport = dims.some((d) => safeRead(path.join(rdir, `review-${d}-chunk-${nn2(c.nn)}.md`)) != null);
  if (!hasReport) return { exitCode: 1, errors: [`chunk ${c.nn} 无任何审校报告（reviews/review-*-chunk-${nn2(c.nn)}.md）——fix 无依据`] };
  const rounds = state.counters.reviewRounds[c.nn] ?? 0;
  if (rounds >= FIX_ROUND_MAX) {
    const rs = path.join(dir, `residue-chunk-${nn2(c.nn)}.md`);
    if (!fs.existsSync(rs)) {
      const open = Object.entries(c.staleSections).map(([sid, ds]) => `${sid}（${[...ds].join("/")}）`).join("、") || "（无 stale 节——修复未收敛）";
      fs.writeFileSync(rs, [
        `# residue — chunk ${nn2(c.nn)}（机器登记：修复环轮超限停修，S2③/S2④）`,
        `unit-sha: ${c.translationSha}`,
        `rounds: ${rounds}/${FIX_ROUND_MAX}`,
        `open: ${open}`,
        `登记: ${nowIso()}`,
        "处置: 欠账修复走 PENDING-USER/终稿 residue 内嵌（P1 对齐）；项目其余 chunk 不受影响。",
        "",
      ].join("\n"), "utf-8");
    }
    appendEvents(dir, { ev: "residue", nn: c.nn, detail: `fix-loop ${rounds}/${FIX_ROUND_MAX} 超限——停修登记` });
    return { exitCode: 3, errors: [`chunk ${c.nn} 修复环轮 ${rounds}/${FIX_ROUND_MAX} 超限——停修并登记 residue-chunk-${nn2(c.nn)}.md（项目继续）`] };
  }
  const freeze = FREEZE_STAGES.includes(state.global);
  const pkg = renderFixerPkg(inv, c, dims, rounds + 1, freeze);
  const sdir = path.join(dir, "staging");
  fs.mkdirSync(sdir, { recursive: true });
  const pkgPath = path.join(sdir, `fixer-chunk-${nn2(c.nn)}.md`);
  fs.writeFileSync(pkgPath, pkg, "utf-8");
  appendEvents(dir, { ev: "fix", nn: c.nn, dims: dims.join(","), freeze, detail: `round ${rounds + 1}/${FIX_ROUND_MAX}；pkg ${Buffer.byteLength(pkg, "utf-8")}B` });
  return { exitCode: 0, pkg: path.relative(dir, pkgPath), dims, round: rounds + 1, freeze, pkgBytes: Buffer.byteLength(pkg, "utf-8") };
}

// ---------- S2⑤ §9 mtime 对账兜底 ----------
// 脚本同进程成对（产物写入 → 事件落流）的文件 mtime 晚于 events 末事件时间戳 ⇒ 落流被吞
// （如 verify-mech 旁路 best-effort）或外部改写未落流 ⇒ WARN（①7 断档检测）。
// 口径：只检测不回填（禁补记）、只 WARN 不阻塞。agent 步调产物（reviews/adjudications/
// translated-chunks/chunks/manifest——事件配对跨步延迟，中间态晚于末事件属正常）与按设计
// 晚于事件的视图/旗标件（status.md/pending.md/REPORT.md）不入审计集，防常态误报。
// 末事件时间戳取实读文件尾（本次 run 已追加的事件也计入，防自误报）；1s 容差吸收时间戳粒度。
function mtimeAudit(dir, inv) {
  const raw = safeRead(path.join(dir, EVENTS));
  if (!raw) return null;
  let lastT = null;
  const lines = raw.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    if (!lines[i].trim()) continue;
    try { lastT = JSON.parse(lines[i]).t ?? null; } catch { continue; } // 撕裂尾行跳过（readEvents 已 WARN）
    break;
  }
  if (!lastT) return null;
  const deadline = Date.parse(lastT) + 1000;
  const cands = [path.join(dir, "merged-draft.md"), path.join(dir, "verify-results.json")];
  if (inv.globals.delivered) cands.push(path.join(dir, `translated-${inv.title}-zh.md`));
  if (inv.globals.bilingual) cands.push(path.join(dir, `translated-${inv.title}-bilingual.md`));
  const sdir = path.join(dir, "staging");
  if (fs.existsSync(sdir)) for (const f of fs.readdirSync(sdir)) cands.push(path.join(sdir, f));
  let latest = null;
  for (const p of cands) {
    let m;
    try { m = fs.statSync(p).mtimeMs; } catch { continue; }
    if (m > deadline && (latest == null || m > latest.m)) latest = { p, m };
  }
  if (!latest) return null;
  return `S2⑤ 对账 WARN（§9 断档兜底）：${path.relative(dir, latest.p)} mtime（${new Date(latest.m).toISOString()}）晚于 events 末事件（${lastT}）——疑有活动未落流；只检测不回填（禁补记）`;
}

// ---------- status.md 渲染（双段契约 R13） ----------

// S3④ 人话统计量收口：done/cur/remainUnits/elapsedH/overBudget 等的单一计算点
//（供 plainLines 与后续守卫复用——人话、--json、守卫三处不许各算各的）。
export function viewStats(inv, state, opts = {}) {
  const total = state.chunks.length;
  const done = state.chunks.filter((c) => c.stage === "done" || c.stage === "residue").length;
  const cur = state.chunks.find((c) => c.stage !== "done" && c.stage !== "residue"); // S2④：residue 不再是当前动作位
  const firstT = inv.events[0]?.t ?? null;
  const elapsedH = firstT ? ((Date.now() - Date.parse(firstT)) / 3600000).toFixed(1) : "0";
  const remainUnits = state.chunks.reduce((a, c) => a + (c.stage === "done" || c.stage === "residue" ? 0 : UNITS_PER_CHUNK - unitCredit(c)), 0);
  const budget = opts.budget ?? null;
  const overBudget = budget != null && state.counters.dispatchedSinceSessionEnd >= budget;
  const pending = inv.pending;
  return { total, done, cur, firstT, elapsedH, remainUnits, budget, overBudget, pending };
}

// S3④ 人话行单一来源：renderStatus 段 1 的行构造整体提取（renderStatus 消费同函数）——
// 重构不改字节；冷启动卡（renderColdStart）的下次口令与这里的"继续翻译 <title>"同源。
export function plainLines(dir, inv, state, queue, opts = {}) {
  const { total, done, cur, elapsedH, remainUnits, budget, overBudget, pending } = viewStats(inv, state, opts);
  const L = [];
  if (state.needsResegment) {
    L.push(`原文已变更（sha ${inv.manifestOriginalSha} → ${state.originalSha}），需重分段后按内容 sha 保留未变 chunk 成果。下次对我说：继续翻译 ${state.title}。`);
  } else if (pending === "sealed") {
    L.push(`已封存（停止翻译）。说"继续翻译 ${state.title}"解封续跑，说"重新翻译 ${state.title}"新起全量。`);
  } else if (pending) {
    L.push(`挂起中（${pending}）。菜单：① 说"继续翻译"由系统换模型/调参重试 ② 手修后说"继续翻译"（按新 sha 重审，间距类由脚本自动补空格，永不自动重翻）③ 说"停止翻译"封存。`);
  } else if (state.suspendUnresolved) {
    // S3④：挂起史未消解而 pending.md 缺失（无载荷历史事件不可重建，禁补记）——按挂起态给菜单兜底
    L.push(`挂起史未消解而 pending.md 缺失（历史事件无载荷不可重建）——按挂起态处理。`);
    L.push(`菜单：① 说"继续翻译"由系统换模型/调参重试 ② 手修后说"继续翻译"（按新 sha 重审，间距类由脚本自动补空格，永不自动重翻）③ 说"停止翻译"封存。`);
  } else if (opts.guard?.type === "ram") {
    // S3①：RAM 守卫拒绝派发——不派新单元收尾退出（释放内存后重跑 dispatch 续派）
    L.push(`RAM 可用 ${opts.guard.value}MB < ${GUARD_RAM_MIN_MB}MB——守卫拒绝派发（S3①），不派新单元收尾退出；释放内存后说"继续翻译 ${state.title}"重跑派发。`);
  } else if (opts.guard?.type === "ctx") {
    // S3②：水位退出——干净退出点（交接卡已再生，含下次动作）
    L.push(`剩余上下文水位 ${opts.guard.value}% < ${GUARD_CTX_MIN_PCT}%——水位退出（S3②，干净退出点）：本轮不派发，交接卡已再生（handoff/cold-start.md）。下次对我说：继续翻译 ${state.title}。`);
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
    if (FREEZE_STAGES.includes(state.global)) L.push(`内容冻结窗已开启（统稿完成后）：pm-review 类发现只登记不修（用户点名才修）；补审轮 ${state.counters.freezeRounds}/${FREEZE_ROUND_MAX}（项目级硬门）。`);
  } else if (cur) {
    L.push(`第 ${cur.nn}/${total} chunk（${stageCn(cur.stage)}），已完成 ${done}/${total}，已耗时 ${elapsedH}h，预计剩余 ~${remainUnits} 单元（M3 前基线 ${UNITS_PER_CHUNK} 单元/chunk）。下次对我说：继续翻译 ${state.title}。`);
  }
  if (state.residue?.length) L.push(`停修登记：chunk ${state.residue.join(",")} 修复环超限（residue-chunk-NN.md）——其余 chunk 照常推进，处置见 residue 文件与 PENDING 流程。`);
  // S2⑤：健康/对账 WARN 进人话段（--json 走 state.warnings 同源）——含 §9 mtime>末事件断档兜底
  for (const w of state.warnings) L.push(`⚠ ${w}`);
  return L;
}

// S3④ 人话自一致性断言：从 state 对象（--json 输出的同一对象）重推关键事实并断言在 lines
// 拼接文本中在场/一致。空 = 一致；非空 = 失配清单。run() 渲染前调用：console.error 逐条 +
// push 进 state.warnings（"人话自检失配：…"——人话与 --json 双通道同源可见），不改退出码。
// 口径：进度分数/当前 chunk 行/冻结窗轮次按"在场即须一致"（分支抢占属正常缺席）；residue 行
// 与 ⚠ 行数为无条件双向断言（任何分支都渲染）。
export function plainSelfCheck(lines, state) {
  const text = lines.join("\n");
  const issues = [];
  const total = state.chunks.length;
  const done = state.chunks.filter((c) => c.stage === "done" || c.stage === "residue").length;
  const cur = state.chunks.find((c) => c.stage !== "done" && c.stage !== "residue");
  for (const m of text.matchAll(/(?:已完成|进度)\s+(\d+)\/(\d+)/g)) {
    if (Number(m[2]) !== total) issues.push(`进度分母失配：人话「${m[0]}」分母 ${m[2]} ≠ state 推导 total ${total}`);
    if (Number(m[1]) !== done) issues.push(`进度分子失配：人话「${m[0]}」已完成 ${m[1]} ≠ state 推导 done ${done}`);
  }
  // 当前 chunk 行："第 X/Y chunk（阶段），已完成"——阶段名可含全角括号（重审中（节 stale）），
  // 故锚定行尾沿 "），已完成" 而非首个闭括号
  const curM = text.match(/第\s*(\d+)\/(\d+)\s*chunk（(.+)），已完成/);
  if (curM) {
    if (Number(curM[1]) !== cur?.nn) issues.push(`当前 chunk 失配：人话第 ${curM[1]} chunk ≠ state 推导 nn ${cur?.nn}`);
    if (Number(curM[2]) !== total) issues.push(`进度分母失配：人话「第 ${curM[1]}/${curM[2]} chunk」≠ state 推导 ${cur?.nn}/total ${total}`);
    if (curM[3] !== stageCn(cur?.stage)) issues.push(`当前阶段失配：人话「${curM[3]}」≠ state 推导 ${stageCn(cur?.stage)}`);
  }
  if (text.includes("补审轮") && !text.includes(`${state.counters.freezeRounds}/${FREEZE_ROUND_MAX}`)) {
    issues.push(`冻结窗轮次失配：人话未见 ${state.counters.freezeRounds}/${FREEZE_ROUND_MAX}（counters.freezeRounds/FREEZE_ROUND_MAX）`);
  }
  if (state.residue?.length) {
    if (!text.includes("停修登记")) issues.push(`residue 行缺失：state.residue=[${state.residue.join(",")}] 而人话无停修登记行`);
  } else if (text.includes("停修登记")) {
    issues.push("residue 行在场而 state.residue 为空");
  }
  const wCount = lines.filter((l) => l.startsWith("⚠")).length;
  if (wCount !== state.warnings.length) issues.push(`⚠ 行数失配：人话 ${wCount} 行 ≠ state.warnings ${state.warnings.length} 条`);
  return issues;
}

export function renderStatus(dir, inv, state, queue, opts = {}) {
  const fp = fingerprint(inv);
  const { overBudget } = viewStats(inv, state, opts);

  const L = [];
  L.push(`# status — ${state.title}（唯一续跑文档）`);
  L.push("");
  L.push(`> schema: ${SCHEMA_VERSION}（state 版本戳——import-draft 据此拒收无戳旧格式，S2⑥）`);
  L.push(`> 推导锚：原文 sha1 ${state.originalSha}｜产物指纹 ${fp}｜推导时间 ${nowIso()}｜本文件为物化视图，可随时删除重建`);
  if (inv.verifyThresholds) L.push(`> 阈值披露（R22）：${JSON.stringify(inv.verifyThresholds)}`);
  L.push("");

  // ---- 段 1：人话（S3④ 单一来源 plainLines——重构提取，输出字节不变）----
  L.push("## 人话");
  L.push("");
  L.push(...plainLines(dir, inv, state, queue, opts));
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
      const secs = d.c4.secs.map((s) => `${s.id} ${s.title}(${s.sha})`).join("、");
      L.push(`  c4: 共 ${d.c4.lines} 行｜起止：${d.c4.range[0]} → ${d.c4.range[1]}｜节：${secs}｜派发前核对：grep -n "^#" ${d.input} 节序与上列一致`);
    }
    L.push("```");
  } else {
    L.push("（无待派发动作）");
  }
  if (overBudget) L.push("");
  if (overBudget) L.push("注：会话预算已到，本轮不派发；干净退出点。");
  // A3（G3 架构位，S3b）：守卫/水位出口镜像 overBudget 的注行（原守卫分支动作段无注行——
  // 头行+空清单裸收尾）。yaml 结构不动（头行+空清单系 S3 前默认预览既有形态）。
  const guardNote = opts.guard?.type === "ram"
    ? "注：RAM 守卫拒绝派发（S3①），本轮不派发；释放内存后重跑 dispatch 续派。"
    : opts.guard?.type === "ctx"
      ? "注：上下文水位退出（S3②），本轮不派发；干净退出点——交接卡已再生，下次继续翻译。"
      : null;
  if (guardNote) {
    L.push("");
    L.push(guardNote);
  }
  return L.join("\n") + "\n";
}

// S3③ 冷启动交接卡（handoff/cold-start.md）：机器生成的物化视图——新会话零记忆冷启动读它即知
// 全局。与 status.md / --json 同源派生（同一 inv/state 对象），可删可重建（重跑覆盖）；
// 除再生时间行外全部内容为纯派生（同输入同字节）。欠账表**直接从 state.chunks 派生**
// （--json 输出的同一对象），不重扫文件系统。
export function renderColdStart(dir, inv, state, queue, opts = {}) {
  const L = [];
  L.push(`# cold-start — ${state.title}（冷启动交接卡）`);
  L.push("");
  L.push("> 机器生成（status.mjs）——勿手改；重跑覆盖");
  L.push(`> 再生时间：${nowIso()}｜产物指纹：${fingerprint(inv)}｜数据源 = status 推导（与 --json 同源）`);
  L.push("");
  L.push("## 下次动作");
  L.push("");
  L.push(`继续翻译 ${state.title}`);
  L.push("状态由 status.mjs 从文件系统推导，零会话记忆依赖。");
  L.push("");
  L.push("## 欠账表");
  L.push("");
  L.push("| chunk | 阶段 | stale 节 |");
  L.push("|-------|------|----------|");
  for (const c of state.chunks) {
    const staleIds = Object.keys(c.staleSections ?? {});
    L.push(`| ${nn2(c.nn)} | ${stageCn(c.stage)} | ${staleIds.length ? staleIds.join(",") : "-"} |`);
  }
  L.push("");
  const freeze = FREEZE_STAGES.includes(state.global);
  L.push(`- 全局阶段：${state.global}${freeze ? `（内容冻结窗：补审轮 ${state.counters.freezeRounds}/${FREEZE_ROUND_MAX}，项目级硬门）` : ""}`);
  L.push(`- 挂起：${inv.pending ?? "无"}`);
  L.push(`- 停修（residue）：${state.residue?.length ? state.residue.map(nn2).join(",") : "无"}`);
  for (const w of state.warnings) L.push(`- ⚠ ${w}`);
  L.push("");
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
  return { translate: "待翻译", adjudicate: "待裁定", verify: "待机械校验", review: "审校中", "re-review": "重审中（节 stale）", residue: "停修（residue 登记）", done: "完成" }[s] ?? s;
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
    case "fix": // S2④：fixer 包物化在 run() 内（需 state：冻结窗判定/修复环轮/residue）——verb 层无动作
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
  // S2⑤：走同事务助手（事件先行提交 + pending 原子物化，中断自愈见 reconcileSuspend）
  if (state.overLimit.length && !inv.pending) {
    suspendTxn(dir, `type: pending-user\n原因：计数器超限（chunk ${state.overLimit.join(",")}——机械打回 >2 或累计升级 ≥2，G6/R4）\n`, { detail: `over-limit:${state.overLimit.join(",")}` });
    inv.pending = "pending-user";
  }

  const queue = buildQueue(state, inv, opts);
  queue.dispatch = [];
  // S2④ fix 动词：物化 fixer 包 + fix 事件（挂起态不派发；超限停 chunk 登 residue——项目不停）
  let fixInfo = null;
  if (opts.verb === "fix") {
    if (inv.pending) return { exitCode: 1, errors: ["挂起中（pending.md 在场）——不派发修复；先经 PENDING-USER 菜单裁决"] };
    const fr = fixDispatch(dir, inv, state, opts);
    if (fr.exitCode !== 0) return fr;
    fixInfo = fr;
    state = deriveState(scanWorkdir(dir)); // fix 事件已入流——status.md 按最新轮次渲染
  }
  // 预算到点 = 干净退出点：不物化、不派发（R14）
  const overBudget = opts.budget != null && state.counters.dispatchedSinceSessionEnd >= opts.budget;
  // C3 view/dispatch 拆分（2026-09-14 M3 回写）：默认只读渲染（零副作用），
  // 仅 verb="dispatch" 时物化 staging + 追加事件——"运行一次 = 派发一轮承诺"不再是默认行为
  // （M3 实证：三连跑产生 36 条幻影 dispatch 事件）
  const wantDispatch = opts.verb === "dispatch";
  if (wantDispatch && queue.q.length && !inv.pending && !overBudget) {
    // S2③ 冻结窗补审轮硬门（项目级 ≤2）：超限拒绝本轮补审派发——非零退出 + pending.md 上报
    // （统稿完成后内容冻结，补审轮已尽须用户裁决；residue/冻结窗发现只登记的口径见 SKILL.md Step 8）
    const inFreeze = FREEZE_STAGES.includes(state.global);
    if (inFreeze && state.counters.freezeRounds >= FREEZE_ROUND_MAX) {
      suspendTxn(dir, `type: pending-user\n原因：冻结窗补审轮超限（已 ${state.counters.freezeRounds} 轮，硬门 ≤${FREEZE_ROUND_MAX}，S2③）——统稿完成后内容冻结，pm-review 类发现只登记不修；用户点名修复的补审轮已尽，须用户裁决（菜单：①继续（换模型/调参）②手修后说"继续翻译"③说"停止翻译"封存）\n`, { detail: `freeze-rounds:${state.counters.freezeRounds}` });
      return { exitCode: 3, errors: [`冻结窗补审轮 ${state.counters.freezeRounds}/${FREEZE_ROUND_MAX} 已达硬门——拒绝补审派发，已写 pending.md 上报（S2③）`] };
    }
    // S3① RAM 守卫：可用内存 < GUARD_RAM_MIN_MB → 拒绝派发（低内存机器纪律——派发打满 =
    // OOM 死机）。不物化、不追加 dispatch 事件；session-end（ENG-4 生产者——守卫退出也是
    // 会话边界，预算窗复位）+ 冷启动卡 / status.md 再生收尾（与 dispatch 收尾同款）后 exit 4。
    // fail-open：信号不可得（null）不阻塞。
    const ram = availableRamMb();
    if (ram != null && ram < GUARD_RAM_MIN_MB) {
      appendEvents(dir, { ev: "session-end", detail: `ram-guard:${ram}MB` });
      opts.guard = { type: "ram", value: ram };
      // 人话 ⚠（renderStatus 由 state.warnings 渲染）与 --json（state 同对象）双通道同源
      state.warnings.push(`RAM 可用 ${ram}MB < ${GUARD_RAM_MIN_MB}MB——S3① 守卫拒绝派发（不派新单元收尾退出；释放内存后重跑 dispatch 续派）`);
      fs.mkdirSync(path.join(dir, "handoff"), { recursive: true });
      fs.writeFileSync(path.join(dir, "handoff", "cold-start.md"), renderColdStart(dir, inv, state, queue, opts), "utf-8");
      fs.writeFileSync(path.join(dir, STATUS), renderStatus(dir, inv, state, queue, opts), "utf-8");
      return { exitCode: 4, errors: [`RAM 可用 ${ram}MB < ${GUARD_RAM_MIN_MB}MB——S3① 守卫拒绝派发（不派新单元收尾退出；释放内存后重跑 dispatch 续派）`], state };
    }
    // S3② 水位退出：剩余上下文百分比（GUARD_CTX_PCT preflight 注入）< GUARD_CTX_MIN_PCT →
    // 本轮不派发——跳过物化但走正常收尾（mtime 对账 / renderStatus / 写 status.md / 冷启动卡
    // 含"## 下次动作"）→ exit 0（干净退出点）。水位为主信号、budget 为兜底上限（N 降级为保险丝）。
    const pct = ctxPctFromEnv();
    if (pct != null && pct < GUARD_CTX_MIN_PCT) {
      appendEvents(dir, { ev: "session-end", detail: `ctx-watermark:${pct}%` }); // ENG-4 生产者
      opts.guard = { type: "ctx", value: pct };
      // 追加后不重推导 state：人话仍按已渲染口径（退出点文案不依赖追加后计数）
    } else {
      // 缺省 WARN：水位信号未注入（本轮确要派发而 GUARD_CTX_PCT 缺席）——WARN 放行不阻塞
      if (pct == null) {
        state.warnings.push("水位信号缺省：GUARD_CTX_PCT 未注入——WARN 放行（S3② 纪律：主 agent 按已处理单元×实测成本估算剩余上下文百分比注入 preflight；代理计数 = events dispatchedSinceSessionEnd）");
      }
      queue.dispatch = materialize(dir, queue.q);
      // S2②：dispatch 事件携带 c4 detail（JSON——final-gate 抽核对象；events 禁补记，只在物化时落）。
      // S2③：冻结窗内补审派发批记一轮（freeze-round 事件——计数器事实源，脚本落流禁人工补记）。
      // ENG-1：两批合并 dispatchEventsBatch 单次 appendEvents 原子落流（双追加窗关闭）
      appendEvents(dir, dispatchEventsBatch(queue.q, queue.dispatch, inFreeze));
    }
  }
  // ENG-4：预算收尾也产 session-end（R14 计数器跨会话复位自此才真正工作——此前只渲染退出点
  // 不落事件，dispatchedSinceSessionEnd 永不归零）。一次性：本轮因 overBudget 未物化才落；
  // 追加后不重推导 state——人话仍按已渲染口径（overBudget 分支文案已就绪）。
  if (wantDispatch && overBudget && !inv.pending) {
    appendEvents(dir, { ev: "session-end", detail: `budget:${opts.budget}` });
  }
  // S2⑤ §9：mtime 对账兜底（只 WARN 不阻塞；人话段 + --json state.warnings 双通道）
  const mtimeWarn = mtimeAudit(dir, inv);
  if (mtimeWarn) state.warnings.push(mtimeWarn);
  // S3④ 人话自检：渲染前从 state 重推关键事实对 plainLines 断言（空 = 一致）——非空则
  // console.error 逐条 + 进 state.warnings（人话与 --json 双通道同源可见），不改退出码。
  const plainIssues = plainSelfCheck(plainLines(dir, inv, state, queue, opts), state);
  for (const x of plainIssues) console.error(`人话自检失配：${x}`);
  for (const x of plainIssues) state.warnings.push(`人话自检失配：${x}`);
  const text = renderStatus(dir, inv, state, queue, opts);
  fs.writeFileSync(path.join(dir, STATUS), text, "utf-8");
  // S3③ 冷启动卡再生：dispatch 收尾（无论本轮是否实际物化）与 status.md 同时写 handoff/cold-start.md
  // ——物化视图同源派生，可删可重建；守卫（RAM/水位）出口的再生点随下一段守卫接入。
  if (opts.verb === "dispatch") {
    fs.mkdirSync(path.join(dir, "handoff"), { recursive: true });
    fs.writeFileSync(path.join(dir, "handoff", "cold-start.md"), renderColdStart(dir, inv, state, queue, opts), "utf-8");
  }
  const fixDisclosure = fixInfo
    ? `fixer 包已物化：${fixInfo.pkg}（修复环轮 ${fixInfo.round}/${FIX_ROUND_MAX}${fixInfo.freeze ? "，冻结窗内" : ""}，${fixInfo.pkgBytes}B）——派 fixer subagent 修复（主上下文不进报告全文），重跑 Step 5 后 --verb dispatch 复欠`
    : null;
  return { exitCode: 0, statusText: text, state, inv, queue, disclosure: fixDisclosure ?? verbResult.disclosure ?? null };
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
    else if (a === "--nn") opts.nn = Number(argv[++i]);
    else if (a === "--dims") opts.dims = argv[++i];
    else if (a === "--probe-truth") opts.probeTruth = argv[++i];
    else if (a === "--json") opts.json = true;
    else if (a === "-h" || a === "--help") opts.help = true;
    else pos.push(a);
  }
  return { pos, opts };
}

const __help = `status.mjs — xl-translator 状态机与续跑（M1b）

用法:
  node status.mjs <workdir> [--verb progress|continue|stop|retranslate|sample|restart|fix|dispatch]
                            [--chapter N] [--budget N] [--nn N] [--dims a,b] [--probe-truth <file>] [--json]

动词（用户自然语言由主 agent 映射）:
  progress（默认）/ continue / stop / retranslate（--chapter，R5 披露章↔chunk）/
  sample（--chapter，R16 样张）/ restart（R18-③ 新起全量）/ dispatch（C3 物化派发）/
  fix（S2④：--nn N [--dims accuracy,translationese,ai-tone,readability]——物化 fixer 包
       staging/fixer-chunk-NN.md + fix 事件；修复环轮每 chunk ≤${FIX_ROUND_MAX}，超限停该 chunk 登 residue）

产物: status.md（唯一续跑文档，整体重写；头带 schema: 版本戳——S2⑥，import-draft 拒收无戳旧格式）
       + staging/（统一物化，每轮先清后写）+ events.jsonl（追加）

退出码: 0 正常 / 1 用法或动词错 / 2 工作目录异常 / 3 计数器硬门拒绝（S2③ 冻结窗补审轮 >2 / S2④ 修复环轮 >3） / 4 S3 守卫拒绝（RAM <${GUARD_RAM_MIN_MB}MB / symlink 调用防呆）`;

// S3⑤ symlink 调用防呆：经 symlink 调用（argv[1] ≠ realpath）时下方 CLI 守卫将静默失配
// （no-op、退出码 0——memory 记载事故）——前置拦截：stderr 警示 + exit 4
{ const g = symlinkCliGuard(process.argv[1]); if (g) { console.error(g.msg); process.exit(4); } }

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
