# Analysis Evaluation Prompt

Score an article analysis across 4 dimensions (0-10 each) and list every problem with verbatim evidence. Do not edit — produce scores and a detailed issue report with enough diagnostic detail (including suggested fixes) for a separate revision step to resolve all issues without re-reading the original article.

---

## Anti-Inflation

Default to critical. "Not bad" = 5, not 7. Follow the rubric strictly.

## Pre-check

1. Empty / < 10 words / gibberish → output "Input is not a valid analysis. Evaluation aborted." and stop.
2. Missing required sections (Language, Article type, Topic & domain, Structure, Paragraphs, Entities, Terminology, Quotes, Background) → list missing sections and proceed with scoring. Missing sections cap the affected dimension at 5. Dimension mapping: Language/Type/Topic→CO; Entities/Background→CO+ED; Structure→CO+SC; Paragraphs→ED; Terminology→CO+ED; Quotes→ED.

## Scoring Rubric

| Band | Completeness (CO) | Accuracy (AC) | Structural Clarity (SC) | Extraction Depth (ED) |
|------|-------------------|---------------|-------------------------|----------------------|
| 9-10 | All required sections present. Every key point, entity, term, and background detail captured. | Zero misrepresentations. Every extracted point faithfully reflects the original. | Clear hierarchy mirroring article structure. Logical grouping. | Per-paragraph analysis with core viewpoints, sub-points, and context. Standout quotes selected with justification. |
| 5-8 | Missing a section or several key points. Noticeable gaps in entities, terminology, or background. | Some misreadings, unsupported extrapolations, or ≤2 minor inaccuracies. | Hierarchy unclear in places. Inconsistent grouping. | Most paragraphs analyzed but shallow in places. Missing sub-points or context. |
| 0-4 | Multiple sections missing, near-empty, or generic enough to describe any article. | Fundamentally wrong, fabricated, or multiple misrepresentations. | Flat structure, illogical ordering, or no discernible structure. | Surface-level extraction only. No meaningful analysis or sub-points. |

## Weights

| Dimension | Weight |
|-----------|--------|
| Completeness | 30% |
| Accuracy | 30% |
| Structural Clarity | 15% |
| Extraction Depth | 25% |

## Output Report

```markdown
## Analysis Evaluation Report

**Article:** [title] | **Words:** [N] | **Weights:** CO 30% / AC 30% / SC 15% / ED 25%

### Methodology
- **Dimensions**: CO: coverage of required sections, key points, and background | AC: faithfulness to original content | SC: organizational clarity and hierarchy | ED: depth of paragraph-level extraction and quote selection
- **Formula**: Total = round(CO×0.3 + AC×0.3 + SC×0.15 + ED×0.25). Range 0-10.

### Scores
| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Completeness | [X] | 30% | [X×0.3] |
| Accuracy | [X] | 30% | [X×0.3] |
| Structural Clarity | [X] | 15% | [X×0.15] |
| Extraction Depth | [X] | 25% | [X×0.25] |
| **Total** | | | **[X/10]** |

### Issues
| # | Dim | Severity | Text (verbatim) | Why it fails | Suggested fix |
|---|-----|----------|-----------------|--------------|---------------|
| 1 | [CO/AC/SC/ED] | High | > "[exact quote]" | [which rule it violates] | [concrete fix] |
```

## Rules

1. Single integer per dimension. No ranges.
2. Every score justified by at least one verbatim quote in the Issues table.
3. Only flag problems clearly present. No speculation about the original article.
4. Severity: **High** (score-defining), **Medium** (notable), **Low** (minor).
