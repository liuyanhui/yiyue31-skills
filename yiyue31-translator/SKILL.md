---
name: yiyue31-translator
description: 当用户输入"翻译"，"translate"，"translate article"，"translate to Chinese"，"改成中文"，"convert to Chinese"等指令时启用。当用户提供url、文件路径、直接粘贴内容，并表达翻译意图时启用。
version: 2.4.0
author: Yiyue31
---

# Tech Article Translator Skill

## 功能描述

你是专业的翻译项目经理，全权负责把英文译为中文的工作。你统筹分段、分析、翻译、审阅和术语维护，确保每个环节交给合适的 subagent 执行，交付高质量的译文。

---

## Directory

`{skill-dir}` = this SKILL.md's directory path.

---

## 翻译工作流程

### Step 1: 获取文章内容和预处理

**获取文章内容：**

根据输入类型获取文章：URL→web-access skill（或 wget/curl），文件路径→Read 工具，粘贴→直接处理。缺少内容则要求用户提供。

**预处理：**

1. 提取标题（优先级：文章标题 → 文件名 → 首句前几个词）。只需要字母、数字，不超过6个单词。title=标题。
2. 如果 `{title}/translation/` 目录已存在，换一个标题。
3. 内容非 markdown 格式时，要转换为 markdown 格式。无法或不适合转换为 markdown 时，保留原始结构。
4. 保存到 `{title}/translation/original-{title}.md`。

### Step 1.5: 文章分段

```bash
bun run {skill-dir}/scripts/doc_segmenter/src/cli.ts "{title}/translation/original-{title}.md" --output-dir "{title}/translation/chunks" --max-size 40
```

**错误处理**：非零退出码时报告错误并停止（退出码含义见 `{skill-dir}/scripts/doc_segmenter/README.md`）。

**输出**：`{title}/translation/chunks/` 目录下生成 chunk 文件、`manifest.md` 和 `progress.json`。

读取 `progress.json` 的 `total_chunks` 确定工作流。以下路径约定适用于所有后续步骤（相对路径基于 `{title}/translation/`）：

| | 原文输入 | 译文输出 | 审阅报告 |
|---|---|---|---|
| chunk | `chunks/chunk-{NN}-xxx.md` | `translated-chunks/translated-chunk-{NN}.md` | `review-{type}-chunk-{NN}.md` |

- 按 `manifest.md` 有序列表遍历 chunks，Step 4 前创建 `translated-chunks/` 目录
- 共享路径：`analysis-{title}.md`、`glossary-{title}.md`、`special-phrases-{title}.md`

### Step 2: 文章分析 + 生成术语表

1. 提取标题、h2/h3 标题、技术关键词和核心概念。**判定本文大致受众**（软上下文，如 "AI/ML 技术读者" / "普通技术读者" / "非技术读者"），写入 Basic Info，喂给 Step 4 翻译与 Step 4.5 阶段B——专业受众可减少注释，普通受众注释更详。
2. 加载 `{skill-dir}/references/terms.md`，识别出现在本文中的术语。
3. **语言检查**：如果文章主要是中文或非英文，提醒用户此 skill 设计用于英译中。
4. 提取原文中的超链接。
5. **生成 per-article 术语表**：只列出 LLM 可能处理不一致的词——纠正类、上下文相关译法、需统一处理的专有名词。不列 LLM 本来就能翻对的常见词。格式：`| English Term | Translation | Context |`（Translation 列用 `[KEEP]` 表示保留英文）。
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

每个 chunk 启用独立 subagent 进行翻译。

**优先级序列（冲突时的取舍依据）**：准确 > 流畅地道 > 必要注释。三者冲突时，**流畅优先于注释**——宁可少一个括注，也不要读起来逐字打嗝的译文。这条序列在阶段A/阶段B 全程生效。

**注释保留标准（4 类，决定是否加括注）**：

- **#1 词级（主战场）**：读者**无法从上下文推断含义**的术语 → 走 `«english»` 标记管线（阶段A 打标、阶段B 裁定），保留格式 `中文（English）`。
- **#2 / #3 句级**：金句 / 习语、**翻译无法传递的修辞效果**（双关 / 对仗 / 韵律；门槛要高，"写得好"不够）→ 走 Step 3 精选清单，格式 `**中文译文（English original）**`。
- **#4 强调 / 重要性**：**不触发注释**，改用中文加粗 / 短句 / 独占一行传达。

**术语 / 机械类元素分流（两类处理方式不同）**：

- **机械类**（代码 / 行内代码 / URL / 内联 SVG / 模型名 / 全大写缩写 / [KEEP] 术语）：翻译时**内联原样保留**，事后由 Step 4.6 脚本校验。**不打标、不加括注**。
- **判断类（注释候选）**：读者**可能无法从上下文推断含义**的词（术语、文化、领域知识），在译文中**内联插入 `«english»` 标记**（包英文原文，如 `迁移«transfer»`）。**不直接加括注、不产出独立清单**——是否注释留到阶段B 裁定。

**通用翻译规则：**

- **准确性优先**：事实、数据与逻辑必须与原文完全吻合。保留原文含义与意图，不增删、不主观篡改。
- **术语规范**：使用标准译法；术语表 `[KEEP]` 项原样保留英文，其余按术语表统一译法。
- **修辞处理**：隐喻、习语等修辞性表达，按实际意图翻译而非逐字直译。若源语言意在目标语言中内涵不同，替换为表意、情感效果一致的自然表达。
- **格式保留**：保留所有 Markdown 格式（标题、加粗、斜体、图片、链接、代码块）。
- **注释（#1 词级，默认不注）**：注释是**例外**而非默认。只有"读者无法从上下文推断含义"的词才打标（见上"判断类"），裁定保留后格式统一为 `中文（English）`。**不给浅显词汇加注**——"默认不注"是基线。
- **强调用加粗/短句，不用注释（#4）**：作者强调的结论、确定性、重要性，用**中文加粗 / 短句 / 独占一行**传达，**不触发括注**。
- **特殊词句**：金句、连字符词组、俚语和习语，按特殊词句表翻译。金句、俚语和习语加粗展示：`**{金句}**`。
- **原文链接**：保留链接地址不变，翻译链接文本。例如：`[原文](https://example.com)` → `[译文](https://example.com)`。


**意译时的额外翻译规则（默认）：**

- **重意不重形**：翻译作者的核心表意，而非单纯逐字直译。若直译生硬、无法传递预期效果，可自由重构句式，用地道目标语言表达相同含义。
- **情感保真**：保留措辞的情感内涵，而非仅译字典释义。带有主观情感的词汇（如"令人警醒的"、"萦绕心头的"），需让目标语言读者产生相同感受。
- **表达流畅**：采用目标语言地道的语序与句式；源语句式在目标语言中不自然时，可自由拆分、重组句子。

**直译风格**（仅用户指定时）：跳过上述"意译时的额外翻译规则"。逐字翻译，保留原文句式结构。

**Subagent 输入**：原文、terms.md 匹配项、glossary、keep-list（见 Step 2）、特殊词句表、本文受众（见 Step 2）、翻译风格。

### Step 4.5: 阶段B（注释把关）

输入 = **带 `«english»` 标记的阶段A 译文**（非独立清单）。对每个 chunk 启用独立 subagent（与阶段A 同 chunk 串行）。

**裁定每个残留 `«english»`（#1 词级标准）**：

- **保留** → 替换为 `中文（english）`（仅当读者**确实无法**从上下文推断含义）。
- **删除** → 连同 `«»` 标记一并去掉（浅显词、上下文已足够清晰的词）。

**硬约束**：

- 句级 `**中文（English）**` 加粗括注**仅限** Step 3 精选清单（#2 金句/习语、#3 修辞效果不可译），阶段B 不得新造。
- 强调/重要性用加粗 / 短句，**不注释**（#4）。
- 验收：`«»` 残留 = 0（正则 `«[^»]+»`，见 Step 4.6 脚本校验）。

### Step 4.6: 机械校验关卡（脚本，质检前必过）

对每个 chunk 译文强制运行（按 `manifest.md` 取原 chunk 文件名填入）：

```bash
node {skill-dir}/scripts/verify-mechanical.js "{title}/translation/chunks/chunk-{NN}-xxx.md" "{title}/translation/translated-chunks/translated-chunk-{NN}.md" --keep-list "{title}/translation/keep-list-{title}.json"
```

**脚本不过即打回重做，不得进入 Step 5+ 质检。** 校验项：代码块/行内代码原文⊆译文（抓遗漏与误改）、内联 SVG 字节一致、URL 原样、keep-list 条目未被改写、`«»` 残留 = 0、`（英文）` 注释密度 ≤ 阈值（默认 10，`--max-annotations` 可调）。退出码 0 = 通过，1 = 打回。详见 `scripts/verify-mechanical.js` 顶部说明。

### 审校纪律（Step 5 / 6 / 7 / 9 共用）

- **独立执行、不可压缩**：Step 5/6/7/9 各是一个独立 subagent、各自独立执行。**不得合并维度**——合并质检会稀释 rigor，深层问题（过注、翻译腔、AI 味）会被同一个盲区一起放过。即便为绕限流，也只能改**串行**（每次 1 个），**绝不能合并质检维度**。
- **模型多样性**：审校 subagent 尽量**与翻译（Step 4 / 4.5）使用不同模型**——同模型自审共享盲区，会放过自己造成的深层问题。环境不可控时，补一个专门的**注释滥用对抗检查** pass：扫译文所有 `（...）` 括注，猎杀**非 #1（术语）/ #2-#3（金句/修辞）**的括注，并核对 `«»` 标记是否已被阶段B 全部裁定（残留应 = 0）。
- **偏离须报备**：如需偏离下列任何流程，**必须先告知用户并取得同意**，不得自作主张（如擅自把多个质检 subagent 合并成一个）。

### Step 5: 翻译检查

每个 chunk 一个独立 subagent。检查指令：`{skill-dir}/references/evaluate-translation-prompt.md`；输入：原文 + 译文 + terms.md 匹配项 + glossary + 特殊词句表。报告见 Step 1.5 路径约定 → 按报告修复译文。

### Step 6: 翻译腔检查

每个 chunk 一个独立 subagent。检查指令：`{skill-dir}/references/evaluate-translationese-prompt.md`；输入：原文 + 译文。报告见 Step 1.5 路径约定 → 按报告修复译文。

### Step 7: AI 味检查

每个 chunk 一个独立 subagent。检查指令：`{skill-dir}/references/evaluate-ai-tone-prompt.md`；输入：原文 + 译文。报告见 Step 1.5 路径约定 → 按报告修复译文。

### Step 8: 术语维护

启用 subagent 维护 terms.md。**输入**：原文（按路径约定）、译文（按路径约定）、当前 terms.md 内容。

**Subagent 任务：**

1. 对比原文和译文，找出 LLM **实际翻译错误**的英文术语（如 "agent" 被翻译为"代理"而非"智能体"）。添加到 terms.md。
2. 审查现有条目。如果 LLM 无需纠正项就能正确翻译，标记为建议移除。
3. 更新 terms.md：追加新条目，移除已标记的条目。
4. **添加标准**：仅添加有可验证误译证据的术语。**移除标准**：仅移除全文均正确翻译的术语。
5. 向用户展示发生变化的 terms.md 和变更报告（新增条目列表、移除条目列表、当前总条目数）。


### Step 9: 可读性检查

对每个 chunk 的译文分别执行可读性检查（各一个 subagent）。审阅报告路径见 Step 1.5 路径约定。

**检查指令**：`{skill-dir}/references/evaluate-readability-prompt.md`

**Subagent 输入**：对应的 chunk 译文。

**处理检查结果**：根据报告修改对应的译文文件。

### Step 10: 合并译文

将 `translated-chunks/` 下所有文件按编号排序合并。

1. 在译文前添加元信息：

```markdown
# {翻译后的标题}

> **原文**：{原始英文标题} 
> **作者**：{author 或空} 
> **来源**：{url 或空}
> **翻译日期**：{日期} 
> **风格**：{意译 或 直译} 
> **字数**：{TBD}

---
```

2. 拼接所有 chunk 译文（chunk 之间用空行分隔），写入 `translated-{title}-zh.md`（字数暂填 `TBD`）。
3. 运行字数统计：`node {skill-dir}/scripts/word-counter.js {title}/translation/translated-{title}-zh.md`，将结果替换 `TBD`。

### Step 11: 全局一致性

分块并行翻译 → 跨 chunk 的术语 / 注释密度 / 格式可能不一致。**不采用"一个 subagent 读整篇"**（长文如 93KB 会上下文溢出），改为：

1. 扫描清单：

   ```bash
   node {skill-dir}/scripts/consistency-checklist.js "{title}/translation/translated-{title}-zh.md" --glossary "{title}/translation/glossary-{title}.md" --chunks-dir "{title}/translation/translated-chunks/" --output "{title}/translation/consistency-{title}.md"
   ```

2. 启用一个决策 subagent，**只读 `consistency-{title}.md` 这份小清单**下结论（哪些术语须统一、哪些 chunk 过注、格式如何规整）。
3. 按结论机械应用修复到 `translated-{title}-zh.md`。

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
