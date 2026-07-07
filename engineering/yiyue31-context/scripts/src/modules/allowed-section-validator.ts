/**
 * Allowed-section validator module.
 *
 * Adaptive check that scans the marker-block content for `## `-level
 * managed-section headings and flags any whose name is NOT in the configured
 * allowed set.
 *
 * Why adaptive: a valid file need only ensure that every managed-section
 * heading it DOES contain is from the allowed set. It is NOT required to
 * contain all listed sections — the skill skips empty sections, so a real
 * file may legitimately contain a subset. This mirrors the rewritten
 * SKILL.md rule: "Skip any section that has no content."
 *
 * Only content BETWEEN the start and end markers is examined. Headings
 * outside the markers (e.g. the human-maintained `## 雷区 / Traps` region)
 * are not skill-managed and are never reported here.
 */

import type { DisallowedSectionEntry } from "../types/index.js";

/**
 * Validate that every `## `-level heading inside the marker block is in the
 * allowed set.
 *
 * A heading is considered allowed when the full heading text matches, OR any
 * one of its ` / `-separated parts matches. This lets bilingual headings such
 * as `目录职责 / Directory Purpose` validate against either side.
 *
 * @param filePath            - Path of the file being validated (for reporting).
 * @param fileContent         - Full text content of the file.
 * @param startMarker         - Opening marker string.
 * @param endMarker           - Closing marker string.
 * @param allowedSectionNames - Allowed section names (Chinese and/or English).
 *                              An empty array disables the check.
 * @returns A single entry listing the disallowed headings, or an empty array
 *          when there is nothing to report.
 */
export function validateAllowedSections(
  filePath: string,
  fileContent: string,
  startMarker: string,
  endMarker: string,
  allowedSectionNames: string[],
): DisallowedSectionEntry[] {
  if (allowedSectionNames.length === 0) {
    return [];
  }

  const startIdx = fileContent.indexOf(startMarker);
  const endIdx = fileContent.indexOf(endMarker);
  // No marker block, or markers reversed/identical → nothing to check.
  if (startIdx === -1 || endIdx === -1 || startIdx >= endIdx) {
    return [];
  }

  const blockContent = fileContent.substring(
    startIdx + startMarker.length,
    endIdx,
  );

  const allowed = new Set(
    allowedSectionNames.map((name) => name.trim()).filter(Boolean),
  );

  // Match `## `-level headings only (two hashes + whitespace). `#` (H1) and
  // `###` (H3) are intentionally excluded — managed sections are H2.
  const headingRe = /^##[ \t]+(.+)$/gm;

  const disallowed: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = headingRe.exec(blockContent)) !== null) {
    const heading = match[1].trim();
    // A bilingual heading is split on " / " so either name can satisfy the
    // allowed set. Also accept the full heading text verbatim.
    const parts = heading
      .split("/")
      .map((part) => part.trim())
      .filter(Boolean);
    const isAllowed =
      allowed.has(heading) || parts.some((part) => allowed.has(part));
    if (!isAllowed) {
      disallowed.push(heading);
    }
  }

  if (disallowed.length === 0) {
    return [];
  }
  return [{ file: filePath, headings: disallowed }];
}
