"""SectionParser implementation.

Parses Markdown content into a list of Section objects based on headings.
Uses character offsets to preserve exact content (no lossy split/join).
"""

from __future__ import annotations

import re

from doc_segmenter.models import Section
from doc_segmenter.utils import calc_size_kb

# Markdown heading pattern: 1-6 hash chars followed by space and heading text
_HEADING_PATTERN = re.compile(r"^(#{1,6})\s+(.+)$", re.MULTILINE)


class SectionParserImpl:
    """Implementation of SectionParser protocol."""

    def parse(self, content: str, file_encoding: str) -> list[Section]:
        """Parse raw content into sections based on Markdown headings.

        Args:
            content: The full file content as a string.
            file_encoding: The encoding of the source file.

        Returns:
            A list of Section objects, one per heading found.
        """
        if not content:
            # Empty content -> single empty section
            return [
                Section(
                    level=0,
                    title="root",
                    content="",
                    size_kb=0.0,
                    start_line=0,
                    end_line=0,
                )
            ]

        lines = content.split("\n")

        # Build character offset map for each line start
        line_offsets: list[int] = [0]
        pos = 0
        for line in lines:
            pos += len(line) + 1  # +1 for the \n
            line_offsets.append(pos)
        # line_offsets[i] = character offset of line i start
        # line_offsets[len(lines)] = len(content)

        # Find all heading positions
        heading_positions: list[tuple[int, int, str]] = []  # (line_idx, level, title)
        for i, line in enumerate(lines):
            match = _HEADING_PATTERN.match(line)
            if match:
                level = len(match.group(1))
                title = match.group(2).strip()
                heading_positions.append((i, level, title))

        if not heading_positions:
            # No headings -> single root section
            size_kb = calc_size_kb(content)
            return [
                Section(
                    level=0,
                    title="root",
                    content=content,
                    size_kb=size_kb,
                    start_line=0,
                    end_line=len(lines) - 1 if lines else 0,
                )
            ]

        # Build sections from heading positions using character offsets
        sections: list[Section] = []
        for idx, (line_idx, level, title) in enumerate(heading_positions):
            # Section starts at this heading line's character offset
            start_char = line_offsets[line_idx]
            start_line = line_idx

            # Section ends at the character before the next heading line
            if idx + 1 < len(heading_positions):
                next_line_idx = heading_positions[idx + 1][0]
                end_char = line_offsets[next_line_idx]
                end_line = next_line_idx - 1
            else:
                end_char = len(content)
                end_line = len(lines) - 1

            # Extract section content directly from the string
            section_content = content[start_char:end_char]
            size_kb = calc_size_kb(section_content)

            sections.append(
                Section(
                    level=level,
                    title=title,
                    content=section_content,
                    size_kb=size_kb,
                    start_line=start_line,
                    end_line=end_line,
                )
            )

        return sections
