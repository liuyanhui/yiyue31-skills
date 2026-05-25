---
name: yiyue31-summary
description: Use when user asks to "summarize article", "summarize tech post", "summarize research paper", "summarize documentation", "summarize", "生成总结", "总结文章", or provides URLs/files that need summarization.
version: 2.1.0
---

# Tech Article Summarizer

## Description

Article summary generator for summarizing technical articles, blog posts, research papers, documentation, and other content. Supports multiple summary templates to meet different needs. Analyzes article content, extracts key points and highlights, and generates structured, easy-to-read summaries.

## Requirements
- Except for direct human quotes, avoid overly colloquial language during summarization. Maintain a professional, clear, and concise style.
- Summarize from the reader's perspective, not the author's. Readers want to quickly grasp key information, not reconstruct the author's writing process.
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
- Keep title short(less than 5 words), only using letters, numbers, and hyphens. 

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

**Loop procedure:**
1. **Each round**:
   - Use subagent to analyze. 
   - Prompt: `{skill-dir}/references/analysis-prompt.md`
   - Input: 
      - original article: `{title}/summary/original-{title}.md`
      - previous round analysis (if applicable): `{title}/summary/analysis-round{N}.md`
      - improvement advice (if applicable): `{title}/summary/evaluation-analysis-round{N-1}.md`
   - Output: `{title}/summary/analysis-round{N}.md`.

   - Use subagent to evaluate the above analysis.
   - Prompt: `{skill-dir}/references/evaluate-analysis-prompt.md`
   - Input: 
      - original article: `{title}/summary/original-{title}.md`
      - analysis: `{title}/summary/analysis-round{N}.md`
   - Output: `{title}/summary/evaluation-analysis-round{N}.md`

   - Extract total score from report.
      - Score ≥ 8.0 → **PASS** → copy current round file to `{title}/summary/analysis-{title}.md` → Step 3.
      - Score < 8.0 → **FAIL** → track best candidate, next round.

2. **Rounds exhausted**: copy best-scoring round file to `{title}/summary/analysis-{title}.md`, inform user of score → Step 3.

### Step 3: Template Selection

Auto-select template based on Step 2 analysis results. No user input required unless explicitly requested.

- **Paper signals** (methods, experiments, results, citations, academic tone) → Paper Template
- **Default** → Tech Article Template
- **Concise Template** → only when user explicitly requests it

If the user specified a template in their initial input, use that instead.

### Step 4: Summary Generate-Evaluate Loop

**Summary formatting rules:**
- Keep important content: processes, concepts, technical details, etc.
- Highlight quotes and key terms in blockquote `>` format as separate paragraphs.
- Verbatim content (memorable quotes, slang, idioms, notable original phrasing) must appear **inline within the body text**, wrapped in `[Verbatim]...[/Verbatim]` markers and formatted as ***bold italic***. Do NOT place them in a separate section or as standalone blockquote paragraphs.
  - Example: The author argues that ***[Verbatim]the only way to go fast is to go well[/Verbatim]***, which challenges the common rush-to-ship mentality.
  - Each verbatim item should appear in the paragraph where its context is discussed, so readers see the original wording in situ.
- Any non-heading sentence must end with punctuation. Incomplete sentences break readability and signal unfinished content.
- Keep key code/algorithm snippets as-is; simplify supporting code into descriptions or pseudocode. Full code bloats the summary; descriptions preserve the logic without the noise.
- Organize content following the original article's flow (content/chronology/logic).
- Only based on the provided article content. Do not fabricate or add external knowledge (except proper nouns such as company/person/product names). Readers rely on the summary to represent what the original article actually says; fabricated content undermines trust.
- Word count must not exceed the original article word count. A summary longer than the original defeats the purpose of summarization.
- Write naturally to avoid AI-generated tone artifacts. Vary punctuation: use commas, colons, parentheses, or separate sentences instead of em dashes (—) for mid-sentence additions. Avoid template openings and closings (e.g., "In today's rapidly evolving landscape").

**Loop parameters:** max 5 rounds, global timeout 30 min, passing threshold score ≥ 8.0 (out of 10).

**Loop procedure:**
1. **Start timer**: `node {skill-dir}/scripts/timer.js start --tag {title}`
2. **Each round**:
   - Check timeout: `node {skill-dir}/scripts/timer.js check --tag {title} --timeout 1800`. If `"expired": true`, copy best summary so far to `{title}/summary/summary-{title}.md` → Step 5.
   - Round 1: Generate summary from analysis. Later rounds: revise based on previous evaluation Issues table + original article.
   - Save to `{title}/summary/summary-round{N}-{title}.md`. Run `node {skill-dir}/scripts/word-counter.js {title}/summary/summary-round{N}-{title}.md` to verify word count, display results.
   - Evaluate (same pattern as **Evaluate Once**): call subagent using `{skill-dir}/references/evaluate-prompt.md`, save report to `{title}/summary/evaluation-round{N}-{title}.md`.
   - Score ≥ 8.0 → copy current round file to `{title}/summary/summary-{title}.md` → Step 5. Score < 8.0 → track best candidate, next round.
3. **Rounds exhausted**: copy best-scoring round file to `{title}/summary/summary-{title}.md`, inform user of score → Step 5.

### Step 5: Summary Polishing (Generate-Evaluate Loop)

**Loop parameters:** max 3 rounds, passing threshold score ≥ 8.0.

**Loop procedure:**
1. **Each round**:
   - Round 1: polish summary from Step 4. Later rounds: re-polish based on previous evaluation Issues table.
   - Save to `{title}/summary/polish-round{N}-{title}.md`.
   - Evaluate (same pattern as **Evaluate Once**): call subagent using `{skill-dir}/references/evaluate-polish-prompt.md`, save report to `{title}/summary/evaluation-polish-round{N}-{title}.md`.
   - Score ≥ 8.0 → copy current round file to `{title}/summary/polished-{title}.md` → Step 6. Score < 8.0 → track best candidate, next round.
2. **Rounds exhausted**: copy best-scoring round file to `{title}/summary/polished-{title}.md`, inform user of score → Step 6.

### Step 6: AI Tone Check (Generate-Evaluate Loop)

Max 5 rounds. Detect and fix AI-generated tone artifacts until no issues remain.

**Loop procedure:**
1. **Each round**:
   - Call subagent with `{skill-dir}/references/evaluate-ai-tone-prompt.md`, providing current summary as input.
   - Save report to `{title}/summary/evaluation-ai-tone-round{N}-{title}.md`.
   - Parse reported issues and apply suggested fixes to the summary.
   - If no issues → copy current summary to `{title}/summary/tone-fixed-{title}.md` → Step 7.
2. **Rounds exhausted (5 rounds)**: copy current summary to `{title}/summary/tone-fixed-{title}.md`, inform user that some AI tone issues may remain → Step 7.

### Step 7: Readability Check

Enable subagent to check readability. Use `{skill-dir}/references/evaluate-readability-prompt.md` as the prompt.

**Input**: `{title}/summary/tone-fixed-{title}.md`

**Report saved to**: `{title}/summary/review-readability-{title}.md`

**Processing**: Parse reported issues and apply fixes. Save result to `{title}/summary/final-{title}.md`.

### Step 8: Translate Summary to Chinese

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
