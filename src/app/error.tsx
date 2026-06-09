"use client";

import Link from "next/link";
import { AlertTriangle, Home, RefreshCw } from "lucide-react";

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <main className="mx-auto flex min-h-[70vh] max-w-2xl flex-col items-center justify-center px-4 pb-28 pt-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--card-bg)] text-[var(--primary)] shadow-sm">
                <AlertTriangle size={30} aria-hidden="true" />
            </div>
            <p className="mt-5 text-sm font-bold uppercase tracking-wide text-[var(--primary)]">Error</p>
            <h1 className="mt-2 text-2xl font-bold tracking-normal text-[var(--text)]">
                ページの表示中に問題が発生しました
            </h1>
            <p className="mt-3 text-sm leading-7 text-[var(--text-muted)]">
                一時的な通信または処理の問題で表示できませんでした。再試行しても解決しない場合は、問い合わせ時に下のエラーIDを添えてください。
            </p>
            {error.digest ? (
                <p className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 font-mono text-xs text-[var(--text-muted)]">
                    error_id: {error.digest}
                </p>
            ) : null}
            <div className="mt-7 flex flex-wrap justify-center gap-3">
                <button
                    type="button"
                    onClick={reset}
                    className="inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] shadow-sm transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                >
                    <RefreshCw size={16} aria-hidden="true" />
                    再試行
                </button>
                <Link
                    href="/"
                    className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--text)] shadow-sm transition-colors hover:border-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                >
                    <Home size={16} aria-hidden="true" />
                    入力画面へ
                </Link>
            </div>
        </main>
    );
}
