import { describe, it, expect } from "vitest";
import { tokenEditDistance, contourSimilarity, matchTune, type TuneLibraryEntry } from "./match";
import type { ContourToken } from "./contour";

const UP: ContourToken = { direction: "U", interval: 1 };
const DOWN: ContourToken = { direction: "D", interval: 1 };
const REPEAT: ContourToken = { direction: "R", interval: 0 };
const LEAP_UP: ContourToken = { direction: "U", interval: 3 };

describe("tokenEditDistance", () => {
  it("is zero for identical sequences", () => {
    expect(tokenEditDistance([UP, DOWN, REPEAT], [UP, DOWN, REPEAT])).toBe(0);
  });

  it("is zero for two empty sequences", () => {
    expect(tokenEditDistance([], [])).toBe(0);
  });

  it("equals sequence length when comparing against empty", () => {
    expect(tokenEditDistance([UP, DOWN, REPEAT], [])).toBe(3);
  });

  it("costs less for a same-direction interval mismatch than an opposite-direction mismatch", () => {
    const closeMismatch = tokenEditDistance([UP], [{ direction: "U", interval: 3 }]);
    const wrongDirection = tokenEditDistance([UP], [DOWN]);
    expect(closeMismatch).toBeLessThan(wrongDirection);
  });

  it("penalizes insertions/deletions (length differences)", () => {
    expect(tokenEditDistance([UP, DOWN], [UP, DOWN, UP])).toBeGreaterThan(0);
  });
});

describe("contourSimilarity", () => {
  it("is 1 for an identical contour", () => {
    expect(contourSimilarity([UP, DOWN, REPEAT], [UP, DOWN, REPEAT])).toBe(1);
  });

  it("is 0 for two empty contours treated as trivially equal", () => {
    expect(contourSimilarity([], [])).toBe(1);
  });

  it("decreases as contours diverge", () => {
    const exact = contourSimilarity([UP, DOWN, UP, DOWN], [UP, DOWN, UP, DOWN]);
    const partial = contourSimilarity([UP, DOWN, UP, DOWN], [UP, UP, UP, UP]);
    const opposite = contourSimilarity([UP, UP, UP, UP], [DOWN, DOWN, DOWN, DOWN]);
    expect(exact).toBeGreaterThan(partial);
    expect(partial).toBeGreaterThan(opposite);
  });

  it("stays high for the same shape at a different length scale is NOT assumed — length differences reduce score", () => {
    const short = [UP, DOWN];
    const long = [UP, DOWN, UP, DOWN, UP, DOWN];
    expect(contourSimilarity(short, long)).toBeLessThan(1);
  });
});

describe("matchTune", () => {
  const library: TuneLibraryEntry[] = [
    { id: "rising", name: "Rising Scale", tokens: [UP, UP, UP, UP] },
    { id: "falling", name: "Falling Scale", tokens: [DOWN, DOWN, DOWN, DOWN] },
    { id: "wavy", name: "Wavy Tune", tokens: [UP, DOWN, UP, DOWN] },
    { id: "leap", name: "Leap Tune", tokens: [LEAP_UP, LEAP_UP, LEAP_UP] },
  ];

  it("ranks the exact match first", () => {
    const results = matchTune([UP, UP, UP, UP], library, 3);
    expect(results[0].id).toBe("rising");
    expect(results[0].confidence).toBe(1);
  });

  it("returns results sorted by descending confidence", () => {
    const results = matchTune([UP, DOWN, UP, DOWN], library, library.length);
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].confidence).toBeGreaterThanOrEqual(results[i].confidence);
    }
  });

  it("respects topK", () => {
    const results = matchTune([UP, UP, UP, UP], library, 2);
    expect(results).toHaveLength(2);
  });

  it("ranks the opposite-shape tune last", () => {
    const results = matchTune([UP, UP, UP, UP], library, library.length);
    expect(results[results.length - 1].id).toBe("falling");
  });
});
