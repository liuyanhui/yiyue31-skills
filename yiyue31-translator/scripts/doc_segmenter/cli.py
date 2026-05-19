"""CLI entry point for the file splitting tool.

Provides argparse-based command-line interface.
"""

from __future__ import annotations

import argparse
import sys

from doc_segmenter.runner import SplitRunnerImpl


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    """Parse command-line arguments.

    Args:
        argv: Command line arguments. If None, uses sys.argv.

    Returns:
        Parsed arguments namespace.
    """
    parser = argparse.ArgumentParser(
        prog="doc-segmenter",
        description="Split a Markdown file into smaller chunks for translation.",
    )
    parser.add_argument(
        "file_path",
        help="Path to the source Markdown file to split.",
    )
    parser.add_argument(
        "--output-dir",
        default="./output",
        help="Output directory for split files (default: ./output).",
    )
    parser.add_argument(
        "--max-size",
        type=float,
        default=40.0,
        help="Maximum chunk size in KB (default: 40).",
    )
    parser.add_argument(
        "--min-size",
        type=float,
        default=10.0,
        help="Minimum chunk size in KB for merging (default: 10).",
    )
    return parser.parse_args(argv)


def main() -> None:
    """Main CLI entry point."""
    args = parse_args()
    runner = SplitRunnerImpl()
    try:
        exit_code = runner.run(
            file_path=args.file_path,
            output_dir=args.output_dir,
            max_size=args.max_size,
            min_size=args.min_size,
        )
    except SplitError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(e.exit_code)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
