---
name: yiyue31-notes
description: 当用户要求"合并笔记"、"生成学习笔记"、"整合心得"、"合并文章总结和观点"、"创建完整学习文档"，或用户已完成 yiyue31-summary 和 yiyue31-talk 后使用。用于合并文章总结和用户观点，生成完整的学习笔记文档。
---

# Learning Notes Merger

此技能将 yiyue31-summary 和 yiyue31-talk 的输出合并为完整的学习笔记文档。

---

## Directory

`{skill-dir}` = this SKILL.md's directory path. It means the directory where this SKILL.md is located.

---

## Overview

**核心定位**：合并工具（不是编排者）

此技能读取两个已存在的文档：
1. yiyue31-summary 生成的文章总结（客观）
2. yiyue31-talk 生成的用户观点（主观）

并合并为一个或多个输出文档，用于：
- **博客发布分享**：对外发布，让读者了解文章内容并看到你的思考
- **个人回顾**：日后复习时能快速回想起学习过程和关键收获

**前置条件**：两个输入文件必须同时存在

---

## Workflow

### Step 0: 前置检查

检查必要的输入文件和目录：

```
IF 存在目录 `{title}/summary/` AND 存在目录 `{title}/talk/`:
    继续执行
ELSE IF 只存在 `{title}/summary/`:
    提示：请先运行 yiyue31-talk 生成用户观点
    停止执行
ELSE IF 只存在 `{title}/talk/`:
    提示：请先运行 yiyue31-summary 生成文章总结
    停止执行
ELSE:
    提示：请先运行以下技能：
    1. yiyue31-summary（生成文章总结）
    2. yiyue31-talk（通过对话提取用户观点）
    停止执行
```

**检查必需文件**：
- `{title}/summary/final-summary-{title}.md`
- `{title}/talk/user-viewpoints-{title}.md`

**可选文件**：
- `{title}/talk/qa-{title}.md`（讨论记录）
- `{title}/talk/analysis-raw-{title}.md`（术语和金句）
- `{title}/talk/viewpoint-mapping-{title}.md`（观点映射）

---

### Step 1: 识别标题

从输入文件或目录结构中提取标题：

**优先级**：
1. 从 `final-summary-{title}.md` 或 `user-viewpoints-{title}.md` 中提取标题
2. 从目录名 `{title}` 中提取
3. 使用默认标题

---

### Step 2: 选择输出模式

使用 AskUserQuestion 工具询问用户想要哪种输出：

**选项**：
- **博客版**：精简、对外友好、适合发布
- **个人版**：详细、保留讨论过程、适合回顾
- **两种都要**：生成两个文档

---

### Step 3: 读取输入文件

根据选择的输出模式，读取相应的输入文件：

**博客版必需**：
- `{title}/summary/final-summary-{title}.md`
- `{title}/talk/user-viewpoints-{title}.md`

**个人版额外读取**：
- `{title}/talk/qa-{title}.md`（讨论记录）
- `{title}/talk/analysis-raw-{title}.md`（术语和金句）
- `{title}/talk/viewpoint-mapping-{title}.md`（观点映射）

---

### Step 4: 生成博客版

**输出文件**：`{title}/blog-post-{title}.md`

**文档结构**：
```markdown
---
title: "[文章标题] 阅读心得"
date: [生成日期]
tags: [技术, 学习笔记]
original_url: "[原文URL]"
---

# [文章标题] 阅读心得

## 文章信息
- **原文**：[标题] - [作者]
- **来源**：[URL]
- **阅读时间**：[日期]

## 文章概览
[来自 summary：要点速览，3-5句话快速了解文章核心]

## 核心内容
[来自 summary：主要内容结构，按章节总结]

## 我的观点
[来自 talk：核心关注、我的理解、我的异议/补充]

## 收获与启发
[合并：文章的价值 + 我的思考 + 实践建议]

---
*原文链接：[URL]*
```

**内容处理规则**：
1. 从 summary 中提取：文章概览、核心内容、要点
2. 从 talk 中提取：核心关注、我的理解、我的异议/补充
3. 合并"洞察/启发"部分：区分文章的洞察（客观）和我的思考（主观）
4. 保留术语格式：`中文翻译(英文原文)`
5. 保留金句格式：`> 中文翻译(英文原文)`

---

### Step 5: 生成个人版（如果选择）

**输出文件**：`{title}/notes-{title}.md`

**文档结构**：
```markdown
# [文章标题] - 个人学习笔记

## 文章信息
- **原文**：[标题] - [作者]
- **来源**：[URL]
- **阅读时间**：[日期]
- **生成时间**：[时间戳]

## 文章概览（客观总结）
[来自 summary：完整内容，包括要点速览、主要内容结构、洞察启发]

## 交互讨论记录
[来自 talk/qa：完整的话题讨论过程]

### 话题列表
[从 qa-{title}.md 中提取话题列表]

### 讨论详情
[逐个话题展示 AI 引导、用户回复、AI 总结]

## 我的观点（详细版）
[来自 talk：观点概览 + 每个话题的详细观点]

### 观点概览
- 核心关注
- 我的理解
- 我的异议/补充

### 观点详情（按话题）
[每个话题的：原文位置、原文观点、用户观点]

## 观点映射
[来自 talk/viewpoint-mapping：观点到文章章节的映射关系]

## 综合总结
### 文章核心价值
[来自 summary：文章的创新点、实用价值]

### 我的收获与启发
[来自 talk：结合文章内容的个人思考]

### 实践建议
[来自 talk：可行动的建议]

### 适用边界
[来自 talk：方法和结论的适用范围]

## 附录
### 原文结构概览
[来自 summary 或 talk：文章的章节结构]

### 关键术语表
[来自 talk/analysis-raw：术语分析表格]
```

---

### Step 6: 质量检查

启用 subagent 进行质量检查：

**检查项**：
1. **完整性**：所有用户观点都被包含了吗？
2. **准确性**：客观内容与主观观点是否明确区分？
3. **连贯性**：文档结构是否清晰、易读？
4. **格式**：markdown 格式是否正确？

**检查对象**：
- 博客版：`{title}/blog-post-{title}.md`
- 个人版：`{title}/notes-{title}.md`

**检查结果**：
- 通过：告知用户，文件已生成
- 不通过：根据建议调整，重新生成

---

### Step 7: 用户确认

使用 AskUserQuestion 工具展示生成的文档，请用户确认：

**选项**：
- 确认：文档完成
- 调整：需要修改某些部分
- 重新生成：从头开始

---

## Input File Format Reference

### final-summary-{title}.md 格式

```markdown
# [文章标题] 阅读总结

## 基本信息
- 原文链接、作者、阅读时间、关键词

## 要点速览
[3-5句话快速了解文章核心]

## 主要内容结构
[按章节总结]

## 洞察和启发
[文章的洞察]
```

### user-viewpoints-{title}.md 格式

```markdown
# [文章标题] - 用户观点文档

原文、生成时间、话题数、观点数

## 我的观点概览
### 核心关注
### 我的理解
### 我的异议/补充

## 观点详情
### 话题1：[主题]
**原文位置**: [...]
**原文观点**: [...]
**我的观点**: [...]

## 我的总结
### 关键启示
### 实践建议
### 适用边界
```

### qa-{title}.md 格式

```markdown
# 交互式讨论记录

## AI 提炼的话题列表
1. [话题A]
   - [问题1]
   - [问题2]

## 讨论记录
### 话题1：[主题]
**AI**: [分享理解 + 引导问题]
**用户**: [用户的原话]
**AI总结**: [AI提炼用户观点]
**对应原文段落**: [章节/段落]
```

---

## Output Locations

| 输出类型 | 文件路径 |
|---------|---------|
| 博客版 | `{title}/blog-post-{title}.md` |
| 个人版 | `{title}/notes-{title}.md` |

---

## Common Mistakes

| 错误 | 正确做法 |
|------|---------|
| 跳过前置检查 | 始终先检查输入文件是否存在 |
| 混淆客观和主观 | 明确区分"文章的洞察"和"我的思考" |
| 丢失用户观点 | 使用 viewpoint-mapping 确保完整性 |
| 博客版保留过多细节 | 博客版应该精简，去掉讨论过程 |
| 个人版缺少讨论记录 | 个人版应该包含完整的交互过程 |

---

## Examples

### 博客版示例

```markdown
---
title: "Understanding Distributed Systems 阅读心得"
date: 2026-04-29
tags: [分布式系统, 技术笔记]
original_url: "https://example.com/distributed-systems"
---

# Understanding Distributed Systems 阅读心得

## 文章信息
- **原文**：Understanding Distributed Systems - Martin Kleppmann
- **来源**：https://example.com/distributed-systems
- **阅读时间**：2026-04-29

## 文章概览
本文深入探讨了分布式系统的核心概念和设计原则，重点讨论了 CAP 定理在实际应用中的权衡取舍，以及一致性模型的演进历程。

## 核心内容
[文章主要内容总结...]

## 我的观点
我认为 CAP 定理在实际工程中的理解常常被简化...

## 收获与启发
通过这篇文章，我理解到...

---
*原文链接：https://example.com/distributed-systems*
```

### 个人版示例

```markdown
# Understanding Distributed Systems - 个人学习笔记

## 文章信息
- **原文**：Understanding Distributed Systems - Martin Kleppmann
- **来源**：https://example.com/distributed-systems
- **阅读时间**：2026-04-29
- **生成时间**：2026-04-29 14:30:00

## 文章概览（客观总结）
[完整内容...]

## 交互讨论记录
### 话题列表
1. CAP 定理的实际应用
2. 一致性模型的选择
3. 分布式事务的处理

### 讨论详情
#### 话题1：CAP 定理的实际应用
**AI**: 在实际项目中，你如何权衡 CAP？
**用户**: 在我们的电商系统中...
**AI总结**: 用户认为在电商场景下...
**对应原文段落**: 第3章 CAP 定理

[更多讨论...]

## 我的观点（详细版）
### 观点概览
- 核心关注：CAP 定理的实践意义
- 我的理解：CAP 是一个设计工具，不是限制
- 我的异议：文中过于强调理论，忽略了工程实践

### 观点详情（按话题）
[详细观点...]

## 综合总结
### 文章核心价值
- 系统性地总结了分布式系统的理论
- 提供了实用的设计原则

### 我的收获与启发
- 理解了 CAP 定理的真正含义
- 学会了如何在实际项目中应用一致性模型

### 实践建议
- 不要盲目追求"完美"的一致性
- 根据业务场景选择合适的 CAP 组合

### 适用边界
- 适用于中等规模的分布式系统
- 对于超大规模系统（如全球 CDN），需要额外考虑

## 附录
### 原文结构概览
1. 引言
2. CAP 定理
3. 一致性模型
4. 分布式事务
5. 总结

### 关键术语表
| 原文术语 | 中文术语 |
|---------|---------|
| Consistency | 一致性 |
| Availability | 可用性 |
| Partition Tolerance | 分区容错性 |
```

---

## Notes

- 此技能不调用其他技能，只读取已有输出
- 输入文件路径格式必须符合 yiyue31-summary 和 yiyue31-talk 的约定
- 合并后的文档遵循 markdown 格式规范
- 博客版支持 Front Matter（适用于 Hugo/Hexo 等静态站点）
