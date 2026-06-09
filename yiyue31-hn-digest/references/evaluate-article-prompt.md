# Article Evaluation Prompt

You are evaluating a generated article against the original source comments. Assess the article on the following five dimensions.

## Scoring Dimensions

Each dimension is scored 0–10. The overall score is the weighted average.

### 1. Viewpoint Accuracy (观点准确性) — Weight: 25%

Are the extracted viewpoints faithful to the original comments?

- 10: All viewpoints perfectly faithful.
- 7–9: Minor inaccuracies that do not change the meaning.
- 4–6: Some viewpoints distorted or misrepresented.
- 0–3: Major factual errors or fabricated viewpoints.

### 2. Viewpoint Completeness (观点完整性) — Weight: 25%

Are important viewpoints from the comments missing from the article?

Check per-group coverage: read `02-grouped.json`. For each group, compare the number of commentIds against how many of those comments' viewpoints are reflected in the article. If more than half of a group's comments have no representation, deduct points.

- 10: All important viewpoints captured; every group well-represented.
- 7–9: Minor viewpoints missing, but all major ones present.
- 4–6: Some important viewpoints missing, or a group severely under-represented.
- 0–3: Major viewpoints absent, or multiple groups have minimal coverage.

### 3. Structure Adherence (结构合规) — Weight: 20%

Does the article follow the required template structure?

Required sections:
- `# [Hacker News] {Title}` (H1 heading — `[Hacker News] ` prefix is mandatory)
- Background section (zh: `## 背景`, en: `## Background`)
- Core Viewpoints section (zh: `## 核心观点`, en: `## Core Viewpoints`) with `###` sub-headings for each group
- Controversies section (zh: `## 争议点`, en: `## Controversies`, if applicable)
- Summary section (zh: `## 总结`, en: `## Summary`)

OP marker check:
- Every OP comment must be prefixed with `> **[OP]** ` and placed first within its group/section.

Citation format check:
- No commenter usernames as primary attribution ("augstein 认为……" → use "有评论者认为……" instead).
- Exception: naming is acceptable when quoting an exact, insightful comment AND providing context.

Title prefix check:
- H1 heading must begin with `[Hacker News] `. Deduct 1-2 points if missing.

- 10: Perfect structure, proper OP markers, clean citations.
- 7–9: Minor formatting deviations or occasional unnecessary username drops.
- 4–6: Missing/misplaced sections, OP markers missing, or excessive username attribution.
- 0–3: Structure completely wrong.

### 4. Factual Correctness (事实正确性) — Weight: 15%

Is the article free from fabricated content and external knowledge?

- 10: All content derives from the provided comments.
- 7–9: Minor extrapolations that are reasonable inferences.
- 4–6: Some content appears fabricated or includes external knowledge.
- 0–3: Significant fabrication or external knowledge.

### 5. Writing Quality (写作质量) — Weight: 15%

Is the article well-written for a general audience?

- **Jargon handling**: Are technical/financial terms explained on first use or replaced with plain language?
- **Background hook**: Does the background open with something connecting the topic to the reader's interest? (Anti-pattern: "这篇文章来自……" style dry opening.)
- **Transitions**: Do subsections flow into each other with transition sentences? (Anti-pattern: sections read like independent mini-articles glued together.)
- **Summary value**: Does the summary provide value beyond a recap? (Anti-pattern: "讨论没有共识" — provide an unanswered question, practical implication, or higher-level observation instead.)
- **Sharp viewpoint highlighting**: Mark sharp/counter-intuitive viewpoints with **bold**. Format important original quotes as **{translated text}**（{original text}）（when lang differs from source; full-width （） in zh, half-width () in en）. Keep bold to 1–3 per section and quotes to 1–2 per section.
- **Controversy depth**: Identify the ROOT of disagreements, not just "X says A, Y says B."

- 10: All checks pass. Reads like a well-edited publication piece.
- 7–9: Most checks pass, 1-2 minor issues.
- 4–6: Several issues (unexplained jargon, no transitions, flat summary).
- 0–3: Major writing quality problems across multiple checks.

## Output Format

Write your evaluation as:

```
## Evaluation Report

### Viewpoint Accuracy: {score}/10
{1-2 sentence justification}

### Viewpoint Completeness: {score}/10
{1-2 sentence justification, including per-group coverage assessment}

### Structure Adherence: {score}/10
{1-2 sentence justification, including OP marker and citation format assessment}

### Factual Correctness: {score}/10
{1-2 sentence justification}

### Writing Quality: {score}/10
{1-2 sentence justification, noting which writing checks passed/failed}

### Overall Score: {weighted_average}/10

### Improvement Suggestions
{If score < 8.0, list 3-5 specific, actionable improvements. If score >= 8.0, state "Article meets quality threshold."}
```

### File Access Constraint

You are an **evaluation subagent**. You may only:
- **Read**: files specified in your `readFiles` parameter.
- **Write**: the evaluation report file specified in your `writeFiles` parameter.

You must NOT modify any content file (article, grouped data, etc.).
