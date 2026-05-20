"""SplitRunner implementation.

Orchestrates all pipeline modules in sequence:
inspect -> parse -> split -> merge -> check -> generate -> report
When file_size < max_size, parse/split/merge stages are skipped (single chunk).
"""

from __future__ import annotations

import os
import sys

from doc_segmenter.checker import IntegrityCheckerImpl
from doc_segmenter.generator import FileGeneratorImpl
from doc_segmenter.inspector import FileInspectorImpl
from doc_segmenter.merger import ChunkMergerImpl
from doc_segmenter.models import Chunk, SplitContext, SplitError
from doc_segmenter.parser import SectionParserImpl
from doc_segmenter.reporter import ReportGeneratorImpl
from doc_segmenter.splitter import SectionSplitterImpl


class SplitRunnerImpl:
    """Orchestrates the full file splitting pipeline."""

    def __init__(self) -> None:
        self.inspector = FileInspectorImpl()
        self.parser = SectionParserImpl()
        self.splitter = SectionSplitterImpl()
        self.merger = ChunkMergerImpl()
        self.checker = IntegrityCheckerImpl()
        self.generator = FileGeneratorImpl()
        self.reporter = ReportGeneratorImpl()

    def run(
        self,
        file_path: str,
        output_dir: str = "./output",
        max_size: float = 40.0,
        min_size: float = 10.0,
    ) -> int:
        """Run the full splitting pipeline.

        Args:
            file_path: Path to the source Markdown file.
            output_dir: Directory for output files.
            max_size: Maximum chunk size in KB.
            min_size: Minimum chunk size in KB.

        Returns:
            Exit code: 0 for success, 1-4 for errors.
        """
        try:
            # Stage 0: Inspect
            source_info = self.inspector.inspect(file_path)

            # Read file content for later stages
            with open(file_path, encoding=source_info.file_encoding) as f:
                original_content = f.read()

            # Small file shortcut: skip parse -> split -> merge
            if source_info.file_size < max_size:
                base_name = os.path.splitext(os.path.basename(file_path))[0]
                chunk = Chunk(
                    source_section=base_name,
                    level=1,
                    content=original_content,
                    size_kb=source_info.file_size,
                    line_count=source_info.file_lines,
                    start_line=1,
                    end_line=source_info.file_lines,
                    is_merged=False,
                    merged_sections=[],
                    estimated_tokens=0,
                )
                chunks = [chunk]
                all_ops = []
                sections = []
            else:
                # Stage 1: Parse
                sections = self.parser.parse(
                    original_content, source_info.file_encoding
                )

                # Stage 2: Split
                chunks, split_ops = self.splitter.split(sections, max_size)

                # Stage 3: Merge
                chunks, merge_ops = self.merger.merge(chunks, max_size, min_size)

                # Combine operations
                all_ops = split_ops + merge_ops

            # Stage 4: Integrity check
            validation_results = self.checker.check(
                chunks, original_content, source_info
            )

            if not all(validation_results.values()):
                # Validation failed
                failed_checks = [
                    name for name, passed in validation_results.items() if not passed
                ]
                print(
                    "Error: Validation failed: {}".format(", ".join(failed_checks)),
                    file=sys.stderr,
                )
                context = SplitContext(
                    source_info=source_info,
                    sections=sections,
                    chunks=chunks,
                    operations=all_ops,
                    validation_results=validation_results,
                    output_dir=output_dir,
                )
                self.reporter.generate_report(context)
                return 3

            # Stage 5: Generate output files
            context = SplitContext(
                source_info=source_info,
                sections=sections,
                chunks=chunks,
                operations=all_ops,
                validation_results=validation_results,
                output_dir=output_dir,
            )
            self.generator.generate(chunks, output_dir, source_info, max_size)

            # Stage 6: Generate report
            self.reporter.generate_report(context)

            return 0

        except SplitError as e:
            print(f"Error: {e}", file=sys.stderr)
            return e.exit_code
        except Exception as e:
            print(f"Error: {e}", file=sys.stderr)
            return 1
