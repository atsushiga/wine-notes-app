import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Inter } from 'next/font/google';

import BottomNav from "@/components/bottom-nav";
import { AppShell } from "@/components/layout/AppShell";

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });


const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Wine tasting notes",
  description: "Wine tasting notes",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body className={inter.className}>
        <AppShell>
          {children}
          <BottomNav />
        </AppShell>
      </body>
    </html>
  )
}