/**
 * FileInspector implementation.
 *
 * Inspects source files and returns metadata (SourceFileInfo).
 * Raises SplitError(exitCode=1) for not found, SplitError(exitCode=2) for >5MB.
 */

import { existsSync, statSync, readFileSync } from "node:fs";
import jschardet from "jschardet";

import { type SourceFileInfo } from "./models";
import { SplitError } from "./models";
import { MAX_FILE_SIZE_BYTES } from "./constants";
import { normalizeNewlines } from "./utils";

export class FileInspectorImpl {
  /**
   * Inspect a file and return its metadata.
   *
   * @param filePath - Path to the source file.
   * @returns SourceFileInfo with file metadata.
   * @throws SplitError exitCode=1 if file not found, exitCode=2 if exceeds 5MB.
   */
  inspect(filePath: string): SourceFileInfo {
    // Check file exists
    if (!existsSync(filePath)) {
      throw new SplitError(`File not found: ${filePath}`, 1);
    }

    // Check file size on disk (bytes)
    const diskSize = statSync(filePath).size;
    if (diskSize > MAX_FILE_SIZE_BYTES) {
      throw new SplitError(
        `File exceeds 5MB limit (${diskSize} bytes)`,
        2
      );
    }

    // Read raw bytes and detect encoding
    const rawBytes = readFileSync(filePath);
    const encoding = this.detectEncoding(rawBytes);

    // Read content as text with detected encoding
    const decoder = new TextDecoder(encoding);
    let content = decoder.decode(rawBytes);

    // Normalize line endings (Python's open(encoding=...) does this automatically)
    content = normalizeNewlines(content);

    // file_size based on disk bytes (matches os.path.getsize in Python)
    const fileSize = diskSize / 1024.0;

    // Re-check size against 5MB
    if (diskSize > MAX_FILE_SIZE_BYTES) {
      throw new SplitError(
        `File content exceeds 5MB limit (${fileSize} KB)`,
        2
      );
    }

    // Line count: matches Python's content.count("\n") + (1 if content and not content.endswith("\n") else 0)
    let fileLines = content.split("\n").length - 1; // number of \n characters
    if (content && !content.endsWith("\n")) {
      fileLines += 1;
    }

    const fileChars = content.length;

    return {
      filePath,
      fileSize,
      fileLines,
      fileChars,
      fileEncoding: encoding,
    };
  }

  /**
   * Detect encoding of raw bytes.
   *
   * Uses jschardet for detection with fallback to common encodings.
   * Normalizes encoding names to standard forms.
   *
   * @param rawBytes - The raw file bytes.
   * @returns The detected encoding string.
   */
  private detectEncoding(rawBytes: Uint8Array): string {
    const result = jschardet.detect(Buffer.from(rawBytes));
    let detected = result.encoding || "";

    if (detected) {
      // Normalize common aliases
      const detectedLower = detected.toLowerCase();
      if (detectedLower === "ascii" || detectedLower === "utf-8" || detectedLower === "utf-8-sig") {
        return "utf-8";
      }
      if (detectedLower === "gb2312" || detectedLower === "gb18030" || detectedLower === "gbk") {
        return detectedLower;
      }
      return detectedLower;
    }

    // Fallback: try common encodings
    for (const enc of ["utf-8", "gbk", "latin-1"]) {
      try {
        const decoder = new TextDecoder(enc);
        decoder.decode(rawBytes);
        return enc;
      } catch {
        continue;
      }
    }
    return "latin-1";
  }
}
