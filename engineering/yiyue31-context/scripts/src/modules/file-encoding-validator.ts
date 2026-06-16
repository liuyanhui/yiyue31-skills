/**
 * File encoding validator module.
 *
 * Detects the encoding of file content and checks it against the
 * expected encoding, flagging any illegal byte sequences.
 */

import { readFileSync } from "node:fs";
import type { EncodingValidationResult, IllegalBytePosition } from "../types/index.js";

/**
 * Scan a buffer for illegal UTF-8 byte sequences and return their positions.
 *
 * Invalid patterns detected:
 * - Continuation bytes (0x80–0xBF) without a preceding leading byte
 * - Overlong encodings: 0xC0, 0xC1
 * - Invalid bytes: 0xFE, 0xFF
 * - Incomplete multi-byte sequences (truncated at end of buffer)
 */
function findIllegalUtf8Positions(buf: Buffer): IllegalBytePosition[] {
  const illegal: IllegalBytePosition[] = [];
  let i = 0;

  while (i < buf.length) {
    const byte = buf[i];

    // 0x00–0x7F: single-byte ASCII — always valid
    if (byte <= 0x7f) {
      i += 1;
      continue;
    }

    // 0xFE, 0xFF: never valid in UTF-8
    if (byte === 0xfe || byte === 0xff) {
      illegal.push({ offset: i, byteValue: byte });
      i += 1;
      continue;
    }

    // 0x80–0xBF: continuation byte without a leading byte
    if (byte >= 0x80 && byte <= 0xbf) {
      illegal.push({ offset: i, byteValue: byte });
      i += 1;
      continue;
    }

    // 0xC0, 0xC1: overlong 2-byte encodings (always illegal)
    if (byte === 0xc0 || byte === 0xc1) {
      illegal.push({ offset: i, byteValue: byte });
      i += 1;
      continue;
    }

    // 0xC2–0xDF: leading byte of a 2-byte sequence
    if (byte >= 0xc2 && byte <= 0xdf) {
      if (i + 1 < buf.length) {
        const next = buf[i + 1];
        if (next >= 0x80 && next <= 0xbf) {
          // Valid 2-byte sequence
          i += 2;
        } else {
          // Second byte is not a valid continuation byte
          illegal.push({ offset: i, byteValue: byte });
          i += 1;
        }
      } else {
        // Truncated: not enough bytes for the 2-byte sequence
        illegal.push({ offset: i, byteValue: byte });
        i += 1;
      }
      continue;
    }

    // 0xE0–0xEF: leading byte of a 3-byte sequence
    if (byte >= 0xe0 && byte <= 0xef) {
      const expectedContinuations = 2;
      let valid = true;

      // Special handling for 0xE0: second byte must be 0xA0–0xBF
      // (avoids overlong 3-byte encodings)
      if (byte === 0xe0) {
        if (i + 1 < buf.length) {
          const second = buf[i + 1];
          if (second < 0xa0 || second > 0xbf) {
            valid = false;
          }
        } else {
          valid = false;
        }
      }

      // Special handling for 0xED: second byte must be 0x80–0x9F
      // (avoids surrogate code points U+D800–U+DFFF)
      if (byte === 0xed) {
        if (i + 1 < buf.length) {
          const second = buf[i + 1];
          if (second < 0x80 || second > 0x9f) {
            valid = false;
          }
        } else {
          valid = false;
        }
      }

      if (valid) {
        for (let j = 1; j <= expectedContinuations; j++) {
          if (i + j >= buf.length || buf[i + j] < 0x80 || buf[i + j] > 0xbf) {
            valid = false;
            break;
          }
        }
      }

      if (valid) {
        i += 3;
      } else {
        illegal.push({ offset: i, byteValue: byte });
        i += 1;
      }
      continue;
    }

    // 0xF0–0xF4: leading byte of a 4-byte sequence
    if (byte >= 0xf0 && byte <= 0xf4) {
      const expectedContinuations = 3;
      let valid = true;

      // Special handling for 0xF0: second byte must be 0x90–0xBF
      // (avoids overlong 4-byte encodings)
      if (byte === 0xf0) {
        if (i + 1 < buf.length) {
          const second = buf[i + 1];
          if (second < 0x90 || second > 0xbf) {
            valid = false;
          }
        } else {
          valid = false;
        }
      }

      // Special handling for 0xF4: second byte must be 0x80–0x8F
      // (caps code point at U+10FFFF)
      if (byte === 0xf4) {
        if (i + 1 < buf.length) {
          const second = buf[i + 1];
          if (second < 0x80 || second > 0x8f) {
            valid = false;
          }
        } else {
          valid = false;
        }
      }

      if (valid) {
        for (let j = 1; j <= expectedContinuations; j++) {
          if (i + j >= buf.length || buf[i + j] < 0x80 || buf[i + j] > 0xbf) {
            valid = false;
            break;
          }
        }
      }

      if (valid) {
        i += 4;
      } else {
        illegal.push({ offset: i, byteValue: byte });
        i += 1;
      }
      continue;
    }

    // 0xF5–0xFD: values that would require 4+ bytes but are out of
    // the valid UTF-8 leading byte range
    illegal.push({ offset: i, byteValue: byte });
    i += 1;
  }

  return illegal;
}

/**
 * Validate that a file's content matches the expected encoding.
 *
 * Uses `TextDecoder` with `fatal: true` as the primary UTF-8 validation
 * mechanism. If decoding throws a `TypeError`, the buffer is scanned
 * byte-by-byte to identify illegal byte positions.
 *
 * @param filePath   - Absolute or relative path to the file.
 * @param expectedEncoding - Expected encoding name (e.g. `"utf-8"`).
 * @returns Validation result with detected encoding and illegal byte positions.
 */
export function validateEncoding(
  filePath: string,
  expectedEncoding: string,
): EncodingValidationResult {
  // Default error result for file-level failures
  const errorResult: EncodingValidationResult = {
    passed: false,
    detectedEncoding: "unknown",
    expectedEncoding,
    illegalBytes: [],
  };

  let buf: Buffer;
  try {
    buf = readFileSync(filePath);
  } catch {
    return errorResult;
  }

  // Normalise expected encoding for comparison
  const normalisedExpected = expectedEncoding.toLowerCase().replace(/[_-]/g, "");

  // Attempt UTF-8 decoding with fatal mode
  try {
    const decoder = new TextDecoder("utf-8", { fatal: true });
    decoder.decode(buf);

    // Decode succeeded — valid UTF-8
    const detectedEncoding = "utf-8";
    const normalisedDetected = detectedEncoding.toLowerCase().replace(/[_-]/g, "");

    return {
      passed: normalisedDetected === normalisedExpected,
      detectedEncoding,
      expectedEncoding,
      illegalBytes: [],
    };
  } catch {
    // Decode failed — invalid UTF-8; scan for illegal byte positions
    const illegalBytes = findIllegalUtf8Positions(buf);

    return {
      passed: false,
      detectedEncoding: "unknown",
      expectedEncoding,
      illegalBytes,
    };
  }
}
