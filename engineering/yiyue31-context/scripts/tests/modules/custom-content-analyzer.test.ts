/**
 * Tests for the custom-content-analyzer module.
 */

import { analyzeCustomContent } from "../../src/modules/custom-content-analyzer.js";
import type { MarkerConfig } from "../../src/types/index.js";

// ---------------------------------------------------------------------------
// Constants used across tests
// ---------------------------------------------------------------------------

const MARKERS: MarkerConfig = {
  start: "<!-- START -->",
  end: "<!-- END -->",
  update_time_field: "update_time",
};

// ---------------------------------------------------------------------------
// Test 1: Content before markers → 'has_custom_content'
// ---------------------------------------------------------------------------
describe("analyzeCustomContent — content before markers", () => {
  it("returns 'has_custom_content' when there is text before the marker block", () => {
    const content = `Some custom text before markers
${MARKERS.start}
enclosed content
${MARKERS.end}`;

    const result = analyzeCustomContent(content, MARKERS);
    expect(result).toBe("has_custom_content");
  });
});

// ---------------------------------------------------------------------------
// Test 2: Content after markers → 'has_custom_content'
// ---------------------------------------------------------------------------
describe("analyzeCustomContent — content after markers", () => {
  it("returns 'has_custom_content' when there is text after the marker block", () => {
    const content = `${MARKERS.start}
enclosed content
${MARKERS.end}
Some custom text after markers`;

    const result = analyzeCustomContent(content, MARKERS);
    expect(result).toBe("has_custom_content");
  });
});

// ---------------------------------------------------------------------------
// Test 3: Content both before and after → 'has_custom_content'
// ---------------------------------------------------------------------------
describe("analyzeCustomContent — content before and after markers", () => {
  it("returns 'has_custom_content' when there is text both before and after", () => {
    const content = `Before text
${MARKERS.start}
enclosed content
${MARKERS.end}
After text`;

    const result = analyzeCustomContent(content, MARKERS);
    expect(result).toBe("has_custom_content");
  });
});

// ---------------------------------------------------------------------------
// Test 4: Only markers and enclosed content → 'marker_only'
// ---------------------------------------------------------------------------
describe("analyzeCustomContent — only markers and enclosed content", () => {
  it("returns 'marker_only' when file contains nothing beyond the marker block", () => {
    const content = `${MARKERS.start}
enclosed content
${MARKERS.end}`;

    const result = analyzeCustomContent(content, MARKERS);
    expect(result).toBe("marker_only");
  });
});

// ---------------------------------------------------------------------------
// Test 5: Markers with whitespace outside → 'marker_only'
// ---------------------------------------------------------------------------
describe("analyzeCustomContent — markers with whitespace outside", () => {
  it("returns 'marker_only' when only whitespace surrounds the marker block", () => {
    const content = `   \n\t
${MARKERS.start}
enclosed content
${MARKERS.end}
\n  \t  `;

    const result = analyzeCustomContent(content, MARKERS);
    expect(result).toBe("marker_only");
  });
});

// ---------------------------------------------------------------------------
// Test 6: No markers → 'marker_only'
// ---------------------------------------------------------------------------
describe("analyzeCustomContent — no markers", () => {
  it("returns 'marker_only' when neither start nor end marker is present", () => {
    const content = "This is just some text with no markers at all.";

    const result = analyzeCustomContent(content, MARKERS);
    expect(result).toBe("marker_only");
  });
});

// ---------------------------------------------------------------------------
// Test 7: Incomplete markers (only start) → 'marker_only'
// ---------------------------------------------------------------------------
describe("analyzeCustomContent — incomplete markers", () => {
  it("returns 'marker_only' when only the start marker is present", () => {
    const content = `${MARKERS.start}
Some content without an end marker.`;

    const result = analyzeCustomContent(content, MARKERS);
    expect(result).toBe("marker_only");
  });

  it("returns 'marker_only' when only the end marker is present", () => {
    const content = `Some content without a start marker.
${MARKERS.end}`;

    const result = analyzeCustomContent(content, MARKERS);
    expect(result).toBe("marker_only");
  });
});
