# yiyue31-translate-tech-article

A specialized skill for translating English technical articles into Chinese while preserving technical terminology and accuracy.

## Features

- **Smart Topic Detection**: Automatically identifies article theme (React, Python, Kubernetes, etc.)
- **Custom Glossary System**: Each topic maintains its own technical term glossary
- **Term Preservation**: Words in glossary are kept in English (not translated)
- **Translation Styles**: Supports both literal (直译) and free (意译) translation modes
- **Auto Glossary Maintenance**: AI proactively identifies new terms after translation
- **User Confirmation**: Asks user before committing glossary updates
- **Git Auto-Commit**: Automatically commits glossary changes to local repository

## Quick Start

### Basic Usage

```
Translate this article: https://example.com/react-hooks
```

### With File Input

```
Translate ./articles/python-async.md
```

### Paste Content

```
[Paste your English technical article content here]
```

## Workflow

1. **Analyze Article Topic**: Extract title, headings, and identify domain
2. **Load Glossary**: Load existing glossary for the identified topic
3. **Ask Translation Style**: Choose between literal (直译) or free (意译)
4. **Translate with Term Preservation**: Keep glossary terms in English
5. **Glossary Maintenance**: AI proposes new terms, user confirms updates
6. **Git Commit**: Auto-commit glossary changes (if repo exists)

## Directory Structure

```
yiyue31-translate-tech-article/
├── SKILL.md                 # Main skill definition
├── CLAUDE.md               # Local constraints
├── README.md               # This file
├── .gitignore              # Ignore generated content
├── glossary/               # Technical term glossaries
│   ├── template.md         # Glossary file template
│   ├── react.md           # React-specific terms
│   ├── python.md          # Python-specific terms
│   └── kubernetes.md      # Kubernetes-specific terms
└── articles/               # Output directory (gitignored)
    └── 2024-02/           # Organized by year-month
```

## Glossary System

### Glossary File Format

```markdown
# Topic: React

| English Term | Chinese Explanation | Notes |
|--------------|-------------------|-------|
| useState | 状态钩子 | React Hook |
| useEffect | 副作用钩子 | React Hook |
| Virtual DOM | 虚拟DOM | Core concept |
```

### How It Works

1. **Before Translation**: Load glossary for identified topic
2. **During Translation**: Words in glossary are NOT translated (kept in English)
3. **After Translation**: AI scans for new technical terms not in glossary
4. **User Confirmation**: AI presents new terms and asks user to confirm
5. **Update Glossary**: Confirmed terms are appended to glossary file
6. **Git Commit**: If git repo exists, commit changes with message:
   ```
   docs: update glossary for {topic} ({YYYY-MM-DD})
   ```

## Translation Rules

### What Gets Preserved

- Code blocks (```...```)
- Inline code (`...`)
- URLs and links
- Command-line instructions
- Technical terms in glossary

### Translation Styles

| Style | Description | Best For |
|-------|-------------|----------|
| Literal (直译) | Word-for-word, preserves original structure | Technical documentation |
| Free (意译) | Adapts for Chinese readability, reorganizes flow | Blog posts, tutorials |

### Term Handling

- **First occurrence**: `useState (状态钩子)`
- **Subsequent occurrences**: `useState`
- **Not in glossary**: Translate to Chinese

## Output Format

### File Location

```
articles/{YYYY-MM}/{article-name}.md
```

### YAML Frontmatter

```yaml
---
title: React Hooks 深度解析
original_title: Deep Dive into React Hooks
source: https://example.com/react-hooks
author: John Doe
translated_at: 2024-02-24
translation_style: literal
topic: react
tags: react, hooks, javascript, frontend
---
```

## Supported Topics

Current glossaries available for:

- **React**: Hooks, Components, Virtual DOM, etc.
- **Python**: Decorators, Generators, Async/Await, etc.
- **Kubernetes**: Pods, Deployments, Services, etc.

More topics can be added by creating new glossary files in `glossary/`.

## Development

### Adding New Glossaries

1. Create `glossary/{topic}.md` using `glossary/template.md` as reference
2. Add technical terms in table format
3. Commit to git repository

### File Naming

- Use lowercase: `glossary/react.md`, `glossary/python.md`
- For subtopics: `glossary/react-hooks.md`, `glossary/kubernetes-deployment.md`

## Requirements

- **Encoding**: UTF-8 for Chinese characters
- **Git Repository**: Optional (for auto-commit feature)
- **Claude Code**: Compatible with Claude Code CLI

## License

Part of yiyue31-skills project.

## Related Skills

- [yiyue31-courseware-generator](../yiyue31-courseware-generator/) - Generate educational courseware

---

**Version**: 1.0.0
**Skill ID**: `yiyue31-translate-tech-article`
**Category**: Content Creation
