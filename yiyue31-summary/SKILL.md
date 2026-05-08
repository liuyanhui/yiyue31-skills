---
name: yiyue31-summary
description: Use when user asks to "summarize article", "summarize tech post", "summarize research paper", "summarize documentation", "summarize", "生成总结", "总结文章", or provides URLs/files that need summarization.
---

# Tech Article Summarizer

## Description

Article summary generator for summarizing technical articles, blog posts, research papers, documentation, and other content. Supports multiple summary templates to meet different needs. Analyzes article content, extracts key points and highlights, and generates structured, easy-to-read summaries.

## Requirements
- Except for direct human quotes, avoid overly colloquial language during summarization. Maintain a professional, clear, and concise style.
- Summarize from the reader's perspective, not the author's.
---
## Directory

`{skill-dir}` = this SKILL.md's directory path. It means the directory where this SKILL.md is located.

---

## Summary Workflow

The complete step-by-step process from input to final output:

### Step 1: Retrieve Article Content

Retrieve article content using different tools based on the user's input type:
- **URL input**: Prefer locally installed skills such as: download article, convert article, search information, operate web page, view web page, etc. Alternatively, use `wget` or `curl` or `agent-browser` to open the web page and download the article content.
- **File path input**: Use the `Read` tool to read the file content
- **Direct paste**: Process the input content directly
- Extract the title from the user's original article/file/pasted content (title extraction priority: extract from heading, filename, first few words of the first sentence, or use `untitled-{timestamp}`). Sanitize the title by removing or replacing filesystem-unsafe characters (`/ \ : * ? " < > |`). If `{title}/summary/` already exists, delete it before saving. Save it locally at: `{title}/summary/original-{title}.md`.
- **Missing content to summarize**: Ask the user to provide the information

**Article Content Preprocessing**
1. When the article content is not in markdown format, convert and save it as markdown.
2. Preserve the original structure and format during conversion. Try to keep paragraphs, headings, lists, etc. unchanged. For elements that cannot be accurately converted, keep the original text and add comments to prompt the user to check.
3. Check the converted file. If unsure about the conversion result, use the AskUserQuestion tool to ask the user to confirm: correct as-is or needs correction.

### Step 2: Analyze Article
- Language analysis: Detect the article's language
- Article type analysis: Tech blog, research paper, product documentation, tutorial, video subtitles, paper, general article, etc.
- Topic analysis: Extract the article's topic and domain
- Structure analysis: Identify the article's main structure and sections
- Paragraph analysis: Extract core viewpoints, steps, pros/cons, or key arguments from each paragraph. If there is code, algorithms, or processes, use simplified descriptions or pseudocode. Use bullet points (main point + sub-points) when necessary.
- Entity analysis: If people, teams, or organizations are involved, analyze their relevant backgrounds
- Background analysis: If events are involved, analyze event background, material sources, publication date, etc.
- Terminology analysis: Extract key terms and concepts to retain or explain in the summary.
- Quote extraction: Select outstanding expressions, eye-catching, memorable, impactful, and impressive sentences as highlights in the summary. Output in table format: "Location in original | Original text | Highlight description"
- Save analysis results locally at: `{title}/summary/analysis-{title}.md`.

### Step 3: Analysis Adversarial Review
- Enable subagent for adversarial review (referencing generative adversarial network approach) to check whether the analysis results contain errors, omissions, or unreasonable points.
- Save adversarial review results locally at: `{title}/summary/analysis-gan-{title}.md`.
- If adversarial review fails, return to the analysis stage to re-analyze the article. Maximum 3 retries. If all retries are exhausted, proceed to the next step with a warning to the user.

### Step 4: Template Selection

- Based on the analysis results, use the AskUserQuestion tool to recommend a suitable summary template. Ask the user to choose or provide custom input. See [Available Templates](#available-templates) section.

### Step 5: Summary Generate-Evaluate Loop

**Summary formatting rules:**
- Keep important content in the original text, such as: processes, concepts, technical details, etc.
- Highlight quotes and key terms in the summary, formatted as: displayed in a separate paragraph using blockquote `>` format.
- When content is quoted verbatim from the original article, use the format: `> **[Verbatim]**: {original sentence}`
- Any non-heading sentence must end with punctuation.

**Flowchart:**

```text
node timer.js start --tag {title}
            ↓
    ┌── Loop (max 5 rounds) ──────────────────┐
    │                                          │
    │   node timer.js check → expired?         │
    │   ├── Yes → use best summary, break      │
    │   └── No  → continue                     │
    │                                          │
    │   Round 1?                               │
    │   ├── Yes → Generate from analysis       │
    │   └── No  → Revise per eval report       │
    │              ↓                           │
    │   Save summary & run word-counter        │
    │              ↓                           │
    │   Evaluate via subagent                  │
    │              ↓                           │
    │        Score ≥ 8.0?                      │
    │   ├── Yes → Exit loop → Step 6           │
    │   └── No  → Loop back ↑                  │
    │                                          │
    └── Global timeout: 30min ─────────────────┘
```

**Loop rules:**
- Maximum 5 rounds. The evaluator subagent MUST use the same LLM throughout all rounds — switching LLMs mid-loop is FORBIDDEN to ensure evaluation consistency.
- Passing threshold: total score ≥ 8.0 (out of 10). Scoring methodology is defined in the evaluator prompt.
- Each round's evaluation report is saved to `{title}/summary/evaluation-round{N}-{title}.md`.
- Global timeout: 30 minutes. Tracked via `node {skill-dir}/scripts/timer.js check --tag {title} --timeout 1800`. If expired, stop the loop and use the best-scoring summary. Inform the user of the timeout.

**Loop procedure:**
1. **Start timer**: Run `node {skill-dir}/scripts/timer.js start --tag {title}` before entering the loop.
2. **Check global timeout**: At the start of each round, run `node {skill-dir}/scripts/timer.js check --tag {title} --timeout 1800`. If the output shows `"expired": true`, use the best-scoring summary so far and proceed to Step 6.
3. **Generate or revise**:
   - Round 1: Generate the initial summary from analysis results.
   - Subsequent rounds: Revise the summary based on the Issues table from the previous evaluation report and the original article.
4. **Save and check**: Save the summary to `{title}/summary/summary-{title}.md`. Run `node {skill-dir}/scripts/word-counter.js {title}/summary/summary-{title}.md` to verify word count meets template requirements, and display the results.
5. **Evaluate**: Enable a subagent with the evaluator prompt (`{skill-dir}/references/evaluate-prompt.md`). The subagent returns a structured evaluation report containing: total score (0-10), methodology (dimensions, weights, formula), and an issues table. Save the report to `{title}/summary/evaluation-round{N}-{title}.md`.
6. **Check score**:
   - **Passes (≥ 8.0)**: Break out of the loop. Proceed to Step 6.
   - **Fails (< 8.0)**: Record the current score. If it is the highest so far, save this summary as the best candidate. Return to step 2 of this loop for the next round.
7. **Round limit or timeout reached**: Use the best-scoring summary from the loop. Inform the user of the best score achieved. Proceed to Step 6.

### Step 6: Summary Polishing

- Polish the summary to remove AI-generated traces. Apply the following de-AI guidelines:
  - Avoid formulaic expressions and overly smooth transitions (e.g., "It's worth noting", "Importantly", "In conclusion").
  - Vary sentence structure and length to avoid repetitive patterns.
  - Use natural, specific language rather than vague or generic phrasing.
  - Remove excessive hedging and qualifiers.
  - Avoid the rule of three and parallel structures that feel manufactured.
  - If a de-AI-trace skill is installed locally (e.g., humanizer-cn), use it to assist the polishing.
- Save the polished summary locally at: `{title}/summary/final-summary-{title}.md`.

### Step 7: Polishing Result Check
- Enable subagent for adversarial quality check (referencing generative adversarial network approach).
- Check the readability of the polished summary to ensure it conforms to human reading habits.
- Save check results locally at: `{title}/summary/refine-gan-{title}.md`.
- If the check fails, return to Step 6 to re-polish the summary. Maximum 3 retries. If all retries are exhausted, proceed with the current version and inform the user.
- If the check passes, inform the user that the final summary has been generated and provide the summary file path.

---

## Available Templates

- **Tech Article Template**: Tech article summary template - Suitable for technical articles, tech blogs, tech announcements, etc. Provides comprehensive analysis and summary, highlighting innovations and practical value. See `{skill-dir}/templates/tech-article.md`.
- **Paper Template**: Paper summary template - Suitable for academic paper summaries, helping readers quickly learn and understand the core content and innovations of the paper. See `{skill-dir}/templates/paper.md`.
- **Concise Template**: Concise summary template - Focused on core knowledge, suitable for quick learning. See `{skill-dir}/templates/concise.md`. **Default template**, used when other templates cannot be matched.


**Notes**
- Follow the steps strictly in order. Do not skip any step.
- Save the output of each step locally.
- The output of each step must conform to markdown format requirements, especially heading levels, list indentation, code block formatting, and table formatting.
