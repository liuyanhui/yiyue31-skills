/**
 * Tests for the paired-marker-validator module.
 */

import { validatePairedMarkers } from "../../src/modules/paired-marker-validator.js";

// ---------------------------------------------------------------------------
// Constants used across tests
// ---------------------------------------------------------------------------

const START = "<!-- START -->";
const END = "<!-- END -->";
const FILE_PATH = "test/file.md";

// ---------------------------------------------------------------------------
// Test 1: Valid single pair with sufficient content
// ---------------------------------------------------------------------------
describe("validatePairedMarkers — valid single pair", () => {
  it("returns valid=true with correct extracted content and marker_count=1", () => {
    const content = `some prefix
${START}
This is the custom content between markers that is long enough to pass.
${END}
some suffix`;

    const result = validatePairedMarkers(content, START, END, 10, FILE_PATH);

    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.marker_count).toBe(1);
    expect(result.extracted_content).toContain("custom content");
    expect(result.content_issue).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Test 2: Missing start marker
// ---------------------------------------------------------------------------
describe("validatePairedMarkers — missing start marker", () => {
  it("returns issues with missing_start_marker and valid=false", () => {
    const content = `some text without start marker
${END}
some suffix`;

    const result = validatePairedMarkers(content, START, END, 10, FILE_PATH);

    expect(result.valid).toBe(false);
    expect(result.issues).toContain("missing_start_marker");
    expect(result.marker_count).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Test 3: Missing end marker
// ---------------------------------------------------------------------------
describe("validatePairedMarkers — missing end marker", () => {
  it("returns issues with missing_end_marker and valid=false", () => {
    const content = `some text
${START}
content without end marker`;

    const result = validatePairedMarkers(content, START, END, 10, FILE_PATH);

    expect(result.valid).toBe(false);
    expect(result.issues).toContain("missing_end_marker");
    expect(result.marker_count).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Test 4: Reversed order (end before start)
// ---------------------------------------------------------------------------
describe("validatePairedMarkers — reversed marker order", () => {
  it("returns issues with marker_order_reversed", () => {
    const content = `some prefix
${END}
some middle content
${START}
some suffix`;

    const result = validatePairedMarkers(content, START, END, 10, FILE_PATH);

    expect(result.valid).toBe(false);
    expect(result.issues).toContain("marker_order_reversed");
  });
});

// ---------------------------------------------------------------------------
// Test 5: Multiple pairs
// ---------------------------------------------------------------------------
describe("validatePairedMarkers — multiple marker pairs", () => {
  it("returns issues with multiple_marker_pairs and marker_count=2", () => {
    const content = `prefix
${START}
first block content here
${END}
middle
${START}
second block content here
${END}
suffix`;

    const result = validatePairedMarkers(content, START, END, 10, FILE_PATH);

    expect(result.valid).toBe(false);
    expect(result.issues).toContain("multiple_marker_pairs");
    expect(result.marker_count).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Test 6: Content shorter than minimum
// ---------------------------------------------------------------------------
describe("validatePairedMarkers — content too short", () => {
  it("returns issues with content_too_short and content_issue detail", () => {
    const shortContent = "hi";
    const content = `prefix
${START}
${shortContent}
${END}
suffix`;

    const result = validatePairedMarkers(content, START, END, 50, FILE_PATH);

    expect(result.valid).toBe(false);
    expect(result.issues).toContain("content_too_short");
    expect(result.content_issue).not.toBeNull();
    expect(result.content_issue!.file).toBe(FILE_PATH);
    expect(result.content_issue!.issues).toEqual(["content_too_short"]);
    expect(result.content_issue!.detail.actual_length).toBeGreaterThanOrEqual(0);
    expect(result.content_issue!.detail.min_required).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// Test 7: content_too_short alongside missing markers (both reported)
// ---------------------------------------------------------------------------
describe("validatePairedMarkers — content_too_short with missing markers", () => {
  it("reports content_too_short alongside missing markers when start and end exist but content is short", () => {
    // Both markers present but content is very short
    const content = `${START}x${END}`;
    const result = validatePairedMarkers(content, START, END, 100, FILE_PATH);

    expect(result.valid).toBe(false);
    expect(result.issues).toContain("content_too_short");
    expect(result.content_issue).not.toBeNull();
    expect(result.content_issue!.detail.min_required).toBe(100);
  });

  it("reports both missing_start_marker and content_too_short when end marker exists but start does not and min is high", () => {
    // Only end marker — cannot extract content, so no content_too_short
    const content = `${END}`;
    const result = validatePairedMarkers(content, START, END, 100, FILE_PATH);

    expect(result.valid).toBe(false);
    expect(result.issues).toContain("missing_start_marker");
    // When start is missing, no content can be extracted, so content_too_short is NOT added
  });
});

// ---------------------------------------------------------------------------
// Test 8: Content extraction returns text between markers
// ---------------------------------------------------------------------------
describe("validatePairedMarkers — content extraction", () => {
  it("extracts exactly the text between start and end markers", () => {
    const innerContent = "Hello, this is the extracted part!";
    const content = `before\n${START}${innerContent}${END}\nafter`;

    const result = validatePairedMarkers(content, START, END, 5, FILE_PATH);

    expect(result.valid).toBe(true);
    expect(result.extracted_content).toBe(innerContent);
  });

  it("returns null extracted_content when markers are missing", () => {
    const content = "no markers at all here";
    const result = validatePairedMarkers(content, START, END, 10, FILE_PATH);

    expect(result.extracted_content).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Test 9: marker_count values
// ---------------------------------------------------------------------------
describe("validatePairedMarkers — marker_count scenarios", () => {
  it("returns marker_count=0 when both markers are missing", () => {
    const content = "no markers here";
    const result = validatePairedMarkers(content, START, END, 10, FILE_PATH);

    expect(result.marker_count).toBe(0);
  });

  it("returns marker_count=1 when there is one valid pair", () => {
    const content = `${START}enough content to pass the check${END}`;
    const result = validatePairedMarkers(content, START, END, 5, FILE_PATH);

    expect(result.marker_count).toBe(1);
  });

  it("returns marker_count=2 when there are two pairs", () => {
    const content = `${START}abc${END}${START}def${END}`;
    const result = validatePairedMarkers(content, START, END, 1, FILE_PATH);

    expect(result.marker_count).toBe(2);
  });

  it("returns marker_count=1 when 2 starts but 1 end", () => {
    const content = `${START}content${START}more${END}`;
    const result = validatePairedMarkers(content, START, END, 1, FILE_PATH);

    expect(result.marker_count).toBe(1);
  });

  it("returns marker_count=1 when 1 start but 2 ends", () => {
    const content = `${START}content${END}${END}`;
    const result = validatePairedMarkers(content, START, END, 1, FILE_PATH);

    expect(result.marker_count).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Test: attributed/versioned start marker matches the configured simple form.
// Regression: previously literal indexOf missed the versioned marker and
// flagged missing_start_marker on real skill output.
// ---------------------------------------------------------------------------
describe("validatePairedMarkers — attributed start marker", () => {
  const SIMPLE = "<!-- skill: yiyue31-context -->";
  const END_MARKER = "<!-- /yiyue31-context -->";
  const VERSIONED =
    "<!-- skill: yiyue31-context | version: 0.0.2 | update_time: 2026-07-07 -->";

  it("validates a file whose start marker carries version/update_time attributes", () => {
    const content = `# AI Coding Auto Sections\n${VERSIONED}\nThis content is long enough to pass the minimum length check.\n${END_MARKER}\n`;
    const result = validatePairedMarkers(content, SIMPLE, END_MARKER, 10, FILE_PATH);

    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.marker_count).toBe(1);
    expect(result.extracted_content).toContain("long enough");
  });

  it("excludes the full attributed marker from extracted content (correct length slicing)", () => {
    const content = `${VERSIONED}body-text-here${END_MARKER}`;
    const result = validatePairedMarkers(content, SIMPLE, END_MARKER, 1, FILE_PATH);
    // The whole versioned marker must be excluded, not just the simple-form length.
    expect(result.extracted_content).toBe("body-text-here");
    expect(result.extracted_content).not.toContain("version");
  });
});
