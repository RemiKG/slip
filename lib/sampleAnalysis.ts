import type { Analysis } from "./types";

// A faithful stand-in of the canonical demo analysis ("The thorough thrush thawed
// three thick thorns." → 6 /θ/ slips), used ONLY to render S4/S5/S6 before a real
// recording exists (e.g. for visual checks). The live path always replaces it with a
// genuine analysis computed from the user's own audio.
export const SAMPLE_PASSAGE = "The thorough thrush thawed three thick thorns.";

// sine-blended peaks, ~58 bars, like the design mockup's waveform
export function samplePeaks(n = 58): number[] {
  const out: number[] = [];
  let max = 1e-6;
  for (let i = 0; i < n; i++) {
    const v = Math.abs(
      Math.sin(i * 0.55) + 0.6 * Math.sin(i * 1.6 + 1) + 0.33 * Math.sin(i * 0.29 + 2)
    );
    out.push(v);
    if (v > max) max = v;
  }
  return out.map((v) => v / max);
}

export const SAMPLE_ANALYSIS: Analysis = {
  passage: SAMPLE_PASSAGE,
  durationSec: 3.1,
  phonemeCount: 37,
  framesPerSec: 50,
  latencyMs: 1800,
  backend: "browser",
  backendLabel: "wasm-simd",
  highlights: [
    { id: "h0", start: 4, end: 6, word: "thorough", severity: "s3", expectedIpa: "θ", heardIpa: "f", isSub: true, startMs: 410, endMs: 620, gop: -3.3, lowConfidence: false },
    { id: "h1", start: 13, end: 15, word: "thrush", severity: "s2", expectedIpa: "θ", heardIpa: "f", isSub: true, startMs: 980, endMs: 1120, gop: -2.1, lowConfidence: false },
    { id: "h2", start: 20, end: 22, word: "thawed", severity: "s1", expectedIpa: "θ", heardIpa: "θ̠", isSub: false, startMs: 1480, endMs: 1600, gop: -1.2, lowConfidence: false },
    { id: "h3", start: 27, end: 29, word: "three", severity: "s2", expectedIpa: "θ", heardIpa: "f", isSub: true, startMs: 1980, endMs: 2120, gop: -2.0, lowConfidence: false },
    { id: "h4", start: 33, end: 35, word: "thick", severity: "s1", expectedIpa: "θ", heardIpa: "t", isSub: true, startMs: 2420, endMs: 2540, gop: -1.1, lowConfidence: false },
    { id: "h5", start: 39, end: 41, word: "thorns", severity: "s1", expectedIpa: "θ", heardIpa: "θ̠", isSub: false, startMs: 2820, endMs: 2960, gop: -1.0, lowConfidence: false },
  ],
};
