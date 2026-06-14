# Slip phoneme inference seam. Deploy to any container host (HF Spaces Docker SDK exposes
# 7860; Cloud Run injects $PORT). The model is baked in so cold starts don't refetch 1.26 GB.
FROM python:3.12-slim

# ffmpeg only needed if you enable /infer_audio for non-WAV formats; /infer_pcm needs none.
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

ENV HF_HOME=/tmp/hf TRANSFORMERS_CACHE=/tmp/hf HF_HUB_DISABLE_TELEMETRY=1
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py .
# Pre-download the checkpoint into the image (fast cold start).
RUN python -c "from transformers import AutoProcessor, AutoModelForCTC; \
m='facebook/wav2vec2-lv-60-espeak-cv-ft'; AutoProcessor.from_pretrained(m); AutoModelForCTC.from_pretrained(m)"

ENV PORT=7860
EXPOSE 7860
CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT}"]
