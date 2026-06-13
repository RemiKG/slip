"use client";
// The waveform: packed rounded bars (amber up to the slip onset), a translucent coral
// region for the slipped segment, and an amber playhead with a round glowing head.
// Backed by a real role="slider" so keyboard/AT users can seek every slip.
import { useEffect, useRef, useCallback } from "react";

const PAD = 16; // horizontal inset so bars/region/playhead line up with the card padding
const AMBER = "#E8A33D";
const BASE = "#CBB48B";

export function Waveform({
  peaks,
  durationSec,
  onsetSec = 0,
  region,
  playheadSec = 0,
  ticks,
  onSeek,
  height = 104,
}: {
  peaks: number[];
  durationSec: number;
  onsetSec?: number;
  region?: { start: number; end: number } | null;
  playheadSec?: number;
  ticks?: string[];
  onSeek?: (sec: number) => void;
  height?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const draw = useCallback(() => {
    const cv = canvasRef.current;
    const wrap = wrapRef.current;
    if (!cv || !wrap) return;
    const dpr = window.devicePixelRatio || 1;
    const W = wrap.clientWidth;
    const H = wrap.clientHeight;
    cv.width = Math.max(1, Math.floor(W * dpr));
    cv.height = Math.max(1, Math.floor(H * dpr));
    cv.style.width = W + "px";
    cv.style.height = H + "px";
    const g = cv.getContext("2d");
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);

    const innerW = W - PAD * 2;
    const N = peaks.length || 1;
    const gap = 2.4;
    const bw = Math.max(1.6, (innerW - (N - 1) * gap) / N);
    const mid = H / 2;
    const maxBar = H * 0.56;
    const dur = durationSec || 1;

    for (let i = 0; i < N; i++) {
      const x = PAD + i * (bw + gap);
      const tC = ((i + 0.5) / N) * dur;
      const h = Math.max(4, peaks[i] * maxBar);
      const r = Math.min(bw / 2, h / 2);
      g.fillStyle = tC < onsetSec ? AMBER : BASE;
      g.globalAlpha = tC < onsetSec ? 1 : 0.85;
      g.beginPath();
      roundRect(g, x, mid - h / 2, bw, h, r);
      g.fill();
    }
    g.globalAlpha = 1;

    if (region && region.end > region.start) {
      const rx = PAD + (region.start / dur) * innerW;
      const rw = ((region.end - region.start) / dur) * innerW;
      g.fillStyle = "rgba(217,96,62,.16)";
      roundRect(g, rx, 10, Math.max(4, rw), H - 20, 8);
      g.fill();
      g.strokeStyle = "rgba(217,96,62,.5)";
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(rx, 12); g.lineTo(rx, H - 12);
      g.moveTo(rx + rw, 12); g.lineTo(rx + rw, H - 12);
      g.stroke();
    }

    const px = PAD + (Math.min(playheadSec, dur) / dur) * innerW;
    g.save();
    g.shadowColor = "rgba(232,163,61,.34)";
    g.shadowBlur = 8;
    g.fillStyle = AMBER;
    g.fillRect(px - 1.25, 8, 2.5, H - 16);
    g.beginPath();
    g.arc(px, 8, 7, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }, [peaks, durationSec, onsetSec, region, playheadSec]);

  useEffect(() => {
    draw();
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [draw]);

  const seekFromX = useCallback(
    (clientX: number) => {
      const wrap = wrapRef.current;
      if (!wrap || !onSeek) return;
      const r = wrap.getBoundingClientRect();
      const frac = Math.max(0, Math.min(1, (clientX - r.left - PAD) / (r.width - PAD * 2)));
      onSeek(frac * (durationSec || 0));
    },
    [onSeek, durationSec]
  );

  const onPointerDown = (e: React.PointerEvent) => {
    if (!onSeek) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    seekFromX(e.clientX);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!onSeek || e.buttons === 0) return;
    seekFromX(e.clientX);
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!onSeek) return;
    const step = 0.02; // one ~20ms frame — the honest grid
    if (e.key === "ArrowRight") onSeek(Math.min(durationSec, playheadSec + step));
    else if (e.key === "ArrowLeft") onSeek(Math.max(0, playheadSec - step));
    else if (e.key === "Home") onSeek(0);
    else if (e.key === "End") onSeek(durationSec);
    else return;
    e.preventDefault();
  };

  return (
    <div
      ref={wrapRef}
      className="wave"
      style={{ height }}
      role={onSeek ? "slider" : undefined}
      tabIndex={onSeek ? 0 : undefined}
      aria-label={onSeek ? "Playback position" : undefined}
      aria-valuemin={onSeek ? 0 : undefined}
      aria-valuemax={onSeek ? Math.round(durationSec * 1000) : undefined}
      aria-valuenow={onSeek ? Math.round(playheadSec * 1000) : undefined}
      aria-valuetext={onSeek ? `${playheadSec.toFixed(2)} seconds` : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onKeyDown={onKeyDown}
    >
      <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, zIndex: 2 }} />
      {ticks && ticks.length > 0 && (
        <div className="tline">
          {ticks.map((t, i) => (
            <span key={i}>{t}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + rr, y);
  g.arcTo(x + w, y, x + w, y + h, rr);
  g.arcTo(x + w, y + h, x, y + h, rr);
  g.arcTo(x, y + h, x, y, rr);
  g.arcTo(x, y, x + w, y, rr);
  g.closePath();
}
