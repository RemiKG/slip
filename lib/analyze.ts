// The pipeline that turns a recording into the money shot — all deterministic after the
// model emits posteriors. The model listens; THIS math judges.
//
//   16 kHz audio ──(model)──▶ raw logits ──log_softmax──▶ posteriors
//   passage ──(espeak G2P)──▶ expected phoneme ids + grapheme anchors
//   posteriors + expected ──(forced align)──▶ per-phoneme frame spans
//   spans ──(GOP-CTC)──▶ which sound slipped, expected→heard, onset, severity
import { logSoftmaxRows } from "./dsp";
import { forcedAlign } from "./align";
import { gop } from "./gop";
import { buildExpected } from "./g2p";
import { loadModel, runLogits } from "./model";
import { getServerLogits } from "./backend";
import { sensitivityShift } from "./constants";
import type { Analysis, Highlight, ModelProgress, Settings } from "./types";

function isSpecial(tok: string | undefined): boolean {
  return !tok || tok.startsWith("<");
}
function cleanIpa(tok: string | undefined): string {
  return isSpecial(tok) ? "" : (tok as string);
}

export interface AnalyzeOpts {
  passage: string;
  pcm16k: Float32Array;
  durationSec: number;
  settings: Settings;
  backend: "browser" | "server";
  serverUrl?: string;
  onModelProgress?: (p: ModelProgress | null) => void;
}

export async function analyzePassage(opts: AnalyzeOpts): Promise<Analysis> {
  const { passage, pcm16k, durationSec, settings, backend, serverUrl } = opts;
  const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();

  let raw: Float32Array;
  let frames: number;
  let vocab: number;
  let vocabMap: Record<string, number>;
  let id2ipa: string[];
  let blankId: number;
  let backendLabel: string;

  if (backend === "server" && serverUrl) {
    const sl = await getServerLogits(serverUrl, pcm16k);
    raw = sl.raw;
    frames = sl.frames;
    vocab = sl.vocab;
    vocabMap = sl.vocabMap;
    id2ipa = sl.id2ipa;
    blankId = sl.blankId;
    backendLabel = "server";
  } else {
    const m = await loadModel(settings.runtime, opts.onModelProgress);
    const out = await runLogits(m, pcm16k);
    raw = out.raw;
    frames = out.frames;
    vocab = out.vocab;
    vocabMap = m.vocab;
    id2ipa = m.id2ipa;
    blankId = m.blankId;
    const isolated = typeof crossOriginIsolated !== "undefined" && crossOriginIsolated;
    backendLabel = m.device === "webgpu" ? "webgpu" : isolated ? "wasm-simd" : "wasm";
  }

  const logP = logSoftmaxRows(raw, frames, vocab);
  const expected = await buildExpected(passage, vocabMap);

  const base: Analysis = {
    passage,
    highlights: [],
    durationSec,
    phonemeCount: expected.tokens.length,
    framesPerSec: 50,
    latencyMs: 0,
    backend,
    backendLabel,
  };

  if (expected.tokens.length === 0) {
    return {
      ...base,
      latencyMs: now() - t0,
      flagged: "Couldn’t work out the expected sounds for this text — try simpler words.",
    };
  }

  const spans = forcedAlign(logP, frames, vocab, expected.tokens, blankId);
  const shift = sensitivityShift(settings.sensitivity);
  const results = gop(logP, vocab, spans, blankId, shift);

  const words = passage.match(/\S+/g) ?? [];
  const raws: Highlight[] = [];
  for (const r of results) {
    if (r.severity === "good") continue;
    const i = r.tokenIndex;
    const anchor = expected.anchors[i];
    if (!anchor) continue;
    const expIpa = expected.ipa[i] || cleanIpa(id2ipa[r.canonicalId]);
    let heardIpa = cleanIpa(id2ipa[r.heardId]);
    const isSub = r.isSub && !!heardIpa && heardIpa !== expIpa;
    if (!isSub) heardIpa = expIpa; // distortion (same sound, came out unclear)
    raws.push({
      id: `h${i}`,
      start: anchor.start,
      end: anchor.end,
      word: words[anchor.wordIndex] ?? "",
      severity: r.severity,
      expectedIpa: expIpa || "·",
      heardIpa: heardIpa || expIpa || "·",
      isSub,
      startMs: r.startMs,
      endMs: r.endMs,
      gop: r.gop,
      lowConfidence: r.lowConfidence,
    });
  }

  // merge highlights that land on the SAME grapheme span (keep the worst)
  const merged = new Map<string, Highlight>();
  for (const h of raws) {
    const key = `${h.start}-${h.end}`;
    const cur = merged.get(key);
    if (!cur || sevRank(h.severity) > sevRank(cur.severity) || (sevRank(h.severity) === sevRank(cur.severity) && h.gop < cur.gop)) {
      merged.set(key, h);
    }
  }
  const highlights = [...merged.values()].sort((a, b) => a.start - b.start);

  return { ...base, highlights, latencyMs: now() - t0 };
}

function now(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}
function sevRank(s: string): number {
  return s === "s3" ? 3 : s === "s2" ? 2 : s === "s1" ? 1 : 0;
}
