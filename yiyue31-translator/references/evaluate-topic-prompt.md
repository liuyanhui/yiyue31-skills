# Topic Analysis Evaluation Prompt

Score a topic analysis result across 3 dimensions (0-10 each) and list every problem with verbatim evidence. Produce scores and a detailed issue report with enough diagnostic detail (including suggested fixes) for a separate revision step to resolve all issues without re-reading the original article.

---

## Input

You will receive:

1. **Original article** — the source English text
2. **Topic analysis** — the analysis result to evaluate (topic, key terms, glossary status)
3. **Glossary file list** — available glossary files from `{skill-dir}/glossary/`

## Anti-Inflation

Default to critical. "Not bad" = 5, not 7. Follow the rubric strictly.

- If you find 3+ issues in a dimension, that dimension cannot exceed 7.
- A score of 8 means the analysis is solid with only minor gaps.
- A score of 9-10 means the analysis is essentially flawless.

## Pre-check

1. Input is empty or not a topic analysis → output "Input is not a valid topic analysis. Evaluation aborted." and stop.
2. Topic field missing or fundamentally wrong (completely unrelated to article content) → output "Topic identification failed. Evaluation aborted." and stop.

## Scoring Rubric

| Band | Topic Match (TM) | Term Coverage (TC) | Glossary Utilization (GU) |
|------|------------------|--------------------|---------------------------|
| 9-10 | Topic precisely identified with correct domain and specificity. | All key terms identified (see Checklist). No important terms missed. | Relevant glossary loaded. All matching terms recognized. New terms properly flagged. |
| 5-8 | Topic identified but slightly broad, narrow, or off-target. | Most key terms identified. 1-3 non-critical terms missed. | Most glossary terms recognized. Minor mismatches. |
| 0-4 | Topic too vague or missing. | Many key terms missed. Critical domain terms absent. | Glossary ignored or multiple mismatches. |

## Weights

Total = round(TM×0.35 + TC×0.35 + GU×0.3). Range 0-10.

## Key Term Checklist

TC dimension criteria. A "key term" meets any of these conditions:

- Appears in headings (h1/h2/h3) or title
- Repeatedly referenced (3+ occurrences) with a specific domain meaning
- Technical terms specific to the article's domain (framework names, protocols, algorithms, design patterns)
- Proper nouns central to the article's topic
- Terms with special domain-specific definitions (not general English)

Non-key terms: general English words, common programming terms unrelated to the specific topic, passing mentions.

## Topic Match Checklist

TM dimension criteria:

- Topic matches the primary domain of the article
- If multiple topics possible, most specific one chosen
- Topic corresponds to an existing glossary file, or is specific enough to create one
- Topic is not overly broad ("technology") or narrow ("one specific function parameter")

## Glossary Utilization Checklist

GU dimension criteria:

- All glossary files relevant to the identified topic are loaded
- Terms in the loaded glossary that appear in the article are recognized
- New domain terms not in the glossary are flagged for potential addition
- Terms are correctly categorized as glossary-matched or new

## Severity

| Severity | Impact |
|----------|--------|
| **High** | Score-defining. 2+ High issues in a dimension → that dimension ≤ 5 |
| **Medium** | Notable. 3+ Medium issues = equivalent to 1 High |
| **Low** | Minor. Cosmetic or formatting. |

## Output Report

```markdown
## Topic Analysis Evaluation Report

**Article:** [title] | **Topic:** [identified topic] | **Weights:** TM 35% / TC 35% / GU 30%

### Scores
| Dimension | Score | Weighted |
|-----------|-------|----------|
| Topic Match | [X] | [X×0.35] |
| Term Coverage | [X] | [X×0.35] |
| Glossary Utilization | [X] | [X×0.3] |
| **Total** | | **[X/10]** |

### Issues
| # | Dim | Severity | Text (verbatim) | Why it fails | Suggested fix |
|---|-----|----------|-----------------|--------------|---------------|
| 1 | [TM/TC/GU] | High | > "[exact quote]" | [which rule it violates] | [concrete fix] |
```

For dimensions scoring 9-10 with zero issues: output "No issues found." instead of an empty Issues table.

## Rules

1. Single integer per dimension. No ranges.
2. Every score < 10 must have at least one verbatim quote in Issues.
3. For TC: cross-reference Key Term Checklist to identify missed terms.
4. For GU: check against the provided glossary file list.
