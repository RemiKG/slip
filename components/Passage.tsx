"use client";
// Renders the passage in Lexend with each slipped SOUND highlighted in place on the
// severity ramp — anchored to the spelling (the "th" in thorough), never the IPA.
// Honours the highlight cap (Top 3 / Top 6 / All) by severity priority.
import type { Highlight, Severity } from "@/lib/types";

function sevRank(s: Severity): number {
  return s === "s3" ? 3 : s === "s2" ? 2 : s === "s1" ? 1 : 0;
}
function sevClass(s: Severity): string {
  return s === "good" ? "good" : s;
}

export function Passage({
  passage,
  highlights,
  selectedId,
  onSelect,
  cap = Infinity,
  className = "",
  style,
  interactive = true,
}: {
  passage: string;
  highlights: Highlight[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  cap?: number;
  className?: string;
  style?: React.CSSProperties;
  interactive?: boolean;
}) {
  // which highlights are visible under the cap (by severity, then worst GOP)
  const kept = [...highlights]
    .sort((a, b) => sevRank(b.severity) - sevRank(a.severity) || a.gop - b.gop)
    .slice(0, isFinite(cap) ? cap : highlights.length);
  const keptIds = new Set(kept.map((h) => h.id));
  const visible = highlights.filter((h) => keptIds.has(h.id));

  // tokenise into words + whitespace, keeping char offsets
  const tokens: { text: string; start: number }[] = [];
  const re = /(\s+|\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(passage))) tokens.push({ text: m[0], start: m.index });

  return (
    <div className={`passage ${className}`} style={style}>
      {tokens.map((tok, ti) => {
        if (/^\s+$/.test(tok.text)) return <span key={ti}>{tok.text}</span>;
        const wStart = tok.start;
        const wEnd = tok.start + tok.text.length;
        const inWord = visible
          .filter((h) => h.end > wStart && h.start < wEnd)
          .sort((a, b) => a.start - b.start);
        if (inWord.length === 0) return <span key={ti}>{tok.text}</span>;
        const parts: React.ReactNode[] = [];
        let pos = wStart;
        inWord.forEach((h) => {
          const hs = Math.max(h.start, wStart);
          const he = Math.min(h.end, wEnd);
          if (hs > pos) parts.push(<span key={`p${pos}`}>{passage.slice(pos, hs)}</span>);
          const sel = selectedId === h.id;
          parts.push(
            <span
              key={h.id}
              data-slip-id={h.id}
              className={`slip ${sevClass(h.severity)}${sel ? " sel" : ""}`}
              onClick={interactive && onSelect ? () => onSelect(h.id) : undefined}
              onKeyDown={
                interactive && onSelect
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelect(h.id);
                      }
                    }
                  : undefined
              }
              role={interactive && onSelect ? "button" : undefined}
              tabIndex={interactive && onSelect ? 0 : undefined}
              aria-label={
                interactive
                  ? `Slipped sound, expected ${h.expectedIpa}, heard ${h.heardIpa}. Tap to hear it.`
                  : undefined
              }
            >
              {passage.slice(hs, he)}
            </span>
          );
          pos = he;
        });
        if (pos < wEnd) parts.push(<span key={`t${pos}`}>{passage.slice(pos, wEnd)}</span>);
        return (
          <span key={ti} className="w">
            {parts}
          </span>
        );
      })}
    </div>
  );
}
