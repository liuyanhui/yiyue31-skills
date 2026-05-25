"""Unit tests for checker.py.

Tests all 4 integrity checks: line_count, content_concat, no_duplicates,
first_last_line.  Covers merged chunks, edge cases, and empty inputs.
"""

from doc_segmenter.checker import IntegrityCheckerImpl
from doc_segmenter.models import Chunk, SourceFileInfo


def _make_chunk(
    content="test",
    source_section="Test",
    level=1,
    is_merged=False,
    merged_sections=None,
):
    """Helper to create a Chunk for testing."""
    if merged_sections is None:
        merged_sections = [] if not is_merged else [source_section]
    return Chunk(
        source_section=source_section,
        level=level,
        content=content,
        size_kb=len(content.encode("utf-8")) / 1024,
        line_count=content.count("\n") + (1 if content and not content.endswith("\n") else 0),
        start_line=0,
        end_line=content.count("\n") if content else 0,
        is_merged=is_merged,
        merged_sections=merged_sections,
    )


def _make_source_info(file_lines=1):
    """Helper to create a SourceFileInfo for testing."""
    return SourceFileInfo(
        file_path="/tmp/test.md",
        file_size=0.0,
        file_lines=file_lines,
        file_chars=0,
        file_encoding="utf-8",
    )


class TestLineCountCheck:
    """Tests for the line_count integrity check."""

    def test_correct_line_count(self):
        """C1: Single chunk with 3 lines, file_lines=3 -> line_count passes."""
        checker = IntegrityCheckerImpl()
        chunks = [_make_chunk(content="a\nb\nc")]
        source_info = _make_source_info(file_lines=3)

        result = checker.check(chunks, "a\nb\nc", source_info)
        assert result["line_count"] is True

    def test_incorrect_line_count(self):
        """C2: Single chunk with 3 lines, file_lines=5 -> line_count fails."""
        checker = IntegrityCheckerImpl()
        chunks = [_make_chunk(content="a\nb\nc")]
        source_info = _make_source_info(file_lines=5)

        result = checker.check(chunks, "a\nb\nc", source_info)
        assert result["line_count"] is False

    def test_merged_line_count_adjusted(self):
        """C11: Merged chunk line count adjusted for merge separators.

        merged_sections=["A","B"], content="a\nb\n\nc\nd" -> 4 newlines
        content does NOT end with \n -> total_lines = 4+1 = 5
        merge_separator_lines = (2-1)*2 = 2
        adjusted = 5 - 2 = 3 == file_lines(3) -> True
        """
        checker = IntegrityCheckerImpl()
        chunk = _make_chunk(
            content="a\nb\n\nc\nd",
            is_merged=True,
            merged_sections=["A", "B"],
        )
        chunks = [chunk]
        source_info = _make_source_info(file_lines=3)

        result = checker.check(chunks, "a\nb\n\nc\nd", source_info)
        assert result["line_count"] is True

    def test_merged_line_count_trailing_newline(self):
        """C12: Merged chunk with trailing newline, wrong file_lines -> fails.

        merged_sections=["A","B"], content="a\nb\n\nc\nd\n" -> 5 newlines
        content ends with \n -> total_lines = 5
        merge_separator_lines = (2-1)*2 = 2
        adjusted = 5 - 2 = 3 != file_lines(4) -> False
        """
        checker = IntegrityCheckerImpl()
        chunk = _make_chunk(
            content="a\nb\n\nc\nd\n",
            is_merged=True,
            merged_sections=["A", "B"],
        )
        chunks = [chunk]
        source_info = _make_source_info(file_lines=4)

        result = checker.check(chunks, "a\nb\n\nc\nd\n", source_info)
        assert result["line_count"] is False


class TestContentConcatCheck:
    """Tests for the content_concat integrity check."""

    def test_concat_matches_original(self):
        """C3: Two chunks concatenated match original."""
        checker = IntegrityCheckerImpl()
        chunks = [_make_chunk(content="abc"), _make_chunk(content="def")]
        source_info = _make_source_info()

        result = checker.check(chunks, "abcdef", source_info)
        assert result["content_concat"] is True

    def test_concat_does_not_match(self):
        """C4: Two chunks concatenated do not match original."""
        checker = IntegrityCheckerImpl()
        chunks = [_make_chunk(content="abc"), _make_chunk(content="def")]
        source_info = _make_source_info()

        result = checker.check(chunks, "abcXYZ", source_info)
        assert result["content_concat"] is False

    def test_merged_content_normalized(self):
        """C5: Merged chunk with \\n\\n separator, original without -> passes via normalization.

        chunk content="A\n\nB" (from merging "A" and "B" with \n\n separator)
        original="A\nB" (no extra newline)
        After whitespace normalization, both become "A\nB" -> True
        """
        checker = IntegrityCheckerImpl()
        chunk = _make_chunk(
            content="A\n\nB",
            is_merged=True,
            merged_sections=["A", "B"],
        )
        chunks = [chunk]
        source_info = _make_source_info()

        result = checker.check(chunks, "A\nB", source_info)
        assert result["content_concat"] is True


class TestNoDuplicatesCheck:
    """Tests for the no_duplicates integrity check."""

    def test_no_duplicates(self):
        """C6: Two different chunks -> no_duplicates passes."""
        checker = IntegrityCheckerImpl()
        chunks = [_make_chunk(content="abc"), _make_chunk(content="def")]

        result = checker.check(chunks, "abcdef", _make_source_info())
        assert result["no_duplicates"] is True

    def test_duplicate_content(self):
        """C7: Two chunks with identical content -> no_duplicates fails."""
        checker = IntegrityCheckerImpl()
        chunks = [_make_chunk(content="abc"), _make_chunk(content="abc")]

        result = checker.check(chunks, "abcabc", _make_source_info())
        assert result["no_duplicates"] is False

    def test_substring_overlap(self):
        """C8: Chunk content 'a' is substring of 'xa', full_text='axa' count('a')==2 -> fails."""
        checker = IntegrityCheckerImpl()
        chunks = [_make_chunk(content="a"), _make_chunk(content="xa")]

        result = checker.check(chunks, "axa", _make_source_info())
        assert result["no_duplicates"] is False


class TestFirstLastLineCheck:
    """Tests for the first_last_line integrity check."""

    def test_matching_first_last(self):
        """C9: Single chunk with matching first/last lines -> passes."""
        checker = IntegrityCheckerImpl()
        chunks = [_make_chunk(content="first\nmiddle\nlast")]
        source_info = _make_source_info()

        result = checker.check(chunks, "first\nmiddle\nlast", source_info)
        assert result["first_last_line"] is True

    def test_mismatching_first_line(self):
        """C10: Single chunk with wrong first line -> fails."""
        checker = IntegrityCheckerImpl()
        chunks = [_make_chunk(content="XXX\nmiddle\nlast")]
        source_info = _make_source_info()

        result = checker.check(chunks, "first\nmiddle\nlast", source_info)
        assert result["first_last_line"] is False


class TestEmptyInputCheck:
    """Tests for edge case of empty chunks and empty original."""

    def test_empty_chunks_and_original(self):
        """C13: Empty chunks and empty original -> first_last_line=True, line_count=True when file_lines=0."""
        checker = IntegrityCheckerImpl()
        chunks = []
        source_info = _make_source_info(file_lines=0)

        result = checker.check(chunks, "", source_info)
        assert result["first_last_line"] is True
        assert result["line_count"] is True
