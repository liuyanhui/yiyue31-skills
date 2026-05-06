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
- Extract the title from the user's original article/file/pasted content (title extraction priority: extract from heading, filename, first 10 characters of the first sentence), and save it locally at: `{title}/summary/original-{title}.md`.
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
- If adversarial review fails, return to the analysis stage to re-analyze the article

### Step 4: Template Selection and Summary Generation
- Based on the analysis results, use the AskUserQuestion tool to recommend a suitable summary template. Ask the user to choose or provide custom input. See [Available Templates](#available-templates) section.
- Keep important content in the original text, such as: processes, concepts, technical details, etc.
- Highlight quotes and key terms in the summary, formatted as: displayed in a separate paragraph using blockquote `>` format.
- When content is quoted verbatim from the original article, use the format: `> **[Verbatim]**: {original sentence}`
- Complete long sentences or sentences preceded by a comma must end with a period.
- Save the summary locally at: `{title}/summary/summary-{title}.md`.
- Run `node {skill-dir}/scripts/word-counter.js {title}/summary/summary-{title}.md` to check if the word count meets the template requirements, and display the results.

### Step 5: Quality Check
- Enable subagent for adversarial quality check (referencing generative adversarial network approach)
- Check summary coverage, accuracy, length, structure, language, and absence of fabricated information
- Check readability and logical coherence to ensure the summary is clear, coherent, and easy to understand
- Check whether the summary meets the format requirements of the selected template
- Save check results locally at: `{title}/summary/validation-{title}.md`.
- If the check fails, return to the summary generation stage to regenerate the summary
- If the check passes, inform the user and use the AskUserQuestion tool to ask the user to confirm: proceed to the next step or modify the summary.

### Step 6: Summary Polishing
- Polish the summary based on the user's chosen language to remove AI-generated traces. If a de-AI-trace skill is installed locally (e.g., humanizer-zh), use it; otherwise, search for and install a relevant de-AI-trace skill via `find-skills` into the current directory before using it.
- Save the polished summary locally at: `{title}/summary/final-summary-{title}.md`.

### Step 7: Polishing Result Check
- Enable subagent for adversarial quality check (referencing generative adversarial network approach).
- Check the readability of the polished summary to ensure it conforms to human reading habits.
- Save check results locally at: `{title}/summary/refine-gan-{title}.md`.
- If the check fails, return to the summary polishing stage to re-polish the summary
- If the check passes, inform the user that the final summary has been generated and provide the summary file path.

---

## Available Templates

- **Tech Article Template**: Tech article summary template - Suitable for technical articles, tech blogs, tech announcements, etc. Provides comprehensive analysis and summary, highlighting innovations and practical value. See `{skill-dir}/templates/tech-article.md`.
- **Paper Template**: Paper summary template - Suitable for academic paper summaries, helping readers quickly learn and understand the core content and innovations of the paper. See `{skill-dir}/templates/paper.md`.
- **Concise Template**: Concise summary template - Focused on core knowledge, suitable for quick learning. See `templates/concise.md`. **Default template**, used when other templates cannot be matched.


**Notes**
- Follow the steps strictly in order. Do not skip any step.
- Save the output of each step locally.
- The output of each step must conform to markdown format requirements, especially heading levels, list indentation, code block formatting, and table formatting.
