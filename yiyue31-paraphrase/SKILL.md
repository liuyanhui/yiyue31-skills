---
name: yiyue31-paraphrase
description: 当用户要求把英文文章或新闻改写 / 转述为面向大众读者、可理解的精简地道中文（博客 / 公众号发布）时启用。触发："把这篇改写成中文"、"转述这篇文章"、"paraphrase this article"、"用中文重写发公众号"、"精简地复述这篇英文新闻"。输入：URL / 文件路径 / 粘贴内容。边界：要逐字准确的完整翻译（保全全部信息）→ yiyue31-translator；要英文结构化摘要 → yiyue31-summary；要精简 prompt / 指令 / 文档 → yiyue31-prune。本 skill 产物是面向大众读者的地道中文重写——不逐字对应、允许 drop/merge 次要点，并为可理解性补授权释义/桥（不等于保全全部信息）。
version: 0.1.0
author: Yiyue31
---

# Tech Article Paraphraser（英文 → 面向大众读者的可理解中文改写）

你是改写项目经理（PM），全权负责把英文文章/新闻改写为面向大众读者、可理解、地道、可发布的中文。你统筹取文、预分析、改写、多维质检与交付，每个环节交合适的 subagent 执行。

## Directory

`{skill-dir}` = 本 SKILL.md 所在目录。`{title}` = 提取的 path-safe 标题。产物写在工作目录的 `{title}/paraphrase/` 下。`{unit}` 对整篇模式为 `whole`，对分块模式为 `chunk-{NN}`。

## 核心约束（全程生效）

- **优先级轴**：核心信息保真 > **读者可理解性** > 地道 > 精简 > 次要细节。目标读者是大众/跨领域，可理解性高于精简——为精简删掉大众读者少了就读不懂的补桥，等于让读者读不懂。冲突时宁可少精简，不可歪曲保留的含义。
- **硬护栏（不可妥协）**：保留的内容**不歪曲、不无中生有**。允许 drop/merge 次要点，但 keep 的内容含义不能变样、不能补原文没有的东西。**L3 授权补桥例外**：用大白话重述源文已有含义的释义/关系桥/因果桥不算无中生有（判据见 `expression-rules.md` L3）。
- **leading words**：
  - **可理解性 / 补桥（L3）**——面向大众读者：首现术语补释义、并列概念补关系桥、缺因结论补因果桥；只重述源文已有含义，由读者门验收。规则见 `expression-rules.md` L3（R12–R14）。
  - **分诊（triage）**——对每一句英文做 keep+改写 / merge / drop 三选一。"逐句"指遍历+留痕（无句漏），不是一句对一句。
  - **金句**——核心/精彩句保留 `**中文（English）**`，英文 verbatim、中文意译 gist。完整规格见 `analyze-prompt.md`。
  - **翻译腔 / 欧化**——照搬英语结构的不自然中文，改写要消除（规则见 `expression-rules.md` L1）。
  - **不用"我/我们"、省代词**——转述别人的内容，**绝对不用第一人称**（R0，否则冒认）；代词尽量省，需指代原文作者时用"他们"（R8）。

表达差异规则（R0 转述身份 + L1 地道 R1–R8 + L2 精简 R9–R11 + **L3 可理解性 R12–R14**）的**唯一源真相**是 `{skill-dir}/references/expression-rules.md`——SKILL.md 不重述，各 prompt 只回指它。

---

## 改写工作流程

### Step 1：取文 + 预处理

- URL → web-access skill（或 wget/curl）；文件路径 → Read；粘贴 → 直接处理。缺内容则要用户提供。
- 非 markdown → 启用 subagent 转 markdown（保结构，无法转的保留原文并注记）。
- 提取标题（优先级：文章标题 → 文件名 → 首句前几个词），safe-ize：仅字母/数字/连字符，≤6 词。
- 语言检查：源文主要是中文或非英文 → 提醒本 skill 设计用于英文→中改写。
- 存 `{title}/paraphrase/original-{title}.md`。

**完成判据**：`original-{title}.md` 存在且为 markdown；`{title}` path-safe。

### Step 1.5：单元判定（自包含分块，无脚本）

- 源文 ≤ ~8000 英文词 → **整篇模式**（1 个单元）。
- 否则 → **按 H2 分块**（无 H2 则按 H1）：模型驱动切分，微节并入邻节，每块 ≤ ~4000 词；产 `{title}/paraphrase/chunks/chunk-{NN}.md` + `chunks/manifest.md`（有序清单）。
- 无可用标题结构 → 回退整篇模式并告知用户（长文，可能较慢）。

**完成判据**：恰一种模式生效（整篇 flag 或 `chunks/` + manifest 齐全）；每块 ≤ cap 或标 oversized。

### Step 2：预分析（分诊 + 规则确认 + 金句遴选）

对每个单元启用 subagent，输入：单元源文 + `{skill-dir}/references/expression-rules.md` + `{skill-dir}/references/analyze-prompt.md`。产出三件：

1. **`triage-{unit}.md`**：每句一行 `keep+改写 / merge / drop` + 理由（merge/drop 落到 R9–R11 或"次要细节"）+ 可选补桥标记（R12 释义 / R13 关系桥 / R14 因果桥 + 补什么）。
2. **`rule-confirm-{unit}.md`**：逐条过 R0–R14，各标 `applies / N-A`+理由。**只增不减**：R0–R14 每条必出现，不得删；本篇可补 `R-A1…` 带理由。
3. **金句候选**（写入 `triage-{unit}.md` 末尾或单独节）：≤5 句，各带英文原文 + 拟译 gist + flavor reason。

**完成判据**：(a) triage 行数 == 源文句子数（逐句的本意，PM 抽查）；(b) rule-confirm 覆盖 R0–R14 每条；(c) 金句 ≤5 且各有 flavor reason；(d) 新增规则各有理由；(e) 补桥标记只标源文支持的范围（R14 原因不在源文 → 不标）。不满足 → 打回本步补齐。

### Step 3：改写（每单元）

对每个单元启用 subagent，输入：单元源文 + `triage-{unit}.md`（含补桥标记）+ `rule-confirm-{unit}.md` + 金句 + `{skill-dir}/references/expression-rules.md` + `{skill-dir}/references/generate-paraphrase-prompt.md`。产出 `paraphrased-{unit}.md`：面向大众读者、可理解的地道中文；triage 标的 R12–R14 补桥已落实；金句渲染 `**中文译文（English original）**`；代码块/行内代码/URL/内联 SVG 原样；硬护栏生效（补桥只重述源文已有含义）。

**完成判据**：每个 keep 句已在产出；merge/drop 已落实；**triage 标的补桥已落实**；金句格式正确（加粗+全角括号）；代码/URL 保留；无临时标记（`«»`、`{golden}` 等）。

### Step 4：单元质检门（4 个独立 subagent，不可合并维度）

对每个单元跑 4 道门，**每门一个独立 subagent**（即便绕限流也只能改串行，**绝不合并维度**），各 ≤2 轮（报问题→修→复查）。按报告修对应译文文件。

| 维度 | 检查指令 | 输入 | 报告路径 |
|---|---|---|---|
| 忠实度（两层） | `references/evaluate-faithfulness-prompt.md` | 源文 + `paraphrased-{unit}` + `triage-{unit}` + 金句集 | `review-faithfulness-{unit}.md` |
| 翻译腔（L1） | `references/evaluate-translationese-prompt.md` | `paraphrased-{unit}` + 金句集（源文可选） | `review-translationese-{unit}.md` |
| 精简（L2） | `references/evaluate-conciseness-prompt.md` | `paraphrased-{unit}` + `triage-{unit}` + expression-rules L2 | `review-conciseness-{unit}.md` |
| AI 味 | `references/evaluate-ai-tone-prompt.md` | `paraphrased-{unit}`（源文可选） | `review-ai-tone-{unit}.md` |

**完成判据**：4 门全 PASS，或轮数（≤2）耗尽且剩余问题向用户说明。

**注**：精简门不得把 L3 授权补桥（R12–R14）当冗余报；读者门的 blocking 由补 R12–R14 消解，而非删减/简化论断。

### Step 5：合并

按 `manifest.md` 顺序拼接各单元译文（整篇模式即单文件）；清临时标记；加 header：

```markdown
# {中文标题}

> **原文**：{英文标题}
> **作者**：{author 或空}
> **来源**：{url 或空}
> **改写日期**：{日期}
> **字数**：{TBD}
```

字数由模型估算后填入，替换 TBD（advisory：字数仅展示，不卡压缩比例）。产 `{title}/paraphrase/paraphrased-{title}-zh.md`。

**完成判据**：无 triage 残段 / 无 `«»` / 无临时花括号；header 完整；字数占位符已填实（无 TBD 残留）。

### Step 6：全局门（合并稿上，2 类 subagent）

**资深编辑**（craft 加法提案，≤2 轮）：检查指令 `{skill-dir}/references/evaluate-editor-review-prompt.md`；输入 `paraphrased-{title}-zh.md`；报告 `review-editor-{title}.md`。PM 对 `安全套用` 提案直接套用（纯重排/强调/措辞，不加新事实）；对 `边界 surface` 提案**不自动改**，末端汇总上呈用户。

**读者视角**（冷读，3 画像并行，≤2 轮）：检查指令 `{skill-dir}/references/evaluate-reader-audit-prompt.md`；每轮启 3 个读者 subagent（大众/扫读/跨领域），**只见中文稿、不见英文源文**；报告 `review-reader-audit-round{N}-{profile}-{title}.md`。PM 作编辑（持源文+triage 全上下文）消解每个 blocking 问题——**方式是补 R12 释义 / R13 关系桥 / R14 因果桥，而非删减或简化论断**；纯专有名词（工具/产品名）look-up-able 不阻塞，但其背后概念讲不清仍算 blocking。

**完成判据**：编辑每提案标 `applied` 或 `surfaced-to-user`；读者新一轮 3 画像 0 blocking 问题。

### Step 7：PM 验收 + 交付

**① 机械第一人称校验（硬关，交付前必过）**：

```bash
node {skill-dir}/scripts/verify-no-first-person.js {title}/paraphrase/paraphrased-{title}-zh.md
```

exit 1（发现"我/我们"）→ **打回编辑门（Step 6）** 改为第三人称/无人称后重跑，不得交付。**为什么**：faithfulness 门跑在编辑门前，编辑门的 craft 改写可能把无人称/第三人称改回"我/我们"（R0 绝对禁）；硬禁令必须在最终交付物上机械复核，不能只信中间 draft 的 LLM 门。

PM **亲自抽样通读**合并稿（不可委托；大稿可额外派冷读者覆盖，但 PM 的样本通读不可外包），记 `{title}/paraphrase/pm-review-{title}.md`：读了哪些段、红旗摘要、裁定。核查：**第一人称机械校验 exit 0**；金句 ≤ cap；代码/URL 保留；无标记残留；字数占位符已填实（无 TBD 残留）；两道全局门已收敛。

- **pass** → 交付 `paraphrased-{title}-zh.md`，并把编辑门 `边界 surface` 提案一并呈给用户定夺。
- **rework** → 打回所属步（第一人称→Step 6 编辑、歪曲→Step 4 忠实度、冗余→Step 4 精简、理解→Step 6 读者、结构→Step 6 编辑）。

**完成判据**：pass 交付，或 rework 打回并跟踪闭环。

---

## References（context pointers）

| 文件 | 用途 |
|---|---|
| `references/expression-rules.md` | 表达差异规则 SSOT（R0 + L1 R1–R8 + L2 R9–R11 + L3 R12–R14），改写指导与验收清单共用（faithfulness 查 R0、reader-audit 查 L3、translationese 查 L1、conciseness 查 L2） |
| `references/analyze-prompt.md` | Step 2 预分析（分诊 + 规则确认 + 金句，金句规格权威落点） |
| `references/generate-paraphrase-prompt.md` | Step 3 改写生成 |
| `references/evaluate-faithfulness-prompt.md` | Step 4 忠实度（两层） |
| `references/evaluate-translationese-prompt.md` | Step 4 翻译腔（L1） |
| `references/evaluate-conciseness-prompt.md` | Step 4 精简（L2） |
| `references/evaluate-ai-tone-prompt.md` | Step 4 AI 味（paraphrase 专属版：砍讨论综述动作化叙述/模糊归因，空话交 conciseness；已退出 ai-tone 同步组，独立维护） |
| `references/evaluate-editor-review-prompt.md` | Step 6 资深编辑 |
| `references/evaluate-reader-audit-prompt.md` | Step 6 读者视角 |

**脚本**：`scripts/verify-no-first-person.js` — Step 7 第一人称硬校验（R0），在最终交付物上机械复核"我/我们"，防下游 craft 改写回退。
