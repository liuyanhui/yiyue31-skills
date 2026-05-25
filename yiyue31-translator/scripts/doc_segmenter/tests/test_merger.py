"""Unit tests for merger.py.

Tests ChunkMergerImpl.merge() with various chunk configurations.
"""

import re

from doc_segmenter.merger import ChunkMergerImpl
from doc_segmenter.models import Chunk
from doc_segmenter.utils import calc_size_kb


def _make_chunk(
    source_section="Test",
    level=1,
    content="test content",
    size_kb=None,
    line_count=None,
):
    """Helper to create a Chunk for testing.

    If size_kb is None, it is computed from content.
    If line_count is None, it is computed from content.
    """
    if size_kb is None:
        size_kb = calc_size_kb(content)
    if line_count is None:
        line_count = content.count("\n") + (1 if content and not content.endswith("\n") else 0)
    return Chunk(
        source_section=source_section,
        level=level,
        content=content,
        size_kb=size_kb,
        line_count=line_count,
        start_line=0,
        end_line=line_count - 1 if line_count > 0 else 0,
    )


class TestEmptyInput:
    """Tests for empty chunk list."""

    def test_empty_chunks(self):
        """C1: merge([], max_size=40, min_size=10) returns ([], [])."""
        merger = ChunkMergerImpl()
        chunks, ops = merger.merge([], max_size=40.0, min_size=10.0)

        assert chunks == []
        assert ops == []


class TestSingleChunk:
    """Tests for single chunk input."""

    def test_single_chunk_unchanged(self):
        """C2: Single chunk is returned as-is with no operations."""
        merger = ChunkMergerImpl()
        chunk = _make_chunk(source_section="A", content="content")
        chunks, ops = merger.merge([chunk], max_size=40.0, min_size=10.0)

        assert len(chunks) == 1
        assert chunks[0].source_section == "A"
        assert ops == []


class TestSameLevelMerge:
    """Tests for merging chunks at the same heading level."""

    def test_two_small_chunks_merge(self):
        """C3: Two same-level small chunks (5KB each) merge when < min_size."""
        merger = ChunkMergerImpl()
        content_a = "a" * int(5 * 1024)  # ~5KB
        content_b = "b" * int(5 * 1024)  # ~5KB
        chunk_a = _make_chunk(source_section="A", content=content_a)
        chunk_b = _make_chunk(source_section="B", content=content_b)

        chunks, ops = merger.merge([chunk_a, chunk_b], max_size=40.0, min_size=10.0)

        assert len(chunks) == 1

    def test_two_medium_chunks_no_merge(self):
        """C4: Two chunks with combined > max_size are not merged."""
        merger = ChunkMergerImpl()
        content_a = "a" * int(10 * 1024)  # ~10KB
        content_b = "b" * int(10 * 1024)  # ~10KB
        chunk_a = _make_chunk(source_section="A", content=content_a)
        chunk_b = _make_chunk(source_section="B", content=content_b)

        chunks, ops = merger.merge([chunk_a, chunk_b], max_size=15.0, min_size=10.0)

        assert len(chunks) == 2

    def test_predecessor_big_current_small_merge(self):
        """C6: B.size_kb < min_size triggers merge even if A is not small."""
        merger = ChunkMergerImpl()
        content_a = "a" * int(10 * 1024)  # ~10KB
        content_b = "b" * int(5 * 1024)   # ~5KB
        chunk_a = _make_chunk(source_section="A", content=content_a)
        chunk_b = _make_chunk(source_section="B", content=content_b)

        chunks, ops = merger.merge([chunk_a, chunk_b], max_size=20.0, min_size=10.0)

        # B.size_kb(5) < min_size(10), merged_size(~15KB) <= max_size(20KB) -> merge
        assert len(chunks) == 1


class TestDifferentLevelNoMerge:
    """Tests for chunks at different levels that should not merge."""

    def test_different_levels_no_merge(self):
        """C5: Chunks at different levels are not merged."""
        merger = ChunkMergerImpl()
        content_a = "a" * int(5 * 1024)
        content_b = "b" * int(5 * 1024)
        chunk_a = _make_chunk(source_section="A", level=1, content=content_a)
        chunk_b = _make_chunk(source_section="B", level=2, content=content_b)

        chunks, ops = merger.merge([chunk_a, chunk_b], max_size=40.0, min_size=10.0)

        assert len(chunks) == 2


class TestMergedChunkProperties:
    """Tests for properties of merged chunks."""

    def test_merged_is_merged_flag(self):
        """C7: Merged chunk has is_merged=True and correct merged_sections."""
        merger = ChunkMergerImpl()
        content_a = "a" * int(5 * 1024)
        content_b = "b" * int(5 * 1024)
        chunk_a = _make_chunk(source_section="A", content=content_a)
        chunk_b = _make_chunk(source_section="B", content=content_b)

        chunks, ops = merger.merge([chunk_a, chunk_b], max_size=40.0, min_size=10.0)

        assert chunks[0].is_merged is True
        assert chunks[0].merged_sections == ["A", "B"]

    def test_merged_content_separator(self):
        """C8: Merged chunk content is predecessor + \\n\\n + current."""
        merger = ChunkMergerImpl()
        chunk_a = _make_chunk(source_section="A", content="content_A")
        chunk_b = _make_chunk(source_section="B", content="content_B")

        chunks, ops = merger.merge([chunk_a, chunk_b], max_size=40.0, min_size=10.0)

        assert len(chunks) == 1
        assert chunks[0].content == "content_A\n\ncontent_B"

    def test_merged_line_count(self):
        """C10: Merged line_count = predecessor.line_count + current.line_count + 2."""
        merger = ChunkMergerImpl()
        content_a = "a" * int(5 * 1024)
        content_b = "b" * int(5 * 1024)
        chunk_a = _make_chunk(source_section="A", content=content_a)
        chunk_b = _make_chunk(source_section="B", content=content_b)

        chunks, ops = merger.merge([chunk_a, chunk_b], max_size=40.0, min_size=10.0)

        expected_lc = chunk_a.line_count + chunk_b.line_count + 2
        assert chunks[0].line_count == expected_lc


class TestThreeChunkMerge:
    """Tests for merging three small chunks."""

    def test_three_small_chunks_merge(self):
        """C9: Three small same-level chunks merge into 1 chunk."""
        merger = ChunkMergerImpl()
        content_a = "a" * int(3 * 1024)
        content_b = "b" * int(3 * 1024)
        content_c = "c" * int(3 * 1024)
        chunk_a = _make_chunk(source_section="A", content=content_a)
        chunk_b = _make_chunk(source_section="B", content=content_b)
        chunk_c = _make_chunk(source_section="C", content=content_c)

        chunks, ops = merger.merge([chunk_a, chunk_b, chunk_c], max_size=40.0, min_size=10.0)

        assert len(chunks) == 1
        assert chunks[0].merged_sections == ["A", "B", "C"]
        assert chunks[0].source_section == "A + B + C"


class TestMergeOperation:
    """Tests for SplitOperation records from merging."""

    def test_merge_operation_format(self):
        """C11: SplitOperation detail matches 'NKB + NKB -> NKB' regex."""
        merger = ChunkMergerImpl()
        chunk_a = _make_chunk(source_section="A", content="content_A")
        chunk_b = _make_chunk(source_section="B", content="content_B")

        chunks, ops = merger.merge([chunk_a, chunk_b], max_size=40.0, min_size=10.0)

        assert len(ops) >= 1
        op = ops[0]
        assert op.operation == "merge"
        assert re.search(r"\d+KB \+ \d+KB -> \d+KB", op.detail)
