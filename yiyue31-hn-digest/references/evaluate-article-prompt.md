# Article Evaluation Prompt

> Last updated: 2026-08-19 09:30:00

You are evaluating a generated article against the original source comments. Assess the article on the following five dimensions.

**Large-source handling**: `01-raw-data.json` can hold hundreds of comments. Do NOT read it end-to-end — read the `post` object, then verify accuracy by sampling: the comments referenced in `02-grouped.json` (groups + standouts), plus a spread of top-level comments across the tree. Reading the whole file on a large thread can exhaust your context before the evaluation is written.

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
- `# [HN] {title in config.lang}` (H1 — `[HN] ` prefix mandatory; for zh the title is the Chinese translation of post.title). When post.title differs from the article language, a `<small>原标题：{post.title}</small>` (en: `<small>Original: {post.title}</small>`) line must appear right after the H1.
- Background section (zh: `## 背景`, en: `## Background`)
- A body matching the thread type (see `assets/article-v1.md`): controversy → Core Viewpoints unfolding the central question; breakthrough → How-it-was-done / What-it-means; event or obituary → What-people-remember; scattered Q&A → Notable-points roundup. Body sections are ordered by viewpoint logic, NOT by raw comment heat.
- Summary section (zh: `## 总结`, en: `## Summary`)

Conditional:
- Controversies section (zh: `## 争议点`, en: `## Controversies`) is MANDATORY for the controversy type. For every other type, include it ONLY if a real split surfaces. A fabricated or empty 争议点 is a formula tell — deduct for it, do not reward it.

OP marker check:
- Every OP comment must be prefixed with the OP marker and placed first within its group/section. The marker follows the article language: zh `> **[楼主]** `, en `> **[OP]** `. A zh article carrying the untranslated `> **[OP]** ` is a defect.

Coverage / declaration check:
- The article must NOT carry per-section `（N / M 条）` / `(N / M comments)` markers on headings — that ratio is internal and reader-opaque.
- The article must NOT end with a coverage/methodology `<small>` note after the references. The disclaimer + methodology/neutrality + discussion snapshot are injected as ONE `<small>` paragraph after the H1 by `insert-header.ts` (not written by the model), so the model-written body must end at the `## 参考资料` (en: `## References`) links with nothing after them.

Standout section check (意外之声 / Surprising takes — the SURPRISE track):
- When `02-grouped.json` `standouts` is non-empty, the article must include a `## 意外之声` (en: `## Surprising takes`) section (before 总结). Omit the section entirely when `standouts` is empty — do not emit an empty heading.
- Picks must NOT repeat the body: standouts are drawn from the outlier pool (comments the activity filter dropped). A standout quoting a comment already featured in a body section is a defect.
- The bar is surprise. Picks that are merely "well-argued" or "a clear explanation" with no counter-consensus / counter-intuitive / outrageous edge are defects.
- Each pick is ONE blockquote of the comment's **exact SOURCE-LANGUAGE words** (a zh article still quotes the English original — translating the quote is a defect), followed by three labeled lines: 作者/Author, 翻译/Translation (omit only when source language = article language), 入选原因/Reason for inclusion. A BLANK `>` line MUST separate every field so each renders as its own paragraph in HTML (consecutive `>` lines collapse into one paragraph and the fields end up on one line — that is the bug to avoid). Labels follow the article language.

Formula check:
- Any formula must use LaTeX (display $$...$$ on its own line, inline $...$). A formula written as plain prose that loses subscripts/superscripts (e.g. "St−1", "ktT") is a MINOR defect.

Citation format check:
- No commenter usernames as primary attribution ("augstein 认为……" → use "有评论者认为……" instead).
- Exception: naming is acceptable when quoting an exact, insightful comment AND providing context.

Language consistency check:
- Section headings are MONOLINGUAL and follow `config.lang`: a zh article uses zh headings only (`## 背景`, not `## 背景 / Background` and not `## Background`); an en article uses en headings only. Em-dash (——) mid-sentence use is deferred to the Translationese Check.

Title prefix check:
- H1 heading must begin with `[HN] `. Deduct 1-2 points if missing or if it uses the old `[Hacker News]` form.

References check:
- A `## 参考资料` (en: `## References`) section is present with the HN discussion link, and it is the LAST section (nothing follows it). If the post has an external URL, the original-article link is included AND its raw URL shown on a separate indented line (it must survive conversion to HTML/PDF/etc.).

Score by severity, not defect count:
- 10: All structure checks pass (skeleton matches type; OP markers; no model-written end coverage note; standout section when warranted; citations; title prefix; references last).
- 7–9: 1–2 MINOR defects (occasional username drop, a model-written end coverage note left in, raw URL not indented).
- 4–6: A MAJOR defect (wrong skeleton, OP markers missing, fabricated 争议点, missing References or HN link, per-section coverage markers present).
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
