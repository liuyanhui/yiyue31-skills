---
name: yiyue31-tech-article-summarizer
description: Generates structured summaries of technical articles with sections for Overview, Key Points, Technical Details, and Conclusion. Use when user asks to "summarize article", "summarize tech post", "summarize research paper", "summarize documentation", "summarize blog", or provides URLs/files that need summarization. Supports all types of tech content (blog posts, research papers, documentation, tutorials) and accepts URLs, text files (.md, .txt), or direct text input.
---

# Tech Article Summarizer

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

## Summary Structure

All summaries follow this structured format:

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
