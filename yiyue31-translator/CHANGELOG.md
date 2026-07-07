# Changelog

## v2.4.0 (2026-07-07)

### 注释体系重构：两阶段 + 机械校验（修复 evolve-harness 翻译暴露的设计问题）

修复清单见 `yiyue31-translator-fix-plan.md`（T1–T7 落地；T8 待用户决策）。

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
