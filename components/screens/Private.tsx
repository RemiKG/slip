"use client";
import { actions, Ic, TopBar } from "@/components/ui";
import { useStore } from "@/lib/store";
import { MODEL_SIZE_MB, DTYPE_DEFAULT } from "@/lib/constants";
import { promptInstall, isIOS, isStandalone } from "@/lib/sw-register";

// S7 · Private by design — make the privacy claim provable, not promised.
export default function Private() {
  const { networkCount, bytesSent, installAvailable, modelProgress } = useStore();
  const kb = Math.round(bytesSent / 1024);
  const modelMB = modelProgress?.totalBytes ? Math.round(modelProgress.totalBytes / 1e6) : MODEL_SIZE_MB[DTYPE_DEFAULT];

  const install = async () => {
    const outcome = await promptInstall();
    if (outcome === "accepted") actions.toast("Installing Slip…");
    else if (outcome === "unavailable") {
      if (isStandalone()) actions.toast("Slip is already installed.");
      else if (isIOS()) actions.toast("Tap the Share button, then “Add to Home Screen”.");
      else actions.toast("Use your browser’s menu → “Install Slip”.");
    }
  };

  return (
    <>
      <TopBar
        title="Private by design"
        onBack={() => actions.back()}
        right={
          <button className="iconbtn" aria-label="Privacy">
            <Ic n="ic-shield" alt="" />
          </button>
        }
      />

      <div className="pagepad" style={{ marginTop: 4 }}>
        <div className="card pad-lg" style={{ background: "linear-gradient(180deg,#F2F7EC,#FFFCF6)" }}>
          <div className="rowflex gap10">
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#6FA463", boxShadow: "0 0 0 4px rgba(111,164,99,.2)" }} />
            <span className="pill pill-good">Local only</span>
          </div>
          <div className="rowflex" style={{ alignItems: "baseline", gap: 10, marginTop: 14 }}>
            <span className="data" style={{ fontSize: 42, color: "var(--ink)" }}>{networkCount}</span>
            <span className="lead" style={{ fontWeight: 600, color: "var(--ink-soft)" }}>
              network calls<br />this session
            </span>
            <span className="spacer" />
            <span className="center">
              <span className="data" style={{ fontSize: 28, color: "var(--ink)" }}>
                {kb}
                <span className="u" style={{ fontSize: 15 }}> KB</span>
              </span>
              <span className="tiny">sent</span>
            </span>
          </div>
          <div className="tiny" style={{ marginTop: 12 }}>
            Counts every real network request — not a label. Open DevTools › Network and watch it
            stay at zero while you read and analyse.
          </div>
        </div>
      </div>

      <div className="pagepad" style={{ marginTop: 16 }}>
        <div className="card pad-lg">
          <div className="eyebrow" style={{ marginBottom: 16 }}>where your voice goes</div>
          <div className="rowflex" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
            <div className="center" style={{ width: 88 }}>
              <span style={{ width: 48, height: 48, borderRadius: 14, background: "var(--well)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Ic n="ic-mic" size={26} alt="" />
              </span>
              <span className="tiny" style={{ marginTop: 8, textAlign: "center", lineHeight: 1.3 }}>your voice</span>
            </div>
            <span className="data" style={{ color: "var(--amber-deep)", fontSize: 20, alignSelf: "center", paddingTop: 8 }}>→</span>
            <div className="center" style={{ width: 96 }}>
              <span style={{ width: 48, height: 48, borderRadius: 14, background: "var(--amber-tint)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Ic n="ic-chip" size={26} alt="" />
              </span>
              <span className="tiny" style={{ marginTop: 8, textAlign: "center", lineHeight: 1.3 }}>model + math,<br />on this device</span>
            </div>
            <span className="data" style={{ color: "var(--amber-deep)", fontSize: 20, alignSelf: "center", paddingTop: 8 }}>→</span>
            <div className="center" style={{ width: 88 }}>
              <span style={{ width: 48, height: 48, borderRadius: 14, background: "var(--well)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Ic n="ic-wave" size={26} alt="" />
              </span>
              <span className="tiny" style={{ marginTop: 8, textAlign: "center", lineHeight: 1.3 }}>the slip,<br />on your screen</span>
            </div>
          </div>
          <div className="divider" style={{ margin: "18px 0 14px" }} />
          <div className="rowflex gap10" style={{ color: "var(--ink-soft)" }}>
            <Ic n="ic-wifi-off" size={18} alt="" />
            <span style={{ fontWeight: 600, fontSize: 14 }}>No server. No cloud. The audio never makes the trip.</span>
          </div>
        </div>
      </div>

      <div className="pagepad" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="row">
            <span className="ic"><Ic n="ic-check" size={22} alt="" /></span>
            <div className="tx">
              <b>Listening model — cached, offline-ready</b>
              <span>downloaded once, then it never phones home</span>
            </div>
            <span className="data" style={{ fontSize: 13, color: "var(--ink-soft)" }}>{modelMB}&nbsp;MB</span>
          </div>
          <div className="row">
            <span className="ic"><Ic n="ic-wifi-off" size={22} alt="" /></span>
            <div className="tx">
              <b>Works in airplane mode</b>
              <span>turn off wi-fi and read again — it still catches slips</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grow" />

      <div className="pagepad" style={{ paddingBottom: 26 }}>
        <button className="btn btn-amber btn-block btn-lg" onClick={install} disabled={!installAvailable && isStandalone()}>
          <Ic n="ic-download" size={20} alt="" />
          &nbsp;&nbsp;Add Slip to your home screen
        </button>
      </div>
    </>
  );
}
