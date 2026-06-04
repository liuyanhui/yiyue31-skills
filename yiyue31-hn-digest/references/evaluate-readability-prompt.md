# Readability Evaluation Prompt

You are checking and improving the readability of a generated article. Focus on structural and stylistic elements that affect how easily a reader can follow the text.

## Check Dimensions

### 1. Paragraph Length
- Check: Does any paragraph exceed 5 sentences?
- Problem: Long paragraphs overwhelm readers and bury key points.
- Fix: Split long paragraphs at natural breaks — one paragraph per idea or angle.

### 2. Paragraph Flow
- Check: Does each paragraph flow naturally to the next? Are there logical transitions?
- Problem: Abrupt topic changes between paragraphs with no connecting language.
- Fix: Add transition words/phrases where needed. Ensure each paragraph's last sentence connects to the next paragraph's first sentence.

### 3. Section Transitions
- Check: Between subsections (### headings), is there a transition sentence explaining how the next topic relates to the previous one?
- Problem: Sections read like independent mini-articles with no narrative thread connecting them.
- Fix: Add a transition sentence at the start or end of each section that links it to the adjacent section. The article should feel like one connected story, not a list of topics.

### 4. Heading Clarity
- Check: Are section headings descriptive and specific?
- Problem: Generic headings like "Analysis" or "Discussion" that don't tell the reader what the section covers.
- Fix: Replace with specific, informative headings that summarize the section's key point.

### 5. Sentence Length Variation
- Check: Do sentences vary in length, or are they all roughly the same?
- Problem: Monotonous rhythm from uniform sentence lengths.
- Fix: Mix short and long sentences. Use short sentences for emphasis. Use longer sentences for complex explanations.

### 6. Jargon Accessibility
- Check: Are technical or domain-specific terms explained on first use?
- Problem: Terms like "S&P 500", "GAAP", "流通股", "价格发现" appear without context.
- Fix: Add a brief explanation in parentheses or reword in plain language. Only skip if the term is common knowledge for a general audience.

### 7. Number Comprehensibility
- Check: Are large numbers given reference points?
- Problem: "$965B" or "$175万亿" without context — readers can't judge if this is big or small.
- Fix: Add a comparison ("equivalent to Sweden's annual GDP") or scale description. Skip if the number is self-explanatory (e.g., "30 comments").

### 8. Formatting Consistency
- Check: Is formatting consistent throughout? (bullet style, quote formatting, emphasis usage)
- Problem: Mixed formatting that distracts the reader.
- Fix: Standardize formatting choices across the entire article.

## Output Format

For each issue found, output:

```
### Issue N: {dimension name}
**Location**: {paragraph or section}
**Current text**: "{relevant excerpt}"
**Problem**: {readability issue description}
**Suggested improvement**: "{improved text}"
```

At the end, output:

```
## Summary: {N} readability issues found and fixed
```

## Instructions

1. Read the article file provided.
2. Check each of the 8 readability dimensions.
3. For each issue found, document it with location and improvement.
4. Apply the improvements directly to the article file (overwrite in place).
5. Write this evaluation report to the specified output file.
