/**
 * Loads data/tunes.json (hand-transcribed public-domain/traditional
 * melodies) and turns each into the same {direction, interval} token
 * representation the mic pipeline produces, so lib/match.ts can compare
 * apples to apples.
 */

import tunesData from "@/data/tunes.json";
import { noteNameToMidi } from "./notes";
import { toContourTokens, type NoteEvent } from "./contour";
import type { TuneLibraryEntry } from "./match";

export interface TuneNote {
  note: string;
  beats: number;
}

export interface Tune {
  id: string;
  name: string;
  notes: TuneNote[];
}

const TUNES = tunesData as Tune[];

/** Frames-per-beat used only to give tuneToNoteEvents a plausible frameCount; matching itself ignores duration. */
const FRAMES_PER_BEAT = 4;

export function getTunes(): Tune[] {
  return TUNES;
}

export function tuneToNoteEvents(tune: Tune): NoteEvent[] {
  return tune.notes.map((n) => ({
    midi: noteNameToMidi(n.note),
    frameCount: Math.max(1, Math.round(n.beats * FRAMES_PER_BEAT)),
  }));
}

/** Builds the full match-ready tune library once; cheap enough to not bother memoizing further. */
export function buildTuneLibrary(): TuneLibraryEntry[] {
  return TUNES.map((tune) => ({
    id: tune.id,
    name: tune.name,
    tokens: toContourTokens(tuneToNoteEvents(tune)),
  }));
}
