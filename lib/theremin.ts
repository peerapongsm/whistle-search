/**
 * Drives a single sine oscillator from live whistle pitch: the "toy" mode.
 * Frequency and gain both glide (setTargetAtTime) to avoid zipper noise as
 * the detected pitch jumps frame to frame, and gain drops to 0 whenever the
 * detector reports silence (no whistle) instead of an abrupt cutoff.
 */

const FREQUENCY_GLIDE_SEC = 0.02;
const GAIN_GLIDE_SEC = 0.06;
const ACTIVE_GAIN = 0.22;

export class ThereminEngine {
  private ctx: AudioContext | null = null;
  private oscillator: OscillatorNode | null = null;
  private gain: GainNode | null = null;

  /** Creates the audio graph and starts the (silent, gain=0) oscillator. Must be called from a user gesture. */
  start(): void {
    this.stop();
    const Ctor: typeof AudioContext =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctor();
    this.oscillator = this.ctx.createOscillator();
    this.oscillator.type = "sine";
    this.oscillator.frequency.value = 500;
    this.gain = this.ctx.createGain();
    this.gain.gain.value = 0;
    this.oscillator.connect(this.gain).connect(this.ctx.destination);
    this.oscillator.start();
  }

  /** Glides the oscillator to `hz`, or fades to silence when `hz` is null (no whistle detected). */
  setPitch(hz: number | null): void {
    if (!this.ctx || !this.oscillator || !this.gain) return;
    const now = this.ctx.currentTime;
    if (hz === null) {
      this.gain.gain.setTargetAtTime(0, now, GAIN_GLIDE_SEC);
      return;
    }
    this.oscillator.frequency.setTargetAtTime(hz, now, FREQUENCY_GLIDE_SEC);
    this.gain.gain.setTargetAtTime(ACTIVE_GAIN, now, GAIN_GLIDE_SEC);
  }

  /** Stops and tears down the audio graph. */
  stop(): void {
    try {
      this.oscillator?.stop();
    } catch {
      // already stopped - fine to ignore
    }
    void this.ctx?.close();
    this.ctx = null;
    this.oscillator = null;
    this.gain = null;
  }
}
