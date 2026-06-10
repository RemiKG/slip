// Shared types for Slip.

export type ScreenId =
  | "s0" // home
  | "s1" // bring text
  | "s2" // photograph
  | "s3" // record
  | "s4" // catch (money shot)
  | "s5" // slip map
  | "s6" // share card
  | "s7" // private by design
  | "s8" // settings
  | "modelload" // transient: one-time model download
  | "listening"; // transient: analysing

export type IntakeTab = "paste" | "type" | "photo";

// The warm severity ramp — appears ONLY on a slipped sound. Never alarm-red.
//   s1 honey (mild) · s2 orange (moderate) · s3 coral (worst) · good sage (clean/improved)
export type Severity = "s1" | "s2" | "s3" | "good";

export type Runtime = "auto" | "wasm" | "gpu";
export type ModelBackend = "device" | "server";
export type HighlightCap = "top3" | "top6" | "all";

export interface Settings {
  lang: string; // e.g. "en-us"
  langLabel: string; // e.g. "English (US)"
  runtime: Runtime;
  model: ModelBackend;
  sensitivity: number; // 0..1, 0.5 = balanced
  highlights: HighlightCap;
  mascot: boolean;
}

// One slipped sound, anchored to a grapheme span inside the passage.
export interface Highlight {
  id: string;
  start: number; // char offset in passage (inclusive)
  end: number; // char offset in passage (exclusive)
  word: string;
  severity: Severity;
  expectedIpa: string;
  heardIpa: string;
  isSub: boolean; // true = substituted sound (expected X, heard Y); false = distorted/unclear
  startMs: number; // onset on the ~20ms frame grid
  endMs: number;
  gop: number;
  lowConfidence: boolean;
}

export interface Diagnostics {
  modelSize: string; // e.g. "318 MB"
  modelDtype: string; // e.g. "int8 onnx"
  framesPerSec: number; // 50
  hopMs: number; // 20
  lastAnalyseMs: number | null;
  backendLabel: string; // e.g. "wasm-simd" / "webgpu" / "server"
  verdict: string; // "GOP-CTC"
}

export interface Analysis {
  passage: string;
  highlights: Highlight[];
  durationSec: number;
  phonemeCount: number;
  framesPerSec: number;
  latencyMs: number;
  backend: "browser" | "server";
  backendLabel: string;
  flagged?: string; // honest "the model had an off day" note, never hidden
}

export type ModelStatus =
  | "idle"
  | "loading"
  | "ready"
  | "error";

export interface ModelProgress {
  loadedBytes: number;
  totalBytes: number;
  file: string;
}
