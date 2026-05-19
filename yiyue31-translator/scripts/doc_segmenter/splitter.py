"""SectionSplitter implementation.

Splits large sections into chunks under max_size KB.
Handles protected boundaries (HTML tables, code blocks, pipe tables).
Recursion depth capped at 4, with forced truncation fallback.
"""

from __future__ import annotations

import re

from doc_segmenter.models import Chunk, Section, SplitOperation
from doc_segmenter.utils import calc_size_kb

# Target chunk size as fraction of max_size
_TARGET_RATIO = 0.75

# Maximum recursion depth for splitting
_MAX_DEPTH = 4

# Heading pattern for sub-headings
_HEADING_PATTERN = re.compile(r"^(#{1,6})\s+(.+)$", re.MULTILINE)


class SectionSplitterImpl:
    """Implementation of SectionSplitter protocol."""

    def split(
        self,
        sections: list[Section],
        max_size: float,
    ) -> tuple[list[Chunk], list[SplitOperation]]:
        """Split sections into chunks, all under max_size KB."""
        all_chunks: list[Chunk] = []
        all_operations: list[SplitOperation] = []

        for section in sections:
            if section.size_kb <= max_size:
                chunk = self._section_to_chunk(section)
                all_chunks.append(chunk)
            else:
                sub_chunks, ops = self._split_section(
                    section, max_size, depth=0
                )
                all_chunks.extend(sub_chunks)
                all_operations.extend(ops)

        return all_chunks, all_operations

    def _section_to_chunk(self, section: Section, suffix: str = "") -> Chunk:
        """Convert a Section to a Chunk."""
        lines = section.content.split("\n")
        return Chunk(
            source_section=section.title + suffix,
            level=section.level,
            content=section.content,
            size_kb=section.size_kb,
            line_count=len(lines),
            start_line=section.start_line,
            end_line=section.end_line,
        )

    def _split_section(
        self,
        section: Section,
        max_size: float,
        depth: int,
    ) -> tuple[list[Chunk], list[SplitOperation]]:
        """Recursively split a section into chunks under max_size."""
        target_size = max_size * _TARGET_RATIO
        operations: list[SplitOperation] = []
        chunks: list[Chunk] = []
        remaining_content = section.content
        part_num = 1
        offset = 0

        while remaining_content:
            current_size = calc_size_kb(remaining_content)
            if current_size <= max_size:
                chunk = self._make_chunk_from_content(
                    remaining_content,
                    section.title,
                    "-p{}".format(part_num),
                    section.level,
                    section.start_line + offset,
                )
                chunks.append(chunk)
                break

            # Try to find a split point respecting protected regions
            best_pos = self._find_best_split_point(
                remaining_content, max_size, target_size
            )

            if best_pos is not None and best_pos > 0:
                part_content = remaining_content[:best_pos]
                remaining_content = remaining_content[best_pos:]

                chunk = self._make_chunk_from_content(
                    part_content,
                    section.title,
                    "-p{}".format(part_num),
                    section.level,
                    section.start_line + offset,
                )
                chunks.append(chunk)
                offset += part_content.count("\n")
                part_num += 1
            else:
                # No valid split point found (content may be in protected region)
                # Force truncate with protected-region awareness
                force_chunks, force_ops = self._force_truncate_protected(
                    remaining_content,
                    section.title,
                    max_size,
                    section.level,
                    section.start_line + offset,
                    part_num,
                )
                chunks.extend(force_chunks)
                operations.extend(force_ops)
                remaining_content = ""
                break

        # Record split operation
        if chunks:
            detail_parts = []
            for i, c in enumerate(chunks):
                detail_parts.append("p{}({:.0f}KB)".format(i + 1, c.size_kb))
            detail = "{}KB -> {}".format(int(section.size_kb), " + ".join(detail_parts))
            operations.append(
                SplitOperation(operation="split", target=section.title, detail=detail)
            )

        # Check if any chunk is still over max_size and needs recursive splitting
        final_chunks: list[Chunk] = []
        for chunk in chunks:
            if chunk.size_kb > max_size and depth < _MAX_DEPTH:
                sub_section = Section(
                    level=chunk.level,
                    title=chunk.source_section,
                    content=chunk.content,
                    size_kb=chunk.size_kb,
                    start_line=chunk.start_line,
                    end_line=chunk.end_line,
                )
                sub_chunks, sub_ops = self._split_section(
                    sub_section, max_size, depth + 1
                )
                final_chunks.extend(sub_chunks)
                operations.extend(sub_ops)
            else:
                final_chunks.append(chunk)

        return final_chunks, operations

    def _find_best_split_point(
        self, content: str, max_size: float, target_size: float
    ) -> int | None:
        """Find the best split point in content.

        Returns a character position to split at, or None if no valid point.
        Split points are at blank lines or before headings, but never inside
        protected regions (HTML tables, code blocks, pipe tables).
        """
        lines = content.split("\n")
        protected = self._get_protected_ranges(lines)
        max_bytes = int(max_size * 1024)
        target_bytes = int(target_size * 1024)

        candidates: list[tuple[int, int]] = []

        char_pos = 0
        for i, line in enumerate(lines):
            next_char_pos = char_pos + len(line) + 1

            is_protected = self._is_in_protected(i, protected)

            if not is_protected:
                is_blank = line.strip() == ""
                is_heading = bool(_HEADING_PATTERN.match(line))

                if is_blank:
                    split_pos = next_char_pos
                    byte_count = len(content[:split_pos].encode("utf-8"))
                    if 0 < byte_count <= max_bytes:
                        distance = abs(byte_count - target_bytes)
                        candidates.append((split_pos, distance))

                elif is_heading and char_pos > 0:
                    split_pos = char_pos
                    byte_count = len(content[:split_pos].encode("utf-8"))
                    if 0 < byte_count <= max_bytes:
                        distance = abs(byte_count - target_bytes)
                        candidates.append((split_pos, distance))

            char_pos = next_char_pos

        if not candidates:
            return None

        candidates.sort(key=lambda x: x[1])
        return candidates[0][0]

    def _get_protected_ranges(self, lines: list[str]) -> list[tuple[int, int]]:
        """Identify ranges of line indices in protected regions."""
        ranges: list[tuple[int, int]] = []

        # HTML tables
        in_html_table = False
        start = -1
        for i, line in enumerate(lines):
            stripped = line.strip().lower()
            if "<table" in stripped:
                in_html_table = True
                start = i
            if "</table>" in stripped and in_html_table:
                ranges.append((start, i))
                in_html_table = False

        # Code blocks
        in_code = False
        start = -1
        for i, line in enumerate(lines):
            stripped = line.strip()
            if stripped.startswith("```"):
                if not in_code:
                    in_code = True
                    start = i
                else:
                    ranges.append((start, i))
                    in_code = False

        # Pipe tables
        i = 0
        while i < len(lines):
            stripped = lines[i].strip()
            if stripped.startswith("|") and stripped.endswith("|"):
                start = i
                while (
                    i < len(lines)
                    and lines[i].strip().startswith("|")
                    and lines[i].strip().endswith("|")
                ):
                    i += 1
                ranges.append((start, i - 1))
            else:
                i += 1

        return ranges

    def _is_in_protected(
        self, line_idx: int, protected: list[tuple[int, int]]
    ) -> bool:
        """Check if a line index is within a protected range."""
        for start, end in protected:
            if start <= line_idx <= end:
                return True
        return False

    def _force_truncate_protected(
        self,
        content: str,
        title: str,
        max_size: float,
        level: int,
        start_line: int,
        part_start: int,
    ) -> tuple[list[Chunk], list[SplitOperation]]:
        """Force truncate content while respecting protected regions.

        Uses character offsets into the original content string to preserve
        content integrity when concatenating chunks.
        Protected regions are kept intact even if they exceed max_size.
        """
        lines = content.split("\n")
        protected = self._get_protected_ranges(lines)
        max_bytes = int(max_size * 1024)

        # Build a list of line start offsets in the original content
        line_offsets: list[int] = [0]
        pos = 0
        for line in lines:
            pos += len(line) + 1  # +1 for the \n
            line_offsets.append(pos)
        # line_offsets[i] = start of line i; line_offsets[len(lines)] = end of content

        chunks: list[Chunk] = []
        operations: list[SplitOperation] = []
        part_num = part_start

        # Build segments: each segment is (start_char, end_char, is_protected)
        segments: list[tuple[int, int, bool]] = []
        i = 0
        while i < len(lines):
            prot = None
            for ps, pe in protected:
                if i == ps:
                    prot = (ps, pe)
                    break
            if prot is not None:
                # Protected segment from line prot[0] to line prot[1]
                start_char = line_offsets[prot[0]]
                end_char = line_offsets[prot[1] + 1]
                segments.append((start_char, end_char, True))
                i = prot[1] + 1
            else:
                # Non-protected: single line
                start_char = line_offsets[i]
                end_char = line_offsets[i + 1]
                segments.append((start_char, end_char, False))
                i += 1

        # Accumulate segments into chunks, keeping protected segments intact
        chunk_start = 0
        chunk_end = 0

        for seg_start, seg_end, is_prot in segments:
            seg_bytes = len(content[seg_start:seg_end].encode("utf-8"))
            current_bytes = len(content[chunk_start:chunk_end].encode("utf-8"))

            if chunk_end > chunk_start:
                combined_bytes = len(content[chunk_start:seg_end].encode("utf-8"))
                if combined_bytes <= max_bytes or is_prot:
                    # Extend current chunk
                    chunk_end = seg_end
                else:
                    # Flush current chunk
                    chunk_content = content[chunk_start:chunk_end]
                    chunk = self._make_chunk_from_content(
                        chunk_content,
                        title,
                        "-p{}".format(part_num),
                        level,
                        start_line + content[:chunk_start].count("\n"),
                    )
                    chunks.append(chunk)
                    part_num += 1
                    chunk_start = seg_start
                    chunk_end = seg_end
            else:
                chunk_start = seg_start
                chunk_end = seg_end

        # Flush remaining
        if chunk_end > chunk_start:
            chunk_content = content[chunk_start:chunk_end]
            chunk = self._make_chunk_from_content(
                chunk_content,
                title,
                "-p{}".format(part_num),
                level,
                start_line + content[:chunk_start].count("\n"),
            )
            chunks.append(chunk)

        # Record operation
        if chunks:
            detail_parts = []
            for i, c in enumerate(chunks):
                detail_parts.append("p{}({:.0f}KB)".format(part_start + i, c.size_kb))
            detail = " -> ".join(detail_parts)
            operations.append(
                SplitOperation(operation="split", target=title, detail=detail)
            )

        return chunks, operations

    def _make_chunk_from_content(
        self,
        content: str,
        title: str,
        suffix: str,
        level: int,
        start_line: int,
    ) -> Chunk:
        """Create a Chunk from content string."""
        lines = content.split("\n")
        end_line = start_line + len(lines) - 1 if lines else start_line
        return Chunk(
            source_section=title + suffix,
            level=level,
            content=content,
            size_kb=calc_size_kb(content),
            line_count=len(lines),
            start_line=start_line,
            end_line=end_line,
        )
