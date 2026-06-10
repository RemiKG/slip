import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Boot } from "@/components/Boot";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);

export const metadata: Metadata = {
  metadataBase: siteUrl ? new URL(siteUrl) : undefined,
  title: "Slip — Catch the slip",
  description:
    "Read anything aloud. Slip points at the exact sound you slipped on, then replays it in your own voice — 100% in your browser, 0% uploaded.",
  applicationName: "Slip",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Slip" },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon-180.png", sizes: "180x180" }],
  },
  openGraph: {
    title: "Slip — Catch the slip",
    description:
      "A browser-based reading-aloud pronunciation coach that points at the exact sound you slipped on.",
    images: ["/art/thumbnail.png"],
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#FAF6EF",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Boot />
      </body>
    </html>
  );
}
