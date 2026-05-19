"""Utility functions for the file splitting pipeline.

- sanitize_filename: replace unsafe characters for file names
- calc_size_kb: compute size in KB (UTF-8 bytes / 1024)
"""

from __future__ import annotations

import re


# Characters that are unsafe in file names on Windows (and generally)
_UNSAFE_CHARS_PATTERN = re.compile(r'[/\\:*?"<>|]')
# Pattern to collapse consecutive dashes into one
_CONSECUTIVE_DASHES_PATTERN = re.compile(r"-{2,}")


def sanitize_filename(name: str) -> str:
    """Replace unsafe file name characters with '-' and collapse consecutive dashes.

    Unsafe characters: / \\ : * ? " < > |

    Args:
        name: The raw name to sanitize.

    Returns:
        A sanitized string safe for use as a file name.
    """
    result = _UNSAFE_CHARS_PATTERN.sub("-", name)
    result = _CONSECUTIVE_DASHES_PATTERN.sub("-", result)
    return result


def calc_size_kb(content: str) -> float:
    """Calculate the size of a string in KB (UTF-8 bytes / 1024).

    Args:
        content: The string content to measure.

    Returns:
        Size in KB as a float (UTF-8 encoded byte count / 1024).
    """
    byte_count = len(content.encode("utf-8"))
    return byte_count / 1024
