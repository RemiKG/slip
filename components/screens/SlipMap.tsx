"use client";
import { actions, Ic, Mascot, TopBar } from "@/components/ui";
import { useStore } from "@/lib/store";
import { SAMPLE_ANALYSIS } from "@/lib/sampleAnalysis";
import type { Severity } from "@/lib/types";

function sevRank(s: Severity): number {
  return s === "s3" ? 3 : s === "s2" ? 2 : s === "s1" ? 1 : 0;
}
function sevVar(s: Severity): string {
  return s === "s3" ? "var(--sev3)" : s === "s2" ? "var(--sev2)" : s === "good" ? "var(--good)" : "var(--sev1)";
}

// S5 · Your slip map — the per-session tally and the celebrated read-again win.
export default function SlipMap() {
  const store = useStore();
  const analysis = store.analysis ?? SAMPLE_ANALYSIS;

  const map = new Map<string, { count: number; sev: Severity; word: string }>();
  for (const h of analysis.highlights) {
    const e = map.get(h.expectedIpa) ?? { count: 0, sev: "s1" as Severity, word: h.word };
    e.count++;
    if (sevRank(h.severity) > sevRank(e.sev)) e.sev = h.severity;
    map.set(h.expectedIpa, e);
  }
  const rows = [...map.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 5);
  const maxCount = rows[0]?.[1].count ?? 1;
  const top = rows[0];

  const current = analysis.highlights.length;
  const prev = store.prevSlipCount;
  const hasWin = prev !== null && prev !== undefined;
  const caught = hasWin ? Math.max(0, (prev as number) - current) : 0;

  return (
    <>
      <TopBar
        title="Your slip map"
        onBack={() => actions.back()}
        right={
          <button className="iconbtn" onClick={() => actions.navigate("s6")} aria-label="Share">
            <Ic n="ic-share" alt="share" />
          </button>
        }
      />

      <div className="pagepad">
        <p className="lead" style={{ margin: "2px 4px 14px" }}>
          The sounds you slip most across your reads — drill these.
        </p>
        <div className="card pad-lg">
          {rows.length === 0 ? (
            <div className="center" style={{ padding: "8px 0", gap: 6 }}>
              <Ic n="ic-check" size={26} alt="" />
              <div className="tiny" style={{ color: "var(--good-ink)" }}>
                A clean read — no sounds to drill this time.
              </div>
            </div>
          ) : (
            rows.map(([ipa, info]) => (
              <div className="smrow" key={ipa}>
                <span className="ph ipa">/{ipa}/</span>
                <span className="track">
                  <i style={{ width: `${Math.round((info.count / maxCount) * 100)}%`, background: sevVar(info.sev) }} />
                </span>
                <span className="ct">×{info.count}</span>
              </div>
            ))
          )}
          {top && (
            <>
              <div className="divider" style={{ margin: "8px 0 0" }} />
              <div className="rowflex" style={{ justifyContent: "space-between", marginTop: 12 }}>
                <span className="tiny">most-slipped sound</span>
                <span className="data" style={{ fontSize: 13.5 }}>
                  <span className="ipa">/{top[0]}/</span> — “th” as in{" "}
                  <span style={{ fontFamily: "var(--read)" }}>{top[1].word}</span>
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {hasWin && (
        <div className="pagepad" style={{ marginTop: 16 }}>
          <div className="card pad-lg" style={{ background: "linear-gradient(180deg,#FFF7E8,#FFFCF6)" }}>
            <div className="rowflex gap14">
              {store.settings.mascot ? (
                <Ic n="ear-happy" size={56} alt="" />
              ) : (
                <Ic n="ic-sparkle" size={40} alt="" />
              )}
              <div className="grow">
                <div className="h2" style={{ fontSize: 19 }}>
                  {caught > 0 ? "You’re catching them." : "Holding steady — keep going."}
                </div>
                <div className="tiny" style={{ marginTop: 3 }}>
                  Second read of the same passage:
                </div>
              </div>
            </div>
            <div className="rowflex" style={{ justifyContent: "center", gap: 18, marginTop: 16 }}>
              <div className="center">
                <div className="data" style={{ fontSize: 30, color: "var(--ink-mute)" }}>{prev}</div>
                <div className="tiny">first read</div>
              </div>
              <div className="data" style={{ fontSize: 24, color: "var(--amber-deep)", alignSelf: "center" }}>→</div>
              <div className="center">
                <div className="data" style={{ fontSize: 30, color: "var(--good-ink)" }}>{current}</div>
                <div className="tiny">just now</div>
              </div>
              {caught > 0 && (
                <span className="pill pill-good" style={{ alignSelf: "center", marginLeft: 6 }}>
                  −{caught} caught
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {!hasWin && rows.length > 0 && (
        <div className="pagepad" style={{ marginTop: 16 }}>
          <div className="card flat pad-lg center" style={{ gap: 8, textAlign: "center" }}>
            <Mascot variant="neutral" size={44} />
            <div className="tiny" style={{ maxWidth: 280 }}>
              Read the same passage again and watch these highlights shrink — that’s the win.
            </div>
          </div>
        </div>
      )}

      <div className="grow" />

      <div className="pagepad col gap12" style={{ paddingBottom: 26 }}>
        <button
          className="btn btn-amber btn-block btn-lg"
          onClick={async () => (await import("@/lib/flow")).readAgain()}
        >
          Read it again&nbsp;&nbsp;<span style={{ font: "600 18px var(--ui)" }}>↻</span>
        </button>
        <button className="btn btn-soft btn-block" onClick={() => actions.navigate("s6")}>
          <Ic n="ic-share" size={19} alt="" />
          &nbsp;&nbsp;Share with a tutor
        </button>
      </div>
    </>
  );
}
