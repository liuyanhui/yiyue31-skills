# Scripts Directory

This directory contains executable scripts for the yiyue31-summary-generator skill.

## Word Counter

A utility to count words and characters in text files with language breakdown support.

### Usage

```bash
# From this directory
node word-counter.js <file-path>

# Example
node word-counter.js ../SKILL.md
node word-counter.js ../templates/standard.md
```

### Features

- **Total Word Count**: Accurate word counting
- **Language Breakdown**:
  - Chinese characters (中文)
  - English characters
  - Other language characters
- **Detailed Statistics**: Numbers, punctuation, spaces
- **Structure Analysis**: Lines, paragraphs
- **Reading Time**: Language-aware estimation

### Example Output

```
📄 File: ../SKILL.md

📊 Text Statistics:

   📝 Total Words:
      289 words

   🔤 Character Breakdown:
      中文: 1,011 chars
      English: 1,100 chars
      其他语言: 116 chars
      Numbers: 15
      Punctuation: 375

   📏 Total Characters:
      Without spaces: 2,617
      With spaces: 3,084

   📐 Structure:
      Lines: 67
      Paragraphs: 22

   ⏱️  Estimated reading time: 4 min

✅ Successfully counted words in file
```

### Requirements

- Node.js (v16 or higher)
- No additional dependencies needed (uses only Node.js built-in modules)

### Notes

The word-counter.js file is a compiled JavaScript file that can run directly without any build process or additional dependencies.
