"use client";

import { useEffect, useRef, useState } from "react";
import { MicPitchStream } from "@/lib/mic";
import { ThereminEngine } from "@/lib/theremin";
import { extractNoteEvents, toContourTokens } from "@/lib/contour";
import { matchTune, type MatchResult } from "@/lib/match";
import { buildTuneLibrary } from "@/lib/tunes";
import { buildDemoHzSequence, DEMO_FRAME_INTERVAL_MS, DEMO_TUNE_NAME } from "@/lib/demo";
import PitchTraceCanvas from "./PitchTraceCanvas";
import ResultCard from "./ResultCard";

type Mode = "guess" | "theremin";
type GuessStatus = "idle" | "requesting" | "listening" | "denied" | "demo-playing" | "done";
type ThereminStatus = "idle" | "requesting" | "playing" | "denied";

const LIBRARY = buildTuneLibrary();
const RECORD_DURATION_MS = 7000;
const TRACE_HISTORY_LENGTH = 160;

function trimHistory(history: Array<number | null>): Array<number | null> {
  return history.length > TRACE_HISTORY_LENGTH ? history.slice(history.length - TRACE_HISTORY_LENGTH) : history;
}

export default function WhistleSearchApp() {
  const [mode, setMode] = useState<Mode>("guess");

  const [guessStatus, setGuessStatus] = useState<GuessStatus>("idle");
  const [guessHistory, setGuessHistory] = useState<Array<number | null>>([]);
  const [recordProgress, setRecordProgress] = useState(0);
  const [results, setResults] = useState<MatchResult[] | null>(null);

  const [thereminStatus, setThereminStatus] = useState<ThereminStatus>("idle");
  const [thereminHistory, setThereminHistory] = useState<Array<number | null>>([]);

  const micRef = useRef<MicPitchStream | null>(null);
  if (!micRef.current) micRef.current = new MicPitchStream();
  const thereminEngineRef = useRef<ThereminEngine | null>(null);
  if (!thereminEngineRef.current) thereminEngineRef.current = new ThereminEngine();

  const recordedHzRef = useRef<Array<number | null>>([]);
  const recordStartRef = useRef(0);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const demoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      micRef.current?.stop();
      thereminEngineRef.current?.stop();
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      if (stopTimeoutRef.current) clearTimeout(stopTimeoutRef.current);
      if (demoTimeoutRef.current) clearTimeout(demoTimeoutRef.current);
    };
  }, []);

  function finishGuessRecording() {
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    micRef.current?.stop();
    setGuessStatus("done");
    setRecordProgress(1);

    const events = extractNoteEvents(recordedHzRef.current);
    const tokens = toContourTokens(events);
    setResults(tokens.length > 0 ? matchTune(tokens, LIBRARY, 3) : []);
  }

  async function handleStartGuess() {
    setResults(null);
    setGuessHistory([]);
    recordedHzRef.current = [];
    setRecordProgress(0);
    setGuessStatus("requesting");

    try {
      await micRef.current!.start({
        onPitch: (hz) => {
          recordedHzRef.current.push(hz);
          setGuessHistory((prev) => trimHistory([...prev, hz]));
        },
      });
    } catch {
      setGuessStatus("denied");
      return;
    }

    setGuessStatus("listening");
    recordStartRef.current = Date.now();
    progressIntervalRef.current = setInterval(() => {
      setRecordProgress(Math.min(1, (Date.now() - recordStartRef.current) / RECORD_DURATION_MS));
    }, 100);
    stopTimeoutRef.current = setTimeout(finishGuessRecording, RECORD_DURATION_MS);
  }

  function handleStartDemo() {
    if (stopTimeoutRef.current) clearTimeout(stopTimeoutRef.current);
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    micRef.current?.stop();

    const sequence = buildDemoHzSequence();
    recordedHzRef.current = [];
    setGuessHistory([]);
    setResults(null);
    setGuessStatus("demo-playing");
    setRecordProgress(0);

    let i = 0;
    const step = () => {
      if (i >= sequence.length) {
        finishGuessRecording();
        return;
      }
      const hz = sequence[i];
      recordedHzRef.current.push(hz);
      setGuessHistory((prev) => trimHistory([...prev, hz]));
      setRecordProgress(i / sequence.length);
      i += 1;
      demoTimeoutRef.current = setTimeout(step, DEMO_FRAME_INTERVAL_MS);
    };
    step();
  }

  async function handleToggleTheremin() {
    if (thereminStatus === "playing") {
      micRef.current?.stop();
      thereminEngineRef.current?.stop();
      setThereminStatus("idle");
      return;
    }

    thereminEngineRef.current!.start();
    setThereminStatus("requesting");
    setThereminHistory([]);
    try {
      await micRef.current!.start({
        onPitch: (hz) => {
          thereminEngineRef.current?.setPitch(hz);
          setThereminHistory((prev) => trimHistory([...prev, hz]));
        },
      });
    } catch {
      thereminEngineRef.current?.stop();
      setThereminStatus("denied");
      return;
    }
    setThereminStatus("playing");
  }

  function handleSwitchMode(next: Mode) {
    micRef.current?.stop();
    thereminEngineRef.current?.stop();
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    if (stopTimeoutRef.current) clearTimeout(stopTimeoutRef.current);
    if (demoTimeoutRef.current) clearTimeout(demoTimeoutRef.current);
    setGuessStatus("idle");
    setThereminStatus("idle");
    setMode(next);
  }

  return (
    <div className="whistle-app">
      <div className="privacy-banner">
        <span className="privacy-banner-icon" aria-hidden="true">
          🔒
        </span>
        <span>เสียงทั้งหมดประมวลผล “ในเบราว์เซอร์คุณ” เท่านั้น ไม่มีการอัดเสียง ไม่มีการส่งไฟล์เสียงไปเซิร์ฟเวอร์ไหนเลย</span>
      </div>

      <div className="mode-tabs" role="group" aria-label="เลือกโหมด">
        <button type="button" aria-pressed={mode === "guess"} onClick={() => handleSwitchMode("guess")}>
          🎯 ทายเพลง
        </button>
        <button type="button" aria-pressed={mode === "theremin"} onClick={() => handleSwitchMode("theremin")}>
          🎵 Theremin
        </button>
      </div>

      {mode === "guess" && (
        <>
          <div className="stage">
            <p className="stage-status">
              {guessStatus === "idle" && "กดปุ่มแล้วผิวปากทำนองเพลงประมาณ 7 วินาที เดี๋ยวเว็บจะทายให้ว่าเพลงอะไร"}
              {guessStatus === "requesting" && "กำลังขอสิทธิ์ใช้ไมโครโฟน..."}
              {guessStatus === "listening" && "ฟังอยู่! ผิวปากต่อไปเรื่อยๆ..."}
              {guessStatus === "demo-playing" && `กำลังเล่นตัวอย่าง (${DEMO_TUNE_NAME})...`}
              {guessStatus === "denied" && "ไม่ได้รับสิทธิ์ใช้ไมโครโฟน ลองโหมดสาธิตด้านล่างแทนได้"}
              {guessStatus === "done" && "ทายเสร็จแล้ว! ผลอยู่ด้านล่าง"}
            </p>

            <button
              type="button"
              className={`listen-button ${guessStatus === "listening" ? "listen-button-active" : ""}`}
              onClick={handleStartGuess}
              disabled={guessStatus === "requesting" || guessStatus === "listening" || guessStatus === "demo-playing"}
            >
              {guessStatus === "listening" ? "🎙️ กำลังฟัง..." : "🎙️ เริ่มผิวปาก"}
            </button>

            {(guessStatus === "listening" || guessStatus === "demo-playing") && (
              <div className="recording-progress">
                <div className="recording-progress-fill" style={{ width: `${Math.round(recordProgress * 100)}%` }} />
              </div>
            )}

            <PitchTraceCanvas history={guessHistory} />

            <p className="demo-hint">
              ไม่มีไมค์ หรือไม่อยากเปิด?{" "}
              <button type="button" onClick={handleStartDemo} disabled={guessStatus === "listening" || guessStatus === "demo-playing"}>
                ลองโหมดสาธิต
              </button>
            </p>
          </div>

          {results && (
            <div className="results">
              {results.length === 0 ? (
                <p className="results-heading">ฟังไม่ชัดเลย ลองผิวปากให้ดังและชัดกว่านี้อีกทีนะ 🎐</p>
              ) : (
                <>
                  <p className="results-heading">ทายว่าเป็นเพลงนี้ (เรียงตามความมั่นใจ)</p>
                  {results.map((r, i) => (
                    <ResultCard key={r.id} rank={i + 1} name={r.name} confidence={r.confidence} />
                  ))}
                  <p className="result-joke">ทายผิดก็ไม่เป็นไร นั่นแหละคือความสนุก 😄</p>
                </>
              )}
            </div>
          )}
        </>
      )}

      {mode === "theremin" && (
        <div className="stage">
          <p className="stage-status">
            {thereminStatus === "idle" && "ผิวปากคุมเสียง synth แบบสดๆ เหมือนเล่น theremin — ของเล่นเฉยๆ"}
            {thereminStatus === "requesting" && "กำลังขอสิทธิ์ใช้ไมโครโฟน..."}
            {thereminStatus === "playing" && "ผิวปากคุมเสียงได้เลย!"}
            {thereminStatus === "denied" && "ไม่ได้รับสิทธิ์ใช้ไมโครโฟน โหมดนี้ต้องใช้ไมค์เท่านั้น"}
          </p>
          <button
            type="button"
            className={`listen-button ${thereminStatus === "playing" ? "listen-button-active" : ""}`}
            onClick={handleToggleTheremin}
            disabled={thereminStatus === "requesting"}
          >
            {thereminStatus === "playing" ? "⏹️ หยุด" : "🎵 เริ่มเป่า"}
          </button>
          <PitchTraceCanvas history={thereminHistory} />
          <p className="theremin-hint">เสียง synth สังเคราะห์สดในเครื่องคุณ ไม่มีการอัดหรือบันทึกเช่นกัน</p>
        </div>
      )}
    </div>
  );
}
