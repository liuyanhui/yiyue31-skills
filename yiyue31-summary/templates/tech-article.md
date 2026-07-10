---
name: Tech-Article-Summary
display_name: Tech Article Summary Template
version: 2.2.2
---

# Tech Article Summary Template

## Description

Tech learning notes template (enhanced version), suitable for students or engineers for in-depth learning and understanding. Organized by article sections in order, highlighting innovations and practical value.

## Template Content

```markdown
# Original Title: {{Original Title}}

**Source**: {{URL or file path}}

**Author**: {{if available}}

**Template**: {{current template name or template filename}}

**Word Count**: {{xxx}} words

---

## 1. Overview

{{3-5 sentences summarizing the core theme, main objectives, and key conclusions of the article.}}
{{If people, teams, organizations, or events are involved, add a paragraph briefly describing their relevant background.}}

## 2. Key Points at a Glance

- {{Key point or highlight 1}}
- {{Key point or highlight 2}}
- {{...typically 5-8 points, ordered by article flow}}

## 3. Main Content Structure

{{Original article section 1}}
{{Summarize: key points, steps, pros/cons, or key arguments. Use bullet points (main point + sub-points) when necessary.}}

{{Original article section 2}}
{{Summary content...}}

{{...remaining sections — include only sections that carry substance; merge or omit sections whose content is bland, generic, or already covered elsewhere...}}

## 4. Insights and Inspirations

- {{Insight 1: innovations or breakthroughs, practical value, technical advantages, or lessons learned}}
- {{Insight 2: ...}}
{{Typically 3-5 insights.}}

## 5. Potential Issues

{{Point out limitations, challenges, or unresolved issues mentioned in the article. Suggest related further reading or application scenarios (strictly based on article content). If none exist, do not generate this section.}}

## 6. Key Terminology

| Term | Explanation |
|------|-------------|
| {{term 1}} | {{brief explanation}} |
| {{term 2}} | {{brief explanation}} |

{{Only include if the article introduces non-trivial terminology. If none exist, do not generate this section.}}
```

## Rules

- **Audience**: depth, jargon, and emphasis flex by audience (`general` default / `technical` / `mixed`) per `references/generate-summary-prompt.md` (Reader and audience). The template is the skeleton; audience adjusts what fills it.
- **Structure**: Organize by article sections in order (introduction, background, methods, implementation, conclusions, etc.) — but cover only the sections that carry substance. Merge related sections or omit bland/repetitive ones rather than giving every section airtime.
- **Conditional sections**: Sections 5 and 6 are only generated when the article contains relevant content.
- **Accuracy**: Preserve technical accuracy; explain complex concepts in understandable language.
- **Inline verbatim**: Follow the Verbatim rule in `references/generate-summary-prompt.md` — golden sentences, slang, idioms, and notable original phrasing must be embedded inline (***bold italic***, `[Verbatim]...[/Verbatim]`), never in a separate section.
