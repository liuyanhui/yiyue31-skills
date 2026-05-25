"""End-to-end integration tests for the full doc_segmenter pipeline.

Constructs a ~80KB markdown document with code blocks, HTML tables,
pipe tables, and multi-level headings to exercise all pipeline stages.
"""

import json
import os
import re
from pathlib import Path

import pytest

from doc_segmenter.runner import SplitRunnerImpl
from doc_segmenter.utils import sanitize_filename


@pytest.fixture
def runner():
    """Create SplitRunnerImpl instance for testing."""
    return SplitRunnerImpl()


def _build_integration_markdown(tmp_path):
    """Build a ~80KB markdown file with diverse content types.

    Includes:
    - Code blocks (```)
    - HTML table
    - Pipe table
    - Multi-level headings (#, ##, ###)
    - Long paragraphs (>10KB each to exceed min_size)
    """
    sections = []

    # Section 1: Introduction with code block (~15KB)
    lines = ["# Introduction", ""]
    lines.append("```python")
    for i in range(80):
        lines.append(f"def function_{i}():")
        lines.append(f"    return {i} * 2")
    lines.append("```")
    lines.append("")
    lines.append("This section introduces the document with code examples. " * 30)
    lines.append("")
    sections.append("\n".join(lines))

    # Section 2: HTML table + content (~15KB)
    lines = ["## Data Analysis", ""]
    lines.append("<table>")
    lines.append("<tr><th>Metric</th><th>Value</th></tr>")
    for i in range(50):
        lines.append(f"<tr><td>Row {i}</td><td>{i * 1.5:.1f}</td></tr>")
    lines.append("</table>")
    lines.append("")
    lines.append("Analysis of the data presented in the table above. " * 50)
    lines.append("")
    sections.append("\n".join(lines))

    # Section 3: Pipe table + content (~15KB)
    lines = ["## Results Summary", ""]
    lines.append("| Category | Count | Percentage |")
    lines.append("|----------|-------|------------|")
    for i in range(30):
        lines.append(f"| Cat-{i} | {i * 10} | {i * 3.3:.1f}% |")
    lines.append("")
    lines.append("The results show significant trends across categories. " * 50)
    lines.append("")
    sections.append("\n".join(lines))

    # Section 4: Multi-level subheadings (~15KB)
    lines = ["## Methodology", ""]
    for j in range(5):
        lines.append(f"### Step {j + 1}")
        lines.append("")
        lines.append(f"Detailed methodology description for step {j + 1}. " * 40)
        lines.append("")
    sections.append("\n".join(lines))

    # Section 5: Conclusion with mixed content (~15KB)
    lines = ["## Conclusion", ""]
    lines.append("```javascript")
    lines.append("const result = data.filter(x => x.value > threshold);")
    lines.append("console.log(result.length);")
    lines.append("```")
    lines.append("")
    lines.append("Final conclusions drawn from the analysis. " * 60)
    lines.append("")
    sections.append("\n".join(lines))

    content = "\n".join(sections)

    # Write the file
    file_path = tmp_path / "integration-test.md"
    file_path.write_text(content, encoding="utf-8")

    return str(file_path), content


class TestIntegrationPipeline:
    """End-to-end pipeline tests."""

    def test_runner_returns_success(self, runner, tmp_path):
        """C1: runner.run() returns 0."""
        file_path, original = _build_integration_markdown(tmp_path)
        output_dir = str(tmp_path / "output")

        result = runner.run(file_path, output_dir=output_dir, max_size=40.0, min_size=10.0)

        assert result == 0

    def test_output_files_exist(self, runner, tmp_path):
        """C2: Output directory contains all expected files."""
        file_path, original = _build_integration_markdown(tmp_path)
        output_dir = str(tmp_path / "output")

        runner.run(file_path, output_dir=output_dir, max_size=40.0, min_size=10.0)

        output_files = set(os.listdir(output_dir))
        chunk_files = [f for f in output_files if f.startswith("chunk-") and f.endswith(".md")]
        assert len(chunk_files) >= 1
        assert "manifest.md" in output_files
        assert "progress.json" in output_files
        assert "report.md" in output_files

    def test_chunks_within_max_size(self, runner, tmp_path):
        """C3: All chunk files are within max_size (content size)."""
        file_path, original = _build_integration_markdown(tmp_path)
        output_dir = str(tmp_path / "output")

        runner.run(file_path, output_dir=output_dir, max_size=40.0, min_size=10.0)

        chunk_files = sorted(Path(output_dir).glob("chunk-*.md"))
        for cf in chunk_files:
            content = cf.read_text(encoding="utf-8")
            size_kb = len(content.encode("utf-8")) / 1024
            assert size_kb <= 40.0 + 1.0  # small tolerance

    def test_chunks_non_empty(self, runner, tmp_path):
        """C4: All chunk files have non-zero size."""
        file_path, original = _build_integration_markdown(tmp_path)
        output_dir = str(tmp_path / "output")

        runner.run(file_path, output_dir=output_dir, max_size=40.0, min_size=10.0)

        chunk_files = sorted(Path(output_dir).glob("chunk-*.md"))
        for cf in chunk_files:
            assert cf.stat().st_size > 0

    def test_chunk_concatenation_equals_original(self, runner, tmp_path):
        """C5: Sorted chunk contents concatenated == original markdown."""
        file_path, original = _build_integration_markdown(tmp_path)
        output_dir = str(tmp_path / "output")

        runner.run(file_path, output_dir=output_dir, max_size=40.0, min_size=10.0)

        chunk_files = sorted(Path(output_dir).glob("chunk-*.md"))
        reconstructed = ""
        for cf in chunk_files:
            reconstructed += cf.read_text(encoding="utf-8")

        assert reconstructed == original

    def test_progress_json_fields(self, runner, tmp_path):
        """C6: progress.json contains required metadata fields."""
        file_path, original = _build_integration_markdown(tmp_path)
        output_dir = str(tmp_path / "output")

        runner.run(file_path, output_dir=output_dir, max_size=40.0, min_size=10.0)

        with open(os.path.join(output_dir, "progress.json"), encoding="utf-8") as f:
            progress = json.load(f)

        assert "source_size_kb" in progress
        assert "threshold_kb" in progress
        assert "total_chunks" in progress
        assert "pending" in progress

    def test_total_chunks_consistency(self, runner, tmp_path):
        """C7: total_chunks in progress.json matches actual chunk files."""
        file_path, original = _build_integration_markdown(tmp_path)
        output_dir = str(tmp_path / "output")

        runner.run(file_path, output_dir=output_dir, max_size=40.0, min_size=10.0)

        with open(os.path.join(output_dir, "progress.json"), encoding="utf-8") as f:
            progress = json.load(f)

        chunk_files = list(Path(output_dir).glob("chunk-*.md"))
        assert progress["total_chunks"] == len(chunk_files)

    def test_manifest_matches_chunks(self, runner, tmp_path):
        """C8: manifest.md lists filenames matching actual chunk files."""
        file_path, original = _build_integration_markdown(tmp_path)
        output_dir = str(tmp_path / "output")

        runner.run(file_path, output_dir=output_dir, max_size=40.0, min_size=10.0)

        manifest_path = os.path.join(output_dir, "manifest.md")
        manifest_content = Path(manifest_path).read_text(encoding="utf-8")

        chunk_files = sorted(os.listdir(output_dir))
        chunk_files = [f for f in chunk_files if f.startswith("chunk-") and f.endswith(".md")]

        for cf in chunk_files:
            assert cf in manifest_content

    def test_code_blocks_intact(self, runner, tmp_path):
        """C9: ``` markers are paired in every chunk (code blocks not split)."""
        file_path, original = _build_integration_markdown(tmp_path)
        output_dir = str(tmp_path / "output")

        runner.run(file_path, output_dir=output_dir, max_size=40.0, min_size=10.0)

        chunk_files = sorted(Path(output_dir).glob("chunk-*.md"))
        for cf in chunk_files:
            content = cf.read_text(encoding="utf-8")
            backtick_count = content.count("```")
            if backtick_count > 0:
                assert backtick_count % 2 == 0

    def test_filenames_sanitized(self, runner, tmp_path):
        """C10: Chunk filenames use sanitize_filename for section names."""
        file_path, original = _build_integration_markdown(tmp_path)
        output_dir = str(tmp_path / "output")

        runner.run(file_path, output_dir=output_dir, max_size=40.0, min_size=10.0)

        chunk_files = [f for f in os.listdir(output_dir)
                       if f.startswith("chunk-") and f.endswith(".md")]

        # All filenames should follow pattern chunk-NN-{sanitized}.md
        # and should not contain unsafe characters
        unsafe = set('/\\:*?"<>|')
        for cf in chunk_files:
            for ch in cf:
                assert ch not in unsafe
