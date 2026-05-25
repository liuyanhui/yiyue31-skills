"""Unit tests for parser.py.

Tests SectionParserImpl.parse() with various inputs: empty, plain text,
headings, preamble, Chinese text, line numbers, and multi-heading edge cases.
"""

from doc_segmenter.parser import SectionParserImpl
from doc_segmenter.utils import calc_size_kb


class TestParseEmpty:
    """Tests for parsing empty content."""

    def test_empty_returns_single_root_section(self):
        """parse('', 'utf-8') returns single root section with empty content."""
        parser = SectionParserImpl()
        result = parser.parse("", "utf-8")

        assert len(result) == 1
        assert result[0].level == 0
        assert result[0].title == "root"
        assert result[0].content == ""
        assert result[0].size_kb == 0.0
        assert result[0].start_line == 0
        assert result[0].end_line == 0


class TestParsePlainText:
    """Tests for parsing content without any headings."""

    def test_plain_text_returns_root_section(self):
        """parse('hello world', 'utf-8') returns root section with full content."""
        parser = SectionParserImpl()
        content = "hello world"
        result = parser.parse(content, "utf-8")

        assert len(result) == 1
        assert result[0].level == 0
        assert result[0].title == "root"
        assert result[0].content == "hello world"
        assert abs(result[0].size_kb - calc_size_kb("hello world")) < 0.001
        assert result[0].start_line == 0
        assert result[0].end_line == 0


class TestParseSingleHeading:
    """Tests for parsing content with a single heading."""

    def test_single_heading(self):
        """parse('# Title\nbody', 'utf-8') returns one section with level=1."""
        parser = SectionParserImpl()
        result = parser.parse("# Title\nbody", "utf-8")

        assert len(result) == 1
        assert result[0].level == 1
        assert result[0].title == "Title"
        assert result[0].content == "# Title\nbody"


class TestParseMultipleHeadings:
    """Tests for parsing content with multiple heading levels."""

    def test_three_heading_levels(self):
        """parse with # A, ## B, ### C returns 3 sections with correct levels/titles."""
        parser = SectionParserImpl()
        content = "# A\na\n\n## B\nb\n\n### C\nc"
        result = parser.parse(content, "utf-8")

        assert len(result) == 3
        assert [s.level for s in result] == [1, 2, 3]
        assert [s.title for s in result] == ["A", "B", "C"]

    def test_content_concatenation(self):
        """Concatenating all section content reproduces the original."""
        parser = SectionParserImpl()
        content = "# A\na\n\n## B\nb\n\n### C\nc"
        result = parser.parse(content, "utf-8")

        reconstructed = "".join(s.content for s in result)
        assert reconstructed == content

    def test_line_numbers(self):
        """Sections have correct start_line and end_line values."""
        parser = SectionParserImpl()
        content = "# A\na\n\n## B\nb\n\n### C\nc"
        result = parser.parse(content, "utf-8")

        assert result[0].start_line == 0
        assert result[0].end_line == 2
        assert result[1].start_line == 3
        assert result[1].end_line == 5
        assert result[2].start_line == 6
        assert result[2].end_line == 7


class TestParsePreamble:
    """Tests for parsing content with text before the first heading."""

    def test_preamble_section(self):
        """Content before first heading becomes a preamble section."""
        parser = SectionParserImpl()
        content = "intro\n\n# Title\nbody"
        result = parser.parse(content, "utf-8")

        assert len(result) == 2
        assert result[0].level == 0
        assert result[0].title == "preamble"
        assert result[0].content == "intro\n\n"
        assert result[1].level == 1
        assert result[1].title == "Title"


class TestParseChinese:
    """Tests for parsing Chinese content."""

    def test_chinese_heading(self):
        """Chinese heading title is preserved correctly."""
        parser = SectionParserImpl()
        result = parser.parse("# 中文标题\n内容", "utf-8")

        assert result[0].title == "中文标题"


class TestParseConsecutiveHeadings:
    """Tests for parsing consecutive headings with no body content."""

    def test_three_consecutive_headings(self):
        """Consecutive # headings each become their own section."""
        parser = SectionParserImpl()
        content = "# A\n# B\n# C"
        result = parser.parse(content, "utf-8")

        assert len(result) == 3
        assert result[0].content == "# A\n"
        assert result[1].content == "# B\n"
        assert result[2].content == "# C"
