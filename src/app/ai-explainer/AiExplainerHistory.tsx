"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Clock3, History, Sparkles, Wine } from "lucide-react";
import { SectionCard } from "@/components/ui/section-card";
import { listAiExplanations } from "@/app/actions/aiExplainer";
import {
    type AiExplainerHistoryItem,
    getAiExplainerClientKey,
} from "@/lib/aiExplainerStorage";

export default function AiExplainerHistory() {
    const [items, setItems] = useState<AiExplainerHistoryItem[]>([]);
    const [hasLoaded, setHasLoaded] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        let isMounted = true;

        listAiExplanations(getAiExplainerClientKey())
            .then((nextItems) => {
                if (!isMounted) return;
                setItems(nextItems);
            })
            .catch((err) => {
                console.error(err);
                if (!isMounted) return;
                setError("履歴の取得に失敗しました。");
            })
            .finally(() => {
                if (!isMounted) return;
                setHasLoaded(true);
            });

        return () => {
            isMounted = false;
        };
    }, []);

    if (!hasLoaded) return null;

    return (
        <SectionCard
            title="生成履歴"
            description="過去に作成したAI解説ページを開けます"
            icon={<History size={18} />}
            tone="neutral"
        >
            {error ? (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--app-bg)] px-4 py-5 text-sm text-[var(--text-muted)]">
                    {error}
                </div>
            ) : items.length === 0 ? (
                <div className="flex items-center gap-3 rounded-xl border border-dashed border-[var(--border)] bg-[var(--app-bg)] px-4 py-5 text-sm text-[var(--text-muted)]">
                    <Sparkles size={18} className="shrink-0 text-[var(--primary)]" />
                    <span>AI解説を生成すると、ここに履歴が表示されます。</span>
                </div>
            ) : (
                <div className="grid gap-3">
                    {items.map((item) => (
                        <Link
                            key={item.id}
                            href={`/ai-explainer/result?historyId=${encodeURIComponent(item.id)}`}
                            className="grid gap-3 rounded-xl border border-[var(--border)] bg-[var(--app-bg)] p-3 transition-colors hover:border-[var(--primary)] sm:grid-cols-[72px_minmax(0,1fr)_auto]"
                        >
                            <div className="relative h-20 w-full overflow-hidden rounded-lg bg-[var(--surface-2)] sm:h-[72px] sm:w-[72px]">
                                {item.imageUrl ? (
                                    <img
                                        src={item.imageUrl}
                                        alt={item.wineName || "AI解説のワイン画像"}
                                        className="h-full w-full object-cover"
                                    />
                                ) : (
                                    <div className="flex h-full w-full items-center justify-center text-[var(--text-muted)]">
                                        <Wine size={24} />
                                    </div>
                                )}
                            </div>

                            <div className="min-w-0">
                                <h3 className="line-clamp-2 text-sm font-bold text-[var(--text)]">
                                    {item.wineName || "名称未設定"}
                                </h3>
                                <p className="mt-1 line-clamp-1 text-xs text-[var(--text-muted)]">
                                    {[
                                        item.producer,
                                        item.vintage,
                                        item.price ? `¥${item.price.toLocaleString()}` : "",
                                        [item.country, item.locality].filter(Boolean).join(" / "),
                                    ].filter(Boolean).join(" ・ ") || "銘柄情報なし"}
                                </p>
                                {item.headline && (
                                    <p className="mt-2 line-clamp-2 text-xs leading-5 text-[var(--text-muted)]">
                                        {item.headline}
                                    </p>
                                )}
                            </div>

                            <div className="flex items-center gap-1 text-xs font-medium text-[var(--text-muted)] sm:justify-end">
                                <Clock3 size={14} />
                                <span>
                                    {new Date(item.generatedAt).toLocaleString("ja-JP", {
                                        month: "2-digit",
                                        day: "2-digit",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                    })}
                                </span>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </SectionCard>
    );
}
