// Goodness-of-Pronunciation over the aligned CTC posteriors. Deterministic math, not a
// model's mood. GOP-Avg = mean over the aligned frames of log P(canonical phone | frame);
// closer to 0 is better. We also report the log-posterior ratio, the "heard" phone
// (argmax non-blank posterior over the span), and a severity bucket.
//
// Honest framing (research/findings.md): raw GOP-CTC ≈ 0.44–0.46 phone-level correlation
// vs human raters — useful and directionally right, NOT examiner-grade. The severity
// thresholds below are uncalibrated starting points shifted by the sensitivity slider;
// short (<3-frame) peaky-CTC segments are flagged low-confidence and never over-trusted.
import { FRAME_MS, GOP_THRESHOLDS } from "./constants";
import type { Span } from "./align";
import type { Severity } from "./types";

export interface PhoneResult {
  tokenIndex: number;
  canonicalId: number;
  heardId: number;
  gop: number;
  gopRatio: number;
  severity: Severity;
  isSub: boolean;
  startMs: number;
  endMs: number;
  nFrames: number;
  lowConfidence: boolean;
}

export function toSeverity(gop: number, shift: number): Severity {
  // shift > 0 (Gentle) makes the cutoffs more negative -> fewer slips; shift < 0 (Strict) -> more.
  if (gop >= GOP_THRESHOLDS.good - shift) return "good";
  if (gop >= GOP_THRESHOLDS.mild - shift) return "s1";
  if (gop >= GOP_THRESHOLDS.moderate - shift) return "s2";
  return "s3";
}

export function gop(
  logP: Float64Array,
  vocab: number,
  spans: Span[],
  blank: number,
  shift: number
): PhoneResult[] {
  return spans.map((span) => {
    let s = span.start;
    let e = span.end;
    if (e <= s) e = s + 1;
    const n = e - s;

    let sumCanon = 0;
    let sumBestNonBlank = 0;
    const acc = new Float64Array(vocab);
    for (let t = s; t < e; t++) {
      const row = t * vocab;
      sumCanon += logP[row + span.tokenId];
      let bnb = -Infinity;
      for (let k = 0; k < vocab; k++) {
        if (k === blank) continue;
        const v = logP[row + k];
        acc[k] += v;
        if (v > bnb) bnb = v;
      }
      sumBestNonBlank += bnb;
    }

    const gopAvg = sumCanon / n;
    const gopRatio = (sumCanon - sumBestNonBlank) / n;

    let heardId = span.tokenId;
    let bestAcc = -Infinity;
    for (let k = 0; k < vocab; k++) {
      if (k === blank) continue;
      if (acc[k] > bestAcc) {
        bestAcc = acc[k];
        heardId = k;
      }
    }

    const lowConfidence = n < 3 || !span.present;
    return {
      tokenIndex: span.tokenIndex,
      canonicalId: span.tokenId,
      heardId,
      gop: gopAvg,
      gopRatio,
      severity: toSeverity(gopAvg, shift),
      isSub: heardId !== span.tokenId,
      startMs: s * FRAME_MS,
      endMs: e * FRAME_MS,
      nFrames: n,
      lowConfidence,
    };
  });
}
