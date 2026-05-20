---
name: yiyue31-translator
description: 当用户输入"翻译"，"translate"，"translate article"，"translate to Chinese"，"改成中文"，"convert to Chinese"等指令时启用。当用户提供url、文件路径、直接粘贴内容，并表达翻译意图时启用。
version: 2.3.1
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

### Step 1: 获取文章内容

根据输入类型获取文章：URL→web-access skill（或 wget/curl），文件路径→Read 工具，粘贴→直接处理。缺少内容则要求用户提供。

**处理：**

1. 提取标题（优先级：文章标题 → 文件名 → 首句前几个词 → `untitled-{timestamp}`）。去除文件系统不安全字符（`/ \ : * ? " < > |`）。超过 60 字符则截断。文件命名：小写字母，连字符连接。
2. 如果 `{title}/translation/` 目录已存在，删除。非 markdown 格式时转换并保留结构。
3. 保存到 `{title}/translation/original-{title}.md`。

### Step 1.5: 文章分段

**前置检查**：如果首次运行，先安装依赖：
```bash
pip install -r {skill-dir}/scripts/doc_segmenter/requirements.txt
```

运行 doc_segmenter：

```bash
PYTHONPATH="{skill-dir}/scripts" python -m doc_segmenter "{title}/translation/original-{title}.md" --output-dir "{title}/translation/chunks" --max-size 40
```

**错误处理**：非零退出码时报告错误并停止（退出码含义见 `{skill-dir}/scripts/doc_segmenter/README.md`）。

**输出**：`{title}/translation/chunks/` 目录下生成 chunk 文件、`manifest.md` 和 `progress.json`。

读取 `progress.json` 的 `total_chunks` 确定工作流。以下约定适用于所有后续步骤（相对路径基于 `{title}/translation/`）：

| | 原文输入 | 译文输出 | 审阅报告 |
|---|---|---|---|
| 单 chunk（`total_chunks == 1`） | `original-{title}.md` | `translated-{title}-zh.md` | `review-{type}.md` |
| 多 chunk（`total_chunks > 1`） | `chunks/chunk-{NN}-xxx.md` | `translated-chunks/translated-chunk-{NN}.md` | `review-{type}-chunk-{NN}.md` |

- 多 chunk 按 `manifest.md` 有序列表遍历，Step 4 前创建 `translated-chunks/` 目录
- 两种路径共享：`analysis-{title}.md`、`glossary-{title}.md`、`special-phrases-{title}.md`

### Step 2: 文章分析 + 生成术语表

1. 提取标题、h2/h3 标题、技术关键词和核心概念。
2. 加载 `{skill-dir}/references/terms.md`，识别出现在本文中的术语。
3. **语言检查**：如果文章主要是中文或非英文，提醒用户此 skill 设计用于英译中。
4. 提取原文中的超链接。
5. **生成 per-article 术语表**：只列出 LLM 可能处理不一致的词——纠正类、上下文相关译法、需统一处理的专有名词。不列 LLM 本来就能翻对的常见词。格式：`| English Term | Translation | Context |`（Translation 列用 `[KEEP]` 表示保留英文）。
6. 保存分析到 `analysis-{title}.md`，术语表到 `glossary-{title}.md`。

分析文件包含：Basic Info（标题、语言、关键概念、terms.md 匹配数、glossary 条目数）、Heading Structure、Key Technical Vocabulary、Hyperlinks。

### Step 3: 特殊词句提取

**排除项**：跳过 terms.md 和 glossary 中已有的词汇。

**提取类别：**

1. **金句**：启发性、总结性、观点鲜明的句子。保留表现力，译文后附原文注释。
2. **连字符技术词组**：如 "agent-based"、"build-not-buy"。保留原文，附原文注释。
3. **俚语和习语**：如 "hit the ground running"。根据上下文译为自然中文，附原文注释。

**输出**：三个表格，列统一为 `| 原文位置 | 原文 | 中文翻译 | 亮点说明 |`。保存到 `special-phrases-{title}.md`。

### Step 4: 翻译

多 chunk 时每个 chunk 启用独立 subagent；单 chunk 时一个 subagent 翻译全文。

**通用翻译规则：**

- **准确性优先**：事实、数据与逻辑必须与原文完全吻合。保留原文含义与意图，不增删、不主观篡改。
- **术语规范**：使用标准译法；术语首次出现时在原文后添加中文注释（或术语表中对应的 Translation 列信息），用括号包围。如 `agent(智能体)`、`Prompt(提示词)`。
- **修辞处理**：隐喻、习语等修辞性表达，按实际意图翻译而非逐字直译。若源语言意在目标语言中内涵不同，替换为表意、情感效果一致的自然表达。
- **格式保留**：保留所有 Markdown 格式（标题、加粗、斜体、图片、链接、代码块）。
- **译者注释**：针对目标读者因术语、文化差异、领域知识难以理解的内容，在其后立即加简洁注释（括号内），用通俗语言释义而非仅标英文原文。格式：`中文译文（English original，必要时添加说明）`。注释深度适配读者：普通读者注释更详细，专业读者可简化。仅必要时注释，避免过度标注浅显词汇。
- **特殊词句**：金句、连字符词组、俚语和习语，按特殊词句表翻译。金句、俚语和习语加粗展示：`**{金句}**`。
- **原文链接**：保留链接地址不变，翻译链接文本。例如：`[原文](https://example.com)` → `[译文](https://example.com)`。


**意译时的额外翻译规则（默认）：**

- **重意不重形**：翻译作者的核心表意，而非单纯逐字直译。若直译生硬、无法传递预期效果，可自由重构句式，用地道目标语言表达相同含义。
- **情感保真**：保留措辞的情感内涵，而非仅译字典释义。带有主观情感的词汇（如"令人警醒的"、"萦绕心头的"），需让目标语言读者产生相同感受。
- **表达流畅**：采用目标语言地道的语序与句式；源语句式在目标语言中不自然时，可自由拆分、重组句子。

**直译风格**（仅用户指定时）：跳过上述"意译时的额外翻译规则"。逐字翻译，保留原文句式结构。

**Subagent 输入**：原文、terms.md 匹配项、glossary、特殊词句表、翻译风格。

### Steps 5-7: 审阅循环（翻译审阅 → 翻译腔 → AI 味）

多 chunk 时每个 chunk 依次执行三种检查（各一个 subagent）；单 chunk 时对完整译文各一个 subagent。审阅报告路径见 Step 1.5 路径约定。

| 检查 | Prompt | Subagent 输入 |
|------|--------|---------------|
| 翻译检查 | `{skill-dir}/references/evaluate-translation-prompt.md` | 原文 + 译文 + terms.md 匹配项 + glossary + 特殊词句表 |
| 翻译腔检查 | `{skill-dir}/references/evaluate-translationese-prompt.md` | 原文 + 译文 |
| AI 味检查 | `{skill-dir}/references/evaluate-ai-tone-prompt.md` | 原文 + 译文 |

报告保存到 `{title}/translation/`。

**处理规则**：根据 subagent 审阅报告的结果，修复对应的译文。

### Step 8: 术语维护

启用 subagent 维护 terms.md。**输入**：原文（按路径约定）、译文（按路径约定）、当前 terms.md 内容。

**Subagent 任务：**

1. 对比原文和译文，找出 LLM **实际翻译错误**的英文术语（如 "agent" 被翻译为"代理"而非"智能体"）。添加到 terms.md。
2. 审查现有条目。如果 LLM 无需纠正项就能正确翻译，标记为建议移除。
3. 更新 terms.md：追加新条目，移除已标记的条目。
4. **添加标准**：仅添加有可验证误译证据的术语。**移除标准**：仅移除全文均正确翻译的术语。
5. 向用户展示发生变化的 terms.md 和变更报告（新增条目列表、移除条目列表、当前总条目数）。


### Step 9: 可读性检查

多 chunk 时对每个 chunk 的译文分别执行可读性检查（各一个 subagent）；单 chunk 时对完整译文一个 subagent。审阅报告路径见 Step 1.5 路径约定。

**检查指令**：`{skill-dir}/references/evaluate-readability-prompt.md`

**Subagent 输入**：对应的 chunk 译文（多 chunk）或完整译文（单 chunk）。

**处理检查结果**：根据报告修改对应的译文文件。

### Step 10: 合并译文

多 chunk 路径：将 `translated-chunks/` 下所有文件按编号排序合并。单 chunk 路径：译文已就位，跳过合并。

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

---

## Corrections

文件位置：`{skill-dir}/references/terms.md`

仅包含 LLM 在没有此条目的情况下会翻译错误或不一致的术语。

```markdown
| English Term | Correct Translation | Why |
|--------------|---------------------|-----|
| agent | 智能体 | LLM defaults to "代理" |
| MCP | [KEEP] | Abbreviation |
```

- **[KEEP]**：不翻译，保留英文
- **中文翻译**：使用此翻译代替 LLM 的默认翻译
