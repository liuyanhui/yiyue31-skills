/**
 * Word Counter Utility
 *
 * This TypeScript module provides utilities to count words in text files.
 * Supports various file formats including .md, .txt, and other text-based files.
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Count words in a string
 *
 * @param text - The text to count words in
 * @returns Number of words
 *
 * @example
 * ```typescript
 * const count = countWords("Hello world"); // Returns 2
 * const count2 = countWords("This is a test"); // Returns 4
 * ```
 */
export function countWords(text: string): number {
    if (!text || text.trim().length === 0) {
        return 0;
    }

    // Split by whitespace and filter out empty strings
    const words = text.trim().split(/\s+/).filter(word => word.length > 0);

    return words.length;
}

/**
 * Count characters in a string
 *
 * @param text - The text to count characters in
 * @param includeSpaces - Whether to include spaces in count (default: false)
 * @returns Number of characters
 *
 * @example
 * ```typescript
 * const count = countChars("Hello world"); // Returns 10 (without spaces)
 * const count2 = countChars("Hello world", true); // Returns 11 (with spaces)
 * ```
 */
export function countChars(text: string, includeSpaces: boolean = false): number {
    if (!text) {
        return 0;
    }

    if (includeSpaces) {
        return text.length;
    }

    // Count non-whitespace characters
    const nonWhitespace = text.replace(/\s/g, '');
    return nonWhitespace.length;
}

/**
 * Count lines in a string
 *
 * @param text - The text to count lines in
 * @returns Number of lines
 *
 * @example
 * ```typescript
 * const count = countLines("Line 1\nLine 2\nLine 3"); // Returns 3
 * ```
 */
export function countLines(text: string): number {
    if (!text || text.trim().length === 0) {
        return 0;
    }

    const lines = text.split('\n').filter(line => line.trim().length > 0);
    return lines.length;
}

/**
 * Count Chinese characters
 *
 * @param text - The text to count Chinese characters in
 * @returns Number of Chinese characters
 *
 * @example
 * ```typescript
 * const count = countChineseChars("你好Hello世界"); // Returns 4 (你好世界)
 * ```
 */
export function countChineseChars(text: string): number {
    if (!text) {
        return 0;
    }

    // Match Chinese characters (CJK Unified Ideographs)
    // Basic range: U+4E00-U+9FFF (most common Chinese characters)
    // Extension A: U+3400-U+4DBF
    const chinesePattern = /[\u4e00-\u9fff\u3400-\u4dbf]/gu;
    const matches = text.match(chinesePattern);
    return matches ? matches.length : 0;
}

/**
 * Count English characters (letters, numbers, and common punctuation)
 *
 * @param text - The text to count English characters in
 * @returns Number of English characters
 *
 * @example
 * ```typescript
 * const count = countEnglishChars("Hello, World! 123"); // Returns 15
 * ```
 */
export function countEnglishChars(text: string): number {
    if (!text) {
        return 0;
    }

    // Match English letters (a-z, A-Z)
    const englishPattern = /[a-zA-Z]/g;
    const matches = text.match(englishPattern);
    return matches ? matches.length : 0;
}

/**
 * Count other language characters (not Chinese or English)
 *
 * @param text - The text to count other characters in
 * @returns Number of other language characters
 *
 * @example
 * ```typescript
 * const count = countOtherChars("こんにちは"); // Returns Japanese characters
 * ```
 */
export function countOtherChars(text: string): number {
    if (!text) {
        return 0;
    }

    const chineseChars = countChineseChars(text);
    const englishChars = countEnglishChars(text);
    const numbers = (text.match(/\d/g) || []).length;
    const spaces = (text.match(/\s/g) || []).length;
    const punctuation = (text.match(/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/g) || []).length;

    // Total non-whitespace characters minus known categories
    const totalChars = text.replace(/\s/g, '').length;

    // Other = total - chinese - english - numbers - punctuation
    const other = totalChars - chineseChars - englishChars - numbers - punctuation;

    return Math.max(0, other);
}

/**
 * Get comprehensive text statistics with language breakdown
 *
 * @param text - The text to analyze
 * @param includeSpaces - Whether to include spaces in character count (default: false)
 * @returns Statistics object with detailed language breakdown
 *
 * @example
 * ```typescript
 * const stats = getTextStatistics("Hello world\n你好世界");
 * console.log(stats);
 * // { totalWords: 4, chineseChars: 4, englishChars: 10, otherChars: 0, ... }
 * ```
 */
export interface TextStatistics {
    totalWords: number;
    totalCharacters: number;
    charactersWithSpaces: number;
    chineseChars: number;
    englishChars: number;
    otherChars: number;
    numbers: number;
    punctuation: number;
    spaces: number;
    lines: number;
    paragraphs: number;
    readingTimeMinutes: number;
}

export function getTextStatistics(text: string, includeSpaces: boolean = false): TextStatistics {
    const totalWords = countWords(text);
    const totalCharacters = countChars(text, false);
    const charactersWithSpaces = countChars(text, true);
    const lines = countLines(text);

    // Count by language
    const chineseChars = countChineseChars(text);
    const englishChars = countEnglishChars(text);
    const otherChars = countOtherChars(text);

    // Count numbers and punctuation
    const numbers = (text.match(/\d/g) || []).length;

    // Count punctuation marks manually
    const punctuationSet = new Set(['!', '"', '#', '$', '%', '&', "'", '(', ')', '*', '+', ',', '-', '.', '/', ':', ';', '<', '=', '>', '?', '@', '[', '\\', ']', '^', '_', '`', '{', '|', '}', '~']);
    let punctuation = 0;
    for (const char of text) {
        if (punctuationSet.has(char)) {
            punctuation++;
        }
    }

    const spaces = (text.match(/\s/g) || []).length;

    // Count paragraphs (separated by double newlines)
    const paragraphs = text
        .split(/\n\s*\n/)
        .filter(para => para.trim().length > 0).length;

    // Calculate reading time
    // Mixed content: average 200 Chinese chars or 100 English words per minute
    const chineseReadingTime = chineseChars / 300; // Chinese: ~300 chars/min
    const englishReadingTime = totalWords / 200;   // English: ~200 words/min
    const readingTimeMinutes = Math.ceil(Math.max(chineseReadingTime, englishReadingTime));

    return {
        totalWords,
        totalCharacters,
        charactersWithSpaces,
        chineseChars,
        englishChars,
        otherChars,
        numbers,
        punctuation,
        spaces,
        lines,
        paragraphs,
        readingTimeMinutes
    };
}

/**
 * Check if a file exists
 *
 * @param filePath - Path to the file
 * @returns True if file exists, false otherwise
 */
export function fileExists(filePath: string): boolean {
    try {
        return fs.statSync(filePath).isFile();
    } catch (err) {
        return false;
    }
}

/**
 * Read file content
 *
 * @param filePath - Path to the file
 * @returns File content as string
 * @throws Error if file cannot be read
 */
export function readFile(filePath: string): string {
    if (!fileExists(filePath)) {
        throw new Error(`File not found: ${filePath}`);
    }

    try {
        // Read as UTF-8 text
        const content = fs.readFileSync(filePath, 'utf-8');
        return content;
    } catch (err) {
        throw new Error(`Failed to read file: ${filePath}`);
    }
}

/**
 * Count words in a file
 *
 * @param filePath - Path to the file
 * @returns Number of words in the file
 * @throws Error if file cannot be read
 *
 * @example
 * ```typescript
 * try {
 *     const count = countWordsInFile('./article.md');
 *     console.log(`Words: ${count}`);
 * } catch (err) {
 *     console.error(err.message);
 * }
 * ```
 */
export function countWordsInFile(filePath: string): number {
    const content = readFile(filePath);
    return countWords(content);
}

/**
 * Get comprehensive statistics for a file
 *
 * @param filePath - Path to the file
 * @returns Statistics object with detailed counts
 * @throws Error if file cannot be read
 *
 * @example
 * ```typescript
 * try {
 *     const stats = getFileStatistics('./article.md');
 *     console.log(`Words: ${stats.words}`);
 *     console.log(`Characters: ${stats.characters}`);
 *     console.log(`Lines: ${stats.lines}`);
 *     console.log(`Paragraphs: ${stats.paragraphs}`);
 * } catch (err) {
 *     console.error(err.message);
 * }
 * ```
 */
export function getFileStatistics(filePath: string): TextStatistics {
    const content = readFile(filePath);
    return getTextStatistics(content);
}

/**
 * Format statistics for display
 *
 * @param stats - Statistics object
 * @param filePath - Optional file path to include in output
 * @returns Formatted string
 *
 * @example
 * ```typescript
 * const stats = getFileStatistics('./article.md');
 * const formatted = formatStatistics(stats, './article.md');
 * console.log(formatted);
 * ```
 */
export function formatStatistics(stats: TextStatistics, filePath?: string): string {
    const lines: string[] = [];

    if (filePath) {
        lines.push(`📄 File: ${filePath}`);
        lines.push('');
    }

    lines.push('📊 Text Statistics:');
    lines.push('');
    lines.push('   📝 Total Words:');
    lines.push(`      ${stats.totalWords.toLocaleString()} words`);
    lines.push('');
    lines.push('   🔤 Character Breakdown:');
    lines.push(`      中文: ${stats.chineseChars.toLocaleString()} chars`);
    lines.push(`      English: ${stats.englishChars.toLocaleString()} chars`);
    lines.push(`      其他语言: ${stats.otherChars.toLocaleString()} chars`);
    lines.push(`      Numbers: ${stats.numbers.toLocaleString()}`);
    lines.push(`      Punctuation: ${stats.punctuation.toLocaleString()}`);
    lines.push('');
    lines.push('   📏 Total Characters:');
    lines.push(`      Without spaces: ${stats.totalCharacters.toLocaleString()}`);
    lines.push(`      With spaces: ${stats.charactersWithSpaces.toLocaleString()}`);
    lines.push('');
    lines.push('   📐 Structure:');
    lines.push(`      Lines: ${stats.lines.toLocaleString()}`);
    lines.push(`      Paragraphs: ${stats.paragraphs.toLocaleString()}`);
    lines.push('');
    lines.push(`   ⏱️  Estimated reading time: ${stats.readingTimeMinutes} min`);

    return lines.join('\n');
}

/**
 * CLI interface for word counting
 *
 * @param args - Command line arguments
 */
export function runCli(args: string[]): void {
    if (args.length < 1) {
        console.log('Usage: word-counter <file-path>');
        console.log('');
        console.log('Examples:');
        console.log('  word-counter ./article.md');
        console.log('  word-counter ./document.txt');
        console.log('');
        console.log('Supported formats: .md, .txt, and other text-based files');
        process.exit(1);
    }

    const filePath = args[0];

    // Resolve relative path
    const resolvedPath = path.resolve(filePath);

    try {
        const stats = getFileStatistics(resolvedPath);
        const formatted = formatStatistics(stats, resolvedPath);
        console.log(formatted);
        console.log('');
        console.log('✅ Successfully counted words in file');
    } catch (err) {
        if (err instanceof Error) {
            console.error(`❌ Error: ${err.message}`);
        } else {
            console.error('❌ Unknown error occurred');
        }
        process.exit(1);
    }
}

// Run CLI if this file is executed directly
if (require.main === module) {
    const args = process.argv.slice(2);
    runCli(args);
}

// Export all functions for use as a module
export default {
    countWords,
    countChars,
    countLines,
    countChineseChars,
    countEnglishChars,
    countOtherChars,
    getTextStatistics,
    fileExists,
    readFile,
    countWordsInFile,
    getFileStatistics,
    formatStatistics,
    runCli
};
