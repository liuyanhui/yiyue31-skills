# doc-segmenter

将大型 Markdown 文件按章节自动切分为多个小文件，每个文件不超过指定大小，用于翻译等后续工作流。切分后保证内容无丢失、无重复，并生成目录和报告。

## 环境要求

- Bun >= 1.0

## 使用方法

```bash
bun run src/cli.ts <file_path> [options]
```

### 参数

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `file_path` | str | 是 | — | 源 Markdown 文件路径 |
| `--output-dir` | str | 否 | `./output` | 输出目录 |
| `--max-size` | float | 否 | `40` | 单块最大大小（KB） |
| `--min-size` | float | 否 | `10` | 单块最小大小（KB），低于此值触发合并 |

### 示例

```bash
# 基本用法
bun run src/cli.ts paper.md

# 指定输出目录和大小参数
bun run src/cli.ts paper.md --output-dir ./chunks --max-size 30 --min-size 8
```

### 退出码

| 退出码 | 含义 |
|--------|------|
| 0 | 成功 |
| 1 | 文件不存在或不可读 |
| 2 | 文件超过 5MB 上限 |
| 3 | 完整性校验失败 |
| 4 | 输出目录写入失败 |

## 处理流程

```
前置检查 → [短路判断] → 章节解析 → 章节切分 → 小文件合并 → 完整性校验 → 生成文件 → 输出报告
```

1. **前置检查**：文件不存在则终止（退出码 1）；超过 5MB 则终止（退出码 2）
2. **短路判断**：`file_size < max_size` 时跳过解析、切分、合并，直接生成单 chunk 输出
3. **章节解析**：按 Markdown 标题（`#` ~ `######`）划分章节
4. **章节切分**：超过 max_size 的章节在段落边界二次切分，递归深度上限 4 层，超限则强制截断
5. **小文件合并**：相邻同级别且 < min_size 的 chunk 合并，合并后不超过 max_size
6. **完整性校验**：行数完整性、内容拼接一致性、无重复、首尾一致
7. **生成文件**：输出 chunk 文件 + `manifest.md`（目录）+ `progress.json`（翻译进度）
8. **输出报告**：生成 `report.md`

## 短路行为

当源文件大小（`file_size`）小于 `max_size` 时，doc_segmenter 跳过章节解析、切分、合并三个阶段，直接生成包含完整原文的单个 chunk。输出格式与多 chunk 路径完全一致（chunk 文件、manifest.md、progress.json、report.md），下游工作流统一按 chunk 遍历处理，无需区分单/多 chunk。

## 输出文件

程序在输出目录下生成以下文件：

```
output/
├── chunk-01-Abstract.md
├── chunk-02-Introduction.md
├── chunk-03-Methodology-p1.md
├── ...
├── manifest.md        # 切分目录
├── progress.json      # 翻译进度跟踪
└── report.md          # 切分报告
```

### manifest.md

包含切分目录表：序号、文件名、对应章节、级别、大小、行数、估计 tokens。

### progress.json

```json
{
  "source_file": "original.md",
  "source_size_kb": 25.34,
  "threshold_kb": 40.0,
  "total_chunks": 1,
  "completed": [],
  "in_progress": null,
  "pending": [
    {
      "index": 1,
      "filename": "chunk-01-original.md",
      "section": "original",
      "size_kb": 25.34
    }
  ]
}
```

- `source_size_kb`：源文件大小（KB）
- `threshold_kb`：分段阈值（KB），即 `--max-size` 参数值
- `total_chunks`：输出 chunk 总数（短路时为 1）

## 项目结构

```
doc_segmenter/
├── src/
│   ├── constants.ts    # 常量定义
│   ├── models.ts       # 数据模型
│   ├── types.ts        # 接口定义
│   ├── utils.ts        # 工具函数
│   ├── inspector.ts    # 前置检查
│   ├── parser.ts       # 章节解析
│   ├── splitter.ts     # 章节切分（含递归）
│   ├── merger.ts       # 小文件合并
│   ├── checker.ts      # 完整性校验
│   ├── generator.ts    # 文件生成
│   ├── reporter.ts     # 报告生成
│   ├── runner.ts       # 流程编排
│   ├── cli.ts          # 命令行入口
│   └── index.ts        # 公共 API 导出
└── tests/              # 测试文件
```

## 测试

```bash
# 安装依赖
bun install

# 全部测试
bun test

# 单个测试文件
bun test tests/parser.test.ts
```

共 107 个测试（107 passed），覆盖两层：

| 层级 | 文件 | 测试数 | 说明 |
|------|------|--------|------|
| 单元测试 | `models.test.ts` | 13 | 数据模型：SplitError、Chunk 默认值、SplitContext 默认值 |
| 单元测试 | `utils.test.ts` | 13 | 工具函数：sanitize_filename、calc_size_kb |
| 单元测试 | `parser.test.ts` | 9 | 章节解析：空内容、纯文本、标题、前言、中文、行号 |
| 单元测试 | `checker.test.ts` | 13 | 完整性校验：行数、拼接、去重、首尾行 |
| 单元测试 | `splitter-basic.test.ts` | 9 | 基本切分：小文件、大文件、切分点、命名、操作记录 |
| 单元测试 | `splitter-protected.test.ts` | 9 | 保护区域：代码块、HTML 表格、pipe 表格 |
| 单元测试 | `splitter-recursive.test.ts` | 4 | 递归切分：无切分点时的回退行为 |
| 单元测试 | `merger.test.ts` | 11 | 小文件合并：同/异级别、合并属性、操作记录 |
| 单元测试 | `inspector.test.ts` | 7 | 前置检查：文件不存在、超大文件、编码、行数 |
| 单元测试 | `runner-shortcircuit.test.ts` | 9 | 短路路径、输出结构、progress.json 元数据 |
| 集成测试 | `integration-pipeline.test.ts` | 10 | 端到端：~80KB 多类型 Markdown 完整管道验证 |
