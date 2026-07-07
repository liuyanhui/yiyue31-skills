/**
 * Shared marker-matching helpers.
 *
 * Why this exists: the configured `markers.start` is the simple form
 * `<!-- skill: yiyue31-context -->`, but the skill actually writes a richer
 * start marker with attributes, e.g.
 * `<!-- skill: yiyue31-context | version: 0.0.2 | update_time: 2026-07-07 -->`.
 * Literal substring matching (`indexOf`/`includes`) misses the versioned form,
 * so a real skill-generated CLAUDE.md would be flagged as missing its marker
 * and its `update_time` could never be read.
 *
 * These helpers match by the marker's STABLE PREFIX (the marker text with the
 * trailing `-->` stripped), then allow any same-line, non-`>` run (the
 * `| key: value` attributes) before the closing `-->`. The end marker
 * `<!-- /yiyue31-context -->` has no attributes and matches the same way.
 */

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Regex source that matches a marker in either its simple or attributed form.
 * Built from the marker's stable prefix (trailing `-->` stripped) plus a
 * same-line run of non-`>` characters and the closing `-->`.
 */
function markerRegexSource(marker: string): string {
  const prefix = marker.replace(/\s*-->\s*$/, "").trimEnd();
  return `${escapeRegex(prefix)}[^>\\n]*-->`;
}

/**
 * Index of the first marker occurrence at or after `fromIndex`, or -1.
 * Matches the configured marker OR its attributed variant.
 */
export function findMarkerIndex(
  content: string,
  marker: string,
  fromIndex: number = 0,
): number {
  const re = new RegExp(markerRegexSource(marker), "g");
  re.lastIndex = fromIndex;
  const m = re.exec(content);
  return m ? m.index : -1;
}

/**
 * Length of the marker occurrence that starts exactly at `index` in `content`.
 * A versioned start marker is longer than the configured simple form, so
 * `marker.length` would under-count when slicing the content between markers.
 * Falls back to `marker.length` if no attributed match starts at `index`.
 */
export function matchedMarkerLength(
  content: string,
  marker: string,
  index: number,
): number {
  const re = new RegExp(markerRegexSource(marker), "g");
  re.lastIndex = index;
  const m = re.exec(content);
  if (m && m.index === index) return m[0].length;
  return marker.length;
}

/** True if `content` contains a marker occurrence (simple or attributed). */
export function containsMarker(content: string, marker: string): boolean {
  return new RegExp(markerRegexSource(marker)).test(content);
}

/**
 * The full text of the first marker occurrence (simple or attributed), or null.
 * Useful where the attributed form is load-bearing — e.g. extracting
 * `update_time` from the start marker for staleness detection.
 */
export function extractMarkerMatch(
  content: string,
  marker: string,
  fromIndex: number = 0,
): string | null {
  const re = new RegExp(markerRegexSource(marker), "g");
  re.lastIndex = fromIndex;
  const m = re.exec(content);
  return m ? m[0] : null;
}
