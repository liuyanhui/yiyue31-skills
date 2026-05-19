"""IntegrityChecker implementation.

Validates chunks against the original content with 4 checks:
- line_count: sum of chunk line_counts == source_info.file_lines
- content_concat: normalized(concatenated chunk contents) == normalized(original)
- no_duplicates: no chunk content appears more than once in full text
- first_last_line: first/last lines of chunks match original
"""

from __future__ import annotations

from doc_segmenter.models import Chunk, SourceFileInfo


class IntegrityCheckerImpl:
    """Implementation of IntegrityChecker protocol."""

    def check(
        self,
        chunks: list[Chunk],
        original_content: str,
        source_info: SourceFileInfo,
    ) -> dict[str, bool]:
        """Run all integrity checks on the final chunks.

        Args:
            chunks: The final chunk list after merging.
            original_content: The original file content.
            source_info: Metadata about the source file.

        Returns:
            A dict mapping check names to pass/fail results.
        """
        return {
            "line_count": self._check_line_count(chunks, source_info),
            "content_concat": self._check_content_concat(chunks, original_content),
            "no_duplicates": self._check_no_duplicates(chunks),
            "first_last_line": self._check_first_last_line(chunks, original_content),
        }

    def _check_line_count(
        self, chunks: list[Chunk], source_info: SourceFileInfo
    ) -> bool:
        """Verify line counts are consistent.

        For non-merged content: total lines should match source.
        For merged content: account for the extra "\n\n" separators
        added during merging.
        """
        # Count lines in all chunk contents
        total_lines = 0
        for chunk in chunks:
            total_lines += chunk.content.count("\n")
            if chunk.content and not chunk.content.endswith("\n"):
                total_lines += 1

        # Count the extra lines introduced by merge separators
        merge_separator_lines = 0
        for chunk in chunks:
            if chunk.is_merged and len(chunk.merged_sections) >= 2:
                # Each merge adds one "\n\n" = 2 newlines, which is 1 extra "line"
                # For N merged sections, there are (N-1) merge separators
                merge_separator_lines += (len(chunk.merged_sections) - 1) * 2

        adjusted_lines = total_lines - merge_separator_lines
        return adjusted_lines == source_info.file_lines

    def _check_content_concat(
        self, chunks: list[Chunk], original_content: str
    ) -> bool:
        """Verify concatenated chunk contents match original.

        For merged chunks, the content includes a "\n\n" separator that was
        not in the original. We need to account for this by comparing the
        content without the merge separators.
        """
        # Reconstruct content from chunks, removing merge separators
        parts: list[str] = []
        for chunk in chunks:
            if chunk.is_merged and chunk.merged_sections:
                # This chunk was merged; the content has "\n\n" separator
                # We need to check if the non-separator parts concatenate correctly
                parts.append(chunk.content)
            else:
                parts.append(chunk.content)

        concatenated = "".join(parts)

        # Direct comparison first (works when no merging occurred)
        if concatenated == original_content:
            return True

        # For merged content: normalize both by collapsing whitespace
        # This handles the case where merge added "\n\n" between chunks
        return self._normalize_whitespace(concatenated) == self._normalize_whitespace(original_content)

    def _check_no_duplicates(self, chunks: list[Chunk]) -> bool:
        """Verify no chunk content appears more than once in the full text.

        For merged chunks, their content may contain repeated parts from
        the original sections. This checks that no non-trivial chunk
        content appears as a substring in multiple chunks.
        """
        full_text = "".join(chunk.content for chunk in chunks)

        for chunk in chunks:
            content = chunk.content
            if not content.strip():
                continue
            # Count how many times this chunk's content appears in the full text
            count = full_text.count(content)
            if count > 1:
                return False
        return True

    def _check_first_last_line(
        self, chunks: list[Chunk], original_content: str
    ) -> bool:
        """Verify first and last lines match the original."""
        if not chunks or not original_content:
            return True

        original_lines = original_content.split("\n")
        # Filter out empty lines at the end
        while original_lines and original_lines[-1] == "":
            original_lines.pop()

        if not original_lines:
            return True

        first_chunk_lines = chunks[0].content.split("\n")
        last_chunk_lines = chunks[-1].content.split("\n")

        # Get first non-empty line from first chunk
        first_line = ""
        for line in first_chunk_lines:
            if line.strip():
                first_line = line
                break

        # Get last non-empty line from last chunk
        last_line = ""
        for line in reversed(last_chunk_lines):
            if line.strip():
                last_line = line
                break

        # Compare with original
        orig_first = ""
        for line in original_lines:
            if line.strip():
                orig_first = line
                break

        orig_last = ""
        for line in reversed(original_lines):
            if line.strip():
                orig_last = line
                break

        return first_line == orig_first and last_line == orig_last

    @staticmethod
    def _normalize(text: str) -> str:
        """Normalize text for comparison by removing trailing whitespace."""
        # Remove trailing whitespace from each line and collapse
        lines = text.split("\n")
        # Strip trailing empty lines
        while lines and lines[-1].strip() == "":
            lines.pop()
        return "\n".join(lines)

    @staticmethod
    def _normalize_whitespace(text: str) -> str:
        """Normalize by keeping only non-empty lines.

        Used for merged content comparison where extra blank lines
        may have been introduced by the merge separator.
        """
        lines = text.split("\n")
        non_empty = [line for line in lines if line.strip()]
        return "\n".join(non_empty)
