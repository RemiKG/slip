"use client";
// Central client store for Slip — a tiny external store (useSyncExternalStore).
// Audio buffers (non-serializable) live in lib/audio.ts; the store holds the
// serializable session state and drives every screen.
import { useSyncExternalStore } from "react";
import type {
  ScreenId,
  IntakeTab,
  Settings,
  Analysis,
  ModelStatus,
  ModelProgress,
} from "./types";
import { DEFAULT_SETTINGS } from "./constants";
import { kvGet, kvSet, clearLocalData } from "./persistence";

export interface State {
  screen: ScreenId;
  history: ScreenId[];
  intakeTab: IntakeTab;
  passage: string;
  demoId: string | null;
  isDemo: boolean;
  ocrWords: { text: string; flag: "ok" | "review" | "low" }[] | null;
  ocrSeconds: number | null;
  recordingId: number; // bumps each new recording so derived UI refreshes
  durationSec: number;
  analysis: Analysis | null;
  selectedSlipId: string | null;
  readCount: number; // reads of the CURRENT passage
  prevSlipCount: number | null; // slip count of the previous read of this passage
  settings: Settings;
  modelStatus: ModelStatus;
  modelProgress: ModelProgress | null;
  networkCount: number;
  bytesSent: number;
  degradedNote: string | null;
  installAvailable: boolean;
  toast: string | null;
}

const initialState: State = {
  screen: "s0",
  history: [],
  intakeTab: "paste",
  passage: "",
  demoId: null,
  isDemo: false,
  ocrWords: null,
  ocrSeconds: null,
  recordingId: 0,
  durationSec: 0,
  analysis: null,
  selectedSlipId: null,
  readCount: 0,
  prevSlipCount: null,
  settings: DEFAULT_SETTINGS,
  modelStatus: "idle",
  modelProgress: null,
  networkCount: 0,
  bytesSent: 0,
  degradedNote: null,
  installAvailable: false,
  toast: null,
};

let state: State = initialState;
const listeners = new Set<() => void>();

function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  for (const l of listeners) l();
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

const getSnapshot = () => state;
const getServerSnapshot = () => initialState;

export function useStore(): State {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function getState(): State {
  return state;
}

// ---------------- actions ----------------
let toastTimer: ReturnType<typeof setTimeout> | null = null;

export const actions = {
  navigate(screen: ScreenId, opts?: { replace?: boolean }) {
    if (screen === state.screen) return;
    const history = opts?.replace
      ? [...state.history]
      : [...state.history, state.screen].filter((s) => s !== "modelload" && s !== "listening");
    // drop a trailing entry equal to where we're going (e.g. re-reading a demo: s4 → s4)
    while (history.length && history[history.length - 1] === screen) history.pop();
    set({ screen, history });
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  },
  back() {
    const history = [...state.history];
    const prev = history.pop() ?? "s0";
    set({ screen: prev, history });
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  },
  goHome() {
    set({ screen: "s0", history: [] });
  },
  setIntakeTab(intakeTab: IntakeTab) {
    set({ intakeTab });
  },
  setPassage(passage: string, opts?: { demoId?: string | null; isDemo?: boolean }) {
    set({
      passage,
      demoId: opts?.demoId ?? null,
      isDemo: opts?.isDemo ?? false,
      analysis: null,
      selectedSlipId: null,
      readCount: 0,
      prevSlipCount: null,
    });
    void kvSet("passage", passage);
  },
  setOcr(ocrWords: State["ocrWords"], ocrSeconds: number | null) {
    set({ ocrWords, ocrSeconds });
  },
  newRecording(durationSec: number) {
    set({ recordingId: state.recordingId + 1, durationSec });
  },
  setAnalysis(analysis: Analysis) {
    // most-severe slip is selected by default (S4: "resolve to most-severe by default")
    const sorted = [...analysis.highlights].sort((a, b) => sevRank(b.severity) - sevRank(a.severity) || a.gop - b.gop);
    const selectedSlipId = sorted[0]?.id ?? null;
    const prevSlipCount = state.analysis ? state.analysis.highlights.length : null;
    set({
      analysis,
      selectedSlipId,
      prevSlipCount,
      readCount: state.readCount + 1,
    });
  },
  selectSlip(id: string) {
    set({ selectedSlipId: id });
  },
  setSettings(patch: Partial<Settings>) {
    const runtimeChanged = patch.runtime && patch.runtime !== state.settings.runtime;
    const settings = { ...state.settings, ...patch };
    set({ settings });
    void kvSet("settings", settings);
    // a runtime change must actually take effect on the next analysis, not stay inert
    if (runtimeChanged) void import("./model").then((m) => m.resetModel());
  },
  setModelStatus(modelStatus: ModelStatus) {
    set({ modelStatus });
  },
  setModelProgress(modelProgress: ModelProgress | null) {
    set({ modelProgress });
  },
  setNetwork(networkCount: number, bytesSent: number) {
    if (networkCount !== state.networkCount || bytesSent !== state.bytesSent)
      set({ networkCount, bytesSent });
  },
  setDegraded(degradedNote: string | null) {
    set({ degradedNote });
  },
  setInstallAvailable(installAvailable: boolean) {
    set({ installAvailable });
  },
  toast(msg: string | null) {
    set({ toast: msg });
    if (toastTimer) clearTimeout(toastTimer);
    if (msg) toastTimer = setTimeout(() => set({ toast: null }), 2600);
  },
  async clearAll() {
    await clearLocalData();
    // also wipe the in-memory recording — the privacy promise must hold for real
    try {
      (await import("./audio")).clearRecording();
    } catch {
      /* ignore */
    }
    set({
      passage: "",
      demoId: null,
      isDemo: false,
      analysis: null,
      selectedSlipId: null,
      readCount: 0,
      prevSlipCount: null,
      ocrWords: null,
      durationSec: 0,
    });
    actions.toast("Local data cleared.");
  },
  async hydrate() {
    const [settings, passage] = await Promise.all([
      kvGet<Settings>("settings"),
      kvGet<string>("passage"),
    ]);
    const patch: Partial<State> = {};
    if (settings) patch.settings = { ...DEFAULT_SETTINGS, ...settings };
    if (typeof passage === "string") patch.passage = passage;
    if (Object.keys(patch).length) set(patch);
  },
};

function sevRank(s: string): number {
  return s === "s3" ? 3 : s === "s2" ? 2 : s === "s1" ? 1 : 0;
}
