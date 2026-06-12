/**
 * Tests for CLI argument parser module.
 */

import {
  parseCliArgs,
  MissingRequiredArgError,
  InvalidArgValueError,
  HelpRequestedError,
  CliParseError,
} from "../../src/modules/cli-parser.js";

// ---------------------------------------------------------------------------
// 1. Minimal valid args with --target
// ---------------------------------------------------------------------------
describe("parseCliArgs", () => {
  it("parses minimal valid args with --target", () => {
    const result = parseCliArgs(["--target", "./src"]);
    expect(result).toEqual({
      target: "./src",
      exclude: [],
      include: [],
      filename: "CLAUDE.md",
      config: undefined,
    });
  });

  // ---------------------------------------------------------------------------
  // 2. All flags with short form
  // ---------------------------------------------------------------------------
  it("parses all flags with short form", () => {
    const result = parseCliArgs([
      "-t", "./src",
      "-e", "a,b",
      "-i", "c",
      "-f", "R.md",
      "-c", "cfg.json",
    ]);
    expect(result).toEqual({
      target: "./src",
      exclude: ["a", "b"],
      include: ["c"],
      filename: "R.md",
      config: "cfg.json",
    });
  });

  // ---------------------------------------------------------------------------
  // 3. All flags with long form
  // ---------------------------------------------------------------------------
  it("parses all flags with long form", () => {
    const result = parseCliArgs([
      "--target", "./project",
      "--exclude", "node_modules,dist",
      "--include", "src,lib",
      "--filename", "README.md",
      "--config", "my-config.json",
    ]);
    expect(result).toEqual({
      target: "./project",
      exclude: ["node_modules", "dist"],
      include: ["src", "lib"],
      filename: "README.md",
      config: "my-config.json",
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Comma-separated exclude values
  // ---------------------------------------------------------------------------
  it("splits comma-separated exclude values", () => {
    const result = parseCliArgs(["--target", ".", "--exclude", "a,b,c"]);
    expect(result.exclude).toEqual(["a", "b", "c"]);
  });

  // ---------------------------------------------------------------------------
  // 5. Multiple --exclude flags accumulate
  // ---------------------------------------------------------------------------
  it("accumulates multiple --exclude flags", () => {
    const result = parseCliArgs([
      "--target", ".",
      "-e", "a,b",
      "-e", "c",
      "--exclude", "d,e",
    ]);
    expect(result.exclude).toEqual(["a", "b", "c", "d", "e"]);
  });

  // ---------------------------------------------------------------------------
  // 6. Missing --target throws MissingRequiredArgError
  // ---------------------------------------------------------------------------
  it("throws MissingRequiredArgError when --target is missing", () => {
    expect(() => parseCliArgs([])).toThrow(MissingRequiredArgError);
    expect(() => parseCliArgs([])).toThrow("Missing required argument: --target");
  });

  it("throws MissingRequiredArgError when only optional flags given", () => {
    expect(() => parseCliArgs(["--exclude", "a"])).toThrow(MissingRequiredArgError);
  });

  // ---------------------------------------------------------------------------
  // 7. Unknown flag throws InvalidArgValueError
  // ---------------------------------------------------------------------------
  it("throws InvalidArgValueError for unknown flag", () => {
    expect(() => parseCliArgs(["--unknown", "value"])).toThrow(InvalidArgValueError);
  });

  it("throws InvalidArgValueError for positional argument", () => {
    expect(() => parseCliArgs(["some-path"])).toThrow(InvalidArgValueError);
  });

  // ---------------------------------------------------------------------------
  // 8. Default values applied for optional params
  // ---------------------------------------------------------------------------
  it("applies default values for optional params", () => {
    const result = parseCliArgs(["--target", "/tmp/project"]);
    expect(result.exclude).toEqual([]);
    expect(result.include).toEqual([]);
    expect(result.filename).toBe("CLAUDE.md");
    expect(result.config).toBeUndefined();
  });

  // ---------------------------------------------------------------------------
  // 9. --help throws HelpRequestedError
  // ---------------------------------------------------------------------------
  it("throws HelpRequestedError for --help", () => {
    expect(() => parseCliArgs(["--help"])).toThrow(HelpRequestedError);
    expect(() => parseCliArgs(["--help"])).toThrow("Help requested");
  });

  // ---------------------------------------------------------------------------
  // 10. -h short form throws HelpRequestedError
  // ---------------------------------------------------------------------------
  it("throws HelpRequestedError for -h", () => {
    expect(() => parseCliArgs(["-h"])).toThrow(HelpRequestedError);
  });

  // ---------------------------------------------------------------------------
  // Additional edge cases
  // ---------------------------------------------------------------------------
  it("throws MissingRequiredArgError when value flag has no value", () => {
    expect(() => parseCliArgs(["--target"])).toThrow(MissingRequiredArgError);
  });

  it("throws MissingRequiredArgError when --exclude is last arg without value", () => {
    expect(() => parseCliArgs(["--target", ".", "--exclude"])).toThrow(MissingRequiredArgError);
  });

  it("handles --help before other flags", () => {
    expect(() => parseCliArgs(["--help", "--target", "."])).toThrow(HelpRequestedError);
  });

  it("accumulates include flags", () => {
    const result = parseCliArgs([
      "--target", ".",
      "--include", "a",
      "-i", "b,c",
    ]);
    expect(result.include).toEqual(["a", "b", "c"]);
  });

  it("trims whitespace from comma-separated values", () => {
    const result = parseCliArgs(["--target", ".", "--exclude", " a , b , c "]);
    expect(result.exclude).toEqual(["a", "b", "c"]);
  });

  it("filters out empty strings from comma-separated values", () => {
    const result = parseCliArgs(["--target", ".", "--exclude", "a,,b,"]);
    expect(result.exclude).toEqual(["a", "b"]);
  });
});

// ---------------------------------------------------------------------------
// Error class re-exports
// ---------------------------------------------------------------------------
describe("re-exported error classes", () => {
  it("CliParseError is the base class", () => {
    const err = new MissingRequiredArgError("--target");
    expect(err).toBeInstanceOf(CliParseError);
    expect(err).toBeInstanceOf(Error);
  });

  it("HelpRequestedError extends CliParseError", () => {
    const err = new HelpRequestedError();
    expect(err).toBeInstanceOf(CliParseError);
    expect(err.name).toBe("HelpRequestedError");
  });

  it("InvalidArgValueError has value property", () => {
    const err = new InvalidArgValueError("--bad", "val");
    expect(err.value).toBe("val");
    expect(err.arg).toBe("--bad");
  });
});
