import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Inter } from 'next/font/google';

import BottomNav from "@/components/bottom-nav";

const inter = Inter({ subsets: ['latin'] });


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
      {/* 
        data-winetype はここでは空にしておく
        page.tsx 側の useEffect で動的に書き換える
      */}
      <body className={inter.className} data-winetype="">
        <div className="mx-auto max-w-3xl p-4 sm:p-6 lg:p-8 pb-32">
          {children}
        </div>
        <BottomNav />
      </body>
    </html>
  )
}