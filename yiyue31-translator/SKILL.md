---
name: yiyue31-translator
description: Use when the user inputs commands such as 'translate', 'translate article', 'translate to Chinese', '翻译','翻译成中文', '改成中文', or 'convert to Chinese'. Use when the user provides a URL, file path, or pastes content directly while expressing an intent to translate.
version: 2.0.0
author: Yiyue31
---

# Tech Article Translator Skill

## Description

Professional translator that converts English articles to Chinese with translation corrections and a generate-evaluate loop for translation quality assurance.

---
## Directory

`{skill-dir}` = this SKILL.md's directory path. It means the directory where this SKILL.md is located.

---
## User Input

### Required Input

User should provide one of the following:

1. **Article URL**: URL of the English article
2. **File path**: Local file path
3. **Article content**: Directly pasted English article content

### Optional Input

4. **Translation style**: `Free` (default) or `Literal`. Only used when user explicitly specifies.
5. **Output filename**: Specify the save filename, default uses translated title

---
## Reusable Sub-workflows

### Generate-Evaluate Loop

Iterative refinement: generate → evaluate → revise. Used by Step 4.

**Parameters (caller provides):**
- `{max-rounds}`: Maximum iterations
- `{threshold}`: Passing score out of 10
- `{eval-prompt}`: Path to evaluation prompt file
- `{round-file}`: Save pattern for round N output (include `{N}` placeholder for round number)
- `{final-file}`: Final output path on pass
- `{eval-file}`: Save pattern for evaluation report (include `{N}` placeholder)
- `{eval-context}`: Additional context to pass to evaluator (original article, corrections, style, etc.)
- `{timer-tag}`: Optional timer tag for global timeout. When set, also provide `{timeout-seconds}`.

**Procedure:**
1. If `{timer-tag}` provided: `node {skill-dir}/scripts/timer.js start --tag {timer-tag}`.
2. **Each round N** (1 to `{max-rounds}`):
   - If `{timer-tag}` provided: `node {skill-dir}/scripts/timer.js check --tag {timer-tag} --timeout {timeout-seconds}`. If `"expired": true` → use best candidate as final → exit.
   - Round 1: full generation per caller spec. Round 2+: revise based on previous evaluation Issues table + original input.
   - Save to `{round-file}` (replace `{N}` with round number).
   - **Evaluate**: call subagent with `{eval-prompt}`, providing round output and `{eval-context}` as input. Save report to `{eval-file}` (replace `{N}`).
   - **Extract score**: parse the `**[X/10]**` total line from evaluation report. Score ≥ `{threshold}` → copy to `{final-file}` → **PASS, exit loop**. Score < `{threshold}` → track as best candidate if highest so far, next round.
3. **Rounds exhausted**: copy best candidate to `{final-file}`, report score.

---
## Translation Workflow

### Step 1: Retrieve Article Content

Retrieve article content based on input type:

- **URL input**: Use web-access skill to fetch the article. Alternatively, use `wget` or `curl`.
- **File path input**: Use the `Read` tool.
- **Direct paste**: Process directly.
- **Missing content**: Ask the user.

**Processing:**
1. Extract title (priority: heading → filename → first sentence words → `untitled-{timestamp}`). Sanitize filesystem-unsafe characters (`/ \ : * ? " < > |`). Truncate to 60 characters if longer.
2. File naming rule: lowercase, words connected with hyphens.
3. If `{title}/translation/` exists, delete it.
4. If not markdown, convert preserving structure. Unconvertible elements: keep original with comments.
5. Save to `{title}/translation/original-{title}.md`.

### Step 2: Load Corrections

1. Load `{skill-dir}/references/terms.md`. If file doesn't exist, proceed without corrections.
2. **Language check**: If the article is primarily Chinese or non-English, warn user that this skill is designed for English-to-Chinese translation. Offer to proceed or abort.
3. Extract hyperlinks from original article.

### Step 3: Special Phrases Extraction

**Exclusions**: Skip terms already in corrections.

**Targets and translation rules:**
- **Golden quotes**: Insightful, summarizing, or strongly opinionated sentences. Preserve expressiveness, append original as annotation.
- **Hyphenated phrases**: Technical phrases with "-" (e.g., "agent-based", "one-feature-at-a-time"). Keep original, append original as annotation.
- **Idioms and slang**: (e.g., "hit the ground running", "low-hanging fruit"). Translate naturally, append original as annotation.

**Output format:**

| Location | Original | Translation（附原文） |
|----------|----------|----------------------------------------|
| 1.2 | "This approach allows us to hit the ground running." | "这种方法让我们能够立刻投入工作（hit the ground running）" |

Save to: `{title}/translation/special-phrases-{title}.md`.

### Step 4: Translate (Generate-Evaluate Loop)

**Translation rules (Free style — default):**
- **Accuracy first**: Facts, data, logic must perfectly match the original. No additions, deletions, or subjective alterations. Translate from the reader's perspective.
- **Free expression**: Translate core intent, restructure freely when literal translation is stiff. Preserve emotional connotations. Use natural Chinese word order.
- **Terminology**: Use corrections-specified translations. On first occurrence: keep English with Chinese annotation (e.g., `Prompt(提示词)`).
- **Rhetoric**: Translate metaphors and idioms by intent, not word-by-word. Replace with equivalent Chinese expressions when cultural connotations differ.
- **Format**: Preserve all Markdown formatting.
- **Chinese-English spacing**: 1 space between Chinese and English/numbers (e.g., `这是 English 文本`). When English term is followed by `(中文)`, keep a space between term and `(` (e.g., `Generator (生成器)`, not `Generator(生成器)`).
- **Image text**: Do not translate image URLs or functional alt text. If an image contains visible English text, add a translator note below: `![...](url) *图注：图片中文字译为 [中文翻译]*`
- **Translator notes**: Add concise notes only when necessary: `Chinese（English original, explanation）`.
- **Special phrases**: Follow Chinese Translation column from Step 3.
- **Golden quotes, idioms, slang**: Bold: `**{golden quote}**`.
- **Links**: Preserve URLs, translate link text.

**Literal style** (only when user specifies): Skip "Free expression" rule above. Word-by-word translation preserving original sentence structure.

**Run Generate-Evaluate Loop:**
- `{max-rounds}`: 5, `{threshold}`: 8.0
- `{eval-prompt}`: `{skill-dir}/references/evaluate-translation-prompt.md`
- `{round-file}`: `{title}/translation/translated-round{N}-{title}-zh.md`
- `{final-file}`: `{title}/translation/translated-{title}-zh.md`
- `{eval-file}`: `{title}/translation/evaluation-round{N}-{title}.md`
- `{timer-tag}`: `{title}`, `{timeout-seconds}`: 1800
- `{eval-context}`: original article, corrections (terms from terms.md that appear in the article), translation style (Literal/Free), special phrases table from Step 3

After each round save, run word count: `node {skill-dir}/scripts/word-counter.js {title}/translation/translated-round{N}-{title}-zh.md`, display results.

**After loop completes:**
- Add YAML frontmatter to final translation file:

```yaml
---
title: {translated title}
source_title: {original English title}
source_url: {url or empty}
source_author: {author or empty}
translated_at: {date}
translation_style: free or literal
language: English → Chinese
word_count: {totalWords from word-counter output}
---
```

- Run final word count: `node {skill-dir}/scripts/word-counter.js {title}/translation/translated-{title}-zh.md`
- Display summary:
```markdown
## Translation Complete

**Source**: {original title}
**Style**: Free
**Corrections loaded**: {N} terms from terms.md
**New corrections added**: {list of auto-appended terms, or "none"}
**File**: {title}/translation/translated-{title}-zh.md
```

### Step 5: Terms Maintenance

After translation, run a subagent to maintain terms.md based on actual evidence from the translation output.

**Input to subagent**: original article, final translation, current terms.md content.

**Subagent task:**
1. Compare original article with translation. Identify English terms where the LLM **actually translated incorrectly** (e.g., "agent" became "代理" instead of "智能体"). Add these as new entries to terms.md.
2. Review existing terms.md entries. If the LLM correctly translated a term **without needing the correction** (i.e., removing the entry would not change the translation outcome), flag it for removal.
3. Update terms.md: append new entries, remove flagged entries.

**Criteria for addition**: Only add terms where the translation output contains verifiable evidence of mistranslation.
**Criteria for removal**: Only remove terms where the LLM consistently gets the translation right across the entire article, suggesting the entry is unnecessary.

**Display to user:**
```markdown
## Terms Update

+ Added: {list of new terms, or "none"}
- Removed: {list of removed terms, or "none"}
→ terms.md now has {N} entries
```

---
## Corrections

File location: `{skill-dir}/references/terms.md`

Only include terms where the LLM would produce a wrong or inconsistent translation without this entry.

```markdown
| English Term | Correct Translation |
|--------------|---------------------|
| agent | 智能体 |
| prompt | 提示词 |
| MCP | [KEEP] |
```

- **[KEEP]**: Do not translate, keep English
- **Chinese translation**: Use this instead of LLM's default
