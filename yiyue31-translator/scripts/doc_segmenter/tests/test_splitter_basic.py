"""Unit tests for splitter.py basic splitting logic.

Tests splitting of plain text paragraphs without code blocks or tables.
"""

import re

from doc_segmenter.models import Section, SplitOperation
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


def _generate_paragraph_content(target_kb, paragraph_sep="\n\n"):
    """Generate plain text content of approximately target_kb KB.

    Uses short paragraphs separated by blank lines to create natural
    split points.
    """
    target_bytes = int(target_kb * 1024)
    paragraph = "This is a test paragraph with some words for splitting tests. " * 5
    result_parts = []
    current_bytes = 0

    while current_bytes < target_bytes:
        result_parts.append(paragraph)
        current_bytes += len(paragraph.encode("utf-8"))

    return paragraph_sep.join(result_parts)


class TestSmallSection:
    """Tests for sections that fit within max_size."""

    def test_small_section_single_chunk(self):
        """C1: Section under max_size produces 1 chunk, no operations."""
        splitter = SectionSplitterImpl()
        content = "small content"
        section = _make_section("Small", content)

        chunks, ops = splitter.split([section], max_size=40.0)

        assert len(chunks) == 1
        assert chunks[0].content == content
        assert ops == []


class TestLargeSectionSplitting:
    """Tests for sections that exceed max_size."""

    def test_all_chunks_within_max_size(self):
        """C2: Large section split produces chunks all <= max_size."""
        splitter = SectionSplitterImpl()
        content = _generate_paragraph_content(100)
        section = _make_section("Big", content)

        chunks, ops = splitter.split([section], max_size=40.0)

        for chunk in chunks:
            assert chunk.size_kb <= 40.0 + 0.1  # small tolerance for rounding

    def test_concatenation_equals_original(self):
        """C5: Concatenated chunk content equals original section content."""
        splitter = SectionSplitterImpl()
        content = _generate_paragraph_content(100)
        section = _make_section("Big", content)

        chunks, ops = splitter.split([section], max_size=40.0)

        reconstructed = "".join(c.content for c in chunks)
        assert reconstructed == content


class TestExactSplitPoints:
    """Tests for splitting at specific content boundaries."""

    def test_two_paragraphs_split(self):
        """C3: Two paragraphs split at blank line boundary."""
        splitter = SectionSplitterImpl()
        content = "para1 line1\npara1 line2\n\npara2 line1\npara2 line2"
        section = _make_section("Test", content)

        chunks, ops = splitter.split([section], max_size=0.025)

        assert len(chunks) == 2
        assert chunks[0].content == "para1 line1\npara1 line2\n\n"
        assert chunks[1].content == "para2 line1\npara2 line2"


class TestChunkNaming:
    """Tests for chunk source_section naming."""

    def test_split_section_naming(self):
        """C6: Split section gets -p1, -p2, -p3 suffixes."""
        splitter = SectionSplitterImpl()
        content = _generate_paragraph_content(100)
        section = _make_section("Intro", content)

        chunks, ops = splitter.split([section], max_size=40.0)

        assert len(chunks) >= 2
        for i, chunk in enumerate(chunks):
            assert chunk.source_section == "Intro-p{}".format(i + 1)

    def test_unsplit_section_naming(self):
        """C6: Unsplit section keeps original title as source_section."""
        splitter = SectionSplitterImpl()
        section = _make_section("Small", "small content")

        chunks, ops = splitter.split([section], max_size=40.0)

        assert len(chunks) == 1
        assert chunks[0].source_section == "Small"


class TestSplitOperation:
    """Tests for SplitOperation records."""

    def test_split_operation_format(self):
        """C7: SplitOperation has correct format with detail matching regex."""
        splitter = SectionSplitterImpl()
        content = _generate_paragraph_content(100)
        section = _make_section("MySection", content)

        chunks, ops = splitter.split([section], max_size=40.0)

        assert len(ops) >= 1
        op = ops[0]
        assert op.operation == "split"
        assert op.target == "MySection"
        # Detail should match pattern like "100KB -> p1(XXKB) + p2(XXKB)"
        assert re.search(r"\d+KB -> p1\(\d+KB\)", op.detail) or "p1(" in op.detail


class TestMultipleSections:
    """Tests for splitting multiple sections independently."""

    def test_two_sections_independent_splitting(self):
        """C8: Two sections (A=5KB, B=80KB) -> A gets 1 chunk, B split independently."""
        splitter = SectionSplitterImpl()
        small_content = _generate_paragraph_content(5)
        large_content = _generate_paragraph_content(80)

        section_a = _make_section("A", small_content)
        section_b = _make_section("B", large_content)

        chunks, ops = splitter.split([section_a, section_b], max_size=40.0)

        # Count chunks from each section
        a_chunks = [c for c in chunks if c.source_section.startswith("A")]
        b_chunks = [c for c in chunks if c.source_section.startswith("B")]

        assert len(a_chunks) == 1
        assert len(b_chunks) > 1

    def test_chunks_within_max_size(self):
        """C4: All chunks from large section are <= max_size."""
        splitter = SectionSplitterImpl()
        content = _generate_paragraph_content(100)
        section = _make_section("Big", content)

        chunks, ops = splitter.split([section], max_size=40.0)

        for chunk in chunks:
            assert chunk.size_kb <= 40.0 + 0.1
