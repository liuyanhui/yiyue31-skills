/**
 * Shared constants for the doc-segmenter pipeline.
 *
 * Centralizes magic values that Python scatters across files:
 * - MAX_FILE_SIZE_BYTES: from inspector.py
 * - MAX_DEPTH, TARGET_RATIO: from splitter.py
 */

/** Maximum file size in bytes (5 MB) */
export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

/** Maximum recursion depth for section splitting */
export const MAX_DEPTH = 4;

/** Target chunk size as fraction of max_size */
export const TARGET_RATIO = 0.75;

/** Heading pattern: 1-6 hash chars followed by space and heading text */
export const HEADING_PATTERN = /^(#{1,6})\s+(.+)$/;
