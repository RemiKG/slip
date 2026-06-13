// Register the offline service worker (production only — in dev it would cache HMR).
// Also captures the install prompt for the "Add Slip to your home screen" button.

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferredPrompt: InstallPromptEvent | null = null;

export function registerServiceWorker(): void {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;
  if (process.env.NODE_ENV !== "production") return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* offline support is a progressive enhancement; never block the app on it */
    });
    // tell the worker exactly which same-origin assets we loaded, so it can cache the real
    // shell for offline (no build manifest needed). Resend on control + after lazy chunks.
    const warm = () => {
      const ctrl = navigator.serviceWorker.controller;
      if (!ctrl) return;
      const urls = [
        location.href,
        location.origin + "/",
        ...performance.getEntriesByType("resource").map((e) => e.name),
      ];
      ctrl.postMessage({ type: "warm", urls });
    };
    navigator.serviceWorker.addEventListener("controllerchange", warm);
    navigator.serviceWorker.ready.then(() => {
      warm();
      setTimeout(warm, 1800);
    });
  });
}

export function captureInstallPrompt(onAvailable: (available: boolean) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onBeforeInstall = (e: Event) => {
    e.preventDefault();
    deferredPrompt = e as InstallPromptEvent;
    onAvailable(true);
  };
  const onInstalled = () => {
    deferredPrompt = null;
    onAvailable(false);
  };
  window.addEventListener("beforeinstallprompt", onBeforeInstall);
  window.addEventListener("appinstalled", onInstalled);
  return () => {
    window.removeEventListener("beforeinstallprompt", onBeforeInstall);
    window.removeEventListener("appinstalled", onInstalled);
  };
}

export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  if (!deferredPrompt) return "unavailable";
  await deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  return outcome;
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari proprietary flag
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}
