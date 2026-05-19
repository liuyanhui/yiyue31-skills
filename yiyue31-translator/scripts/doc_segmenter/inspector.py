"""FileInspector implementation.

Inspects source files and returns metadata (SourceFileInfo).
Raises SplitError(exit_code=1) for not found, SplitError(exit_code=2) for >5MB.
"""

from __future__ import annotations

import os

import chardet

from doc_segmenter.models import SourceFileInfo, SplitError
from doc_segmenter.utils import calc_size_kb

# 5 MB limit in bytes
_MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024


class FileInspectorImpl:
    """Implementation of FileInspector protocol."""

    def inspect(self, file_path: str) -> SourceFileInfo:
        """Inspect a file and return its metadata.

        Args:
            file_path: Path to the source file.

        Returns:
            SourceFileInfo with file metadata.

        Raises:
            SplitError: exit_code=1 if file not found or unreadable.
            SplitError: exit_code=2 if file exceeds 5MB.
        """
        # Check file exists
        if not os.path.isfile(file_path):
            raise SplitError(
                "File not found: {}".format(file_path),
                exit_code=1,
            )

        # Check file size on disk (bytes)
        disk_size = os.path.getsize(file_path)
        if disk_size > _MAX_FILE_SIZE_BYTES:
            raise SplitError(
                "File exceeds 5MB limit ({} bytes)".format(disk_size),
                exit_code=2,
            )

        # Read raw bytes and detect encoding
        with open(file_path, "rb") as f:
            raw_bytes = f.read()

        encoding = self._detect_encoding(raw_bytes)

        # Read content in text mode (normalizes \r\n -> \n on Windows)
        with open(file_path, encoding=encoding) as f:
            content = f.read()

        # file_size based on disk bytes (matches os.path.getsize)
        file_size = disk_size / 1024.0

        # Re-check size against 5MB
        if disk_size > _MAX_FILE_SIZE_BYTES:
            raise SplitError(
                "File content exceeds 5MB limit ({} KB)".format(file_size),
                exit_code=2,
            )

        file_lines = content.count("\n")
        if content and not content.endswith("\n"):
            file_lines += 1

        file_chars = len(content)

        return SourceFileInfo(
            file_path=file_path,
            file_size=file_size,
            file_lines=file_lines,
            file_chars=file_chars,
            file_encoding=encoding,
        )

    def _detect_encoding(self, raw_bytes: bytes) -> str:
        """Detect encoding of raw bytes.

        Uses chardet for detection with fallback to common encodings.
        Normalizes encoding names to standard forms.

        Args:
            raw_bytes: The raw file bytes.

        Returns:
            The detected encoding string.
        """
        result = chardet.detect(raw_bytes)
        detected = result.get("encoding", "")

        if detected:
            # Normalize common aliases
            detected_lower = detected.lower()
            if detected_lower in ("ascii", "utf-8", "utf-8-sig"):
                return "utf-8"
            if detected_lower in ("gb2312", "gb18030", "gbk"):
                return detected_lower
            return detected_lower

        # Fallback: try common encodings
        for enc in ["utf-8", "gbk", "latin-1"]:
            try:
                raw_bytes.decode(enc)
                return enc
            except (UnicodeDecodeError, UnicodeError):
                continue
        return "latin-1"
