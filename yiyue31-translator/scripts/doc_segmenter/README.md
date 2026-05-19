# doc-segmenter

将大型 Markdown 文件按章节自动切分为多个小文件，每个文件不超过指定大小，用于翻译等后续工作流。切分后保证内容无丢失、无重复，并生成目录和报告。

## 环境要求

- Python >= 3.10
- 无外部依赖

## 使用方法

```bash
python -m doc_segmenter.cli <file_path> [options]
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
python -m doc_segmenter.cli paper.md

# 指定输出目录和大小参数
python -m doc_segmenter.cli paper.md --output-dir ./chunks --max-size 30 --min-size 8
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
前置检查 → 章节解析 → 章节切分 → 小文件合并 → 完整性校验 → 生成文件 → 输出报告
```

1. **前置检查**：文件不存在则终止（退出码 1）；超过 5MB 则终止（退出码 2）；不超过 max_size 则跳过切分
2. **章节解析**：按 Markdown 标题（`#` ~ `######`）划分章节
3. **章节切分**：超过 max_size 的章节在段落边界二次切分，递归深度上限 4 层，超限则强制截断
4. **小文件合并**：相邻同级别且 < min_size 的 chunk 合并，合并后不超过 max_size
5. **完整性校验**：行数完整性、内容拼接一致性、无重复、首尾一致
6. **生成文件**：输出 chunk 文件 + `manifest.md`（目录）+ `progress.json`（翻译进度）
7. **输出报告**：生成 `report.md`

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
  "total_chunks": 8,
  "completed": [],
  "in_progress": null,
  "pending": ["chunk-01-Abstract.md", "..."]
}
```

## 项目结构

```
doc_segmenter/
├── __init__.py        # 包导出
├── models.py          # 数据模型（dataclass）
├── protocols.py       # 模块接口（Protocol）
├── utils.py           # 工具函数（sanitize_filename, calc_size_kb）
├── inspector.py       # 前置检查
├── parser.py          # 章节解析
├── splitter.py        # 章节切分（含递归）
├── merger.py          # 小文件合并
├── checker.py         # 完整性校验
├── generator.py       # 文件生成
├── reporter.py        # 报告生成
├── runner.py          # 流程编排
└── cli.py             # 命令行入口
```

## 测试

```bash
# 全部测试（单元 + E2E + UAT）
pytest tests/

# 仅 UAT 测试（通过 subprocess 调用 CLI，验证用户视角行为）
pytest tests/test_uat_*.py
```

共 326 个测试（319 passed, 7 skipped），覆盖三层：

| 层级 | 文件 | 说明 |
|------|------|------|
| 单元/集成 | `test_*.py`（非 uat） | 模块内部契约 |
| E2E | `test_e2e.py` | 完整管道功能 |
| UAT | `test_uat_*.py` | 用户视角：CLI 执行、错误信息、鲁棒输入、路径权限、输出可用性、跨平台 |
