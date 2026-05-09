# Polish Evaluation Prompt

Score a polished summary across 4 dimensions (0-10 each) and list every problem with verbatim evidence. Do not edit — produce scores and a detailed issue report with enough diagnostic detail (including suggested fixes) for a separate revision step to resolve all issues without re-reading the original article.

---

## Anti-Inflation

Default to critical. "Not bad" = 5, not 7. Follow the rubric strictly.

## Pre-check

1. Empty / < 10 words / gibberish / raw code → output "Input is not a valid polished summary. Evaluation aborted." and stop.
2. < 3 sentences → note "Insufficient length for granular analysis." NA and RE scores approximate.

## Scoring Rubric

| Band | Naturalness (NA) | Readability (RE) | Fidelity (FI) | Professionalism (PR) |
|------|------------------|-------------------|----------------|---------------------|
| 9-10 | Zero AI artifacts. No formulaic transitions, manufactured parallels, or hedging patterns. Reads like a skilled human writer. | Smooth flow with varied sentence structure. Transitions feel organic. | All technical claims, data, and quotes preserved exactly. No distortion from polishing. | Concise, clear, specific. No filler or platitudes. Consistent professional tone throughout. |
| 7-8 | Occasional minor AI patterns (1-2 instances). | Generally smooth. Minor choppy transitions. | ≤2 minor precision losses. Core meaning intact. | Occasional wordiness or a single vague claim. |
| 5-6 | Noticeable AI patterns: repeated "It's worth noting", "In conclusion", or similar formulaic phrases. | Some awkward transitions. Repetitive sentence openings. | Several precision losses or slight distortions. | Noticeable filler. Some vague or generic claims. |
| 3-4 | Heavy AI artifacts throughout. Manufactured parallel structures, excessive hedging. | Choppy, hard to follow. Monotonous structure. | Key details lost or distorted. Quotes paraphrased incorrectly. | Excessive padding. Multiple vague or generic statements. |
| 0-2 | Clearly machine-generated. No attempt at natural expression. | Unreadable or incoherent. | Fundamentally changed meaning. | No professional quality. |

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
| Readability | 25% |
| Fidelity | 25% |
| Professionalism | 20% |

## Output Report

```markdown
## Polish Evaluation Report

**Summary:** [title] | **Words:** [N] | **Weights:** NA 30% / RE 25% / FI 25% / PR 20%

### Methodology
- **Dimensions & Definitions**: [NA: freedom from AI-generated patterns | RE: flow and sentence variety | FI: preservation of original meaning and technical precision | PR: conciseness and professional tone]
- **Weights**: NA 30%, RE 25%, FI 25%, PR 20%
- **Formula**: Total = round(NA×0.3 + RE×0.25 + FI×0.25 + PR×0.2). Range 0-10.

### Scores
| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Naturalness | [X] | 30% | [X×0.3] |
| Readability | [X] | 25% | [X×0.25] |
| Fidelity | [X] | 25% | [X×0.25] |
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
5. For NA dimension: cross-reference the AI Pattern Checklist. Each detected pattern must appear in Issues with the pattern name.
