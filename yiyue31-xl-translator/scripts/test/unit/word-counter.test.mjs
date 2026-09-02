// word-counter.test.mjs — 字数统计（fork + ESM/字节/--json 扩展；M3 前置②）
//
// 覆盖：
//   - 纯函数：countWords / countChineseChars / countEnglishChars / bytes（xl 规模判据）
//   - getTextStatistics：中英混排分项 + 阅读时长；Step 0 判据口径（bytes > 40KB）
//   - CLI 冒烟：--json 字段齐 / 缺文件退出 1
//
// 运行：node --test scripts/test/unit/word-counter.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import {
  countWords,
  countChineseChars,
  countEnglishChars,
  getTextStatistics,
} from "../../word-counter.mjs";

const SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "word-counter.mjs");

test("纯函数：词数 / 中英字符分项", () => {
  assert.equal(countWords("hello world foo"), 3);
  assert.equal(countWords(""), 0);
  assert.equal(countChineseChars("中文abc十二"), 4);
  assert.equal(countEnglishChars("中文abc十二"), 3);
  assert.equal(countEnglishChars("数字123不算"), 0);
});

test("getTextStatistics：bytes 判据（Step 0 的 >40KB 按字节）+ 阅读时长", () => {
  const en = "word ".repeat(1000); // trim 后 4999 字节
  const s = getTextStatistics(en.trim());
  assert.equal(s.bytes, 4999);
  assert.equal(s.totalWords, 1000);
  const zh = getTextStatistics("汉".repeat(290)); // 整串无空格 → countWords=1；ceil(290/300+1/200)=1
  assert.equal(zh.chineseChars, 290);
  assert.equal(zh.readingTimeMinutes, 1);
  // 中英混合时长 = ceil(中文/300 + 词/200)：300 字 + 201 词（中文串无空格计 1 词 + 200 英文词）
  const mix = getTextStatistics("汉".repeat(300) + " " + "w ".repeat(200).trim());
  assert.equal(mix.readingTimeMinutes, Math.ceil(300 / 300 + 201 / 200));
});

test("CLI：--json 字段齐（含 bytes）；缺文件退出 1", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "wc-"));
  try {
    const f = path.join(tmp, "a.md");
    fs.writeFileSync(f, "hello 世界", "utf-8");
    const run = spawnSync(process.execPath, [SCRIPT, f, "--json"], { encoding: "utf-8" });
    assert.equal(run.status, 0, run.stderr);
    const j = JSON.parse(run.stdout);
    for (const k of ["bytes", "totalWords", "chineseChars", "englishChars", "readingTimeMinutes"]) assert.ok(k in j, `缺字段 ${k}`);
    const miss = spawnSync(process.execPath, [SCRIPT, path.join(tmp, "nope.md")], { encoding: "utf-8" });
    assert.equal(miss.status, 1);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
