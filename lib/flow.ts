// The flow controller — the glue screens call (always client-side, dynamically imported
// so the heavy ML libs stay out of the initial bundle).
import { actions, getState } from "./store";
import { loadModel, getLoadedModel } from "./model";
import { analyzePassage } from "./analyze";
import { resolveBackend, serverConfigured } from "./backend";
import { ingestUrl, getPcm16k, getDuration } from "./audio";
import { DEMO_LINES, type DemoLine } from "./constants";

// Ensure the phoneme model is ready, showing the one-time model-load screen if needed.
// On the server-seam path there's no local model, so this is a no-op.
export async function ensureModel(): Promise<boolean> {
  const st = getState();
  if (st.settings.model === "server" && serverConfigured()) return true;
  if (getLoadedModel()) {
    actions.setModelStatus("ready");
    return true;
  }
  actions.setModelStatus("loading");
  actions.navigate("modelload");
  try {
    await loadModel(getState().settings.runtime, (p) => actions.setModelProgress(p));
    actions.setModelStatus("ready");
    actions.setModelProgress(null);
    return true;
  } catch {
    actions.setModelStatus("error");
    actions.setModelProgress(null);
    actions.toast("Couldn’t load the listening model. Check your connection and retry.");
    return false;
  }
}

// S1/S2 "Use this text →": load the model the first time, then go to the read screen.
export async function goRead(): Promise<void> {
  const ok = await ensureModel();
  if (ok) actions.navigate("s3");
  else actions.navigate("s1");
}

// S3 stop → analyse the user's own recording.
export async function analyzeFromRecording(): Promise<void> {
  const pcm = getPcm16k();
  if (!pcm || pcm.length === 0) {
    actions.toast("No audio captured — try recording again.");
    return;
  }
  actions.navigate("listening");
  await runAnalysis(getState().passage, pcm, getDuration());
}

async function runAnalysis(passage: string, pcm: Float32Array, durationSec: number): Promise<void> {
  try {
    const s = getState().settings;
    const choice = resolveBackend(s.model);
    actions.setDegraded(choice.degraded ?? null);
    const analysis = await analyzePassage({
      passage,
      pcm16k: pcm,
      durationSec,
      settings: s,
      backend: choice.backend,
      serverUrl: choice.serverUrl,
      onModelProgress: (p) => actions.setModelProgress(p),
    });
    actions.setAnalysis(analysis);
    actions.navigate("s4");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "please try again";
    actions.toast(`Analysis didn’t complete — ${msg}`);
    actions.navigate("s3");
  }
}

// Demo path (no mic needed): load the bundled sample recording and analyse it for real.
async function playDemoRead(line: DemoLine, idx: number): Promise<void> {
  const ok = await ensureModel();
  if (!ok) return;
  try {
    await ingestUrl(line.reads[idx]);
  } catch {
    actions.toast("Couldn’t load the demo clip.");
    actions.navigate("s1");
    return;
  }
  actions.newRecording(getDuration());
  actions.navigate("listening");
  await runAnalysis(line.text, getPcm16k()!, getDuration());
}

export async function runDemo(line: DemoLine, idx: number): Promise<void> {
  actions.setPassage(line.text, { demoId: line.id, isDemo: true });
  await playDemoRead(line, idx);
}

// "Read it again": on a demo, advance to the improved sample read (the 6→2 win); on a
// real session, go back to re-record the same passage.
export async function readAgain(): Promise<void> {
  const st = getState();
  if (st.isDemo && st.demoId) {
    const line = DEMO_LINES.find((d) => d.id === st.demoId);
    if (line) {
      const nextIdx = Math.min(st.readCount, line.reads.length - 1);
      await playDemoRead(line, nextIdx);
      return;
    }
  }
  actions.navigate("s3");
}
