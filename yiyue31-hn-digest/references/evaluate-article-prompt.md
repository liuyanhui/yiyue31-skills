# Article Evaluation Prompt

> Last updated: 2026-07-29

You are evaluating a generated article against the original source comments. Assess the article on the following five dimensions.

## Scoring Dimensions

Each dimension is scored 0–10. The overall score is the weighted average.

### 1. Viewpoint Accuracy (观点准确性) — Weight: 25%

Are the extracted viewpoints faithful to the original comments?

- 10: All viewpoints perfectly faithful.
- 7–9: Minor inaccuracies that do not change the meaning.
- 4–6: Some viewpoints distorted or misrepresented.
- 0–3: Major viewpoint distortions or fabricated viewpoints. (Fabricated facts/external knowledge are scored in dimension 4 — do not double-count.)

### 2. Viewpoint Completeness (观点完整性) — Weight: 20%

Are any IMPORTANT viewpoints silently dropped? Note: this is NOT "represent every comment equally." Concentrating depth on the 2–3 viewpoints that reframe understanding and rounding up the rest briefly is GOOD practice, not a deduction — penalize only genuinely important viewpoints that vanish entirely.

Check: read `02-grouped.json`. For each group, judge whether its IMPORTANT viewpoints are reflected anywhere in the article (a brief roundup is fine).

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
- Every OP comment must be prefixed with the OP marker and placed first within its group/section. The marker follows the article language: zh `> **[楼主]** `, en `> **[OP]** `. A zh article carrying the untranslated `> **[OP]** ` is a defect.

Coverage note check:
- The article must NOT carry per-section `（N / M 条）` / `(N / M comments)` markers on headings — that ratio is internal and reader-opaque.
- The article must end with ONE `<small>` coverage line after the `## 参考资料 / References` links: zh `本摘要基于该 Hacker News 帖子的 {inputCount} 条评论，按"回复数与讨论深度"选取 {activeCount} 条代表性观点归纳……`; en equivalent. Counts come from `02-filtered.json` `meta` (inputCount = `01-raw-data.json` comment count; activeCount = unique commentIds across `02-grouped.json` groups). It states the selection principle in plain words and exposes NO raw params (depth / minReplies / maxComments).
  - Defects: any per-section `（N / M 条）` marker present; the end coverage note missing; the note leaking raw params; or a body reordered by raw heat.

Standout section check:
- When `02-grouped.json` `standouts` is non-empty, the article must include a `## 意外之声 / Standout takes` section (before 总结) rendering each pick as a blockquote of the comment's exact words plus a one-line reason it is surprising. Omit the section only when `standouts` is empty. Defects: section missing despite non-empty standouts; blockquotes that paraphrase or fabricate the surprising claim instead of quoting it; section present but aimless.

Citation format check:
- No commenter usernames as primary attribution ("augstein 认为……" → use "有评论者认为……" instead).
- Exception: naming is acceptable when quoting an exact, insightful comment AND providing context.

Language consistency check:
- Section headings follow `config.lang` (a zh article must not carry untranslated headings like `## Background`). Em-dash (——) mid-sentence use is deferred to the Translationese Check.

Title prefix check:
- H1 heading must begin with `[Hacker News] `. Deduct 1-2 points if missing.

References check:
- A `## 参考资料 / References` section is present with the HN discussion link. If the post has an external URL, the original-article link is included AND its raw URL shown on a separate indented line (it must survive conversion to HTML/PDF/etc.). Defects: section missing, HN link missing, or a raw URL not on its own line.

Score by severity, not defect count:
- 10: All structure checks pass (skeleton matches type; OP markers; end coverage note; standout section when warranted; citations; title prefix; references).
- 7–9: 1–2 MINOR defects (occasional username drop, a single missing/leaky coverage note, raw URL not indented).
- 4–6: A MAJOR defect (wrong skeleton, OP markers missing, fabricated 争议点, missing References or HN link, per-section coverage markers present or end coverage note missing).
- 0–3: Structure completely wrong.

### 4. Factual Correctness (事实正确性) — Weight: 15%

Is the article free from fabricated content and external knowledge?

- 10: All content derives from the provided comments.
- 7–9: Minor extrapolations that are reasonable inferences.
- 4–6: Some content appears fabricated or includes external knowledge.
- 0–3: Fabricated facts or external knowledge not in the comments. (Fabricated viewpoints are scored in dimension 1 — do not double-count.)

### 5. Writing Quality & Engagement (写作质量与引读力) — Weight: 20%

Is the article well-written AND does it give the reader a reason to keep reading? (Engagement is weighted here because a faithful-but-forgettable digest is the failure mode this dimension exists to catch.)

**Boundary with AI Tone Check**: lexical AI-tone tells AND dramatized meta-narration / 空话 (sentences that narrate the discussion's action without a viewpoint) are scored by the standalone AI Tone Check — do not double-penalize them in this dimension.

- **Jargon handling**: Are technical/financial terms explained on first use or replaced with plain language?
- **Background hook**: Does the background open with something connecting the topic to the reader's interest, and give enough context to make the reader care? (Anti-patterns: "这篇文章来自……" dry opening; OR a background so thin the reader has no stakes.)
- **Transitions**: Do subsections flow via SUBSTANTIVE transition sentences that name the logical link between topics? Sections that read like independent mini-articles with no link = defect (the fix is a substantive link, not dramatized connective tissue).
- **Summary value**: Does the summary provide value beyond a recap? (Anti-pattern: "讨论没有共识" — provide an unanswered question, practical implication, or higher-level observation instead.)
- **Sharp viewpoint highlighting**: Mark sharp/counter-intuitive viewpoints with **bold**. Format important COMMENT quotes as **{translated text}**（{original text}）（when lang differs from source; full-width （） in zh, half-width () in en）. Keep bold to 1–3 per section and comment-fragment quotes to 1–2 per section. Longer SOURCE-article block quotes are a separate, encouraged budget.
- **Original-article voice**: when the fetched original carries a substantive argument, are its 1–2 core-argument paragraphs quoted as a blockquote in the relevant section (not just paraphrased)? Fetched original with a real argument but only paraphrased = defect.
- **Controversy depth**: Identify the ROOT of disagreements, not just "X says A, Y says B."
- **Aggregation voice**: sections open with the viewpoint itself, not with meta-narration about the discussion (a digest-specific tell).
- **Anti-formula**: Does the article avoid the homogeneity tells of THIS digest? Watch for: the same summary opening recurring (e.g., "与其说…不如说…" every time); the same controversy phrasing as a tic (e.g., "分歧的根子在于…"); an identical macro-structure regardless of whether the thread is a breakthrough, an obituary, or a flame war. A piece that reads as "the same digest again" loses the reader — deduct when the formula is visible.
- **Resonance / insight**: Does the article leave the reader with something that lingers — a reframe of the reader's understanding, or one clearly-labeled editorial observation ("值得一提的是…") that is supported by the source and goes beyond the commenters' frames? Dramatized framing of the discussion itself does NOT count as resonance. A faithful but forgettable piece caps at 7 on this dimension; reward genuine pull.

- 10: All checks pass, including a moment of genuine resonance.
- 7–9: 1–2 MINOR defects (a thin background, 1–2 unexplained terms); no memorable insight.
- 4–6: A MAJOR defect (no transitions, flat summary, visible formula, or no original-article blockquote when the original had a real argument).
- 0–3: Major writing-quality problems across multiple checks.

## Output Format

Write your evaluation as:

```
## Evaluation Report

### Viewpoint Accuracy: {score}/10
{1-2 sentence justification}

### Viewpoint Completeness: {score}/10
{1-2 sentence justification, including per-group coverage assessment}

### Structure Adherence: {score}/10
{1–3 sentence justification: name any FAILED structure checks (skip passed ones) + OP/citation assessment}

### Factual Correctness: {score}/10
{1-2 sentence justification}

### Writing Quality & Engagement: {score}/10
{1–3 sentence justification: name any FAILED writing checks (skip passed ones) + whether resonance was achieved or a formula was visible}

### Overall Score: {weighted_average}/10

### Improvement Suggestions
{If score < 8.0, list 3-5 specific, actionable improvements. If score >= 8.0, state "Article meets quality threshold."}
```
