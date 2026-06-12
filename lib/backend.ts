// The opt-in server seam (PHONEME_BACKEND=browser|server).
//
// A tiny inference endpoint can return the IDENTICAL raw logits so the SAME alignment +
// GOP runs either way (only WHERE the posteriors are computed changes). It activates the
// moment NEXT_PUBLIC_PHONEME_SERVER_URL is set; until then, choosing "Server" degrades
// HONESTLY — the app says so plainly and keeps running fully on-device. It never fakes a
// verdict, and a server call visibly flips the network ledger off 0 (the disclosed cost).
import { resetNetwork } from "./network";

const ENV_BACKEND = process.env.NEXT_PUBLIC_PHONEME_BACKEND; // "browser" | "server" | undefined
const SERVER_URL = process.env.NEXT_PUBLIC_PHONEME_SERVER_URL; // e.g. https://slip-infer.example.run.app

export function serverConfigured(): boolean {
  return !!SERVER_URL && /^https?:\/\//.test(SERVER_URL);
}

export interface BackendChoice {
  backend: "browser" | "server";
  serverUrl?: string;
  degraded?: string; // honest message shown when the user asked for server but it isn't wired
}

export function resolveBackend(userChoice: "device" | "server"): BackendChoice {
  const wantsServer = userChoice === "server" || ENV_BACKEND === "server";
  if (wantsServer) {
    if (serverConfigured()) return { backend: "server", serverUrl: SERVER_URL };
    return {
      backend: "browser",
      degraded:
        "A helper server isn’t connected in this build — Slip is running fully on your device.",
    };
  }
  return { backend: "browser" };
}

export interface ServerLogits {
  raw: Float32Array;
  frames: number;
  vocab: number;
  id2ipa: string[];
  vocabMap: Record<string, number>;
  blankId: number;
}

// POST raw little-endian Float32 PCM (the same array the model would get) and decode the
// RAW logits the server returns. log_softmax happens later in the SAME shared code.
export async function getServerLogits(serverUrl: string, pcm16k: Float32Array): Promise<ServerLogits> {
  void resetNetwork; // (the in-page ledger counts this fetch automatically)
  // copy into a fresh (non-shared) ArrayBuffer — threaded WASM can back the Float32Array
  // with a SharedArrayBuffer, which fetch() bodies don't accept.
  const payload = new Uint8Array(pcm16k.byteLength);
  payload.set(new Uint8Array(pcm16k.buffer, pcm16k.byteOffset, pcm16k.byteLength));
  const res = await fetch(`${serverUrl.replace(/\/$/, "")}/infer_pcm`, {
    method: "POST",
    headers: { "content-type": "application/octet-stream" },
    body: payload,
  });
  if (!res.ok) throw new Error(`Helper server returned ${res.status}.`);
  const json = (await res.json()) as {
    logits_b64: string;
    shape: [number, number];
    vocab: Record<string, number>;
    blank_id?: number;
  };
  const bin = atob(json.logits_b64);
  if (bin.length % 4 !== 0) throw new Error("Helper server returned malformed logits.");
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const raw = new Float32Array(bytes.buffer);
  const [frames, vocab] = json.shape;
  const id2ipa: string[] = [];
  const vocabMap: Record<string, number> = {};
  for (const [tok, id] of Object.entries(json.vocab)) {
    id2ipa[id] = tok;
    vocabMap[tok] = id;
  }
  return { raw, frames, vocab, id2ipa, vocabMap, blankId: json.blank_id ?? vocabMap["<pad>"] ?? 0 };
}
