/**
 * Tests for the required-pattern-validator module.
 */

import { validateRequiredPatterns } from "../../src/modules/required-pattern-validator.js";

// ---------------------------------------------------------------------------
// Test 1: required_any with one match → passes (empty missing)
// ---------------------------------------------------------------------------
describe("validateRequiredPatterns — required_any with one match", () => {
  it("returns empty missing when at least one pattern matches", () => {
    const result = validateRequiredPatterns(
      "test.txt",
      "Hello World",
      ["World", "Missing"],
      [],
    );

    expect(result.required_any_missing).toEqual([]);
    expect(result.required_all_missing).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Test 2: required_any with no matches → returns both patterns as missing
// ---------------------------------------------------------------------------
describe("validateRequiredPatterns — required_any with no matches", () => {
  it("returns all patterns as missing when none match", () => {
    const result = validateRequiredPatterns(
      "test.txt",
      "Hello World",
      ["Foo", "Bar"],
      [],
    );

    expect(result.required_any_missing).toEqual(["Foo", "Bar"]);
    expect(result.required_all_missing).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Test 3: required_all all match → empty missing
// ---------------------------------------------------------------------------
describe("validateRequiredPatterns — required_all all match", () => {
  it("returns empty missing when all required_all patterns match", () => {
    const result = validateRequiredPatterns(
      "test.txt",
      "Hello World",
      [],
      ["Hello", "World"],
    );

    expect(result.required_any_missing).toEqual([]);
    expect(result.required_all_missing).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Test 4: required_all one missing → returns that one pattern
// ---------------------------------------------------------------------------
describe("validateRequiredPatterns — required_all one missing", () => {
  it("returns only the missing pattern when one fails", () => {
    const result = validateRequiredPatterns(
      "test.txt",
      "Hello World",
      [],
      ["Hello", "Missing"],
    );

    expect(result.required_any_missing).toEqual([]);
    expect(result.required_all_missing).toEqual(["Missing"]);
  });
});

// ---------------------------------------------------------------------------
// Test 5: Empty pattern arrays → empty missing arrays
// ---------------------------------------------------------------------------
describe("validateRequiredPatterns — empty pattern arrays", () => {
  it("returns empty missing arrays when both pattern arrays are empty", () => {
    const result = validateRequiredPatterns("test.txt", "Hello World", [], []);

    expect(result.required_any_missing).toEqual([]);
    expect(result.required_all_missing).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Test 6: Invalid regex pattern → throws error
// ---------------------------------------------------------------------------
describe("validateRequiredPatterns — invalid regex pattern", () => {
  it("throws an error for an invalid regex in required_any", () => {
    expect(() => {
      validateRequiredPatterns("test.txt", "Hello World", ["[invalid"], []);
    }).toThrow(/Invalid regex pattern/);
  });

  it("throws an error for an invalid regex in required_all", () => {
    expect(() => {
      validateRequiredPatterns("test.txt", "Hello World", [], ["[invalid"]);
    }).toThrow(/Invalid regex pattern/);
  });
});

// ---------------------------------------------------------------------------
// Test 7: Case-sensitive: 'Hello' does not match 'hello'
// ---------------------------------------------------------------------------
describe("validateRequiredPatterns — case sensitivity", () => {
  it("does not match when case differs (required_any)", () => {
    const result = validateRequiredPatterns(
      "test.txt",
      "hello world",
      ["Hello"],
      [],
    );

    expect(result.required_any_missing).toEqual(["Hello"]);
  });

  it("does not match when case differs (required_all)", () => {
    const result = validateRequiredPatterns(
      "test.txt",
      "hello world",
      [],
      ["Hello"],
    );

    expect(result.required_all_missing).toEqual(["Hello"]);
  });

  it("matches when case is identical (required_any)", () => {
    const result = validateRequiredPatterns(
      "test.txt",
      "hello world",
      ["hello"],
      [],
    );

    expect(result.required_any_missing).toEqual([]);
  });
});
