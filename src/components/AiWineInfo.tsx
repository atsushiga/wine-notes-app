'use client';

import { useState } from 'react';
import { TastingNote } from '@/types/custom';
import { searchWineDetails, saveGeminiData, GroundingData } from '@/app/actions/gemini';
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
            <div className="mt-8 p-6 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-2xl border border-purple-100 dark:border-purple-800 shadow-sm">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                    <div>
                        <h3 className="text-lg font-bold text-[var(--text)] flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-purple-600" />
                            AIによる深掘り検索
                        </h3>
                        <p className="text-sm text-[var(--text-muted)] mt-1">
                            Geminiを使用して、テロワール、生産者の哲学、技術詳細などをWebから検索・取得します。
                        </p>
                    </div>
                    <button
                        onClick={handleSearch}
                        className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-medium rounded-xl shadow-md hover:shadow-lg transform transition-all hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-2 whitespace-nowrap"
                    >
                        <Sparkles className="w-4 h-4" />
                        情報を取得する
                    </button>
                </div>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="mt-8 p-12 bg-[var(--surface-2)] rounded-2xl border border-[var(--border)] flex flex-col items-center justify-center text-center animate-pulse">
                <Loader2 className="w-8 h-8 text-purple-600 animate-spin mb-4" />
                <h3 className="text-lg font-bold text-[var(--text)]">AIが情報を収集中...</h3>
                <p className="text-sm text-[var(--text-muted)] mt-2">Web上の専門情報を検索・分析しています。<br />これには数十秒かかる場合があります。</p>
            </div>
        );
    }

    // Has Data
    return (
        <div className="mt-8 space-y-6">
            <h3 className="text-xl font-bold text-[var(--text)] flex items-center gap-2 pb-2 border-b border-[var(--border)]">
                <Sparkles className="w-6 h-6 text-purple-600" />
                AI Wine Analysis
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InfoCard
                    title="テロワール (Terroir)"
                    icon={<BookOpen className="w-5 h-5 text-emerald-600" />}
                    content={wine.terroir_info}
                />
                <InfoCard
                    title="生産者・哲学 (Producer)"
                    icon={<User className="w-5 h-5 text-blue-600" />}
                    content={wine.producer_philosophy}
                />
                <InfoCard
                    title="技術詳細 (Technical)"
                    icon={<Settings className="w-5 h-5 text-gray-600" />}
                    content={wine.technical_details}
                />
                <InfoCard
                    title="ヴィンテージ分析 (Vintage)"
                    icon={<Calendar className="w-5 h-5 text-orange-600" />}
                    content={wine.vintage_analysis}
                />
            </div>

            <div className="bg-[var(--card-bg)] p-6 rounded-2xl shadow-sm border border-[var(--border)]">
                <h4 className="text-lg font-bold text-[var(--text)] mb-4 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-red-600" />
                    Web上のテイスティングノート
                </h4>
                <p className="text-[var(--text)] whitespace-pre-wrap leading-relaxed text-sm">
                    {wine.search_result_tasting_note || "情報なし"}
                </p>
            </div>
        </div>
    );
}

function InfoCard({ title, icon, content }: { title: string; icon: React.ReactNode; content?: string }) {
    if (!content) return null;
    return (
        <div className="bg-[var(--card-bg)] p-6 rounded-2xl shadow-sm border border-[var(--border)] hover:shadow-md transition-shadow">
            <h4 className="text-sm font-bold text-[var(--text-muted)] uppercase tracking-wide mb-3 flex items-center gap-2">
                {icon}
                {title}
            </h4>
            <p className="text-[var(--text)] text-sm leading-relaxed whitespace-pre-wrap">
                {content}
            </p>
        </div>
    );
}
