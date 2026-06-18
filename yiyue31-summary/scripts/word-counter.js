"use strict";

const fs = require("fs");
const path = require("path");

// CLI: node word-counter.js <file-path>
// Module: const counter = require('./word-counter.js')

function countWords(text) {
  if (!text || text.trim().length === 0) return 0;
  return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}

function countChars(text, includeSpaces = false) {
  if (!text) return 0;
  return includeSpaces ? text.length : text.replace(/\s/g, "").length;
}

function countLines(text) {
  if (!text || text.trim().length === 0) return 0;
  return text.split("\n").filter(line => line.trim().length > 0).length;
}

function countChineseChars(text) {
  if (!text) return 0;
  const matches = text.match(/[一-鿿㐀-䶿]/gu);
  return matches ? matches.length : 0;
}

// Counts English letters only (a-z, A-Z). Numbers are tracked separately.
function countEnglishChars(text) {
  if (!text) return 0;
  const matches = text.match(/[a-zA-Z]/g);
  return matches ? matches.length : 0;
}

function countOtherChars(text) {
  if (!text) return 0;
  const totalChars = text.replace(/\s/g, "").length;
  const chineseChars = countChineseChars(text);
  const englishChars = countEnglishChars(text);
  const numbers = (text.match(/\d/g) || []).length;
  const punctuation = (text.match(/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/g) || []).length;
  return Math.max(0, totalChars - chineseChars - englishChars - numbers - punctuation);
}

function getTextStatistics(text, includeSpaces = false) {
  const totalWords = countWords(text);
  const totalCharacters = countChars(text, false);
  const charactersWithSpaces = countChars(text, true);
  const lines = countLines(text);
  const chineseChars = countChineseChars(text);
  const englishChars = countEnglishChars(text);
  const otherChars = countOtherChars(text);
  const numbers = (text.match(/\d/g) || []).length;
  const punctuationSet = new Set([
    "!", '"', "#", "$", "%", "&", "'", "(", ")", "*", "+", ",", "-", ".", "/",
    ":", ";", "<", "=", ">", "?", "@", "[", "\\", "]", "^", "_", "`", "{", "|", "}", "~",
  ]);
  let punctuation = 0;
  for (const char of text) {
    if (punctuationSet.has(char)) punctuation++;
  }
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0).length;

  // Weighted reading time: Chinese ~300 chars/min, English ~200 words/min
  const readingTimeMinutes = Math.ceil(chineseChars / 300 + totalWords / 200);

  return {
    totalWords,
    totalCharacters,
    charactersWithSpaces,
    chineseChars,
    englishChars,
    otherChars,
    numbers,
    punctuation,
    spaces: (text.match(/\s/g) || []).length,
    lines,
    paragraphs,
    readingTimeMinutes,
  };
}

function fileExists(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function readFile(filePath) {
  if (!fileExists(filePath)) throw new Error(`File not found: ${filePath}`);
  return fs.readFileSync(filePath, "utf-8");
}

function countWordsInFile(filePath) {
  return countWords(readFile(filePath));
}

function getFileStatistics(filePath) {
  return getTextStatistics(readFile(filePath));
}

function formatStatistics(stats, filePath) {
  const lines = [];
  if (filePath) {
    lines.push(`📄 File: ${filePath}`, "");
  }
  lines.push(
    "📊 Text Statistics:",
    "",
    "   📝 Total Words:",
    `      ${stats.totalWords.toLocaleString()} words`,
    "",
    "   🔤 Character Breakdown:",
    `      中文: ${stats.chineseChars.toLocaleString()} chars`,
    `      English: ${stats.englishChars.toLocaleString()} chars`,
    `      其他语言: ${stats.otherChars.toLocaleString()} chars`,
    `      Numbers: ${stats.numbers.toLocaleString()}`,
    `      Punctuation: ${stats.punctuation.toLocaleString()}`,
    "",
    "   📏 Total Characters:",
    `      Without spaces: ${stats.totalCharacters.toLocaleString()}`,
    `      With spaces: ${stats.charactersWithSpaces.toLocaleString()}`,
    "",
    "   📐 Structure:",
    `      Lines: ${stats.lines.toLocaleString()}`,
    `      Paragraphs: ${stats.paragraphs.toLocaleString()}`,
    "",
    `   ⏱️  Estimated reading time: ${stats.readingTimeMinutes} min`,
  );
  return lines.join("\n");
}

function runCli(args) {
  if (args.length < 1) {
    console.log("Usage: word-counter <file-path>");
    process.exit(1);
  }
  const resolvedPath = path.resolve(args[0]);
  try {
    const stats = getFileStatistics(resolvedPath);
    console.log(formatStatistics(stats, resolvedPath));
    console.log("", "✅ Successfully counted words in file");
  } catch (err) {
    console.error(`❌ Error: ${err.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  runCli(process.argv.slice(2));
}

module.exports = {
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
  runCli,
};
