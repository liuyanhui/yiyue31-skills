---
name: yiyue31-summary
description: Use when user asks to "summarize article", "summarize tech post", "summarize research paper", "summarize documentation", "summarize", "生成总结", "总结文章", or provides URLs/files that need summarization.
version: 2.2.0
---

# Tech Article Summarizer

## Description

Article summary generator for summarizing technical articles, blog posts, research papers, documentation, and other content. Supports multiple summary templates to meet different needs. Analyzes article content, extracts key points and highlights, and generates structured, easy-to-read summaries.

## Requirements
- Except for direct human quotes, avoid overly colloquial language during summarization. Maintain a professional, clear, and concise style.
- Summarize from the reader's perspective, not the author's. Readers want to quickly grasp key information, not reconstruct the author's writing process.
- **Output language**: Generate the summary in English regardless of the source article's language. The Chinese version is produced in Step 6. (The Step 2 analysis may follow the source language; the summary itself stays English so the Steps 4-5 quality checks apply consistently.)
---
## Directory

`{skill-dir}` = this SKILL.md's directory path. It means the directory where this SKILL.md is located.

---

## Reusable Sub-workflows

### Evaluate Once

Single-shot evaluation: call subagent, get scored report, pass or fail. No loop.

**Parameters (caller provides):**
- `{eval-prompt}`: Evaluate prompt file path (e.g. `{skill-dir}/references/evaluate-analysis-prompt.md`)
- `{input-file}`: File to evaluate
- `{output-file}`: Where to save the evaluation report
- `{threshold}`: Passing score, default 8.0

**Procedure:**
1. Call subagent with `{eval-prompt}` as prompt, providing `{input-file}` content as input.
2. Save the evaluation report to `{output-file}`.
3. Extract total score from report.
   - Score ≥ `{threshold}` → **PASS**
   - Score < `{threshold}` → **FAIL**

**Returns:** PASS/FAIL + evaluation report path.

**Loop constraint:** When Evaluate Once is called within a generate-evaluate loop, the evaluator MUST use the same LLM throughout all rounds — switching mid-loop is FORBIDDEN. Different LLMs apply different scoring standards; switching mid-loop makes scores non-comparable across rounds.

### Generate-Evaluate Loop

Repeatedly generate (or revise) an artifact and score it until the score meets the threshold or rounds are exhausted. Built on **Evaluate Once**; used by Steps 2 and 4.

**Parameters (caller provides):**
- `{generate-prompt}`: Generation prompt file path (e.g. `{skill-dir}/references/analysis-prompt.md`)
- `{generate-inputs}`: Inputs to the generator each round — the fixed sources, plus from round 2 on the previous round file and previous evaluation report (as improvement advice)
- `{eval-prompt}`: Evaluation prompt file path (delegated to **Evaluate Once**)
- `{round-file}`: Where to save each round's draft, with `{N}` substituted (e.g. `{title}/summary/{type}-round{N}-{title}.md`)
- `{eval-file}`: Where to save each round's evaluation report, with `{N}` substituted (e.g. `{title}/summary/evaluation-{type}-round{N}-{title}.md`)
- `{best-file}`: Where to copy the best result (e.g. `{title}/summary/{type}-{title}.md`)
- `{max-rounds}`: Round cap
- `{threshold}`: Passing score, default 8.0
- `{timeout-check}` (optional): A command run at the start of each round; if it reports `"expired": true`, stop early and keep the best-so-far

**Procedure:**
1. **Each round N (1..{max-rounds}):**
   - (If `{timeout-check}`) run it; if expired, copy the best-so-far round to `{best-file}` and stop.
   - Generate/revise via `{generate-prompt}`: round 1 produces a fresh draft from `{generate-inputs}`; later rounds revise the previous round to resolve every item in the previous `{eval-file}`. Save to `{round-file}`.
   - Evaluate (same pattern as **Evaluate Once**): call subagent with `{eval-prompt}`, save report to `{eval-file}`.
   - Extract total score:
     - Score ≥ `{threshold}` → **PASS** → copy current round file to `{best-file}` → return.
     - Score < `{threshold}` → **FAIL** → track this round as best candidate if it is the highest score so far → next round.
2. **Rounds exhausted**: copy the best-scoring round file to `{best-file}`, inform user of the score → return.

**Returns:** best result path + final score.

---

## Summary Workflow

The complete step-by-step process from input to final output:

### Step 1: Preprocess Content And Title

Initialize content based on the input type:
- **URL input**: Prefer locally installed skills such as: web-access skill, etc. Alternatively, use `wget` or `curl` or other tools to open the web page and download the article content.
- **File path input**: Use the `Read` tool to read the file content
- **Direct paste**: Process the input content directly

Title extraction rules:
- Extract the title from the original article/file/pasted content. Priority: article title → file name → first few words of the first sentence.
- Keep the title short (≤ 5 words) and path-safe: lowercase letters, numbers, and hyphens only (use hyphens to join words, no spaces). This value is used as a directory name and in filenames.

If original content is not in markdown format, convert it to markdown format.

**Convert Rules**
- Use subagent.
- Provide clear instructions to the subagent to:
   - Convert content as markdown file.
   - Preserve the original structure and format during conversion. Try to keep paragraphs, headings, lists, etc. unchanged. For elements that cannot be accurately converted, keep the original text and add comments to prompt the user to check.
   - input: original content or file path
   - output: markdown content.
- Save to: `{title}/summary/original-{title}.md`.

### Step 2: Analyze Article (Generate-Evaluate Loop)

**Loop parameters:** max 3 rounds, passing threshold score ≥ 8.0.

Run a **Generate-Evaluate Loop** with these parameters:

- `{generate-prompt}`: `{skill-dir}/references/analysis-prompt.md`
- `{generate-inputs}`: original article `{title}/summary/original-{title}.md`; from round 2, also the previous round draft `{title}/summary/analysis-round{N-1}.md` and its evaluation `{title}/summary/evaluation-analysis-round{N-1}.md` as improvement advice
- `{eval-prompt}`: `{skill-dir}/references/evaluate-analysis-prompt.md`
- `{round-file}`: `{title}/summary/analysis-round{N}.md`
- `{eval-file}`: `{title}/summary/evaluation-analysis-round{N}.md`
- `{best-file}`: `{title}/summary/analysis-{title}.md`
- `{max-rounds}`: 3
- `{threshold}`: 8.0

On PASS or rounds-exhausted → proceed to Step 3.

### Step 3: Template Selection

Auto-select template based on Step 2 analysis results. No user input required unless explicitly requested.

- **Paper signals** (methods, experiments, results, citations, academic tone) → Paper Template
- **Default** → Tech Article Template
- **Concise Template** → only when user explicitly requests it

If the user specified a template in their initial input, use that instead.

### Step 4: Summary Generate-Evaluate Loop

Generate and polish the summary in a single scored loop. Polishing is folded in as revision rounds — the summary eval's Expression Quality dimension already covers naturalness, readability, and professionalism, so a separate polish pass is unnecessary.

Run a **Generate-Evaluate Loop** with these parameters:

- `{generate-prompt}`: `{skill-dir}/references/generate-summary-prompt.md`
- `{generate-inputs}`: analysis `{title}/summary/analysis-{title}.md` + selected template (Step 3) + original article `{title}/summary/original-{title}.md`; from round 2, also the previous round draft and its evaluation as improvement advice
- `{eval-prompt}`: `{skill-dir}/references/evaluate-prompt.md`
- `{round-file}`: `{title}/summary/summary-round{N}-{title}.md`
- `{eval-file}`: `{title}/summary/evaluation-round{N}-{title}.md`
- `{best-file}`: `{title}/summary/summary-{title}.md`
- `{max-rounds}`: 5
- `{threshold}`: 8.0
- `{timeout-check}`: at loop start `node {skill-dir}/scripts/timer.js start --tag {title}`; at the start of each round `node {skill-dir}/scripts/timer.js check --tag {title} --timeout 1800` (30 min)

Each round, also run `node {skill-dir}/scripts/word-counter.js {title}/summary/summary-round{N}-{title}.md` to display word count (advisory).

On PASS or rounds-exhausted → proceed to Step 5.

### Step 5: Reader Experience Check (max 5 rounds)

Detect and fix reader-facing issues — AI-generated tone artifacts and readability problems — in a single loop. Each round runs both checks on the current summary, then applies all suggested fixes; the loop ends when both reports come back clean. (The prior Step 6 AI tone and Step 7 readability are merged here — both are detect-fix passes over the same final text, so running them together avoids a redundant pass.)

**Loop procedure:**
1. **Each round**:
   - AI tone check: call subagent with `{skill-dir}/references/evaluate-ai-tone-prompt.md`, providing the current summary as input. Save report to `{title}/summary/evaluation-ai-tone-round{N}-{title}.md`.
   - Readability check: call subagent with `{skill-dir}/references/evaluate-readability-prompt.md`, providing the same current summary as input. Save report to `{title}/summary/evaluation-readability-round{N}-{title}.md`.
   - If both reports indicate no issues → copy current summary to `{title}/summary/final-{title}.md` → Step 6.
   - Otherwise: parse all issues from both reports and apply the suggested fixes to the summary, next round.
2. **Rounds exhausted (5 rounds)**: copy current summary to `{title}/summary/final-{title}.md`, inform user that some reader-experience issues may remain → Step 6.

**Note:** Fixes are applied to the working summary and carried across rounds; intermediate rounds are not saved as separate files (unlike Steps 2/4). Only the final result is written to `final-{title}.md`. Each round's evaluation reports are still saved.

### Step 6: Translate Summary to Chinese

Translate the final summary into Chinese.

**Input:**
- Summary: `{title}/summary/final-{title}.md`
- Analysis: `{title}/summary/analysis-{title}.md` (from Step 2)

**Procedure:**
1. Invoke a subagent with the `yiyue31-translator` skill, providing both the summary and the analysis as input. Use default options (free translation style) for all choices. Do not prompt the user for confirmation.
2. After translation completes, copy the entire `{title}/translation/` directory to `{title}/summary/translation/`.
3. Inform the user of both file paths:
   - Original summary: see Input above
   - Chinese translation: `{title}/summary/translation/translated-{title}-zh.md`

**Verbatim handling** (include in subagent prompt):
`[Verbatim]...[/Verbatim]` markers indicate content requiring special care during translation. See the analysis Quotes table for context on each item. Preserve the markers and ***bold italic*** formatting in the output.

**Fallback:**
- If `yiyue31-translator` is not found, check for any other installed translation skill and use it instead.
- If no translation skill is installed, inform the user: "No translation skill found. Summary saved at Input path above. Install a translation skill to enable Chinese translation." → done.

---

## Available Templates

- **Tech Article Template**: Tech article summary template - Suitable for technical articles, tech blogs, tech announcements, etc. Provides comprehensive analysis and summary, highlighting innovations and practical value. See `{skill-dir}/templates/tech-article.md`. **Default template**.
- **Paper Template**: Paper summary template - Suitable for academic paper summaries, helping readers quickly learn and understand the core content and innovations of the paper. See `{skill-dir}/templates/paper.md`.
- **Concise Template**: Concise summary template - Focused on core knowledge, suitable for quick learning. See `{skill-dir}/templates/concise.md`. Only used when user explicitly requests it.


**Notes**
- Follow the steps strictly in order. Do not skip any step.
- Save the output of each step locally.
- The output of each step must conform to markdown format requirements, especially heading levels, list indentation, code block formatting, and table formatting.
