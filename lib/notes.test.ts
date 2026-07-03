import { describe, it, expect } from "vitest";
import { noteNameToMidi, midiToFrequency, noteNameToFrequency } from "./notes";

describe("noteNameToMidi", () => {
  it("maps C4 to MIDI 60", () => {
    expect(noteNameToMidi("C4")).toBe(60);
  });

  it("maps A4 to MIDI 69", () => {
    expect(noteNameToMidi("A4")).toBe(69);
  });

  it("handles sharps and flats", () => {
    expect(noteNameToMidi("C#4")).toBe(61);
    expect(noteNameToMidi("Db4")).toBe(61);
  });

  it("throws on an invalid note name", () => {
    expect(() => noteNameToMidi("H4")).toThrow();
    expect(() => noteNameToMidi("garbage")).toThrow();
  });
});

describe("midiToFrequency / noteNameToFrequency", () => {
  it("maps MIDI 69 to 440hz", () => {
    expect(midiToFrequency(69)).toBeCloseTo(440, 5);
  });

  it("maps A4 note name to 440hz", () => {
    expect(noteNameToFrequency("A4")).toBeCloseTo(440, 5);
  });

  it("doubles frequency per octave", () => {
    expect(noteNameToFrequency("A5")).toBeCloseTo(880, 5);
  });
});
