// CTC forced alignment — the (2L+1) blank-interleaved Viterbi (the universally-correct
// form: it places a mandatory blank between adjacent identical phonemes, which the
// collapsed L-token recurrence cannot). This is the torchaudio forced_align algorithm,
// reimplemented in TypeScript (the upstream C++ op is deprecated). The model listens;
// THIS is the math that judges where each expected sound lands.

export interface Span {
  tokenId: number;
  tokenIndex: number; // index into the expected token sequence
  start: number; // first aligned frame (inclusive)
  end: number; // last aligned frame + 1 (exclusive)
  present: boolean; // false if the token had to be synthesised (audio too short)
}

const NEG = -Infinity;

export function forcedAlign(
  logP: Float64Array,
  frames: number,
  vocab: number,
  tokens: number[],
  blank: number
): Span[] {
  const T = frames;
  const L = tokens.length;
  if (L === 0 || T === 0) return [];

  const S = 2 * L + 1;
  const ext = new Int32Array(S);
  for (let i = 0; i < S; i++) ext[i] = i % 2 === 0 ? blank : tokens[(i - 1) >> 1];

  const dp = new Float64Array(T * S);
  dp.fill(NEG);
  const bp = new Int32Array(T * S);
  bp.fill(-1);

  dp[0] = logP[blank]; // state 0 (leading blank)
  if (S > 1) dp[1] = logP[ext[1]]; // state 1 (first token)

  for (let t = 1; t < T; t++) {
    const row = t * S;
    const prev = (t - 1) * S;
    const lrow = t * vocab;
    for (let s = 0; s < S; s++) {
      let best = dp[prev + s];
      let arg = s;
      if (s - 1 >= 0 && dp[prev + s - 1] > best) {
        best = dp[prev + s - 1];
        arg = s - 1;
      }
      // skip a blank only between two DIFFERENT tokens
      if (s % 2 === 1 && s - 2 >= 0 && ext[s] !== ext[s - 2] && dp[prev + s - 2] > best) {
        best = dp[prev + s - 2];
        arg = s - 2;
      }
      dp[row + s] = best === NEG ? NEG : best + logP[lrow + ext[s]];
      bp[row + s] = arg;
    }
  }

  // terminate in the final token (S-2) or the final blank (S-1)
  let s = S >= 2 && dp[(T - 1) * S + (S - 1)] >= dp[(T - 1) * S + (S - 2)] ? S - 1 : Math.max(0, S - 2);
  const stateSeq = new Int32Array(T);
  for (let t = T - 1; t >= 0; t--) {
    stateSeq[t] = s;
    const p = bp[t * S + s];
    s = p < 0 ? s : p;
  }

  // collapse contiguous runs of the same token-state into per-token spans
  const byIndex: (Span | null)[] = new Array(L).fill(null);
  let t = 0;
  while (t < T) {
    const cur = stateSeq[t];
    if (cur % 2 === 1) {
      let e = t;
      while (e < T && stateSeq[e] === cur) e++;
      const idx = (cur - 1) >> 1;
      byIndex[idx] = { tokenId: ext[cur], tokenIndex: idx, start: t, end: e, present: true };
      t = e;
    } else {
      t++;
    }
  }

  // ensure exactly one span per expected token (fill any the path skipped — rare, only
  // when the audio is shorter than the text — so GOP still has a frame to score).
  const spans: Span[] = [];
  let lastEnd = 0;
  for (let i = 0; i < L; i++) {
    let span = byIndex[i];
    if (!span) {
      const at = Math.min(Math.max(lastEnd, 0), T - 1);
      span = { tokenId: tokens[i], tokenIndex: i, start: at, end: at + 1, present: false };
    }
    spans.push(span);
    lastEnd = span.end;
  }
  return spans;
}
