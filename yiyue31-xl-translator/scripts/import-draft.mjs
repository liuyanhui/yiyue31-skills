// import-draft.mjs — xl-translator 旧流程半成品目录导入（S2⑥ 最小实现；边界清单 = 提案 §7）
//
// 场景：把 draft 工作目录（旧流程产物）按 §7 受/拒/隔离/重建边界导入本 skill 契约——
// 受类原样保留续用；拒类 sibling 归档（-r1）后由状态机强制重跑/重物化；隔离类移入
// quarantine/；未列产物默认隔离 + WARN（不导入，纳入须修清单）。真实目录迁移属 P1，
// 本脚本只交付机制（§6.2 精神：生于脚本，SKILL.md 仅一行引用）。
//
// 版本戳（验收钉死）：status.md 头 `> schema: <n>` 行 = state 版本戳（status.mjs 渲染
// 恒带）。导入时源目录 status.md 无戳（旧格式）或版本不识 → **非零退出拒收、零副作用**
// （旧状态不可信——"delivered" 系误报；归档或移除该文件后重试，状态按文件系统推导重建；
// 跨版本迁移语义属 S4①）。
//
// 防造假红线：events.jsonl 禁补记——旧流整体归档（events-r1.jsonl）不迁移不合并，
// 新流自零新建（首事件 = import，携边界执行对账明细）。
//
// 边界表（§7；缺省 = 未列产物默认隔离 WARN）：
//   受（原样保留）：original-*.md / chunks / manifest.md（chunk 回切锚）/ translated-chunks
//     / brief.md / style-card.md / glossary* / keep-list-*.json / special-phrases* / terms*
//     / adjudications / analysis-notes-*.md
//   拒（sibling 归档 -r1）：reviews → reviews-r1/（半块锚不可诚实迁移，§11）；
//     events.jsonl → events-r1.jsonl（新建新流）；verify-results.json → -r1.json（强制重跑标记）
//   拒（隔离区，重跑/重生成）：merged-draft.md / pm-review-*.md / cold-read-*.md / REPORT.md
//   隔离（隔离区，分析与历史件）：consistency-*.md / analysis-context-overflow /
//     review-pre-translation / extract-b*.md / coldseg* / log* / handoff（projection 按需重建）
//   清空：staging（无条件重物化）
//   注：probe truth 系源侧文件（probe/truth/），不在工作目录——新 run+truth 属 S2⑦。
//
// 幂等：事件流首事件 ev=import ⇒ 已导入过——跳过全部移动，仅重导 status.md（exit 0 披露）。
//
// CLI: node import-draft.mjs <draftDir> [--json]
// 退出码: 0 成功（含幂等跳过）/ 1 拒收（旧格式 status.md 无戳 / 版本不识 / 用法错 / 归档目标冲突）
//         / 2 工作目录异常（缺 original / manifest）

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { run as statusRun, readEvents, appendEvents, parseStatusSchema, SCHEMA_VERSION } from "./status.mjs";

const QUARANTINE = "quarantine";

// ---------- §7 边界表（数据驱动；自上而下首匹配） ----------

const BOUNDARY = [
  // 受：原样保留续用
  { re: /^original-.*\.md$/, act: "keep" },
  { re: /^chunks$/, act: "keep" },
  { re: /^manifest\.md$/, act: "keep" },
  { re: /^translated-chunks$/, act: "keep" },
  { re: /^brief\.md$/, act: "keep" },
  { re: /^style-card\.md$/, act: "keep" },
  { re: /^glossary/, act: "keep" },
  { re: /^keep-list-.*\.json$/, act: "keep" },
  { re: /^special-phrases/, act: "keep" },
  { re: /^terms/, act: "keep" },
  { re: /^adjudications$/, act: "keep" },
  { re: /^analysis-notes-.*\.md$/, act: "keep" },
  // 拒：sibling 归档 -r1（重跑/重物化由状态机强制）
  { re: /^reviews$/, act: "archive", as: "reviews-r1" }, // §11：半块锚不可诚实迁移
  { re: /^events\.jsonl$/, act: "archive", as: "events-r1.jsonl" }, // 禁补记：新流自零新建
  { re: /^verify-results\.json$/, act: "archive", as: "verify-results-r1.json" }, // 强制重跑标记
  // 拒：隔离区（重跑 / 按新 sha 重生成）
  { re: /^merged-draft\.md$/, act: "quarantine" },
  { re: /^pm-review-.*\.md$/, act: "quarantine" },
  { re: /^cold-read-.*\.md$/, act: "quarantine" },
  { re: /^REPORT\.md$/, act: "quarantine" },
  // 隔离：分析与历史件
  { re: /^consistency-.*\.md$/, act: "quarantine" },
  { re: /^analysis-context-overflow$/, act: "quarantine" },
  { re: /^review-pre-translation$/, act: "quarantine" },
  { re: /^extract-b.*\.md$/, act: "quarantine" },
  { re: /^coldseg/, act: "quarantine" },
  { re: /^log/, act: "quarantine" },
  { re: /^handoff$/, act: "quarantine" },
  // 清空
  { re: /^staging$/, act: "clear" }, // 在途单元与节锚不兼容，无条件重物化
];

export function classifyEntry(name) {
  return BOUNDARY.find((r) => r.re.test(name)) ?? null; // null = 缺省：隔离 + WARN
}

// ---------- 导入主流程 ----------

export function runImport(dir, opts = {}) {
  if (!fs.existsSync(dir)) return { exitCode: 2, errors: ["目录不存在"] };
  const entries = fs.readdirSync(dir);
  if (!entries.some((f) => /^original-.*\.md$/.test(f))) {
    return { exitCode: 2, errors: ["缺 original-<title>.md（不是可导入的 draft 工作目录）"] };
  }
  if (!fs.existsSync(path.join(dir, "manifest.md"))) {
    return { exitCode: 2, errors: ["缺 manifest.md（chunk 回切锚——§7 输入契约）"] };
  }

  // ---- 版本戳门（验收钉死）：门在任何移动之前 → 拒收即零副作用 ----
  const statusPath = path.join(dir, "status.md");
  if (fs.existsSync(statusPath)) {
    const v = parseStatusSchema(fs.readFileSync(statusPath, "utf-8"));
    if (v == null) {
      return { exitCode: 1, errors: [`旧格式 status.md（无 schema: 版本戳）——拒收导入（S2⑥）：旧状态不可信（"delivered" 系误报）；归档或删除该文件后重试，状态将按文件系统推导重建`] };
    }
    if (v !== SCHEMA_VERSION) {
      return { exitCode: 1, errors: [`status.md schema v${v} ≠ 本工具 v${SCHEMA_VERSION}——跨版本迁移属 S4①，拒收导入`] };
    }
  }

  // ---- 幂等：新事件流首事件 = import ⇒ 已导入过（跳过全部移动） ----
  const evFile = path.join(dir, "events.jsonl");
  const existing = fs.existsSync(evFile) ? readEvents(dir) : [];
  if (existing.length && existing[0].ev === "import") {
    const st = statusRun(dir, {});
    return {
      exitCode: 0,
      alreadyImported: true,
      disclosure: "已导入过（事件流首事件 = import）——幂等跳过边界执行；status.md 已按当前文件系统重导",
      statusText: st.statusText,
    };
  }

  // ---- 边界执行（§7 数据驱动） ----
  const qdir = path.join(dir, QUARANTINE);
  const result = { schema: SCHEMA_VERSION, kept: [], archived: [], quarantined: [], cleared: [], warns: [] };
  for (const name of entries) {
    if (name === "status.md" || name === QUARANTINE || name === "events.jsonl") continue; // 门/隔离区/事件流单独处理
    const rule = classifyEntry(name);
    const p = path.join(dir, name);
    if (!rule) {
      // 缺省（§7）：未列产物默认隔离 + WARN，不导入
      fs.mkdirSync(qdir, { recursive: true });
      fs.renameSync(p, path.join(qdir, name));
      result.quarantined.push(name);
      result.warns.push(`未列产物 ${name} 默认隔离（WARN，不导入）——§7 缺省规则；确需导入须修边界清单`);
      continue;
    }
    switch (rule.act) {
      case "keep":
        result.kept.push(name);
        break;
      case "archive": {
        const target = path.join(dir, rule.as);
        if (fs.existsSync(target)) return { exitCode: 1, errors: [`归档目标已存在：${rule.as}——人工确认后重试（不覆盖既有归档）`] };
        fs.renameSync(p, target);
        result.archived.push(`${name} → ${rule.as}`);
        break;
      }
      case "quarantine": {
        fs.mkdirSync(qdir, { recursive: true });
        const target = path.join(qdir, name);
        if (fs.existsSync(target)) return { exitCode: 1, errors: [`隔离区已存在同名 ${name}——人工确认后重试`] };
        fs.renameSync(p, target);
        result.quarantined.push(name);
        break;
      }
      case "clear":
        fs.rmSync(p, { recursive: true, force: true });
        result.cleared.push(name);
        break;
      default:
        break;
    }
  }

  // ---- events：旧流整体归档 + 新流自零新建（禁补记；首事件 = import 携对账明细） ----
  if (fs.existsSync(evFile)) {
    const target = path.join(dir, "events-r1.jsonl");
    if (fs.existsSync(target)) return { exitCode: 1, errors: ["归档目标已存在：events-r1.jsonl——人工确认后重试"] };
    fs.renameSync(evFile, target);
  }
  appendEvents(dir, {
    ev: "import",
    schema: SCHEMA_VERSION,
    detail: JSON.stringify({
      kept: result.kept.length,
      archived: result.archived.length,
      quarantined: result.quarantined.length,
      cleared: result.cleared.length,
      verifyRerun: true, // verify-results 已归档 ⇒ 状态机置 verify 阶段强制重跑
    }),
  });

  // ---- 重建 status.md（版本戳在场） ----
  const st = statusRun(dir, {});
  if (st.exitCode !== 0) return { exitCode: st.exitCode, errors: st.errors ?? [], partial: result };
  result.exitCode = 0;
  result.state = st.state;
  result.statusText = st.statusText;
  result.disclosure = `导入完成：受 ${result.kept.length}｜归档 ${result.archived.length}｜隔离 ${result.quarantined.length}｜清空 ${result.cleared.length}${result.warns.length ? `｜WARN ${result.warns.length}` : ""}——verify-results 已归档 ⇒ 全部 chunk 回 verify 阶段强制重跑`;
  return result;
}

// ---------- CLI ----------

function parseArgs(argv) {
  const pos = [];
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") opts.json = true;
    else if (a === "-h" || a === "--help") opts.help = true;
    else pos.push(a);
  }
  return { pos, opts };
}

const __help = `import-draft.mjs — 旧流程半成品目录导入（S2⑥ 最小实现；边界清单 = 提案 §7）

用法:
  node import-draft.mjs <draftDir> [--json]

规则:
  - 版本戳门：源目录 status.md 无 schema: 戳（旧格式）或版本不识 → 非零拒收、零副作用
  - 受类原样保留；拒类 sibling 归档 -r1（reviews/events/verify-results）；隔离类与
    未列缺省入 quarantine/（缺省附 WARN 不导入）；staging 清空（无条件重物化）
  - 防造假红线：events.jsonl 禁补记——旧流归档（events-r1.jsonl），新流自零新建
  - 幂等：事件流首事件 = import ⇒ 跳过边界执行，仅重导 status.md

产物: reviews-r1/、events-r1.jsonl、verify-results-r1.json、quarantine/、新 events.jsonl（首事件 import）、status.md（重建，头带 schema: 戳）
退出码: 0 成功（含幂等）/ 1 拒收（旧格式/版本不识/用法/归档冲突）/ 2 工作目录异常`;

// CLI 守卫用 fileURLToPath（Windows pathname 坑，见 status.mjs 同注）
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const { pos, opts } = parseArgs(process.argv.slice(2));
  if (opts.help || pos.length < 1) {
    console.log(__help);
    process.exit(pos.length < 1 && !opts.help ? 1 : 0);
  }
  const r = runImport(pos[0], opts);
  if (r.errors?.length) console.error(`❌ ${r.errors.join("；")}`);
  for (const w of r.warns ?? []) console.error(`⚠ ${w}`);
  if (r.disclosure) console.log(`📌 ${r.disclosure}`);
  if (opts.json) {
    console.log(JSON.stringify({
      exitCode: r.exitCode,
      alreadyImported: r.alreadyImported ?? false,
      schema: r.schema ?? null,
      kept: r.kept ?? [],
      archived: r.archived ?? [],
      quarantined: r.quarantined ?? [],
      cleared: r.cleared ?? [],
      warns: r.warns ?? [],
      errors: r.errors ?? [],
      state: r.state ? { global: r.state.global, chunks: r.state.chunks.map((c) => ({ nn: c.nn, stage: c.stage })) } : null,
    }, null, 2));
  }
  process.exit(r.exitCode);
}
