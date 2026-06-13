"use client";
import { useEffect, useRef, useState } from "react";
import { actions, Ic, TopBar } from "@/components/ui";

type Phase = "capture" | "processing" | "result" | "error";

// S2 · Photograph a page — turn a real page into editable text on-device (OCR),
// flagging uncertain words rather than hiding them.
export default function Photograph() {
  const [phase, setPhase] = useState<Phase>("capture");
  const [cameraOn, setCameraOn] = useState(false);
  const [shot, setShot] = useState<string | null>(null); // captured image dataURL
  const [progress, setProgress] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [initialHtml, setInitialHtml] = useState("");
  const [edited, setEdited] = useState("");
  const [flagged, setFlagged] = useState(0);
  const [errMsg, setErrMsg] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => stopCamera(), []);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  }

  async function openCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      setCameraOn(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      setErrMsg("Couldn’t open the camera. Upload a photo, or just type your text.");
      setPhase("error");
    }
  }

  function grabFrame(): HTMLCanvasElement | null {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return null;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")?.drawImage(v, 0, 0, c.width, c.height);
    return c;
  }

  async function runOcr(source: HTMLCanvasElement | HTMLImageElement) {
    setPhase("processing");
    setProgress(0);
    const canvas =
      source instanceof HTMLCanvasElement ? source : imageToCanvas(source);
    setShot(canvas.toDataURL("image/jpeg", 0.85));
    try {
      const ocr = await import("@/lib/ocr");
      const result = await ocr.recognize(canvas, (p) => setProgress(p));
      if (result.text.trim().length < 3 || result.pageConfidence < 35) {
        setErrMsg("That looked too dark or blurry to read. Try again with more light, or type it.");
        setPhase("error");
        return;
      }
      // build flagged HTML once; the field stays editable afterwards
      const html = result.words
        .map((w) =>
          w.flag === "ok" ? escapeHtml(w.text) : `<span class="flag">${escapeHtml(w.text)}</span>`
        )
        .join(" ");
      setInitialHtml(html);
      setEdited(result.words.map((w) => w.text).join(" "));
      setFlagged(result.words.filter((w) => w.flag !== "ok").length);
      setSeconds(result.seconds);
      setPhase("result");
      stopCamera();
    } catch {
      setErrMsg("OCR couldn’t run here. Upload a clearer photo, or type your text instead.");
      setPhase("error");
    }
  }

  const onShutter = () => {
    const c = grabFrame();
    if (c) void runOcr(c);
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      void runOcr(img);
      URL.revokeObjectURL(url);
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
  };

  const useText = async () => {
    const text = edited.trim();
    if (!text) return;
    actions.setPassage(text);
    (await import("@/lib/flow")).goRead();
  };

  return (
    <>
      <TopBar
        title="Photograph a page"
        onBack={() => {
          stopCamera();
          actions.back();
        }}
        right={
          <button
            className="iconbtn"
            onClick={() => {
              setPhase("capture");
              void openCamera();
            }}
            aria-label="Camera"
          >
            <Ic n="ic-camera" alt="camera" />
          </button>
        }
      />

      {/* capture / preview card */}
      <div className="pagepad" style={{ marginTop: 4 }}>
        <div className="card" style={{ position: "relative", height: 238, overflow: "hidden", background: "#ECE3D2" }}>
          {phase === "result" && shot ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={shot} alt="captured page" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              <span className="crop tl" />
              <span className="crop tr" />
              <span className="crop bl" />
              <span className="crop br" />
              <div style={{ position: "absolute", left: 14, bottom: 14 }} className="pill pill-amber">
                cropped &amp; straightened
              </div>
            </>
          ) : cameraOn ? (
            <>
              <video ref={videoRef} playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              <span className="crop tl" />
              <span className="crop tr" />
              <span className="crop bl" />
              <span className="crop br" />
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: 14 }}>
                <button
                  className="rec"
                  style={{ width: 58, height: 58 }}
                  onClick={onShutter}
                  aria-label="Take photo"
                >
                  <Ic n="ic-camera" size={24} alt="" />
                </button>
              </div>
            </>
          ) : (
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 20 }}>
              <Ic n="ic-camera" size={40} style={{ opacity: 0.5 }} alt="" />
              <div className="rowflex gap10">
                <button className="btn btn-amber" style={{ padding: "12px 18px", fontSize: 15 }} onClick={openCamera}>
                  Open camera
                </button>
                <button className="btn btn-soft" style={{ padding: "12px 18px", fontSize: 15 }} onClick={() => fileRef.current?.click()}>
                  Upload a photo
                </button>
              </div>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
            </div>
          )}
        </div>
      </div>

      {phase === "processing" && (
        <div className="pagepad" style={{ marginTop: 14 }}>
          <div className="rowflex gap10" style={{ justifyContent: "space-between" }}>
            <span className="pill pill-amber">
              <Ic n="ic-chip" size={14} alt="" />
              reading on your device…
            </span>
            <span className="data tiny" style={{ color: "var(--ink-mute)" }}>
              read image → finding text… {Math.round(progress * 100)}%
            </span>
          </div>
        </div>
      )}

      {phase === "result" && (
        <>
          <div className="pagepad" style={{ marginTop: 14 }}>
            <div className="rowflex gap10" style={{ justifyContent: "space-between" }}>
              <span className="pill pill-good">
                <Ic n="ic-check" size={14} alt="" />
                Read on your device
              </span>
              <span className="data tiny" style={{ color: "var(--ink-mute)" }}>
                read image → found text → done · <span style={{ color: "var(--ink-soft)" }}>{seconds.toFixed(1)} s</span>
              </span>
            </div>
          </div>

          <div className="pagepad" style={{ marginTop: 14 }}>
            <div className="well pad-lg" style={{ position: "relative" }}>
              <div className="tiny" style={{ marginBottom: 10, letterSpacing: ".3px" }}>
                YOUR PAGE — TAP TO FIX ANYTHING THAT’S OFF
              </div>
              <div
                className="passage sm passage-input"
                style={{ fontSize: 19, lineHeight: 1.62, minHeight: 60, outline: "none" }}
                contentEditable
                suppressContentEditableWarning
                onInput={(e) => setEdited((e.currentTarget as HTMLElement).textContent ?? "")}
                dangerouslySetInnerHTML={{ __html: initialHtml }}
              />
              <div className="rowflex gap8" style={{ marginTop: 14, color: "var(--ink-mute)" }}>
                <Ic n="ic-pencil" size={15} style={{ opacity: 0.6 }} alt="" />
                <span className="tiny">
                  {flagged === 0
                    ? "Looks clean — edit anything if needed."
                    : `${flagged} word${flagged === 1 ? "" : "s"} looked uncertain — we flagged ${flagged === 1 ? "it" : "them"}, didn’t hide ${flagged === 1 ? "it" : "them"}.`}
                </span>
              </div>
            </div>
          </div>
        </>
      )}

      {phase === "error" && (
        <div className="pagepad" style={{ marginTop: 16 }}>
          <div className="card flat pad-lg center" style={{ gap: 10, textAlign: "center" }}>
            <Ic n="ic-info" size={28} alt="" />
            <div className="tiny" style={{ maxWidth: 300 }}>{errMsg}</div>
          </div>
        </div>
      )}

      <div className="grow" />

      <div className="pagepad col gap12" style={{ paddingBottom: 18 }}>
        {phase === "result" ? (
          <>
            <button className="btn btn-amber btn-block btn-lg" onClick={useText}>
              Use this text&nbsp;&nbsp;<span style={{ font: "600 21px var(--ui)" }}>→</span>
            </button>
            <button
              className="btn btn-ghost btn-block"
              onClick={() => {
                setPhase("capture");
                setShot(null);
                void openCamera();
              }}
            >
              <Ic n="ic-camera" size={18} style={{ opacity: 0.7 }} alt="" />
              &nbsp;&nbsp;Retake
            </button>
          </>
        ) : phase === "error" ? (
          <>
            <button className="btn btn-amber btn-block btn-lg" onClick={() => { setPhase("capture"); void openCamera(); }}>
              Try again
            </button>
            <button className="btn btn-ghost btn-block" onClick={() => actions.navigate("s1")}>
              Type it instead
            </button>
          </>
        ) : null}
      </div>

      <div className="center" style={{ paddingBottom: 22 }}>
        <div className="tiny" style={{ textAlign: "center", maxWidth: 330 }}>
          OCR runs on your device — a few seconds on a phone; longer for full pages or dim light.
          The photo never leaves.
        </div>
      </div>
    </>
  );
}

function imageToCanvas(img: HTMLImageElement): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = img.naturalWidth || img.width;
  c.height = img.naturalHeight || img.height;
  c.getContext("2d")?.drawImage(img, 0, 0);
  return c;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) =>
    ch === "&" ? "&amp;" : ch === "<" ? "&lt;" : ch === ">" ? "&gt;" : ch === '"' ? "&quot;" : "&#39;"
  );
}
