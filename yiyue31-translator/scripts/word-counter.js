"use strict";
/**
 * Word Counter Utility - 统计字数工具
 *
 * 这是一个多功能文本统计工具，支持中英文字符识别和详细的语言分类统计。
 * This is a multi-functional text statistics tool with Chinese/English character recognition.
 *
 * ============ 使用方法 / Usage ============
 *
 * 【方式1：命令行使用 / Command Line Interface】
 *
 * // 统计文件字数 / Count words in a file
 * node scripts/word-counter.js <文件路径>
 *
 * // 示例 / Examples:
 * node scripts/word-counter.js SKILL.md
 * node scripts/word-counter.js templates/standard.md
 * node scripts/word-counter.js ../path/to/document.txt
 *
 *
 * 【方式2：作为模块使用 / Use as Module】
 *
 * // 在Node.js脚本中导入 / Import in Node.js script
 * const counter = require('./scripts/word-counter.js');
 *
 * // 使用方法 / Available Methods:
 *
 * 1. countWords(text) - 统计总字数
 *    counter.countWords("Hello 世界")  // Returns: 2
 *
 * 2. countChineseChars(text) - 统计中文字符
 *    counter.countChineseChars("你好Hello")  // Returns: 2
 *
 * 3. countEnglishChars(text) - 统计英文字符
 *    counter.countEnglishChars("Hello你好")  // Returns: 5
 *
 * 4. countOtherChars(text) - 统计其他语言字符
 *    counter.countOtherChars("こんにちは")  // Returns: 5
 *
 * 5. countChars(text, includeSpaces) - 统计字符数
 *    counter.countChars("Hello", false)  // Returns: 5 (不含空格)
 *    counter.countChars("Hello", true)   // Returns: 5 (含空格)
 *
 * 6. countLines(text) - 统计行数
 *    counter.countLines("Line1\nLine2")  // Returns: 2
 *
 * 7. getTextStatistics(text) - 获取完整统计信息
 *    const stats = counter.getTextStatistics("Hello 世界");
 *    // Returns: {
 *    //   totalWords: 2,
 *    //   chineseChars: 2,
 *    //   englishChars: 5,
 *    //   otherChars: 0,
 *    //   ...
 *    // }
 *
 * 8. countWordsInFile(filePath) - 统计文件字数
 *    counter.countWordsInFile('./SKILL.md')
 *
 * 9. getFileStatistics(filePath) - 获取文件完整统计
 *    const stats = counter.getFileStatistics('./SKILL.md');
 *
 * 10. formatStatistics(stats, filePath) - 格式化输出统计信息
 *     const formatted = counter.formatStatistics(stats, './SKILL.md');
 *     console.log(formatted);
 *
 *
 * 【输出格式 / Output Format】
 * 📄 File: <文件路径>
 *
 * 📊 Text Statistics:
 *
 *    📝 Total Words:
 *       289 words
 *
 *    🔤 Character Breakdown:
 *       中文: 1,011 chars
 *       English: 1,100 chars
 *       其他语言: 116 chars
 *       Numbers: 15
 *       Punctuation: 375
 *
 *    📏 Total Characters:
 *       Without spaces: 2,617
 *       With spaces: 3,084
 *
 *    📐 Structure:
 *       Lines: 67
 *       Paragraphs: 22
 *
 *    ⏱️  Estimated reading time: 4 min
 *
 *
 * 【支持的语言 / Supported Languages】
 * - 中文 / Chinese (汉字、中文标点)
 * - 英文 / English
 * - 日文 / Japanese
 * - 韩文 / Korean
 * - 阿拉伯文 / Arabic
 * - 其他Unicode字符 / Other Unicode characters
 *
 *
 * 【依赖 / Requirements】
 * - Node.js (v16 or higher)
 * - 无需额外依赖 / No external dependencies needed
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
exports.countChineseChars = countChineseChars;
exports.countEnglishChars = countEnglishChars;
exports.countOtherChars = countOtherChars;
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
function countChineseChars(text) {
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
function countEnglishChars(text) {
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
function countOtherChars(text) {
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
function getTextStatistics(text, includeSpaces = false) {
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
    const englishReadingTime = totalWords / 200; // English: ~200 words/min
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
//# sourceMappingURL=word-counter.js.map