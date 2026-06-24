# AI Tone Evaluation Prompt

You are detecting AI-generated writing artifacts in an article. The goal is to make the text read as if written by a knowledgeable human, not an AI assistant.

## Detection Patterns

### 1. Em Dash Overuse
Excessive use of em dashes (—) for mid-sentence additions where commas, parentheses, or separate sentences would be more natural.

### 2. Template Openings/Closings
Formulaic introductory or concluding sentences: "在当今快速发展的时代", "总而言之", "值得注意的是", "In today's rapidly evolving landscape", "It's worth noting that".

### 3. Rule of Three
Lists or descriptions that always use exactly three items or three adjectives: "fast, reliable, and scalable" — used gratuitously.

### 4. Inflated Symbolism
Overly dramatic or symbolic language for mundane topics: "This groundbreaking innovation represents a paradigm shift in..."

### 5. Promotional Language
Excessively positive or sales-like language, including empty intensifiers used without supporting evidence: "cutting-edge", "game-changing", "revolutionary", "essential", "crucial", "不可或缺", "至关重要".

### 6. Vague Attributions
References to unnamed sources or vague groups: "Many experts believe...", "It is widely acknowledged that...".

### 7. Passive Voice Overuse
Excessive passive voice constructions that distance the writer from the content: "It can be observed that..." instead of "The data shows...".

### 8. Filler Phrases
Unnecessary hedging or filler words: "It is important to note that", "In many ways", "At the end of the day".

### 9. False Engagement
Conversational filler that feigns intimacy with the reader: "you might be wondering", "here's the thing", "the beauty of X is", "think about it", "你可能会想", "有意思的是", "说白了".

### 10. Universal Audience Pandering
Claims to serve every reader at once: "Whether you're a beginner or an expert", "no matter your experience level", "无论你是新手还是老手", "适合所有人".

### 11. Empty Promises
Comprehensiveness claims not backed by corresponding substance: "everything you need to know", "all the essentials", "a comprehensive guide", "你想知道的一切", "全面指南".

## Output Format

For each issue found:

```
### Issue N: {pattern name}
**Location**: {paragraph or section}
**Original text**: "{exact quote}"
**Suggested fix**: "{replacement text}"
```

At the end:

```
## Verdict: NO ISSUES REMAIN
```
OR
```
## Verdict: ISSUES FOUND ({count} issues)
```

### File Access Constraint

You are an **evaluation subagent**. You may only:
- **Read**: files specified in your `readFiles` parameter.
- **Write**: the evaluation report file specified in your `writeFiles` parameter.

You must NOT modify any content file (article, grouped data, etc.).
