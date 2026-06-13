// On-device OCR for "photograph a page" (tesseract.js, WASM). Self-hosted worker/core +
// eng traineddata under /tesseract so it works offline after the first load. We pass
// { blocks: true } (required in v6/v7) to read per-WORD confidence, then FLAG low-confidence
// words rather than hiding them — the same honesty principle as the rest of Slip.

type OcrWord = { text: string; confidence: number; flag: "ok" | "review" | "low" };
export interface OcrResult {
  text: string;
  words: OcrWord[];
  pageConfidence: number;
  seconds: number;
}

// loose handle type — tesseract.js types vary across versions
type Worker = {
  recognize: (
    image: unknown,
    opts?: Record<string, unknown>,
    output?: Record<string, unknown>
  ) => Promise<{ data: unknown }>;
  setParameters: (p: Record<string, unknown>) => Promise<unknown>;
  terminate: () => Promise<unknown>;
};

let worker: Worker | null = null;

export async function getWorker(onProgress?: (p: number) => void): Promise<Worker> {
  if (worker) return worker;
  const tess = await import("tesseract.js");
  const createWorker = (tess as unknown as { createWorker: (...a: unknown[]) => Promise<Worker> }).createWorker;
  const PSM = (tess as unknown as { PSM: Record<string, unknown> }).PSM;
  const OEM = (tess as unknown as { OEM: Record<string, number> }).OEM;
  worker = await createWorker("eng", OEM?.LSTM_ONLY ?? 1, {
    workerPath: "/tesseract/worker.min.js",
    corePath: "/tesseract",
    langPath: "/tesseract",
    logger: (m: { status?: string; progress?: number }) => {
      if (m.status === "recognizing text" && typeof m.progress === "number") onProgress?.(m.progress);
    },
  });
  await worker.setParameters({ tessedit_pageseg_mode: (PSM?.SINGLE_BLOCK as unknown) ?? "6" });
  return worker;
}

export async function recognize(image: unknown, onProgress?: (p: number) => void): Promise<OcrResult> {
  const t0 = performance.now();
  const w = await getWorker(onProgress);
  const { data } = await w.recognize(image, {}, { blocks: true });
  const d = data as {
    text?: string;
    confidence?: number;
    blocks?: { paragraphs?: { lines?: { words?: { text: string; confidence: number }[] }[] }[] }[];
  };
  const words: OcrWord[] = [];
  for (const block of d.blocks ?? []) {
    for (const para of block.paragraphs ?? []) {
      for (const line of para.lines ?? []) {
        for (const wd of line.words ?? []) {
          words.push({
            text: wd.text,
            confidence: wd.confidence,
            flag: wd.confidence < 50 ? "low" : wd.confidence < 72 ? "review" : "ok",
          });
        }
      }
    }
  }
  return {
    text: (d.text ?? "").trim(),
    words,
    pageConfidence: d.confidence ?? 0,
    seconds: (performance.now() - t0) / 1000,
  };
}

export async function terminate(): Promise<void> {
  if (worker) {
    try {
      await worker.terminate();
    } catch {
      /* ignore */
    }
    worker = null;
  }
}
