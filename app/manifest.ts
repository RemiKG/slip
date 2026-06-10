import type { MetadataRoute } from "next";

// PWA manifest — served at /manifest.webmanifest and auto-linked by Next.
// Cream theme, standalone display, maskable icon for Android.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Slip — Catch the slip",
    short_name: "Slip",
    description:
      "Read aloud. Slip points at the exact sound you slipped on, then replays it in your own voice — right in your browser.",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#FAF6EF",
    theme_color: "#FAF6EF",
    categories: ["education", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
