# Word Counter Utility

A TypeScript utility for counting words, characters, lines, and paragraphs in text files.

## Features

- **Total Word Count**: Accurately count total words in text files
- **Language Character Breakdown**:
  - Chinese characters (汉字)
  - English characters
  - Other language characters (Japanese, Korean, Arabic, etc.)
- **Detailed Statistics**:
  - Numbers count
  - Punctuation count
  - Space count
- **Structure Analysis**: Lines and paragraphs
- **Reading Time Estimation**: Based on content language
- **Multiple File Formats**: Supports .md, .txt, and other text-based files
- **CLI Interface**: Easy to use command-line interface
- **Module Support**: Import as a TypeScript module

## Installation

### Prerequisites

- Node.js (v16 or higher)
- TypeScript (v5 or higher)

### Setup

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run build
```

## Usage

### Command Line Interface

```bash
# Count words in a file
node word-counter.js ./article.md

# Count words in a text file
node word-counter.js ./document.txt
```

**Example Output:**
```
📄 File: /path/to/article.md

📊 Text Statistics:

   📝 Total Words:
      1,234 words

   🔤 Character Breakdown:
      中文: 456 chars
      English: 678 chars
      其他语言: 12 chars
      Numbers: 34
      Punctuation: 56

   📏 Total Characters:
      Without spaces: 1,236
      With spaces: 1,456

   📐 Structure:
      Lines: 89
      Paragraphs: 12

   ⏱️  Estimated reading time: 3 min

✅ Successfully counted words in file
```

### As a Module

```typescript
import { countWords, getFileStatistics, formatStatistics } from './word-counter';

// Count words in a file
const wordCount = countWordsInFile('./article.md');
console.log(`Words: ${wordCount}`);

// Get detailed statistics
const stats = getFileStatistics('./article.md');
console.log(stats);
// { words: 1234, characters: 5678, charactersWithSpaces: 6789, lines: 89, paragraphs: 12 }

// Format for display
const formatted = formatStatistics(stats, './article.md');
console.log(formatted);
```

### API Reference

#### `countWords(text: string): number`

Count words in a string.

```typescript
const count = countWords("Hello world"); // Returns 2
```

#### `countChars(text: string, includeSpaces?: boolean): number`

Count characters in a string.

```typescript
const count1 = countChars("Hello world"); // Returns 10 (without spaces)
const count2 = countChars("Hello world", true); // Returns 11 (with spaces)
```

#### `countChineseChars(text: string): number`

Count Chinese characters in a string.

```typescript
const count = countChineseChars("你好Hello世界"); // Returns 4
```

#### `countEnglishChars(text: string): number`

Count English characters (letters) in a string.

```typescript
const count = countEnglishChars("Hello World"); // Returns 10
```

#### `countOtherChars(text: string): number`

Count other language characters (not Chinese or English) in a string.

```typescript
const count = countOtherChars("こんにちは"); // Returns Japanese characters
```

#### `countLines(text: string): number`

Count lines in a string.

```typescript
const count = countLines("Line 1\nLine 2\nLine 3"); // Returns 3
```

#### `getTextStatistics(text: string): TextStatistics`

Get comprehensive text statistics with language breakdown.

```typescript
const stats = getTextStatistics("Hello world\n你好世界");
console.log(stats);
// {
//   totalWords: 4,
//   totalCharacters: 10,
//   charactersWithSpaces: 15,
//   chineseChars: 4,
//   englishChars: 10,
//   otherChars: 0,
//   numbers: 0,
//   punctuation: 1,
//   spaces: 2,
//   lines: 2,
//   paragraphs: 1,
//   readingTimeMinutes: 1
// }
```

#### `countWordsInFile(filePath: string): number`

Count words in a file.

```typescript
const count = countWordsInFile('./article.md');
```

#### `getFileStatistics(filePath: string): TextStatistics`

Get comprehensive statistics for a file with language breakdown.

```typescript
const stats = getFileStatistics('./article.md');
console.log(`Chinese: ${stats.chineseChars}, English: ${stats.englishChars}`);
```

#### `formatStatistics(stats: TextStatistics, filePath?: string): string`

Format statistics for display with language breakdown.

```typescript
const formatted = formatStatistics(stats, './article.md');
console.log(formatted);
```

## Development

### Compile TypeScript

```bash
npm run build
```

### Run Tests

```bash
npm test
```

### Watch Mode

```bash
npm run watch
```

## File Structure

```
references/
├── word-counter.ts       # TypeScript source
├── word-counter.js       # Compiled JavaScript (generated)
├── word-counter.d.ts     # Type definitions (generated)
├── package.json          # NPM configuration
├── tsconfig.json         # TypeScript configuration
└── test.md              # Test file
```

## Examples

### Example 1: Count Words in Multiple Files

```typescript
import * as fs from 'fs';
import { countWordsInFile } from './word-counter';

const files = ['./article1.md', './article2.md', './article3.md'];

files.forEach(file => {
    try {
        const count = countWordsInFile(file);
        console.log(`${file}: ${count} words`);
    } catch (err) {
        console.error(`Error processing ${file}: ${err.message}`);
    }
});
```

### Example 2: Filter Files by Word Count

```typescript
import { getFileStatistics } from './word-counter';

const files = ['./article1.md', './article2.md'];
const minWords = 500;

const longArticles = files.filter(file => {
    const stats = getFileStatistics(file);
    return stats.words >= minWords;
});

console.log('Articles with 500+ words:', longArticles);
```

### Example 3: Calculate Reading Time

```typescript
import { getFileStatistics } from './word-counter';

const stats = getFileStatistics('./article.md');
const readingTimeMinutes = Math.ceil(stats.words / 200);
const readingTimeSeconds = readingTimeMinutes * 60;

console.log(`Reading time: ${readingTimeMinutes} minutes (${readingTimeSeconds} seconds)`);
```

## License

MIT

## Author

Yiyue31
