"use client";
import { Ic, Ledger, Mascot } from "@/components/ui";
import { useStore } from "@/lib/store";
import { MODEL_SIZE_MB, DTYPE_DEFAULT } from "@/lib/constants";

// state · model-load — the one-time download, framed as the honest price of real ML.
export default function ModelLoad() {
  const { modelProgress, settings, modelStatus } = useStore();
  const totalMB = modelProgress?.totalBytes
    ? Math.round(modelProgress.totalBytes / 1e6)
    : MODEL_SIZE_MB[DTYPE_DEFAULT];
  const loadedMB = modelProgress?.loadedBytes ? Math.round(modelProgress.loadedBytes / 1e6) : 0;
  const pct = modelProgress?.totalBytes
    ? Math.min(100, Math.round((modelProgress.loadedBytes / modelProgress.totalBytes) * 100))
    : 4;

  return (
    <>
      <div className="grow center" style={{ justifyContent: "center", padding: "0 34px" }}>
        {settings.mascot ? (
          <Mascot variant="listen" size={72} />
        ) : (
          <Ic n="ic-chip" size={56} alt="" />
        )}
        <div className="h2" style={{ fontSize: 23, textAlign: "center", marginTop: 18 }}>
          Waking up the listening model
        </div>
        <p className="lead" style={{ textAlign: "center", maxWidth: 320, marginTop: 10 }}>
          A real phoneme model, downloaded <b className="inkword">once</b> — then it works
          offline, even in airplane mode.
        </p>

        <div style={{ width: "100%", maxWidth: 330, marginTop: 30 }}>
          <div className="prog">
            <i style={{ width: `${pct}%` }} />
          </div>
          <div className="rowflex" style={{ justifyContent: "space-between", marginTop: 10 }}>
            <span className="data" style={{ fontSize: 13, color: "var(--ink-soft)" }}>
              {loadedMB} / {totalMB} MB
            </span>
            <span className="data tiny" style={{ color: "var(--ink-mute)" }}>
              int8 · cached forever
            </span>
          </div>
        </div>

        <div className="card flat pad" style={{ marginTop: 30, maxWidth: 330 }}>
          <div className="tiny" style={{ textAlign: "center", lineHeight: 1.5 }}>
            A genuine <b className="inkword">315M-parameter</b> neural net, quantised to int8.
            That’s the honest price of running it on <b className="inkword">your</b> device — not
            on someone’s server.
          </div>
        </div>

        {modelStatus === "error" && (
          <div className="tiny" style={{ marginTop: 18, color: "var(--sev3)", textAlign: "center" }}>
            The download didn’t finish. Check your connection and try again.
          </div>
        )}
      </div>

      <div className="center" style={{ padding: "8px 0 26px" }}>
        <Ledger prefix="one download · then" value={0} />
      </div>
    </>
  );
}
