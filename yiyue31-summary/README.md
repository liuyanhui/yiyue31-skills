# yiyue31-summary-generator

Intelligent article summary generator supporting multiple templates and Chinese/English output.

## Core Features

- **Multiple Templates** - Tech Article / Paper / Concise Notes (default)
- **Intelligent Analysis** - Auto-detect article type, topic, terminology, highlights
- **Quality Assurance** - Comprehensive checks for coverage, accuracy, length, and structure
- **Multiple Inputs** - URL, file path, direct paste

## Quick Start

```bash
# Summarize a URL
Summarize https://example.com/react-hooks

# Summarize a file
Summarize ./articles/python-async.md

# English output
Summarize https://example.com/react-hooks
```

## Templates

| Template         | Use Case                         |
|------------------|----------------------------------|
| **Tech Article** | Tech blogs, announcements        |
| **Paper**        | Academic papers, research reports|
| **Concise Notes**| Quick learning, review           |

## Output Files

```text
{title}/
  ├── original-{title}.md          # Original article
  ├── analysis-{title}.md          # Article analysis
  ├── summary-{title}.md           # Summary draft
  ├── validation-{title}.md        # Quality check
  └── final-summary-{title}.md     # Final polished version
```

---

**Detailed Workflow**: [SKILL.md](./SKILL.md)
