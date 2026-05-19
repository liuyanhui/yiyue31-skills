"""FileGenerator implementation.

Writes chunk files, manifest.md, and progress.json to the output directory.
Filename format: chunk-{NN:02d}-{sanitize(source_section)}.md
"""

from __future__ import annotations

import json
import os

from doc_segmenter.models import Chunk, SourceFileInfo, SplitError
from doc_segmenter.utils import sanitize_filename


class FileGeneratorImpl:
    """Implementation of FileGenerator protocol."""

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
        # Create output directory if not exists
        os.makedirs(output_dir, exist_ok=True)

        # Write each chunk file
        for i, chunk in enumerate(chunks):
            filename = "chunk-{:02d}-{}.md".format(
                i + 1, sanitize_filename(chunk.source_section)
            )
            filepath = os.path.join(output_dir, filename)
            try:
                with open(filepath, "w", encoding="utf-8") as f:
                    f.write(chunk.content)
            except OSError as e:
                raise SplitError(
                    "Failed to write chunk file: {}".format(e),
                    exit_code=4,
                )

        # Write manifest.md
        self._write_manifest(chunks, output_dir, source_info)

        # Write progress.json
        self._write_progress(chunks, output_dir, source_info)

    def _write_manifest(
        self,
        chunks: list[Chunk],
        output_dir: str,
        source_info: SourceFileInfo,
    ) -> None:
        """Write manifest.md with a table of all chunks."""
        lines = []
        lines.append("# Split Manifest")
        lines.append("")
        lines.append("Source: {}".format(source_info.file_path))
        lines.append("Size: {:.1f} KB".format(source_info.file_size))
        lines.append("Lines: {}".format(source_info.file_lines))
        lines.append("Total chunks: {}".format(len(chunks)))
        lines.append("")
        lines.append("| 序号 | File | Section | Size (KB) | Lines |")
        lines.append("|------|------|---------|-----------|-------|")

        for i, chunk in enumerate(chunks):
            filename = "chunk-{:02d}-{}.md".format(
                i + 1, sanitize_filename(chunk.source_section)
            )
            lines.append("| {} | {} | {} | {:.1f} | {} |".format(
                i + 1, filename, chunk.source_section, chunk.size_kb, chunk.line_count
            ))

        lines.append("")

        manifest_path = os.path.join(output_dir, "manifest.md")
        with open(manifest_path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))

    def _write_progress(
        self,
        chunks: list[Chunk],
        output_dir: str,
        source_info: SourceFileInfo,
    ) -> None:
        """Write progress.json with chunk tracking info."""
        pending = []
        for i, chunk in enumerate(chunks):
            filename = "chunk-{:02d}-{}.md".format(
                i + 1, sanitize_filename(chunk.source_section)
            )
            pending.append({
                "index": i + 1,
                "filename": filename,
                "section": chunk.source_section,
                "size_kb": round(chunk.size_kb, 2),
            })

        progress = {
            "source_file": source_info.file_path,
            "total_chunks": len(chunks),
            "completed": [],
            "in_progress": None,
            "pending": pending,
        }

        progress_path = os.path.join(output_dir, "progress.json")
        with open(progress_path, "w", encoding="utf-8") as f:
            json.dump(progress, f, indent=2, ensure_ascii=False)
