/**
 * Paired marker validator module.
 *
 * Validates that start/end marker pairs are correctly structured,
 * ordered, and that the content between them meets minimum length
 * requirements.
 */

import type {
  MarkerIssueIdentifier,
  PairedMarkerValidationResult,
  ContentIssueResult,
} from "../types/index.js";

/**
 * Validate paired markers in a file's content.
 *
 * Checks for correct start/end marker ordering, absence of duplicate pairs,
 * and minimum content length between markers.
 *
 * @param fileContent - Full text content of the file.
 * @param startMarker - Opening marker string.
 * @param endMarker - Closing marker string.
 * @param minContentLength - Minimum required characters between markers.
 * @param filePath - Path of the file being validated (used in content_issue).
 * @returns Validation result with issues and extracted content.
 */
export function validatePairedMarkers(
  fileContent: string,
  startMarker: string,
  endMarker: string,
  minContentLength: number,
  filePath: string,
): PairedMarkerValidationResult {
  const issues: MarkerIssueIdentifier[] = [];

  // Count occurrences using indexOf
  let startCount = 0;
  let endCount = 0;
  let searchOffset = 0;

  while (searchOffset < fileContent.length) {
    const idx = fileContent.indexOf(startMarker, searchOffset);
    if (idx === -1) break;
    startCount++;
    searchOffset = idx + startMarker.length;
  }

  searchOffset = 0;
  while (searchOffset < fileContent.length) {
    const idx = fileContent.indexOf(endMarker, searchOffset);
    if (idx === -1) break;
    endCount++;
    searchOffset = idx + endMarker.length;
  }

  // marker_count = number of pairs (min of start and end counts)
  const marker_count = Math.min(startCount, endCount);

  // Find positions of first occurrences
  const firstStartIdx = fileContent.indexOf(startMarker);
  const firstEndIdx = fileContent.indexOf(endMarker);

  // Rule 1: Start marker must exist
  if (startCount === 0) {
    issues.push("missing_start_marker");
  }

  // Rule 2: End marker must exist
  if (endCount === 0) {
    issues.push("missing_end_marker");
  }

  // Rule 3: Order must be correct (start before end)
  // Only check if both markers exist
  if (startCount > 0 && endCount > 0 && firstStartIdx > firstEndIdx) {
    issues.push("marker_order_reversed");
  }

  // Rule 4: Exactly one pair allowed
  if (marker_count > 1) {
    issues.push("multiple_marker_pairs");
  }

  // Rule 5: Content length check
  // Extract content between first start and first end marker
  // Check content length even alongside other marker issues
  let extracted_content: string | null = null;
  let content_issue: ContentIssueResult | null = null;

  if (firstStartIdx !== -1 && firstEndIdx !== -1 && firstStartIdx < firstEndIdx) {
    const contentStart = firstStartIdx + startMarker.length;
    const contentEnd = firstEndIdx;
    extracted_content = fileContent.substring(contentStart, contentEnd);

    if (extracted_content.length < minContentLength) {
      issues.push("content_too_short");
      content_issue = {
        file: filePath,
        issues: ["content_too_short"],
        detail: {
          actual_length: extracted_content.length,
          min_required: minContentLength,
        },
      };
    }
  }

  const valid = issues.length === 0;

  return {
    valid,
    issues,
    marker_count,
    extracted_content,
    content_issue,
  };
}
