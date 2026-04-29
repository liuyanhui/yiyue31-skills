---
name: Concise
display_name: 简洁笔记
version: 1.1.0
default_language: zh
target_length: 800-1500
target_reading_time: 3-5 minutes
sections:
  - title_overview
  - key_concepts
  - content_outline
  - core_insights
  -_questions_extensions
guidelines_length:
  title_overview: 1-2 sentences
  key_concepts: 5-10 terms
  content_outline: hierarchical by section
  core_insights: 5-8 points
  questions_extensions: 2-3 items each
features:
  - 聚焦核心知识
  - 避免冗余
  - 保留英文专有名词
  - 层级结构便于复习
---

# Summary Template: Concise（简洁笔记）

## Description
技术学习笔记模板，适合工程师或学生快速复习。将复杂技术文章转化为易懂、结构化的笔记。默认中文，用户可指定使用英文。

## Structure

```markdown
# 原标题：{{Original Title}}

**来源**: {{URL or file path}}

**作者**: {{if available}}

**模板**: {{当前模板名称或模板的文件名}}

**字数**：{{xxx}}字

---

- **背景与问题**：{{文章解决什么问题}}
- **核心技术/方法**：{{步骤、算法、架构（用bullet points）}}
- **优点与创新**：{{这里是内容}}
- **缺点与限制**：{{这里是内容}}
- **结论与应用**：{{这里是内容}}
- **关键术语表**：{{这里是内容}}
```

## Rules

- **格式**: 用Markdown格式，语言简洁易懂。
- **语言**: 默认中文，保留英文专有名词（如 AI Agent, prompt 等）
- **准确性**: 保留技术准确性，用易懂语言解释复杂概念
- **信息来源**: 只基于提供的文章内容，不添加外部知识
- **突出重点**: 创新点、实用价值、技术比较
- **字数要求**：不能超过原文字数