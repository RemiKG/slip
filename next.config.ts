import type { NextConfig } from "next";

/**
 * Slip — Next.js config.
 *
 * Two things matter here:
 *  1. Cross-origin isolation (COOP/COEP) so onnxruntime-web can use multi-threaded
 *     WASM (SharedArrayBuffer). We use COEP=credentialless so the phoneme model can
 *     still be fetched cross-origin from the Hugging Face CDN without a CORP header
 *     (require-corp would block it). Browsers without credentialless (Safari) simply
 *     fall back to single-threaded WASM — the app still works, just a little slower.
 *  2. Keep the heavy in-browser ML packages out of the server bundle; all model code
 *     is client-only ('use client' + dynamic import), so this is a safety net.
 *
 * No hardcoded hosts/ports anywhere — the client derives every URL from the runtime
 * origin or from NEXT_PUBLIC_* env vars.
 */
const nextConfig: NextConfig = {
  reactStrictMode: false, // imperative audio/model effects shouldn't double-fire in dev
  serverExternalPackages: [
    "@huggingface/transformers",
    "onnxruntime-web",
    "onnxruntime-node",
    "sharp",
  ],
  async headers() {
    return [
      {
        // Applies to everything (document, worker, model, assets) so the page is
        // genuinely cross-origin isolated. (Matching only '/' would leave it false.)
        source: "/:path*",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
        ],
      },
      {
        // Self-hosted fonts/art are immutable — cache them hard for offline reuse.
        source: "/fonts/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
          { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
        ],
      },
      {
        source: "/art/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
          { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
