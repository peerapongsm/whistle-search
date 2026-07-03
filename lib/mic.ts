/**
 * Thin wiring around getUserMedia + AnalyserNode: pulls a Float32 time-domain
 * frame once per animation frame and runs it through lib/pitch. Nothing is
 * ever recorded or sent anywhere — the MediaStream and AudioContext are
 * held only in memory for as long as listening is active, and are torn
 * down on stop(). Verified by manual listening/testing, same pattern as
 * commute-music's MelodyEngine (browser-API classes aren't unit tested;
 * the pure pitch math they call is, in lib/pitch.test.ts).
 */

import { detectPitch } from "./pitch";

export const MIC_FRAME_SIZE = 2048;

export interface MicPitchStreamCallbacks {
  onPitch: (hz: number | null) => void;
}

export class MicPitchStream {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaStream: MediaStream | null = null;
  private buffer: Float32Array<ArrayBuffer> = new Float32Array(MIC_FRAME_SIZE);
  private rafId: number | null = null;

  /** Requests mic access (must be called from a user gesture) and starts the pitch-detection loop. */
  async start(callbacks: MicPitchStreamCallbacks): Promise<void> {
    this.stop();

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    this.mediaStream = stream;

    const Ctor: typeof AudioContext =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.audioContext = new Ctor();
    const source = this.audioContext.createMediaStreamSource(stream);

    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = MIC_FRAME_SIZE;
    this.buffer = new Float32Array(this.analyser.fftSize);
    source.connect(this.analyser);

    const tick = () => {
      if (!this.analyser || !this.audioContext) return;
      this.analyser.getFloatTimeDomainData(this.buffer);
      callbacks.onPitch(detectPitch(this.buffer, this.audioContext.sampleRate));
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  /** Stops the detection loop, releases the microphone, and closes the AudioContext. */
  stop(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    for (const track of this.mediaStream?.getTracks() ?? []) track.stop();
    this.mediaStream = null;
    void this.audioContext?.close();
    this.audioContext = null;
    this.analyser = null;
  }
}
