/**
 * Tests for the marker-position-analyzer module.
 */

import { analyzeMarkerPosition } from "../../src/modules/marker-position-analyzer.js";
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
// Test 1: Start marker at very beginning → 'head'
// ---------------------------------------------------------------------------
describe("analyzeMarkerPosition — start marker at very beginning", () => {
  it("returns 'head' when the marker block is at the start of the file", () => {
    const content = `${MARKERS.start}
This is some content inside the marker block.
${MARKERS.end}
${"padding".repeat(20)}`;

    const result = analyzeMarkerPosition(content, MARKERS);
    expect(result).toBe("head");
  });
});

// ---------------------------------------------------------------------------
// Test 2: End marker at very end → 'tail'
// ---------------------------------------------------------------------------
describe("analyzeMarkerPosition — end marker at very end", () => {
  it("returns 'tail' when the marker block is at the end of the file", () => {
    const content = `${"padding".repeat(20)}
${MARKERS.start}
This is some content inside the marker block.
${MARKERS.end}`;

    const result = analyzeMarkerPosition(content, MARKERS);
    expect(result).toBe("tail");
  });
});

// ---------------------------------------------------------------------------
// Test 3: Markers in the middle → 'middle'
// ---------------------------------------------------------------------------
describe("analyzeMarkerPosition — markers in the middle", () => {
  it("returns 'middle' when the marker block is in the middle of the file", () => {
    const prefix = "a".repeat(100);
    const suffix = "b".repeat(100);
    const content = `${prefix}
${MARKERS.start}
content here
${MARKERS.end}
${suffix}`;

    const result = analyzeMarkerPosition(content, MARKERS);
    expect(result).toBe("middle");
  });
});

// ---------------------------------------------------------------------------
// Test 4: Content with BOM before start marker still 'head' after normalization
// ---------------------------------------------------------------------------
describe("analyzeMarkerPosition — BOM handling", () => {
  it("returns 'head' when BOM is present before start marker at beginning", () => {
    const BOM = "﻿"; // U+FEFF decoded form
    const content = `${BOM}${MARKERS.start}
This is some content inside the marker block.
${MARKERS.end}
${"tail_padding".repeat(20)}`;

    const result = analyzeMarkerPosition(content, MARKERS);
    expect(result).toBe("head");
  });
});

// ---------------------------------------------------------------------------
// Test 5: Markers at exact 1/3 boundary → 'head'
// ---------------------------------------------------------------------------
describe("analyzeMarkerPosition — exact 1/3 boundary", () => {
  it("returns 'middle' when marker block center is exactly at the 1/3 boundary (strict <)", () => {
    // MARKERS.start = "<!-- START -->" = 14 chars
    // MARKERS.end = "<!-- END -->" = 12 chars (note: 2 spaces before END)
    // block = start + end = 26 chars
    // For center == oneThird: (startPos + endPos + 12) / 2 = totalLength / 3
    // With markers back-to-back: endPos = startPos + 14
    // (startPos + startPos + 14 + 12) / 2 = totalLength / 3
    // (2*startPos + 26) / 2 = totalLength / 3
    // startPos + 13 = totalLength / 3

    // Pick totalLength = 300 → oneThird = 100
    // startPos = 100 - 13 = 87
    // prefix = 87 chars, block = 26 chars, suffix = 300 - 87 - 26 = 187 chars
    const prefix = "a".repeat(87);
    const block = `${MARKERS.start}${MARKERS.end}`;
    const suffix = "b".repeat(187);
    const content = `${prefix}${block}${suffix}`;

    // Verify total length
    expect(content.length).toBe(300);

    // startPos = 87, endPos = 87 + 14 = 101
    // center = (87 + 101 + 12) / 2 = 200/2 = 100
    // oneThird = 100 → center < oneThird is false → 'middle'
    const result = analyzeMarkerPosition(content, MARKERS);
    expect(result).toBe("middle");
  });

  it("returns 'head' when marker block center is just inside the 1/3 boundary", () => {
    // Use startPos = 86 so center < 100
    // center = (86 + 100 + 12) / 2 = 198/2 = 99
    // oneThird = 100 → 99 < 100 → 'head'
    const prefix = "a".repeat(86);
    const block = `${MARKERS.start}${MARKERS.end}`;
    const totalTarget = 300;
    const suffixLen = totalTarget - prefix.length - block.length;
    const suffix = "b".repeat(suffixLen);
    const content = `${prefix}${block}${suffix}`;

    expect(content.length).toBe(300);
    const result = analyzeMarkerPosition(content, MARKERS);
    expect(result).toBe("head");
  });
});

// ---------------------------------------------------------------------------
// Test 6: Whitespace-only content around markers handled correctly
// ---------------------------------------------------------------------------
describe("analyzeMarkerPosition — whitespace handling", () => {
  it("trims leading/trailing whitespace and classifies correctly", () => {
    // After trim, content starts with start marker.
    // We need enough trailing padding to ensure center falls in first 1/3.
    const tailPadding = "z".repeat(200);
    const content = `   \n  \t
${MARKERS.start}
content
${MARKERS.end}
${tailPadding}
   \n  `;

    // After trim: "<!-- START -->\ncontent\n<!-- END -->\n" + 200 z's
    // The marker block is at the start, center should be in first 1/3.
    const result = analyzeMarkerPosition(content, MARKERS);
    expect(result).toBe("head");
  });

  it("handles whitespace-only content with markers in the middle", () => {
    const prefix = "   \n  ".repeat(15);
    const suffix = "   \n  ".repeat(15);
    const content = `${prefix}${MARKERS.start}content${MARKERS.end}${suffix}`;

    const result = analyzeMarkerPosition(content, MARKERS);
    expect(result).toBe("middle");
  });
});

// ---------------------------------------------------------------------------
// Test 7: No markers → 'middle'
// ---------------------------------------------------------------------------
describe("analyzeMarkerPosition — no markers found", () => {
  it("returns 'middle' when neither start nor end marker is present", () => {
    const content = "This is just some regular text without any markers at all.";

    const result = analyzeMarkerPosition(content, MARKERS);
    expect(result).toBe("middle");
  });

  it("returns 'middle' when only start marker is present (no end marker)", () => {
    const content = `${MARKERS.start}
Some content without an end marker.
More text here.`;

    const result = analyzeMarkerPosition(content, MARKERS);
    expect(result).toBe("middle");
  });

  it("returns 'middle' when only end marker is present (no start marker)", () => {
    const content = `Some text without a start marker.
${MARKERS.end}
More text here.`;

    const result = analyzeMarkerPosition(content, MARKERS);
    expect(result).toBe("middle");
  });
});

// ---------------------------------------------------------------------------
// Test 8: Edge cases
// ---------------------------------------------------------------------------
describe("analyzeMarkerPosition — edge cases", () => {
  it("returns 'middle' for empty string content", () => {
    const result = analyzeMarkerPosition("", MARKERS);
    expect(result).toBe("middle");
  });

  it("returns 'middle' for content that is only the marker block (center > 1/3)", () => {
    // When content is just the marker block, center = (0 + 21 + 12) / 2 = 16.5
    // totalLength = 33, oneThird = 11 → center > oneThird → 'middle'
    const content = `${MARKERS.start}content${MARKERS.end}`;
    const result = analyzeMarkerPosition(content, MARKERS);
    expect(result).toBe("middle");
  });

  it("returns 'head' when marker block is at start with sufficient trailing padding", () => {
    const content = `${MARKERS.start}content${MARKERS.end}${"x".repeat(200)}`;
    const result = analyzeMarkerPosition(content, MARKERS);
    expect(result).toBe("head");
  });

  it("handles BOM with empty content after normalization", () => {
    const BOM = "﻿";
    const result = analyzeMarkerPosition(BOM, MARKERS);
    expect(result).toBe("middle");
  });
});
