#!/usr/bin/env node
/**
 * 检查共享 prompt 跨 skill 副本是否同步。
 *
 * 规则（见 CLAUDE.md "Shared evaluation prompts (cross-skill sync)" 与
 *      docs/shared-evaluation-prompt-sync.md）：
 *   1. 同一组副本，归一化行尾后内容必须一致（防漂移）。
 *   2. 内容一致的副本必须标注相同时间戳（同内容同时间戳）。
 *   3. 最危险形态：副本声称与源真相同时间戳，但内容已漂移——单独标红。
 *
 * 标记用 `> Last updated: YYYY-MM-DD HH:MM:SS`（秒级，英文标签）。
 * 秒级在 cp 同步下安全：整文件复制时时间戳随内容原样带过去，副本天然一致。
 * 手改时间戳会被（正确地）报为异常。
 *
 * 为什么需要脚本：skill 是自包含分发单元，共享 prompt 必须复制成多份物理副本，
 * 修一处不会自动传导。靠人记着同步会漏。本脚本把"靠人比对"变成可运行检查。
 *
 * 用法（任意 cwd 均可，路径相对仓库根解析）：
 *   node scripts/check-prompt-sync.js
 *   node scripts/check-prompt-sync.js --manifest <path>
 *
 * 退出码：0 = 全部同步；1 = 发现漂移 / 时间戳不一致 / 缺文件。
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// --- 参数解析 ---
const args = process.argv.slice(2);
let manifestArg = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--manifest' && args[i + 1]) {
    manifestArg = args[i + 1];
    i++;
  }
}

// 仓库根 = 本脚本所在目录上一级（scripts -> repo root）
const repoRoot = path.resolve(__dirname, '..');
const defaultManifest = path.join(__dirname, 'prompt-sync-manifest.json');
const manifestPath = manifestArg
  ? path.resolve(manifestArg)
  : defaultManifest;

if (!fs.existsSync(manifestPath)) {
  console.error(`✗ 找不到 manifest：${manifestPath}`);
  process.exit(1);
}

// --- 核心函数 ---

/**
 * 归一化：CRLF/CR -> LF，去每行行尾空白，合并末尾空行。
 * 必须归一化才能比较——同名文件可能因 CRLF/LF 差异字节不同而内容相同。
 */
function normalize(content) {
  return content
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+$/, ''))
    .join('\n')
    .replace(/\n+$/, '\n');
}

/** 从 `> Last updated: YYYY-MM-DD [HH:MM:SS]` 头提取时间戳，无则 null。 */
function extractTimestamp(content) {
  const m = content.match(/Last updated:\s*(\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2}:\d{2})?)/);
  return m ? m[1] : null;
}

function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function readCopy(relPath) {
  const abs = path.join(repoRoot, relPath);
  if (!fs.existsSync(abs)) {
    return { missing: true, abs };
  }
  const raw = fs.readFileSync(abs, 'utf8');
  const norm = normalize(raw);
  return {
    missing: false,
    abs,
    timestamp: extractTimestamp(norm),
    hash: sha256(norm),
  };
}

// --- 主流程 ---

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
let problems = 0;

for (const group of manifest.groups) {
  console.log(`\n== ${group.name} ==`);
  const src = readCopy(group.sourceOfTruth);
  if (src.missing) {
    console.error(`  ✗ sourceOfTruth 缺失：${group.sourceOfTruth} (${src.abs})`);
    problems++;
    continue;
  }
  if (!src.timestamp) {
    console.error(`  ✗ sourceOfTruth 无 Last updated 头：${group.sourceOfTruth}`);
    problems++;
  }
  console.log(
    `  source: ${group.sourceOfTruth}  [${src.timestamp ?? '?'}, ${src.hash.slice(0, 8)}]`,
  );

  for (const copyPath of group.copies) {
    if (copyPath === group.sourceOfTruth) continue; // 源自身跳过
    const c = readCopy(copyPath);
    if (c.missing) {
      console.error(`  ✗ ${copyPath}  [缺失]`);
      problems++;
      continue;
    }
    const contentMatch = c.hash === src.hash;
    if (contentMatch) {
      if (c.timestamp === src.timestamp) {
        console.log(`  ✓ ${copyPath}  [${c.timestamp}, 内容一致]`);
      } else {
        console.error(
          `  ✗ ${copyPath}  [${c.timestamp}, 内容一致但时间戳与源 ${src.timestamp} 不符]`,
        );
        problems++;
      }
    } else {
      // 内容漂移
      if (c.timestamp === src.timestamp) {
        console.error(
          `  ✗✗ ${copyPath}  [${c.timestamp}, 声称同时间戳但内容已漂移——最危险]`,
        );
      } else {
        console.error(
          `  ✗ ${copyPath}  [${c.timestamp}, 内容漂移（源 ${src.timestamp}）]`,
        );
      }
      problems++;
    }
  }
}

console.log('');
if (problems === 0) {
  console.log('✓ 所有共享 prompt 副本已同步。');
  process.exit(0);
} else {
  console.error(`✗ 发现 ${problems} 处问题，请同步后再提交。`);
  console.error('  修复流程：改 sourceOfTruth -> 更新其 Last updated 时间戳 -> cp 到所有 copies -> 重跑本脚本。');
  process.exit(1);
}
