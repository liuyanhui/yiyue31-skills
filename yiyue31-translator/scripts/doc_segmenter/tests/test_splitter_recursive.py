"""Unit tests for splitter.py recursive splitting behavior.

Tests behavior when no good split points exist (no blank lines or headings).
The splitter should fall back to forced truncation.
"""

import re

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


def _generate_continuous_text(target_kb):
    """Generate continuous text with no blank lines or headings.

    Creates text with single newlines (non-blank lines) but no blank lines
    (double newlines) or headings, forcing the splitter to use forced truncation.
    Each line is non-empty so the splitter finds no natural split points at
    blank lines, but the lines provide segments for force_truncate to work with.
    """
    target_bytes = int(target_kb * 1024)
    base = "ContinuousTextLineWithoutSplitPointsThatForcesRecursiveSplitting"
    lines = []
    current_bytes = 0
    while current_bytes < target_bytes:
        lines.append(base)
        current_bytes += len(base.encode("utf-8")) + 1  # +1 for newline
    return "\n".join(lines)


class TestContinuousTextSplitting:
    """Tests for splitting continuous text with no natural split points."""

    def test_large_continuous_text_splits(self):
        """C1: 80KB continuous text splits into multiple chunks, concat == original."""
        splitter = SectionSplitterImpl()
        content = _generate_continuous_text(80)
        section = _make_section("NoSplit", content)

        chunks, ops = splitter.split([section], max_size=40.0)

        assert len(chunks) > 1
        reconstructed = "".join(c.content for c in chunks)
        assert reconstructed == content

    def test_very_large_forces_oversized_chunk(self):
        """C2: 200KB truly continuous text (no newlines) produces oversized chunk.

        When no split points exist at all (single line, no newlines),
        recursion depth is exhausted and an oversized chunk is produced.
        """
        splitter = SectionSplitterImpl()
        # Generate text with no newlines at all - truly single line
        base = "X" * 70  # 70 bytes per repetition
        target_bytes = int(200 * 1024)
        content = base * (target_bytes // len(base) + 1)
        section = _make_section("VeryLarge", content)

        chunks, ops = splitter.split([section], max_size=40.0)

        # With no newlines at all, force_truncate can't split the single line
        # and recursion exhaustion produces an oversized chunk
        oversized = [c for c in chunks if c.size_kb > 40.0]
        assert len(oversized) >= 1

    def test_code_block_with_continuous_text(self):
        """C3: Code block + continuous text -> ``` markers paired in each chunk."""
        splitter = SectionSplitterImpl()
        code_block = "```py\ncode_here\n```"
        continuous = _generate_continuous_text(50)
        content = code_block + "\n" + continuous
        section = _make_section("CodeContinuous", content)

        chunks, ops = splitter.split([section], max_size=40.0)

        for chunk in chunks:
            backtick_count = chunk.content.count("```")
            if backtick_count > 0:
                assert backtick_count % 2 == 0

    def test_split_operation_recorded(self):
        """C4: SplitOperation detail contains pN( pattern."""
        splitter = SectionSplitterImpl()
        content = _generate_continuous_text(80)
        section = _make_section("ForceSplit", content)

        chunks, ops = splitter.split([section], max_size=40.0)

        assert len(ops) >= 1
        for op in ops:
            if op.operation == "split":
                assert re.search(r"p\d+\(", op.detail)
