/** Scientific-pitch-notation helpers for authoring data/tunes.json by ear/hand. */

const BASE_SEMITONE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const NOTE_NAME_PATTERN = /^([A-G])(#|b)?(-?\d+)$/;

/** Parses a note like "C4", "F#5" or "Bb3" into its MIDI note number (C4 = 60). */
export function noteNameToMidi(name: string): number {
  const match = NOTE_NAME_PATTERN.exec(name.trim());
  if (!match) throw new Error(`Invalid note name: "${name}"`);
  const [, letter, accidental, octaveStr] = match;
  const octave = Number(octaveStr);
  const accidentalOffset = accidental === "#" ? 1 : accidental === "b" ? -1 : 0;
  return (octave + 1) * 12 + BASE_SEMITONE[letter] + accidentalOffset;
}

export function midiToFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function noteNameToFrequency(name: string): number {
  return midiToFrequency(noteNameToMidi(name));
}
