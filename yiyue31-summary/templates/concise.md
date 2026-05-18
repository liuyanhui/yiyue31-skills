---
name: Concise
display_name: Concise Notes
version: 1.2.0
default_language: zh
target_length: 800-1500
target_reading_time: 3-5 minutes
sections:
  - title_overview
  - content_outline
  - core_insights
  - standout_quotes
  - key_glossary
guidelines_length:
  title_overview: 1-2 sentences
  content_outline: hierarchical by section
  core_insights: 5-8 points
  standout_quotes: 1-2 quotes
  key_glossary: 5-10 terms
features:
  - Focus on core knowledge
  - Avoid redundancy
  - Retain English proper nouns
  - Hierarchical structure for easy review
---

# Summary Template: Concise

## Description

Tech learning notes template, suitable for engineers or students to quickly review. Converts complex technical articles into easy-to-understand, structured notes.

## Structure

```markdown
# Original Title: {{Original Title}}

**Source**: {{URL or file path}}

**Author**: {{if available}}

**Template**: {{current template name or template filename}}

**Word Count**: {{xxx}} words

---

- **Background & Problem**: {{What problem does the article solve}}
- **Core Technology/Method**: {{Steps, algorithms, architecture (use bullet points)}}
- **Advantages & Innovations**: {{Content here}}
- **Disadvantages & Limitations**: {{Only if the article mentions limitations}}
- **Conclusions & Applications**: {{Content here}}
- **Standout Quote**: ***[Verbatim]{{1-2 memorable sentences that capture key insights}}[/Verbatim]***

## Key Glossary

| Term | Explanation |
|------|-------------|
| {{term 1}} | {{brief explanation}} |
| {{term 2}} | {{brief explanation}} |

{{Only include if the article introduces non-trivial terminology. If none exist, do not generate this section.}}
```

## Rules

- **Highlight Key Points**: Innovations, practical value, technical comparisons
- **Target length**: 800-1500 words (aspirational). Hard upper bound: must not exceed original article word count (see SKILL.md).
- **Conditional items**: "Disadvantages & Limitations" only if the article mentions them. "Key Glossary" only if non-trivial terminology exists.
- **Inline verbatim**: Memorable sentences must be embedded inline, wrapped in `[Verbatim]...[/Verbatim]` and formatted as ***bold italic***. Do NOT place them in a separate section.
