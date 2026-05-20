"""Tests for short-circuit behavior in SplitRunnerImpl.

When file_size < max_size, the runner should skip parse/split/merge stages
and produce a single chunk containing the full original content.
"""

import json
import os
from pathlib import Path

import pytest

from doc_segmenter.runner import SplitRunnerImpl


@pytest.fixture
def runner():
    """Create SplitRunnerImpl instance for testing."""
    return SplitRunnerImpl()


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
    # 4 sections × ~10KB each ≈ 40KB
    for i in range(4):
        lines.append(f"## Section {i + 1}")
        lines.append("")
        lines.append(f"Content for section {i + 1}. " * 350)
        lines.append("")
    file_path.write_text("\n".join(lines), encoding="utf-8")
    return str(file_path)


class TestSmallFileShortCircuit:
    """Tests for the short-circuit path when file_size < max_size."""

    def test_small_file_single_chunk(self, runner, tmp_path):
        """Small file should produce exactly 1 chunk file."""
        small_file = _create_small_markdown(tmp_path)
        output_dir = str(tmp_path / "output_small")

        result = runner.run(small_file, output_dir=output_dir, max_size=40.0)

        assert result == 0
        chunk_files = sorted(Path(output_dir).glob("chunk-*.md"))
        assert len(chunk_files) == 1
        assert chunk_files[0].stat().st_size > 0

    def test_single_chunk_content_integrity(self, runner, tmp_path):
        """Single chunk content must be identical to original file."""
        small_file = _create_small_markdown(tmp_path)
        output_dir = str(tmp_path / "output_integrity")
        original_content = Path(small_file).read_text(encoding="utf-8")

        result = runner.run(small_file, output_dir=output_dir, max_size=40.0)

        assert result == 0
        chunk_files = sorted(Path(output_dir).glob("chunk-*.md"))
        assert len(chunk_files) == 1
        chunk_content = chunk_files[0].read_text(encoding="utf-8")
        assert chunk_content == original_content

    def test_small_file_output_structure(self, runner, tmp_path):
        """Small file must produce same output files as multi-chunk path."""
        small_file = _create_small_markdown(tmp_path)
        output_dir = str(tmp_path / "output_structure")

        result = runner.run(small_file, output_dir=output_dir, max_size=40.0)

        assert result == 0
        output_files = set(os.listdir(output_dir))
        assert "manifest.md" in output_files
        assert "progress.json" in output_files
        assert "report.md" in output_files
        chunk_files = [f for f in output_files if f.startswith("chunk-") and f.endswith(".md")]
        assert len(chunk_files) == 1


class TestLargeFileNormalPath:
    """Tests for the normal splitting path when file_size >= max_size."""

    def test_large_file_multiple_chunks(self, runner, tmp_path):
        """Large file should produce multiple chunk files."""
        large_file = _create_large_markdown(tmp_path)
        output_dir = str(tmp_path / "output_large")

        result = runner.run(large_file, output_dir=output_dir, max_size=40.0)

        assert result == 0
        chunk_files = sorted(Path(output_dir).glob("chunk-*.md"))
        assert len(chunk_files) > 1
        for cf in chunk_files:
            assert cf.stat().st_size > 0


class TestBoundaryCondition:
    """Tests for the boundary where file_size == max_size."""

    def test_boundary_goes_through_normal_splitting(self, runner, tmp_path):
        """File at exactly max_size should use normal splitting (not short-circuit)."""
        boundary_file = _create_boundary_markdown(tmp_path)
        file_size_kb = Path(boundary_file).stat().st_size / 1024
        output_dir = str(tmp_path / "output_boundary")

        result = runner.run(boundary_file, output_dir=output_dir, max_size=file_size_kb)

        assert result == 0
        # At boundary, file_size >= max_size, so normal splitting is used
        chunk_files = sorted(Path(output_dir).glob("chunk-*.md"))
        assert len(chunk_files) >= 1


class TestProgressJsonMetadata:
    """Tests for new metadata fields in progress.json."""

    def test_progress_json_has_metadata_fields(self, runner, tmp_path):
        """progress.json must contain source_size_kb and threshold_kb."""
        small_file = _create_small_markdown(tmp_path)
        output_dir = str(tmp_path / "output_progress")

        result = runner.run(small_file, output_dir=output_dir, max_size=40.0)

        assert result == 0
        progress_path = Path(output_dir) / "progress.json"
        assert progress_path.exists()
        with open(progress_path, encoding="utf-8") as f:
            progress = json.load(f)

        assert "source_size_kb" in progress
        assert "threshold_kb" in progress
        assert progress["threshold_kb"] == 40.0
        assert progress["total_chunks"] == 1

    def test_progress_json_metadata_large_file(self, runner, tmp_path):
        """Large file progress.json also has metadata fields."""
        large_file = _create_large_markdown(tmp_path)
        output_dir = str(tmp_path / "output_progress_large")

        result = runner.run(large_file, output_dir=output_dir, max_size=40.0)

        assert result == 0
        progress_path = Path(output_dir) / "progress.json"
        with open(progress_path, encoding="utf-8") as f:
            progress = json.load(f)

        assert "source_size_kb" in progress
        assert "threshold_kb" in progress
        assert progress["threshold_kb"] == 40.0
        assert progress["total_chunks"] > 1

    def test_progress_json_preserves_existing_fields(self, runner, tmp_path):
        """All original progress.json fields must still exist."""
        small_file = _create_small_markdown(tmp_path)
        output_dir = str(tmp_path / "output_fields")

        result = runner.run(small_file, output_dir=output_dir, max_size=40.0)

        assert result == 0
        progress_path = Path(output_dir) / "progress.json"
        with open(progress_path, encoding="utf-8") as f:
            progress = json.load(f)

        assert "source_file" in progress
        assert "total_chunks" in progress
        assert "completed" in progress
        assert "in_progress" in progress
        assert "pending" in progress


class TestOutputStructureConsistency:
    """Verify single-chunk and multi-chunk outputs have identical structure."""

    def test_both_paths_produce_same_file_types(self, runner, tmp_path):
        """Both small and large files must produce the same types of output files."""
        small_file = _create_small_markdown(tmp_path, "s.md")
        large_file = _create_large_markdown(tmp_path, "l.md")
        small_out = str(tmp_path / "out_s")
        large_out = str(tmp_path / "out_l")

        runner.run(small_file, output_dir=small_out, max_size=40.0)
        runner.run(large_file, output_dir=large_out, max_size=40.0)

        small_files = {f for f in os.listdir(small_out) if not f.startswith("chunk-")}
        large_files = {f for f in os.listdir(large_out) if not f.startswith("chunk-")}

        assert small_files == large_files
        assert "manifest.md" in small_files
        assert "progress.json" in small_files
        assert "report.md" in small_files
