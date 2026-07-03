/**
 * Monophonic pitch detector for whistle input: normalized autocorrelation
 * (ACF) over a single time-domain frame, restricted to the whistle band
 * (500-3000Hz) with a noise gate. Runs once per animation-frame tick on the
 * buffer returned by AnalyserNode#getFloatTimeDomainData — no FFT needed
 * since whistling is a clean, nearly-monophonic sine-like tone.
 */

export interface PitchDetectionOptions {
  /** Lower bound of the search band in Hz. Default 500 (typical whistle floor). */
  minFrequency?: number;
  /** Upper bound of the search band in Hz. Default 3000 (typical whistle ceiling). */
  maxFrequency?: number;
  /** RMS amplitude below which a frame is treated as silence/noise and rejected. */
  noiseGateRms?: number;
}

const DEFAULT_MIN_FREQUENCY = 500;
const DEFAULT_MAX_FREQUENCY = 3000;
const DEFAULT_NOISE_GATE_RMS = 0.01;

/**
 * A pure tone's autocorrelation is exactly as strong at every integer
 * multiple of its true period as at the period itself, so a harmonic
 * (period × 2, × 3, ...) that happens to land on a cleaner integer lag can
 * outscore the true, non-integer fundamental period — an "octave error".
 * We correct for it by checking whether a shorter candidate lag (implying a
 * higher, possibly out-of-band, frequency) explains the signal almost as
 * well; if so we trust the shorter lag instead. `1 - OCTAVE_CORRECTION_MARGIN`
 * is how much weaker that shorter-lag correlation is allowed to be.
 */
const OCTAVE_CORRECTION_MARGIN = 0.1;
const MAX_OCTAVE_DIVISOR = 6;

function sumProduct(buffer: Float32Array, lag: number): number {
  let sum = 0;
  for (let i = 0; i < buffer.length - lag; i++) {
    sum += buffer[i] * buffer[i + lag];
  }
  return sum;
}

/**
 * Detects the fundamental frequency of a single audio frame, or returns
 * `null` when the frame is too quiet (noise gate) or has no clear
 * periodicity within [minFrequency, maxFrequency].
 */
export function detectPitch(buffer: Float32Array, sampleRate: number, options: PitchDetectionOptions = {}): number | null {
  const minFrequency = options.minFrequency ?? DEFAULT_MIN_FREQUENCY;
  const maxFrequency = options.maxFrequency ?? DEFAULT_MAX_FREQUENCY;
  const noiseGateRms = options.noiseGateRms ?? DEFAULT_NOISE_GATE_RMS;

  const n = buffer.length;
  if (n === 0) return null;

  let sumSquares = 0;
  for (let i = 0; i < n; i++) sumSquares += buffer[i] * buffer[i];
  const rms = Math.sqrt(sumSquares / n);
  if (rms < noiseGateRms) return null;

  const minLag = Math.max(1, Math.floor(sampleRate / maxFrequency));
  const maxLag = Math.ceil(sampleRate / minFrequency);
  if (maxLag + 1 >= n) return null; // frame too short to see a full period at minFrequency

  // Normalized autocorrelation across the candidate lag range. We only need
  // relative peak position (not the true ACF at every lag), so restrict the
  // sum to [minLag, maxLag] rather than the full buffer.
  const correlations = new Float32Array(maxLag + 2);
  let bestLag = -1;
  let bestCorrelation = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    const sum = sumProduct(buffer, lag);
    correlations[lag] = sum;
    if (sum > bestCorrelation) {
      bestCorrelation = sum;
      bestLag = lag;
    }
  }
  if (bestLag === -1 || bestCorrelation <= 0) return null;

  const correctedLag = correctOctaveError(buffer, bestLag, bestCorrelation, n);

  // Parabolic interpolation around the integer-lag peak for sub-sample
  // precision (needed to hit the ±3% accuracy target across the band).
  const inTable = (lag: number) => lag >= minLag && lag <= maxLag;
  const y1 = inTable(correctedLag) ? correlations[correctedLag] : sumProduct(buffer, correctedLag);
  const y0 = inTable(correctedLag - 1) ? correlations[correctedLag - 1] : y1;
  const y2 = inTable(correctedLag + 1) ? correlations[correctedLag + 1] : y1;
  const denom = y0 - 2 * y1 + y2;
  let interpolatedLag = correctedLag;
  if (denom !== 0) {
    const shift = (0.5 * (y0 - y2)) / denom;
    if (Math.abs(shift) < 1) interpolatedLag = correctedLag + shift;
  }

  const frequency = sampleRate / interpolatedLag;
  if (frequency < minFrequency || frequency > maxFrequency) return null;
  return frequency;
}

/**
 * Walks down integer divisors of `bestLag` (÷2, ÷3, ...) looking for a
 * shorter lag whose correlation is nearly as strong. A shorter lag implies a
 * higher true frequency hiding behind the coarser peak `bestLag` found —
 * see the module-level comment on `OCTAVE_CORRECTION_MARGIN`.
 */
function correctOctaveError(buffer: Float32Array, bestLag: number, bestCorrelation: number, frameLength: number): number {
  const bestAverage = bestCorrelation / (frameLength - bestLag);
  let refinedLag = bestLag;
  for (let divisor = 2; divisor <= MAX_OCTAVE_DIVISOR; divisor++) {
    const candidateLag = Math.round(bestLag / divisor);
    if (candidateLag < 1) break;
    const candidateAverage = sumProduct(buffer, candidateLag) / (frameLength - candidateLag);
    if (candidateAverage >= (1 - OCTAVE_CORRECTION_MARGIN) * bestAverage) {
      refinedLag = candidateLag;
    }
  }
  return refinedLag;
}

/** Generates a pure sine-wave frame at `frequency` Hz — used by tests and the demo/theremin paths. */
export function generateSineFrame(frequency: number, sampleRate: number, length: number, amplitude = 0.8): Float32Array {
  const buffer = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    buffer[i] = amplitude * Math.sin((2 * Math.PI * frequency * i) / sampleRate);
  }
  return buffer;
}
