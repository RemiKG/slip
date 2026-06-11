// Audio capture + waveform peaks + per-segment replay, all in the browser.
// We record via MediaRecorder, decode + resample to a 16 kHz mono Float32Array for the
// model, and keep the ORIGINAL full-rate buffer for crisp replay of the user's own voice.

const SAMPLE_RATE = 16000;

let ctx: AudioContext | null = null;
let fullBuffer: AudioBuffer | null = null; // original rate — replay this (not muffled)
let pcm16k: Float32Array | null = null; // model input
let peaks: number[] = [];
let durationSec = 0;
let activeSource: AudioBufferSourceNode | null = null;
let raf = 0;

export function getAudioContext(): AudioContext {
  if (!ctx) {
    const Ctor =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export interface RecorderHandle {
  stream: MediaStream;
  analyser: AnalyserNode;
  recorder: MediaRecorder;
  chunks: Blob[];
}

export async function startRecording(): Promise<RecorderHandle> {
  const audioCtx = getAudioContext();
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: false, // off so the level meter reflects the reader, not a normalizer
    },
  });
  const srcNode = audioCtx.createMediaStreamSource(stream);
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 2048;
  srcNode.connect(analyser); // sink only — never to destination (no echo)

  const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
    ? "audio/webm;codecs=opus"
    : MediaRecorder.isTypeSupported("audio/webm")
    ? "audio/webm"
    : "";
  const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  recorder.start();
  return { stream, analyser, recorder, chunks };
}

export function stopRecording(h: RecorderHandle): Promise<Blob> {
  return new Promise((resolve) => {
    h.recorder.onstop = () => {
      h.stream.getTracks().forEach((t) => t.stop());
      resolve(new Blob(h.chunks, { type: h.recorder.mimeType || "audio/webm" }));
    };
    try {
      h.recorder.requestData();
    } catch {
      /* ignore */
    }
    h.recorder.stop();
  });
}

// Live input level 0..1 (RMS) for the calibration ring + the 5 level bars.
export function meterLoop(analyser: AnalyserNode, onLevel: (lvl: number) => void): () => void {
  const buf = new Float32Array(analyser.fftSize);
  let id = 0;
  const tick = () => {
    analyser.getFloatTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    const rms = Math.sqrt(sum / buf.length);
    onLevel(Math.min(1, rms * 3.2));
    id = requestAnimationFrame(tick);
  };
  tick();
  return () => cancelAnimationFrame(id);
}

// Decode any recorded/loaded blob -> store full-rate buffer + 16 kHz mono pcm + peaks.
export async function ingestBlob(blob: Blob): Promise<{ durationSec: number; peaks: number[] }> {
  const audioCtx = getAudioContext();
  const arrayBuffer = await blob.arrayBuffer();
  const decoded = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
  fullBuffer = decoded;
  durationSec = decoded.duration;

  if (decoded.sampleRate === SAMPLE_RATE) {
    pcm16k = decoded.getChannelData(0).slice();
  } else {
    const len = Math.ceil(decoded.duration * SAMPLE_RATE);
    const offline = new OfflineAudioContext(1, Math.max(1, len), SAMPLE_RATE);
    const src = offline.createBufferSource();
    src.buffer = decoded;
    src.connect(offline.destination);
    src.start(0);
    const rendered = await offline.startRendering();
    pcm16k = rendered.getChannelData(0).slice();
  }
  peaks = computePeaks(pcm16k, 58);
  return { durationSec, peaks };
}

export async function ingestUrl(url: string): Promise<{ durationSec: number; peaks: number[] }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load demo clip (${res.status}).`);
  const blob = await res.blob();
  return ingestBlob(blob);
}

export function computePeaks(samples: Float32Array, n = 58): number[] {
  if (!samples.length) return new Array(n).fill(0.06);
  const block = Math.max(1, Math.floor(samples.length / n));
  const out: number[] = [];
  let max = 1e-6;
  for (let i = 0; i < n; i++) {
    let m = 0;
    const s = i * block;
    for (let j = 0; j < block && s + j < samples.length; j++) {
      const v = Math.abs(samples[s + j]);
      if (v > m) m = v;
    }
    out.push(m);
    if (m > max) max = m;
  }
  return out.map((v) => Math.max(0.06, v / max));
}

export function getPcm16k(): Float32Array | null {
  return pcm16k;
}
export function getPeaks(): number[] {
  return peaks;
}
export function getDuration(): number {
  return durationSec;
}
export function hasRecording(): boolean {
  return !!fullBuffer;
}
export function clearRecording(): void {
  stopReplay();
  fullBuffer = null;
  pcm16k = null;
  peaks = [];
  durationSec = 0;
}

// Replay EXACTLY [t0,t1] of the user's own audio; onHead animates the playhead across it.
export function replaySegment(
  t0: number,
  t1: number,
  onHead: (sec: number) => void,
  onEnd?: () => void
): void {
  const audioCtx = getAudioContext();
  if (!fullBuffer) return;
  stopReplay();
  // widen very short slices so they're actually audible (the detected onset stays exact)
  let a = Math.max(0, t0);
  let b = Math.min(fullBuffer.duration, Math.max(t1, t0 + 0.001));
  if (b - a < 0.16) {
    const pad = (0.16 - (b - a)) / 2;
    a = Math.max(0, a - pad);
    b = Math.min(fullBuffer.duration, b + pad);
  }
  const src = audioCtx.createBufferSource();
  src.buffer = fullBuffer;
  src.connect(audioCtx.destination);
  activeSource = src;
  const startedAt = audioCtx.currentTime;
  const len = b - a;
  src.start(0, a, len);
  const tick = () => {
    const pos = a + (audioCtx.currentTime - startedAt);
    if (pos >= b) {
      onHead(b);
      return;
    }
    onHead(pos);
    raf = requestAnimationFrame(tick);
  };
  tick();
  src.onended = () => {
    cancelAnimationFrame(raf);
    onHead(t0);
    activeSource = null;
    onEnd?.();
  };
}

export function stopReplay(): void {
  cancelAnimationFrame(raf);
  if (activeSource) {
    try {
      activeSource.onended = null;
      activeSource.stop();
    } catch {
      /* already stopped */
    }
    activeSource = null;
  }
}
