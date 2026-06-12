"use client";
import { useEffect, useState } from "react";
import { actions, useStore } from "@/lib/store";

// ---- icon (hand-built art set; PNGs rendered at 2x in the design package) ----
export function Ic({
  n,
  size = 24,
  alt = "",
  style,
}: {
  n: string;
  size?: number;
  alt?: string;
  style?: React.CSSProperties;
}) {
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={`/art/${n}.png`}
      width={size}
      height={size}
      alt={alt}
      style={{ width: size, height: size, display: "block", ...style }}
    />
  );
}

// ---- the phone status bar (cosmetic chrome; shows live time after mount) ----
function StatusBar() {
  const [time, setTime] = useState("9:41");
  useEffect(() => {
    const update = () => {
      const d = new Date();
      let h = d.getHours();
      const m = d.getMinutes();
      const ap = h >= 12;
      h = h % 12 || 12;
      setTime(`${h}:${m.toString().padStart(2, "0")}`);
    };
    update();
    const id = setInterval(update, 15000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="statusbar">
      <span className="t">{time}</span>
      <span className="sig">
        <i />
        <i />
        <i />
        <span className="bat" />
      </span>
    </div>
  );
}

// ---- the persistent phone shell: blobs, status bar, grain ----
export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="screen">
      <div className="blobs" />
      <div className="wrap">
        <StatusBar />
        {children}
      </div>
      <div className="grain" />
      <Toast />
    </div>
  );
}

// ---- top app bar (drawer/flow screens) ----
export function TopBar({
  title,
  subtitle,
  onBack,
  right,
}: {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
}) {
  return (
    <div className="topbar">
      {onBack && (
        <button className="iconbtn" onClick={onBack} aria-label="Back">
          <Ic n="ic-back" alt="back" />
        </button>
      )}
      {(title || subtitle) && (
        <div>
          {title && <div className="ttl">{title}</div>}
          {subtitle && <div className="sub">{subtitle}</div>}
        </div>
      )}
      <span className="spacer" />
      {right}
    </div>
  );
}

// ---- the network ledger chip (the "nothing leaves" proof) ----
export function Ledger({
  prefix,
  suffix = "network calls",
  value,
}: {
  prefix?: string;
  suffix?: string;
  value?: number;
}) {
  const { networkCount } = useStore();
  const n = value ?? networkCount;
  return (
    <div className="ledger">
      <Ic n="ic-wifi-off" size={14} alt="" />
      {prefix ? <>{prefix}&nbsp;·&nbsp;</> : null}
      <b>{n}</b>&nbsp;{suffix}
    </div>
  );
}

// ---- the listening-ear mascot (idle/encouragement only; toggleable; never on S4) ----
export function Mascot({
  variant = "listen",
  say,
  size = 54,
  vertical = false,
}: {
  variant?: "listen" | "happy" | "neutral";
  say?: string;
  size?: number;
  vertical?: boolean;
}) {
  const { settings } = useStore();
  if (!settings.mascot) return null;
  const file = variant === "happy" ? "ear-happy" : variant === "neutral" ? "ear" : "ear-listen";
  return (
    <div
      className="earmount"
      style={vertical ? { flexDirection: "column", textAlign: "center", gap: 8 } : undefined}
    >
      <Ic n={file} size={size} alt="" />
      {say && <span className="say">{say}</span>}
    </div>
  );
}

// ---- a small ephemeral toast ----
function Toast() {
  const { toast } = useStore();
  if (!toast) return null;
  return (
    <div
      className="fadeup"
      style={{
        position: "fixed",
        left: "50%",
        bottom: "calc(28px + env(safe-area-inset-bottom))",
        transform: "translateX(-50%)",
        background: "var(--ink)",
        color: "#fff",
        fontFamily: "var(--ui)",
        fontWeight: 700,
        fontSize: 13.5,
        padding: "12px 18px",
        borderRadius: 14,
        boxShadow: "0 16px 30px rgba(36,56,66,.28)",
        zIndex: 80,
        maxWidth: 320,
        textAlign: "center",
      }}
      role="status"
    >
      {toast}
    </div>
  );
}

// helper: the inline wordmark text (used where the SVG asset isn't needed)
export function WordmarkText({ size = 23 }: { size?: number }) {
  return (
    <span className="wm" style={{ fontSize: size }}>
      slip<span className="dot" />
    </span>
  );
}

// re-export for screens
export { actions };
