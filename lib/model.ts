// TODO: dtype temporarily pinned; wire from constants once added
// The in-browser phoneme model: facebook/wav2vec2-lv-60-espeak-cv-ft, pre-converted to
// ONNX (onnx-community/...-ONNX) and run via transformers.js / onnxruntime-web. We load
// it for RAW frame-wise logits (AutoModelForCTC), NOT the ASR pipeline (which would hide
// the posteriors the GOP math needs). Cached by transformers.js after the one-time
// download, so it then runs fully offline.
import { MODEL_ID, DTYPE_DEFAULT } from "./constants";
import type { ModelProgress, Runtime } from "./types";
import vocabJson from "./vocab.json";

// The model's token->id map, bundled (tiny, stable, offline). The logit indices the model
// emits correspond exactly to these ids — far more robust than introspecting the tokenizer.
const VOCAB = vocabJson as Record<string, number>;

// transformers.js has loose types; keep these local and narrow.
type Tensor = { data: Float32Array; dims: number[] };
type Processor = (audio: Float32Array) => Promise<Record<string, unknown>>;
type Model = (inputs: Record<string, unknown>) => Promise<{ logits: Tensor }>;

export interface LoadedModel {
  processor: Processor;
  model: Model;
  vocab: Record<string, number>; // token -> id
  id2ipa: string[]; // id -> token string
  blankId: number;
  dtype: string;
  device: "wasm" | "webgpu";
}

let loaded: LoadedModel | null = null;
let loading: Promise<LoadedModel> | null = null;

function pickDevice(runtime: Runtime, webgpuAvailable: boolean): "wasm" | "webgpu" {
  // wav2vec2's conv stack is typically SLOWER on WebGPU (ORT-web #21618), so WASM-SIMD is
  // first-class; GPU is only used when explicitly chosen and actually available.
  if (runtime === "gpu" && webgpuAvailable) return "webgpu";
  return "wasm";
}

export function getLoadedModel(): LoadedModel | null {
  return loaded;
}

// Drop the loaded instance so the next analysis re-instantiates with new settings (e.g. a
// runtime change). The downloaded files stay cached, so this does NOT re-download.
export function resetModel(): void {
  loaded = null;
  loading = null;
}

export async function loadModel(
  runtime: Runtime,
  onProgress?: (p: ModelProgress | null) => void
): Promise<LoadedModel> {
  if (loaded) return loaded;
  if (loading) return loading;

  loading = (async () => {
    const tf = await import("@huggingface/transformers");
    const { AutoProcessor, AutoModelForCTC, env } = tf as unknown as {
      AutoProcessor: { from_pretrained: (id: string, opts?: object) => Promise<unknown> };
      AutoModelForCTC: { from_pretrained: (id: string, opts?: object) => Promise<unknown> };
      env: { backends: { onnx: { wasm: { numThreads?: number; proxy?: boolean } } } };
    };

    // Multi-thread WASM only when the page is cross-origin isolated (COOP/COEP). Otherwise
    // ORT silently falls back to a single thread — slower, but it still works.
    const isolated = typeof crossOriginIsolated !== "undefined" && crossOriginIsolated;
    const cores = typeof navigator !== "undefined" ? navigator.hardwareConcurrency || 4 : 4;
    try {
      env.backends.onnx.wasm.numThreads = isolated ? Math.min(cores, 8) : 1;
    } catch {
      /* ignore */
    }

    const webgpuAvailable =
      typeof navigator !== "undefined" && "gpu" in navigator && !!(navigator as { gpu?: unknown }).gpu;
    const device = pickDevice(runtime, webgpuAvailable);
    const dtype = device === "webgpu" ? "fp16" : DTYPE_DEFAULT;

    const progress_callback = (p: {
      status?: string;
      file?: string;
      loaded?: number;
      total?: number;
    }) => {
      if (!onProgress) return;
      if (p.status === "progress" && p.file && /\.onnx$/i.test(p.file) && p.total) {
        onProgress({ loadedBytes: p.loaded ?? 0, totalBytes: p.total, file: p.file });
      } else if (p.status === "done" && p.file && /\.onnx$/i.test(p.file)) {
        onProgress({ loadedBytes: p.total ?? 0, totalBytes: p.total ?? 0, file: p.file });
      }
    };

    const processorRaw = await AutoProcessor.from_pretrained(MODEL_ID, { progress_callback });
    const modelRaw = await AutoModelForCTC.from_pretrained(MODEL_ID, {
      dtype,
      device,
      progress_callback,
    });

    const vocab = VOCAB;
    const id2ipa: string[] = [];
    for (const [tok, id] of Object.entries(vocab)) id2ipa[id] = tok;
    const blankId = vocab["<pad>"] ?? 0;

    const processor: Processor = async (audio) =>
      (await (processorRaw as unknown as (a: Float32Array) => Promise<Record<string, unknown>>)(
        audio
      )) as Record<string, unknown>;
    const model: Model = async (inputs) =>
      (await (modelRaw as unknown as (i: Record<string, unknown>) => Promise<{ logits: Tensor }>)(
        inputs
      )) as { logits: Tensor };

    loaded = { processor, model, vocab, id2ipa, blankId, dtype, device };
    return loaded;
  })();

  try {
    return await loading;
  } finally {
    loading = null;
  }
}

// Run the model on a 16 kHz mono Float32Array; return raw logits + shape.
export async function runLogits(
  m: LoadedModel,
  pcm16k: Float32Array
): Promise<{ raw: Float32Array; frames: number; vocab: number }> {
  const inputs = await m.processor(pcm16k);
  const { logits } = await m.model(inputs);
  const [, frames, vocab] = logits.dims;
  return { raw: logits.data, frames, vocab };
}
