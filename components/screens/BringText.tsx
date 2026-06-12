"use client";
import { useEffect } from "react";
import { actions, Ic, Ledger, TopBar } from "@/components/ui";
import { useStore } from "@/lib/store";
import { DEMO_LINES, SAMPLE_PASTE } from "@/lib/constants";

// S1 · Bring your text — prove the text is arbitrary and real (Paste / Type / Photograph),
// with the demo line clearly cordoned.
export default function BringText() {
  const { passage, intakeTab } = useStore();

  // The well shows starter text the user can replace (editable, never a fixed corpus).
  useEffect(() => {
    if (passage.trim() === "") actions.setPassage(SAMPLE_PASTE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const words = passage.trim() ? passage.trim().split(/\s+/).length : 0;
  const caption =
    intakeTab === "type"
      ? "TYPE WHAT YOU WANT TO READ ALOUD"
      : "PASTE ANYTHING YOU WANT TO READ ALOUD";

  const useText = async () => {
    if (!passage.trim()) return;
    const flow = await import("@/lib/flow");
    flow.goRead();
  };

  const playDemo = async (id: string) => {
    const line = DEMO_LINES.find((d) => d.id === id);
    if (!line) return;
    const flow = await import("@/lib/flow");
    flow.runDemo(line, 0);
  };

  return (
    <>
      <TopBar
        title="Bring your text"
        onBack={() => actions.back()}
        right={<Ledger suffix="sent" />}
      />

      <div className="pagepad" style={{ paddingTop: 8 }}>
        <div className="tabs">
          <button
            className={`tab${intakeTab === "paste" ? " sel" : ""}`}
            onClick={() => actions.setIntakeTab("paste")}
          >
            <Ic n="ic-paste" size={26} alt="" />
            <span className="tlab">Paste</span>
          </button>
          <button
            className={`tab${intakeTab === "type" ? " sel" : ""}`}
            onClick={() => actions.setIntakeTab("type")}
          >
            <Ic n="ic-keyboard" size={26} alt="" />
            <span className="tlab">Type</span>
          </button>
          <button
            className={`tab${intakeTab === "photo" ? " sel" : ""}`}
            onClick={() => {
              actions.setIntakeTab("photo");
              actions.navigate("s2");
            }}
          >
            <Ic n="ic-camera" size={26} alt="" />
            <span className="tlab">Photograph</span>
          </button>
        </div>
      </div>

      <div className="pagepad" style={{ marginTop: 16 }}>
        <div className="well pad-lg" style={{ minHeight: 248, position: "relative" }}>
          <div className="tiny" style={{ marginBottom: 10, letterSpacing: ".3px" }}>
            {caption}
          </div>
          <textarea
            className="passage-input passage sm"
            style={{ fontSize: 20, lineHeight: 1.6, minHeight: 150 }}
            value={passage}
            onChange={(e) => actions.setPassage(e.target.value)}
            placeholder="Paste a recipe, a tweet, anything…"
            aria-label="The passage to read aloud"
          />
          <div style={{ position: "absolute", right: 16, bottom: 14 }} className="data tiny">
            <span style={{ fontFamily: "var(--mono)", color: "var(--ink-mute)" }}>
              {words} words · {words ? "ready" : "—"}
            </span>
          </div>
        </div>
      </div>

      <div className="pagepad" style={{ marginTop: 16 }}>
        <button className="btn btn-amber btn-block btn-lg" disabled={!words} onClick={useText}>
          Use this text&nbsp;&nbsp;<span style={{ font: "600 21px var(--ui)" }}>→</span>
        </button>
      </div>

      <div className="grow" />

      <div className="pagepad" style={{ paddingBottom: 26 }}>
        <div className="demo pad-lg">
          <div className="rowflex" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <span className="dtag">
              <Ic n="ic-sparkle" size={15} alt="" />
              Demo — or paste your own ↑
            </span>
          </div>
          <div className="col gap10" style={{ marginTop: 14 }}>
            {DEMO_LINES.map((d) => (
              <div
                key={d.id}
                className="card flat rowflex"
                style={{ padding: "13px 14px", gap: 12, alignItems: "center" }}
              >
                <button
                  className="iconbtn"
                  style={{ width: 38, height: 38, flex: "0 0 38px", background: "var(--amber-tint)" }}
                  onClick={() => playDemo(d.id)}
                  aria-label={`Hear a sample slip for: ${d.text}`}
                >
                  <Ic n="ic-play" size={18} alt="play" />
                </button>
                <div className="tx grow">
                  <div style={{ fontFamily: "var(--read)", fontSize: 15, color: "var(--ink)" }}>
                    “{d.text}”
                  </div>
                  <div className="tiny" style={{ marginTop: 2 }}>
                    {d.caption} · {d.ipaCaption}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="tiny" style={{ marginTop: 12 }}>
            Hear a sample slip — no microphone needed.
          </div>
        </div>
      </div>
    </>
  );
}
