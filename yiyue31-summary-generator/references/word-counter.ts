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
 * Get comprehensive text statistics
 *
 * @param text - The text to analyze
 * @param includeSpaces - Whether to include spaces in character count (default: false)
 * @returns Statistics object with word, character, and line counts
 *
 * @example
 * ```typescript
 * const stats = getTextStatistics("Hello world\nThis is a test");
 * console.log(stats);
 * // { words: 5, characters: 15, lines: 2, paragraphs: 1 }
 * ```
 */
export interface TextStatistics {
    words: number;
    characters: number;
    charactersWithSpaces: number;
    lines: number;
    paragraphs: number;
}

export function getTextStatistics(text: string, includeSpaces: boolean = false): TextStatistics {
    const words = countWords(text);
    const characters = countChars(text, false);
    const charactersWithSpaces = countChars(text, true);
    const lines = countLines(text);

    // Count paragraphs (separated by double newlines)
    const paragraphs = text
        .split(/\n\s*\n/)
        .filter(para => para.trim().length > 0).length;

    return {
        words,
        characters,
        charactersWithSpaces,
        lines,
        paragraphs
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
    lines.push(`   Words: ${stats.words.toLocaleString()}`);
    lines.push(`   Characters (no spaces): ${stats.characters.toLocaleString()}`);
    lines.push(`   Characters (with spaces): ${stats.charactersWithSpaces.toLocaleString()}`);
    lines.push(`   Lines: ${stats.lines.toLocaleString()}`);
    lines.push(`   Paragraphs: ${stats.paragraphs.toLocaleString()}`);

    // Estimated reading time (average 200 words per minute)
    const readingMinutes = Math.ceil(stats.words / 200);
    lines.push(`   Estimated reading time: ${readingMinutes} min`);

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
    getTextStatistics,
    fileExists,
    readFile,
    countWordsInFile,
    getFileStatistics,
    formatStatistics,
    runCli
};
