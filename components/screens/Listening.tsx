"use client";
import { useStore } from "@/lib/store";
import { THESIS } from "@/lib/constants";

// state · listening — the on-device analysing moment. Real pipeline surfaced as it runs.
export default function Listening() {
  const { passage } = useStore();
  const letters = passage.replace(/[^A-Za-z]/g, "").length;
  const estPhonemes = Math.max(4, Math.min(220, Math.round(letters * 0.82)));

  return (
    <>
      <div className="pagepad" style={{ marginTop: 6 }}>
        <div className="card pad-lg" style={{ opacity: 0.5 }}>
          <div className="passage" style={{ fontSize: 23 }}>
            {passage}
          </div>
        </div>
      </div>

      <div className="grow center" style={{ justifyContent: "center" }}>
        <div className="listening" style={{ fontSize: 19, color: "var(--ink)" }}>
          <span className="eq" style={{ height: 30 }}>
            <i style={{ height: 18 }} />
            <i style={{ height: 28 }} />
            <i style={{ height: 12 }} />
            <i style={{ height: 24 }} />
            <i style={{ height: 16 }} />
            <i style={{ height: 30 }} />
          </span>
          <span>listening…</span>
        </div>
        <p className="lead" style={{ textAlign: "center", marginTop: 18 }}>
          analysing on your device — no spinner to a server
        </p>

        <div className="card flat pad" style={{ marginTop: 30, minWidth: 300 }}>
          <div className="kv" style={{ paddingTop: 0, border: 0 }}>
            <span className="k">posteriors</span>
            <span className="v">50 frames / s</span>
          </div>
          <div className="kv">
            <span className="k">forced-aligning</span>
            <span className="v">{estPhonemes} phonemes · trellis</span>
          </div>
          <div className="kv">
            <span className="k">scoring</span>
            <span className="v">
              GOP-CTC <span className="u">· over posteriors</span>
            </span>
          </div>
        </div>
      </div>

      <div className="center" style={{ padding: "8px 0 28px" }}>
        <div className="data tiny" style={{ color: "var(--ink-mute)", letterSpacing: ".2px" }}>
          {THESIS}
        </div>
      </div>
    </>
  );
}
