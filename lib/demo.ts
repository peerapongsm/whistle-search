/**
 * No-mic fallback: a bundled sample Hz-over-time contour (built from a
 * library tune, not recorded from anyone) that plays through the exact
 * same contour + match pipeline the live mic path uses, and can drive the
 * same pitch-trace canvas — so people without/without-granting a
 * microphone can still see the whole system work end to end.
 */

import { getTunes } from "./tunes";
import { noteNameToMidi, midiToFrequency } from "./notes";

const DEMO_TUNE_ID = "twinkle-twinkle";
const FRAME_RATE_HZ = 30;
const SEC_PER_BEAT = 0.35;
/** Fraction of each note's duration left silent, so repeated pitches still segment into separate note events. */
const GAP_FRACTION = 0.15;
/** Semitones added so the demo trace sits in the same 500-3000Hz band real whistle input would occupy. */
const TRANSPOSE_SEMITONES = 17;

export const DEMO_FRAME_INTERVAL_MS = 1000 / FRAME_RATE_HZ;

function demoTune() {
  const tune = getTunes().find((t) => t.id === DEMO_TUNE_ID);
  if (!tune) throw new Error(`Demo tune "${DEMO_TUNE_ID}" not found in data/tunes.json`);
  return tune;
}

export const DEMO_TUNE_NAME = demoTune().name;

/** Builds the bundled demo Hz-or-null sequence, sampled at DEMO_FRAME_INTERVAL_MS. */
export function buildDemoHzSequence(): Array<number | null> {
  const sequence: Array<number | null> = [];
  for (const note of demoTune().notes) {
    const frequency = midiToFrequency(noteNameToMidi(note.note) + TRANSPOSE_SEMITONES);
    const totalFrames = Math.max(2, Math.round(note.beats * SEC_PER_BEAT * FRAME_RATE_HZ));
    const gapFrames = Math.max(1, Math.round(totalFrames * GAP_FRACTION));
    const toneFrames = Math.max(1, totalFrames - gapFrames);
    for (let i = 0; i < toneFrames; i++) sequence.push(frequency);
    for (let i = 0; i < gapFrames; i++) sequence.push(null);
  }
  return sequence;
}
