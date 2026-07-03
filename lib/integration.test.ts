/**
 * End-to-end self-test of the whole analysis pipeline, headless: for each
 * bundled tune, synthesize a raw whistled-audio waveform from its note
 * contour, run it frame-by-frame through the real pitch detector
 * (lib/pitch), segment the resulting Hz trace into note events and
 * Parsons/interval tokens (lib/contour), then match against the full tune
 * library (lib/match) — exactly the path the live mic UI takes. Asserts the
 * tune that generated the audio ranks #1 in its own results.
 */

import { describe, it, expect } from "vitest";
import { detectPitch } from "./pitch";
import { extractNoteEvents, toContourTokens } from "./contour";
import { matchTune } from "./match";
import { getTunes, buildTuneLibrary, type Tune } from "./tunes";
import { noteNameToMidi, midiToFrequency } from "./notes";

const SAMPLE_RATE = 44100;
const FRAME_SIZE = 1024;
const HOP_SIZE = 1024;
const SEC_PER_BEAT = 0.22;
/** Fraction of each note's duration left as silence before the next note, so repeated pitches still get separate attacks (like a real re-articulated whistle). */
const GAP_FRACTION = 0.2;
/** Semitones added to every note so the synthesized audio lands inside the 500-3000Hz whistle band the pitch detector searches. */
const TRANSPOSE_SEMITONES = 17;

/** Synthesizes one continuous audio buffer for a tune: a sine tone per note, separated by short silences. */
function synthesizeTuneAudio(tune: Tune): Float32Array {
  const chunks: Float32Array[] = [];
  for (const note of tune.notes) {
    const frequency = midiToFrequency(noteNameToMidi(note.note) + TRANSPOSE_SEMITONES);
    const totalSamples = Math.round(note.beats * SEC_PER_BEAT * SAMPLE_RATE);
    const gapSamples = Math.max(64, Math.round(totalSamples * GAP_FRACTION));
    const toneSamples = Math.max(1, totalSamples - gapSamples);

    const tone = new Float32Array(toneSamples);
    for (let i = 0; i < toneSamples; i++) {
      tone[i] = 0.8 * Math.sin((2 * Math.PI * frequency * i) / SAMPLE_RATE);
    }
    chunks.push(tone, new Float32Array(gapSamples)); // silence gap = zeros
  }

  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const audio = new Float32Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    audio.set(chunk, offset);
    offset += chunk.length;
  }
  return audio;
}

/** Runs the real frame-by-frame pitch detector over synthesized audio, producing a Hz-or-null sequence. */
function audioToHzSequence(audio: Float32Array): Array<number | null> {
  const hzSequence: Array<number | null> = [];
  for (let start = 0; start + FRAME_SIZE <= audio.length; start += HOP_SIZE) {
    const frame = audio.subarray(start, start + FRAME_SIZE);
    hzSequence.push(detectPitch(frame, SAMPLE_RATE));
  }
  return hzSequence;
}

describe("full pipeline self-test: synthesized whistle audio -> pitch -> contour -> match", () => {
  const library = buildTuneLibrary();

  it.each(getTunes().map((tune) => [tune.id, tune] as const))("recognizes its own synthesized audio as tune %s", (_id, tune) => {
    const audio = synthesizeTuneAudio(tune);
    const hzSequence = audioToHzSequence(audio);
    const events = extractNoteEvents(hzSequence);
    const tokens = toContourTokens(events);

    expect(events.length).toBeGreaterThanOrEqual(4); // sanity: pipeline actually segmented notes

    const results = matchTune(tokens, library, library.length);
    expect(results[0].id).toBe(tune.id);
    expect(results[0].confidence).toBeGreaterThan(0.5);
  });
});
