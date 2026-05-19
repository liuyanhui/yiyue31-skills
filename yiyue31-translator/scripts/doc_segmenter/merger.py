"""ChunkMerger implementation.

Merges small chunks (< min_size) with same-level predecessor if combined <= max_size.
First chunk is never merged (no predecessor).
Separator between merged chunks: "\n\n".
"""

from __future__ import annotations

from doc_segmenter.models import Chunk, SplitOperation
from doc_segmenter.utils import calc_size_kb


class ChunkMergerImpl:
    """Implementation of ChunkMerger protocol."""

    def merge(
        self,
        chunks: list[Chunk],
        max_size: float,
        min_size: float,
    ) -> tuple[list[Chunk], list[SplitOperation]]:
        """Merge chunks smaller than min_size into same-level neighbors.

        Iterates from index 1. If chunk < min_size and same level as
        predecessor and combined <= max_size: merge with predecessor.
        First chunk is never merged (no predecessor).

        Args:
            chunks: Chunks from SectionSplitter.
            max_size: Maximum size per chunk in KB (merge must not exceed).
            min_size: Minimum size threshold in KB (chunks below trigger merge).

        Returns:
            A tuple of (merged_chunks, operations).
        """
        if not chunks:
            return [], []

        operations: list[SplitOperation] = []
        result: list[Chunk] = [chunks[0]]

        for i in range(1, len(chunks)):
            current = chunks[i]
            predecessor = result[-1]

            # Check merge conditions:
            # 1. Current chunk < min_size
            # 2. Same level as predecessor
            # 3. Combined size <= max_size
            if (
                current.size_kb < min_size
                and current.level == predecessor.level
            ):
                merged_content = predecessor.content + "\n\n" + current.content
                merged_size = calc_size_kb(merged_content)

                if merged_size <= max_size:
                    # Merge: create a new merged chunk
                    merged_chunk = Chunk(
                        source_section=predecessor.source_section + " + " + current.source_section,
                        level=predecessor.level,
                        content=merged_content,
                        size_kb=merged_size,
                        line_count=predecessor.line_count + current.line_count + 2,  # +2 for \n\n
                        start_line=predecessor.start_line,
                        end_line=current.end_line,
                        is_merged=True,
                        merged_sections=(
                            (predecessor.merged_sections if predecessor.is_merged else [predecessor.source_section])
                            + (current.merged_sections if current.is_merged else [current.source_section])
                        ),
                    )
                    # Replace predecessor with merged chunk
                    result[-1] = merged_chunk

                    operations.append(
                        SplitOperation(
                            operation="merge",
                            target=merged_chunk.source_section,
                            detail="{:.0f}KB + {:.0f}KB -> {:.0f}KB".format(
                                predecessor.size_kb, current.size_kb, merged_size
                            ),
                        )
                    )
                    continue

            # No merge: add current chunk as-is
            result.append(current)

        return result, operations
