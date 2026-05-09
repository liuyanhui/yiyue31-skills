# Translation Evaluation Prompt

Score a translated article across 5 dimensions (0-10 each) and list every problem with verbatim evidence. Produce scores and a detailed issue report with enough diagnostic detail (including suggested fixes) for a separate revision step to resolve all issues without re-reading the original article.

---

## Input

You will receive:

1. **Original article** — the source English text
2. **Translation** — the Chinese translation to evaluate
3. **Glossary** — terminology table for TM dimension check
4. **Style** — Literal or Free, for ST dimension evaluation
5. **Special phrases** — extracted phrases table from Step 3 (for FM check)

## Anti-Inflation

Default to critical. "Not bad" = 5, not 7. Follow the rubric strictly.

- If you find 3+ issues in a dimension, that dimension cannot exceed 7.
- A score of 8 means nearly publishable quality with only minor issues.
- A score of 9-10 means the dimension is essentially flawless.

## Pre-check

1. Empty, < 10 words, or not a translation (all English) → output "Input is not a valid translation. Evaluation aborted." and stop.
2. Major omissions (>30% of original missing) → note "Major omissions detected." AC capped at 3. Omissions of 10-30% → AC capped at 6.

## Scoring Rubric

| Band | Accuracy (AC) | Fluency (FL) | Terminology (TM) | Format (FM) | Style (ST) |
|------|---------------|--------------|-------------------|-------------|------------|
| 9-10 | Perfect fidelity. Every fact, data point, logical relationship matches. Zero additions or omissions. | Natural Chinese. Zero translationese. Reads like original Chinese writing. | All glossary terms correctly handled. First occurrence uses `English(中文)` annotation. Consistent throughout. | All Markdown preserved. Golden quotes/idioms/slang bolded. Links: URL kept, text translated. Special phrases match Step 3 table. Image text language correct. | Matches selected style. Translator notes follow `Chinese（English original, explanation）` format when present. |
| 5-8 | Minor inaccuracies (1-3 non-critical). Core meaning intact. | Some translationese (1-3 patterns from Checklist). Generally readable. | Most glossary terms correct. 1-2 annotation format errors or inconsistencies. | Minor format issues (1-2). Most structure preserved. | Mostly matches style. Occasional deviations. |
| 0-4 | Significant misrepresentations, fabricated content, or major omissions. | Heavy translationese (4+ patterns). Unnatural Chinese. | Multiple glossary violations. Annotation format ignored. | Major format problems. Broken links, missing bolding, special phrases not followed. | Does not match selected style. |

## Weights

Total = round(AC×0.3 + FL×0.25 + TM×0.2 + FM×0.15 + ST×0.1). Range 0-10.

## Translationese Checklist

FL dimension patterns. Each detected pattern must appear in Issues with the pattern name:

- Forced English word order: "这是一个...的事实" from "It is a fact that..."
- Excessive "的" in noun phrases
- Passive voice overuse: 被, 受到, 被...所
- Literal article/preposition translation that doesn't exist in Chinese
- English-style topic sentences instead of Chinese topic-comment structure
- Stacked modifiers: "具有高性能和低延迟的分布式数据库系统"
- Unnatural connectors: 因此/然而/此外 as direct translations of "therefore"/"however"/"furthermore"

## Severity

| Severity | Impact |
|----------|--------|
| **High** | Score-defining. 2+ High issues in a dimension → that dimension ≤ 5 |
| **Medium** | Notable. 3+ Medium issues = equivalent to 1 High |
| **Low** | Minor. Cosmetic or stylistic. |

## Output Report

```markdown
## Translation Evaluation Report

**Article:** [title] | **Words:** [N] | **Style:** [Literal/Free] | **Weights:** AC 30% / FL 25% / TM 20% / FM 15% / ST 10%

### Scores
| Dimension | Score | Weighted |
|-----------|-------|----------|
| Accuracy | [X] | [X×0.3] |
| Fluency | [X] | [X×0.25] |
| Terminology | [X] | [X×0.2] |
| Format | [X] | [X×0.15] |
| Style | [X] | [X×0.1] |
| **Total** | | **[X/10]** |

### Issues
| # | Dim | Severity | Text (verbatim) | Why it fails | Suggested fix |
|---|-----|----------|-----------------|--------------|---------------|
| 1 | [AC/FL/TM/FM/ST] | High | > "[exact quote]" | [which rule it violates] | [concrete fix] |
```

For dimensions scoring 9-10 with zero issues: output "No issues found." instead of an empty Issues table.

## Rules

1. Single integer per dimension. No ranges.
2. Every score < 10 must have at least one verbatim quote in Issues.
3. For FL: cross-reference Translationese Checklist. Name the pattern.
4. For TM: check against the provided glossary. Every violation flagged.
