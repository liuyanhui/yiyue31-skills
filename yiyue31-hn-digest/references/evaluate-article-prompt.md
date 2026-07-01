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

### 2. Viewpoint Completeness (观点完整性) — Weight: 20%

Are any IMPORTANT viewpoints silently dropped? Note: this is NOT "represent every comment equally." Concentrating depth on the 2–3 viewpoints that reframe understanding and rounding up the rest briefly is GOOD practice, not a deduction — penalize only genuinely important viewpoints that vanish entirely.

Check: read `02-grouped.json`. For each group, judge whether its IMPORTANT viewpoints are reflected anywhere in the article (a brief roundup is fine). Deduct only when an important viewpoint is absent — not when minor or echo comments are merely rounded up.

- 10: All important viewpoints captured (minor ones may be rounded up).
- 7–9: A minor important viewpoint missing, but all major ones present.
- 4–6: An important viewpoint missing, or a high-signal group flattened to a passing mention.
- 0–3: Major viewpoints absent, or multiple important groups have no real coverage.

### 3. Structure Adherence (结构合规) — Weight: 20%

Does the article use a skeleton appropriate to its thread type — rather than the same four-section mold every time?

Required (all types):
- `# [Hacker News] {Title}` (H1 heading — `[Hacker News] ` prefix is mandatory)
- Background section (zh: `## 背景`, en: `## Background`)
- A body matching the thread type (see `assets/article-v1.md`): controversy → Core Viewpoints unfolding the central question; breakthrough → How-it-was-done / What-it-means; event or obituary → What-people-remember; scattered Q&A → Notable-points roundup.
- Summary section (zh: `## 总结`, en: `## Summary`)

Conditional:
- Controversies section (zh: `## 争议点`, en: `## Controversies`) is MANDATORY for the controversy type. For every other type, include it ONLY if a real split surfaces. A fabricated or empty 争议点 is a formula tell — deduct for it, do not reward it.

OP marker check:
- Every OP comment must be prefixed with `> **[OP]** ` and placed first within its group/section.

Citation format check:
- No commenter usernames as primary attribution ("augstein 认为……" → use "有评论者认为……" instead).
- Exception: naming is acceptable when quoting an exact, insightful comment AND providing context.

Title prefix check:
- H1 heading must begin with `[Hacker News] `. Deduct 1-2 points if missing.

- 10: Skeleton matches thread type; proper OP markers; clean citations; 争议点 present only when genuinely warranted.
- 7–9: Minor formatting deviations or occasional unnecessary username drops.
- 4–6: Wrong skeleton for the thread type, OP markers missing, a fabricated 争议点, or excessive username attribution.
- 0–3: Structure completely wrong.

### 4. Factual Correctness (事实正确性) — Weight: 15%

Is the article free from fabricated content and external knowledge?

- 10: All content derives from the provided comments.
- 7–9: Minor extrapolations that are reasonable inferences.
- 4–6: Some content appears fabricated or includes external knowledge.
- 0–3: Significant fabrication or external knowledge.

### 5. Writing Quality & Engagement (写作质量与引读力) — Weight: 20%

Is the article well-written AND does it give the reader a reason to keep reading? (Engagement is weighted here because a faithful-but-forgettable digest is the failure mode this dimension exists to catch.)

- **Jargon handling**: Are technical/financial terms explained on first use or replaced with plain language?
- **Background hook**: Does the background open with something connecting the topic to the reader's interest, and give enough context to make the reader care? (Anti-patterns: "这篇文章来自……" dry opening; OR a background so thin the reader has no stakes.)
- **Transitions**: Do subsections flow into each other with transition sentences? (Anti-pattern: sections read like independent mini-articles glued together.)
- **Summary value**: Does the summary provide value beyond a recap? (Anti-pattern: "讨论没有共识" — provide an unanswered question, practical implication, or higher-level observation instead.)
- **Sharp viewpoint highlighting**: Mark sharp/counter-intuitive viewpoints with **bold**. Format important COMMENT quotes as **{translated text}**（{original text}）（when lang differs from source; full-width （） in zh, half-width () in en）. Keep bold to 1–3 per section and comment-fragment quotes to 1–2 per section. Longer SOURCE-article block quotes are a separate, encouraged budget.
- **Controversy depth**: Identify the ROOT of disagreements, not just "X says A, Y says B."
- **Aggregation voice**: sections open with the viewpoint itself, not with meta-narration about the discussion (a digest-specific tell). General AI-tone artifacts (symmetric opposition, superlatives, casual voice) are caught by the standalone AI Tone Check — do not double-penalize them here. Deduct only when meta-narration openings dominate the prose.
- **Anti-formula**: Does the article avoid the homogeneity tells of THIS digest? Watch for: the same summary opening recurring (e.g., "与其说…不如说…" every time); the same controversy phrasing as a tic (e.g., "分歧的根子在于…"); an identical macro-structure regardless of whether the thread is a breakthrough, an obituary, or a flame war. A piece that reads as "the same digest again" loses the reader — deduct when the formula is visible.
- **Resonance / insight**: Does the article leave the reader with something that lingers — a question that keeps thinking going, a reframe of the reader's understanding, or one clearly-labeled editorial observation ("值得一提的是…") that is supported by the source and goes beyond the commenters' frames? A faithful but forgettable piece caps at 7 on this dimension; reward genuine pull.

- 10: All checks pass, including a moment of genuine resonance. Reads like a well-edited publication piece.
- 7–9: Most checks pass, 1-2 minor issues; competent but may lack a memorable insight.
- 4–6: Several issues (unexplained jargon, no transitions, flat summary, or visible formula).
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

### Writing Quality & Engagement: {score}/10
{1-2 sentence justification, noting which writing checks passed/failed and whether the piece achieved any resonance/insight or showed formula tells}

### Overall Score: {weighted_average}/10

### Improvement Suggestions
{If score < 8.0, list 3-5 specific, actionable improvements. If score >= 8.0, state "Article meets quality threshold."}
```
