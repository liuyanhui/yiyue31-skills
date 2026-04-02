#!/usr/bin/env bash
# Yiyue31 Agent Skills 安装/更新脚本
# 用法:
#   ./install.sh              # 安装到 User scope (~/.claude/skills/)
#   ./install.sh --user       # 同上
#   ./install.sh --project    # 安装到 Project scope (当前项目 .claude/skills/)
#   ./install.sh --project /path/to/project  # 安装到指定项目的 .claude/skills/

set -euo pipefail

# ── 项目根目录（脚本所在目录）────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILLS_SRC="$SCRIPT_DIR"

# ── Skills 列表及其允许复制的子目录（符合项目结构规范）──────
# 格式: "skill目录名:子目录1,子目录2,..."
SKILLS=(
  "yiyue31-summary-generator:templates,scripts"
  "yiyue31-tech-article-translator:glossary,references"
  "yiyue31-courseware-generator:references"
)

# ── 解析参数 ─────────────────────────────────────────────
SCOPE="user"
TARGET_DIR=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --user)
      SCOPE="user"
      shift
      ;;
    --project)
      SCOPE="project"
      if [[ -n "${2:-}" && ! "$2" =~ ^-- ]]; then
        TARGET_DIR="$2"
        shift
      fi
      shift
      ;;
    -h|--help)
      echo "用法: $0 [--user|--project [项目路径]]"
      echo ""
      echo "  --user              安装到 User scope (~/.claude/skills/)"
      echo "  --project [路径]    安装到 Project scope (<项目>/.claude/skills/)"
      echo "                      未指定路径时使用当前 git 项目根目录"
      echo ""
      exit 0
      ;;
    *)
      echo "未知参数: $1"
      exit 1
      ;;
  esac
done

# ── 确定目标 skills 目录 ─────────────────────────────────
if [[ "$SCOPE" == "user" ]]; then
  DEST="$HOME/.claude/skills"
else
  if [[ -n "$TARGET_DIR" ]]; then
    DEST="$TARGET_DIR/.claude/skills"
  else
    # 使用当前 git 项目根目录
    GIT_ROOT="$(git -C "$PWD" rev-parse --show-toplevel 2>/dev/null || true)"
    if [[ -z "$GIT_ROOT" ]]; then
      echo "错误: 未检测到 git 仓库，请指定项目路径: $0 --project /path/to/project"
      exit 1
    fi
    DEST="$GIT_ROOT/.claude/skills"
  fi
fi

echo "========================================"
echo "  Yiyue31 Agent Skills 安装/更新"
echo "========================================"
echo "模式: $SCOPE scope"
echo "目标: $DEST"
echo "========================================"
echo ""

# ── 结果跟踪数组 ─────────────────────────────────────────
declare -A RESULT_STATUS    # skill名 => "成功" / "跳过"
declare -A RESULT_DETAIL    # skill名 => 详细信息

# ── 复制函数 ─────────────────────────────────────────────
copy_skill() {
  local skill_name="$1"
  local subdirs="$2"
  local src="$SKILLS_SRC/$skill_name"
  local dst="$DEST/$skill_name"

  # 检查源目录是否存在
  if [[ ! -d "$src" ]]; then
    echo "  [跳过] $skill_name (源目录不存在)"
    RESULT_STATUS[$skill_name]="跳过"
    RESULT_DETAIL[$skill_name]="源目录不存在"
    return
  fi

  # 检查 SKILL.md 是否存在
  if [[ ! -f "$src/SKILL.md" ]]; then
    echo "  [跳过] $skill_name (缺少 SKILL.md)"
    RESULT_STATUS[$skill_name]="跳过"
    RESULT_DETAIL[$skill_name]="缺少 SKILL.md"
    return
  fi

  # 创建目标目录
  mkdir -p "$dst"

  # 复制 SKILL.md（必需）
  cp "$src/SKILL.md" "$dst/SKILL.md"
  echo "  [复制] SKILL.md"
  local file_count=1

  # 复制允许的子目录
  IFS=',' read -ra DIRS <<< "$subdirs"
  local copied_dirs=""
  for dir in "${DIRS[@]}"; do
    if [[ -d "$src/$dir" ]]; then
      # 检查目录是否有内容
      if [[ -n "$(ls -A "$src/$dir" 2>/dev/null)" ]]; then
        mkdir -p "$dst/$dir"
        cp -r "$src/$dir/"* "$dst/$dir/"
        local count
        count=$(find "$src/$dir" -type f | wc -l)
        file_count=$((file_count + count))
        echo "  [复制] $dir/ ($count 个文件)"
        copied_dirs="$copied_dirs $dir"
      else
        # 空目录，创建但不复制
        mkdir -p "$dst/$dir"
        echo "  [跳过] $dir/ (空目录)"
      fi
    fi
  done

  echo "  [完成] $skill_name"
  RESULT_STATUS[$skill_name]="成功"
  RESULT_DETAIL[$skill_name]="${file_count} 个文件${copied_dirs:-}"
}

# ── 执行安装/更新 ────────────────────────────────────────
updated=0
skipped=0

for entry in "${SKILLS[@]}"; do
  skill="${entry%%:*}"
  subdirs="${entry#*:}"
  echo "[$skill]"
  copy_skill "$skill" "$subdirs"
  echo ""
  ((updated++)) || true
done

# ── 显示安装结果 ──────────────────────────────────────────
echo "========================================"
echo "  安装结果"
echo "========================================"
printf "  %-35s %-8s %s\n" "Skill" "状态" "详情"
echo "  -----------------------------------------------"
for entry in "${SKILLS[@]}"; do
  skill="${entry%%:*}"
  status="${RESULT_STATUS[$skill]:-未处理}"
  detail="${RESULT_DETAIL[$skill]:-}"
  printf "  %-35s %-8s %s\n" "$skill" "$status" "$detail"
done
echo "========================================"
echo ""
success=0
skipped_res=0
for entry in "${SKILLS[@]}"; do
  s="${entry%%:*}"
  case "${RESULT_STATUS[$s]:-}" in
    成功) ((success++)) || true ;;
    跳过) ((skipped_res++)) || true ;;
  esac
done
echo "  总计: ${#SKILLS[@]} 个  |  成功: $success  |  跳过: $skipped_res"
echo "  目标目录: $DEST"
echo ""
echo "  请重启 Claude Code 以使 Skills 生效"
echo "========================================"

# ── 按任意键退出 ─────────────────────────────────────────
echo ""
echo "按任意键退出..."
if [[ -t 0 ]]; then
  read -n 1 -s -r -p ""
  echo ""
fi
