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
- Extract the title from the user's original article/file/pasted content (title extraction priority: extract from heading, filename, first few words of the first sentence, or use `untitled-{timestamp}`). Sanitize the title by removing or replacing filesystem-unsafe characters (`/ \ : * ? " < > |`). If `{title}/summary/` already exists, delete it before saving. Save to: `{title}/summary/original-{title}.md`.
- **Missing content to summarize**: Ask the user to provide the information

**Article Content Preprocessing**
1. When the article content is not in markdown format, convert and save it as markdown.
2. Preserve the original structure and format during conversion. Try to keep paragraphs, headings, lists, etc. unchanged. For elements that cannot be accurately converted, keep the original text and add comments to prompt the user to check.
3. Check the converted file. If unsure about the conversion result, use the AskUserQuestion tool to ask the user to confirm: correct as-is or needs correction.

### Step 2: Analyze Article
- **Language**: Input language
- **Article type**: Tech blog, research paper, documentation, tutorial, video subtitles, general article, etc.
- **Topic & domain**: Extract topic and domain
- **Structure**: Identify main sections and hierarchy
- **Paragraphs**: Extract core viewpoints, steps, pros/cons per paragraph. For code/algorithms/processes, use simplified descriptions or pseudocode. Use bullet points (main point + sub-points).
- **Entities**: If people, teams, or organizations are involved, analyze their backgrounds
- **Background**: If events are involved, analyze event context, sources, publication date
- **Terminology**: Extract key terms and concepts to retain or explain
- **Quotes**: Select standout sentences as summary highlights. Output table: "Location in original | Original text | Highlight description"
- Save to: `{title}/summary/analysis-{title}.md`

### Step 3: Analysis Adversarial Review
- Enable subagent for adversarial review (referencing generative adversarial network approach) to check whether the analysis results contain errors, omissions, or unreasonable points.
- Save to: `{title}/summary/analysis-gan-{title}.md`.
- If adversarial review fails, return to the analysis stage to re-analyze the article. Maximum 3 retries. If all retries are exhausted, proceed to the next step with a warning to the user.

### Step 4: Template Selection

- Based on the analysis results, use the AskUserQuestion tool to recommend a suitable summary template. Ask the user to choose or provide custom input. See [Available Templates](#available-templates) section.

### Step 5: Summary Generate-Evaluate Loop

**Summary formatting rules:**
- Keep important content: processes, concepts, technical details, etc.
- Highlight quotes and key terms in blockquote `>` format as separate paragraphs.
- Verbatim quotes: `> **[Verbatim]**: {original sentence}`
- Any non-heading sentence must end with punctuation.

**Loop parameters:** max 5 rounds, global timeout 30 min, passing threshold score ≥ 8.0 (out of 10). Evaluator MUST use the same LLM throughout all rounds — switching mid-loop is FORBIDDEN.

**Loop procedure:**
1. **Start timer**: `node {skill-dir}/scripts/timer.js start --tag {title}`
2. **Each round**:
   - Check timeout: `node {skill-dir}/scripts/timer.js check --tag {title} --timeout 1800`. If `"expired": true`, use best summary so far → Step 6.
   - Round 1: Generate summary from analysis. Later rounds: revise based on previous evaluation Issues table + original article.
   - Save to `{title}/summary/summary-{title}.md`. Run `node {skill-dir}/scripts/word-counter.js {title}/summary/summary-{title}.md` to verify word count, display results.
   - Evaluate via subagent using `{skill-dir}/references/evaluate-prompt.md`. Save report to `{title}/summary/evaluation-round{N}-{title}.md`.
   - Score ≥ 8.0 → exit loop → Step 6. Score < 8.0 → track best candidate, next round.
3. **Rounds exhausted or timeout**: use best-scoring summary, inform user of score → Step 6.

### Step 6: Summary Polishing

- Remove AI-generated traces: avoid formulaic transitions ("It's worth noting", "In conclusion"), manufactured parallel structures, excessive hedging, and repetitive sentence patterns. Use natural, specific language.
- If a de-AI skill is installed locally (e.g., humanizer-cn), use it to assist.
- Save to: `{title}/summary/final-summary-{title}.md`

### Step 7: Polishing Result Check
- Adversarial subagent checks readability and human reading habits. Save to: `{title}/summary/refine-gan-{title}.md`.
- Fails → return to Step 6 (max 3 retries). Retries exhausted → proceed with current version, inform user.
- Passes → inform user and provide summary file path.

---

## Available Templates

- **Tech Article Template**: Tech article summary template - Suitable for technical articles, tech blogs, tech announcements, etc. Provides comprehensive analysis and summary, highlighting innovations and practical value. See `{skill-dir}/templates/tech-article.md`.
- **Paper Template**: Paper summary template - Suitable for academic paper summaries, helping readers quickly learn and understand the core content and innovations of the paper. See `{skill-dir}/templates/paper.md`.
- **Concise Template**: Concise summary template - Focused on core knowledge, suitable for quick learning. See `{skill-dir}/templates/concise.md`. **Default template**, used when other templates cannot be matched.


**Notes**
- Follow the steps strictly in order. Do not skip any step.
- Save the output of each step locally.
- The output of each step must conform to markdown format requirements, especially heading levels, list indentation, code block formatting, and table formatting.
