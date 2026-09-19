# Changelog

## v3.0.1 (2026-09-19)

### 实施后三角色评审收口（角色①冷启动执行者 / ②边界攻击者 / ③防线一致性审计，32 条发现逐条去伪后修复）

- **derive-bilingual.js 高危修复（②-1）**：interleave fork 遗漏 else 分支的 `bodyFrom` 推进（xl 版中途修过、fork 时丢失）——常规无锚行译文（translator 常态）把标题行计入内容块，几乎全量伪降级或块数相当时零警告逐块错配。修复后评审复现夹具 sf-happy 从 0/2 节恢复 2/2 节。
- **防病态输入归一（②-3/②-4/②-9）**：结构分析前 CRLF→LF + 剥 BOM（JS 正则 `.` 不匹配 `\r`，CRLF 输入整体失配标题、代码块逐字比对必败）；交付物/原文读取与比对同口径归一。
- **URL 指纹归一（②-5）**：剥尾部 ASCII 句读（英文句点收尾 vs 中文句号收尾是翻译常态）+ scheme/host 大小写归一 + URL_RE 加 i 旗标——三族伪降级消除。**锚行等值判定（②-10/R3-7）**：仅当次行逐字 === `*原文标题*` 才作锚行消费——CJK 斜体行/错锚行不再被吞（偷内容块或顶掉真英文标题）。
- **stripMetaHeader 头边界前置条件（②-14）**：`---` 前须有 `>` 引用行——正文分隔线不再误切头部。
- **verify-pipeline 反伪证加固**：损坏 verify-results.json 由 WARN 升 FAIL（②-6——"把失败记录损坏化以降级终判"不再是通路）；披露句否定语义排除（②-7——"未跳过"不换合法降级）；空 chunks/ 回落单文件模式 + WARN（②-8——合法工程不再被误阻断）；单文件缺工作稿 → FAIL（②-11/R3-4——删工作稿不得无声解除时序与重跑）；单文件跨维度查重（R3-3——一份模板 cp 四份维度报告恢复为 FAIL，harness-v2 主杀器单文件等价对象）；批量写入阈值 ≥3（R3-5）；记录键大小写兜底（②-12）。
- **机械校验腿零信任化（R3-1/R3-2）**：单文件模式终检直接以当前工作稿 × 原文**重跑 verify() 同源校验**（xl final-gate 哲学的最小移植）——手写 passed 明文记录、跑一次真校验后改稿不重跑（T2b 零信号通道）均被抓回。信任边界在脚本头注与 SKILL Step 11① 披露；旧 chunk 回放模式维持"信落盘记录"（回放兼容）。
- **verify-mechanical.js（②-13）**：verify-results.json 损坏/非数组时先备份 `.corrupt` 再重建——历史记录不再静默蒸发。
- **指令层修复（角色①）**：双语动词跨技能路由歧义（translator 认可裸形「双语对照 <title>」+ 两 skill 互注布局路由）；路径约定补列 keep-list/pm-review；verify-results vs verify-report 易混澄清；cwd 纪律；残文"合并译文"；README 注释体系版本标签；发起意图丢失走补说兜底的披露；xl 侧 {translator-skill-dir} 定义、触发词补样张、封闭集与 test/ 关系显式化。
- xl-translator 同款修复（derive-bilingual.mjs：B2 对 manifest 登记但 chunks/ 实文件缺失由静默放行改 exit 3〔②-2 高危〕+ 上述归一/URL/锚行等值；新增 4 条评审回归测试，23/23 绿）。角色②夹具（/tmp/review-role2/）全量复跑确认：可绕过路径全部转 FAIL、合法路径保持 PASS、harness-v2 旧目录回放不变。

## v3.0.0 (2026-09-19)

### 瘦身为小文章专用（≤40KB）+ 双语对照派生（破坏性变更）

大文档需求已由 yiyue31-xl-translator 承接（分段流水线 + 终检交付门），本 skill 删除自带的整个多 chunk 分层，回归全文单文件流水线。设计讨论与三角色评审见 git 历史 `docs/yiyue31-translator-bilingual-*.md`。

- **>40KB 规模门（Step 1 首条）**：超限回一行"本文约 XX KB，超过 40KB 上限，本 skill 不再处理大文档——请对同一输入改说『翻译大文档』（yiyue31-xl-translator）"并停止；检查先于建目录/落盘（超限即零落盘）。替代 v2.5.0 的"确认后走多 chunk"提示。
- **删多 chunk 层（破坏性）**：Step 1.5 与 `scripts/doc_segmenter/` 整目录删除（含 node_modules 与自带 tests，`rm -rf` 兜住未跟踪残留）；bun 依赖随删除消失。路径约定单文件化：`original-{title}.md` → 工作稿 `translated-draft.md` → 交付物 `translated-{title}-zh.md`，审阅报告 `review-{type}.md`。Step 4/4.5/5/6/7/9 每维度一个 subagent 全文单次（"维度不合并"审校纪律保留）。
- **Step 10 合并 → 定稿**：只剩元信息头 + 临时标记清理 + 字数统计（头不再另插 H1——正文自带）。
- **删 Step 11 全局一致性（含 `scripts/consistency-checklist.js`）**：其存在理由就是分块（跨 chunk 术语/密度/格式不一致）；单文件流水线无此问题。README 设计决策档案同步删"全局一致性不读整篇"条目与"文章分段"节。
- **verify-results.json 反伪造链保留（v2.5.0 防线不断裂）**：`verify-mechanical.js` 落盘目录门从"仅 translated-chunks/"放宽为"translation 根亦落盘"（原文与工作稿同在根目录；旧布局回放兼容保留）。单文件下曾会因目录门静默跳过落盘——旁路异常不报错正是最险形态。
- **verify-pipeline.js 双模式适配**：无 `chunks/` → 单文件模式（四维报告 `review-{dimension}.md` + 共享产物完备性、模板签名、尺寸下限〔基准=原文整篇〕、批量写入签名〔四维同 60s 窗〕、时序〔比对工作稿 translated-draft.md——交付物被 Step 10 重写过不作对象〕、机械校验落盘〔按 original-{title}.md 键〕）；同维度查重在单文件下无跨单元对象、代码保留供旧目录回放。有 `chunks/` → 旧多 chunk 回放模式（harness-v2/abc-legal 复核能力不变）。
- **双语对照派生（新 `scripts/derive-bilingual.js`，fork 自 xl derive-bilingual.mjs 算法）**：交付物 × 原文两文件机械交错，中文在上英文在下；节配对 = 标题顺序（fence 感知），块配对按序 + 双级指纹（代码块逐字 + isCode；URL 集合），配不齐降级为节级对照并随文件尾披露覆盖率（宁降级不误导）。只读、幂等；产物 `translated-{title}-bilingual.md`（非交付物、不经终检、命名不以 -zh.md 结尾）。两种触发：发起时说了要双语 → 交付后自动跑；交付后随时补说"要双语对照"。
- **旧结构披露（不自动迁移）**：复用目录含 `chunks/` 多 chunk 结构时披露"此工程由旧版流程创建"，出口二选一（git 历史版本跑完 or 删目录重新发起）。
- **依赖段**：删 `Python >= 3.10`（全 skill 已零 Python 消费）；根 `.gitignore` 清 `__pycache__/` 残留行。
- **references**：`evaluate-readability-prompt.md` 输入描述"单个 chunk 中文译文"→"整篇中文译文"（与 hn-digest 版已分化为不同文档，不做同步——见 docs/shared-evaluation-prompt-sync.md）。

### 版本号

2.5.0 → 3.0.0（破坏性变更：>40KB 拒收、多 chunk 结构与 Step 11 移除）

## v2.5.0 (2026-08-25)

### 过程真实性防线 + 边界规则（harness-v2 事故复盘落地）

背景：harness-v2 翻译事故复盘。大文档加固类条目经评估否决（实测频率 1/8 + 用户判定大文档需求基本结束），仅保留跨规模的过程真实性类条目（最小集 S1-S5）。完整决策分析与回放细节见 git 历史 `docs/large-doc-autonomy-plan.md`（f898acb..4ee035a），勿据本条目重新论证。

- **Step 12 新增 `scripts/verify-pipeline.js` 过程真实性终检**：从文件系统事实核验流程（完备性矩阵 / 模板占位符 / 同维度查重 / 尺寸下限 / 批量写入签名 / 时序 / 机械校验落盘），产出任务报告 + `verify-report.json`，FAIL 阻断交付。对抗两类已实际发生的失败：harness-v2 式伪造（87 份字节级相同的空壳报告 + 假 PASS）与 abc-legal 式静默跳过。诚实边界：抓过程伪造，不判内容质量；agent 汇报不可信，用户可一条命令独立复核。
- **`verify-mechanical.js` 结果落盘**：CLI 运行结果追加 `verify-results.json`（translation 根目录），供终检交叉核验，杀"声称已跑"式伪证。
- **审校纪律新增合法降级路径（S4）**：API 限流/资源不足可整维度跳过、无需事前报备，但须 pm-review 合规表 `⏭️ SKIPPED(原因)` 披露 + 交付回复明示；未披露的缺失由终检判 FAIL。"偏离须报备"保留用于其他偏离（报备在两次事故中均为死条款，资源约束场景以标准披露替代）。
- **Step 1（S1/S2）**：目录碰撞规则改"相同原文→复用续跑"（修嵌套目录复发 bug，compaction-in-pi 7KB 单 chunk 亦复发过）；内容 >40KB 时入口提示"将走多 chunk 流程，建议分批或本机一次跑完，预计需人工监督"。
- **Step 2（S3）**：glossary 一条一译，禁止"译法A/译法B"双选条目，拿不定直接裁定并注明——修"裁决债务入库"（事故 glossary 含 5+ 条双选，各 chunk 各翻各的）。
- **Step 12 交付即止**：交付 `translated-{title}-zh.md` 后不自动运行下游 publish（harness-v2 曾因即兴执行 refined-stock 管线连败 4 次）。
- **回放验证**：harness-v2 → FAIL（占位符 61 处、字节级重复 13×+36×、可读性 37 份未披露全缺、pm-review 缺失全中）；abc-legal → FAIL（Step 9 未披露缺失被抓；Step 5-7 已披露跳过正确识别为 WARN）；compaction-in-pi → PASS（干净运行零误报）；verify-mechanical 落盘 → 终检消费链路验证通过。附带发现：loop-engineering 缺 analysis 文件（真实缺失，终判正确）。

## v2.4.1 (2026-07-07)

### 验证驱动的脚本校准（重译 evolve-the-harness 摘要后修正）

用修复后的 skill 重译 evolve-the-harness 12KB 摘要（详见 `refined-stock/evolve-the-harness/VERIFICATION.md`），真实数据暴露两处脚本校准问题：

- **`verify-mechanical.js` 注释密度：硬 FAIL → WARN**。粗计数无法区分金句原文括注（#2/#3）、引用 `（Lee et al., 2026）`、专名 `（Opus 4.8）` 与真正的词级 spam，对引用密集的译文误杀（27 > 10 打回干净译文）。改为 WARN——过注硬判交给语义层（Step 6 翻译腔检查）。SKILL.md Step 4.6 措辞同步：硬判项（代码/URL/SVG/keep-list/«»）不过即打回，密度仅 WARN。
- **`consistency-checklist.js` ① 去噪**：glossary 对 harness/scaffold/LLM/frontier 等本就「保留英文」，旧逻辑误报 `harness×28` 等噪声。改为只对「应译纯中文」的术语报裸英文残留（验证中只剩 agent/verifier，且都在金句/代码内，零真实不一致）。
- **`consistency-checklist.js` ③ 修正**：把「有序+无序列表并存」误报为混用。改为只查无序标记 `- * +` 混用。

### 验证结论

裸英文词级注释 spam ~12+ → 1；`«»` 残留 = 0；机械校验全过；译文流畅、金句与代码/专名正确保留。T1–T7 设计目标达成。density 改 WARN 是对原「density 超阈值打回」判据的有据偏离（更贴合「脚本管机械、审校管语义」）。

## v2.4.0 (2026-07-07)

### 注释体系重构：两阶段 + 机械校验（修复 evolve-harness 翻译暴露的设计问题）

修复清单（T1–T7 落地；T8 后续落地为 Step 12 PM 验收）施工完成后已删除。

- **Step 4 重写为阶段A（翻译 + 内联打标）**：加优先级序列「准确 > 流畅地道 > 必要注释；冲突时流畅优先于注释」；落地注释保留标准 #1–#4；术语/机械分流——机械类内联原样保留，判断类在译文中内联插入 `«english»` 标记（不直接加括注、不产出清单）。
- **Step 4.5 阶段B（注释把关）**：扫描残留 `«english»` 按 #1 裁定（保留→`中文（English）` / 删除→去标记）；句级 `**中文（English）**` 仅限 Step 3 精选清单（#2/#3）；#4 强调用加粗/短句不注释。
- **Step 3 收紧连字符词组**：仅 coined/专名式（`build-not-buy`、作专名的 `agent-based`）保留英文；普通复合形容词（`hand-built`、`long-context` 等）直接译中文。
- **新增 `scripts/verify-mechanical.js` + Step 4.6 强制关卡**：代码块/行内代码原文⊆译文（抓遗漏与误改）、SVG 字节一致、URL 原样、keep-list 未改写、`«»` 残留=0、`（英文）` 注释密度超阈值——任一不过打回，不得进质检。
- **Step 2 结构化 keep-list**：输出 `keep-list-{title}.json`（`keep` / `properNouns` / `abbreviations`），供 `verify-mechanical.js` 消费；并判定本文受众喂给翻译/阶段B。
- **新增 `scripts/consistency-checklist.js` + Step 11 全局一致性**：扫合并全文产出小清单（术语裸英文残留 / 注释密度离群 chunk / 格式一致性），决策 subagent 只读清单下结论——不读整篇（防 93KB 长文上下文溢出）。
- **审校纪律（Step 5/6/7/9 共用）**：标注独立执行、不可压缩（合并稀释 rigor）；限流改串行不合并；审校尽量与翻译不同模型，不可控时补"注释滥用对抗检查" pass；偏离流程须先告知用户。
- **translationese prompt 补"括号英文堆砌"**（头号毛病）：自包含删除规则——除 (a) 术语括注、(b) 加粗精选金句/修辞句外，其余括注必删。

## v2.3.6 (2026-06-18)

### inspector 清理

- 移除 `inspect()` 中重复的 5MB 检查：原代码用同一个 `diskSize` 在读取前后各查一次 `> MAX_FILE_SIZE_BYTES`，第二次永不成立。保留读取前的检查（防超限读入的正确守卫）。

## v2.3.5 (2026-06-18)

### terms.md 收录门槛

- **写入 SKILL.md 的 Corrections 节**（tracked）：明确收录标准——可验证误译 / 跨篇复现 / 非 LLM 已会；单篇金句、整句、代码标识符归入 per-article 的 `special-phrases-{title}.md`。
- **本地 terms.md 清理**：terms.md 为 gitignore 的本地运行态文件（提交 392339d 起 untrack），据上述标准移除 9 条违规条目（6 条整句/金句、2 条单篇代码标识符、1 条自述 LLM 能翻对），74 → 65 条。此清理仅作用于本地文件，不进版本库。

### doc_segmenter 去除 jschardet 依赖

- **假设 UTF-8**：移除 `jschardet` 与编码探测逻辑，inspector 直接按 UTF-8 解码（TextDecoder 自动剥离 BOM）。`fileEncoding` 保留为常量 `"utf-8"`，runner / parser / reporter / 测试无需改动。
- **零依赖**：package.json 移除 dependencies；无依赖后 bun 自动删除 bun.lock。107 个测试全部通过。

## v2.3.4 (2026-06-18)

### SKILL.md 精简

- **压缩 Steps 5/6/7 样板**：三段重复的「启用独立 subagent / 检查指令 / 输入 / 报告路径 / 处理规则」各压缩为一行。保留独立编号小标题与「一个独立 subagent」声明，确保模型仍按 5/6/7 分步串行执行，不合并为单步。

## v2.3.3 (2026-06-18)

### 清理死代码

- **删除 `scripts/doc_segmenter/__pycache__/`**：Python→TypeScript 迁移残留的字节码缓存（12 个 `.pyc`），对应 `.py` 源文件已不存在，已被 `.gitignore` 忽略（仅本地清理）。
- **删除 `references/markdown-format-checklist.md`**：v2.0.0 即计划删除（11/12 检查项 LLM 本就会），唯一有用的中英文空格规则已内联到 SKILL.md Step 4，且未被任何步骤引用。
- **修正 v2.3.1 条目**：过时的 Python 文件引用（`runner.py`/`generator.py`/`test_runner_shortcircuit.py`）更正为当前 TypeScript 文件。

## v2.3.2 (2026-05-22)

### 工作流统一

- **移除单/多 chunk 分支**：SKILL.md 不再区分单 chunk 和多 chunk 路径，下游统一按 chunk 遍历处理。
- **Steps 5-7 拆分**：审阅循环从合并的 "Steps 5-7" 拆为独立 Step 5/6/7，避免模型合并执行。
- **doc_segmenter README 更新**：短路行为描述对齐新的统一工作流。

### 版本号

2.3.1 → 2.3.2

## v2.3.1 (2026-05-20)

### doc_segmenter 短路优化

- **runner.ts**：文件大小 < max_size 时跳过 parse/split/merge 阶段，直接生成单 chunk 输出。输出格式与多 chunk 路径完全一致。
- **generator.ts**：`generate()` 方法新增 `max_size` 参数，progress.json 新增 `source_size_kb` 和 `threshold_kb` 字段。
- **runner-shortcircuit.test.ts**：新增单元测试，覆盖小文件单 chunk、大文件多 chunk、边界条件、progress.json 元数据、输出结构一致性。

## v1.0.0 → v2.0.0 Overview

| Dimension | v1.0.0 | v2.0.0 |
|-----------|--------|--------|
| Steps | 9 | 5 |
| Quality assurance | GAN adversarial review (3 places) | Generate-Evaluate Loop with structured scoring |
| Term system | Topic-based multi-file glossary (~860 entries) | Single `terms.md` (17 entries, LLM corrections only) |
| Default style | Literal (直译) | Free (意译) |
| User interaction | 7 confirmations mid-workflow | 2 (start exceptions + end summary) |
| Language | All Chinese | English |
| Evaluation | Unquantified, LLM self-judges | 5 dimensions (AC/FL/TM/FM/ST) with weights |
| Timeout control | None | timer.js global timeout |

**Step mapping:**

| v1.0.0 | v2.0.0 | Change |
|--------|--------|--------|
| Step 1 Get article | Step 1 Retrieve Article | Added 60-char title limit |
| Step 2 Topic analysis + Step 3 GAN review | Step 2 Load Corrections | Removed topic matching and review loop |
| Step 4 Ask translation style | Removed | Default Free, no prompt |
| Step 5 Glossary load + user confirm | Step 5 Terms Maintenance | Mid-workflow user confirm → end-of-workflow subagent auto-maintain |
| Step 6 Special phrases + Step 7 GAN review | Step 3 Special Phrases | Merged, removed GAN review |
| Step 8 Translate | Step 4 Translate | Added Generate-Evaluate Loop |
| Step 9 Validation + GAN review | Step 4 eval loop | Validation embedded in loop, no separate step |
| — | Evaluate prompts (new) | Structured scoring rubrics |
| — | word-counter / timer (new) | Word stats + timeout control |

## 2026-05-11

### Architecture

- **Glossary → Corrections → terms.md**: Restructured from topic-based multi-file glossary (~860 entries across 6 files) to a single `references/terms.md` (17 entries). Only includes terms where the LLM produces verifiable mistranslations, with a `Why` column explaining each entry.
- **Step 2 simplified**: Removed "Topic Analysis & Glossary (Generate-Evaluate Loop)". Now just loads terms.md and checks language — no topic matching, no evaluation loop, no user interaction.
- **New Step 5: Terms Maintenance**: After translation, a subagent compares original vs translation output to identify actual mistranslations (added to terms.md) and unnecessary entries (removed). Reported to user at the end.
- **Default style changed**: Free (意译) is now the default. Literal mode only used when user specifies. Style selection removed from workflow.
- **Workflow fully automated**: User interaction only at start (missing content / non-English warning) and end (results summary). All intermediate confirmations removed.

### SKILL.md

- Frontmatter `description` restructured for cleaner skill triggering
- Removed `Evaluate Once` dead code
- Step 1: Removed "ask user to confirm conversion", added title 60-char truncation limit
- Step 3: Fixed table header ambiguity (`Chinese Translation (English original)` → `Translation（附原文）`)
- Step 4: Fixed image text rule (now adds translator note instead of just "verify"), clarified `word_count` source, added Chinese-English spacing rule (moved from deleted checklist), restructured translation rules with Free as base case
- Step 4 YAML frontmatter: Removed `topic` field

### Evaluation Prompts

- **Scoring bands split**: 5-8 band split into separate 5-6 and 7-8 bands in both eval prompts, making score 8 achievable
- **Anti-Inflation adjusted**: Threshold from 7 to 6, score 8 redefined as "at most 1-2 very minor issues"
- **Terminology references**: All "Glossary" references renamed to "Corrections"

### Scripts

- **word-counter.js**: Rewritten from TypeScript compiled artifact to clean JavaScript. Fixed `countEnglishChars` comment (letters only, not letters+numbers+punctuation). Fixed reading time calculation (weighted sum instead of Math.max). Trimmed 100+ lines of dual-language comments.
- **timer.js**: `TEMP_DIR` changed from `process.cwd()` to `os.tmpdir()` to prevent cross-directory failures
- **timer.test.js**: Updated to match new TEMP_DIR, all 14 tests pass

### Deleted Files

- `references/evaluate-topic-prompt.md` — no longer needed (Step 2 no longer has evaluation loop)
- `references/markdown-format-checklist.md` — 11 of 12 checks were things LLM already knows; only useful rule (Chinese-English spacing) moved inline to SKILL.md Step 4
- `glossary/template.md` — superseded by `references/terms.md`
- `glossary/` directory — superseded by `references/terms.md`
- `corrections/` directory — intermediate step, consolidated into `references/`

### Other

- **README.md**: Rewritten to be concise
- **.gitignore**: Simplified
