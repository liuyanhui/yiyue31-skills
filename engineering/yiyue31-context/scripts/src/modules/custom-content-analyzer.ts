/**
 * Custom content analyzer module.
 *
 * Determines whether a file contains user-authored content outside
 * the marker block, or whether it consists solely of the markers
 * and their enclosed content.
 */

import type {
  MarkerConfig,
  CustomContentClassification,
} from "../types/index.js";

/**
 * Analyze whether a file has custom content beyond the marker block.
 *
 * Algorithm:
 * 1. Find first occurrence of markers.start and markers.end in fileContent.
 * 2. Remove the first marker pair and all enclosed content from fileContent.
 * 3. Strip remaining whitespace (spaces, newlines, tabs).
 * 4. If non-empty → 'has_custom_content'.
 * 5. If empty → 'marker_only'.
 * 6. Incomplete/missing markers → 'marker_only'.
 *
 * @param fileContent - Full text content of the file.
 * @param markers - Marker configuration with start and end strings.
 * @returns Classification indicating whether custom content is present.
 */
export function analyzeCustomContent(
  fileContent: string,
  markers: MarkerConfig,
): CustomContentClassification {
  const startPos = fileContent.indexOf(markers.start);
  const endPos = fileContent.indexOf(markers.end);

  // Incomplete or missing markers → 'marker_only'
  if (startPos === -1 || endPos === -1 || endPos < startPos) {
    return "marker_only";
  }

  // Remove the first marker pair and all enclosed content
  const afterEnd = endPos + markers.end.length;
  const remaining = fileContent.slice(0, startPos) + fileContent.slice(afterEnd);

  // Strip remaining whitespace (spaces, newlines, tabs)
  const stripped = remaining.replace(/\s/g, "");

  return stripped.length > 0 ? "has_custom_content" : "marker_only";
}
