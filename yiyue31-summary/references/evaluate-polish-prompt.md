# Polish Evaluation Prompt

Score a polished summary across 4 dimensions (0-10 each) and list every problem with verbatim evidence. Do not edit — produce scores and a detailed issue report with enough diagnostic detail (including suggested fixes) for a separate revision step to resolve all issues without re-reading the original article.

---

## Anti-Inflation

Default to critical. "Not bad" = 5, not 7. Follow the rubric strictly.

## Pre-check

1. Empty / < 10 words / gibberish / raw code → output "Input is not a valid polished summary. Evaluation aborted." and stop.
2. Input appears to be raw analysis (contains section headers like "Entities", "Terminology", "Paragraphs") or original article rather than a polished summary → output "Input is not a polished summary. Evaluation aborted." and stop.
3. < 3 sentences → note "Insufficient length for granular analysis." NA and RE scores approximate.

## Scoring Rubric

| Band | Naturalness (NA) | Readability (RE) | Fidelity (FI) | Professionalism (PR) |
|------|------------------|-------------------|----------------|---------------------|
| 9-10 | Zero AI artifacts (see AI Pattern Checklist). Reads like a skilled human writer. | Smooth flow with varied sentence structure. Transitions feel organic. | All technical claims, data, quotes, and terminology preserved exactly. No distortion from polishing. | Concise, clear, specific. No filler or platitudes. Consistent professional tone throughout. |
| 5-8 | Noticeable AI patterns present: formulaic transitions, manufactured parallels, repetitive structures, or excessive hedging (1-3 instances). | Some awkward transitions or repetitive sentence openings. Flow generally adequate but not smooth. | Some precision losses, slight distortions, or technical terms replaced with less precise alternatives. Core meaning intact. | Occasional wordiness, filler, or vague claims. Professional tone inconsistent. |
| 0-4 | Heavy AI artifacts throughout, or clearly machine-generated with no attempt at natural expression. | Choppy, hard to follow, monotonous structure, or incoherent. | Key details lost, quotes paraphrased incorrectly, technical meaning fundamentally changed, or specialized terms replaced with oversimplified language. | Excessive padding, multiple vague/generic statements, or no professional quality. |

## AI Pattern Checklist

Flag these specific patterns as NA issues:

- Formulaic transitions: "It's worth noting", "In conclusion", "It's important to", "Furthermore"
- Manufactured parallel structures: forced three-part lists, symmetric but shallow comparisons
- Excessive hedging: "may", "might", "could potentially", "it seems"
- Repetitive sentence patterns: same opening structure 3+ times
- Vague attribution: "experts say", "research shows", "studies indicate" (without specific source)
- Negation-based parallelism: "not just X, but Y", "not only X, but also Y"

## Weights

| Dimension | Weight |
|-----------|--------|
| Naturalness | 30% |
| Readability | 20% |
| Fidelity | 30% |
| Professionalism | 20% |

## Output Report

```markdown
## Polish Evaluation Report

**Summary:** [title] | **Words:** [N] | **Weights:** NA 30% / RE 20% / FI 30% / PR 20%

### Methodology
- **Dimensions**: NA: freedom from AI-generated patterns (see AI Pattern Checklist) | RE: flow and sentence variety | FI: preservation of original meaning, technical precision, and terminology | PR: conciseness and professional tone
- **Formula**: Total = round(NA×0.3 + RE×0.2 + FI×0.3 + PR×0.2). Range 0-10.

### Scores
| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Naturalness | [X] | 30% | [X×0.3] |
| Readability | [X] | 20% | [X×0.2] |
| Fidelity | [X] | 30% | [X×0.3] |
| Professionalism | [X] | 20% | [X×0.2] |
| **Total** | | | **[X/10]** |

### Issues
| # | Dim | Severity | Text (verbatim) | Why it fails | Suggested fix |
|---|-----|----------|-----------------|--------------|---------------|
| 1 | [NA/RE/FI/PR] | High | > "[exact quote]" | [which rule or AI pattern it violates] | [concrete fix] |
```

## Rules

1. Single integer per dimension. No ranges.
2. Every score justified by at least one verbatim quote in the Issues table.
3. Only flag problems clearly present. No speculation about intent.
4. Severity: **High** (score-defining), **Medium** (notable), **Low** (minor).
