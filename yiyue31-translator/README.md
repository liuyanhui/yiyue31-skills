# yiyue31-tech-article-translator

专业的英文技术文章翻译工具，支持自定义术语表，翻译质量与术语一致性双重保障。

## 核心特性

- **智能主题识别** - 自动识别技术领域并加载对应术语表
- **术语表驱动** - 支持保留英文([KEEP])或指定翻译，确保术语一致性
- **双语模式** - 直译(适合技术文档) / 意译(适合博客)
- **特殊词句处理** - 金句、连字符词组、俚语习语智能标注
- **质量校验** - 翻译质量检查 + Markdown 格式验证

## 快速使用

```bash
# 翻译 URL
翻译 https://example.com/react-hooks

# 翻译文件
翻译 ./articles/python-async.md

# 指定风格
翻译 https://example.com/react-hooks，使用意译风格
```

## 术语表格式

```markdown
| English Term | Translation |
|--------------|-------------|
| React | [KEEP] |
| useState | 状态钩子 |
```

- `[KEEP]` - 保持英文
- 中文翻译 - 固定翻译

## 输出文件

```
{title}/translation/
  ├── original-{title}.md              # 原文
  ├── analysis-topic-{title}.md        # 主题分析
  ├── special-phrases-{title}.md       # 特殊词句
  └── translated-{title}-zh.md         # 译文
```

---

**详细工作流程**: [SKILL.md](./SKILL.md)
