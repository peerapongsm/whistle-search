import { describe, it, expect } from "vitest";
import {
  hzToMidi,
  medianFilterHz,
  extractNoteEvents,
  noteEventsToParsons,
  toContourTokens,
} from "./contour";

describe("hzToMidi", () => {
  it("maps A4 (440hz) to MIDI 69", () => {
    expect(hzToMidi(440)).toBeCloseTo(69, 5);
  });

  it("maps one octave up to +12 semitones", () => {
    expect(hzToMidi(880)).toBeCloseTo(81, 5);
  });
});

describe("medianFilterHz", () => {
  it("smooths a single-frame spike", () => {
    const sequence = [440, 440, 900, 440, 440];
    const filtered = medianFilterHz(sequence, 5);
    expect(filtered[2]).toBeCloseTo(440, 5);
  });

  it("preserves nulls (silence) untouched", () => {
    const sequence = [440, null, 440];
    expect(medianFilterHz(sequence, 3)[1]).toBeNull();
  });
});

describe("extractNoteEvents", () => {
  it("groups a stable-pitch run into a single note event", () => {
    const sequence = Array(10).fill(440);
    const events = extractNoteEvents(sequence);
    expect(events).toHaveLength(1);
    expect(events[0].midi).toBeCloseTo(69, 1);
    expect(events[0].frameCount).toBe(10);
  });

  it("splits on silence into separate note events", () => {
    const sequence = [...Array(5).fill(440), null, ...Array(5).fill(494)];
    const events = extractNoteEvents(sequence);
    expect(events).toHaveLength(2);
  });

  it("splits on a sustained pitch jump into separate note events", () => {
    const sequence = [...Array(6).fill(440), ...Array(6).fill(659)]; // A4 -> E5, a clean leap
    const events = extractNoteEvents(sequence);
    expect(events).toHaveLength(2);
    expect(events[1].midi).toBeGreaterThan(events[0].midi);
  });

  it("drops very short segments as detection jitter", () => {
    const sequence = [...Array(8).fill(440), 900, ...Array(8).fill(440)];
    const events = extractNoteEvents(sequence, { minSegmentFrames: 3 });
    expect(events).toHaveLength(1);
  });

  it("returns an empty array for all-silence input", () => {
    expect(extractNoteEvents([null, null, null])).toHaveLength(0);
  });
});

describe("noteEventsToParsons", () => {
  it("produces U for a rising run", () => {
    const events = [{ midi: 60, frameCount: 3 }, { midi: 64, frameCount: 3 }];
    expect(noteEventsToParsons(events)).toBe("U");
  });

  it("produces D for a falling run", () => {
    const events = [{ midi: 64, frameCount: 3 }, { midi: 60, frameCount: 3 }];
    expect(noteEventsToParsons(events)).toBe("D");
  });

  it("produces R for a repeated pitch", () => {
    const events = [{ midi: 60, frameCount: 3 }, { midi: 60.1, frameCount: 3 }];
    expect(noteEventsToParsons(events)).toBe("R");
  });

  it("builds a multi-note contour, e.g. Twinkle Twinkle's opening (same-up-same-up)", () => {
    const events = [
      { midi: 60, frameCount: 3 }, // C
      { midi: 60, frameCount: 3 }, // C
      { midi: 67, frameCount: 3 }, // G
      { midi: 67, frameCount: 3 }, // G
      { midi: 69, frameCount: 3 }, // A
    ];
    expect(noteEventsToParsons(events)).toBe("RURU");
  });

  it("is non-trivial (mixes directions) for a real melodic shape", () => {
    const events = [60, 62, 64, 62, 60, 62, 64, 65, 64].map((midi) => ({ midi, frameCount: 3 }));
    const code = noteEventsToParsons(events);
    expect(new Set(code.split(""))).not.toEqual(new Set(["R"]));
    expect(code).toHaveLength(events.length - 1);
  });
});

describe("toContourTokens", () => {
  it("returns one token per transition with direction + coarse interval bucket", () => {
    const events = [
      { midi: 60, frameCount: 3 }, // start
      { midi: 60, frameCount: 3 }, // repeat -> bucket 0
      { midi: 62, frameCount: 3 }, // +2 semitones -> step, bucket 1
      { midi: 67, frameCount: 3 }, // +5 semitones -> leap, bucket 3
      { midi: 65, frameCount: 3 }, // -2 semitones -> step down, bucket 1
    ];
    const tokens = toContourTokens(events);
    expect(tokens).toEqual([
      { direction: "R", interval: 0 },
      { direction: "U", interval: 1 },
      { direction: "U", interval: 3 },
      { direction: "D", interval: 1 },
    ]);
  });

  it("is transposition-invariant: shifting every pitch by the same amount yields identical tokens", () => {
    const base = [60, 62, 67, 65, 67].map((midi) => ({ midi, frameCount: 3 }));
    const shifted = base.map((e) => ({ ...e, midi: e.midi + 7 }));
    expect(toContourTokens(shifted)).toEqual(toContourTokens(base));
  });
});
