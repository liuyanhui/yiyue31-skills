"""Data models for the file splitting pipeline.

Defines all dataclasses used throughout the splitting workflow:
- SourceFileInfo: metadata about the source file
- Section: a parsed Markdown section (heading + content)
- Chunk: a split/merged output unit
- SplitOperation: record of a split or merge action
- SplitContext: pipeline-wide data carrier

Also defines SplitError for structured error handling with exit codes.
"""

from __future__ import annotations

from dataclasses import dataclass, field


class SplitError(Exception):
    """Structured error with an exit code for the CLI.

    Exit codes:
        0 - Success (not used for errors)
        1 - File not found or unreadable
        2 - File exceeds size limit
        3 - Validation failed
        4 - Output directory write failure
    """

    def __init__(self, message: str, exit_code: int) -> None:
        super().__init__(message)
        self.exit_code = exit_code


@dataclass
class SourceFileInfo:
    """Metadata about the source Markdown file."""

    file_path: str
    file_size: float  # KB, UTF-8 bytes / 1024
    file_lines: int
    file_chars: int
    file_encoding: str = "utf-8"


@dataclass
class Section:
    """A parsed Markdown section identified by its heading."""

    level: int  # 1-6 (heading depth)
    title: str
    content: str  # includes the heading line itself
    size_kb: float  # UTF-8 bytes / 1024
    start_line: int
    end_line: int


@dataclass
class Chunk:
    """A split/merged output unit ready for file generation."""

    source_section: str  # e.g. "Methodology-p1", "Conclusion + Appendix"
    level: int  # section heading depth
    content: str
    size_kb: float  # UTF-8 bytes / 1024
    line_count: int
    start_line: int
    end_line: int
    is_merged: bool = False
    merged_sections: list[str] = field(default_factory=list)
    estimated_tokens: int = 0


@dataclass
class SplitOperation:
    """Record of a single split or merge action."""

    operation: str  # "split" or "merge"
    target: str  # section name
    detail: str  # e.g. "72KB -> p1(38KB) + p2(34KB)"


@dataclass
class SplitContext:
    """Pipeline-wide data carrier passed between all stages."""

    source_info: SourceFileInfo
    sections: list[Section] = field(default_factory=list)
    chunks: list[Chunk] = field(default_factory=list)
    operations: list[SplitOperation] = field(default_factory=list)
    validation_results: dict[str, bool] = field(default_factory=dict)
    output_dir: str = ""
