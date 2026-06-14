"""
Slip — optional phoneme inference seam.

A tiny FastAPI service that runs the SAME checkpoint the browser uses
(facebook/wav2vec2-lv-60-espeak-cv-ft) and returns the RAW frame-wise logits, so the
*identical* TypeScript forced-alignment + GOP code in the web app produces the verdict
either way — only WHERE the posteriors are computed changes. This exists for weak/low-
storage devices that can't hold the ~318 MB in-browser model.

It is OFF by default. The web app only calls it when the user picks "Server" in settings
AND NEXT_PUBLIC_PHONEME_SERVER_URL points here. Audio is processed in memory and never
stored. A server call visibly flips the app's network ledger off 0 — the disclosed cost.

Run locally:  uvicorn app:app --host 0.0.0.0 --port 7860
"""
import base64
import io
import os

import numpy as np
import torch
from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from transformers import AutoModelForCTC, AutoProcessor

MODEL_ID = "facebook/wav2vec2-lv-60-espeak-cv-ft"
SR = 16000
MAX_BYTES = 8 * 1024 * 1024  # ~2.6 min of f32 mono @16k — a DoS guard
ALLOWED = [o for o in os.environ.get("ALLOWED_ORIGINS", "").split(",") if o]

# Loaded ONCE at startup. do_normalize / return_attention_mask come from the checkpoint's
# preprocessor_config.json and MUST match transformers.js (both use population variance,
# eps 1e-7) so the logits — and therefore the verdict — line up.
processor = AutoProcessor.from_pretrained(MODEL_ID)
model = AutoModelForCTC.from_pretrained(MODEL_ID).eval()

# token -> id, identical to the browser's bundled vocab.json. <pad> is the CTC blank.
VOCAB = processor.tokenizer.get_vocab()
BLANK_ID = VOCAB.get("<pad>", 0)
FPS = float(SR) / float(np.prod(model.config.conv_stride))  # 16000 / 320 = 50.0

app = FastAPI(title="Slip phoneme inference seam")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED or ["http://localhost:3000", "http://localhost:3100"],
    allow_credentials=False,  # no cookies/auth are ever sent
    allow_methods=["POST", "OPTIONS", "GET"],
    allow_headers=["content-type"],
    max_age=600,
)


@app.middleware("http")
async def guard(request: Request, call_next):
    cl = request.headers.get("content-length")
    if cl and int(cl) > MAX_BYTES:
        return JSONResponse({"error": "payload too large"}, status_code=413)
    resp = await call_next(request)
    resp.headers["Cache-Control"] = "no-store"  # never cache audio-derived data
    return resp


def _logits(samples: np.ndarray) -> np.ndarray:
    inputs = processor(samples, sampling_rate=SR, return_tensors="pt")
    with torch.no_grad():
        out = model(**inputs)  # RAW logits — NO softmax (log_softmax happens in the shared TS)
    return out.logits[0].cpu().numpy().astype(np.float32)  # (frames, vocab)


def _respond(logits: np.ndarray) -> dict:
    return {
        "logits_b64": base64.b64encode(logits.tobytes()).decode("ascii"),
        "shape": list(logits.shape),  # [frames, vocab]
        "dtype": "float32",  # little-endian, row-major
        "vocab": VOCAB,  # token -> id
        "frames_per_second": FPS,  # 50.0
        "blank_id": BLANK_ID,  # 0
    }


@app.post("/infer_pcm")
async def infer_pcm(request: Request):
    """Primary parity path: body = raw little-endian float32 mono PCM, already 16 kHz."""
    raw = await request.body()
    if len(raw) == 0 or len(raw) % 4 != 0:
        raise HTTPException(400, "expected non-empty float32 PCM")
    samples = np.frombuffer(raw, dtype="<f4").copy()  # decoded in memory; never written to disk
    return _respond(_logits(samples))


@app.post("/infer_audio")
async def infer_audio(file: UploadFile = File(...)):
    """Convenience path for WAV/FLAC uploads (requires soundfile). Prefer /infer_pcm."""
    import soundfile as sf

    data = await file.read()
    samples, sr = sf.read(io.BytesIO(data), dtype="float32", always_2d=False)
    if samples.ndim > 1:
        samples = samples.mean(axis=1)
    if sr != SR:
        n = int(round(len(samples) * SR / sr))
        samples = np.interp(
            np.linspace(0, len(samples), n, endpoint=False), np.arange(len(samples)), samples
        ).astype(np.float32)
    return _respond(_logits(samples))


@app.get("/healthz")
def healthz():
    return {"ok": True, "frames_per_second": FPS, "vocab_size": len(VOCAB), "blank_id": BLANK_ID}
