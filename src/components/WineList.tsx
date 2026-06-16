'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { TastingNote } from '@/types/custom';
import { bulkDeleteWines } from '@/app/actions/wine';
import { ContentContainer } from '@/components/layout/ContentContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Chip, WineImageFrame } from '@/components/ui/primitives';
import { WineImageLightbox, type ExpandedWineImage } from '@/components/WineImageLightbox';
import { BUTTON_PRIMARY, BUTTON_SECONDARY, FORM_CONTROL_BASE } from '@/constants/styles';
import { isProtectedImageUrl } from '@/lib/protectedImage';
import { cn } from '@/lib/utils';
import { Plus, Search, Trash2, ZoomIn } from 'lucide-react';

interface WineListProps {
    notes: TastingNote[];
}

type SortKey = 'date' | 'price' | 'rating' | 'wine_name';
type SortOrder = 'asc' | 'desc';
type QuickFilter = 'all' | 'red' | 'white' | 'sparkling' | 'bourgogne' | 'france' | 'ai';

const quickFilters: Array<{ key: QuickFilter; label: string }> = [
    { key: 'all', label: 'すべて' },
    { key: 'red', label: '赤' },
    { key: 'white', label: '白' },
    { key: 'sparkling', label: '泡' },
    { key: 'bourgogne', label: 'ブルゴーニュ' },
    { key: 'france', label: 'フランス' },
    { key: 'ai', label: 'AI分析済み' },
];

export default function WineList({ notes }: WineListProps) {
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [isDeleting, setIsDeleting] = useState(false);
    const [expandedImage, setExpandedImage] = useState<ExpandedWineImage | null>(null);

    // Sort State
    const [sortKey, setSortKey] = useState<SortKey>('date');
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

    // Filter State
    const [filterStatus, setFilterStatus] = useState<'all' | 'draft'>('all');
    const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');
    const [searchQuery, setSearchQuery] = useState('');

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
    const normalizedSearch = searchQuery.trim().toLowerCase();

    const filteredNotes = notes.filter((note) => {
        if (filterStatus === 'draft') {
            if (note.status !== 'draft') return false;
        }

        if (!matchesQuickFilter(note, quickFilter)) return false;
        if (!normalizedSearch) return true;

        return [
            note.wine_name,
            note.producer,
            note.country,
            note.region,
            note.locality,
            note.main_variety,
            note.other_varieties,
            note.vintage,
        ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(normalizedSearch);
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
                title="ワイン一覧"
                subtitle="ラベルと記憶から、過去のテイスティングを探す"
                actions={
                    <div className="flex w-full flex-wrap justify-end gap-2 md:w-auto">
                        <Link href="/" className={BUTTON_PRIMARY}>
                            <Plus size={16} />
                            記録を追加
                        </Link>
                        {isSelectionMode && selectedIds.length > 0 && (
                            <button
                                onClick={handleBulkDelete}
                                disabled={isDeleting}
                                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[var(--color-error)]/35 bg-[var(--color-error-solid)]/10 px-4 py-2 text-sm font-semibold text-[var(--color-error)] transition-colors hover:bg-[var(--color-error-solid)]/15 disabled:opacity-50"
                            >
                                <Trash2 size={16} />
                                {isDeleting ? '削除中...' : `${selectedIds.length}件を削除`}
                            </button>
                        )}
                        <button
                            onClick={toggleSelectionMode}
                            className={cn(
                                BUTTON_SECONDARY,
                                isSelectionMode && 'border-[var(--primary)]/35 bg-[var(--color-wine-red-soft)] text-[var(--text)]'
                            )}
                        >
                            {isSelectionMode ? 'キャンセル' : '選択'}
                        </button>
                    </div>
                }
            />

            <div className="mb-6 space-y-4 rounded-lg border border-[var(--border)] bg-[var(--card-bg)] p-3 md:p-4">
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
                    <label className="relative block">
                        <span className="sr-only">ワインを検索</span>
                        <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                        <input
                            className={`${FORM_CONTROL_BASE} pl-10`}
                            placeholder="ワイン名、生産者、産地、品種で検索"
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                        />
                    </label>

                    <select
                        className={`${FORM_CONTROL_BASE} lg:w-44`}
                        onChange={(e) => setFilterStatus(e.target.value as 'all' | 'draft')}
                        value={filterStatus}
                    >
                        <option value="all">すべて表示</option>
                        <option value="draft">下書きのみ</option>
                    </select>

                    <select
                        className={`${FORM_CONTROL_BASE} lg:w-48`}
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
                </div>

                <div className="flex flex-wrap gap-2">
                    {quickFilters.map((filter) => {
                        const active = quickFilter === filter.key;
                        return (
                            <button
                                key={filter.key}
                                type="button"
                                onClick={() => setQuickFilter(filter.key)}
                                className={cn(
                                    "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                                    active
                                        ? "border-[var(--primary)]/35 bg-[var(--color-wine-red-soft)] text-[var(--text)]"
                                        : "border-[var(--border)] bg-[var(--chip-bg)] text-[var(--chip-text)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
                                )}
                                aria-pressed={active}
                            >
                                {filter.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {sortedNotes.length === 0 ? (
                <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--card-bg)] px-5 py-12 text-center">
                    <p className="text-base font-semibold text-[var(--text)]">該当するワインがありません</p>
                    <p className="mt-2 text-sm text-[var(--text-muted)]">検索条件やフィルターを変更してください。</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-4 2xl:grid-cols-5">
                    {sortedNotes.map((note) => (
                        <div key={note.id} className="relative group block h-full">
                            {/* Selection Overlay / Checkbox */}
                            {isSelectionMode && (
                                <div
                                    onClick={() => toggleSelection(note.id)}
                                    className="absolute inset-0 z-10 cursor-pointer"
                                >
                                    <div className={`absolute top-3 left-3 w-7 h-7 rounded-full border-2 flex items-center justify-center transition-colors ${selectedIds.includes(note.id)
                                        ? 'bg-[var(--primary)] border-[var(--primary)]'
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
                                <WineCardContent
                                    note={note}
                                    isInteractive={!isSelectionMode}
                                    onImageOpen={setExpandedImage}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            )}
            <WineImageLightbox image={expandedImage} onClose={() => setExpandedImage(null)} />
        </ContentContainer>
    );
}

function isSortKey(value: string): value is SortKey {
    return value === 'date' || value === 'price' || value === 'rating' || value === 'wine_name';
}

function isSortOrder(value: string): value is SortOrder {
    return value === 'asc' || value === 'desc';
}

function WineCardContent({
    note,
    isInteractive = false,
    onImageOpen,
}: {
    note: TastingNote;
    isInteractive?: boolean;
    onImageOpen?: (image: ExpandedWineImage) => void;
}) {
    const displayDate = formatDate(note.date);
    const imageSrc = note.images?.[0]?.thumbnail_url || note.images?.[0]?.url || note.image_url || '';
    const fullImageSrc = note.images?.[0]?.url || note.image_url || imageSrc;
    const imageAlt = note.wine_name || "ワインラベル";
    const regionLine = [note.country, note.region || note.locality, note.main_variety].filter(Boolean).join(' · ');
    const hasAi = Boolean(note.ai_explanation_id);
    const body = (
        <>
            <h3 className="font-wine mb-1 line-clamp-2 text-base font-semibold leading-snug text-[var(--text)] md:text-lg">
                {note.wine_name || "名称未設定"}
            </h3>

            {note.producer && (
                <p className="mb-2 line-clamp-1 text-sm text-[var(--text-soft)]">{note.producer}</p>
            )}

            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
                {note.wine_type && (
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${getWineTypeStyle(note.wine_type)}`}>
                        {note.wine_type}
                    </span>
                )}
                {note.vintage && <span>{note.vintage}</span>}
            </div>

            <p className="mb-3 line-clamp-2 min-h-9 text-xs leading-5 text-[var(--text-muted)]">
                {regionLine || "産地・品種未設定"}
            </p>

            <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-[var(--border-subtle)] pt-3 text-xs text-[var(--text-muted)]">
                {note.rating ? <span className="text-[var(--text-soft)]">★ {note.rating}</span> : null}
                {note.price ? <span>¥{note.price.toLocaleString()}</span> : null}
                {hasAi ? <Chip tone="gold" className="px-2 py-0.5">AI分析済み</Chip> : null}
                <span className="ml-auto" suppressHydrationWarning>{displayDate || "-"}</span>
            </div>
        </>
    );

    return (
        <Card className="flex h-full flex-col overflow-hidden transition-transform duration-200 hover:-translate-y-1 hover:border-[var(--color-gold)]/45">
            <div className="relative bg-[var(--input-bg)] p-3">
                {isInteractive && fullImageSrc && onImageOpen ? (
                    <button
                        type="button"
                        onClick={() => onImageOpen({ src: fullImageSrc, alt: imageAlt })}
                        className="group/image relative block w-full cursor-zoom-in rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--input-bg)]"
                        aria-label={`${imageAlt}を拡大`}
                    >
                        <WineImageFrame
                            src={imageSrc}
                            alt={imageAlt}
                            className="aspect-square border-[var(--border-subtle)]"
                            imageClassName="object-cover p-0"
                            unoptimized={isProtectedImageUrl(imageSrc)}
                        />
                        <span className="absolute bottom-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/45 text-white opacity-0 shadow-sm backdrop-blur-sm transition-opacity group-hover/image:opacity-100 group-focus-visible/image:opacity-100">
                            <ZoomIn size={16} />
                        </span>
                    </button>
                ) : (
                    <WineImageFrame
                        src={imageSrc}
                        alt={imageAlt}
                        className="aspect-square border-[var(--border-subtle)]"
                        imageClassName="object-cover p-0"
                        unoptimized={isProtectedImageUrl(imageSrc)}
                    />
                )}
                {note.rating && (
                    <div className="absolute top-5 right-5 flex items-center space-x-1 rounded-full border border-[var(--color-gold)]/35 bg-[var(--card-bg)]/90 px-2 py-1 shadow-sm backdrop-blur-sm">
                        <span className="text-xs text-[var(--color-gold)]">★</span>
                        <span className="text-xs font-bold text-[var(--text)]">
                            {note.rating}
                        </span>
                    </div>
                )}
                {/* Draft Badge */}
                {note.status === 'draft' && (
                    <Chip tone="gold" className="absolute left-5 top-5 bg-[var(--card-bg)]/90 backdrop-blur-sm">編集中</Chip>
                )}
            </div>

            {isInteractive ? (
                <Link
                    href={`/wines/${note.id}`}
                    className="flex flex-grow flex-col bg-[var(--card-bg)] p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-inset"
                >
                    {body}
                </Link>
            ) : (
                <div className="flex flex-grow flex-col bg-[var(--card-bg)] p-4">
                    {body}
                </div>
            )}
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

function getWineTypeStyle(type: string): string {
    const t = type.toLowerCase();
    if (t.includes('赤') || t.includes('red')) {
        return "bg-[var(--color-wine-red-soft)] text-[var(--text)] border border-[var(--primary)]/25";
    }
    if (t.includes('白') || t.includes('white') || t.includes('sparkli') || t.includes('発泡')) {
        if (t.includes('ロゼ') || t.includes('rose') || t.includes('rosé')) {
            return "bg-[var(--color-wine-red-soft)] text-[var(--text-soft)] border border-[var(--primary)]/20";
        }
        return "bg-[var(--color-gold-soft)] text-[var(--text)] border border-[var(--color-gold)]/25";
    }
    if (t.includes('ロゼ') || t.includes('rose') || t.includes('rosé')) {
        return "bg-[var(--color-wine-red-soft)] text-[var(--text-soft)] border border-[var(--primary)]/20";
    }
    if (t.includes('オレンジ') || t.includes('orange')) {
        return "bg-[var(--color-gold-soft)] text-[var(--text)] border border-[var(--color-gold)]/25";
    }
    return "bg-[var(--chip-bg)] text-[var(--chip-text)] border border-[var(--chip-border)]";
}

function matchesQuickFilter(note: TastingNote, filter: QuickFilter) {
    if (filter === 'all') return true;

    const type = (note.wine_type || '').toLowerCase();
    const locationText = [note.country, note.region, note.locality, note.locality_vocab?.name, note.locality_vocab?.name_ja]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

    if (filter === 'red') return type.includes('赤') || type.includes('red');
    if (filter === 'white') return type.includes('白') || type.includes('white');
    if (filter === 'sparkling') return type.includes('泡') || type.includes('発泡') || type.includes('sparkling');
    if (filter === 'bourgogne') return locationText.includes('ブルゴーニュ') || locationText.includes('bourgogne') || locationText.includes('burgundy');
    if (filter === 'france') return locationText.includes('フランス') || locationText.includes('france');
    if (filter === 'ai') return Boolean(note.ai_explanation_id);

    return true;
}
