import { describe, it, expect } from "vitest";
import { buildDemoHzSequence, DEMO_TUNE_NAME } from "./demo";
import { extractNoteEvents, toContourTokens } from "./contour";
import { matchTune } from "./match";
import { buildTuneLibrary } from "./tunes";

describe("demo mode contour", () => {
  it("builds a non-trivial Hz sequence containing both tones and silence", () => {
    const sequence = buildDemoHzSequence();
    expect(sequence.length).toBeGreaterThan(20);
    expect(sequence.some((v) => v !== null)).toBe(true);
    expect(sequence.some((v) => v === null)).toBe(true);
  });

  it("every voiced sample sits inside the 500-3000hz whistle band", () => {
    for (const hz of buildDemoHzSequence()) {
      if (hz === null) continue;
      expect(hz).toBeGreaterThanOrEqual(500);
      expect(hz).toBeLessThanOrEqual(3000);
    }
  });

  it("replayed through the real contour+match pipeline, identifies its own tune as the #1 result", () => {
    const events = extractNoteEvents(buildDemoHzSequence());
    const tokens = toContourTokens(events);
    const results = matchTune(tokens, buildTuneLibrary(), 3);
    expect(results[0].name).toBe(DEMO_TUNE_NAME);
  });
});
