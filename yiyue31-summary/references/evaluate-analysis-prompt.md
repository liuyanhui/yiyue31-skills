# Analysis Evaluation Prompt

Score an article analysis across 4 dimensions (0-10 each) and list every problem with verbatim evidence. Do not edit — produce scores and a detailed issue report with enough diagnostic detail (including suggested fixes) for a separate revision step to resolve all issues without re-reading the original article.

---

## Anti-Inflation

Default to critical. "Not bad" = 5, not 7. Follow the rubric strictly.

## Pre-check

1. Empty / < 10 words / gibberish → output "Input is not a valid analysis. Evaluation aborted." and stop.
2. Missing required sections (Language, Article type, Topic & domain, Structure, Paragraphs, Entities, Terminology, Quotes) → list missing sections and proceed with scoring. Missing sections cap the affected dimension at 5.

## Scoring Rubric

| Band | Completeness (CO) | Accuracy (AC) | Structural Clarity (SC) | Extraction Depth (ED) |
|------|-------------------|---------------|-------------------------|----------------------|
| 9-10 | All required sections present. Every key point, entity, and term captured. | Zero misrepresentations. Every extracted point faithfully reflects the original. | Clear hierarchy mirroring article structure. Logical grouping. | Per-paragraph analysis with core viewpoints, sub-points, and context. Standout quotes selected with justification. |
| 7-8 | Minor omissions (1-2 non-critical points/terms). | ≤2 minor inaccuracies or slightly over-simplified claims. | Mostly clear. Minor grouping or ordering issues. | Most paragraphs analyzed. Occasional shallow treatment of complex sections. |
| 5-6 | Missing a section or several key points. Noticeable gaps in entities or terminology. | Some misreadings or unsupported extrapolations. | Hierarchy unclear in places. Inconsistent grouping. | Shallow paragraph analysis. Missing sub-points or context. |
| 3-4 | Multiple sections missing or largely empty. Key topics unaddressed. | Multiple misrepresentations or fabricated claims. | Flat structure or illogical ordering. | Surface-level extraction only. No sub-points. |
| 0-2 | Near-empty or generic. Could describe any article. | Fundamentally wrong or fabricated. | No discernible structure. | No meaningful extraction. |

## Weights

| Dimension | Weight |
|-----------|--------|
| Completeness | 30% |
| Accuracy | 30% |
| Structural Clarity | 20% |
| Extraction Depth | 20% |

## Output Report

```markdown
## Analysis Evaluation Report

**Article:** [title] | **Words:** [N] | **Weights:** CO 30% / AC 30% / SC 20% / ED 20%

### Methodology
- **Dimensions & Definitions**: [CO: coverage of required sections and key points | AC: faithfulness to original content | SC: organizational clarity and hierarchy | ED: depth of paragraph-level extraction and quote selection]
- **Weights**: CO 30%, AC 30%, SC 20%, ED 20%
- **Formula**: Total = round(CO×0.3 + AC×0.3 + SC×0.2 + ED×0.2). Range 0-10.

### Scores
| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Completeness | [X] | 30% | [X×0.3] |
| Accuracy | [X] | 30% | [X×0.3] |
| Structural Clarity | [X] | 20% | [X×0.2] |
| Extraction Depth | [X] | 20% | [X×0.2] |
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
