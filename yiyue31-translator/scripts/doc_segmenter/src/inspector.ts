/**
 * FileInspector implementation.
 *
 * Inspects source files and returns metadata (SourceFileInfo).
 * Raises SplitError(exitCode=1) for not found, SplitError(exitCode=2) for >5MB.
 */

import { existsSync, statSync, readFileSync } from "node:fs";

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

    // Read content as UTF-8 (web sources are assumed UTF-8; the decoder strips any BOM)
    const rawBytes = readFileSync(filePath);
    let content = new TextDecoder("utf-8").decode(rawBytes);

    // Normalize line endings (Python's open(encoding=...) does this automatically)
    content = normalizeNewlines(content);

    // file_size based on disk bytes (matches os.path.getsize in Python)
    const fileSize = diskSize / 1024.0;

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
      fileEncoding: "utf-8",
    };
  }
}
