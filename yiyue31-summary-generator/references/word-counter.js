"use strict";
/**
 * Word Counter Utility
 *
 * This TypeScript module provides utilities to count words in text files.
 * Supports various file formats including .md, .txt, and other text-based files.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.countWords = countWords;
exports.countChars = countChars;
exports.countLines = countLines;
exports.getTextStatistics = getTextStatistics;
exports.fileExists = fileExists;
exports.readFile = readFile;
exports.countWordsInFile = countWordsInFile;
exports.getFileStatistics = getFileStatistics;
exports.formatStatistics = formatStatistics;
exports.runCli = runCli;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
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
function countWords(text) {
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
function countChars(text, includeSpaces = false) {
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
function countLines(text) {
    if (!text || text.trim().length === 0) {
        return 0;
    }
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    return lines.length;
}
function getTextStatistics(text, includeSpaces = false) {
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
function fileExists(filePath) {
    try {
        return fs.statSync(filePath).isFile();
    }
    catch (err) {
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
function readFile(filePath) {
    if (!fileExists(filePath)) {
        throw new Error(`File not found: ${filePath}`);
    }
    try {
        // Read as UTF-8 text
        const content = fs.readFileSync(filePath, 'utf-8');
        return content;
    }
    catch (err) {
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
function countWordsInFile(filePath) {
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
function getFileStatistics(filePath) {
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
function formatStatistics(stats, filePath) {
    const lines = [];
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
function runCli(args) {
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
    }
    catch (err) {
        if (err instanceof Error) {
            console.error(`❌ Error: ${err.message}`);
        }
        else {
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
exports.default = {
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
//# sourceMappingURL=word-counter.js.map