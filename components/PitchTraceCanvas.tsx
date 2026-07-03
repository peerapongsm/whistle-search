"use client";

import { useEffect, useRef } from "react";

interface PitchTraceCanvasProps {
  /** Recent Hz samples, oldest first; `null` entries render as a gap (silence). */
  history: Array<number | null>;
  minHz?: number;
  maxHz?: number;
}

const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 160;

/** Live-updating pitch trace: draws `history` as a line across the whistle band, redrawn on every change. */
export default function PitchTraceCanvas({ history, minHz = 500, maxHz = 3000 }: PitchTraceCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduceMotion) {
      // No phosphor persistence trail: hard-clear each frame, trace only.
      ctx.fillStyle = "#081410";
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    } else {
      // Cheap alpha fade over the previous frame's pixels = phosphor persistence trail.
      ctx.fillStyle = "rgba(6, 14, 11, 0.32)";
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }

    ctx.strokeStyle = "rgba(51, 255, 153, 0.12)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = (CANVAS_HEIGHT / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(CANVAS_WIDTH, y);
      ctx.stroke();
    }
    for (let i = 0; i <= 8; i++) {
      const x = (CANVAS_WIDTH / 8) * i;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CANVAS_HEIGHT);
      ctx.stroke();
    }

    if (history.length < 2) return;

    ctx.strokeStyle = "#33ff99";
    ctx.lineWidth = 2.5;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    if (!reduceMotion) {
      ctx.shadowColor = "rgba(51, 255, 153, 0.9)";
      ctx.shadowBlur = 8;
    }
    ctx.beginPath();
    let penDown = false;
    history.forEach((hz, i) => {
      const x = (i / (history.length - 1)) * CANVAS_WIDTH;
      if (hz === null) {
        penDown = false;
        return;
      }
      const clamped = Math.min(maxHz, Math.max(minHz, hz));
      const y = CANVAS_HEIGHT - ((clamped - minHz) / (maxHz - minHz)) * CANVAS_HEIGHT;
      if (!penDown) {
        ctx.moveTo(x, y);
        penDown = true;
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();
    ctx.shadowBlur = 0;
  }, [history, minHz, maxHz]);

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
      className="pitch-trace-canvas"
      role="img"
      aria-label="กราฟระดับเสียงผิวปากแบบสด"
    />
  );
}
