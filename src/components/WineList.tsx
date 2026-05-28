'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { TastingNote } from '@/types/custom';
import { bulkDeleteWines } from '@/app/actions/wine';
import { ContentContainer } from '@/components/layout/ContentContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { FORM_CONTROL_BASE } from '@/constants/styles';

interface WineListProps {
    notes: TastingNote[];
}

type SortKey = 'date' | 'price' | 'rating' | 'wine_name';
type SortOrder = 'asc' | 'desc';

export default function WineList({ notes }: WineListProps) {
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [isDeleting, setIsDeleting] = useState(false);

    // Sort State
    const [sortKey, setSortKey] = useState<SortKey>('date');
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

    // Filter State
    const [filterStatus, setFilterStatus] = useState<'all' | 'draft'>('all');

    const toggleSelectionMode = () => {
        setIsSelectionMode(!isSelectionMode);
        setSelectedIds([]);
    };

    const toggleSelection = (id: number) => {
        if (selectedIds.includes(id)) {
            setSelectedIds(selectedIds.filter((selectedId) => selectedId !== id));
        } else {
            setSelectedIds([...selectedIds, id]);
        }
    };

    const handleBulkDelete = async () => {
        if (!window.confirm(`${selectedIds.length}件のアイテムを削除しますか？この操作は取り消せません。`)) {
            return;
        }

        setIsDeleting(true);
        try {
            await bulkDeleteWines(selectedIds);
            setIsSelectionMode(false);
            setSelectedIds([]);
        } catch (error) {
            console.error('Failed to delete wines:', error);
            alert('削除に失敗しました。');
        } finally {
            setIsDeleting(false);
        }
    };

    // Sort Logic
    // Create a copy before sorting to avoid mutating props directly if they were not readonly
    const filteredNotes = notes.filter((note) => {
        if (filterStatus === 'draft') {
            return note.status === 'draft';
        }
        return true;
    });

    const sortedNotes = [...filteredNotes].sort((a, b) => {
        let valA = a[sortKey];
        let valB = b[sortKey];

        // Handle null/undefined values
        if (valA === null || valA === undefined) valA = '';
        if (valB === null || valB === undefined) valB = '';

        if (sortKey === 'price' || sortKey === 'rating') {
            // Numeric sort
            const numA = Number(valA) || 0;
            const numB = Number(valB) || 0;
            if (numA < numB) return sortOrder === 'asc' ? -1 : 1;
            if (numA > numB) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        }

        // String/Date sort (Date strings compare correctly lexicographically usually, but explicit Date object comparison is safer if formats vary, though ISO strings are fine)
        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
    });

    const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value;
        const [key, order] = value.split('-');
        if (isSortKey(key) && isSortOrder(order)) {
            setSortKey(key);
            setSortOrder(order);
        }
    };

    return (
        <ContentContainer size="wide" className="pb-24">
            <PageHeader
                title="ワイン記録一覧"
                subtitle="過去のテイスティングノートを振り返る"
                actions={
                    <div className="flex flex-wrap gap-2 w-full md:w-auto justify-end">
                        {/* Status Filter */}
                        <select
                            className={`${FORM_CONTROL_BASE} w-auto`}
                            onChange={(e) => setFilterStatus(e.target.value as 'all' | 'draft')}
                            value={filterStatus}
                        >
                            <option value="all">すべて表示</option>
                            <option value="draft">下書き (編集中) のみ</option>
                        </select>

                        {/* Sort Dropdown */}
                        <select
                            className={`${FORM_CONTROL_BASE} w-auto`}
                            onChange={handleSortChange}
                            defaultValue="date-desc"
                        >
                            <option value="date-desc">日付 (新しい順)</option>
                            <option value="date-asc">日付 (古い順)</option>
                            <option value="rating-desc">評価 (高い順)</option>
                            <option value="rating-asc">評価 (低い順)</option>
                            <option value="price-desc">価格 (高い順)</option>
                            <option value="price-asc">価格 (低い順)</option>
                            <option value="wine_name-asc">名前 (昇順)</option>
                            <option value="wine_name-desc">名前 (降順)</option>
                        </select>

                        {isSelectionMode && selectedIds.length > 0 && (
                            <button
                                onClick={handleBulkDelete}
                                disabled={isDeleting}
                                className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50"
                            >
                                {isDeleting ? '削除中...' : `${selectedIds.length}件を削除`}
                            </button>
                        )}
                        <button
                            onClick={toggleSelectionMode}
                            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors border ${isSelectionMode
                                ? 'bg-[var(--chip-bg)] text-[var(--text)] border-[var(--chip-border)] hover:bg-[var(--border)]'
                                : 'bg-[var(--card-bg)] text-[var(--text)] border-[var(--border)] hover:bg-[var(--surface-2)]'
                                }`}
                        >
                            {isSelectionMode ? 'キャンセル' : '選択'}
                        </button>
                    </div>
                }
            />

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
                {sortedNotes.map((note) => (
                    <div key={note.id} className="relative group block h-full">
                        {/* Selection Overlay / Checkbox */}
                        {isSelectionMode && (
                            <div
                                onClick={() => toggleSelection(note.id)}
                                className="absolute inset-0 z-10 cursor-pointer"
                            >
                                <div className={`absolute top-2 left-2 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${selectedIds.includes(note.id)
                                    ? 'bg-blue-600 border-blue-600'
                                    : 'bg-[var(--card-bg)]/80 border-[var(--border)]'
                                    }`}>
                                    {selectedIds.includes(note.id) && (
                                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className={`block h-full ${!isSelectionMode ? '' : 'pointer-events-none'}`}>
                            {isSelectionMode ? (
                                <div className="h-full">
                                    <WineCardContent note={note} />
                                </div>
                            ) : (
                                <Link href={`/wines/${note.id}`} className="block h-full">
                                    <WineCardContent note={note} />
                                </Link>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </ContentContainer>
    );
}

function isSortKey(value: string): value is SortKey {
    return value === 'date' || value === 'price' || value === 'rating' || value === 'wine_name';
}

function isSortOrder(value: string): value is SortOrder {
    return value === 'asc' || value === 'desc';
}

function WineCardContent({ note }: { note: TastingNote }) {
    const displayDate = formatDate(note.date);

    return (
        <Card className="overflow-hidden flex flex-col h-full transition-transform duration-200 hover:-translate-y-1 hover:shadow-md">
            <div className="relative aspect-[3/3.2] w-full bg-[var(--surface-2)]">
                {(note.images?.[0]?.thumbnail_url || note.images?.[0]?.url || note.image_url) ? (
                    <Image
                        src={note.images?.[0]?.thumbnail_url || note.images?.[0]?.url || note.image_url || ''}
                        alt={note.wine_name || "Wine Image"}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 50vw, 33vw"
                    />
                ) : (
                    <div className="flex items-center justify-center h-full text-[var(--text-muted)] opacity-30">
                        <span className="text-4xl">🍷</span>
                    </div>
                )}
                {note.rating && (
                    <div className="absolute top-2 right-2 bg-[var(--card-bg)]/90 backdrop-blur-sm px-2 py-1 rounded-full shadow-sm flex items-center space-x-1 border border-[var(--border)]">
                        <span className="text-yellow-500 text-xs">★</span>
                        <span className="text-xs font-bold text-[var(--text)]">
                            {note.rating}
                        </span>
                    </div>
                )}
                {/* Draft Badge */}
                {note.status === 'draft' && (
                    <div className="absolute top-2 left-2 bg-yellow-100/90 dark:bg-yellow-900/50 backdrop-blur-sm px-2 py-1 rounded-full shadow-sm flex items-center space-x-1 border border-yellow-200 dark:border-yellow-800">
                        <span className="text-yellow-700 dark:text-yellow-200 text-xs font-bold">編集中</span>
                    </div>
                )}
            </div>

            <div className="p-3 flex flex-col flex-grow bg-[var(--card-bg)]">
                <h3 className="font-semibold text-[var(--text)] text-sm line-clamp-2 mb-1">
                    {note.wine_name || "名称未設定"}
                </h3>

                <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] mb-1">
                    {note.country && (
                        <span title={note.country}>{getCountryFlag(note.country)}</span>
                    )}
                    {note.wine_type && (
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${getWineTypeStyle(note.wine_type)}`}>
                            {note.wine_type}
                        </span>
                    )}
                </div>

                {note.vintage && (
                    <p className="text-xs text-[var(--text-muted)] mb-0.5">{note.vintage}</p>
                )}

                {note.price && (
                    <p className="text-xs text-[var(--text-muted)] mb-1">
                        ¥{note.price.toLocaleString()}
                    </p>
                )}

                <div className="mt-auto pt-2 border-t border-[var(--border)] flex justify-between items-center text-[10px] text-[var(--text-muted)]">
                    <span suppressHydrationWarning>
                        {displayDate || "-"}
                    </span>
                </div>
            </div>
        </Card>
    );
}

function formatDate(date?: string) {
    if (!date) return "";

    const dateOnly = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnly) {
        return `${Number(dateOnly[1])}/${Number(dateOnly[2])}/${Number(dateOnly[3])}`;
    }

    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return "";
    return parsed.toLocaleDateString("ja-JP");
}

function getCountryFlag(countryName: string): string {
    const countryMap: { [key: string]: string } = {
        "フランス": "🇫🇷",
        "イタリア": "🇮🇹",
        "スペイン": "🇪🇸",
        "ドイツ": "🇩🇪",
        "アメリカ": "🇺🇸",
        "チリ": "🇨🇱",
        "アルゼンチン": "🇦🇷",
        "オーストラリア": "🇦🇺",
        "ニュージーランド": "🇳🇿",
        "南アフリカ": "🇿🇦",
        "ポルトガル": "🇵🇹",
        "日本": "🇯🇵",
        "France": "🇫🇷",
        "Italy": "🇮🇹",
        "Spain": "🇪🇸",
        "Germany": "🇩🇪",
        "USA": "🇺🇸",
        "Chile": "🇨🇱",
        "Argentina": "🇦🇷",
        "Australia": "🇦🇺",
        "New Zealand": "🇳🇿",
        "South Africa": "🇿🇦",
        "Portugal": "🇵🇹",
        "Japan": "🇯🇵",
    };
    return countryMap[countryName] || "🏳️";
}


function getWineTypeStyle(type: string): string {
    const t = type.toLowerCase();
    if (t.includes('赤') || t.includes('red')) {
        return "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-200 border border-red-200 dark:border-red-800";
    }
    if (t.includes('白') || t.includes('white') || t.includes('sparkli') || t.includes('発泡')) {
        if (t.includes('ロゼ') || t.includes('rose') || t.includes('rosé')) {
            return "bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-200 border border-pink-200 dark:border-pink-800";
        }
        return "bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-200 border border-yellow-200 dark:border-yellow-800";
    }
    if (t.includes('ロゼ') || t.includes('rose') || t.includes('rosé')) {
        return "bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-200 border border-pink-200 dark:border-pink-800";
    }
    if (t.includes('オレンジ') || t.includes('orange')) {
        return "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-200 border border-orange-200 dark:border-orange-800";
    }
    return "bg-[var(--chip-bg)] text-[var(--chip-text)] border border-[var(--chip-border)]";
}
