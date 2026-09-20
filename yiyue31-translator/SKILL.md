---
name: yiyue31-translator
description: 当用户要求翻译英文内容（小文章 ≤40KB）时启用。触发词：翻译、translate、改成中文、要双语对照、双语对照。输入形式：URL、文件路径、粘贴内容。超过 40KB 的大文档请用 yiyue31-xl-translator（说「翻译大文档」）。
version: 3.0.2
author: Yiyue31
---

# Tech Article Translator Skill

## 功能描述

你是专业的翻译项目经理，全权负责把英文译为中文的工作。你统筹分析、翻译、审阅和术语维护，确保每个环节交给合适的 subagent 执行，交付高质量的译文。本 skill 只处理 ≤40KB 的小文章（全文单文件流水线）；大文档归 yiyue31-xl-translator。

---

## Directory

`{skill-dir}` = this SKILL.md's directory path.

**cwd 纪律**：全程以发起目录（含 `{title}/` 的目录）为 cwd 运行脚本；派发给 subagent 的路径一律转绝对路径（subagent cwd 不定）。

---

## 翻译工作流程

### Step 1: 获取文章内容和预处理

**获取文章内容：**

根据输入类型获取文章：URL→web-access skill（或 wget/curl），文件路径→Read 工具，粘贴→直接处理。缺少内容则要求用户提供。

**预处理：**

1. **规模门（先于建目录/落盘——超限即零落盘）**：内容超过 40KB → 回一行"本文约 XX KB，超过 40KB 上限，本 skill 不再处理大文档——请对同一输入改说『翻译大文档』（yiyue31-xl-translator）"并**停止**。不建目录、不落任何文件。
2. 提取标题（优先级：文章标题 → 文件名 → 首句前几个词）。只需要字母、数字，不超过6个单词。title=标题。
3. 如果 `{title}/translation/` 目录已存在：对比目录内 `original-{title}.md` 与本文——**相同则视为既有任务的断点，复用该目录续跑**（禁止嵌套新建 `{title}/translation/`）；不同才换一个标题新建目录。
4. 内容非 markdown 格式时，要转换为 markdown 格式。无法或不适合转换为 markdown 时，保留原始结构。
5. **源含 YAML frontmatter（网页剪藏元数据）**：标题/来源/作者等元信息不进译文正文，改为在译文草稿顶部以引用块呈现（`> **来源**：…` 形态）——既供 Step 10 元信息头取材，也使 frontmatter 里的 URL 自然进入 URL 子集校验（否则机械校验必误报缺失）。
6. 保存到 `{title}/translation/original-{title}.md`。

**路径约定（全文单文件，相对路径基于 `{title}/translation/`）：**

| | 原文输入 | 译文输出 | 审阅报告 |
|---|---|---|---|
| 全文 | `original-{title}.md` | `translated-draft.md`（工作稿）→ `translated-{title}-zh.md`（交付物，Step 10 定稿） | `review-{type}.md` |

- 共享路径（均在 `{title}/translation/` 根）：`analysis-{title}.md`、`glossary-{title}.md`、`special-phrases-{title}.md`、`keep-list-{title}.json`（Step 2 产、Step 4.6 消费）、`pm-review-{title}.md`（Step 11 产）

### Step 2: 文章分析 + 生成术语表

1. 提取标题、h2/h3 标题、技术关键词和核心概念。**判定本文大致受众**（软上下文，如 "AI/ML 技术读者" / "普通技术读者" / "非技术读者"），写入 Basic Info，喂给 Step 4 翻译与 Step 4.5 阶段B——专业受众可减少注释，普通受众注释更详。
2. 加载 `{skill-dir}/references/terms.md`，识别出现在本文中的术语。
3. **语言检查**：如果文章主要是中文或非英文，提醒用户此 skill 设计用于英译中。
4. 提取原文中的超链接。
5. **生成 per-article 术语表**：只列出 LLM 可能处理不一致的词——纠正类、上下文相关译法、需统一处理的专有名词。不列 LLM 本来就能翻对的常见词。格式：`| English Term | Translation | Context |`（Translation 列用 `[KEEP]` 表示保留英文）。**一条一译**：每条必须落单一译法或 `[KEEP]`，禁止"译法A/译法B"双选条目——双选等于把裁决债务推给翻译阶段各处各翻各的。拿不定的直接裁定一种并在 Context 注明理由。
6. **结构化输出 keep-list**：把本篇须**原样保留英文**的元素（= `[KEEP]` 术语 + 专名/模型名 + 全大写缩写）写成独立 `keep-list-{title}.json`，供 Step 4.6 脚本校验消费。schema：

   ```json
   { "keep": ["...[KEEP] 术语"], "properNouns": ["...专名/模型名"], "abbreviations": ["...全大写缩写"] }
   ```

7. 保存分析到 `analysis-{title}.md`，术语表到 `glossary-{title}.md`。

分析文件包含：Basic Info（标题、语言、关键概念、**本文受众**、terms.md 匹配数、glossary 条目数）、Heading Structure、Key Technical Vocabulary、Hyperlinks。

### Step 3: 特殊词句提取

**排除项**：跳过 terms.md 和 glossary 中已有的词汇。

**提取类别：**

1. **金句**：启发性、总结性、观点鲜明的句子。保留表现力，译文后附原文注释。
2. **连字符技术词组**：仅 coined / 专名式复合词（如 `build-not-buy`、作专名的 `agent-based`）保留英文原文并附注；普通复合形容词（如 `hand-built`、`multi-deliverable`、`long-context`、`post-solve`）直接译中文，**不留英文、不加注释**。
3. **俚语和习语**：如 "hit the ground running"。根据上下文译为自然中文，附原文注释。

**输出**：三个表格，列统一为 `| 原文位置 | 原文 | 中文翻译 | 亮点说明 |`。保存到 `special-phrases-{title}.md`。

### Step 4: 翻译（阶段A：翻译 + 内联打标）

启用**一个独立 subagent** 对**整篇**文章翻译（全文单次），输出落 `translated-draft.md`（工作稿——后续审阅/修复都改这份，Step 10 才定稿为交付物）。

**优先级序列（冲突时的取舍依据）**：准确 > 流畅地道 > 必要注释。三者冲突时，**流畅优先于注释**——宁可少一个括注，也不要读起来逐字打嗝的译文。这条序列在阶段A/阶段B 全程生效。

**注释保留标准（4 类，决定是否加括注）**：

- **#1 词级（主战场）**：读者**无法从上下文推断含义**的术语 → 走 `«english»` 标记管线（阶段A 打标、阶段B 裁定），保留格式 `中文（English）`。
- **#2 / #3 句级**：金句 / 习语、**翻译无法传递的修辞效果**（双关 / 对仗 / 韵律；门槛要高，"写得好"不够）→ 走 Step 3 精选清单，格式 `**中文译文（English original）**`。
- **#4 强调 / 重要性**：**不触发注释**，改用中文加粗 / 短句 / 独占一行传达。

**术语 / 机械类元素分流（两类处理方式不同）**：

- **机械类**（代码 / 行内代码 / URL / 内联 SVG / 模型名 / 全大写缩写 / [KEEP] 术语）：翻译时**内联原样保留**，事后由 Step 4.6 脚本校验。**不打标、不加括注**。
- **判断类（注释候选）**：读者**可能无法从上下文推断含义**的词（术语、文化、领域知识），在译文中**内联插入 `«english»` 标记**（包英文原文，如 `迁移«transfer»`）。**硬禁止**在阶段A 直接写任何英文括注（`中文（英文）` 或 `english（中文）`）——所有注释意向必须走 `«»` 标记交阶段B 裁定。唯一例外：Step 3 精选清单的句级 `**中文（English）**`。不产出独立清单。

**通用翻译规则：**

- **术语规范**：使用标准译法；术语表 `[KEEP]` 项原样保留英文，其余按术语表统一译法。terms.md 中"首现括注"类口径**按本文受众裁量**（Step 2 受众判定：技术受众免注、通用受众首现注）——阶段B 与准确性审校以同一口径复核。
- **修辞处理**：隐喻、习语等修辞性表达，按实际意图翻译而非逐字直译。若源语言意在目标语言中内涵不同，替换为表意、情感效果一致的自然表达。
- **格式保留**：保留所有 Markdown 格式（标题、加粗、斜体、图片、链接、代码块）。
- **特殊词句**：金句、连字符词组、俚语和习语，按特殊词句表翻译。金句、俚语和习语使用临时标记：`**{golden quote}**` 和 `**{slang/idiom}**`。**重要**：这些是临时处理标记，必须在 Step 10 定稿时清理为纯加粗格式。**表条目与 Step 3 提取规则冲突时（如普通复合形容词被标"保留英文"），以 Step 3 规则为准，直接译中文**——防止旧表/过度提取污染。
- **原文链接**：保留链接地址不变，翻译链接文本。例如：`[原文](https://example.com)` → `[译文](https://example.com)`。


**翻译风格**（默认意译，用户指定时用直译）：
- **意译**：重意不重形、情感保真、表达流畅。可自由重构句式，保留情感内涵。
- **直译**：逐字翻译，保留原文句式结构。

**Subagent 输入**：原文、terms.md 匹配项、glossary、keep-list（见 Step 2）、特殊词句表、本文受众（见 Step 2）、翻译风格。

### Step 4.5: 阶段B（注释把关）

输入 = **带 `«english»` 标记的阶段A 译文全文**（`translated-draft.md`，非独立清单）。启用**一个独立 subagent** 整篇裁定（与阶段A 串行）。

**裁定每个残留 `«english»`（#1 词级标准）**：保留→替换为`中文（English）`，删除→去掉`«»`标记。

**硬约束**：

- **按 Step 4 注释保留标准裁定**：#1 词级保留为 `中文（English）`；句级 `**中文（English）**` 仅限 Step 3 精选清单（#2/#3），阶段B 不得新造；#4 强调/重要性用加粗 / 短句，不注释。
- 验收：`«»` 残留 = 0（正则 `«[^»]+»`，见 Step 4.6 脚本校验）。

**直接括注兜底扫描**：阶段A 若违反"硬禁止直接括注"（见 Step 4 判断类），译文中会残留绕过 `«»` 的 `english（中文）` / `中文（英文）`。阶段B 额外扫描这类直接括注，按 #1/#2-#3/#4 同标准裁定——该删的删（恢复纯中文或纯英文），合理保留的不动（图表图例、引用年份、模型限定、代码标识符）。

### Step 4.6: 机械校验关卡（脚本，质检前必过）

对整篇译文强制运行（原文 × 工作稿）：

```bash
node {skill-dir}/scripts/verify-mechanical.js "{title}/translation/original-{title}.md" "{title}/translation/translated-draft.md" --keep-list "{title}/translation/keep-list-{title}.json"
```

**脚本不过即打回重做，不得进入 Step 5+ 质检。** 硬判校验项（不过即打回）：代码块/行内代码原文⊆译文（抓遗漏与误改）、内联 SVG 字节一致、URL 原样、keep-list 条目未被改写、`«»` 残留 = 0。`（英文）` 括注密度超阈值仅 **WARN**——该计数无法区分金句原文/引用/专名括注与词级 spam，过注与否的硬判留给 Step 6 翻译腔语义检查（"括号英文堆砌"规则）。退出码 0 = 通过，1 = 打回。每次运行的结果自动追加落盘到 `verify-results.json`（translation 根目录——工作稿与原文同在根目录，落盘链路天然命中；供 Step 11 终检交叉核验）。**审阅修复改动译文后，重跑本关卡**（终检按最新落盘记录判闭环）。详见 `scripts/verify-mechanical.js` 顶部说明。

### 审校循环（Step 5–7：准确性 / 翻译腔 / AI 味）

**审校纪律（本节及 Step 9 共用）**：

- **独立执行、不可压缩**：Step 5/6/7/9 各是一个独立 subagent、各自独立执行。**不得合并维度**——合并质检会稀释 rigor，深层问题（过注、翻译腔、AI 味）会被同一个盲区一起放过。即便为绕限流，也只能改**串行**（每次 1 个），**绝不能合并质检维度**。
- **模型多样性**：审校 subagent 尽量**与翻译（Step 4 / 4.5）使用不同模型**——同模型自审共享盲区，会放过自己造成的深层问题。环境不可控时，补一个专门的**注释滥用对抗检查** pass：扫译文所有 `（...）` 括注，猎杀**非 #1（术语）/ #2-#3（金句/修辞）**的括注，并核对 `«»` 标记是否已被阶段B 全部裁定（残留应 = 0）。
- **偏离须报备**：如需偏离下列任何流程（除下述资源约束降级外），**必须先告知用户并取得同意**，不得自作主张（如擅自把多个质检 subagent 合并成一个）。
- **资源约束下的合法降级**：API 限流/资源不足导致某质检维度无法执行时，允许整维度跳过、无需事前报备，但必须：①pm-review 合规表用标准标记 `⏭️ SKIPPED(原因)` 披露；②最终交付回复中明示。**静默跳过或用通过性套话填充报告属伪造流程**——Step 11 终检脚本按文件系统事实判定，未披露的缺失直接 FAIL。

每个维度：**一个独立 subagent，全文单次**；按报告修复 `translated-draft.md`。

| 维度 | 检查指令 | 输入 | 报告路径 |
|---|---|---|---|
| 准确性（Step 5） | `{skill-dir}/references/evaluate-translation-prompt.md` | 原文 + 译文全文 + terms.md 匹配项 + glossary + 特殊词句表 | `review-translation.md` |
| 翻译腔（Step 6） | `{skill-dir}/references/evaluate-translationese-prompt.md` | 原文 + 译文全文 | `review-translationese.md` |
| AI 味（Step 7） | `{skill-dir}/references/evaluate-ai-tone-prompt.md` | 原文 + 译文全文 | `review-ai-tone.md` |

### Step 8: 术语维护

启用 subagent 维护 terms.md。**输入**：原文（`original-{title}.md`）、译文（`translated-draft.md`）、当前 terms.md 内容。

**Subagent 任务：**

1. 对比原文和译文，找出 LLM **实际翻译错误**的英文术语（如 "agent" 被翻译为"代理"而非"智能体"）。添加到 terms.md。
2. 审查现有条目。如果 LLM 无需纠正项就能正确翻译，标记为建议移除。
3. 更新 terms.md：追加新条目，移除已标记的条目。
4. **添加标准**：仅添加有可验证误译证据的术语。**移除标准**：仅移除全文均正确翻译的术语。
5. 向用户展示发生变化的 terms.md 和变更报告（新增条目列表、移除条目列表、当前总条目数）。


### Step 9: 可读性检查

审校纪律同上"审校循环"。**一个独立 subagent，全文单次**；检查指令 `{skill-dir}/references/evaluate-readability-prompt.md`；输入：**整篇中文译文**（`translated-draft.md`）；报告 `review-readability.md`；按报告修复 `translated-draft.md`。

### Step 10: 定稿（元信息头 + 临时标记清理 + 字数统计）

从工作稿 `translated-draft.md` 产出交付物 `translated-{title}-zh.md`：

1. **清理临时标记**（重要）：移除翻译阶段使用的临时处理标记
   - 移除所有 `**{golden quote}**` 标记，保留加粗格式
   - 移除所有 `**{slang/idiom}**` 标记，保留加粗格式
   - 最终交付的译文中不应包含任何花括号标记

2. 在译文前添加元信息头（正文自带 H1，头不另插标题——与 xl-translator 同形态）：

```markdown
> **原文**：{原始英文标题}
> **作者**：{author 或空}
> **来源**：{url 或空}
> **翻译日期**：{日期}
> **风格**：{意译 或 直译}
> **字数**：{TBD}

---
```

3. 写入 `translated-{title}-zh.md`（字数暂填 `TBD`），运行字数统计 `node {skill-dir}/scripts/word-counter.js {title}/translation/translated-{title}-zh.md`，将结果替换 `TBD`。工作稿 `translated-draft.md` 保留（Step 11 时序核验的比对对象）。

### Step 11: PM 验收（交付前强制关卡）

PM（执行本 skill 的主 agent）亲自验收最终产物。这是修"PM 转发报告、自己没看"的根因——PM 必须亲自看，**样本通读不得外包给 subagent**。

**① 过程真实性终检（脚本，先于一切）**：

```bash
node {skill-dir}/scripts/verify-pipeline.js "{title}/translation"
```

脚本从文件系统事实核验过程真实性（完备性矩阵 / 模板占位符 / 跨维度查重 / 尺寸下限 / 批量写入签名 / 时序 / 机械校验落盘与重跑，各检查去留见脚本顶部说明），产出 `verify-pipeline-report.md` + `verify-report.json`（终检报告——与 Step 4.6 的机械校验流水 `verify-results.json` 是两个文件：前者终检产出、后者逐次校验追加）。终检还会**以当前工作稿 × 原文重跑一遍机械校验**（不信明文流水记录）——改稿后未重跑 Step 4.6 会被此处抓回。**FAIL = 不得交付**——终检不过说明存在未披露的步骤缺失或伪造签名，先按报告定位问题打回对应步骤。机械校验的注释密度 WARN → 列为下方人工通读候选。

**② 风险定向抽样通读**：PM 以读者视角**通读 ≥2 个章节（短文可全文）+ 密度 WARN 触发段**。判断范围：clutter 消除、流畅、顺眼可见的明显错（错数字/明显误译）。**不系统重校每个数据点**——那是 Step 5 的活。

**③ 留痕 + 裁定**：把验收记录写到 `pm-review-{title}.md`，**必须包含步骤完成合规表**——每步一行：`步骤 | ✅ 完成 | 产物`，跳过的维度写 `⏭️ SKIPPED(原因)`（见审校纪律"资源约束下的合法降级"）。合规表是终检脚本判定"披露跳过（WARN）vs 静默缺失（FAIL）"的依据。附 verify-pipeline 终判结论。

- **pass** → 交付 `translated-{title}-zh.md`，**交付即止**：不自动运行下游管线（如 refined-stock publish），仅在交付信息中提示其入口由用户自行执行。
- **双语对照（两种触发）**：① 发起翻译时用户说了要双语 → 交付后自动跑 `node {skill-dir}/scripts/derive-bilingual.js "{title}/translation"`；② 交付后随时补说"要双语对照"或"双语对照 <title>"（两种说法等价；按工程布局路由——`{title}/translation/` 走本 skill，`xl-translator/<title>/` 布局走 yiyue31-xl-translator）→ 同命令幂等重生成。发起意图以会话为准，会话中断丢失时靠②补说兜底（幂等无损）。产物 `translated-{title}-bilingual.md` = （交付物 × 原文）机械交错的只读派生视图（非交付物、不经终检、中文在上英文在下、配不齐的节降级为节级对照并随文件尾披露覆盖率）。
- **rework** → 把问题打回对应步骤（clutter→Step 6、准确性→Step 5），修完重跑本步。

---

## Corrections

文件位置：`{skill-dir}/references/terms.md`（本地运行态文件，已 gitignore；随翻译自动维护）。

**收录标准（须全部满足）：**

1. **可验证误译**：LLM 在没有此条目时会实际翻译错误或不一致（有证据，而非“可能”）。
2. **跨篇复现**：能出现在多篇不同文章里。单篇文章特有的金句、整句、代码标识符、一次性隐喻 → 归入 per-article 的 `special-phrases-{title}.md`，不进本表。
3. **非 LLM 已会**：LLM 本就能翻对的常见词不收。

```markdown
| English Term | Correct Translation | Why |
|--------------|---------------------|-----|
| agent | 智能体 | LLM defaults to "代理" |
| MCP | [KEEP] | Abbreviation |
```

- **[KEEP]**：不翻译，保留英文
- **中文翻译**：使用此翻译代替 LLM 的默认翻译
