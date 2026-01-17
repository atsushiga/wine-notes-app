'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { TastingNote } from '@/types/custom';
import { bulkDeleteWines } from '@/app/actions/wine';

interface WineListProps {
    notes: TastingNote[];
}

export default function WineList({ notes }: WineListProps) {
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [isDeleting, setIsDeleting] = useState(false);

    // Sort State
    const [sortKey, setSortKey] = useState<'created_at' | 'price' | 'rating' | 'wine_name'>('created_at');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

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
    const sortedNotes = [...notes].sort((a, b) => {
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
        setSortKey(key as any);
        setSortOrder(order as any);
    };

    return (
        <div className="space-y-6 pb-24">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center px-2 pt-2 gap-4">
                <h1 className="text-2xl font-bold text-gray-900">
                    ワイン記録一覧
                </h1>
                <div className="flex flex-wrap gap-2 w-full md:w-auto justify-end">

                    {/* Sort Dropdown */}
                    <select
                        className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        onChange={handleSortChange}
                        defaultValue="created_at-desc"
                    >
                        <option value="created_at-desc">日付 (新しい順)</option>
                        <option value="created_at-asc">日付 (古い順)</option>
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
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${isSelectionMode
                            ? 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                            : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                            }`}
                    >
                        {isSelectionMode ? 'キャンセル' : '選択'}
                    </button>
                </div>
            </div>

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
                                    : 'bg-white/80 border-gray-300'
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
        </div>
    );
}

function WineCardContent({ note }: { note: TastingNote }) {
    return (
        <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 flex flex-col h-full transition-transform duration-200 hover:-translate-y-1 hover:shadow-md">
            <div className="relative aspect-[3/3.2] w-full bg-gray-100">
                {note.image_url ? (
                    <Image
                        src={note.image_url}
                        alt={note.wine_name || "Wine Image"}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 50vw, 33vw"
                    />
                ) : (
                    <div className="flex items-center justify-center h-full text-gray-300">
                        <span className="text-4xl">🍷</span>
                    </div>
                )}
                {note.rating && (
                    <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-full shadow-sm flex items-center space-x-1">
                        <span className="text-yellow-500 text-xs">★</span>
                        <span className="text-xs font-bold text-gray-800">
                            {note.rating}
                        </span>
                    </div>
                )}
            </div>

            <div className="p-3 flex flex-col flex-grow">
                <h3 className="font-semibold text-gray-900 text-sm line-clamp-2 mb-1">
                    {note.wine_name || "名称未設定"}
                </h3>

                <div className="flex items-center gap-2 text-xs text-gray-600 mb-1">
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
                    <p className="text-xs text-gray-500 mb-0.5">{note.vintage}</p>
                )}

                {note.price && (
                    <p className="text-xs text-gray-500 mb-1">
                        ¥{note.price.toLocaleString()}
                    </p>
                )}

                <div className="mt-auto pt-2 border-t border-gray-50 flex justify-between items-center text-[10px] text-gray-400">
                    <span suppressHydrationWarning>
                        {new Date(note.created_at).toLocaleDateString("ja-JP")}
                    </span>
                </div>
            </div>
        </div>
    );
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
        return "bg-red-100 text-red-700";
    }
    if (t.includes('白') || t.includes('white') || t.includes('sparkli') || t.includes('発泡')) {
        if (t.includes('ロゼ') || t.includes('rose') || t.includes('rosé')) {
            return "bg-pink-100 text-pink-700";
        }
        return "bg-yellow-50 text-yellow-700 border border-yellow-100";
    }
    if (t.includes('ロゼ') || t.includes('rose') || t.includes('rosé')) {
        return "bg-pink-100 text-pink-700";
    }
    if (t.includes('オレンジ') || t.includes('orange')) {
        return "bg-orange-100 text-orange-700";
    }
    return "bg-gray-100 text-gray-600";
}
