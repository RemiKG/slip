"use client";
import { actions, Ic, Ledger, Mascot, TopBar } from "@/components/ui";

// S0 · Home — the warm front door.
export default function Home() {
  return (
    <>
      <TopBar
        right={
          <button className="iconbtn" onClick={() => actions.navigate("s8")} aria-label="Settings">
            <Ic n="ic-gear" alt="settings" />
          </button>
        }
      />

      <div className="grow center" style={{ justifyContent: "center", gap: 4, padding: "0 30px" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/art/wordmark.png" style={{ width: 212, height: "auto", marginBottom: 14 }} alt="slip" />
        <div className="h1" style={{ fontSize: 35 }}>
          Catch the slip.
        </div>
        <p className="lead" style={{ textAlign: "center", maxWidth: 332, marginTop: 10 }}>
          Read anything aloud. Slip points at the exact <b className="inkword">sound</b> you slipped on,
          then replays it in your own voice — right in your browser.
        </p>
        <div className="earmount" style={{ marginTop: 30, maxWidth: 340 }}>
          <Mascot say="“Read aloud — I’m listening for the slips.”" />
        </div>
      </div>

      <div className="pagepad col gap12">
        <button className="btn btn-amber btn-block btn-lg" onClick={() => actions.navigate("s1")}>
          Read something&nbsp;&nbsp;<span style={{ font: "600 21px var(--ui)" }}>→</span>
        </button>
        <button
          className="btn btn-ghost btn-block"
          onClick={() => actions.navigate("s1")}
        >
          <Ic n="ic-sparkle" size={17} style={{ opacity: 0.7 }} alt="" />
          &nbsp;&nbsp;or try a demo line
        </button>
      </div>

      <div className="center" style={{ padding: "18px 0 24px" }}>
        <Ledger prefix="Runs on your device" />
        <div className="tiny" style={{ marginTop: 11, letterSpacing: ".2px" }}>
          100% in your browser · 0% uploaded · works in airplane mode
        </div>
      </div>
    </>
  );
}
