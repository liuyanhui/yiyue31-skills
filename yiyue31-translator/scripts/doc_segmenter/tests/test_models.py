"""Unit tests for models.py.

Tests SplitError, Chunk defaults, SplitContext defaults.
"""

from doc_segmenter.models import (
    Chunk,
    SourceFileInfo,
    SplitContext,
    SplitError,
)


class TestSplitError:
    """Tests for SplitError exception class."""

    def test_exit_code_1(self):
        """SplitError with exit_code=1 stores the code correctly."""
        err = SplitError("file not found", exit_code=1)
        assert err.exit_code == 1
        assert str(err) == "file not found"

    def test_exit_code_2(self):
        """SplitError with exit_code=2 stores the code correctly."""
        err = SplitError("file too large", exit_code=2)
        assert err.exit_code == 2

    def test_exit_code_3(self):
        """SplitError with exit_code=3 stores the code correctly."""
        err = SplitError("validation failed", exit_code=3)
        assert err.exit_code == 3

    def test_is_exception(self):
        """SplitError is a proper Exception subclass."""
        err = SplitError("msg", exit_code=1)
        assert isinstance(err, Exception)
        with raises_exception(SplitError):
            raise err


class TestChunkDefaults:
    """Tests for Chunk dataclass default values."""

    def test_is_merged_default(self):
        """Chunk.is_merged defaults to False."""
        chunk = Chunk(
            source_section="Test",
            level=1,
            content="x",
            size_kb=0.001,
            line_count=1,
            start_line=0,
            end_line=0,
        )
        assert chunk.is_merged is False

    def test_merged_sections_default(self):
        """Chunk.merged_sections defaults to empty list."""
        chunk = Chunk(
            source_section="Test",
            level=1,
            content="x",
            size_kb=0.001,
            line_count=1,
            start_line=0,
            end_line=0,
        )
        assert chunk.merged_sections == []

    def test_estimated_tokens_default(self):
        """Chunk.estimated_tokens defaults to 0."""
        chunk = Chunk(
            source_section="Test",
            level=1,
            content="x",
            size_kb=0.001,
            line_count=1,
            start_line=0,
            end_line=0,
        )
        assert chunk.estimated_tokens == 0


class TestSplitContextDefaults:
    """Tests for SplitContext dataclass default values."""

    def test_sections_default(self):
        """SplitContext.sections defaults to empty list."""
        ctx = SplitContext(
            source_info=SourceFileInfo(
                file_path="f", file_size=1.0, file_lines=1, file_chars=1
            )
        )
        assert ctx.sections == []

    def test_chunks_default(self):
        """SplitContext.chunks defaults to empty list."""
        ctx = SplitContext(
            source_info=SourceFileInfo(
                file_path="f", file_size=1.0, file_lines=1, file_chars=1
            )
        )
        assert ctx.chunks == []

    def test_operations_default(self):
        """SplitContext.operations defaults to empty list."""
        ctx = SplitContext(
            source_info=SourceFileInfo(
                file_path="f", file_size=1.0, file_lines=1, file_chars=1
            )
        )
        assert ctx.operations == []

    def test_validation_results_default(self):
        """SplitContext.validation_results defaults to empty dict."""
        ctx = SplitContext(
            source_info=SourceFileInfo(
                file_path="f", file_size=1.0, file_lines=1, file_chars=1
            )
        )
        assert ctx.validation_results == {}

    def test_output_dir_default(self):
        """SplitContext.output_dir defaults to empty string."""
        ctx = SplitContext(
            source_info=SourceFileInfo(
                file_path="f", file_size=1.0, file_lines=1, file_chars=1
            )
        )
        assert ctx.output_dir == ""


class TestSplitErrorMinimalChunk:
    """Test Chunk with minimal content="x" per task criteria C2."""

    def test_chunk_content_x_defaults(self):
        """Chunk(content="x") has is_merged=False, merged_sections=[], estimated_tokens=0."""
        chunk = Chunk(
            source_section="S",
            level=1,
            content="x",
            size_kb=0.001,
            line_count=1,
            start_line=0,
            end_line=0,
        )
        assert chunk.is_merged is False
        assert chunk.merged_sections == []
        assert chunk.estimated_tokens == 0


# Helper for exception testing
class raises_exception:
    """Context manager to assert an exception type is raised."""

    def __init__(self, exc_type):
        self.exc_type = exc_type

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type is None:
            raise AssertionError(f"Expected {self.exc_type.__name__} but no exception was raised")
        if not issubclass(exc_type, self.exc_type):
            return False
        return True
