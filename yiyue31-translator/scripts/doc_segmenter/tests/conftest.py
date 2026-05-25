"""Shared fixtures and helper functions for doc_segmenter tests.

Provides reusable helpers for creating markdown files, Section objects,
SourceFileInfo objects, and other test infrastructure used across multiple
test modules.
"""

from __future__ import annotations

import pytest

from doc_segmenter.models import Section, SourceFileInfo
from doc_segmenter.utils import calc_size_kb


def _create_small_markdown(tmp_path, filename="small-test.md"):
    """Create a small markdown file (~5KB) that triggers short-circuit."""
    file_path = tmp_path / filename
    lines = ["# Small Test File", ""]
    for i in range(50):
        lines.append(f"## Section {i + 1}")
        lines.append("")
        lines.append(f"Paragraph content for section {i + 1}. " * 8)
        lines.append("")
    file_path.write_text("\n".join(lines), encoding="utf-8")
    return str(file_path)


def _create_large_markdown(tmp_path, filename="large-test.md"):
    """Create a large markdown file (~50KB) that goes through normal splitting."""
    file_path = tmp_path / filename
    lines = ["# Large Test File", ""]
    for i in range(8):
        lines.append(f"## Major Section {i + 1}")
        lines.append("")
        for j in range(10):
            lines.append(f"### Subsection {j + 1}")
            lines.append("")
            # ~700 bytes per subsection paragraph
            lines.append(f"Detailed content for subsection {j + 1} of section {i + 1}. " * 50)
            lines.append("")
    file_path.write_text("\n".join(lines), encoding="utf-8")
    return str(file_path)


def _create_boundary_markdown(tmp_path, target_kb=40, filename="boundary-test.md"):
    """Create a markdown file close to the max_size boundary."""
    file_path = tmp_path / filename
    lines = ["# Boundary Test File", ""]
    # Use fewer sections with more content per section to avoid long filenames
    # 4 sections x ~10KB each = ~40KB
    for i in range(4):
        lines.append(f"## Section {i + 1}")
        lines.append("")
        lines.append(f"Content for section {i + 1}. " * 350)
        lines.append("")
    file_path.write_text("\n".join(lines), encoding="utf-8")
    return str(file_path)


def make_section(content="hello\nworld", level=1, title="Test"):
    """Create a Section object with computed size_kb.

    Args:
        content: The section content string.
        level: Heading depth (1-6).
        title: The section title.

    Returns:
        A Section with start_line=0, end_line=1, and size_kb computed from content.
    """
    return Section(
        level=level,
        title=title,
        content=content,
        size_kb=calc_size_kb(content),
        start_line=0,
        end_line=1,
    )


def make_source_info(file_path="/tmp/f.md", file_lines=10, file_chars=100):
    """Create a SourceFileInfo object with defaults.

    Args:
        file_path: Path to the source file.
        file_lines: Number of lines in the file.
        file_chars: Number of characters in the file.

    Returns:
        A SourceFileInfo with file_size=0.0 and file_encoding="utf-8".
    """
    return SourceFileInfo(
        file_path=file_path,
        file_size=0.0,
        file_lines=file_lines,
        file_chars=file_chars,
        file_encoding="utf-8",
    )


def create_markdown(lines, tmp_path, filename):
    """Write lines as a markdown file and return the path string.

    Args:
        lines: List of strings to join with newline.
        tmp_path: pathlib.Path directory to write into.
        filename: Name of the file to create.

    Returns:
        The file path as a string.
    """
    file_path = tmp_path / filename
    file_path.write_text("\n".join(lines), encoding="utf-8")
    return str(file_path)
