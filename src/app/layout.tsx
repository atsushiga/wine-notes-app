import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Inter } from 'next/font/google';

import BottomNav from "@/components/bottom-nav";
import { AppShell } from "@/components/layout/AppShell";
import { PwaInstallPrompt } from "@/components/pwa/PwaInstallPrompt";
import { ServiceWorkerRegistration } from "@/components/pwa/ServiceWorkerRegistration";

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

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
    statusBarStyle: "default",
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
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fff1f2" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body className={inter.className}>
        <ServiceWorkerRegistration />
        <AppShell>
          {children}
          <PwaInstallPrompt />
          <BottomNav />
        </AppShell>
      </body>
    </html>
  )
}
