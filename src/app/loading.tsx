import { Loader2, Wine } from "lucide-react";

export default function Loading() {
    return (
        <main className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-4 pb-28 pt-12 text-center" aria-live="polite">
            <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--card-bg)] text-[var(--primary)] shadow-sm">
                <Wine size={28} aria-hidden="true" />
                <Loader2 size={18} aria-hidden="true" className="absolute -right-1 -top-1 animate-spin rounded-full bg-[var(--card-bg)] text-[var(--primary)] motion-reduce:animate-pulse" />
            </div>
            <h1 className="mt-5 text-lg font-bold tracking-normal text-[var(--text)]">
                読み込み中
            </h1>
            <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                ワイン記録を準備しています。
            </p>
        </main>
    );
}
