import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Geist, Playfair_Display } from "next/font/google";

import { AppShell } from "@/components/layout/AppShell";
import { NavigationFrame } from "@/components/layout/NavigationFrame";
import { ServiceWorkerRegistration } from "@/components/pwa/ServiceWorkerRegistration";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair" });

export const metadata: Metadata = {
  title: {
    default: "Wine Notes",
    template: "%s | Wine Notes",
  },
  description: "ワインのテイスティング記録、画像管理、AI参考情報生成をまとめる個人向けノートアプリ。",
  applicationName: "Wine Notes",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Wine Notes",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "dark",
  themeColor: "#070A0F",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body className={`${geist.className} ${geist.variable} ${playfair.variable}`}>
        <ServiceWorkerRegistration />
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[1000] focus:rounded-xl focus:bg-[var(--primary)] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-[var(--primary-foreground)] focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
        >
          本文へスキップ
        </a>
        <AppShell>
          <NavigationFrame>
            {children}
          </NavigationFrame>
        </AppShell>
      </body>
    </html>
  )
}
