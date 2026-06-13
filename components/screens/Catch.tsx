"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { actions, Ic, TopBar } from "@/components/ui";
import { useStore } from "@/lib/store";
import { Passage } from "@/components/Passage";
import { Waveform } from "@/components/Waveform";
import { SAMPLE_ANALYSIS, samplePeaks } from "@/lib/sampleAnalysis";
import { highlightCapCount, THESIS } from "@/lib/constants";
import { getPeaks, hasRecording, replaySegment, stopReplay } from "@/lib/audio";
import type { Highlight, Severity } from "@/lib/types";

function sevRank(s: Severity): number {
  return s === "s3" ? 3 : s === "s2" ? 2 : s === "s1" ? 1 : 0;
}

// S4 · Catch the slip ⭐ — the money shot. No mascot ever on this surface.
export default function Catch() {
  const store = useStore();
  const analysis = store.analysis ?? SAMPLE_ANALYSIS;
  const cap = highlightCapCount(store.settings.highlights);

  const visible = [...analysis.highlights]
    .sort((a, b) => sevRank(b.severity) - sevRank(a.severity) || a.gop - b.gop)
    .slice(0, isFinite(cap) ? cap : analysis.highlights.length);

  const selected: Highlight | undefined =
    visible.find((h) => h.id === store.selectedSlipId) ?? visible[0];

  const cardRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{ left: number; top: number; tailLeft: number } | null>(null);
  const [head, setHead] = useState((selected?.startMs ?? 0) / 1000);

  const peaks = hasRecording() ? getPeaks() : samplePeaks();
  const dur = analysis.durationSec || 3.1;
  const region = selected ? { start: selected.startMs / 1000, end: selected.endMs / 1000 } : null;
  const ticks: string[] = [];
  for (let s = 0; s <= Math.min(6, Math.ceil(dur)); s++) ticks.push(`0:0${s}`);

  // anchor the verdict tooltip above the selected slip
  useLayoutEffect(() => {
    const card = cardRef.current;
    const tipEl = tipRef.current;
    if (!card || !tipEl || !selected) {
      setTip(null);
      return;
    }
    const slip = card.querySelector<HTMLElement>(".slip.sel");
    if (!slip) return;
    const cr = card.getBoundingClientRect();
    const sr = slip.getBoundingClientRect();
    const tw = tipEl.offsetWidth || 180;
    const th = tipEl.offsetHeight || 60;
    const slipCenter = sr.left - cr.left + sr.width / 2;
    let left = slipCenter - 32; // CSS tail sits ~32px from the tip's left edge
    left = Math.max(12, Math.min(left, cr.width - tw - 12));
    // pin it in the card's top padding (like the mockup) so it never covers passage text
    const top = 12;
    void th;
    setTip({ left, top, tailLeft: Math.max(14, Math.min(slipCenter - left, tw - 22)) });
  }, [selected, store.selectedSlipId, analysis, store.settings.highlights]);

  useEffect(() => {
    setHead((selected?.startMs ?? 0) / 1000);
    return () => stopReplay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.selectedSlipId]);

  const replay = () => {
    if (!selected) return;
    if (hasRecording()) replaySegment(selected.startMs / 1000, selected.endMs / 1000, setHead);
    else setHead(selected.startMs / 1000);
  };

  const onSelect = (id: string) => {
    actions.selectSlip(id);
    const h = visible.find((x) => x.id === id);
    if (h && hasRecording()) replaySegment(h.startMs / 1000, h.endMs / 1000, setHead);
  };

  const hasSlips = analysis.highlights.length > 0;
  const clean = !hasSlips && !analysis.flagged; // a genuine clean read (vs. a G2P failure)

  return (
    <>
      <TopBar
        title="Catch the slip"
        onBack={() => actions.back()}
        right={
          clean ? (
            <span className="pill pill-good">clean read</span>
          ) : hasSlips ? (
            <span className="pill pill-amber">
              {visible.length} sound{visible.length === 1 ? "" : "s"} to catch
            </span>
          ) : undefined
        }
      />

      <div className="pagepad" style={{ marginTop: 4 }}>
        <div
          ref={cardRef}
          className="card"
          style={{ position: "relative", padding: hasSlips ? "74px 20px 22px" : "22px 20px" }}
        >
          {hasSlips && selected && (
            // always rendered (so it can be measured); hidden until positioned
            <div
              ref={tipRef}
              className="tip"
              style={{ left: tip?.left ?? 12, top: tip?.top ?? 8, visibility: tip ? "visible" : "hidden" }}
            >
              <div className="row1">
                <span style={{ color: "#AFC2C9", fontWeight: 600 }}>expected</span>{" "}
                <span className="ipa exp">/{selected.expectedIpa}/</span>
                {selected.isSub ? (
                  <>
                    <span className="arrow">→</span>
                    <span style={{ color: "#AFC2C9", fontWeight: 600 }}>heard</span>{" "}
                    <span className="ipa got">/{selected.heardIpa}/</span>
                  </>
                ) : (
                  <span style={{ color: "#AFC2C9", fontWeight: 600 }}>· came out unclear</span>
                )}
              </div>
              <div className="meta">
                {(selected.startMs / 1000).toFixed(2)} s · in “{selected.word}”
                {selected.lowConfidence ? " · faint" : ""}
              </div>
            </div>
          )}

          <Passage
            passage={analysis.passage}
            highlights={analysis.highlights}
            selectedId={selected?.id}
            onSelect={onSelect}
            cap={cap}
          />

          {hasSlips ? (
            <div className="rowflex" style={{ marginTop: 18, gap: 8, color: "var(--ink-mute)" }}>
              <Ic n="ic-info" size={16} style={{ opacity: 0.6 }} alt="" />
              <span className="tiny">Tap any highlighted sound to scrub to it and hear yourself.</span>
            </div>
          ) : analysis.flagged ? (
            <div className="rowflex" style={{ marginTop: 14, gap: 8, color: "var(--ink-mute)" }}>
              <Ic n="ic-info" size={16} style={{ opacity: 0.6 }} alt="" />
              <span className="tiny">{analysis.flagged}</span>
            </div>
          ) : (
            <div className="rowflex" style={{ marginTop: 14, gap: 8, color: "var(--good-ink)" }}>
              <Ic n="ic-check" size={16} alt="" />
              <span className="tiny" style={{ color: "var(--good-ink)" }}>
                No slips caught — a clean read. Nicely done.
              </span>
            </div>
          )}
        </div>
      </div>

      {hasSlips && (
        <div className="pagepad" style={{ marginTop: 16 }}>
          <Waveform
            peaks={peaks}
            durationSec={dur}
            onsetSec={selected ? selected.startMs / 1000 : 0}
            region={region}
            playheadSec={head}
            ticks={ticks}
            height={110}
            onSeek={setHead}
          />
          <div className="center" style={{ marginTop: 14 }}>
            <button className="chip" style={{ gap: 9 }} onClick={replay}>
              <Ic n="ic-play" size={15} alt="" />
              Replay this slip&nbsp;
              {selected && (
                <span className="data" style={{ color: "var(--ink-mute)" }}>
                  {(selected.startMs / 1000).toFixed(2)}–{(selected.endMs / 1000).toFixed(2)} s
                </span>
              )}
            </button>
            <div className="data tiny" style={{ marginTop: 12, color: "var(--ink-mute)", letterSpacing: ".2px" }}>
              {THESIS}
            </div>
          </div>
        </div>
      )}

      <div className="grow" />

      <div className="pagepad col gap12" style={{ paddingBottom: 26 }}>
        <button
          className="btn btn-amber btn-block btn-lg"
          onClick={async () => {
            stopReplay();
            (await import("@/lib/flow")).readAgain();
          }}
        >
          Read it again&nbsp;&nbsp;<span style={{ font: "600 18px var(--ui)" }}>↻</span>
        </button>
        <button
          className="btn btn-soft btn-block"
          onClick={() => {
            stopReplay();
            actions.navigate("s5");
          }}
        >
          <Ic n="ic-wave" size={20} alt="" />
          &nbsp;&nbsp;See your slip map
        </button>
      </div>
    </>
  );
}
