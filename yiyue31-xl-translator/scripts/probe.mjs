// probe.mjs — xl-translator 源侧探针生成（DESIGN §2 Step 10 探针机制 + §5.1 探针落位/R25）
//
// 探针 = 植入已知缺陷的伪审校样本：status.mjs 以 run(dir, { probeTruth }) 把探针与真半块
// 同构混排进审校队列（staging/ 统一物化，被派发者不可分辨）；审校报告落 reviews/ 虚拟
// NN 901-999（真实 chunk 上界 640，永不冲突）。final-gate 比对报告是否实际命中缺陷。
//
// ground truth（unit↔真假/缺陷类型/预期命中点）只存源侧 probe/truth/<run>.json，不落工作区
// （威胁模型边界：防偷懒型造假——"识别探针→只对探针认真"；不防能读源仓的对抗型伪造，
// 该层由报告签名/undersize 检测兜底——DESIGN §2 Step 10）。
//
// 样本来源：内置缺陷模板库（每维度 3 型，真实中文技术译文语形 + 单一植入缺陷）。
// expectedHit = 真实报告几乎必然引用的特征串（植入错误值/病灶词本身）——终检机械比对
// 报告含该串即记命中；这是"报告确实读了样本并抓到缺陷"的最弱充分证据。
//
// 确定性：同 run + 同 seed 生成字节相同（无时间戳入内容——M5 同款纪律，truth 可复现）。
//
// CLI: node probe.mjs [--run <runId>] [--seed N] [--dims accuracy,translationese,ai-tone,readability]
//                     [--per-dim N] [--truth-dir <dir>] [--force] [--json]
//   --run       run 标识（run = final-gate 一次完整执行——R20）；缺省 = 当前时间紧凑串
//   --seed      生成种子（缺省 = runId 哈希）
//   --truth-dir truth 目录；缺省 = <skill 根>/probe/truth（源侧，非工作区）
// 产物: <truth-dir>/<run>.json —— [{ virtualNn, dim, half, text, defectType, expectedHit }]
// 退出码: 0 成功 / 1 用法错 / 2 写入失败（含已存在未加 --force）

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const VIRTUAL_NN_MIN = 901; // 与 status.mjs 同段（901-999，真实上界 640 永不冲突）
const VIRTUAL_NN_MAX = 999;
const DIMS = ["accuracy", "translationese", "ai-tone", "readability"];
const SKILL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// ---------- 缺陷模板库 ----------
// half 混排 a/b（真半块也分 a/b，同构）；defectType 供 REPORT 人话披露。
// 设计规则（M3 前置⑤）：探针单元**无原文侧**（staging 只物化单段中文），一切缺陷必须
// **译文侧自可见**——审校者不对照原文也能判错。依赖原文比对的错型（千分位错位/否定丢失/
// 条件句误译）会结构性不命中 → 终检 global FAIL 死循环，禁用。

const TEMPLATES = {
  accuracy: [
    {
      half: "a",
      text: "集群共部署 18 个节点，每个节点配备 4 张加速卡，合计 54 张加速卡。",
      defectType: "算术自相矛盾：18×4=72，文中写 54（译文侧可判）",
      expectedHit: "54",
    },
    {
      half: "b",
      text: "该功能默认关闭，用户无需任何配置即可直接使用。",
      defectType: "陈述自相矛盾：默认关闭却无需配置直接使用（译文侧可判）",
      expectedHit: "默认关闭",
    },
    {
      half: "a",
      text: "整个迁移过程耗时 3 小时，其中仅数据校验一步就花了 2.5 天。",
      defectType: "量级自相矛盾：整体 3 小时却含单步 2.5 天（部分大于整体，译文侧可判）",
      expectedHit: "2.5 天",
    },
  ],
  translationese: [
    {
      half: "a",
      text: "然而，与此同时，更重要的是，因此，团队需要重新审视这套网关的限流设计。",
      defectType: "逻辑连接词堆砌（英译中典型翻译腔）",
      expectedHit: "与此同时",
    },
    {
      half: "b",
      text: "该模块依赖它，它又调用了它，因此它的稳定性决定了它的上限。",
      defectType: "指代衔接：连续「它」无先行词消解",
      expectedHit: "它",
    },
    {
      half: "a",
      text: "正如上面所提到的那样，正如下面将要看到的那样，这个抽象是必要的一环。",
      defectType: "翻译腔套话：正如……那样 双连",
      expectedHit: "那样",
    },
  ],
  "ai-tone": [
    {
      half: "a",
      text: "总而言之，综上所述，在当今快速发展的时代背景下，我们不难发现该协议具有重要意义。",
      defectType: "AI 味套话（总结性空话开头）",
      expectedHit: "综上所述",
    },
    {
      half: "b",
      text: "首先，我们介绍背景。其次，我们分析问题。最后，我们总结展望。值得一提的是，这个领域未来可期。",
      defectType: "模板化「首先/其次/最后」+ 充数句",
      expectedHit: "值得一提的是",
    },
    {
      half: "a",
      text: "毫无疑问，这一设计堪称优雅，充分体现了卓越的工程智慧，令人印象深刻。",
      defectType: "AI 味空洞赞美（无信息量的形容词堆叠）",
      expectedHit: "毫无疑问",
    },
  ],
  readability: [
    {
      half: "a",
      text: "系统启动时会加载配置文件然后解析环境变量接着初始化数据库连接池之后注册中间件最后启动监听端口。",
      defectType: "超长流水句一逗到底（应断句）",
      expectedHit: "接着",
    },
    {
      half: "b",
      text: "文档被编写之后被审核，被审核之后被修改，被修改之后被再次审核，最终被发布。",
      defectType: "被字句堆叠（中文被动滥用）",
      expectedHit: "被",
    },
    {
      half: "a",
      text: "鉴于此，不难发现，其在某种程度上，于特定场景下，就某些方面而言，具有一定的可行性。",
      defectType: "层层 hedging 冗语（信息密度趋零）",
      expectedHit: "某些方面",
    },
  ],
};

// ---------- 确定性随机（mulberry32 + FNV-1a 种子） ----------

function hashSeed(s) {
  let h = 2166136261;
  for (const c of String(s)) {
    h ^= c.codePointAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seedNum) {
  let a = seedNum >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- 生成 ----------

// entries 顺序即 status.mjs 的虚拟 NN 分配序（VIRTUAL_NN_MIN + index）——两侧同规则，
// truth 内嵌 virtualNn 供 final-gate 直接消费。
export function generate({ dims = DIMS, perDim = 1, seed = 0 } = {}) {
  const pick = rng(seed >>> 0);
  const entries = [];
  for (const dim of dims) {
    const pool = TEMPLATES[dim];
    if (!pool) throw new Error(`未知维度：${dim}（合法：${DIMS.join(",")}）`);
    const used = new Set();
    for (let k = 0; k < perDim; k++) {
      let idx = Math.floor(pick() * pool.length);
      let guard = 0;
      while (used.has(idx) && guard++ < pool.length) idx = (idx + 1) % pool.length; // 无放回轮转
      used.add(idx);
      const t = pool[idx];
      entries.push({
        virtualNn: VIRTUAL_NN_MIN + entries.length,
        dim,
        half: t.half,
        text: t.text,
        defectType: t.defectType,
        expectedHit: t.expectedHit,
      });
    }
  }
  if (entries.length > VIRTUAL_NN_MAX - VIRTUAL_NN_MIN + 1) {
    throw new Error(`探针数 ${entries.length} 超虚拟 NN 段（901-999 共 99 上限）`);
  }
  return entries;
}

// 落盘源侧 truth；已存在拒绝覆盖（防误改已派发 run 的 ground truth）。
export function writeTruth(truthDir, runId, entries) {
  fs.mkdirSync(truthDir, { recursive: true });
  const file = path.join(truthDir, `${runId}.json`);
  if (fs.existsSync(file)) return { ok: false, file, reason: "exists" };
  fs.writeFileSync(file, JSON.stringify(entries, null, 2) + "\n", "utf-8");
  return { ok: true, file };
}

export function defaultRunId(now = new Date()) {
  return now.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
}

// ---------- CLI ----------

function parseArgs(argv) {
  const pos = [];
  const opts = { dims: [...DIMS], perDim: 1, truthDir: null, run: null, seed: null, force: false, json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--run") opts.run = argv[++i];
    else if (a === "--seed") opts.seed = Number(argv[++i]);
    else if (a === "--dims") opts.dims = argv[++i].split(",").map((s) => s.trim()).filter(Boolean);
    else if (a === "--per-dim") opts.perDim = Number(argv[++i]);
    else if (a === "--truth-dir") opts.truthDir = argv[++i];
    else if (a === "--force") opts.force = true;
    else if (a === "--json") opts.json = true;
    else if (a === "-h" || a === "--help") opts.help = true;
    else pos.push(a);
  }
  return { pos, opts };
}

const __help = `probe.mjs — xl-translator 源侧探针生成（M1c）

用法:
  node probe.mjs [--run <runId>] [--seed N] [--dims accuracy,translationese,ai-tone,readability]
                 [--per-dim N] [--truth-dir <dir>] [--force] [--json]

规则:
  - 每维度默认 1 条探针（final-gate 核对"每维度每 run ≥1"——R20）；--per-dim 可加（无放回选模板）
  - 确定性：同 run + 同 seed 生成字节相同；seed 缺省 = runId 哈希
  - truth 只存源侧（缺省 <skill 根>/probe/truth/），绝不落工作区；已存在拒绝覆盖（--force 除外）
  - 探针文本经 status.mjs probeTruth 接口混入审校队列（staging 同构物化，R25）

产物: <truth-dir>/<run>.json —— [{ virtualNn(901-999), dim, half, text, defectType, expectedHit }]
退出码: 0 成功 / 1 用法错 / 2 写入失败（含已存在）`;

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const { opts } = parseArgs(process.argv.slice(2));
  if (opts.help || opts.perDim < 1 || opts.perDim > 3) {
    console.log(__help);
    process.exit(opts.help ? 0 : 1);
  }
  const runId = opts.run ?? defaultRunId();
  const seed = opts.seed ?? hashSeed(runId);
  let entries;
  try {
    entries = generate({ dims: opts.dims, perDim: opts.perDim, seed });
  } catch (e) {
    console.error(`❌ ${e.message}`);
    process.exit(1);
  }
  const truthDir = opts.truthDir ?? path.join(SKILL_ROOT, "probe", "truth");
  if (opts.force) {
    const file = path.join(truthDir, `${runId}.json`);
    fs.mkdirSync(truthDir, { recursive: true });
    fs.rmSync(file, { force: true });
  }
  const r = writeTruth(truthDir, runId, entries);
  if (!r.ok) {
    console.error(`❌ truth 已存在：${r.file}（该 run 的 ground truth 不得改写；确要重来加 --force）`);
    process.exit(2);
  }
  console.log(`✅ 探针 ${entries.length} 条（维度：${[...new Set(entries.map((e) => e.dim))].join("/")}）→ ${r.file}`);
  if (opts.json) console.log(JSON.stringify({ file: r.file, runId, seed, entries }, null, 2));
}
