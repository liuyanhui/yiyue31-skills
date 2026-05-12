---
name: yiyue31-translator
description: 当用户输入"翻译"，"translate"，"translate article"，"translate to Chinese"，"改成中文"，"convert to Chinese"等指令时启用。当用户提供url、文件路径、直接粘贴内容，并表达翻译意图时启用。
version: 2.2.0
author: Yiyue31
---

# Tech Article Translator Skill

## 功能描述

专业翻译工具，将英文文章翻译为中文。包含文章分析、术语表生成、翻译审阅、翻译腔检查和术语维护。

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

### Step 2: 文章分析 + 生成术语表

1. 提取标题、h2/h3 标题、技术关键词和核心概念。
2. 加载 `{skill-dir}/references/terms.md`，识别出现在本文中的术语。
3. **语言检查**：如果文章主要是中文或非英文，提醒用户此 skill 设计用于英译中。
4. 提取原文中的超链接。
5. **生成 per-article 术语表**：只列出 LLM 可能处理不一致的词——纠正类、上下文相关译法、需统一处理的专有名词。不列 LLM 本来就能翻对的常见词。格式：`| English Term | Translation | Context |`（Translation 列用 `[KEEP]` 表示保留英文）。
6. 保存分析到 `{title}/translation/analysis-{title}.md`，术语表到 `{title}/translation/glossary-{title}.md`。

分析文件包含：Basic Info（标题、语言、关键概念、terms.md 匹配数、glossary 条目数）、Heading Structure、Key Technical Vocabulary、Hyperlinks。

### Step 3: 特殊词句提取

**排除项**：跳过 terms.md 和 glossary 中已有的词汇。

**提取类别：**

1. **金句**：启发性、总结性、观点鲜明的句子。保留表现力，译文后附原文注释。
2. **连字符技术词组**：如 "agent-based"、"build-not-buy"。保留原文，附原文注释。
3. **俚语和习语**：如 "hit the ground running"。根据上下文译为自然中文，附原文注释。

**输出**：三个表格，列统一为 `| 原文位置 | 原文 | 中文翻译 | 亮点说明 |`。保存到 `{title}/translation/special-phrases-{title}.md`。

### Step 4: 翻译

启用 subagent 执行翻译任务。

**通用翻译规则：**

- **准确性优先**：事实、数据与逻辑必须与原文完全吻合。从读者的角度翻译。
- **术语规范**：使用标准译法；术语首次出现时在原文后添加中文注释（或术语表中对应的 Translation 列信息），用括号包围。如 `agent(智能体)`、`Prompt(提示词)`。
- **修辞处理**：隐喻、习语等修辞性表达，按实际意图翻译而非逐字直译。若源语言意在目标语言中内涵不同，替换为表意、情感效果一致的自然表达。
- **格式保留**：保留所有 Markdown 格式（标题、加粗、斜体、图片、链接、代码块）。
- **尊重原文**：保留原文含义与意图，不增删、不主观篡改。
- **译者注释**：针对目标读者因术语、文化差异、领域知识难以理解的内容，在其后立即加简洁注释（括号内），用通俗语言释义而非仅标英文原文。格式：`中文译文（English original，必要时添加说明）`。注释深度适配读者：普通读者注释更详细，专业读者可简化。仅必要时注释，避免过度标注浅显词汇。
- **特殊词句翻译规则**：对于金句、连字符词组、俚语和习语，按照特殊词句提取结果文件中的中文翻译列进行翻译。
- **金句、俚语和习语**：加粗展示，如：`**{金句}**`。
- **原文链接**：保留链接地址不变，翻译链接文本。例如：`[原文](https://example.com)` 翻译为 `[译文](https://example.com)`。
- **中英文间距**：中文与英文/数字之间加 1 个空格（如 `这是 English 文本`）。英文术语后紧跟 `(中文)` 时，术语与 `(` 之间保持空格（如 `Generator (生成器)`，不是 `Generator(生成器)`）。

**意译时的额外翻译规则（默认）：**

- **重意不重形**：翻译作者的核心表意，而非单纯逐字直译。若直译生硬、无法传递预期效果，可自由重构句式，用地道目标语言表达相同含义。
- **情感保真**：保留措辞的情感内涵，而非仅译字典释义。带有主观情感的词汇（如"令人警醒的"、"萦绕心头的"），需让目标语言读者产生相同感受。
- **表达流畅**：采用目标语言地道的语序与句式；源语句式在目标语言中不自然时，可自由拆分、重组句子。

**直译风格**（仅用户指定时）：跳过上述"意译时的额外翻译规则"。逐字翻译，保留原文句式结构。

**输入给 subagent**：原文、terms.md 匹配项、glossary、特殊词句表、翻译风格。

**文件保存**：`{title}/translation/translated-{title}-zh.md`

**字数统计**：运行 `node {skill-dir}/scripts/word-counter.js {title}/translation/translated-{title}-zh.md`，记录结果。

**YAML Frontmatter**：

```yaml
---
title: {翻译后的标题}
source_title: {原始英文标题}
source_url: {url 或空}
source_author: {author 或空}
translated_at: {日期}
translation_style: free 或 literal
language: English → Chinese
word_count: {word-counter 输出的总字数}
---
```

### Step 5: 翻译审阅

启用 subagent 审阅翻译结果。使用 `{skill-dir}/references/evaluate-translation-prompt.md` 作为审阅指令。

**输入给 subagent**：原文、译文、terms.md 匹配项、glossary、特殊词句表、翻译风格。

**审阅报告保存到**：`{title}/translation/review-translation-{title}.md`

**处理审阅结果**：

- 解析报告中的"必须修复"问题列表。
- 如果存在"必须修复"问题：提取问题和建议修复，应用到译文中。只修订一次。
- 如果没有"必须修复"问题：跳过修订，进入下一步。
- "建议优化"问题仅供参考，不触发修订。

### Step 6: 翻译腔检查

启用 subagent 检查译文中的翻译腔问题。使用 `{skill-dir}/references/evaluate-translationese-prompt.md` 作为检查指令。

**输入给 subagent**：原文、译文。

**检查报告保存到**：`{title}/translation/review-translationese-{title}.md`

**处理检查结果**：与 Step 5 相同。只修订"必须修复"问题。

### Step 7: 术语维护

启用 subagent 维护 terms.md。**输入**：原文、最终译文、当前 terms.md 内容。

**Subagent 任务：**

1. 对比原文和译文，找出 LLM **实际翻译错误**的英文术语（如 "agent" 被翻译为"代理"而非"智能体"）。添加到 terms.md。
2. 审查现有条目。如果 LLM 无需纠正项就能正确翻译，标记为建议移除。
3. 更新 terms.md：追加新条目，移除已标记的条目。
4. **添加标准**：仅添加有可验证误译证据的术语。**移除标准**：仅移除全文均正确翻译的术语。

**向用户展示**：

```markdown
## Translation Complete
**Source**: {原始标题} | **Style**: {Free 或 Literal} | **Corrections**: {N} loaded, {N} added | **File**: {title}/translation/translated-{title}-zh.md

## Terms Update
+ Added: {列表或 "none"} | - Removed: {列表或 "none"} | → terms.md now has {N} entries
```

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
