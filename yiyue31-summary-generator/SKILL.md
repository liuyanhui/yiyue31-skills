---
name: yiyue31-tech-article-summarizer
description: Generates structured summaries of technical articles with sections for Overview, Key Points, Technical Details, and Conclusion. Use when user asks to "summarize article", "summarize tech post", "summarize research paper", "summarize documentation", "summarize blog", or provides URLs/files that need summarization. Supports all types of tech content (blog posts, research papers, documentation, tutorials) and accepts URLs, text files (.md, .txt), or direct text input.
---

# Tech Article Summarizer

## Summary Templates

This skill supports multiple summary templates for different use cases. **Before generating a summary, you will be asked to select a template.**

### Available Templates

| Template | Description | Best For |
|----------|-------------|----------|
| **Standard** | Balanced general-purpose tech article (English) | Most technical articles, blog posts, announcements |
| **Concise** | 简洁笔记（中文）- 聚焦核心知识 | 技术文章学习笔记、工程师快速复习 |
| **Comprehensive** | 全面解析（中文）- 按文章顺序分节整理 | 深度学习、技术参考、设计方案参考 |

### Template Management

Templates are stored in `templates/` directory. To add new templates:
1. Create a new `.md` file in `templates/`
2. Follow the template structure in `templates/README.md`
3. Templates will be automatically available for selection

To remove templates: delete the corresponding `.md` file from `templates/` directory.

## Quick Start

Summarize any technical article with structured output:

**From URL:**
```
Summarize this article: https://example.com/tech-article
```

**From file:**
```
Summarize the article at ./article.md
```

**Direct text:**
```
Summarize this article:
[paste article content]
```

## Template Selection Workflow

When starting a new summary:

1. **Ask the user**: "Which summary template would you like to use?"
2. **Present options** with brief descriptions:
   - **Standard**: Balanced tech article format in English (Overview, Key Points, Technical Details, Takeaways, Conclusion)
   - **Concise**: 简洁笔记（中文）- 聚焦核心知识，快速复习
   - **Comprehensive**: 全面解析（中文）- 按文章顺序分节，突出创新点和实用价值
3. **Use the selected template's structure** for the summary

## Default Template Structure (Standard)

The standard template follows this format (other templates have different structures):

```markdown
# Article Summary: [Original Title]

**Source**: [URL or file path]
**Author**: [if available]
**Published**: [if available]
**Read Time**: [estimated]

---

## Overview
[2-3 sentence high-level summary of what the article is about and its main purpose]

## Key Points
- [Main point 1]
- [Main point 2]
- [Main point 3]
- [Additional key points as needed]

## Technical Details
[Technical concepts, technologies, methodologies, or implementation details discussed]

## Takeaways
- [Practical takeaway 1]
- [Practical takeaway 2]
- [Action items or lessons learned]

## Conclusion
[Final thoughts on the article's value, intended audience, and relevance]
```

## Input Handling

### URLs
- Use `mcp__web_reader__webReader` tool to fetch web content
- Handle both direct article URLs and documentation pages
- Extract main content, ignoring navigation and sidebars

### Files
- Read `.md`, `.txt`, `.html`, `.rst` files directly
- For `.pdf` files, use pdf skill to extract text first
- Preserve code blocks and technical formatting

### Direct Text
- Accept pasted article content
- Parse markdown formatting if present
- Handle both plain text and formatted content

## Article Type Detection

Adapt summary emphasis based on content type:

| Type | Indicators | Summary Emphasis |
|------|------------|-----------------|
| **Blog Post** | Personal tone, practical examples, how-to focus | Practical takeaways, implementation tips |
| **Research Paper** | Abstract, citations, methodology sections | Research questions, findings, methodology |
| **Documentation** | API reference, usage examples, technical specs | Technical details, usage patterns |
| **Tutorial** | Step-by-step instructions, code samples | Learning outcomes, key steps covered |

## Content Analysis Guidelines

### Extract Main Points
- Identify the author's central thesis or argument
- Capture supporting arguments or evidence
- Note any counterpoints or alternative views discussed
- Highlight the most important conclusions

### Handle Technical Depth
- Preserve key technical terms and concepts (don't oversimplify)
- Explain unfamiliar concepts briefly in context
- Include relevant technologies, frameworks, or tools mentioned
- Capture code examples or pseudocode if critical to understanding

### Balance Detail and Brevity
- Overview: 2-3 sentences maximum
- Key Points: 3-7 bullet points
- Technical Details: 1-3 paragraphs, depth appropriate to article
- Takeaways: 2-4 practical insights
- Conclusion: 1-2 sentences

## Quality Standards

**Accurate**: Faithfully represent the article's content without misinterpretation

**Complete**: Cover all major points, not just the introduction

**Concise**: Eliminate redundancy while preserving meaning

**Neutral**: Maintain author's voice and intent, don't add opinions

**Readable**: Use clear language and proper formatting for technical content

## Using Different Templates

### Standard Template
Use for: General technical articles, blog posts, announcements
- **Language**: English
- **Sections**: Overview, Key Points, Technical Details, Takeaways, Conclusion
- **Length**: Medium (300-500 words)
- **Depth**: Balanced

### Concise（简洁笔记）
Use for: 技术文章学习笔记、工程师快速复习
- **Language**: 中文
- **Sections**: 标题与概述、关键概念与术语、内容大纲、核心洞见、问题与扩展
- **Length**: 800-1500字
- **Features**: 聚焦核心知识，避免冗余，保留英文专有名词

### Comprehensive（全面解析）
Use for: 深度学习、按文章顺序分节整理
- **Language**: 中文
- **Sections**: 文章标题与概述、关键概念与术语、主要内容结构（按引言/背景/方法/实现/结果/结论分节）、核心要点与亮点、潜在问题与延伸
- **Features**: 按文章顺序分节、突出创新点和实用价值、层级缩进便于复习

## Template Reference

See `templates/` directory for complete template definitions:
- `templates/standard.md` - Balanced general-purpose template (English)
- `templates/concise.md` - 简洁笔记模板（中文）
- `templates/comprehensive.md` - 全面解析模板（中文）
