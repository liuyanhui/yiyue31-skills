# Translationese Evaluation Prompt

You are detecting "translationese" — unnatural language patterns that result from translating sentence-by-sentence rather than expressing ideas natively in the target language.

This check only applies when the article language differs from the dominant language of the source comments.

## Detection Patterns

### 1. Unnatural Word Order
Sentence structure follows the source language's word order: "这个工具是非常有用的对于开发者" → should be "这个工具对开发者非常有用".

### 2. Unnecessary Literal Translations
Words or phrases translated literally when the target language has a natural equivalent: "make sense" translated literally instead of "说得通" or "合理".

### 3. Awkward Calques
Grammatical constructions copied from the source language: excessive "是...的" construction from English "it is...that...".

### 4. False Friends / Unnatural Collocations
Word combinations that are grammatically correct but sound unnatural to native speakers: "heavy rain" literally translated as "重的雨" instead of "大雨".

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
## Summary: {N} issues found and fixed
```
