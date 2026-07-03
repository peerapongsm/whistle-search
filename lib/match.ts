/**
 * Matches a query contour (from a whistled phrase) against a small library
 * of known tunes using a weighted edit distance over {direction, interval}
 * tokens (see lib/contour.ts). Because tokens never encode duration, a tune
 * whistled fast or slow — at any tempo — produces the same token sequence
 * as the reference transcription, so the distance is tempo-normalized by
 * construction; the score itself is additionally normalized by sequence
 * length so tunes of different note-counts are still comparable.
 */

import type { ContourToken } from "./contour";

export interface TuneLibraryEntry {
  id: string;
  name: string;
  tokens: ContourToken[];
}

export interface MatchResult {
  id: string;
  name: string;
  /** 0 (no resemblance) to 1 (identical contour). */
  confidence: number;
}

const MAX_INTERVAL_BUCKET = 3;

function substitutionCost(a: ContourToken, b: ContourToken): number {
  const directionCost = a.direction === b.direction ? 0 : 1;
  const intervalCost = Math.abs(a.interval - b.interval) / MAX_INTERVAL_BUCKET;
  return Math.min(1, directionCost + intervalCost);
}

/**
 * Levenshtein edit distance over token sequences, with a fractional
 * substitution cost (0..1) instead of the usual 0/1 so "close" mismatches
 * (same direction, slightly different interval size) are cheaper than a
 * totally wrong note.
 */
export function tokenEditDistance(a: ContourToken[], b: ContourToken[]): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));

  for (let i = 0; i < rows; i++) dp[i][0] = i;
  for (let j = 0; j < cols; j++) dp[0][j] = j;

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const sub = dp[i - 1][j - 1] + substitutionCost(a[i - 1], b[j - 1]);
      const del = dp[i - 1][j] + 1;
      const ins = dp[i][j - 1] + 1;
      dp[i][j] = Math.min(sub, del, ins);
    }
  }
  return dp[rows - 1][cols - 1];
}

/** Length-normalized similarity score in [0, 1]; 1 means an exact contour match. */
export function contourSimilarity(a: ContourToken[], b: ContourToken[]): number {
  const maxLength = Math.max(a.length, b.length, 1);
  const distance = tokenEditDistance(a, b);
  return Math.max(0, 1 - distance / maxLength);
}

/**
 * Scores `query` against every tune in `library` and returns the top `topK`
 * matches ranked by descending confidence.
 */
export function matchTune(query: ContourToken[], library: TuneLibraryEntry[], topK = 3): MatchResult[] {
  const scored = library.map((tune) => ({
    id: tune.id,
    name: tune.name,
    confidence: contourSimilarity(query, tune.tokens),
  }));
  scored.sort((a, b) => b.confidence - a.confidence);
  return scored.slice(0, topK);
}
