// Numerically-stable log-softmax over each frame's logits.
// ONNX wav2vec2 returns RAW logits; the SAME function runs on the browser path and the
// server-seam path, so the downstream alignment + GOP math is identical either way.
export function logSoftmaxRows(
  raw: Float32Array | number[],
  frames: number,
  vocab: number
): Float64Array {
  const out = new Float64Array(frames * vocab);
  for (let f = 0; f < frames; f++) {
    const o = f * vocab;
    let max = -Infinity;
    for (let v = 0; v < vocab; v++) {
      const x = raw[o + v];
      if (x > max) max = x;
    }
    let sum = 0;
    for (let v = 0; v < vocab; v++) sum += Math.exp(raw[o + v] - max);
    const lse = max + Math.log(sum);
    for (let v = 0; v < vocab; v++) out[o + v] = raw[o + v] - lse;
  }
  return out;
}
