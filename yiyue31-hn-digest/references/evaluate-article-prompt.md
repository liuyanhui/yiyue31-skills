# Article Evaluation Prompt

You are evaluating a generated article against the original source comments. Assess the article on the following five dimensions.

## Scoring Dimensions

Each dimension is scored 0–10. The overall score is the weighted average.

### 1. Viewpoint Accuracy (观点准确性) — Weight: 25%

Are the extracted viewpoints faithful to the original comments?

- 10: All viewpoints are perfectly faithful to the original comments.
- 7–9: Minor inaccuracies that do not change the meaning.
- 4–6: Some viewpoints are distorted or misrepresented.
- 0–3: Major factual errors or fabricated viewpoints.

### 2. Viewpoint Completeness (观点完整性) — Weight: 25%

Are important viewpoints from the comments missing from the article?

Check per-group coverage: read the `02-grouped.json` file. For each group, compare the number of commentIds against how many of those comments' viewpoints are reflected in the article. If more than half of a group's comments have no representation, deduct points.

- 10: All important viewpoints are captured; every group is well-represented.
- 7–9: Minor viewpoints missing, but all major ones present.
- 4–6: Some important viewpoints are missing, or a group is severely under-represented.
- 0–3: Major viewpoints are absent, or multiple groups have minimal coverage.

### 3. Structure Adherence (结构合规) — Weight: 20%

Does the article follow the required template structure?

Required sections:
- `# {Title}` (H1 heading)
- Background section (Chinese: `## 背景`, English: `## Background`)
- Core Viewpoints section (Chinese: `## 核心观点`, English: `## Core Viewpoints`) with `###` sub-headings for each group
- Controversies section (Chinese: `## 争议点`, English: `## Controversies`, if applicable)
- Summary section (Chinese: `## 总结`, English: `## Summary`)

OP marker check (included in this dimension):
- Every comment authored by the original poster must be prefixed with `> **[OP]** `.
- OP comments must appear first within their group/section.
- Deduct points if OP comments are missing the marker or placed incorrectly.

Citation format check (included in this dimension):
- The article should NOT use commenter usernames as primary attribution (e.g., "augstein 认为……""pryce 指出……").
- Acceptable: generic references like "有评论者认为……""支持方指出……""反对方则认为……"
- Exception: naming is acceptable when quoting an exact, insightful comment AND providing context for who this person is.
- Deduct 1-2 points if the article reads like a meeting minutes with username-by-username attribution.

- 10: Perfect structure adherence, proper OP markers, clean citation format.
- 7–9: Minor formatting deviations or occasional unnecessary username drops.
- 4–6: Missing/misplaced sections, OP markers missing, or excessive username attribution.
- 0–3: Structure completely wrong.

### 4. Factual Correctness (事实正确性) — Weight: 15%

Is the article free from fabricated content and external knowledge?

- 10: All content derives from the provided comments. No fabrication.
- 7–9: Minor extrapolations that are reasonable inferences.
- 4–6: Some content appears fabricated or includes external knowledge.
- 0–3: Significant fabrication or external knowledge.

### 5. Writing Quality (写作质量) — Weight: 15%

Is the article well-written for a general audience?

Check the following:

**Jargon handling:**
- Are technical/financial terms explained on first use or replaced with plain language?
- Deduct points for unexplained jargon that a non-expert reader would not understand.

**Background hook:**
- Does the background section open with something that connects the topic to the reader's interest?
- Or does it start with a dry "这篇文章来自……" style opening? Deduct if the latter.

**Transitions:**
- Do subsections flow into each other with transition sentences?
- Or do they read like independent mini-articles glued together? Deduct if the latter.

**Summary value:**
- Does the summary provide value beyond "both sides have a point" / "no consensus was reached"?
- Acceptable: an unanswered question worth watching, a practical implication, a higher-level observation, or addressing the title's question.
- Deduct if the summary is just a recap that ends with "讨论没有共识."

**Controversy depth (if applicable):**
- Does the Controversies section identify the ROOT of disagreements, or just restate "X says A, Y says B"?
- If the discussion is one-sided, does it describe the consensus instead of forcing a false dichotomy?

Scoring:
- 10: All checks pass. Article reads like a well-edited publication piece.
- 7–9: Most checks pass, 1-2 minor issues.
- 4–6: Several issues (unexplained jargon, no transitions, flat summary).
- 0–3: Major writing quality problems across multiple checks.

## Output Format

Write your evaluation as a report in the following format:

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
{Calculated as: (accuracy * 0.25) + (completeness * 0.25) + (structure * 0.20) + (factual * 0.15) + (writing * 0.15)}

### Improvement Suggestions
{If score < 8.0, list 3-5 specific, actionable improvements. If score >= 8.0, state "Article meets quality threshold."}
```

## Input

You will receive:
1. The article draft file path.
2. The original comments file path (for cross-checking accuracy).
3. The grouped data file path (`02-grouped.json`, for per-group coverage check).

Read all three files, then produce your evaluation report.
