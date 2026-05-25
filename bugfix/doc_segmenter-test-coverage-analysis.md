# doc_segmenter 测试覆盖分析

**Date**: 2026-05-25
**Status**: Analysis complete, implementation not started

---

## 现状

README 声称有 326 个测试（319 passed, 7 skipped），但实际只有 1 个测试文件 `test_runner_shortcircuit.py`（约 15 个测试），覆盖的是 runner 的短路路径。核心模块没有独立测试。

### 模块依赖图

```
models.py ← (被所有模块依赖)
utils.py  ← splitter, parser, generator, reporter
inspector.py ← runner
parser.py    ← runner
splitter.py  ← runner
merger.py    ← runner
checker.py   ← runner
generator.py ← runner
reporter.py  ← runner
runner.py    ← cli.py
```

---

## 方案：按依赖层级从底向上补测试

### 第一层：纯函数/数据（无依赖）

| 目标 | 测试重点 |
|------|----------|
| `utils.py` | `sanitize_filename` 特殊字符处理、`calc_size_kb` 精度 |
| `models.py` | `SplitError` exit_code 传播、`Chunk`/`Section` 默认值 |

### 第二层：独立逻辑模块（只依赖 models）

| 目标 | 关键场景 | 优先级 |
|------|----------|--------|
| `parser.py` | 无标题 → root section、有多级标题、preamble 提取、空内容 | **高** |
| `splitter.py` | 保护区域（代码块、HTML table、pipe table）不被切断、递归深度限制、target 75% 寻找切分点、force truncate 回退 | **高** |
| `merger.py` | 相邻同级小文件合并、合并后不超 max_size、跳过不同级 | 中 |
| `checker.py` | 4 项校验各自独立：行数、内容拼接、无重复、首尾一致；merge 场景下 separator 补偿 | **高** |
| `inspector.py` | 文件不存在 → exit_code 1、超 5MB → exit_code 2 | 低 |

### 第三层：集成验证

| 目标 | 测试重点 |
|------|----------|
| `runner.py` + 全管道 | 端到端：构造一个含代码块 + 表格 + 多级标题的 ~80KB markdown → 跑完整 pipeline → 校验 chunk 数量合理、所有 chunk ≤ max_size、拼接还原等于原文、progress.json 字段完整 |

### 不需要单独测的

`generator.py`、`reporter.py`、`cli.py` — I/O 和格式化层，通过 runner 集成测试间接覆盖。

---

## 执行顺序

**parser → checker → splitter → merger → runner 全管道**

理由：parser 和 checker 是断言的基础——集成测试需要先验证"解析正确"和"校验逻辑正确"，才能信任 splitter 和 merger 的结果。

## 工作量估算

约 80-120 个测试用例，splitter 占大头（~40 个）。每个模块一个测试文件。
