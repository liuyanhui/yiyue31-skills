# Task List: doc_segmenter 测试覆盖补全

**Created**: 2026-05-25
**Updated**: 2026-05-25 (审查修订)
**Status**: Not started
**Reference**: [doc_segmenter-test-coverage-analysis.md](doc_segmenter-test-coverage-analysis.md)

---

## T-000: 共享测试基础设施

```yaml
Task-ID: T-000
Description: 创建 conftest.py，提取多个测试文件共用的 fixture 和辅助函数
Constraints:
  - 文件: tests/conftest.py
  - 不修改源代码
  - 从 test_runner_shortcircuit.py 中提取 _create_small_markdown、_create_large_markdown、_create_boundary_markdown 为共享辅助函数
  - 新增 make_section(content, level=1, title="test", ...) 辅助函数，自动计算 size_kb / start_line / end_line
  - 新增 make_source_info(file_path, file_size, file_lines, file_chars, ...) 辅助函数
  - 新增 create_markdown(lines, tmp_path, filename="test.md") 辅助函数
Deliverable: conftest.py 文件
Evaluation Criteria:
  - [ ] C1: conftest.py 存在于 tests/ 目录
  - [ ] C2: make_section(content) 返回 Section 对象，size_kb == calc_size_kb(content)，start_line=0, end_line=content.count("\n")
  - [ ] C3: make_source_info(file_path, file_size, file_lines, file_chars) 返回 SourceFileInfo 对象，字段可访问
  - [ ] C4: create_markdown(lines, tmp_path) 在 tmp_path 下创建文件，返回路径，文件内容 == "\n".join(lines)
  - [ ] C5: _create_small_markdown / _create_large_markdown / _create_boundary_markdown 保留为独立辅助函数，语义不变
  - [ ] C6: test_runner_shortcircuit.py 删除内联的 _create_* 函数，改用 conftest 后仍全部通过
Evaluation Method: pytest tests/test_runner_shortcircuit.py
Evaluation Result:
Current Round: 0
Max Rounds: 3
Status: pending
```

---

## T-001: models.py 和 utils.py 单元测试

```yaml
Task-ID: T-001
Description: 为 models.py 和 utils.py 编写单元测试
Constraints:
  - 测试文件: tests/test_models.py, tests/test_utils.py
  - 不修改源代码
  - 可使用 conftest 辅助函数，但不强制（纯 dataclass 构造即可）
Deliverable: 两个测试文件，所有测试通过
Evaluation Criteria:
  - [ ] C1: SplitError(message, exit_code=1).exit_code == 1
  - [ ] C2: Chunk() 默认值 is_merged=False, merged_sections=[], estimated_tokens=0
  - [ ] C3: Section 和 SourceFileInfo dataclass 可正常构造，字段可访问
  - [ ] C4: SplitContext 默认值 sections=[], chunks=[], operations=[], validation_results={}, output_dir=""
  - [ ] C5: sanitize_filename 将 \/:*?"<>| 替换为 -
  - [ ] C6: sanitize_filename 将连续多个特殊字符合并为单个 -（如 "a///b" → "a-b"）
  - [ ] C7: sanitize_filename 空字符串返回空字符串
  - [ ] C8: calc_size_kb 与 len(content.encode('utf-8')) / 1024 一致（精度 ±0.001）
  - [ ] C9: calc_size_kb 空字符串返回 0.0
  - [ ] C10: calc_size_kb 含中文/emoji 的字符串按 UTF-8 字节数计算
Evaluation Method: pytest tests/test_models.py tests/test_utils.py
Evaluation Result:
Current Round: 0
Max Rounds: 3
Status: pending
```

---

## T-002: parser.py 单元测试

```yaml
Task-ID: T-002
Description: 为 parser.py 编写单元测试，覆盖 Markdown 标题解析场景
Constraints:
  - 测试文件: tests/test_parser.py
  - 不修改源代码
Deliverable: 测试文件，所有测试通过
Evaluation Criteria:
  - [ ] C1: 空内容 → 返回 [Section(level=0, title="root", content="", size_kb=0.0, start_line=0, end_line=0)]
  - [ ] C2: 无标题的纯段落 → 返回 [Section(level=0, title="root", content=原文)]
  - [ ] C3: 输入第一行为 "# Title" → 返回 1 个 section，level=1，无 preamble
  - [ ] C4: 多级标题（# / ## / ###）→ 每个 heading 独立一个 section，level 分别为 1/2/3
  - [ ] C5: 标题前有内容（preamble）→ 第一个 section 为 preamble，level=0，后续 section 从第一个 # 开始
  - [ ] C6: 所有 section.content 拼接（按顺序）== 原始 content
  - [ ] C7: section.start_line / end_line 为 0-based 索引，与原始行对应
  - [ ] C8: 中文标题 "# 中文标题" → section.title == "中文标题"
  - [ ] C9: 连续 # 标题（无正文）→ 每个 section 的 content 只包含标题行本身
Evaluation Method: pytest tests/test_parser.py
Evaluation Result:
Current Round: 0
Max Rounds: 3
Status: pending
```

---

## T-003: checker.py 单元测试

```yaml
Task-ID: T-003
Description: 为 checker.py 编写单元测试，覆盖 4 项完整性校验
Constraints:
  - 测试文件: tests/test_checker.py
  - 不修改源代码
Deliverable: 测试文件，所有测试通过
Evaluation Criteria:
  - [ ] C1: line_count — 正常 chunks 总行数 == source_info.file_lines → 返回 True
  - [ ] C2: line_count — 总行数不匹配 → 返回 False
  - [ ] C3: content_concat — chunks 拼接 == original_content → 返回 True（走直接比较路径）
  - [ ] C4: content_concat — 有内容丢失或多余 → 返回 False
  - [ ] C5: content_concat — merged chunk 含 \n\n separator 时走 normalize_whitespace 路径仍返回 True
  - [ ] C6: no_duplicates — 所有 chunk 内容唯一 → 返回 True
  - [ ] C7: no_duplicates — chunk A 的内容恰好是 chunk B 内容的子串 → 验证实际返回值（记录行为，不论 pass/fail）
  - [ ] C8: no_duplicates — 两个 chunk 内容完全相同 → 返回 False
  - [ ] C9: first_last_line — 首行和末行匹配原文 → 返回 True
  - [ ] C10: first_last_line — 首行或末行不匹配 → 返回 False
  - [ ] C11: merge 场景 is_merged=True, merged_sections=2：line_count 补偿公式 (N-1)*2 正确性——用不以 \n 结尾的 section 构造
  - [ ] C12: merge 场景 is_merged=True, merged_sections=2：line_count 补偿公式——用以 \n 结尾的 section 构造，记录实际返回值
  - [ ] C13: 空 chunks 列表 → first_last_line 返回 True；line_count 在 file_lines==0 时返回 True，file_lines>0 时返回 False
Evaluation Method: pytest tests/test_checker.py
Evaluation Result:
Current Round: 0
Max Rounds: 3
Status: pending
```

---

## T-004: splitter.py 基本切分逻辑

```yaml
Task-ID: T-004
Description: 为 splitter.py 的基本切分逻辑编写单元测试
Constraints:
  - 测试文件: tests/test_splitter_basic.py
  - 不修改源代码
  - 测试内容为纯文本段落，不含代码块/表格
Deliverable: 测试文件，所有测试通过
Evaluation Criteria:
  - [ ] C1: section.size_kb <= max_size 时直接转 chunk，不切分，operations 为空
  - [ ] C2: 超大 section 切分后所有 chunk.size_kb <= max_size
  - [ ] C3: 切分在空行处发生，chunk 边界不出现在段落中间
  - [ ] C4: 第一个切分出的 chunk 的 size_kb 在 [max_size * 0.5, max_size] 范围内
  - [ ] C5: 所有 chunk.content 拼接（按顺序）== 原始 section.content
  - [ ] C6: 被 split 的 section 产出的 chunk，source_section 后缀为 -p1, -p2, ... 编号连续；未 split 的 section 无后缀
  - [ ] C7: SplitOperation.operation == "split"，detail 格式为 "{N}KB -> p1({N}KB) + p2({N}KB)"
  - [ ] C8: 多个 section 输入，各自独立切分互不影响
Evaluation Method: pytest tests/test_splitter_basic.py
Evaluation Result:
Current Round: 0
Max Rounds: 3
Status: pending
```

---

## T-004a: splitter.py 保护区域检测

```yaml
Task-ID: T-004a
Description: 为 splitter.py 的保护区域逻辑编写单元测试
Constraints:
  - 测试文件: tests/test_splitter_protected.py
  - 不修改源代码
Deliverable: 测试文件，所有测试通过
Evaluation Criteria:
  - [ ] C1: ```...``` 代码块完整保留在单个 chunk 中（含 ```python 等带语言标记的）
  - [ ] C2: <table>...</table> 完整保留在单个 chunk 中
  - [ ] C3: |...|...| pipe table 多行完整保留在单个 chunk 中（含 |---|---| 分隔行）
  - [ ] C4: 混合内容（代码块+普通段落）切分发生在保护区域外的空行处
  - [ ] C5: 保护区域自身超过 max_size 时，仍保持完整不切分
  - [ ] C6: 多个不相邻的代码块各自独立保留在各自的 chunk 中
  - [ ] C7: 代码块内含 | 字符的文本不误判为 pipe table
  - [ ] C8: 未闭合的代码块（只有开 ``` 没有闭 ```）不触发保护，正常切分
  - [ ] C9: 两段不相邻的 pipe table（中间夹普通段落）形成两个独立的保护范围
Evaluation Method: pytest tests/test_splitter_protected.py
Evaluation Result:
Current Round: 0
Max Rounds: 3
Status: pending
```

---

## T-004b: splitter.py 递归深度与 force truncate

```yaml
Task-ID: T-004b
Description: 为 splitter.py 的递归切分和 force truncate 回退逻辑编写单元测试
Constraints:
  - 测试文件: tests/test_splitter_recursive.py
  - 不修改源代码
Deliverable: 测试文件，所有测试通过
Evaluation Criteria:
  - [ ] C1: 构造一个 section 含多个段落，单个段落远大于 max_size（无空行），使第一次切分后仍有 chunk 超过 max_size，触发递归
  - [ ] C2: 递归深度达到 _MAX_DEPTH=4 时停止，最终存在 chunk.size_kb > max_size
  - [ ] C3: 无空行且无标题的连续文本 → 无有效切分点 → 触发 force truncate（走 _force_truncate_protected 路径）
  - [ ] C4: force truncate 仍尊重保护区域（含代码块的连续文本，代码块不被切断）
  - [ ] C5: force truncate 后所有 chunk.content 拼接 == 原始 content
  - [ ] C6: force truncate 的 SplitOperation.detail 中出现 "p1" "p2" 等标记
Evaluation Method: pytest tests/test_splitter_recursive.py
Evaluation Result:
Current Round: 0
Max Rounds: 3
Status: pending
```

---

## T-005: merger.py 单元测试

```yaml
Task-ID: T-005
Description: 为 merger.py 编写单元测试，覆盖小文件合并逻辑
Constraints:
  - 测试文件: tests/test_merger.py
  - 不修改源代码
Deliverable: 测试文件，所有测试通过
Evaluation Criteria:
  - [ ] C1: 空列表输入 → 返回 ([], [])
  - [ ] C2: 单个 chunk 输入 → 原样返回
  - [ ] C3: 相邻同级且 < min_size → 合并为一个 chunk
  - [ ] C4: 合并后 chunk.size_kb <= max_size（若超则不合并，保持独立）
  - [ ] C5: 不同 level 的 chunks 不合并
  - [ ] C6: 已达 min_size（== min_size）的 chunks 保持独立（严格 <，不含 ==）
  - [ ] C7: 合并后 is_merged=True，merged_sections 列出原始 section 名
  - [ ] C8: 合并后 content == predecessor.content + "\n\n" + current.content
  - [ ] C9: 合并后 chunk.line_count == len(chunk.content.split("\n"))（验证 +2 公式是否正确）
  - [ ] C10: 连续 3 个同级小 chunks 合并为 1 个（链式合并），总大小不超 max_size
  - [ ] C11: 链式合并后 merged_sections == ["A", "B", "C"]，source_section == "A + B + C"
  - [ ] C12: SplitOperation.operation == "merge"，detail 格式为 "{N}KB + {N}KB -> {N}KB"
Evaluation Method: pytest tests/test_merger.py
Evaluation Result:
Current Round: 0
Max Rounds: 3
Status: pending
```

---

## T-006: inspector.py 单元测试

```yaml
Task-ID: T-006
Description: 为 inspector.py 编写单元测试，覆盖前置检查逻辑
Constraints:
  - 测试文件: tests/test_inspector.py
  - 不修改源代码
  - inspector 依赖 chardet 第三方库
Deliverable: 测试文件，所有测试通过
Evaluation Criteria:
  - [ ] C1: 文件不存在 → 抛出 SplitError(exit_code=1)
  - [ ] C2: 文件超过 5MB → 抛出 SplitError(exit_code=2)
  - [ ] C3: 正常 utf-8 文件 → SourceFileInfo 字段正确（file_path 为传入路径，file_size == os.path.getsize / 1024.0）
  - [ ] C4: file_size 基于 os.path.getsize（磁盘字节），与 len(content) 不同（文件含 \r\n 时可观察到差异）
  - [ ] C5: 无尾部换行的文件 file_lines == content.count("\n") + 1
  - [ ] C6: 含 BOM 的 utf-8 文件 file_encoding == "utf-8"
  - [ ] C7: 空文件（0 字节）→ file_lines == 0, file_chars == 0, file_size == 0.0, file_encoding == "utf-8"
  - [ ] C8: GBK 编码的中文文件 file_encoding 在 ["gbk", "gb2312", "gb18030"] 中
Evaluation Method: pytest tests/test_inspector.py
Evaluation Result:
Current Round: 0
Max Rounds: 3
Status: pending
```

---

## T-007: Runner 全管道集成测试

```yaml
Task-ID: T-007
Description: 端到端集成测试，构造含代码块+表格+多级标题的 ~80KB markdown，验证完整 pipeline 输出
Constraints:
  - 测试文件: tests/test_integration_pipeline.py
  - 不修改源代码
  - 使用 tmp_path fixture
  - 构造测试 markdown 需包含：代码块（```...```）、HTML table、pipe table、多级标题（#/##/###）、长段落
Deliverable: 测试文件，所有测试通过
Evaluation Criteria:
  - [ ] C1: runner.run() 返回 0
  - [ ] C2: 输出目录包含 chunk-*.md, manifest.md, progress.json, report.md
  - [ ] C3: 所有 chunk 文件 size_kb <= max_size
  - [ ] C4: 所有 chunk 文件非空
  - [ ] C5: chunk 内容按文件名排序（chunk-01, chunk-02, ...）拼接 == 原始 markdown 内容
  - [ ] C6: progress.json 含 source_size_kb, threshold_kb, total_chunks, pending 字段
  - [ ] C7: total_chunks 与实际 chunk 文件数一致
  - [ ] C8: manifest.md 中列出的文件名与实际 chunk 文件一致
  - [ ] C9: 每个 chunk 文件内 ``` 标记成对出现（代码块未被切分到两个 chunk）
  - [ ] C10: chunk 文件名中 section 名经过 sanitize_filename 处理（特殊字符被替换）
Evaluation Method: pytest tests/test_integration_pipeline.py
Evaluation Result:
Current Round: 0
Max Rounds: 5
Status: pending
```

---

## T-008: 更新 README 测试文档

```yaml
Task-ID: T-008
Description: 更新 doc_segmenter/README.md 的测试章节，反映实际测试文件和数量
Constraints:
  - 只修改 README.md 的测试章节
  - 不修改源代码
  - 运行全量测试获取实际数量
Deliverable: README.md 更新后的测试章节
Evaluation Criteria:
  - [ ] C1: 测试文件表格列出 tests/ 下所有实际存在的 test_*.py 文件
  - [ ] C2: 测试总数与 pytest tests/ -v 的实际结果一致
  - [ ] C3: 分层描述只包含实际存在的层级（单元测试、集成测试），不包含不存在的 UAT 层
Evaluation Method: pytest tests/ -v 统计数量，与 README 内容逐项比对
Evaluation Result:
Current Round: 0
Max Rounds: 2
Status: pending
```

---

## 执行顺序与依赖

```
T-000 (conftest)
  ↓
T-001 (models/utils)
  ↓
  ┌─────────┬──────────┬──────────┬──────────┬──────────┐
  ↓         ↓          ↓          ↓          ↓          ↓
T-002    T-003      T-004      T-004a     T-004b     T-005     T-006
(parser) (checker)  (splitter  (splitter  (splitter  (merger)  (inspector)
                    /basic)    /protected)/recursive)
  └─────────┴──────────┴──────────┴──────────┴────┬─────┘
                                                    ↓
                                                  T-007 (integration)
                                                    ↓
                                                  T-008 (README)
```

- T-000 最先：conftest 基础设施
- T-001 第二：models/utils 是所有模块的数据基础
- T-002 到 T-006 可全部并行，它们之间没有代码依赖：
  - parser / checker / splitter / merger / inspector 各自只依赖 models
  - T-004 / T-004a / T-004b 测试 splitter 的不同行为维度，可并行
- T-007 汇总：集成测试依赖所有模块的单元测试通过
- T-008 收尾：更新文档
