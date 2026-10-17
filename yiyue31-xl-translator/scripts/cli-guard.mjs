// cli-guard.mjs — S3⑤ symlink 调用防呆（全部 CLI 脚本共用前置守卫）
//
// 事故位（memory 记载）：.claude/skills 等 symlink 目录下 Node 按 realpath 解析模块 →
// argv[1]（调用时写的 symlink 路径）与 import.meta.url（realpath）恒不等 → 各脚本既有的
// "argv[1] === 本文件" CLI 入口守卫静默跳过 = no-op 退出码 0（零产物假绿）。
// 本守卫在既有 CLI 守卫之前顶层执行：resolve(argv[1]) ≠ realpath → 命中，stderr 警示 + exit 4。
//
// 依赖纪律：仅 node:fs / node:path（无传递依赖）——status/segment 等任何模块均可安全引入
//（segment.mjs 从 ../cli-guard.mjs import，避免与 status ↔ segment 既有依赖纠缠）。

import fs from "node:fs";
import path from "node:path";

// argv1 = process.argv[1] 原样。返回 null = 未命中（真实路径直连 / argv1 缺失 / realpath
// 失败——文件不存在等交给既有用法守卫报错，不误伤）；命中返回 { real, msg }。
export function symlinkCliGuard(argv1) {
  if (!argv1) return null;
  const p = path.resolve(argv1);
  let real;
  try {
    real = fs.realpathSync(p);
  } catch {
    return null; // realpath 失败 → 不误伤（缺文件等由后续既有守卫按用法错报出）
  }
  if (real === p) return null;
  return {
    real,
    msg: `❌ symlink 防呆（S3⑤）：经 symlink 调用（${argv1} → ${real}）——CLI 入口守卫将静默失配（no-op、退出码 0）。请用真实路径调用：node ${real} …`,
  };
}
