#!/usr/bin/env node
/**
 * verify-no-first-person.js — paraphrase 交付物的第一人称硬校验（R0）。
 *
 * R0 绝对禁止"我/我们"（转述冒认）。LLM 的 faithfulness 门召回 <100%，且下游
 * 编辑门的 craft 改写可能在 faithfulness 放行后把无人称/第三人称改回"我/我们"。
 * 这条是确定性二元禁令，故用脚本在最终交付物上机械复核——与"哪一步引入"无关。
 *
 * 用法： node verify-no-first-person.js <markdown-file>
 * 退出码： 0 = 通过（无"我/我们"）；1 = 发现违规；2 = 用法错误/读文件失败。
 *
 * 排除（不计违规）：
 *   - 金句 `**中文（English）**` / `***中文（English）***`（R0 例外，显式署名引语）；
 *   - 行内代码 `...`（其中无中文"我"，且代码内容与第一人称无关）。
 */
'use strict';

const fs = require('fs');

const file = process.argv[2];
if (!file) {
  console.error('Usage: node verify-no-first-person.js <markdown-file>');
  process.exit(2);
}

let raw;
try {
  raw = fs.readFileSync(file, 'utf8');
} catch (e) {
  console.error(`读取失败：${file} — ${e.message}`);
  process.exit(2);
}

const lines = raw.split(/\r?\n/);
const violations = [];

lines.forEach((line, i) => {
  // 逐行剔除金句与行内代码，保持行号对齐。
  const checked = line
    .replace(/\*{2,3}[^*\n]*（[^）\n]*）[^*\n]*\*{2,3}/g, '') // 金句：粗体/斜体 + 全角括号
    .replace(/`[^`\n]*`/g, '');                                // 行内代码

  const re = /我/g; // 命中"我"即覆盖"我们"。
  let m;
  while ((m = re.exec(checked)) !== null) {
    const start = Math.max(0, m.index - 15);
    const ctx = line.slice(start, m.index + 15);
    violations.push({ line: i + 1, col: m.index + 1, ctx });
  }
});

if (violations.length) {
  console.error(`✗ 第一人称校验失败：发现 ${violations.length} 处"我/我们"（R0 绝对禁止，金句/代码除外）。`);
  violations.forEach((v) =>
    console.error(`  L${v.line}:${v.col}  …${v.ctx}…`)
  );
  console.error('打回编辑门（Step 6）修正为第三人称（他们/具体名）或无人称后重跑。');
  process.exit(1);
}

console.error('✓ 第一人称校验通过：无"我/我们"（金句/代码除外）。');
process.exit(0);
