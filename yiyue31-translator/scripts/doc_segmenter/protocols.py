"""Protocol interfaces for all pipeline modules.

Each module (FileInspector, SectionParser, etc.) must implement
the corresponding Protocol defined here. All input and output types
are explicitly typed -- no Any usage.
"""

from __future__ import annotations

from typing import Protocol

from doc_segmenter.models import (
    Chunk,
    Section,
    SourceFileInfo,
    SplitContext,
    SplitOperation,
)


class FileInspector(Protocol):
    """Stage 0: Pre-check the source file and gather metadata."""

    def inspect(self, file_path: str) -> SourceFileInfo:
        """Inspect a file and return its metadata.

        Raises:
            SplitError: exit_code=1 if file not found or unreadable,
                        exit_code=2 if file exceeds size limit.
        """
        ...


class SectionParser(Protocol):
    """Stage 1: Parse file content into a list of sections."""

    def parse(self, content: str, file_encoding: str) -> list[Section]:
        """Parse raw content into sections based on Markdown headings.

        Args:
            content: The full file content as a string.
            file_encoding: The encoding of the source file.

        Returns:
            A list of Section objects, one per heading found.
        """
        ...


class SectionSplitter(Protocol):
    """Stage 2: Split large sections into chunks under max_size."""

    def split(
        self,
        sections: list[Section],
        max_size: float,
    ) -> tuple[list[Chunk], list[SplitOperation]]:
        """Split sections into chunks, all under max_size KB.

        Args:
            sections: Parsed sections from SectionParser.
            max_size: Maximum size per chunk in KB.

        Returns:
            A tuple of (chunks, operations) where chunks are all
            under max_size and operations records each split action.
        """
        ...


class ChunkMerger(Protocol):
    """Stage 3: Merge small chunks with same-level neighbors."""

    def merge(
        self,
        chunks: list[Chunk],
        max_size: float,
        min_size: float,
    ) -> tuple[list[Chunk], list[SplitOperation]]:
        """Merge chunks smaller than min_size into same-level neighbors.

        Args:
            chunks: Chunks from SectionSplitter.
            max_size: Maximum size per chunk in KB (merge must not exceed).
            min_size: Minimum size threshold in KB (chunks below trigger merge).

        Returns:
            A tuple of (merged_chunks, operations).
        """
        ...


class IntegrityChecker(Protocol):
    """Stage 4: Validate chunks against the original content."""

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
            Keys: "line_count", "content_concat", "no_duplicates", "first_last_line".
        """
        ...


class FileGenerator(Protocol):
    """Stage 5: Write chunk files, manifest, and progress JSON."""

    def generate(
        self,
        chunks: list[Chunk],
        output_dir: str,
        source_info: SourceFileInfo,
    ) -> None:
        """Generate output files for all chunks.

        Args:
            chunks: The final chunk list.
            output_dir: Directory to write files into.
            source_info: Metadata about the source file.

        Raises:
            SplitError: exit_code=4 if output directory write fails.
        """
        ...


class ReportGenerator(Protocol):
    """Stage 6: Generate the split report."""

    def generate_report(self, context: SplitContext) -> None:
        """Generate report.md from the full pipeline context.

        Args:
            context: The complete SplitContext with all pipeline data.
        """
        ...
