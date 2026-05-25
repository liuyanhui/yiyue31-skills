"""Unit tests for utils.py.

Tests sanitize_filename and calc_size_kb.
"""

from doc_segmenter.utils import calc_size_kb, sanitize_filename


class TestSanitizeFilename:
    """Tests for sanitize_filename function."""

    def test_multiple_unsafe_chars(self):
        """sanitize_filename replaces /, :, ?, * with dashes."""
        result = sanitize_filename("a/b:c?d")
        # / : ? are all unsafe -> replaced with -
        assert result == "a-b-c-d"

    def test_consecutive_unsafe_chars_collapsed(self):
        """sanitize_filename collapses consecutive dashes into one."""
        result = sanitize_filename("a///b")
        # /// -> --- -> collapsed to -
        assert result == "a-b"

    def test_empty_string(self):
        """sanitize_filename returns empty string for empty input."""
        assert sanitize_filename("") == ""

    def test_backslash_replaced(self):
        r"""sanitize_filename replaces backslash with dash."""
        result = sanitize_filename("a\\b")
        assert result == "a-b"

    def test_asterisk_replaced(self):
        """sanitize_filename replaces * with dash."""
        result = sanitize_filename("a*b")
        assert result == "a-b"

    def test_pipe_replaced(self):
        """sanitize_filename replaces | with dash."""
        result = sanitize_filename("a|b")
        assert result == "a-b"

    def test_angle_brackets_replaced(self):
        """sanitize_filename replaces < > with dash."""
        result = sanitize_filename("a<b>c")
        assert result == "a-b-c"

    def test_double_quote_replaced(self):
        """sanitize_filename replaces double quote with dash."""
        result = sanitize_filename('a"b')
        assert result == "a-b"

    def test_no_unsafe_chars(self):
        """sanitize_filename preserves safe characters."""
        result = sanitize_filename("hello-world_123.txt")
        assert result == "hello-world_123.txt"


class TestCalcSizeKb:
    """Tests for calc_size_kb function."""

    def test_ascii_string(self):
        """calc_size_kb returns correct KB for ASCII string."""
        content = "abc"
        expected = len(content.encode("utf-8")) / 1024
        result = calc_size_kb(content)
        assert abs(result - expected) <= 0.001

    def test_empty_string(self):
        """calc_size_kb returns 0.0 for empty string."""
        assert calc_size_kb("") == 0.0

    def test_chinese_text(self):
        """calc_size_kb returns correct KB for Chinese text (3 bytes per char in UTF-8)."""
        content = "中文"
        expected = 6 / 1024  # 2 Chinese chars * 3 bytes = 6 bytes
        result = calc_size_kb(content)
        assert abs(result - expected) <= 0.001

    def test_mixed_content(self):
        """calc_size_kb handles mixed ASCII and Chinese content."""
        content = "abc中文"
        expected = len(content.encode("utf-8")) / 1024
        result = calc_size_kb(content)
        assert abs(result - expected) <= 0.001
