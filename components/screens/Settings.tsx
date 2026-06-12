"use client";
import { actions, Ic, TopBar } from "@/components/ui";
import { useStore } from "@/lib/store";
import { MODEL_SIZE_MB, DTYPE_DEFAULT, THESIS } from "@/lib/constants";
import type { HighlightCap, Runtime } from "@/lib/types";

const LANGS = [
  { lang: "en-us", label: "English (US)" },
  { lang: "en-gb", label: "English (UK)" },
];

export default function Settings() {
  const { settings, analysis, networkCount, modelProgress } = useStore();
  const modelMB = modelProgress?.totalBytes ? Math.round(modelProgress.totalBytes / 1e6) : MODEL_SIZE_MB[DTYPE_DEFAULT];
  const sensLabel =
    settings.sensitivity < 0.34 ? "gentle" : settings.sensitivity < 0.67 ? "balanced" : "strict";
  const lastMs = analysis?.latencyMs ?? 0;
  const lastLabel = analysis ? `${(lastMs / 1000).toFixed(1)} s · ${analysis.backendLabel}` : "— · not yet";

  const cycleLang = () => {
    const idx = LANGS.findIndex((l) => l.lang === settings.lang);
    const next = LANGS[(idx + 1) % LANGS.length];
    actions.setSettings({ lang: next.lang, langLabel: next.label });
  };

  const setSensFromEvent = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    actions.setSettings({ sensitivity: frac });
  };

  return (
    <>
      <TopBar title="Settings" subtitle="Everyday defaults are already the safe ones." onBack={() => actions.back()} />

      {/* Listening & language */}
      <div className="pagepad" style={{ marginTop: 8 }}>
        <div className="eyebrow" style={{ margin: "6px 4px 10px" }}>Listening &amp; language</div>
        <div className="card">
          <div className="row" onClick={cycleLang} role="button" tabIndex={0} style={{ cursor: "pointer" }}>
            <span className="ic"><Ic n="ic-globe" size={22} alt="" /></span>
            <div className="tx">
              <b>Target language &amp; accent</b>
              <span>what “correct” is measured against</span>
            </div>
            <span className="data" style={{ fontSize: 13, color: "var(--ink-soft)" }}>{settings.langLabel}&nbsp;›</span>
          </div>
          <div className="row">
            <span className="ic"><Ic n="ic-chip" size={22} alt="" /></span>
            <div className="tx">
              <b>Where it runs</b>
              <span>WASM is first-class; GPU only when faster</span>
            </div>
            <span className="seg">
              {(["auto", "wasm", "gpu"] as Runtime[]).map((r) => (
                <b
                  key={r}
                  className={settings.runtime === r ? "sel" : ""}
                  onClick={() => actions.setSettings({ runtime: r })}
                  role="button"
                  tabIndex={0}
                >
                  {r === "auto" ? "Auto" : r === "wasm" ? "WASM" : "GPU"}
                </b>
              ))}
            </span>
          </div>
          <div className="row">
            <span className="ic"><Ic n="ic-shield" size={22} alt="" /></span>
            <div className="tx">
              <b>Phoneme model</b>
              <span>on-device is private &amp; offline; server helps weak devices</span>
            </div>
            <span className="seg">
              <b className={settings.model === "device" ? "sel" : ""} onClick={() => actions.setSettings({ model: "device" })} role="button" tabIndex={0}>On device</b>
              <b className={settings.model === "server" ? "sel" : ""} onClick={() => actions.setSettings({ model: "server" })} role="button" tabIndex={0}>Server</b>
            </span>
          </div>
        </div>
      </div>

      {/* Feedback */}
      <div className="pagepad" style={{ marginTop: 18 }}>
        <div className="eyebrow" style={{ margin: "6px 4px 10px" }}>Feedback</div>
        <div className="card pad-lg">
          <div className="rowflex" style={{ justifyContent: "space-between" }}>
            <b style={{ fontSize: 15 }}>Slip sensitivity</b>
            <span className="data tiny" style={{ color: "var(--ink-soft)" }}>{sensLabel}</span>
          </div>
          <div
            className="slider"
            style={{ margin: "16px 4px 8px" }}
            onPointerDown={(e) => {
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              setSensFromEvent(e);
            }}
            onPointerMove={(e) => {
              if (e.buttons !== 0) setSensFromEvent(e);
            }}
            role="slider"
            aria-label="Slip sensitivity"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(settings.sensitivity * 100)}
          >
            <div className="fill" style={{ width: `${settings.sensitivity * 100}%` }} />
            <div className="knob" style={{ left: `${settings.sensitivity * 100}%` }} />
          </div>
          <div className="rowflex" style={{ justifyContent: "space-between" }}>
            <span className="tiny">Gentle — only clear slips</span>
            <span className="tiny">Strict — every wobble</span>
          </div>
        </div>
        <div className="card" style={{ marginTop: 12 }}>
          <div className="row">
            <span className="ic"><Ic n="ic-wave" size={22} alt="" /></span>
            <div className="tx">
              <b>Highlights shown</b>
              <span>never wall a struggling reader in colour</span>
            </div>
            <span className="seg">
              {(["top3", "top6", "all"] as HighlightCap[]).map((c) => (
                <b
                  key={c}
                  className={settings.highlights === c ? "sel" : ""}
                  onClick={() => actions.setSettings({ highlights: c })}
                  role="button"
                  tabIndex={0}
                >
                  {c === "top3" ? "Top 3" : c === "top6" ? "Top 6" : "All"}
                </b>
              ))}
            </span>
          </div>
          <div className="row">
            <span className="ic"><Ic n="ear" size={22} alt="" /></span>
            <div className="tx">
              <b>Listening-ear mascot</b>
              <span>off gives the calmer, grown-up register</span>
            </div>
            <button
              className={`tg${settings.mascot ? " on" : ""}`}
              onClick={() => actions.setSettings({ mascot: !settings.mascot })}
              aria-label="Toggle mascot"
              aria-pressed={settings.mascot}
            >
              <i />
            </button>
          </div>
        </div>
      </div>

      {/* Privacy & data */}
      <div className="pagepad" style={{ marginTop: 18 }}>
        <div className="eyebrow" style={{ margin: "6px 4px 10px" }}>Privacy &amp; data</div>
        <div className="card">
          <div className="row" onClick={() => actions.navigate("s7")} role="button" tabIndex={0} style={{ cursor: "pointer" }}>
            <span className="ic"><Ic n="ic-wifi-off" size={22} alt="" /></span>
            <div className="tx">
              <b>Network ledger</b>
              <span>live count of requests this session</span>
            </div>
            <span className="data" style={{ fontSize: 13, color: "var(--amber-deep)" }}>{networkCount} calls&nbsp;›</span>
          </div>
          <div className="row">
            <span className="ic"><Ic n="ic-trash" size={22} alt="" /></span>
            <div className="tx">
              <b>Clear all local data</b>
              <span>text, recordings &amp; slip maps on this device</span>
            </div>
            <button className="btn btn-soft" style={{ padding: "9px 16px", fontSize: 14 }} onClick={() => void actions.clearAll()}>
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Live diagnostics */}
      <div className="pagepad" style={{ marginTop: 18, paddingBottom: 30 }}>
        <div className="eyebrow" style={{ margin: "6px 4px 10px" }}>Live diagnostics</div>
        <div className="card pad-lg" style={{ background: "#21333C" }}>
          <Diag k="listening model" v={`${modelMB} MB`} u="· int8 onnx" />
          <Diag k="posterior frames" v="50 / s" u="· 20 ms hop" border />
          <Diag k="last analyse" v={lastLabel} border />
          <Diag k="verdict" v="GOP-CTC" u="· deterministic" border />
          <Diag k="network calls" v={`${networkCount}`} amber border />
        </div>
        <div className="tiny" style={{ textAlign: "center", marginTop: 14 }}>{THESIS}</div>
      </div>
    </>
  );
}

function Diag({ k, v, u, amber, border }: { k: string; v: string; u?: string; amber?: boolean; border?: boolean }) {
  return (
    <div className="kv" style={border ? { borderTop: "1px dashed #3a4d57" } : { paddingTop: 0, border: 0 }}>
      <span className="k" style={{ color: "#9DB2BB" }}>{k}</span>
      <span className="v" style={{ color: amber ? "#E8A33D" : "#EFE7D2" }}>
        {v} {u && <span style={{ color: "#7E96A0" }}>{u}</span>}
      </span>
    </div>
  );
}
