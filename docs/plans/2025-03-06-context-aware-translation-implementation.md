# Context-Aware Translation Enhancement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add context-aware two-pass translation to the translator skill for improved term detection, disambiguation, and consistency

**Architecture:** Pre-scan article to build term context map, then translate with contextual awareness, validate consistency post-translation

**Tech Stack:** Claude Code Skills system, Markdown glossaries, YAML frontmatter, git

---

## Task 1: Update Glossary Schema

**Files:**
- Modify: `yiyue31-tech-article-translator/glossary/template.md`

**Step 1: Update glossary template with new columns**

Open `glossary/template.md` and replace the table header:

```markdown
# Topic: {Topic Name}

| English Term | Chinese Explanation | Notes | Context Patterns | Examples |
|--------------|-------------------|-------|------------------|----------|
| Term1 | 中文解释 | Optional note | `pattern1`, "pattern2" | "Example usage in context" |
```

**Step 2: Commit**

```bash
git add yiyue31-tech-article-translator/glossary/template.md
git commit -m "feat: add context patterns and examples columns to glossary template"
```

---

## Task 2: Create Context Scanner Module Reference

**Files:**
- Create: `yiyue31-tech-article-translator/references/context-scanner.md`

**Step 1: Write context scanner specification**

```markdown
# Context Scanner Specification

## Purpose
Pre-scan articles to identify technical terms in context before translation.

## Token Extraction Rules

### Technical Term Patterns
1. **camelCase**: `useState`, `useEffect`, `mapStateToProps`
2. **PascalCase**: `Component`, `Props`, `State`
3. **snake_case**: `use_transition`, `server_action`
4. **Known Glossary Terms**: Any term in loaded glossary

### Context Collection
For each term, collect:
- **Immediate context**: ±50 characters
- **Sentence context**: Full sentence containing term
- **Code context**: If inside code block, note language and surrounding code

## Pattern Extraction

### Code Patterns
- Function calls: `functionName(`
- Method access: `object.method(`
- Assignments: `const variable =`
- JSX tags: `<Component`, `</Component>`

### Text Patterns
- Phrases: "use {term}", "{term} hook", "{term} component"
- Collocations: "component state", "application state"

## Confidence Scoring

| Score | Criteria |
|-------|----------|
| HIGH (0.8-1.0) | Matches glossary pattern + code syntax |
| MEDIUM (0.5-0.8) | Matches glossary pattern OR code syntax |
| LOW (<0.5) | No pattern match, unknown term |

## Disambiguation Rules

| Term | React Context | General Context |
|------|---------------|-----------------|
| hook | Preserve as "Hook" | Translate to "钩子" |
| state | Preserve as "state" | Translate to "状态" |
| component | Preserve as "Component" | Translate to "组件" |

## Output Format

```yaml
term_context_map:
  - term: "useState"
    occurrences: 15
    confidence: high
    context_patterns:
      - "useState("
      - "useState hook"
    disambiguated_as: "react_hook"
    translation_decision: preserve
```
```

**Step 2: Commit**

```bash
git add yiyue31-tech-article-translator/references/context-scanner.md
git commit -m "docs: add context scanner specification"
```

---

## Task 3: Create Consistency Validator Reference

**Files:**
- Create: `yiyue31-tech-article-translator/references/consistency-validator.md`

**Step 1: Write consistency validator specification**

```markdown
# Consistency Validator Specification

## Purpose
Post-translation validation to ensure terminology consistency.

## Validation Checks

### 1. Term Frequency Check
Compare expected vs actual term occurrences.

```yaml
validation:
  term: "useState"
  expected: 15
  actual: 14
  status: PASS # Within ±10% tolerance
```

### 2. Pattern Preservation Check
Ensure code patterns not translated.

```yaml
patterns:
  - original: "useState("
    translated: "useState("
    status: PASS
  - original: "<Component"
    translated: "<组件" # FAIL - should be preserved
    status: FAIL
```

### 3. Cross-Reference Consistency
Check same term translated consistently across sections.

```yaml
term: "Component"
section_1: "组件"
section_2: "部件" # FAIL - inconsistent
section_3: "组件"
status: FAIL
```

## Report Format

```markdown
## 🔍 Translation Consistency Report

### ✅ Preserved Terms
- useState (15 occurrences) - 100% consistent
- useEffect (8 occurrences) - 100% consistent

### ⚠️ Needs Review
- **Component**: 23 occurrences, 2 different translations
  - "组件" (21 times)
  - "部件" (2 times) - FLAG: Inconsistent

### 🆕 Suggested New Terms
- **useTransition**: 5 occurrences, pattern "useTransition("
```

## Error Recovery

| Issue | Action |
|-------|--------|
| Translated code pattern | Auto-revert, flag for review |
| Inconsistent translation | Highlight all instances, suggest fix |
| Missing term | Check if should be preserved |
```

**Step 2: Commit**

```bash
git add yiyue31-tech-article-translator/references/consistency-validator.md
git commit -m "docs: add consistency validator specification"
```

---

## Task 4: Update SKILL.md with Enhanced Workflow

**Files:**
- Modify: `yiyue31-tech-article-translator/SKILL.md`

**Step 1: Add new workflow section after Step 1**

Insert after "### Step 1: 分析文章主题" section:

```markdown
### Step 1.5: Context Scan (NEW)

Before translating, perform context scan:

1. **Extract potential terms**:
   - camelCase identifiers: useState, useEffect
   - PascalCase terms: Component, Props
   - Known glossary terms

2. **Build term context map**:
   ```yaml
   term_context_map:
     - term: "useState"
       occurrences: 15
       confidence: high
       context_patterns:
         - "useState("
         - "useState hook"
       disambiguated_as: "react_hook"
       translation_decision: preserve
   ```

3. **Display scan results**:
   ```markdown
   ## 🔍 Context Scan Complete

   Found **18 technical terms**:
   - ✅ High confidence: 12 terms
   - ⚠️ Medium confidence: 4 terms
   - ❓ Low confidence: 2 terms (flagged for review)

   **Flagged Terms:**
   - "state" (42 occurrences) - Multiple contexts detected
   - "hook" (8 occurrences) - Ambiguous usage
   ```

4. **Handle ambiguous terms** (if any):
   - Use AskUserQuestion to present context and ask for clarification
   - Update term context map with user's decision
```

**Step 2: Update translation rules section**

Find "### Step 3: 翻译文章内容" and update:

```markdown
**Translation rules**:
- **术语处理**: Use term context map for decisions
  - High confidence preserve: Keep in English
  - Medium confidence: Preserve with first-time Chinese annotation
  - Ambiguous: Use user's disambiguation decision
- **Preserve content**: 代码块、行内代码、URL、命令行完全保留
- **Format processing**: 保留所有markdown格式、emoji、图片链接
- **Context awareness**: Apply context-specific rules from disambiguation table
```

**Step 3: Add new step after translation**

Insert after "### Step 3: 翻译文章内容":

```markdown
### Step 3.5: Consistency Validation (NEW)

After translation, run consistency checks:

1. **Term frequency check**: Verify expected terms appear with correct frequency
2. **Pattern preservation check**: Ensure no code patterns were translated
3. **Cross-reference check**: Verify consistent translation across sections

Display consistency report (see `references/consistency-validator.md` for format).

If issues found:
- Highlight specific line numbers
- Suggest corrections
- Ask user to approve auto-fix or manual edit
```

**Step 4: Update YAML frontmatter template**

Find the YAML frontmatter section and add:

```yaml
---
title: {翻译后的中文标题}
original_title: {Original English Title}
source: {URL or file path}
author: {Original author if available}
translated_at: {YYYY-MM-DD}
translation_style: {literal|free}
topic: {identified topic}
tags: {auto-generated tags from content}
context_scan_summary: |
  Terms found: {N}
  Preserved: {N}
  Translated: {N}
consistency_score: {0-100}
---
```

**Step 5: Commit**

```bash
git add yiyue31-tech-article-translator/SKILL.md
git commit -m "feat: add context-aware translation workflow to SKILL.md"
```

---

## Task 5: Create Migration Script for Existing Glossaries

**Files:**
- Create: `yiyue31-tech-article-translator/scripts/migrate-glossary.py`

**Step 1: Write migration script**

```python
#!/usr/bin/env python3
"""Migrate existing glossaries to new schema with context patterns and examples."""

import re
import sys
from pathlib import Path


def migrate_glossary_file(input_file: Path, output_file: Path):
    """Migrate a single glossary file to new format."""

    with open(input_file, 'r', encoding='utf-8') as f:
        content = f.read()

    # Extract table rows
    table_pattern = r'\|(.+)\|\|(.+)\|\|(.+)\|'
    rows = re.findall(table_pattern, content)

    # Build new table
    new_rows = []
    for row in rows:
        term, explanation, notes = [cell.strip() for cell in row]

        # Add empty columns for context patterns and examples
        new_row = f"| {term} | {explanation} | {notes} | | |"
        new_rows.append(new_row)

    # Build new content
    new_content = content.split('\n')[0] + '\n'  # Keep title
    new_content += '\n'
    new_content += '| English Term | Chinese Explanation | Notes | Context Patterns | Examples |\n'
    new_content += '|--------------|-------------------|-------|------------------|----------|\n'
    new_content += '\n'.join(new_rows)

    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(new_content)

    print(f"Migrated: {input_file} -> {output_file}")
    print(f"  Migrated {len(rows)} terms")


def main():
    """Migrate all glossary files."""

    glossary_dir = Path(__file__).parent.parent / 'glossary'

    # Find all glossary files except template
    glossary_files = [
        f for f in glossary_dir.glob('*.md')
        if f.name != 'template.md'
    ]

    if not glossary_files:
        print("No glossary files found to migrate")
        return

    print(f"Found {len(glossary_files)} glossary files to migrate\n")

    for glossary_file in glossary_files:
        # Create backup
        backup_file = glossary_file.with_suffix('.md.backup')

        with open(glossary_file, 'r', encoding='utf-8') as f:
            backup_content = f.read()

        with open(backup_file, 'w', encoding='utf-8') as f:
            f.write(backup_content)

        # Migrate
        migrate_glossary_file(glossary_file, glossary_file)

    print(f"\nMigration complete!")
    print(f"Backup files created with .backup extension")


if __name__ == '__main__':
    main()
```

**Step 2: Test migration script**

```bash
cd yiyue31-tech-article-translator
python scripts/migrate-glossary.py
```

Expected: All glossary files updated with new columns

**Step 3: Commit**

```bash
git add yiyue31-tech-article-translator/scripts/migrate-glossary.py
git commit -m "feat: add glossary migration script"
```

---

## Task 6: Run Migration Script on Existing Glossaries

**Step 1: Backup current glossaries**

```bash
cd yiyue31-tech-article-translator/glossary
cp ai.md ai.md.pre-migration
cp template.md template.md.pre-migration
```

**Step 2: Run migration**

```bash
cd ../..
python yiyue31-tech-article-translator/scripts/migrate-glossary.py
```

**Step 3: Verify migration**

```bash
# Check that new columns exist
head -5 yiyue31-tech-article-translator/glossary/ai.md
```

Expected output should show: `| English Term | Chinese Explanation | Notes | Context Patterns | Examples |`

**Step 4: Commit migrated glossaries**

```bash
git add yiyue31-tech-article-translator/glossary/*.md
git commit -m "feat: migrate glossaries to new schema with context patterns"
```

---

## Task 7: Backfill AI Glossary with Context Patterns

**Files:**
- Modify: `yiyue31-tech-article-translator/glossary/ai.md`

**Step 1: Add context patterns for top 20 AI terms**

Update the table rows for these terms (examples):

```markdown
| LLM | 大语言模型 | GPT, Claude, etc. | `LLM`, "large language model", "GPT" | "GPT-4 is a large language model" |
| API | 应用程序接口 | Application Programming Interface | `API`, "API call", "endpoint" | "The API accepts POST requests" |
| RAG | 检索增强生成 | Retrieval-Augmented Generation | `RAG`, "retrieval augmented" | "RAG combines retrieval with generation" |
```

**Step 2: Commit**

```bash
git add yiyue31-tech-article-translator/glossary/ai.md
git commit -m "feat: backfill AI glossary with context patterns and examples"
```

---

## Task 8: Add New Test Cases to TEST_PLAN.md

**Files:**
- Modify: `yiyue31-tech-article-translator/TEST_PLAN.md`

**Step 1: Add Test 11 for context disambiguation**

Insert after "### Test 10: Long Article Handling":

```markdown
---

### Test 11: Context Disambiguation

**Input:**
```
Translate article with "hook" used in multiple contexts:
- "React Hook" (technical)
- "fishing hook" (general)
- "hook onto" (verb)
```

**Expected Steps:**
1. AI performs context scan
2. AI displays term context map showing 3 different contexts for "hook"
3. AI asks user for disambiguation decisions
4. User confirms: preserve "React Hook", translate others
5. AI translates with context-aware decisions
6. Consistency validator confirms correct handling

**Expected Output:**
```yaml
term_context_map:
  - term: "hook"
    occurrences: 8
    contexts:
      - "React Hook" (5 times) → preserved
      - "fishing hook" (2 times) → translated to "鱼钩"
      - "hook onto" (1 time) → translated to "钩住"
```

**Verification:**
- [ ] Context scan identifies all 3 contexts
- [ ] User asked for disambiguation
- [ ] "React Hook" preserved as English
- [ ] "fishing hook" translated to Chinese
- [ ] Consistency report shows correct handling
```

**Step 2: Add Test 12 for code pattern preservation**

```markdown
---

### Test 12: Code Pattern Preservation

**Input:**
```
Translate article with complex code examples:
- useState(0)
- useEffect(() => {})
- <Component prop={value} />
```

**Expected Steps:**
1. AI context scan identifies code patterns
2. Term context map marks all as HIGH confidence
3. Translation preserves all code syntax
4. Consistency validator validates pattern preservation

**Verification:**
- [ ] All function names preserved: useState, useEffect
- [ ] All method calls preserved: .map(), .filter()
- [ ] All JSX syntax preserved: <Component />
- [ ] No code syntax translated
- [ ] Consistency validator shows 100% pattern preservation
```

**Step 3: Add Test 13 for multi-section consistency**

```markdown
---

### Test 13: Multi-Section Consistency

**Input:**
```
Translate long article with 5 sections all mentioning "Component"
```

**Expected Steps:**
1. AI translates all sections
2. Consistency validator checks term usage across sections
3. Report shows consistent translation throughout

**Verification:**
- [ ] "Component" consistently translated in all sections
- [ ] Term count matches expected frequency
- [ ] No drift in translation style
- [ ] Consistency validator passes
```

**Step 4: Add Test 14 for edge cases**

```markdown
---

### Test 14: Edge Cases - Mixed Content

**Input:**
```
Translate article with:
- Code blocks
- Inline code in prose
- Nested structures
- Mixed technical and general content
```

**Expected Steps:**
1. AI context scan handles mixed content correctly
2. Translation preserves all code structures
3. No content corruption

**Verification:**
- [ ] Code blocks completely preserved
- [ ] Inline code in prose preserved
- [ ] Nested structures handled correctly
- [ ] No content corruption
- [ ] Formatting maintained
```

**Step 5: Commit**

```bash
git add yiyue31-tech-article-translator/TEST_PLAN.md
git commit -m "test: add context-aware translation test cases (Tests 11-14)"
```

---

## Task 9: Update README.md with New Features

**Files:**
- Modify: `yiyue31-tech-article-translator/README.md`

**Step 1: Update features list**

Replace the existing features list with:

```markdown
## Features

- **Smart Topic Detection**: Automatically identifies article theme (React, Python, Kubernetes, etc.)
- **Context-Aware Translation**: Two-pass translation with pre-scan for term context analysis
- **Term Disambiguation**: Handles context-dependent terms (hook, state, component) intelligently
- **Enhanced Glossary System**: Each topic maintains glossary with context patterns and examples
- **Consistency Validation**: Post-translation checks ensure terminology consistency
- **Term Preservation**: Words in glossary kept in English based on context confidence
- **Translation Styles**: Supports both literal (直译) and free (意译) modes
- **Auto Glossary Maintenance**: AI proactively identifies new terms with context awareness
- **User Confirmation**: Asks user before committing glossary updates
- **Git Auto-Commit**: Automatically commits glossary changes to local repository
```

**Step 2: Update workflow section**

Replace the workflow section with:

```markdown
## Workflow

1. **Analyze Article Topic**: Extract title, headings, identify domain
2. **Load Glossary**: Load existing glossary for the identified topic
3. **Context Scan**: Pre-scan article to build term context map
4. **Handle Ambiguity**: Ask user for clarification on ambiguous terms (if any)
5. **Ask Translation Style**: Choose between literal (直译) or free (意译)
6. **Translate with Awareness**: Use context map for intelligent term preservation
7. **Consistency Check**: Validate terminology consistency across translation
8. **Glossary Maintenance**: AI proposes new terms with context, user confirms
9. **Git Commit**: Auto-commit glossary changes (if repo exists)
```

**Step 3: Add context-aware section**

Insert before "## Translation Rules":

```markdown
## Context-Aware Translation

### Term Context Map

Before translation, the skill scans the article to understand term usage:

```markdown
## 🔍 Context Scan Complete

Found **18 technical terms**:
- ✅ High confidence: 12 terms (will preserve)
- ⚠️ Medium confidence: 4 terms (will preserve with annotation)
- ❓ Low confidence: 2 terms (flagged for review)

**Flagged Terms:**
- "state" (42 occurrences) - Multiple contexts detected
  - "component state" (35 times) → React context
  - "application state" (7 times) → General context
```

### Disambiguation Example

| Term | Context | Decision |
|------|---------|----------|
| hook | "use hook", "React hook" | Preserve as "Hook" |
| hook | "fishing hook" | Translate to "鱼钩" |
| state | "useState", "component state" | Preserve as "state" |
| state | "server state", "app state" | Translate to "状态" |
```

**Step 4: Update glossary format section**

Replace the glossary format example with:

```markdown
### Glossary File Format

```markdown
# Topic: React

| English Term | Chinese Explanation | Notes | Context Patterns | Examples |
|--------------|-------------------|-------|------------------|----------|
| useState | 状态钩子 | React Hook | `useState(`, "useState hook" | "useState allows you to add state" |
| Component | 组件 | React building block | `<Component`, "React component" | "<Component /> renders UI" |
```

**New columns:**
- **Context Patterns**: Code/text patterns for term identification
- **Examples**: Real usage examples for disambiguation
```

**Step 5: Commit**

```bash
git add yiyue31-tech-article-translator/README.md
git commit -m "docs: update README with context-aware translation features"
```

---

## Task 10: Update Version Number

**Files:**
- Modify: `yiyue31-tech-article-translator/SKILL.md`
- Modify: `yiyue31-tech-article-translator/README.md`

**Step 1: Update version in SKILL.md**

Find line: `> **Version:** 1.0.0`

Change to: `> **Version:** 2.0.0`

**Step 2: Update version in README.md**

Find line: `**Version**: 1.0.0`

Change to: `**Version**: 2.0.0`

**Step 3: Commit**

```bash
git add yiyue31-tech-article-translator/SKILL.md yiyue31-tech-article-translator/README.md
git commit -m "chore: bump version to 2.0.0 for context-aware release"
```

---

## Task 11: Create Quick Start Guide for New Features

**Files:**
- Create: `yiyue31-tech-article-translator/references/quick-start-context-aware.md`

**Step 1: Write quick start guide**

```markdown
# Context-Aware Translation Quick Start

## What's New in v2.0

### Context Scan Before Translation

The skill now performs a pre-translation scan to understand how technical terms are used in the article.

**Example:**

```
User: Translate this React article
AI: 🔍 Scanning article for term context...
    Found 23 technical terms
    ✅ High confidence: 18 terms
    ⚠️ Medium confidence: 4 terms
    ❓ Low confidence: 1 term (flagged for review)

    Flagged Term:
    "state" (42 occurrences) - Multiple contexts detected
    - "component state" (35 times) → React context
    - "application state" (7 times) → General context

    How should I handle "state" in "application state" context?
    [ ] Preserve as "state"
    [✓] Translate to "状态"
```

### Consistency Validation

After translation, the skill validates consistency:

```
AI: 🔍 Consistency Check
    ✅ All terms used consistently
    ✅ All code patterns preserved
    ⚠️ 1 minor inconsistency detected

    Line 142: "Component" translated as "部件"
    Other 22 occurrences: "组件"
    Suggestion: Change to "组件" for consistency
```

## Enhanced Glossaries

Glossaries now include:
- **Context Patterns**: Code/text patterns for identification
- **Examples**: Real usage examples for disambiguation

```markdown
| useState | 状态钩子 | React Hook | `useState(`, "useState hook" | "useState allows..." |
```

## Usage Tips

1. **Review context scan results** - Check flagged terms before translation
2. **Provide disambiguation** - Help the AI understand ambiguous terms
3. **Check consistency report** - Review and fix any inconsistencies
4. **Contribute examples** - Add examples to glossaries for better future translations

## Migration

Existing glossaries are automatically migrated to the new format. Backups are created with `.backup` extension.
```

**Step 2: Commit**

```bash
git add yiyue31-tech-article-translator/references/quick-start-context-aware.md
git commit -m "docs: add quick start guide for context-aware translation"
```

---

## Task 12: Create Test Article for Validation

**Files:**
- Create: `yiyue31-tech-article-translator/tests/test-context-disambiguation.md`

**Step 1: Create test article**

```markdown
# Test Article: Context Disambiguation

This article tests the translator's ability to handle ambiguous terms in different contexts.

## React Hooks

React Hooks allow you to use state and other React features without writing a class. The `useState` hook is commonly used for state management. When you call `useState(0)`, you get the current state value and a function to update it.

## State Management

Component state is different from application state. Component state is managed with `useState`, while application state might use a library like Redux or Zustand.

## Code Example

\```javascript
import { useState, useEffect } from 'react';

function Counter() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    document.title = `Count: ${count}`;
  }, [count]);

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>
        Increment
      </button>
    </div>
  );
}
\```

## Ambiguous Terms

Notice how "state" appears in different contexts:
- "useState" - Function name (preserve)
- "component state" - React concept (preserve or annotate)
- "application state" - General concept (translate)

The hook (fishing tool) is different from a React Hook. One catches fish, the other manages React lifecycle.
```

**Step 2: Commit**

```bash
git add yiyue31-tech-article-translator/tests/test-context-disambiguation.md
git commit -m "test: add context disambiguation test article"
```

---

## Summary

This implementation plan adds context-aware translation capabilities to the translator skill through:

1. **Glossary schema enhancement** - Added context patterns and examples columns
2. **Context scanner** - Pre-translation term analysis and disambiguation
3. **Consistency validator** - Post-translation consistency checks
4. **Migration tooling** - Scripts to migrate existing glossaries
5. **Test coverage** - New test cases for context-aware features
6. **Documentation** - Updated README, quick start guide, and specifications

**Total tasks:** 12
**Estimated time:** 4-6 hours
**Complexity:** Medium

Each task is bite-sized (2-5 minutes) and includes exact file paths, complete code, and commit messages.
