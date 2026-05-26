/**
 * ChunkMerger implementation.
 *
 * Merges small chunks (< minSize) with same-level predecessor if combined <= maxSize.
 * First chunk is never merged (no predecessor).
 * Separator between merged chunks: "\n\n".
 */

import { type Chunk, type SplitOperation } from "./models";
import { calcSizeKb } from "./utils";

export class ChunkMergerImpl {
  /**
   * Merge chunks smaller than minSize into same-level neighbors.
   *
   * Iterates from index 1. If chunk < minSize and same level as
   * predecessor and combined <= maxSize: merge with predecessor.
   * First chunk is never merged (no predecessor).
   *
   * @param chunks - Chunks from SectionSplitter.
   * @param maxSize - Maximum size per chunk in KB (merge must not exceed).
   * @param minSize - Minimum size threshold in KB (chunks below trigger merge).
   * @returns A tuple of [mergedChunks, operations].
   */
  merge(
    chunks: Chunk[],
    maxSize: number,
    minSize: number
  ): [Chunk[], SplitOperation[]] {
    if (chunks.length === 0) {
      return [[], []];
    }

    const operations: SplitOperation[] = [];
    const result: Chunk[] = [chunks[0]];

    for (let i = 1; i < chunks.length; i++) {
      const current = chunks[i];
      const predecessor = result[result.length - 1];

      // Check merge conditions:
      // 1. Current chunk < minSize
      // 2. Same level as predecessor
      // 3. Combined size <= maxSize
      if (
        current.sizeKb < minSize &&
        current.level === predecessor.level
      ) {
        const mergedContent = predecessor.content + "\n\n" + current.content;
        const mergedSize = calcSizeKb(mergedContent);

        if (mergedSize <= maxSize) {
          // Merge: create a new merged chunk
          const mergedChunk: Chunk = {
            sourceSection: predecessor.sourceSection + " + " + current.sourceSection,
            level: predecessor.level,
            content: mergedContent,
            sizeKb: mergedSize,
            lineCount: predecessor.lineCount + current.lineCount + 2, // +2 for \n\n
            startLine: predecessor.startLine,
            endLine: current.endLine,
            isMerged: true,
            mergedSections: (
              (predecessor.isMerged ? predecessor.mergedSections : [predecessor.sourceSection]) as string[]
            ).concat(
              current.isMerged ? current.mergedSections : [current.sourceSection]
            ),
            estimatedTokens: 0,
          };

          // Replace predecessor with merged chunk
          result[result.length - 1] = mergedChunk;

          operations.push({
            operation: "merge",
            target: mergedChunk.sourceSection,
            detail: `${Math.round(predecessor.sizeKb)}KB + ${Math.round(current.sizeKb)}KB -> ${Math.round(mergedSize)}KB`,
          });
          continue;
        }
      }

      // No merge: add current chunk as-is
      result.push(current);
    }

    return [result, operations];
  }
}
