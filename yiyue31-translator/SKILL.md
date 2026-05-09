---
name: yiyue31-translator
description: 当用户输入"翻译"，"translate" "translate article", "translate to Chinese", "改成中文"，"convert to Chinese"等指令时启用。当用户提供url、文件路径、直接粘贴内容，并表达翻译意图时启用。
version: 2.0.0
author: Yiyue31
---

# Tech Article Translator Skill

## Description

Professional translator that converts English articles to Chinese with topic-based glossary management, translation style selection, and a generate-evaluate loop for translation quality assurance.

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

4. **Translation style**: Literal or Free, default Literal
5. **Output filename**: Specify the save filename, default uses translated title

---
## Reusable Sub-workflows

### Generate-Evaluate Loop

Iterative refinement: generate → evaluate → revise. Used by Step 2 and Step 4.

**Parameters (caller provides):**
- `{max-rounds}`: Maximum iterations
- `{threshold}`: Passing score out of 10
- `{eval-prompt}`: Path to evaluation prompt file
- `{round-file}`: Save pattern for round N output (include `{N}` placeholder for round number)
- `{final-file}`: Final output path on pass
- `{eval-file}`: Save pattern for evaluation report (include `{N}` placeholder)
- `{eval-context}`: Additional context to pass to evaluator (original article, glossary, style, etc.)
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

### Evaluate Once

Single-shot evaluation, no loop.

**Parameters:** `{eval-prompt}`, `{input-file}`, `{output-file}`, `{threshold}` (default 8.0).

**Procedure:** Call subagent with `{eval-prompt}`, providing `{input-file}` content. Save report to `{output-file}`. Extract total score from `**[X/10]**` line. Score ≥ `{threshold}` → PASS, else FAIL.

---
## Translation Workflow

### Step 1: Retrieve Article Content

Retrieve article content based on input type:

- **URL input**: Use web-access skill to fetch the article. Alternatively, use `wget` or `curl`.
- **File path input**: Use the `Read` tool.
- **Direct paste**: Process directly.
- **Missing content**: Ask the user.

**Processing:**
1. Extract title (priority: heading → filename → first sentence words → `untitled-{timestamp}`). Sanitize filesystem-unsafe characters (`/ \ : * ? " < > |`).
2. File naming rule: lowercase, words connected with hyphens.
3. If `{title}/translation/` exists, delete it.
4. If not markdown, convert preserving structure. Unconvertible elements: keep original with comments.
5. If unsure about conversion, ask user to confirm.
6. Save to `{title}/translation/original-{title}.md`.

### Step 2: Topic Analysis & Glossary (Generate-Evaluate Loop)

**Analysis requirements:**
- **Topic identification**: Read glossary list from `{skill-dir}/glossary/`. Extract title, h2/h3 headings, keywords. Match against glossary topics. AI determines best topic — notify user, no confirmation needed.
- **Language check**: If primarily Chinese (>50%) or non-English, ask user to confirm.
- **Glossary**: Load `{skill-dir}/glossary/{topic}.md`, identify terms to keep in English. Scan for terms not in glossary.
- **Hyperlinks**: Extract from original article.

**Run Generate-Evaluate Loop:**
- `{max-rounds}`: 3, `{threshold}`: 8.0
- `{eval-prompt}`: `{skill-dir}/references/evaluate-topic-prompt.md`
- `{round-file}`: `{title}/translation/analysis-topic-round{N}-{title}.md`
- `{final-file}`: `{title}/translation/analysis-topic-{title}.md`
- `{eval-file}`: `{title}/translation/evaluation-topic-round{N}-{title}.md`
- `{eval-context}`: original article content, glossary file list from `{skill-dir}/glossary/`

**After loop passes** — user interaction:

Display to user:
```markdown
## Article Analysis

**Original Title**: {Original English Title}
**Language**: {from} → {to}
**Identified Topic**: {Topic Name}
**Glossary Loaded**: {skill-dir}/glossary/{topic}.md ({N} terms)
**New Terms**: {list of new terms found}
```

1. Use AskUserQuestion for new terms: add all, add partial, skip, or custom input. Append confirmed terms to `{skill-dir}/glossary/{topic}.md`.
2. Ask translation style:

| Option | Description |
|--------|-------------|
| Literal | Word-by-word, preserve original structure, suitable for technical docs |
| Free | Adapt to Chinese conventions, restructure sentences, suitable for blogs |

Default: **Literal**.

### Step 3: Special Phrases Extraction

**Exclusions**: Skip terms already in the glossary.

**Targets and translation rules:**
- **Golden quotes**: Insightful, summarizing, or strongly opinionated sentences. Preserve expressiveness, append original as annotation.
- **Hyphenated phrases**: Technical phrases with "-" (e.g., "agent-based", "one-feature-at-a-time"). Keep original, append original as annotation.
- **Idioms and slang**: (e.g., "hit the ground running", "low-hanging fruit"). Translate naturally, append original as annotation.

**Output format:**

| Location | Original | Chinese Translation (English original) |
|----------|----------|----------------------------------------|
| 1.2 | "This approach allows us to hit the ground running." | "这种方法让我们能够立刻投入工作（hit the ground running）" |

Save to: `{title}/translation/special-phrases-{title}.md`.

### Step 4: Translate (Generate-Evaluate Loop)

**Translation rules:**
- **Accuracy first**: Facts, data, logic must perfectly match the original. No additions, deletions, or subjective alterations. Translate from the reader's perspective.
- **Terminology**: Use glossary-specified translations. On first occurrence: keep English with Chinese annotation (e.g., `Prompt(提示词)`).
- **Rhetoric**: Translate metaphors and idioms by intent, not word-by-word. Replace with equivalent Chinese expressions when cultural connotations differ.
- **Format**: Preserve all Markdown formatting. For detailed rules, refer to `{skill-dir}/references/markdown-format-checklist.md`.
- **Image text**: Verify image text language matches translation.
- **Translator notes**: Add concise notes only when necessary: `Chinese（English original, explanation）`.
- **Special phrases**: Follow Chinese Translation column from Step 3.
- **Golden quotes, idioms, slang**: Bold: `**{golden quote}**`.
- **Links**: Preserve URLs, translate link text.

**Free translation additional rules** (skip when Literal):
- Translate core intent, restructure freely when literal translation is stiff.
- Preserve emotional connotations, not just dictionary definitions.
- Use natural Chinese word order.

**Run Generate-Evaluate Loop:**
- `{max-rounds}`: 5, `{threshold}`: 8.0
- `{eval-prompt}`: `{skill-dir}/references/evaluate-translation-prompt.md`
- `{round-file}`: `{title}/translation/translated-round{N}-{title}-zh.md`
- `{final-file}`: `{title}/translation/translated-{title}-zh.md`
- `{eval-file}`: `{title}/translation/evaluation-round{N}-{title}.md`
- `{timer-tag}`: `{title}`, `{timeout-seconds}`: 1800
- `{eval-context}`: original article, glossary, translation style (Literal/Free), special phrases table from Step 3

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
translation_style: literal or free
topic: {topic}
language: English → Chinese
word_count: {from word-counter}
---
```

- Run final word count: `node {skill-dir}/scripts/word-counter.js {title}/translation/translated-{title}-zh.md`
- Inform user, provide file path.

---
## Glossary

File location: `{skill-dir}/glossary/{topic}.md`

```markdown
# Topic: {Topic Name}

| English Term | Translation |
|--------------|-------------|
| AI | [KEEP] |
| Agent | 智能体 |
| API Gateway | API 网关 |
```

- **[KEEP]**: Do not translate, keep English
- **Chinese translation**: Always translate as specified
