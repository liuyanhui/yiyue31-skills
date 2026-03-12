# yiyue31-tech-article-translator

专业的英文技术文章翻译工具，翻译为中文的同时保留技术术语和准确性。

## 项目信息

- **类型**: Agent Skill (Claude Code)
- **版本**: 1.0.0
- **作者**: Yiyue31
- **分类**: Content Creation
- **标签**: #translation #tech #chinese #terminology

## 功能特性

- **智能主题识别**: 自动提取标题、关键概念，确定技术领域
- **自定义术语表系统**: 每个主题维护独立的技术术语表
- **术语保留机制**: 支持保留英文（[KEEP]）或指定翻译
- **双语翻译模式**: 支持直译（逐字翻译）和意译（适应中文习惯）
- **主动术语维护**: 翻译前提取新术语，用户确认后更新术语表
- **质量双重校验**: 翻译质量检查 + Markdown 格式验证

## 使用方法

### 基本用法

```
翻译这篇文章：https://example.com/react-hooks
```

### 文件输入

```
翻译 ./articles/python-async.md
```

### 指定翻译风格

```
翻译 https://example.com/react-hooks，使用意译风格
```

## 目录结构

```
yiyue31-tech-article-translator/
├── SKILL.md                 # 主技能定义和工作流程
├── README.md               # 本文件
├── glossary/               # 技术术语表
│   ├── template.md         # 术语表模板
│   ├── AI.md           # React 相关术语
└── articles/               # 输出目录
    └── 2026-03/           # 按年月组织
```

## 术语表格式

```markdown
# Topic: React

| English Term | Translation |
|--------------|-------------|
| React | [KEEP] |
| Component | [KEEP] |
| useState | 状态钩子 |
| Virtual DOM | 虚拟DOM |
```

- `[KEEP]` - 保持英文不翻译
- 中文翻译 - 固定翻译为指定中文

## 输出格式

文件保存位置：`articles/{YYYY-MM}/{article-name}.md`

YAML Frontmatter：

```yaml
---
title: React Hooks 深度解析
source_title: Deep Dive into React Hooks
source_url: https://example.com/react-hooks
source_author: John Doe
translated_at: 2024-02-24
translation_style: literal
topic: react
language: en → zh
---
```

---

**详细文档**: 请查看 [SKILL.md](./SKILL.md) 了解完整工作流程和翻译规则
