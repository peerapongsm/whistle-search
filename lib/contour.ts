/**
 * Turns a raw per-frame Hz sequence (from lib/pitch, or a hand-authored tune
 * in data/tunes.json) into a Parsons-code style contour: a sequence of
 * discrete "note events", a U(p)/D(own)/R(epeat) string between consecutive
 * events, and a coarse interval-size bucket per transition. Absolute pitch,
 * octave and duration are all discarded — only relative melodic shape
 * remains, which is what makes matching transposition- and tempo-invariant
 * (see lib/match.ts).
 */

export type ParsonsDirection = "U" | "D" | "R";

export interface NoteEvent {
  /** Median MIDI pitch (can be fractional) of this note segment. */
  midi: number;
  /** Number of consecutive voiced frames/notes that made up this segment. */
  frameCount: number;
}

export interface ContourToken {
  direction: ParsonsDirection;
  /** Coarse, unsigned interval-size bucket: 0=repeat, 1=step, 2=medium step, 3=leap. */
  interval: number;
}

const DEFAULT_MEDIAN_WINDOW = 5;
/** Consecutive frames whose pitch stays within this many semitones are treated as the same note. */
const DEFAULT_NOTE_SEMITONE_TOLERANCE = 1;
/** Segments shorter than this many frames are dropped as detection jitter/noise. */
const DEFAULT_MIN_SEGMENT_FRAMES = 2;
/** Semitone difference at/below which a transition counts as a "repeat" (Parsons "R"). */
const REPEAT_SEMITONE_TOLERANCE = 0.5;

export function hzToMidi(hz: number): number {
  return 69 + 12 * Math.log2(hz / 440);
}

/**
 * Sliding-window median filter over a Hz sequence (nulls pass through
 * untouched — they mark silence/unvoiced frames and are segment
 * boundaries, not noise to smooth over).
 */
export function medianFilterHz(hzSequence: Array<number | null>, windowSize = DEFAULT_MEDIAN_WINDOW): Array<number | null> {
  const half = Math.floor(windowSize / 2);
  return hzSequence.map((value, i) => {
    if (value === null) return null;
    const windowValues: number[] = [];
    for (let j = Math.max(0, i - half); j <= Math.min(hzSequence.length - 1, i + half); j++) {
      const candidate = hzSequence[j];
      if (candidate !== null) windowValues.push(candidate);
    }
    windowValues.sort((a, b) => a - b);
    return windowValues[Math.floor(windowValues.length / 2)];
  });
}

export interface ExtractNoteEventsOptions {
  medianWindow?: number;
  noteSemitoneTolerance?: number;
  minSegmentFrames?: number;
}

/**
 * Median-filters a raw Hz sequence, then groups consecutive frames whose
 * pitch stays within `noteSemitoneTolerance` semitones into note events
 * (each event's pitch is the median of its member frames). Silence (`null`)
 * always breaks a segment. Short, likely-jitter segments are dropped.
 */
export function extractNoteEvents(hzSequence: Array<number | null>, options: ExtractNoteEventsOptions = {}): NoteEvent[] {
  const medianWindow = options.medianWindow ?? DEFAULT_MEDIAN_WINDOW;
  const tolerance = options.noteSemitoneTolerance ?? DEFAULT_NOTE_SEMITONE_TOLERANCE;
  const minSegmentFrames = options.minSegmentFrames ?? DEFAULT_MIN_SEGMENT_FRAMES;

  const filtered = medianFilterHz(hzSequence, medianWindow);
  const midiSequence = filtered.map((hz) => (hz === null ? null : hzToMidi(hz)));

  const events: NoteEvent[] = [];
  let segment: number[] = [];

  const flushSegment = () => {
    if (segment.length >= minSegmentFrames) {
      const sorted = [...segment].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      events.push({ midi: median, frameCount: segment.length });
    }
    segment = [];
  };

  for (const midi of midiSequence) {
    if (midi === null) {
      flushSegment();
      continue;
    }
    if (segment.length === 0 || Math.abs(midi - segment[segment.length - 1]) <= tolerance) {
      segment.push(midi);
    } else {
      flushSegment();
      segment.push(midi);
    }
  }
  flushSegment();

  return events;
}

function semitoneToIntervalBucket(absSemitones: number): number {
  if (absSemitones <= REPEAT_SEMITONE_TOLERANCE) return 0;
  if (absSemitones <= 2) return 1;
  if (absSemitones <= 4) return 2;
  return 3;
}

/** Builds the Parsons-code direction string (length = events.length - 1). */
export function noteEventsToParsons(events: NoteEvent[]): string {
  let code = "";
  for (let i = 1; i < events.length; i++) {
    const diff = events[i].midi - events[i - 1].midi;
    code += diff > REPEAT_SEMITONE_TOLERANCE ? "U" : diff < -REPEAT_SEMITONE_TOLERANCE ? "D" : "R";
  }
  return code;
}

/**
 * Converts a note-event sequence directly into the {direction, interval}
 * tokens used by lib/match.ts. This is the single source of truth both the
 * live mic pipeline and the bundled tune library (lib/tunes.ts) go through,
 * so query and library contours are always encoded identically.
 */
export function toContourTokens(events: NoteEvent[]): ContourToken[] {
  const tokens: ContourToken[] = [];
  for (let i = 1; i < events.length; i++) {
    const diff = events[i].midi - events[i - 1].midi;
    const direction: ParsonsDirection = diff > REPEAT_SEMITONE_TOLERANCE ? "U" : diff < -REPEAT_SEMITONE_TOLERANCE ? "D" : "R";
    tokens.push({ direction, interval: semitoneToIntervalBucket(Math.abs(diff)) });
  }
  return tokens;
}
