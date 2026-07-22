# Readability Evaluation Prompt

> Last updated: 2026-07-01 16:37:48

You are checking and improving the readability of a generated article. Target: an article that reads easily in one pass — paragraphs digestible, rhythm varied, numbers grounded. The checks below are deviations from that target.

## Check Dimensions

### 1. Paragraph Length
Does any paragraph exceed 5 sentences? Split long paragraphs at natural breaks — one paragraph per idea or angle.

### 2. Sentence Length Variation
Do sentences vary in length, or is the rhythm monotonous from uniform sentence lengths? Mix short and long sentences. Use short sentences for emphasis.

### 3. Number Comprehensibility
Are large numbers given reference points? "$965B" or "175万亿" without context — readers can't judge scale. Add a comparison ("equivalent to Sweden's annual GDP") or scale description. Skip self-explanatory numbers (e.g., "30 comments").

## Output Format

For each issue found:

```
### Issue N: {dimension name}
**Location**: {paragraph or section}
**Current text**: "{relevant excerpt}"
**Suggested improvement**: "{improved text}"
```

At the end:

```
## Summary: {N} readability issues found and fixed
```
