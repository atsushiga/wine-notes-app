import { Loader2, Wine } from "lucide-react";
import { SkeletonBlock } from "@/components/ui/primitives";

export default function Loading() {
    return (
        <main className="mx-auto w-full max-w-6xl px-4 py-8 pb-32 md:px-8" aria-live="polite" aria-busy="true">
            <div className="mb-8 flex items-center gap-4">
                <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--card-bg)] text-[var(--primary-text)] shadow-sm">
                    <Wine size={26} aria-hidden="true" />
                    <Loader2 size={16} aria-hidden="true" className="absolute -right-1 -top-1 animate-spin rounded-full bg-[var(--card-bg)] text-[var(--primary-text)] motion-reduce:animate-pulse" />
                </div>
                <div>
                    <h1 className="text-lg font-bold tracking-normal text-[var(--text)]">
                        読み込み中
                    </h1>
                    <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">
                        ワイン記録を準備しています。
                    </p>
                </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <SkeletonBlock className="h-28" />
                <SkeletonBlock className="h-28" />
                <SkeletonBlock className="h-28" />
                <SkeletonBlock className="h-28" />
            </div>
            <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(260px,0.7fr)_minmax(0,1.3fr)]">
                <SkeletonBlock className="aspect-[3/4]" />
                <div className="space-y-4">
                    <SkeletonBlock className="h-16" />
                    <SkeletonBlock className="h-40" />
                    <SkeletonBlock className="h-32" />
                </div>
            </div>
        </main>
    );
}
