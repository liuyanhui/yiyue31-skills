/**
 * String literal union for marker validation issue identifiers.
 *
 * Each value represents a distinct category of structural problem
 * detected when validating paired marker blocks inside a file.
 */
export type MarkerIssueIdentifier =
  | "missing_start_marker"
  | "missing_end_marker"
  | "marker_order_reversed"
  | "multiple_marker_pairs"
  | "content_too_short";

/**
 * Classification of marker block position within a file.
 *
 * - `"head"` — the marker block appears near the beginning of the file.
 * - `"middle"` — the marker block appears in the body of the file.
 * - `"tail"` — the marker block appears near the end of the file.
 */
export type MarkerPositionClassification = "head" | "middle" | "tail";

/**
 * Classification of custom content presence within a marker block.
 *
 * - `"has_custom_content"` — the marker block contains user-authored content
 *   beyond the structural markers themselves.
 * - `"marker_only"` — the marker block contains only the start/end markers
 *   with no meaningful custom content between them.
 */
export type CustomContentClassification =
  | "has_custom_content"
  | "marker_only";
