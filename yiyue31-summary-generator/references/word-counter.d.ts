/**
 * Word Counter Utility
 *
 * This TypeScript module provides utilities to count words in text files.
 * Supports various file formats including .md, .txt, and other text-based files.
 */
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
export declare function countWords(text: string): number;
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
export declare function countChars(text: string, includeSpaces?: boolean): number;
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
export declare function countLines(text: string): number;
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
export declare function getTextStatistics(text: string, includeSpaces?: boolean): TextStatistics;
/**
 * Check if a file exists
 *
 * @param filePath - Path to the file
 * @returns True if file exists, false otherwise
 */
export declare function fileExists(filePath: string): boolean;
/**
 * Read file content
 *
 * @param filePath - Path to the file
 * @returns File content as string
 * @throws Error if file cannot be read
 */
export declare function readFile(filePath: string): string;
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
export declare function countWordsInFile(filePath: string): number;
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
export declare function getFileStatistics(filePath: string): TextStatistics;
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
export declare function formatStatistics(stats: TextStatistics, filePath?: string): string;
/**
 * CLI interface for word counting
 *
 * @param args - Command line arguments
 */
export declare function runCli(args: string[]): void;
declare const _default: {
    countWords: typeof countWords;
    countChars: typeof countChars;
    countLines: typeof countLines;
    getTextStatistics: typeof getTextStatistics;
    fileExists: typeof fileExists;
    readFile: typeof readFile;
    countWordsInFile: typeof countWordsInFile;
    getFileStatistics: typeof getFileStatistics;
    formatStatistics: typeof formatStatistics;
    runCli: typeof runCli;
};
export default _default;
//# sourceMappingURL=word-counter.d.ts.map