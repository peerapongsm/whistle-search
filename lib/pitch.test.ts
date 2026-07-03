import { describe, it, expect } from "vitest";
import { detectPitch, generateSineFrame } from "./pitch";

const SAMPLE_RATE = 44100;
const FRAME_LENGTH = 2048;

function expectWithinTolerance(actual: number, expected: number, toleranceFraction: number) {
  const diff = Math.abs(actual - expected) / expected;
  expect(diff).toBeLessThanOrEqual(toleranceFraction);
}

describe("detectPitch — synthetic sine fixtures", () => {
  it.each([500, 660, 880, 1000, 1568, 2000, 2637, 3000])("detects a pure %ihz tone within ±3%%", (freq) => {
    const frame = generateSineFrame(freq, SAMPLE_RATE, FRAME_LENGTH);
    const detected = detectPitch(frame, SAMPLE_RATE);
    expect(detected).not.toBeNull();
    expectWithinTolerance(detected!, freq, 0.03);
  });

  it("rejects frequencies below the whistle band", () => {
    const frame = generateSineFrame(220, SAMPLE_RATE, FRAME_LENGTH);
    expect(detectPitch(frame, SAMPLE_RATE)).toBeNull();
  });

  it("rejects frequencies above the whistle band", () => {
    const frame = generateSineFrame(4200, SAMPLE_RATE, FRAME_LENGTH);
    expect(detectPitch(frame, SAMPLE_RATE)).toBeNull();
  });

  it("respects custom min/max frequency options", () => {
    const frame = generateSineFrame(1200, SAMPLE_RATE, FRAME_LENGTH);
    expect(detectPitch(frame, SAMPLE_RATE, { minFrequency: 1500, maxFrequency: 3000 })).toBeNull();
    expectWithinTolerance(detectPitch(frame, SAMPLE_RATE, { minFrequency: 500, maxFrequency: 1500 })!, 1200, 0.03);
  });
});

describe("detectPitch — silence / noise gate", () => {
  it("rejects a silent (all-zero) frame", () => {
    const frame = new Float32Array(FRAME_LENGTH);
    expect(detectPitch(frame, SAMPLE_RATE)).toBeNull();
  });

  it("rejects a very quiet frame below the noise gate", () => {
    const frame = generateSineFrame(1000, SAMPLE_RATE, FRAME_LENGTH, 0.001);
    expect(detectPitch(frame, SAMPLE_RATE)).toBeNull();
  });

  it("accepts a frame once amplitude clears the noise gate", () => {
    const frame = generateSineFrame(1000, SAMPLE_RATE, FRAME_LENGTH, 0.5);
    expect(detectPitch(frame, SAMPLE_RATE)).not.toBeNull();
  });

  it("returns null for an empty buffer", () => {
    expect(detectPitch(new Float32Array(0), SAMPLE_RATE)).toBeNull();
  });
});

describe("detectPitch — synthetic chirp fixture (frequency sweep across frames)", () => {
  it("tracks a rising whistle sweep frame-by-frame within ±3%", () => {
    const steps = 20;
    for (let i = 0; i <= steps; i++) {
      const freq = 500 + ((3000 - 500) * i) / steps;
      const frame = generateSineFrame(freq, SAMPLE_RATE, FRAME_LENGTH);
      const detected = detectPitch(frame, SAMPLE_RATE);
      expect(detected).not.toBeNull();
      expectWithinTolerance(detected!, freq, 0.03);
    }
  });

  it("tracks a falling whistle sweep frame-by-frame within ±3%", () => {
    const steps = 20;
    for (let i = 0; i <= steps; i++) {
      const freq = 3000 - ((3000 - 500) * i) / steps;
      const frame = generateSineFrame(freq, SAMPLE_RATE, FRAME_LENGTH);
      const detected = detectPitch(frame, SAMPLE_RATE);
      expect(detected).not.toBeNull();
      expectWithinTolerance(detected!, freq, 0.03);
    }
  });
});
