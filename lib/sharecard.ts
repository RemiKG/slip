// TODO: tighten share-card layout on narrow screens
// On-device share-card export. Renders the live DOM card to a single PNG entirely in the
// browser (html-to-image embeds the fonts + SVG, so the canvas is never tainted and
// nothing is uploaded). Includes the Safari/iOS first-render-blank retry, then hands the
// blob to the OS share sheet (Web Share L2) or a plain download.

let cachedFontCss: string | undefined;

export async function renderCardToBlob(
  node: HTMLElement,
  { minBytes = 60_000, maxAttempts = 10, pixelRatio = 2 } = {}
): Promise<Blob> {
  const { toBlob, getFontEmbedCSS } = await import("html-to-image");
  if (typeof document !== "undefined" && document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      /* ignore */
    }
  }
  if (cachedFontCss === undefined) {
    try {
      cachedFontCss = await getFontEmbedCSS(node);
    } catch {
      cachedFontCss = "";
    }
  }
  const opts = {
    pixelRatio,
    backgroundColor: "#FFFCF6",
    cacheBust: true,
    fontEmbedCSS: cachedFontCss,
  };
  let blob: Blob | null = null;
  for (let i = 0; i < maxAttempts; i++) {
    blob = await toBlob(node, opts);
    if (blob && blob.size >= minBytes) return blob;
  }
  if (!blob) throw new Error("Couldn’t render the share card.");
  return blob;
}

export function downloadBlob(blob: Blob, filename = "slip-reading-report.png"): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function shareCard(blob: Blob): Promise<"shared" | "downloaded"> {
  const file = new File([blob], "slip-reading-report.png", { type: "image/png" });
  const data: ShareData = {
    files: [file],
    title: "Slip reading report",
    text: "A reading report, made on-device with Slip. Nothing uploaded.",
  };
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (typeof nav.canShare === "function" && nav.canShare(data)) {
    try {
      await navigator.share(data);
      return "shared";
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return "shared";
      // fall through to download on a real failure
    }
  }
  downloadBlob(blob);
  return "downloaded";
}
