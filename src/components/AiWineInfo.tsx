'use client';

import { useState } from 'react';
import { TastingNote } from '@/types/custom';
import { searchWineDetails, saveGeminiData } from '@/app/actions/gemini';
import { Sparkles, Loader2, BookOpen, User, Settings, Calendar, FileText } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface AiWineInfoProps {
    wine: TastingNote;
}

export default function AiWineInfo({ wine }: AiWineInfoProps) {
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    const hasAiData = !!(
        wine.terroir_info ||
        wine.producer_philosophy ||
        wine.technical_details ||
        wine.vintage_analysis ||
        wine.search_result_tasting_note
    );

    const handleSearch = async () => {
        if (isLoading) return;
        setIsLoading(true);

        try {
            const result = await searchWineDetails(wine.id, {
                name: wine.wine_name,
                winery: wine.producer,
                vintage: wine.vintage,
                country: wine.country,
                locality: wine.locality,
                referenceUrl: wine.reference_url,
            });

            await saveGeminiData(wine.id, result);
            router.refresh();
        } catch (error) {
            console.error('AI Search Failed:', error);
            const errorMessage = error instanceof Error ? error.message : '情報の取得に失敗しました。もう一度お試しください。';
            alert(`エラー: ${errorMessage}`);
        } finally {
            setIsLoading(false);
        }
    };

    if (!hasAiData && !isLoading) {
        return (
            <section className="rounded-lg border border-[var(--color-gold)]/35 bg-[var(--color-gold-soft)] p-4 shadow-[var(--shadow-card)]">
                <div className="flex flex-col gap-4">
                    <div>
                        <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
                            <Sparkles className="h-4 w-4 text-[var(--color-gold)]" />
                            AI補助情報
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-[var(--text-soft)]">
                            Geminiを使用して、テロワール、生産者の哲学、技術詳細などをWebから検索・取得します。
                        </p>
                        <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">
                            国名・地域名・参考URLが入力されている場合は、それらの情報も検索に活用されます。
                        </p>
                    </div>
                    <button
                        onClick={handleSearch}
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[var(--color-gold)]/35 bg-[var(--card-bg)] px-4 py-2 text-sm font-semibold text-[var(--text)] transition-colors hover:bg-[var(--surface-2)]"
                    >
                        <Sparkles className="h-4 w-4 text-[var(--color-gold)]" />
                        情報を取得する
                    </button>
                </div>
            </section>
        );
    }

    if (isLoading) {
        return (
            <section className="flex flex-col items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--card-bg)] p-8 text-center">
                <Loader2 className="mb-4 h-8 w-8 animate-spin text-[var(--color-gold)]" />
                <h3 className="text-base font-semibold text-[var(--text)]">AIが情報を収集中...</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">Web上の専門情報を検索・分析しています。数十秒かかる場合があります。</p>
            </section>
        );
    }

    // Has Data
    return (
        <section className="space-y-4 rounded-lg border border-[var(--border)] bg-[var(--card-bg)] p-4">
            <div className="border-b border-[var(--border-subtle)] pb-3">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
                    <Sparkles className="h-4 w-4 text-[var(--color-gold)]" />
                    AI補助情報
                </h3>
                <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
                    自分の記録とは別の参考情報です。
                </p>
            </div>

            <div className="grid grid-cols-1 gap-3">
                <InfoCard
                    title="テロワール (Terroir)"
                    icon={<BookOpen className="h-4 w-4 text-[var(--color-gold)]" />}
                    content={wine.terroir_info}
                />
                <InfoCard
                    title="生産者・哲学 (Producer)"
                    icon={<User className="h-4 w-4 text-[var(--text-soft)]" />}
                    content={wine.producer_philosophy}
                />
                <InfoCard
                    title="技術詳細 (Technical)"
                    icon={<Settings className="h-4 w-4 text-[var(--text-soft)]" />}
                    content={wine.technical_details}
                />
                <InfoCard
                    title="ヴィンテージ分析 (Vintage)"
                    icon={<Calendar className="h-4 w-4 text-[var(--color-gold)]" />}
                    content={wine.vintage_analysis}
                />
            </div>

            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] p-4">
                <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.06em] text-[var(--text-muted)]">
                    <FileText className="h-4 w-4 text-[var(--primary-text)]" />
                    Web上のテイスティングノート
                </h4>
                <p className="whitespace-pre-wrap text-sm leading-7 text-[var(--text-soft)]">
                    {wine.search_result_tasting_note || "情報なし"}
                </p>
            </div>
        </section>
    );
}

function InfoCard({ title, icon, content }: { title: string; icon: React.ReactNode; content?: string }) {
    if (!content) return null;
    return (
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] p-4">
            <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.06em] text-[var(--text-muted)]">
                {icon}
                {title}
            </h4>
            <p className="whitespace-pre-wrap text-sm leading-7 text-[var(--text-soft)]">
                {content}
            </p>
        </div>
    );
}
