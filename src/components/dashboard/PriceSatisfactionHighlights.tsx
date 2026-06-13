'use client';

import React from 'react';
import Link from 'next/link';
import { Award, TrendingUp } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/primitives';
import { TastingNote } from '@/types/custom';

interface Props {
    notes: TastingNote[];
}

function valueScore(note: TastingNote) {
    const price = note.price || 0;
    const rating = note.rating || 0;
    return rating / Math.log10(price + 10);
}

const PriceSatisfactionHighlights: React.FC<Props> = ({ notes }) => {
    const pricedRated = notes
        .filter((note) => typeof note.price === 'number' && typeof note.rating === 'number')
        .sort((a, b) => valueScore(b) - valueScore(a));

    const topValueWines = pricedRated.slice(0, 3);
    const averagePrice = pricedRated.length
        ? Math.round(pricedRated.reduce((sum, note) => sum + (note.price || 0), 0) / pricedRated.length)
        : null;
    const averageRating = pricedRated.length
        ? pricedRated.reduce((sum, note) => sum + (note.rating || 0), 0) / pricedRated.length
        : null;

    return (
        <Card className="flex h-full min-h-[360px] flex-col p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                    <h3 className="text-sm font-semibold uppercase tracking-[0.06em] text-[var(--text-muted)]">高満足ワイン</h3>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">価格と評価のバランスが良い記録</p>
                </div>
                <Award className="h-5 w-5 text-[var(--color-gold)]" />
            </div>

            {topValueWines.length === 0 ? (
                <EmptyState
                    title="高満足ワインがありません"
                    description="価格と評価を入力すると、満足度の高い記録が表示されます。"
                    className="flex h-[210px] flex-col items-center justify-center"
                />
            ) : (
                <div className="flex flex-1 flex-col space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3">
                            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">平均価格</div>
                            <div className="mt-1 text-lg font-semibold text-[var(--text)]">
                                {averagePrice ? `¥${averagePrice.toLocaleString()}` : '-'}
                            </div>
                        </div>
                        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3">
                            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">平均評価</div>
                            <div className="mt-1 text-lg font-semibold text-[var(--text)]">
                                {averageRating ? averageRating.toFixed(1) : '-'}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        {topValueWines.map((note, index) => (
                            <Link
                                key={note.id}
                                href={`/wines/${note.id}`}
                                aria-label={`${note.wine_name}の詳細を開く`}
                                className="group block rounded-lg border border-[var(--border)] bg-[var(--card-bg)] p-3 transition-colors hover:border-[var(--primary)] hover:bg-[var(--surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-gold-soft)] text-xs font-bold text-[var(--color-gold)]">
                                                {index + 1}
                                            </span>
                                            <p className="truncate text-sm font-semibold text-[var(--text)] group-hover:text-[var(--primary-text)]">{note.wine_name}</p>
                                        </div>
                                        <p className="mt-1 truncate pl-8 text-xs text-[var(--text-muted)]">
                                            {[note.country, note.region || note.locality, note.vintage].filter(Boolean).join(' / ') || '産地未入力'}
                                        </p>
                                    </div>
                                    <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-[var(--primary-text)] transition-transform group-hover:translate-x-0.5" />
                                </div>
                                <div className="mt-2 flex flex-wrap gap-2 pl-8 text-xs">
                                    <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[var(--text-muted)]">
                                        ¥{(note.price || 0).toLocaleString()}
                                    </span>
                                    <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[var(--text-muted)]">
                                        評価 {note.rating}
                                    </span>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            )}
        </Card>
    );
};

export default PriceSatisfactionHighlights;
