# Task List: doc_segmenter 测试覆盖补全

**Created**: 2026-05-25
**Updated**: 2026-05-25 (v2 — 第二轮审查修订)
**Status**: Not started
**Reference**: [doc_segmenter-test-coverage-analysis.md](doc_segmenter-test-coverage-analysis.md)
**Previous**: [task-list-v1.md](task-list-v1.md)

---

## T-000: 共享测试基础设施

```yaml
Task-ID: T-000
Description: 创建 conftest.py，提取多个测试文件共用的 fixture 和辅助函数
Constraints:
  - 文件: tests/conftest.py
  - 不修改源代码
  - 从 test_runner_shortcircuit.py 中提取 _create_small_markdown、_create_large_markdown、_create_boundary_markdown 为共享辅助函数
  - 新增 make_section 辅助函数
  - 新增 make_source_info 辅助函数
  - 新增 create_markdown 辅助函数
Deliverable: conftest.py 文件
Evaluation Criteria:
  - [ ] C1: conftest.py 存在于 tests/ 目录
  - [ ] C2: make_section(content="hello\nworld", level=1, title="Test") 返回
      Section(level=1, title="Test", content="hello\nworld",
              size_kb=calc_size_kb("hello\nworld"), start_line=0, end_line=1)
  - [ ] C3: make_source_info(file_path="/tmp/f.md", file_lines=10, file_chars=100)
      返回 SourceFileInfo，其中 file_path=="/tmp/f.md", file_lines==10, file_chars==100
  - [ ] C4: create_markdown(["# Title", "", "content"], tmp_path, "test.md") 写入文件，
      路径为 str(tmp_path / "test.md")，文件内容为 "# Title\n\ncontent"
  - [ ] C5: _create_small_markdown(tmp_path) 产出的文件内容与重构前完全一致（逐字节对比）
  - [ ] C6: _create_large_markdown(tmp_path) 产出的文件内容与重构前完全一致（逐字节对比）
  - [ ] C7: _create_boundary_markdown(tmp_path) 产出的文件内容与重构前完全一致（逐字节对比）
  - [ ] C8: test_runner_shortcircuit.py 删除内联的 _create_* 函数后，pytest tests/test_runner_shortcircuit.py 全部通过
Evaluation Method:
  - C1-C4: 读 conftest.py 代码 + 手动验证
  - C5-C7: pytest tests/test_runner_shortcircuit.py（若文件内容不一致，现有测试可能失败）
  - C8: pytest tests/test_runner_shortcircuit.py
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
Deliverable: 两个测试文件，所有测试通过
Evaluation Criteria:
  - [ ] C1: SplitError("file not found", exit_code=1).exit_code == 1
  - [ ] C2: Chunk(content="x").is_merged == False, .merged_sections == [], .estimated_tokens == 0
  - [ ] C3: SplitContext(source_info=<任意>).sections == [], .chunks == [], .operations == [],
      .validation_results == {}, .output_dir == ""
  - [ ] C4: sanitize_filename("a/b:c?d") == "a-b-c-d"
  - [ ] C5: sanitize_filename("a///b") == "a-b"
  - [ ] C6: sanitize_filename("") == ""
  - [ ] C7: calc_size_kb("abc") == len("abc".encode("utf-8")) / 1024（绝对误差 <= 0.001）
  - [ ] C8: calc_size_kb("") == 0.0
  - [ ] C9: calc_size_kb("中文") == 6 / 1024（"中文" UTF-8 编码为 6 字节）
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
Description: 为 parser.py 编写单元测试
Constraints:
  - 测试文件: tests/test_parser.py
  - 不修改源代码
Deliverable: 测试文件，所有测试通过
Evaluation Criteria:
  - [ ] C1: parse("", "utf-8") == [Section(level=0, title="root", content="",
         size_kb=0.0, start_line=0, end_line=0)]
  - [ ] C2: parse("hello world", "utf-8") == [Section(level=0, title="root",
         content="hello world", size_kb=calc_size_kb("hello world"),
         start_line=0, end_line=0)]
  - [ ] C3: parse("# Title\nbody", "utf-8") 返回 len==1，
         result[0].level==1, result[0].title=="Title", result[0].content=="# Title\nbody"
  - [ ] C4: parse("# A\na\n\n## B\nb\n\n### C\nc", "utf-8") 返回 len==3,
         levels == [1,2,3], titles == ["A","B","C"]
  - [ ] C5: parse("intro\n\n# Title\nbody", "utf-8") 返回 len==2,
         result[0].level==0, result[0].title=="preamble", result[0].content=="intro\n\n",
         result[1].level==1, result[1].title=="Title"
  - [ ] C6: 对 C4 的输入，"".join(s.content for s in result) == 原始 content
  - [ ] C7: 对 C4 的输入，result[0].start_line==0, result[0].end_line==1,
         result[1].start_line==3, result[1].end_line==4, result[2].start_line==6, result[2].end_line==7
  - [ ] C8: parse("# 中文标题\n内容", "utf-8") → result[0].title == "中文标题"
  - [ ] C9: parse("# A\n# B\n# C", "utf-8") 返回 len==3,
         result[0].content=="# A", result[1].content=="# B", result[2].content=="# C"
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
  - [ ] C1: 给定 1 个 chunk(content="a\nb\nc") 和 source_info(file_lines=3)，
         check()["line_count"] == True
  - [ ] C2: 给定 1 个 chunk(content="a\nb\nc") 和 source_info(file_lines=5)，
         check()["line_count"] == False
  - [ ] C3: 给定 2 个 chunk(content="abc", "def") 和 original="abcdef"，
         check()["content_concat"] == True
  - [ ] C4: 给定 2 个 chunk(content="abc", "def") 和 original="abcXYZ"，
         check()["content_concat"] == False
  - [ ] C5: 给定 1 个 is_merged=True, content="A\n\nB" 的 chunk 和 original="AB"（非 \n 分隔），
         check()["content_concat"] == True（normalize_whitespace 路径）
  - [ ] C6: 给定 2 个 chunk(content="abc", "def")，check()["no_duplicates"] == True
  - [ ] C7: 给定 2 个 chunk(content="abc", "abc")，check()["no_duplicates"] == False
  - [ ] C8: 给定 2 个 chunk(content="a", "xa")，check()["no_duplicates"] 的返回值（记录子串重叠行为）
  - [ ] C9: 给定 1 个 chunk(content="first\nmiddle\nlast") 和 original="first\nmiddle\nlast"，
         check()["first_last_line"] == True
  - [ ] C10: 给定 1 个 chunk(content="XXX\nmiddle\nlast") 和 original="first\nmiddle\nlast"，
         check()["first_last_line"] == False
  - [ ] C11: 给定 1 个 is_merged=True, merged_sections=["A","B"], content="a\nb\n\nc\nd" 的 chunk
         和 source_info(file_lines=4)（不以 \n 结尾），check()["line_count"] == True
  - [ ] C12: 给定 1 个 is_merged=True, merged_sections=["A","B"], content="a\nb\n\nc\nd\n" 的 chunk
         和 source_info(file_lines=5)（以 \n 结尾），check()["line_count"] 的返回值
  - [ ] C13: 给定 chunks=[] 和 original=""，check()["first_last_line"] == True，
         check()["line_count"] 在 file_lines==0 时 == True
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
  - [ ] C1: 给定 section(size_kb=5)，max_size=40 → 返回 1 个 chunk，operations 为空列表
  - [ ] C2: 给定 section(content=100KB 纯文本段落)，max_size=40 → 所有 chunk.size_kb <= 40
  - [ ] C3: 对 C2 的输入，每个 chunk.content 不以半个段落行开头或结尾（即在空行边界切分）
  - [ ] C4: 对 C2 的输入，每个 chunk.size_kb <= max_size（无下限要求，源码不保证最小 chunk 大小）
  - [ ] C5: 对 C2 的输入，"".join(c.content for c in chunks) == section.content
  - [ ] C6: 给定 section(title="Intro", content=100KB) 被 split 为 3 个 chunk，
         source_section 依次为 "Intro-p1", "Intro-p2", "Intro-p3"；
         给定 section(title="Small", size_kb=5) 未 split，source_section 为 "Small"
  - [ ] C7: 给定 section(title="Intro", size_kb=80)，max_size=40 被 split 为 2 个 chunk，
         SplitOperation.operation=="split", .target=="Intro",
         detail=="80KB -> p1(40KB) + p2(40KB)"（具体数值取决于实际切分，但格式为 "{N}KB -> p1({N}KB) + p2({N}KB)"）
  - [ ] C8: 给定 2 个 section(A=5KB, B=80KB)，max_size=40 → A 产出 1 个 chunk，B 被独立切分
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
  - [ ] C1: 给定含 "```python\ncode\n```" 的 section(60KB)，max_size=40，
         代码块完整保留在某个 chunk.content 中（"```" 标记成对出现）
  - [ ] C2: 给定含 "<table>\n<tr>\n<td>data</td>\n</tr>\n</table>" 的 section(60KB)，max_size=40，
         <table> 到 </table> 完整保留在某个 chunk.content 中
  - [ ] C3: 给定含 "| A | B |\n|---|---|\n| 1 | 2 |" 的 section(60KB)，max_size=40，
         pipe table 全部 3 行保留在同一个 chunk.content 中
  - [ ] C4: 给定 section 含 "para1\n\n```py\ncode\n```\n\npara2"，max_size 使得必须切分，
         切分点在 "para1" 与代码块之间或代码块与 "para2" 之间的空行处
  - [ ] C5: 给定 section 含 50KB 代码块，max_size=40 → 代码块完整保留在 1 个 chunk 中，
         即使该 chunk.size_kb > max_size
  - [ ] C6: 给定 section 含 2 个不相邻的代码块（中间夹普通段落），max_size 使得需要切分，
         两个代码块各自完整保留在各自的 chunk 中
  - [ ] C7: 给定 section 含 "```\ndata = a | b\n```"，max_size=40，
         ``` 标记成对出现（不误判 | 为 pipe table）
  - [ ] C8: 给定 section 含 "```\nunclosed code rest..."（无闭合 ```），max_size 使得需要切分，
         内容可被切分（未闭合代码块不触发保护）
  - [ ] C9: 给定 section 含 "| A | B |\n|---|---|\n\npara\n\n| C | D |\n|---|---|"，
         两段 pipe table 分别保留在不同的 chunk 中（中间段落作为切分点）
Evaluation Method: pytest tests/test_splitter_protected.py
Evaluation Result:
Current Round: 0
Max Rounds: 3
Status: pending
```

---

## T-004b: splitter.py 无有效切分点时的行为

```yaml
Task-ID: T-004b
Description: 为 splitter.py 在无正常切分点时的回退行为编写单元测试
Constraints:
  - 测试文件: tests/test_splitter_recursive.py
  - 不修改源代码
Deliverable: 测试文件，所有测试通过
Evaluation Criteria:
  - [ ] C1: 给定 section(content=连续 80KB 文本，无空行无标题)，max_size=40，
         返回的 chunks 数量 > 1，且 "".join(c.content for c in chunks) == section.content
  - [ ] C2: 给定 section(content=连续 200KB 文本，无空行无标题)，max_size=40，
         至少存在 1 个 chunk.size_kb > max_size（深度限制导致无法继续切分）
  - [ ] C3: 给定 section 含 "```py\ncode\n```" + 连续文本，max_size=40，
         每个 chunk 中 ``` 标记成对出现（代码块不被切断）
  - [ ] C4: 给定 section(content=连续 80KB 文本)，max_size=40，
         返回的 SplitOperation 数量 >= 1，每个 operation.detail 中包含 "p1" 子串
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
  - [ ] C1: merge([], max_size=40, min_size=10) == ([], [])
  - [ ] C2: 给定 1 个 chunk，返回 [该 chunk]，operations 为空
  - [ ] C3: 给定 2 个同级(level=1) chunk(size_kb=5, 5)，min_size=10，max_size=40 → 合并为 1 个 chunk
  - [ ] C4: 给定 2 个同级(level=1) chunk(size_kb=25, 25)，min_size=10，max_size=30 → 不合并（45 > 30）
  - [ ] C5: 给定 2 个不同 level(level=1, level=2) chunk(size_kb=5, 5)，min_size=10 → 不合并
  - [ ] C6: 给定 2 个同级(level=1) chunk(size_kb=10, 5)，min_size=10 → 不合并（第一个已达 min_size，严格 <）
  - [ ] C7: 对 C3 的合并结果，result[0].is_merged == True, .merged_sections == ["A", "B"]
  - [ ] C8: 对 C3 的合并结果，result[0].content == "content_A\n\ncontent_B"
  - [ ] C9: 给定 3 个同级(level=1) chunk(size_kb=3, 3, 3)，min_size=10，max_size=40 → 合并为 1 个 chunk，
         merged_sections == ["A", "B", "C"], source_section == "A + B + C"
  - [ ] C10: 对 C3 的合并结果，result[0].line_count == predecessor.line_count + current.line_count + 2
  - [ ] C11: 对 C3 的 SplitOperation，operation == "merge",
         detail == "5KB + 5KB -> 10KB"（格式为 "{N}KB + {N}KB -> {N}KB"）
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
  - [ ] C1: inspect("/nonexistent/file.md") 抛出 SplitError(exit_code=1)
  - [ ] C2: 给定 5MB+1 字节的文件，inspect() 抛出 SplitError(exit_code=2)
  - [ ] C3: 给定 utf-8 文件内容 "# Hello\nWorld"，inspect() 返回 SourceFileInfo：
         file_path == 传入路径, file_size == os.path.getsize(路径)/1024.0,
         file_lines == 2, file_chars == len("# Hello\nWorld"), file_encoding == "utf-8"
  - [ ] C4: 给定文件写入 "line1\r\nline2"（二进制写入），inspect() 返回的
         file_size > len(读取后的 content) / 1024（\r\n 被规范化为 \n）
  - [ ] C5: 给定文件内容 "line1\nline2"（无尾部 \n），inspect() 返回 file_lines == 2
  - [ ] C6: 给定写入 BOM (b"\xef\xbb\xbf") + "# Hello" 的文件，inspect() 返回 file_encoding == "utf-8"
  - [ ] C7: 给定 0 字节文件，inspect() 返回 file_lines == 0, file_chars == 0, file_size == 0.0
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
  - [ ] C10: chunk 文件名中 section 名经过 sanitize_filename 处理（特殊字符被替换为 -）
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
  - [ ] C3: 分层描述只包含 "单元测试" 和 "集成测试" 两个层级
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
  ┌─────────┬──────────┬──────────┬──────────┬──────────┬──────────┐
  ↓         ↓          ↓          ↓          ↓          ↓          ↓
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

---

## v1 → v2 变更摘要

| 变更 | 原因 |
|------|------|
| T-000 C2/C3：给定具体输入和期望输出 | 原文缺少具体值，不可验证 |
| T-000 C5-C7：逐字节对比而非"语义不变" | "语义不变"不可验证 |
| T-001：移除"字段可访问"，增加 SplitContext 默认值(C3) | dataclass 字段可访问是语言保证，不测行为 |
| T-001 C4/C9：给定具体输入 "a/b:c?d" → "a-b-c-d"，"中文" → 6/1024 | 原文只描述机制不给值 |
| T-002：所有 C 给定具体输入字符串和期望输出值 | 原文缺少具体输入 |
| T-003：移除所有内部路径引用（"走直接比较路径"、"normalize_whitespace 路径"） | 测实现细节而非行为 |
| T-003 C5：给定具体 merged chunk 输入和期望输出 True | 原文描述内部路径 |
| T-003 C8：改为明确断言返回值（子串重叠场景） | 原文"记录行为"不是 pass/fail |
| T-003 C11/C12：给定具体输入值，C12 也断言返回值 | 原文"记录实际返回值"不可测试 |
| T-004 C4：移除 [max_size * 0.5, max_size] 下限约束 | 源码不保证 0.5 下限，会误判 |
| T-004b：移除 _MAX_DEPTH、_force_truncate_protected 引用 | 私有实现细节 |
| T-004b：标题从"递归深度与 force truncate"改为"无有效切分点时的行为" | 不假设内部实现 |
| T-005 C9：改为断言 line_count == pre + cur + 2（而非 len(content.split)） | 后者是 Python 恒等式，不测合并行为 |
| T-005：移除 GBK 编码测试（原 C8） | chardet 检测结果不确定，测试不稳定 |
| T-008 C3：改为只包含"单元测试"和"集成测试"两个层级 | 原文用否定约束，不如明确列出 |
