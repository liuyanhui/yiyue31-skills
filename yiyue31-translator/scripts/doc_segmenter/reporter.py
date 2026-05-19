"""ReportGenerator implementation.

Generates report.md from SplitContext with source info, split results,
operations, validation results, and file list.
"""

from __future__ import annotations

import os

from doc_segmenter.models import SplitContext


class ReportGeneratorImpl:
    """Implementation of ReportGenerator protocol."""

    def generate_report(self, context: SplitContext) -> None:
        """Generate report.md from the full pipeline context.

        Args:
            context: The complete SplitContext with all pipeline data.
        """
        output_dir = context.output_dir
        os.makedirs(output_dir, exist_ok=True)

        lines = []
        lines.append("# File Split Report")
        lines.append("")

        # Source file information
        lines.append("## Source Information")
        lines.append("")
        lines.append("| Property | Value |")
        lines.append("|----------|-------|")
        lines.append("| File | {} |".format(context.source_info.file_path))
        lines.append("| Size | {:.1f} KB |".format(context.source_info.file_size))
        lines.append("| Lines | {} |".format(context.source_info.file_lines))
        lines.append("| Chars | {} |".format(context.source_info.file_chars))
        lines.append("| Encoding | {} |".format(context.source_info.file_encoding))
        lines.append("")

        # Split results
        lines.append("## Split Results")
        lines.append("")
        lines.append("Total chunks: {}".format(len(context.chunks)))
        lines.append("")

        if context.chunks:
            lines.append("| # | Section | Size (KB) | Lines | Merged |")
            lines.append("|---|---------|-----------|-------|--------|")
            for i, chunk in enumerate(context.chunks):
                merged_tag = "Yes" if chunk.is_merged else "No"
                lines.append("| {} | {} | {:.1f} | {} | {} |".format(
                    i + 1, chunk.source_section, chunk.size_kb,
                    chunk.line_count, merged_tag
                ))
            lines.append("")

        # Operations
        if context.operations:
            lines.append("## Operations")
            lines.append("")
            lines.append("| Type | Target | Detail |")
            lines.append("|------|--------|--------|")
            for op in context.operations:
                lines.append("| {} | {} | {} |".format(
                    op.operation, op.target, op.detail
                ))
            lines.append("")

        # Validation results
        if context.validation_results:
            lines.append("## Validation")
            lines.append("")
            all_pass = all(context.validation_results.values())
            for check, result in context.validation_results.items():
                status = "pass" if result else "FAIL"
                lines.append("- **{}**: {}".format(check, status))
            lines.append("")
            if all_pass:
                lines.append("All checks passed.")
            else:
                lines.append("Some checks failed.")
            lines.append("")

        # File list
        if context.chunks:
            lines.append("## Output Files")
            lines.append("")
            for i, chunk in enumerate(context.chunks):
                from doc_segmenter.utils import sanitize_filename
                filename = "chunk-{:02d}-{}.md".format(
                    i + 1, sanitize_filename(chunk.source_section)
                )
                lines.append("{}. {} ({:.1f} KB)".format(
                    i + 1, filename, chunk.size_kb
                ))
            lines.append("")

        report_path = os.path.join(output_dir, "report.md")
        with open(report_path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))
