---
name: Paper-Summary
display_name: Paper Summary Template
version: 1.2.0
---

# Paper Summary Template

## Description

Paper notes template, suitable for summarizing research papers, helping readers quickly learn and understand the paper. Organized by paper sections in order, highlighting innovations and practical value.

## Template Content

```markdown
# Original Title: {{Original Title}}

**Source**: {{URL or file path}}

**Author**: {{Author name, conference or journal name}}

**Template**: {{current template name or template filename}}

**Word Count**: {{xxx}} words

---

## Basic Information

- **Reading Date**: {{Date}}
- **Keywords**: {{3~5 keywords}}

## Core Problem

{{What problem does the paper attempt to solve? What is the background?}}

## Main Viewpoints/Conclusions

{{Summarize the author's core conclusions in 2~3 sentences.}}

## Technical Highlights

1. **Key Technology**: {{Methods, architecture, algorithms, etc.}}
2. **Innovations**: {{Differences from existing work}}
3. **Experiments/Validation**: {{How is effectiveness proven? Data or cases}}

## Reflections

- **Insights**: {{Implications for current work or field}}
- **Questions**: {{Unclear or controversial points in the paper}}
- **Extensions**: {{Directions for further exploration suggested by the paper itself}}

{{Questions and Extensions are optional — only generate if applicable.}}

## Action Items (Optional)

{{Next steps based on the paper's conclusions. If none, do not generate this section.}}

## Key Terminology

| Term | Explanation |
|------|-------------|
| {{term 1}} | {{brief explanation}} |
| {{term 2}} | {{brief explanation}} |

{{Only include if the paper introduces non-trivial terminology. If none exist, do not generate this section.}}
```

## Rules

- **Structure**: Organize by paper sections in order (introduction, related work, methods, experiments, conclusions, etc.)
- **Conditional sections**: "Questions" and "Extensions" under Reflections only if applicable. "Action Items" and "Key Terminology" only when relevant content exists.
- **Inline verbatim**: Key claims and memorable conclusions must be embedded inline in the body text where their context is discussed, wrapped in `[Verbatim]...[/Verbatim]` and formatted as ***bold italic***. Do NOT place them in a separate section.
