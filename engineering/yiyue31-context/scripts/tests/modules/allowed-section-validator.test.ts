/**
 * Tests for the allowed-section-validator module.
 *
 * Covers the adaptive rule from the rewritten SKILL.md: a managed file is
 * valid when every `## `-level section heading inside the marker block is in
 * the allowed set; it need NOT contain all six sections.
 */

import { validateAllowedSections } from "../../src/modules/allowed-section-validator.js";

const START = "<!-- skill: yiyue31-context -->";
const END = "<!-- /yiyue31-context -->";

// The six skill-managed section names (Chinese + English aliases).
const SIX = [
  "目录职责", "Directory Purpose",
  "关键文件", "Key Files",
  "设计要点与原因", "Design Notes & Why",
  "约定与陷阱", "Conventions & Traps",
  "依赖关系", "Dependencies",
  "扩展指南", "Extension Guide",
];

function withMarkers(inner: string): string {
  return `# AI Coding Auto Sections\n${START}\n${inner}\n${END}\n`;
}

// ---------------------------------------------------------------------------
// Test 1: empty allowed set disables the check
// ---------------------------------------------------------------------------
describe("validateAllowedSections — empty allowed set disables check", () => {
  it("returns [] when allowedSectionNames is empty", () => {
    const content = withMarkers("## 目录职责\n做X\n## 非法段\nY\n");
    expect(validateAllowedSections("f", content, START, END, [])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Test 2: full six-section set passes
// ---------------------------------------------------------------------------
describe("validateAllowedSections — full six-section set passes", () => {
  it("returns [] when the marker block contains the full bilingual six-section set", () => {
    const inner =
      "## 目录职责 / Directory Purpose\n做X\n" +
      "## 关键文件 / Key Files\n表\n" +
      "## 设计要点与原因 / Design Notes & Why\n原因\n" +
      "## 约定与陷阱 / Conventions & Traps\n约定\n" +
      "## 依赖关系 / Dependencies\n依赖\n" +
      "## 扩展指南 / Extension Guide\n指南\n";
    expect(validateAllowedSections("f", withMarkers(inner), START, END, SIX)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Test 3: adaptive subset passes (missing sections are NOT reported)
// ---------------------------------------------------------------------------
describe("validateAllowedSections — adaptive subset passes", () => {
  it("returns [] when only a subset of sections is present", () => {
    const inner = "## 目录职责\n做X\n## 关键文件\n表\n";
    expect(validateAllowedSections("f", withMarkers(inner), START, END, SIX)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Test 4: bilingual heading allowed via either slash-separated part
// ---------------------------------------------------------------------------
describe("validateAllowedSections — bilingual heading", () => {
  it("accepts '目录职责 / Directory Purpose' when only the Chinese name is allowed", () => {
    const inner = "## 目录职责 / Directory Purpose\n做X\n";
    expect(validateAllowedSections("f", withMarkers(inner), START, END, ["目录职责"])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Test 5: disallowed heading inside markers is flagged
// ---------------------------------------------------------------------------
describe("validateAllowedSections — disallowed heading flagged", () => {
  it("returns the disallowed heading", () => {
    const inner = "## 目录职责\n做X\n## 非法段 / Illegal\nY\n";
    const result = validateAllowedSections("f", withMarkers(inner), START, END, SIX);
    expect(result).toHaveLength(1);
    expect(result[0].headings).toContain("非法段 / Illegal");
  });
});

// ---------------------------------------------------------------------------
// Test 6: headings OUTSIDE the markers are not examined
// (the human-maintained 雷区 region lives outside the markers)
// ---------------------------------------------------------------------------
describe("validateAllowedSections — headings outside markers ignored", () => {
  it("does not report a disallowed heading that appears after the end marker", () => {
    const content = withMarkers("## 目录职责\n做X\n") + "## 雷区 / Traps\n人写\n";
    expect(validateAllowedSections("f", content, START, END, SIX)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Test 7: no marker block → nothing to check
// ---------------------------------------------------------------------------
describe("validateAllowedSections — no marker block", () => {
  it("returns [] when markers are absent", () => {
    const content = "# AI Coding Auto Sections\n## 目录职责\n做X\n";
    expect(validateAllowedSections("f", content, START, END, SIX)).toEqual([]);
  });
});
