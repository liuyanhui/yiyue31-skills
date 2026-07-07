/**
 * Marker position analyzer module.
 *
 * Determines where the marker block sits within the file
 * (head, middle, or tail) based on relative position heuristics.
 */

import type { MarkerConfig, MarkerPositionClassification } from "../types/index.js";
import { findMarkerIndex, matchedMarkerLength } from "./marker-matcher.js";

/**
 * Analyze where the marker block is positioned within the file content.
 *
 * Algorithm:
 * 1. Normalize content: strip BOM, trim whitespace.
 * 2. Find start and end marker positions.
 * 3. If no markers found, return 'middle' (default).
 * 4. Compute marker block center: (startPos + endPos + endMarker.length) / 2.
 * 5. Classify based on position within normalized content:
 *    - center in first 1/3 → 'head'
 *    - center in last 1/3 → 'tail'
 *    - otherwise → 'middle'
 *
 * @param fileContent - Full text content of the file.
 * @param markers - Marker configuration with start and end strings.
 * @returns Classification of the marker block's position.
 */
export function analyzeMarkerPosition(
  fileContent: string,
  markers: MarkerConfig,
): MarkerPositionClassification {
  // Step 1: Normalize — strip BOM and trim
  const BOM = "﻿";
  let normalized = fileContent;
  if (normalized.startsWith(BOM)) {
    normalized = normalized.slice(BOM.length);
  }
  normalized = normalized.trim();

  const startMarker = markers.start;
  const endMarker = markers.end;

  // Step 2: Find marker positions (flexible: matches attributed markers too)
  const startPos = findMarkerIndex(normalized, startMarker);
  const endPos = findMarkerIndex(normalized, endMarker);

  // Step 3: No markers found → default 'middle'
  if (startPos === -1 || endPos === -1) {
    return "middle";
  }

  // Step 4: Compute marker block center
  const center = (startPos + endPos + matchedMarkerLength(normalized, endMarker, endPos)) / 2;

  // Step 5: Classify based on thirds of total content length
  const totalLength = normalized.length;

  // Edge case: empty content after normalization
  if (totalLength === 0) {
    return "middle";
  }

  const oneThird = totalLength / 3;

  if (center < oneThird) {
    return "head";
  }

  if (center >= oneThird * 2) {
    return "tail";
  }

  return "middle";
}
