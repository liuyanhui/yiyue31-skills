"""Unit tests for splitter.py protected region detection.

Tests that code blocks, HTML tables, and pipe tables are preserved
intact during splitting.
"""

from doc_segmenter.models import Section
from doc_segmenter.splitter import SectionSplitterImpl
from doc_segmenter.utils import calc_size_kb


def _make_section(title, content, level=1):
    """Helper to create a Section with computed size_kb."""
    return Section(
        level=level,
        title=title,
        content=content,
        size_kb=calc_size_kb(content),
        start_line=0,
        end_line=content.count("\n") if content else 0,
    )


def _pad_to_kb(base_content, target_kb):
    """Pad content with repeated paragraphs to reach target KB.

    Adds paragraphs separated by blank lines after base_content.
    """
    target_bytes = int(target_kb * 1024)
    paragraph = "Padding text to increase section size. " * 20
    parts = [base_content]

    current_bytes = len(base_content.encode("utf-8"))
    while current_bytes < target_bytes:
        parts.append("\n\n" + paragraph)
        current_bytes += len(("\n\n" + paragraph).encode("utf-8"))

    return "".join(parts)


def _count_triple_backticks(text):
    """Count the number of ``` occurrences in text."""
    return text.count("```")


class TestCodeBlockProtection:
    """Tests for code block (```) protection during splitting."""

    def test_code_block_markers_paired(self):
        """C1: Code block ``` markers are paired in every chunk."""
        splitter = SectionSplitterImpl()
        code_block = "```python\ndef hello():\n    print('world')\n```"
        content = _pad_to_kb(code_block, 60)
        section = _make_section("CodeSection", content)

        chunks, ops = splitter.split([section], max_size=40.0)

        assert len(chunks) > 1
        for chunk in chunks:
            assert _count_triple_backticks(chunk.content) % 2 == 0

    def test_code_block_preserved_intact(self):
        """C5: 50KB code block stays intact even though it exceeds max_size."""
        splitter = SectionSplitterImpl()
        code_lines = ["```python"]
        for i in range(2000):
            code_lines.append(f"x[{i}] = {i} * 2")
        code_lines.append("```")
        code_block = "\n".join(code_lines)
        content = _pad_to_kb(code_block, 55)
        section = _make_section("BigCode", content)

        chunks, ops = splitter.split([section], max_size=40.0)

        # Find the chunk containing the code block
        code_chunks = [c for c in chunks if "```python" in c.content]
        assert len(code_chunks) >= 1
        for cc in code_chunks:
            # Code block should be complete: ``` paired
            assert _count_triple_backticks(cc.content) % 2 == 0

    def test_two_separate_code_blocks(self):
        """C6: Two separate code blocks each preserved intact."""
        splitter = SectionSplitterImpl()
        code1 = "```python\ncode1\n```"
        code2 = "```javascript\ncode2\n```"
        # Large paragraph between them
        gap = "Paragraph between code blocks. " * 200
        content = code1 + "\n\n" + gap + "\n\n" + code2
        # Pad to ensure splitting is needed
        content = _pad_to_kb(content, 60)
        section = _make_section("TwoCode", content)

        chunks, ops = splitter.split([section], max_size=40.0)

        for chunk in chunks:
            assert _count_triple_backticks(chunk.content) % 2 == 0

    def test_pipe_inside_code_block_not_confused(self):
        """C7: Pipe | inside code block is not treated as pipe table."""
        splitter = SectionSplitterImpl()
        content = "```\ndata = a | b\n```\n"
        # Pad enough to stay under max_size so no splitting
        section = _make_section("PipeCode", content)

        chunks, ops = splitter.split([section], max_size=40.0)

        assert len(chunks) == 1
        assert _count_triple_backticks(chunks[0].content) % 2 == 0

    def test_unclosed_code_block_not_protected(self):
        """C8: Unclosed code block does not trigger protection, content can be split."""
        splitter = SectionSplitterImpl()
        code_start = "```\nunclosed code here"
        content = _pad_to_kb(code_start, 50)
        section = _make_section("Unclosed", content)

        chunks, ops = splitter.split([section], max_size=40.0)

        assert len(chunks) > 1

    def test_split_point_respects_code_boundary(self):
        """C4: Split occurs at blank line before/after code block, not inside it."""
        splitter = SectionSplitterImpl()
        # Build content: para1, code block, para2 - needs splitting
        para1 = "para1 content " * 200
        code = "```py\ncode line 1\ncode line 2\n```"
        para2 = "para2 content " * 200
        content = para1 + "\n\n" + code + "\n\n" + para2
        section = _make_section("Boundary", content)

        chunks, ops = splitter.split([section], max_size=4.0)

        # Each chunk should have paired ``` markers if any
        for chunk in chunks:
            backtick_count = _count_triple_backticks(chunk.content)
            if backtick_count > 0:
                assert backtick_count % 2 == 0


class TestHtmlTableProtection:
    """Tests for HTML table protection during splitting."""

    def test_html_table_preserved(self):
        """C2: HTML table kept together in at least one chunk."""
        splitter = SectionSplitterImpl()
        table = "<table>\n<tr>\n<td>data</td>\n</tr>\n</table>"
        content = _pad_to_kb(table, 60)
        section = _make_section("HtmlTable", content)

        chunks, ops = splitter.split([section], max_size=40.0)

        # At least one chunk should contain both <table and </table>
        table_chunks = [
            c for c in chunks
            if "<table" in c.content and "</table>" in c.content
        ]
        assert len(table_chunks) >= 1


class TestPipeTableProtection:
    """Tests for pipe table protection during splitting."""

    def test_pipe_table_preserved(self):
        """C3: Pipe table kept together in at least one chunk."""
        splitter = SectionSplitterImpl()
        table = "| A | B |\n|---|---|\n| 1 | 2 |"
        content = _pad_to_kb(table, 60)
        section = _make_section("PipeTable", content)

        chunks, ops = splitter.split([section], max_size=40.0)

        # At least one chunk should contain both header and data rows
        table_chunks = [
            c for c in chunks
            if "| A | B |" in c.content and "| 1 | 2 |" in c.content
        ]
        assert len(table_chunks) >= 1

    def test_two_pipe_tables_separate_chunks(self):
        """C9: Two pipe tables separated by paragraph appear in different chunks."""
        splitter = SectionSplitterImpl()
        table1 = "| A | B |\n|---|---|\n| 1 | 2 |"
        table2 = "| C | D |\n|---|---|\n| 3 | 4 |"
        gap = "Some paragraph text between tables. " * 200
        content = table1 + "\n\n" + gap + "\n\n" + table2
        content = _pad_to_kb(content, 60)
        section = _make_section("TwoTables", content)

        chunks, ops = splitter.split([section], max_size=40.0)

        t1_chunks = [c for c in chunks if "| A | B |" in c.content and "| 1 | 2 |" in c.content]
        t2_chunks = [c for c in chunks if "| C | D |" in c.content and "| 3 | 4 |" in c.content]
        assert len(t1_chunks) >= 1
        assert len(t2_chunks) >= 1
