# yiyue31-summary-generator

智能文章总结生成器，支持多种模板和中英文输出。

## 核心特性

- **多种模板** - 技术文章 / 论文 / 简洁笔记（默认）
- **智能分析** - 自动识别文章类型、主题、术语、金句
- **质量保证** - 覆盖率/准确性/长度/结构全面检查
- **多种输入** - URL、文件路径、直接粘贴

## 快速使用

```bash
# 总结 URL
总结 https://example.com/react-hooks

# 总结文件
总结 ./articles/python-async.md

# 英文输出
Summarize https://example.com/react-hooks
```

## 模板说明

| 模板 | 适用场景 |
|------|---------|
| **技术文章** | 技术博客、公告 |
| **论文** | 学术论文、研究报告 |
| **简洁笔记** | 快速学习、复习 |

## 输出文件

```
{title}/
  ├── original-{title}.md          # 原文
  ├── analysis-{title}.md          # 文章分析
  ├── summary-{title}.md           # 总结初稿
  ├── validation-{title}.md        # 质量检查
  └── final-summary-{title}.md     # 最终润色
```

---

**详细工作流程**: [SKILL.md](./SKILL.md)
