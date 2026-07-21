---
name: yiyue31-talk
description: 当用户要求"提取观点"、"生成心得"、"记录我的理解"、"写收获"、"我的想法"、"我对这篇文章的看法"、"分享我的看法"、"写个推荐"时使用。读到好文章（技术/新闻）后，快速产出可分享的中文心得成品，含总结与两版推荐语。dump 与策展两条路径，由用户实时选择。
version: 0.0.1
---

# 用户心得分享 Skill

读到好文章后，快速产出**可分享的中文心得成品**。AI 不盘问、不替用户下判断，只呈现原文内容、整理用户的话。

**为什么是这个形态**：访谈/讨论式（AI 提问、用户回答）被验证既累又跑题——全程用户被动答题，AI 还常问出与用户想法大相径庭的问题。本 skill 反转模式：用户始终在作者位（选材、批注或一次性写看法），AI 在辅助位（提取、整合、排版、组装），不发问、不编造。

## 两条路径

- **dump 模式**（心得已成形）：用户一次性写下所有看法，AI 整合成稿。
- **策展模式**（心得未成形）：AI 摆出原文的"点"，用户挑几个、加批注，AI 组装。

由用户实时选择，不预设、不自动跳过。

---

## 目录约定

`{skill-dir}` = 本 SKILL.md 所在目录路径。

## Reusable Sub-workflows

### Evaluate Once

单次审查：调 subagent，出报告，通过或不通过。审查 prompt 自身定义"通过"条件（通常为"无问题"）。

**参数（调用方提供）：**
- `{eval-prompt}`：审查 prompt 文件路径
- `{input-files}`：待审文件（可为多个）
- `{output-file}`：审查报告保存位置
- `{max-rounds}`：复审上限

**流程：**
1. 以 `{eval-prompt}` 为标准，把 `{input-files}` 内容作为输入调 subagent。
2. 保存报告到 `{output-file}`。
3. 报告无问题 → 通过。有问题 → 按建议修正，复审。最多 `{max-rounds}` 轮。
4. 轮次用尽仍有问题 → 展示当前版本与剩余问题，由用户决定。

**返回：** PASS/FAIL + 报告路径。

---

## title 安全化

仅保留字母、数字、CJK 字符、`-`、`_`，其余替换为 `-`，合并连续 `-`，去除首尾 `-`，限 64 字符。示例：`《AI 重塑软件开发：2026 年趋势》` → `AI-重塑软件开发-2026-趋势`。路径无效时用简短英文替代。

## 恢复逻辑

检查 `{title}/talk/` 下已有文件判断模式与进度：

| 已有文件 | 模式 / 完成步骤 |
|---------|---------------|
| `raw-{title}.md` | Step 0 完成 |
| `user-dump-{title}.md` | dump，D1 完成 |
| `integrated-draft-{title}.md` | dump，D2 完成 |
| `review-faithfulness-{title}.md` | dump，D4 完成 |
| `article-points-{title}.md` | 策展，C1 完成 |
| `selected-points-{title}.md` | 策展，C2 完成 |
| `annotations-{title}.md` | 策展，C3 完成 |
| `share-{title}.md` | 组装完成 |
| `review-quality-{title}.md` | 质量审查完成 |

存在未完成工作 → 询问用户：继续 / 重新开始 / 跳转步骤。

---

## Workflow

### Step 0: 输入格式化

将用户输入转为 Markdown。来源：URL（优先用本地 skill 下载）/ 文件路径 / 粘贴内容。title 安全化后保存。

保存：`{title}/talk/raw-{title}.md`

### 路由

**始终**用 AskUserQuestion 询问（即使用户触发语已带看法，也由用户实时选，不自动跳过）：

- "你已经想好要说什么了吗？"
  - 想好 → **dump 模式**
  - 没想好 → **策展模式**

---

### dump 模式

#### D1: 用户一次性输入看法

用户自由写下所有看法（可乱序、可口语）。原样保存：`{title}/talk/user-dump-{title}.md`

#### D2: AI 整合成稿

读 `user-dump` + `raw`，产出结构化初稿：

- 按主题或原文章节归并用户观点。
- 明确标注原文 vs 我的话。
- 补足让没读过原文的读者也能看懂的上下文（仅必要）。
- 顺可读性。

**护栏（强制）**：严格按"原文 + 用户输入"成稿，禁止 AI 自行发挥。可重组、补必要原文上下文、顺可读性，但不得添加原文与用户输入之外的任何观点、论据或修饰。**用户说得少，稿子就短——不能为丰满而编造。**

保存：`{title}/talk/integrated-draft-{title}.md`

#### D3: 缺口提示（可选）

AI 列出原文里用户没提到的关键点（"你没提 X、Y，要补吗？"）。内容锚定、非猜问题。用户决定补/不补；补则并入 D2 重出初稿。

#### D4: faithfulness 检查（Evaluate Once）

核对 `integrated-draft`：每条"我的"观点都能在 `user-dump` 找到来源，且无原文与用户输入之外的内容（禁止 AI 发挥）。

- `{eval-prompt}`：`{skill-dir}/references/evaluate-faithfulness-prompt.md`
- `{input-files}`：`integrated-draft` + `user-dump` + `raw`
- `{output-file}`：`{title}/talk/review-faithfulness-{title}.md`
- `{max-rounds}`：2

不通过 → 按 D2 护栏修正，复审。

**→ 进入"共用组装"。**

---

### 策展模式

#### C1: AI 提取原文点

单遍分析 `raw`，抽取"点"：关键论断 + 出彩句 + 争议点。总数 ≤ 10，按讨论价值排序（高优先）。不做多轮 generate-evaluate。

保存：`{title}/talk/article-points-{title}.md`

#### C2: 用户多选收敛

AskUserQuestion 多选：哪些点保留。用户可补 AI 漏的。一次完成即收敛。

记录：`{title}/talk/selected-points-{title}.md`

**为什么是"点"不是"问题"**：AI 生成的问题是猜的，常与用户不在一个频道；呈现原文的点，让用户反应的是内容本身。收敛就是一次多选，秒级。

#### C3: 用户选择性加批注

仅在保留点上写"我的理解"（1-2 句）。想写的写，不想写的留摘录。AI 不主动提问；用户卡壳时可要求 AI 代拟一句、再改。

保存：`{title}/talk/annotations-{title}.md`

**→ 进入"共用组装"。** 策展模式无 faithfulness 检查——内容是用户自己选、自己写的，用户即质量门。

---

### 共用组装：分享稿

**输出语言固定为中文。**

结构（四块）：

1. **引言**：这篇讲什么、为什么分享（1-2 句）。
2. **心得正文**：
   - dump → D2 整合稿。
   - 策展 → 重点摘录 + 我的批注（按保留点组织）。
3. **总结**：关键启示（无指定长度）。
4. **推荐语**：两版——**≤100 汉字**（社交动态）+ **≤200 汉字**（博客前言），文稿内标注用途。

通则：全文区分原文 vs 我的话；数据/名称保持原值。

保存：`{title}/talk/share-{title}.md`

### 质量审查（共用，分享稿必经）

对 `share-{title}.md` 跑三道检查（并行 subagent），任一有问题则统一修正后复审，最多 2 轮：

1. **翻译味儿审查**：`{skill-dir}/references/evaluate-translationese-prompt.md`——欧化句式、"的"字堆叠、被动滥用、生硬连接词等翻译腔。
2. **可读性审查**：`{skill-dir}/references/evaluate-readability-prompt.md`——语义断裂、逻辑跳跃、术语堆砌、指代不清等阻断理解的问题。
3. **AI 味儿审查**：`{skill-dir}/references/evaluate-ai-tone-prompt.md`——套路化、口语化、空话等 AI 写作痕迹。

报告：`{title}/talk/review-quality-{title}.md`（三道合并一份）。

**审查范围（重要）**：只审 AI 生成的成稿文字（引言、总结、推荐语、dump 整合正文、策展中的过渡与组织），**不改原文摘录与用户原话批注**——那是原文与用户的声音，不是 AI 要修的对象。三道检查只润色表达，不得改变含义或增删内容（内容忠实度由 dump 的 D4 把关）。

每道用 **Evaluate Once**，`{max-rounds}`：2，三道并行。

用户确认 `share-{title}.md` 后，任务完成。
