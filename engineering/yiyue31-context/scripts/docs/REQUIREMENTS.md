# AI Context Checker — 需求文档

> 版本: 1.1.0
> 日期: 2026-06-11
> 状态: 需求确认完成（已通过评审修正）
>
> 注（v0.0.2，2026-07-07）：随 yiyue31-context skill 改为"修改上下文"模板，段校验从 `required_any_patterns`（旧两段 目录结构/入口文件）改为自适应的 `allowed_section_names`（六段白名单：目录职责/关键文件/设计要点与原因/约定与陷阱/依赖关系/扩展指南）。本文中 §6.2「目录结构条目格式」、§2/§7 里用 目录结构/入口文件 举例的 required_*_patterns 片段为 v0.0.2 前内容；当前模板以 SKILL.md 和 checker `DEFAULT_CONFIG`（scripts/src/types/config.ts）为准；新增 `details.disallowed_sections` 输出字段。

## 1. 概述

一个通用的目录覆盖校验与报告生成工具。扫描指定目录树，校验每个目录中是否存在目标文件（如 CLAUDE.md），并对文件内容执行多项规则校验，最终输出 JSON + Markdown 双格式报告。

## 2. 使用方式

CLI 命令行工具，支持命令行参数和配置文件两种输入方式。

```bash
# 命令行参数
npx yiyue31-context-check --target ./src --exclude node_modules,dist --filename CLAUDE.md

# 配置文件
npx yiyue31-context-check --config ./check-config.json
```

### 2.1 参数合并策略

- 命令行参数优先级高于配置文件
- 数组类型参数（exclude、include、patterns）：命令行传了则以命令行为准，**不合并**
- 命令行未传的参数取配置文件中的值

### 2.2 CLI 参数完整定义

| 参数 | 短选项 | 说明 |
|------|--------|------|
| `--target` | `-t` | 扫描目标路径（必填） |
| `--exclude` | `-e` | 排除的目录名，逗号分隔，可多次指定 |
| `--include` | `-i` | 强制包含的目录名，逗号分隔，可多次指定 |
| `--filename` | `-f` | 目标文件名，默认 `CLAUDE.md` |
| `--config` | `-c` | 配置文件路径 |

## 3. 技术栈

- **语言**: Node.js / TypeScript
- **运行时**: 与 Claude Code 生态一致

## 4. 输入参数

### 4.1 完整配置定义

```json
{
  "target": "./src",
  "exclude": ["node_modules", "dist", ".git"],
  "include": [],
  "filename": "CLAUDE.md",
  "markers": {
    "start": "<!-- skill: yiyue31-context -->",
    "end": "<!-- /yiyue31-context -->",
    "update_time_field": "update_time"
  },
  "required_any_patterns": [],
  "required_all_patterns": [],
  "forbidden_patterns": ["TODO", "FIXME", "placeholder"],
  "allowed_section_names": [
    "目录职责", "Directory Purpose",
    "关键文件", "Key Files",
    "设计要点与原因", "Design Notes & Why",
    "约定与陷阱", "Conventions & Traps",
    "依赖关系", "Dependencies",
    "扩展指南", "Extension Guide"
  ],
  "min_content_length": 1,
  "max_file_size": 51200,
  "expected_encoding": "utf-8",
  "output": {
    "json": "./report.json",
    "markdown": "./report.md"
  }
}
```

### 4.2 参数说明

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `target` | string | 是 | — | 扫描目标路径，必须为目录，不存在则报错退出 |
| `exclude` | string[] | 否 | `[]` | 排除的目录名 |
| `include` | string[] | 否 | `[]` | 强制包含的目录名，覆盖 exclude |
| `filename` | string | 否 | `"CLAUDE.md"` | 检查的目标文件名，必须为 `.md` 格式 |
| `markers.start` | string | 否 | `"<!-- skill: yiyue31-context -->"` | 成对标记的开始标记 |
| `markers.end` | string | 否 | `"<!-- /yiyue31-context -->"` | 成对标记的结束标记 |
| `markers.update_time_field` | string | 否 | `"update_time"` | 开始标记中时间戳的字段名 |
| `required_any_patterns` | string[] | 否 | `[]` | 至少匹配其中一项（正则） |
| `required_all_patterns` | string[] | 否 | `[]` | 全部必须匹配（正则） |
| `forbidden_patterns` | string[] | 否 | `[]` | 禁止出现的模式，匹配到即异常（正则） |
| `min_content_length` | number | 否 | `1` | 成对标记内内容的最小长度（字符数） |
| `max_file_size` | number | 否 | `51200` (50KB) | 文件大小上限（字节），超过记录异常并跳过内容校验 |
| `expected_encoding` | string | 否 | `"utf-8"` | 期望的文件编码 |
| `output.json` | string | 否 | — | JSON 报告输出路径，不填则不生成 |
| `output.markdown` | string | 否 | — | Markdown 报告输出路径，不填则不生成 |

### 4.3 排除规则

- `exclude` 和 `include` 均为**匹配目录名**（非完整路径）。如 `exclude: ["test"]` 排除所有名为 `test` 的目录，无论层级
- 大小写处理：由 Node.js 的 `path` 模块自动处理（macOS/Windows 不区分大小写，Linux 区分）
- `include` 优先级高于 `exclude`：同时出现在两个列表中的目录**不被排除**
- 被排除的目录既不扫描也不校验，不参与覆盖率计算
- 不支持嵌套路径如 `src/test`，需要排除特定路径下的目录时用 `target` 指定范围

### 4.4 输入校验

| 异常情况 | 处理方式 |
|----------|---------|
| target 不存在 | 报错退出 |
| target 不是目录 | 报错退出 |
| target 无读取权限 | 报错退出 |
| 配置文件不存在 | 报错退出 |
| 配置文件 JSON 格式错误 | 报错退出，提示错误位置 |
| filename 不以 `.md` 结尾 | 报错退出 |
| markers.start 或 markers.end 为空字符串 | 报错退出 |
| 正则表达式无效 | 报错退出，提示哪个字段的正则无效 |
| 正则数组为空 | 跳过该校验，不报错 |
| output 路径的父目录不存在 | 报错退出，不自动创建 |

## 5. 功能需求

### 5.1 校验执行 Pipeline

校验按以下顺序执行，前置校验失败时提前退出后续步骤：

```
存在性 → 不存在 → 记录"缺失"，跳过所有后续
  │
  └→ 文件大小 → 过大 → 记录"过大"，跳过所有内容校验
       │
       └→ 编码 → 不匹配 → 记录"编码异常"，跳过内容解析
            │
            └→ 成对标记 → 标记不完整 → 记录标记问题，跳过依赖标记的校验
                 │                   （模式校验、一致性、变更检测、标记位置）
                 └→ 标记完整 → 执行全部校验
```

### 5.2 目录扫描

递归扫描 target 路径下的所有目录，根据排除规则过滤，得到"应覆盖目录列表"。

- **符号链接**：跳过所有符号链接，不跟随、不校验
- **空目录**：target 下无子目录或全部被排除 → 正常输出报告，`total_directories: 0`，`coverage_rate` 不输出（无意义）

### 5.3 目标文件存在性校验

对每个应覆盖目录，检查目标文件是否存在。

- 存在 → 进入后续内容校验
- 不存在 → 记录为"缺失"

### 5.4 成对标记校验

对已存在的目标文件，校验成对标记：

| 校验项 | 期望 | 异常时记录 | issue 标识符 |
|--------|------|-----------|-------------|
| 开始标记存在 | 存在 | 缺失开始标记 | `missing_start_marker` |
| 结束标记存在 | 存在 | 缺失结束标记 | `missing_end_marker` |
| 顺序 | 开始标记在结束标记之前 | 标记顺序颠倒 | `marker_order_reversed` |
| 对数 | 恰好 1 对 | 多对标记异常（记录实际对数） | `multiple_marker_pairs` |
| 闭合内容长度 | ≥ `min_content_length` | 闭合内容过短，记录实际长度 | `content_too_short` |

issue 标识符完整枚举值：`missing_start_marker`、`missing_end_marker`、`marker_order_reversed`、`multiple_marker_pairs`、`content_too_short`

### 5.5 标记位置统计

根据成对标记在文件中的位置分类：

```
开始标记在文件开头？
  ├─ 是 → 头部
  └─ 否 → 结束标记在文件末尾？
              ├─ 是 → 尾部
              └─ 否 → 中部
```

"文件开头"/"文件末尾"的判定：
- 先标准化文件：去除 BOM、去除首尾空白字符（空格、换行、制表符）
- 然后判断标准化后的文件是否以开始标记开头、以结束标记结尾

统计结果记录在报告中，不视为错误。

### 5.6 必须包含的模式校验

两种类型：

- `required_any_patterns`：文件全文中**至少匹配一项**，全部不匹配则记录异常
- `required_all_patterns`：文件全文中**全部必须匹配**，任一不匹配则记录异常

匹配规则：
- **全文匹配**（非逐行）
- 默认**区分大小写**
- 为空数组时跳过该校验

### 5.7 禁止模式校验

`forbidden_patterns` 中的每个模式逐一全文匹配，命中则记录：
- 哪个文件
- 哪个模式命中
- 命中的具体内容（截取匹配位置前后各 **50 个字符**作为上下文）

匹配规则同 5.6（全文匹配、区分大小写）。

### 5.8 文件编码校验

校验文件编码是否为 `expected_encoding`（默认 UTF-8）。

- UTF-8 编码检测方式：尝试 UTF-8 解码，检查是否存在非法字节序列。无非法字节则为 UTF-8
- 编码不匹配记录异常
- 非法字节位置信息记入报告（如果有）

### 5.9 文件大小校验

- 文件 < `max_file_size` → 正常，执行所有内容校验
- 文件 ≥ `max_file_size` → 记录"文件过大"异常，记录实际大小，**跳过所有内容校验**

### 5.10 内容与磁盘一致性校验

三个独立步骤，解耦执行：

```
步骤1: 扫描磁盘          步骤2: 解析目标文件        步骤3: 对比
┌──────────────┐      ┌──────────────────────┐      ┌──────────────┐
│ 读取目录实际  │      │ 解析成对标记内的     │      │  diff 两个   │
│ 子项(文件+目录)│  →   │ 目录/文件名列表      │  →   │  列表        │
│ 排除规则过滤  │      │                      │      │  输出差异    │
└──────────────┘      └──────────────────────┘      └──────────────┘
```

**步骤1 — 磁盘扫描**
- 输入：目录路径、排除规则
- 输出：该目录下所有文件名和目录名的集合（排除规则过滤后）

**步骤2 — 目标文件解析**
- 输入：目标文件内容、成对标记
- 输出：成对标记内记录的所有文件名和目录名的集合
- 解析规则：提取反引号内的名称，按是否带 `/` 后缀区分目录和文件
  - ``- `name/` `` → 目录
  - ``- `name.ext` `` → 文件
- **解析容错**：
  - 无 `/` 后缀也无扩展名的条目 → 视为文件
  - 反引号内包含空格 → 正常解析完整名称
  - 名称中包含特殊字符（如 `@scope/package`）→ 正常解析
  - 同一行多个反引号条目 → 仅解析第一个
  - 解析失败的条目 → 跳过，记录解析错误

**步骤3 — 对比**
- 磁盘有但目标文件没有 → "未记录"（遗漏）
- 目标文件有但磁盘没有 → "已不存在"（过期）

### 5.11 文件变更检测

从开始标记中按 `markers.update_time_field` 配置的字段名提取时间戳：

```
<!-- skill: yiyue31-context | version: 0.0.1 | update_time: 2026-06-11T20:30:00 -->
```

- 遍历该目录下的实际文件，对比每个文件的 `mtime` 与时间戳
- 文件 `mtime` > 时间戳 → 该文件条目可能过期，记录
- 如果开始标记中没有对应字段，回退使用目标文件自身的 `mtime` 作为基准
- 如果时间戳值不是合法 ISO 8601 格式 → 跳过变更检测，记录"时间戳格式无效"
- **已知局限**：`git checkout`、`git clone`、`tar` 解压等操作会重置文件 mtime，可能产生误报。报告中需标注此风险，由使用者结合实际情况判断
- **改进方向**：后续可考虑使用 `git log -1 --format="%ci" -- {file}` 获取 git 管理的最后提交时间替代 mtime，提高可靠性。前提是项目必须是 git 仓库

### 5.12 目录深度分布统计

统计缺失目标文件的目录集中在哪些层级。

- 深度定义：target 为第 1 层，其直接子目录为第 2 层，以此类推
- 报告中按层级汇总 total / covered / missing

### 5.13 标记外自定义内容统计

统计有多少目标文件在成对标记之外还有用户自己写的内容。

- 判定标准：去除标记对内容后，**去除剩余部分的空白字符**，非空则判定为有自定义内容
- 有自定义内容 → `has_custom_content`
- 仅标记内容 → `marker_only`

## 6. 目标文件格式约定

### 6.1 成对标记

```markdown
<!-- skill: yiyue31-context | version: 0.0.1 | update_time: {ISO 8601 时间} -->

...内容...

<!-- /yiyue31-context -->
```

### 6.2 目录结构条目格式

```markdown
- `dirname/` — 目录描述
- `filename.ext` — 文件描述
```

规则：
- 名称用反引号包裹
- 目录名末尾带 `/`
- 文件名无 `/`
- ` — ` 分隔描述（描述可选）

## 7. 输出报告

### 7.1 passed 判定条件

```
passed = true 当且仅当：
  - 无缺失文件（missing_files 为空）
  - 无标记问题（marker_issues 为空）
  - 无编码异常（encoding_issues 为空）
  - 无过大文件（oversized_files 为空）
```

以下记为**警告**，不影响 passed：
- 内容问题（content_issues、pattern_issues）
- 文件系统不一致（filesystem_mismatches）
- 条目过期（stale_entries）

### 7.2 覆盖率计算口径

- **文件存在即算 covered**，不要求通过所有内容校验
- 覆盖率 = `covered_directories / total_directories`
- `total_directories` 为 0 时不输出 `coverage_rate`

### 7.3 路径格式

报告中的路径统一为 **POSIX 格式**（`/` 分隔），不保留平台原生格式。

### 7.4 output 路径

- 相对路径基于**当前工作目录**（cwd）
- 父目录不存在 → 报错退出，不自动创建

### 7.5 JSON 格式

```json
{
  "meta": {
    "tool_version": "1.1.0",
    "timestamp": "2026-06-11T20:30:00+08:00",
    "target": "./src",
    "config": {}
  },
  "summary": {
    "total_directories": 50,
    "covered_directories": 45,
    "missing_directories": 5,
    "coverage_rate": 0.9,
    "passed": true,
    "custom_content_stats": {
      "has_custom_content": 10,
      "marker_only": 35
    }
  },
  "depth_distribution": {
    "1": { "total": 5, "covered": 5, "missing": 0 },
    "2": { "total": 15, "covered": 14, "missing": 1 },
    "3": { "total": 20, "covered": 18, "missing": 2 }
  },
  "marker_position_stats": {
    "head": 30,
    "middle": 10,
    "tail": 5
  },
  "details": {
    "missing_files": [
      {
        "directory": "./src/utils",
        "depth": 3
      }
    ],
    "marker_issues": [
      {
        "file": "./src/foo/CLAUDE.md",
        "issues": ["missing_end_marker"],
        "marker_count": 1
      }
    ],
    "content_issues": [
      {
        "file": "./src/bar/CLAUDE.md",
        "issues": ["content_too_short"],
        "detail": { "actual_length": 0, "min_required": 1 }
      }
    ],
    "encoding_issues": [
      {
        "file": "./src/baz/CLAUDE.md",
        "detected_encoding": "unknown",
        "expected_encoding": "utf-8"
      }
    ],
    "oversized_files": [
      {
        "file": "./src/big/CLAUDE.md",
        "actual_size": 102400,
        "max_size": 51200
      }
    ],
    "pattern_issues": {
      "required_any_missing": [
        {
          "file": "./src/x/CLAUDE.md",
          "patterns": ["## 目录结构", "## Directory Structure"]
        }
      ],
      "required_all_missing": [
        {
          "file": "./src/x/CLAUDE.md",
          "missing_pattern": "## 入口文件"
        }
      ],
      "forbidden_found": [
        {
          "file": "./src/y/CLAUDE.md",
          "matches": [
            { "pattern": "TODO", "context": "...前后各50字符的上下文..." }
          ]
        }
      ]
    },
    "filesystem_mismatches": [
      {
        "directory": "./src/z",
        "file": "./src/z/CLAUDE.md",
        "unrecorded": ["new_file.ts"],
        "nonexistent": ["old_file.ts"]
      }
    ],
    "stale_entries": [
      {
        "directory": "./src/w",
        "file": "./src/w/CLAUDE.md",
        "update_time": "2026-06-10T20:00:00",
        "stale_files": [
          {
            "name": "changed_file.ts",
            "mtime": "2026-06-11T10:00:00"
          }
        ],
        "fallback_to_file_mtime": false
      }
    ]
  }
}
```

### 7.6 Markdown 格式

人可读的汇总报告，包含与 JSON 相同的所有信息，以表格和列表形式呈现。报告中需包含以下提示：

> ⚠️ 文件变更检测基于文件 mtime 对比，`git checkout`、`git clone`、`tar` 解压等操作可能重置 mtime 导致误报。请结合实际情况判断。

## 8. 非功能需求

| 需求 | 说明 |
|------|------|
| 技术栈 | Node.js / TypeScript |
| 使用方式 | CLI 命令行工具，支持命令行参数 + 配置文件 |
| 目标文件名 | 可配置，仅支持一个文件名，且必须为 `.md` 格式 |
| 无副作用 | 工具为只读操作，不修改任何文件 |
| 报告输出 | JSON + Markdown 双格式，按需生成（配置了路径才输出） |
| 符号链接 | 跳过所有符号链接 |
| 路径格式 | 报告中统一使用 POSIX 格式 |
