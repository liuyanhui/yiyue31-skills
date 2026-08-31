#!/usr/bin/env bash
# run.sh — xl-translator 测试套件统一入口（严格串行）
#
# 为什么逐文件串行而不是 `node --test test/`：node --test 多文件会并行起多个进程，
# 本机 1.87GB 内存下是 OOM 风险（CLAUDE.md 低内存纪律）；单文件内部 node:test 默认串行，
# 因此"一次一个文件"即全程串行。退出码：全部通过 0，任一失败 1。
#
# 用法：bash scripts/test/run.sh（在 yiyue31-xl-translator/ 下）
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
STATUS=0
FAILED=()

for f in "$HERE"/unit/*.test.mjs "$HERE"/regression/*.test.mjs; do
  [ -e "$f" ] || continue
  echo "===== $(basename "$f") ====="
  if ! node --test "$f"; then
    STATUS=1
    FAILED+=("$(basename "$f")")
  fi
done

echo "----------------------------------------"
if [ "$STATUS" -eq 0 ]; then
  echo "✅ 全部测试通过"
else
  echo "❌ 失败：${FAILED[*]}"
fi
exit "$STATUS"
