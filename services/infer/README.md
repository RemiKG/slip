# Slip — phoneme inference seam (optional)

A tiny FastAPI service that runs the **same** checkpoint the browser uses
(`facebook/wav2vec2-lv-60-espeak-cv-ft`) and returns the **raw frame-wise logits**, so the
**identical** TypeScript forced-alignment + GOP code in the web app produces the verdict
either way. Only *where* the posteriors are computed changes.

**This is off by default.** Slip runs fully on-device. This service exists only as an
opt-in fallback for weak / low-storage devices that struggle with the ~318 MB in-browser
model. Audio is processed in memory and **never stored**. When a user picks *Server* in
settings, the app's network ledger visibly leaves `0` — that is the honest, disclosed cost.

## Run locally

```bash
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 7860
```

Then point the web app at it (in `repo/.env.local`):

```
NEXT_PUBLIC_PHONEME_SERVER_URL=http://localhost:7860
```

Set `ALLOWED_ORIGINS` to your app's exact origin(s) for CORS, e.g.
`ALLOWED_ORIGINS=https://slip.example.com`.

## Deploy

It cannot live in the Next.js/Vercel app (torch + a 1.26 GB checkpoint exceeds serverless
limits). Use a long-lived container — e.g. a **Hugging Face Space (Docker SDK)** (expose
7860; caches go to `/tmp`) or **Google Cloud Run** (`--memory 2Gi --cpu 2 --timeout 120`).
The `Dockerfile` bakes the model in for fast cold starts.

## Endpoints

- `POST /infer_pcm` — body = raw little-endian float32 mono PCM @16 kHz (the parity path;
  the browser already has this array). Returns `{ logits_b64, shape:[frames,vocab], vocab,
  frames_per_second, blank_id }`.
- `POST /infer_audio` — multipart WAV/FLAC convenience upload.
- `GET /healthz` — readiness + model facts.

The server returns **raw logits** (no softmax); `log_softmax` is applied in the shared
client code so both backends run byte-for-byte the same alignment + GOP. (The browser runs
an int8 ONNX export and the server runs FP32 torch, so the numbers are *near*-identical, not
bit-identical — the same pipeline, not the same bits.)
