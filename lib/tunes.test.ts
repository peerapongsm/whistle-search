import { describe, it, expect } from "vitest";
import { getTunes, tuneToNoteEvents, buildTuneLibrary } from "./tunes";

describe("data/tunes.json", () => {
  it("has exactly the 12 locked-in tunes", () => {
    expect(getTunes()).toHaveLength(12);
  });

  it("every tune parses without throwing (valid note names)", () => {
    for (const tune of getTunes()) {
      expect(() => tuneToNoteEvents(tune)).not.toThrow();
    }
  });

  it("every tune has a non-trivial contour (>= 8 note events)", () => {
    for (const tune of getTunes()) {
      expect(tune.notes.length).toBeGreaterThanOrEqual(8);
    }
  });

  it("every tune has a unique id", () => {
    const ids = getTunes().map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every tune has a unique name", () => {
    const names = getTunes().map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("every tune has a non-empty id and name", () => {
    for (const tune of getTunes()) {
      expect(tune.id.length).toBeGreaterThan(0);
      expect(tune.name.length).toBeGreaterThan(0);
    }
  });
});

describe("buildTuneLibrary", () => {
  it("builds a match-ready token library covering every tune", () => {
    const library = buildTuneLibrary();
    expect(library).toHaveLength(getTunes().length);
    for (const entry of library) {
      expect(entry.tokens.length).toBeGreaterThanOrEqual(7); // one fewer than notes.length (transitions)
    }
  });

  it("every tune's contour mixes directions (not a flat monotone/no-op contour)", () => {
    for (const entry of buildTuneLibrary()) {
      const directions = new Set(entry.tokens.map((t) => t.direction));
      expect(directions.size).toBeGreaterThan(1);
    }
  });
});
