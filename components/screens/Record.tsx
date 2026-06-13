"use client";
import { useEffect, useRef, useState } from "react";
import { actions, Ic, Ledger, Mascot, TopBar } from "@/components/ui";
import { useStore } from "@/lib/store";
import { Waveform } from "@/components/Waveform";
import {
  startRecording,
  stopRecording,
  meterLoop,
  ingestBlob,
  type RecorderHandle,
} from "@/lib/audio";

const CALIBRATION_MS = 2000;

export default function Record() {
  const { passage, settings, bytesSent } = useStore();
  const [phase, setPhase] = useState<"armed" | "recording">("armed");
  const [calibrating, setCalibrating] = useState(false);
  const [calibPct, setCalibPct] = useState(0);
  const [level, setLevel] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [bars, setBars] = useState<number[]>(() => new Array(58).fill(0.06));
  const [error, setError] = useState<string | null>(null);

  const handleRef = useRef<RecorderHandle | null>(null);
  const stopMeterRef = useRef<(() => void) | null>(null);
  const startRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const levelsRef = useRef<number[]>([]);
  const sampleRef = useRef(0);

  useEffect(() => () => cleanup(), []);

  function cleanup() {
    stopMeterRef.current?.();
    stopMeterRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    if (handleRef.current) {
      handleRef.current.stream.getTracks().forEach((t) => t.stop());
      handleRef.current = null;
    }
  }

  const begin = async () => {
    if (handleRef.current || phase !== "armed") return; // guard against double-tap
    setError(null);
    try {
      const handle = await startRecording();
      handleRef.current = handle;
      startRef.current = performance.now();
      setPhase("recording");
      setCalibrating(true);
      levelsRef.current = [];
      sampleRef.current = 0;

      stopMeterRef.current = meterLoop(handle.analyser, (lvl) => {
        setLevel(lvl);
        const t = performance.now() - startRef.current;
        if (t < CALIBRATION_MS) setCalibPct(Math.min(100, (t / CALIBRATION_MS) * 100));
        else if (calibrating) setCalibrating(false);
        // build a live waveform: sample the level into a rolling 58-bar buffer
        if (t - sampleRef.current > 70) {
          sampleRef.current = t;
          const arr = levelsRef.current;
          arr.push(Math.max(0.06, lvl));
          const tail = arr.slice(-58);
          setBars([...tail, ...new Array(Math.max(0, 58 - tail.length)).fill(0.06)].slice(0, 58));
        }
      });

      timerRef.current = setInterval(() => {
        setElapsed((performance.now() - startRef.current) / 1000);
        if (performance.now() - startRef.current >= CALIBRATION_MS) setCalibrating(false);
      }, 200);
    } catch {
      setError("Couldn’t reach your microphone. Allow mic access, or try a demo line.");
    }
  };

  const stop = async () => {
    const handle = handleRef.current;
    if (!handle) return;
    handleRef.current = null; // null synchronously so a double-tap can't double-analyse
    stopMeterRef.current?.();
    if (timerRef.current) clearInterval(timerRef.current);
    const blob = await stopRecording(handle);
    try {
      const { durationSec } = await ingestBlob(blob);
      actions.newRecording(durationSec);
      const flow = await import("@/lib/flow");
      await flow.analyzeFromRecording();
    } catch {
      setError("Couldn’t read that recording — try once more.");
      setPhase("armed");
    }
  };

  const mm = Math.floor(elapsed / 60);
  const ss = Math.floor(elapsed % 60);
  const timeStr = `${mm}:${ss.toString().padStart(2, "0")}`;
  const lvlBars = [0.55, 0.85, 0.4, 0.7, 0.32].map((b) => 6 + b * level * 26 + (phase === "recording" ? 4 : 0));

  return (
    <>
      <TopBar
        title="Read it aloud"
        onBack={() => {
          cleanup();
          actions.back();
        }}
        right={
          <button
            className="iconbtn"
            onClick={() => {
              cleanup();
              actions.navigate("s1");
            }}
            aria-label="Edit text"
          >
            <Ic n="ic-pencil" alt="edit text" />
          </button>
        }
      />

      <div className="pagepad" style={{ marginTop: 6 }}>
        <div className="card pad-lg">
          <div className="passage" style={{ fontSize: 25 }}>
            {passage}
          </div>
        </div>
      </div>

      <div className="grow center" style={{ justifyContent: "center", gap: 0 }}>
        {phase === "recording" && (
          <>
            <div className="data" style={{ fontSize: 15, color: "var(--ink-soft)", marginBottom: 14 }}>
              {timeStr}
            </div>
            <div style={{ width: 330, marginBottom: 28 }}>
              <Waveform peaks={bars} durationSec={1} onsetSec={1} height={104} />
            </div>
          </>
        )}

        <div className={`rec-wrap${phase === "recording" && !calibrating ? " recording" : ""}`}>
          <div className="rec-halo r2" />
          <div className="rec-halo" />
          {calibrating && (
            <div
              className="rec-ring"
              style={{
                background: `conic-gradient(var(--amber) ${calibPct * 3.6}deg, rgba(0,0,0,0) 0)`,
                WebkitMask:
                  "radial-gradient(farthest-side, transparent calc(100% - 6px), #000 calc(100% - 5px))",
                mask: "radial-gradient(farthest-side, transparent calc(100% - 6px), #000 calc(100% - 5px))",
              }}
            />
          )}
          {phase === "armed" ? (
            <button className="rec" onClick={begin} aria-label="Start recording">
              <Ic n="ic-mic" size={34} alt="record" />
            </button>
          ) : (
            <button className="rec stop" onClick={stop} aria-label="Stop recording">
              <div className="sq" />
            </button>
          )}
        </div>

        <div className="lvlbars" style={{ marginTop: 20 }}>
          {lvlBars.map((h, i) => (
            <i key={i} style={{ height: Math.round(h) }} />
          ))}
        </div>

        <div className="earmount center" style={{ marginTop: 26, gap: 8, flexDirection: "column", textAlign: "center" }}>
          <Mascot
            variant="listen"
            size={48}
            vertical
            say={
              calibrating
                ? "Checking your mic…"
                : phase === "recording"
                ? "I’m listening… read it once, at your own pace."
                : "Tap to read aloud — I’m listening for the slips."
            }
          />
          {!settings.mascot && (
            <span className="tiny" style={{ maxWidth: 280 }}>
              {phase === "armed" ? "Tap to read the passage aloud once." : "Reading… tap the square when done."}
            </span>
          )}
        </div>

        {error && (
          <div className="tiny" style={{ marginTop: 14, color: "var(--sev3)", maxWidth: 300, textAlign: "center" }}>
            {error}
          </div>
        )}
      </div>

      <div className="center" style={{ padding: "8px 0 24px" }}>
        <Ledger prefix="Your voice stays here" suffix="KB sent" value={Math.round(bytesSent / 1024)} />
      </div>
    </>
  );
}
