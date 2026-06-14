"use client";
import { useEffect, useRef, useState } from "react";
import { actions, Ic, TopBar } from "@/components/ui";
import { useStore } from "@/lib/store";
import { Passage } from "@/components/Passage";
import { SAMPLE_ANALYSIS } from "@/lib/sampleAnalysis";
import type { Severity } from "@/lib/types";

function sevRank(s: Severity): number {
  return s === "s3" ? 3 : s === "s2" ? 2 : s === "s1" ? 1 : 0;
}

// S6 · Share card — one image a tutor can read at a glance, built entirely on-device.
export default function ShareCard() {
  const store = useStore();
  const analysis = store.analysis ?? SAMPLE_ANALYSIS;
  const cardRef = useRef<HTMLDivElement>(null);
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setDate(new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }));
  }, []);

  const counts = new Map<string, number>();
  for (const h of analysis.highlights) counts.set(h.expectedIpa, (counts.get(h.expectedIpa) ?? 0) + 1);
  const topIpa = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  const worst = [...analysis.highlights].sort(
    (a, b) => sevRank(b.severity) - sevRank(a.severity) || a.gop - b.gop
  )[0];
  const grapheme = (ipa: string) => {
    const h = analysis.highlights.find((x) => x.expectedIpa === ipa);
    return h ? analysis.passage.slice(h.start, h.end) : "";
  };
  const prev = store.prevSlipCount;
  const current = analysis.highlights.length;

  const doExport = async (mode: "save" | "share") => {
    if (!cardRef.current || busy) return;
    setBusy(true);
    try {
      const sc = await import("@/lib/sharecard");
      const blob = await sc.renderCardToBlob(cardRef.current);
      if (mode === "save") {
        sc.downloadBlob(blob);
        actions.toast("Saved as image — nothing uploaded.");
      } else {
        const r = await sc.shareCard(blob);
        actions.toast(r === "shared" ? "Shared — nothing uploaded by Slip." : "Saved as image.");
      }
    } catch {
      actions.toast("Couldn’t build the card — try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <TopBar
        title="Share card"
        onBack={() => actions.back()}
        right={
          <button className="iconbtn" onClick={() => actions.back()} aria-label="Close">
            <Ic n="ic-close" alt="close" />
          </button>
        }
      />

      <div className="pagepad">
        <p className="lead" style={{ margin: "2px 4px 12px" }}>
          One image a tutor can read at a glance — built on your device.
        </p>
      </div>

      <div className="pagepad">
        <div ref={cardRef} className="card pad-lg" style={{ border: "1px solid var(--line)", boxShadow: "var(--shadow)" }}>
          <div className="rowflex" style={{ justifyContent: "space-between", alignItems: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/art/wordmark.png" style={{ height: 22, width: "auto" }} alt="slip" />
            <span className="data tiny" style={{ color: "var(--ink-mute)" }}>
              reading report · {date}
            </span>
          </div>
          <div className="divider" style={{ margin: "14px 0" }} />

          <Passage
            passage={analysis.passage}
            highlights={analysis.highlights}
            cap={Infinity}
            interactive={false}
            className="sm"
            style={{ fontSize: 18, lineHeight: 1.6 }}
          />

          <div className="well pad" style={{ marginTop: 16 }}>
            <div className="kv" style={{ paddingTop: 0 }}>
              <span className="k">slipped sound</span>
              <span className="v">
                {topIpa ? (
                  <>
                    <span className="ipa">/{topIpa[0]}/</span> — “{grapheme(topIpa[0])}” ·{" "}
                    <span className="u">×{topIpa[1]} this read</span>
                  </>
                ) : (
                  <span className="u">none — clean read</span>
                )}
              </span>
            </div>
            <div className="kv">
              <span className="k">longest slip</span>
              <span className="v">
                {worst ? (
                  <>
                    <span className="ipa">/{worst.expectedIpa}/</span> in “{worst.word}” ·{" "}
                    <span className="u">{(worst.startMs / 1000).toFixed(2)} s</span>
                  </>
                ) : (
                  <span className="u">—</span>
                )}
              </span>
            </div>
            <div className="kv">
              <span className="k">read again</span>
              <span className="v">
                {prev !== null && prev !== undefined ? `${prev} → ${current} slips` : `${current} slip${current === 1 ? "" : "s"}`}
              </span>
            </div>
            <div className="kv">
              <span className="k">target sound</span>
              <span className="v">
                {topIpa ? (
                  <>
                    <span className="ipa">/{topIpa[0]}/</span> — “{grapheme(topIpa[0])}”
                  </>
                ) : (
                  <span className="u">—</span>
                )}
              </span>
            </div>
          </div>

          <div className="rowflex gap8" style={{ marginTop: 14, color: "var(--ink-mute)" }}>
            <Ic n="ic-shield" size={14} style={{ opacity: 0.6 }} alt="" />
            <span className="tiny">made on-device · no account · 0 KB uploaded</span>
          </div>
        </div>
      </div>

      <div className="grow" />

      <div className="pagepad col gap12" style={{ paddingBottom: 14 }}>
        <button className="btn btn-amber btn-block btn-lg" disabled={busy} onClick={() => doExport("save")}>
          <Ic n="ic-download" size={20} alt="" />
          &nbsp;&nbsp;{busy ? "Building…" : "Save as image"}
        </button>
        <button className="btn btn-soft btn-block" disabled={busy} onClick={() => doExport("share")}>
          <Ic n="ic-share" size={19} alt="" />
          &nbsp;&nbsp;Share…
        </button>
      </div>

      <div className="center" style={{ paddingBottom: 24 }}>
        <div className="tiny" style={{ textAlign: "center", maxWidth: 320 }}>
          The card is a picture, not a login. Nothing is uploaded — you choose where it goes.
        </div>
      </div>
    </>
  );
}
