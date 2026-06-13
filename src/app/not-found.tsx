import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Home, SearchX } from "lucide-react";

export const metadata: Metadata = {
    title: "ページが見つかりません",
};

export default function NotFound() {
    return (
        <main className="mx-auto flex min-h-[70vh] max-w-2xl flex-col items-center justify-center px-4 pb-28 pt-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--card-bg)] text-[var(--primary-text)] shadow-sm">
                <SearchX size={30} aria-hidden="true" />
            </div>
            <p className="mt-5 text-sm font-bold uppercase tracking-wide text-[var(--primary-text)]">404</p>
            <h1 className="mt-2 text-2xl font-bold tracking-normal text-[var(--text)]">
                ページが見つかりません
            </h1>
            <p className="mt-3 text-sm leading-7 text-[var(--text-muted)]">
                URLが変更されたか、アクセスできないページの可能性があります。記録一覧または入力画面から操作を続けてください。
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
                <Link
                    href="/"
                    className="inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] shadow-sm transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                >
                    <Home size={16} aria-hidden="true" />
                    入力画面へ
                </Link>
                <Link
                    href="/tasting-notes"
                    className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--text)] shadow-sm transition-colors hover:border-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                >
                    <ArrowLeft size={16} aria-hidden="true" />
                    記録一覧へ
                </Link>
            </div>
        </main>
    );
}
