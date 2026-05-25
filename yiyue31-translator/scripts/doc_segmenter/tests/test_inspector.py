"""Unit tests for inspector.py.

Tests FileInspectorImpl.inspect() with various file conditions:
nonexistent files, oversized files, encoding detection, line counting.
"""

import os

import pytest

from doc_segmenter.inspector import FileInspectorImpl
from doc_segmenter.models import SplitError


@pytest.fixture
def inspector():
    """Create FileInspectorImpl instance for testing."""
    return FileInspectorImpl()


class TestFileNotFound:
    """Tests for nonexistent file handling."""

    def test_nonexistent_file_raises_split_error_1(self, inspector):
        """C1: inspect('/nonexistent/file.md') raises SplitError with exit_code=1."""
        with pytest.raises(SplitError) as exc_info:
            inspector.inspect("/nonexistent/file.md")

        assert exc_info.value.exit_code == 1


class TestOversizedFile:
    """Tests for files exceeding the 5MB limit."""

    def test_oversized_file_raises_split_error_2(self, inspector, tmp_path):
        """C2: File larger than 5MB raises SplitError with exit_code=2."""
        # Create a file that is 5MB + 1 byte
        big_file = tmp_path / "big.md"
        # Write 5MB + 1 byte
        size = 5 * 1024 * 1024 + 1
        with open(big_file, "wb") as f:
            f.write(b"x" * size)

        with pytest.raises(SplitError) as exc_info:
            inspector.inspect(str(big_file))

        assert exc_info.value.exit_code == 2


class TestNormalFileInspection:
    """Tests for normal file inspection."""

    def test_utf8_file_metadata(self, inspector, tmp_path):
        """C3: UTF-8 file with '# Hello\\nWorld' returns correct SourceFileInfo."""
        file_path = tmp_path / "test.md"
        content = "# Hello\nWorld"
        file_path.write_text(content, encoding="utf-8")

        result = inspector.inspect(str(file_path))

        assert result.file_path == str(file_path)
        assert abs(result.file_size - os.path.getsize(str(file_path)) / 1024.0) < 0.001
        assert result.file_lines == 2
        assert result.file_chars == len(content)
        assert result.file_encoding == "utf-8"

    def test_crlf_normalization(self, inspector, tmp_path):
        """C4: File with \\r\\n line endings -> file_size > len(content)/1024.

        The file_size is based on disk bytes (which include \\r),
        while content has \\r\\n normalized to \\n.
        """
        file_path = tmp_path / "crlf.md"
        raw = b"line1\r\nline2"
        with open(file_path, "wb") as f:
            f.write(raw)

        result = inspector.inspect(str(file_path))

        # disk size includes \r characters
        content_size_kb = len("# Hello\nWorld".replace("# Hello\nWorld", "line1\nline2")) / 1024
        # file_size (disk) > content size (after \r\n -> \n normalization)
        assert result.file_size > len("line1\nline2") / 1024

    def test_no_trailing_newline(self, inspector, tmp_path):
        """C5: File without trailing newline still counts correct lines."""
        file_path = tmp_path / "noeol.md"
        content = "line1\nline2"
        file_path.write_text(content, encoding="utf-8")

        result = inspector.inspect(str(file_path))

        assert result.file_lines == 2

    def test_bom_detection(self, inspector, tmp_path):
        """C6: File with UTF-8 BOM is detected as utf-8 encoding."""
        file_path = tmp_path / "bom.md"
        with open(file_path, "wb") as f:
            f.write(b"\xef\xbb\xbf# Hello")

        result = inspector.inspect(str(file_path))

        assert result.file_encoding == "utf-8"

    def test_empty_file(self, inspector, tmp_path):
        """C7: Zero-byte file returns file_lines=0, file_chars=0, file_size=0.0."""
        file_path = tmp_path / "empty.md"
        file_path.write_bytes(b"")

        result = inspector.inspect(str(file_path))

        assert result.file_lines == 0
        assert result.file_chars == 0
        assert result.file_size == 0.0
