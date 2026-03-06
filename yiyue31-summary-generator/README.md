# yiyue31-summary-generator

A flexible skill for generating structured summaries of technical articles with multiple templates and language support.

## Features

- **Multiple Templates**: Choose from Standard, Concise, or Comprehensive formats
- **Bilingual Support**: Generate summaries in Chinese (default) or English
- **Smart Article Detection**: Automatically adapts summary style based on content type
- **Flexible Input**: Accept URLs, files, or direct text paste
- **Quality Validation**: Built-in checks ensure summary completeness and accuracy
- **User Feedback Loop**: Iterative refinement based on user needs

## Quick Start

### Basic Usage

```
Summarize this article: https://example.com/tech-article
```

### From File

```
Summarize ./articles/react-hooks.md
```

### Direct Text

```
Summarize this article:
[paste article content]
```

### Chinese Usage

```
总结这篇文章：https://example.com/tech-article
```

## Templates

### Standard（标准摘要）

Balanced format for general technical articles.

**Best for:**
- Technical blog posts
- Engineering articles
- Announcements
- Best practices guides

**Sections:**
- Overview (2-3 sentences)
- Key Points (3-7 bullets)
- Technical Details (1-3 paragraphs)
- Takeaways (2-4 bullets)
- Conclusion (1-2 sentences)

**Length:** 300-500 words

---

### Concise（简洁笔记）

Focused learning notes for quick review.

**Best for:**
- Technical learning notes
- Quick review before exams/meetings
- Knowledge consolidation
- Study materials

**Sections:**
- 标题与概述 (Title & Overview)
- 关键概念与术语 (Key Concepts & Terms)
- 内容大纲 (Content Outline)
- 核心洞见 (Core Insights)
- 问题与扩展 (Questions & Extensions)

**Length:** 800-1500字

---

### Comprehensive（全面解析）

In-depth analysis following article structure.

**Best for:**
- Deep learning of technical topics
- Research paper understanding
- Technical report analysis
- Design document review

**Sections:**
- 文章标题与概述 (Title & Overview)
- 关键概念与术语 (Key Concepts & Terms)
- 主要内容结构 (Main Content - by sections)
- 核心要点与亮点 (Core Highlights)
- 潜在问题与延伸 (Issues & Extensions)

**Length:** 1500-3000字

---

## Workflow

1. **Input Article** - Provide URL, file path, or paste content
2. **Select Language** - Choose Chinese (中文) or English
3. **Select Template** - Choose from Standard, Concise, or Comprehensive
4. **Generate Summary** - AI creates structured summary following template
5. **Quality Check** - Validation ensures completeness and accuracy
6. **Feedback Loop** - Request adjustments if needed

## Article Type Detection

The skill automatically adapts based on content:

| Type | Indicators | Summary Emphasis |
|------|------------|-----------------|
| **Blog Post** | Personal tone, practical examples | Practical takeaways, tips |
| **Research Paper** | Abstract, citations, methodology | Research questions, findings |
| **Documentation** | API reference, technical specs | Technical details, usage |
| **Tutorial** | Step-by-step instructions | Learning outcomes, steps |

## Output Format

### File Location (when saving)

```
summaries/{YYYY-MM}/{article-name}.md
```

### YAML Frontmatter

```yaml
---
title: Article Summary Title
source: https://example.com/article
author: Author Name
published: 2025-01-15
template: Standard
language: zh
generated_at: 2025-03-06
---
```

## Custom Templates

You can create custom templates by adding new `.md` files to the `templates/` directory:

```markdown
---
name: MyCustomTemplate
display_name: 我的自定义模板
default_language: en
sections:
  - section1
  - section2
---

# Summary Template: My Custom Template

## Description
[Brief description of your template]

## Structure
```markdown
[Your template structure here]
```

## Guidelines
- [Your guidelines here]

## Best For
- [Use cases here]
```

## Directory Structure

```
yiyue31-summary-generator/
├── SKILL.md                 # Main skill definition
├── README.md               # This file
├── templates/              # Template definitions
│   ├── standard.md         # Standard template
│   ├── concise.md          # Concise template
│   └── comprehensive.md    # Comprehensive template
└── references/             # Reference documentation
    ├── best-practices.md   # Summarization guidelines
    └── examples.md         # Example summaries
```

## Quality Standards

All summaries are validated against:

- ✅ **Coverage**: All major points represented
- ✅ **Accuracy**: Technical terms used correctly
- ✅ **Length**: Matches template guidelines
- ✅ **Structure**: All sections present
- ✅ **No Fabrication**: Only information from original article

## Tips for Best Results

1. **Provide complete articles** - Partial content may miss key points
2. **Choose appropriate template** - Match template to your use case
3. **Specify language** - Default is Chinese, request English if needed
4. **Provide feedback** - Request adjustments if first draft isn't perfect
5. **Use for learning** - Concise template excellent for study notes

## Examples

See `references/examples.md` for example summaries of:
- Blog posts
- Research papers
- Documentation

## Version

**Current Version:** 1.1.0
**Skill ID:** `yiyue31-summary-generator`
**Category:** Content Processing

---

**Last Updated:** 2025-03-06
