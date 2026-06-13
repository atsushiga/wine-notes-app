'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    ArrowLeft,
    ExternalLink,
    History,
    Loader2,
    Pencil,
    Sparkles,
    Trash2,
} from 'lucide-react';

import { generateVisualWineExplanation } from '@/app/actions/gemini';
import { saveAiExplanation } from '@/app/actions/aiExplainer';
import {
    createAiExplainerInputFromTastingNote,
    getAiExplainerClientKey,
    saveCurrentAiExplanationId,
} from '@/lib/aiExplainerStorage';
import { isProtectedImageUrl } from '@/lib/protectedImage';
import {
    colorLabel,
    finishLenLabel,
    fruitStateLabel,
    intensityLabel,
    noseIntensityLabel,
    oakAromaLabel,
    palateElementLabel,
    qualityLabel,
    round1,
    worldLabel,
} from '@/lib/wineHelpers';
import { BUTTON_PRIMARY, BUTTON_SECONDARY } from '@/constants/styles';
import { cn } from '@/lib/utils';
import { TastingNote } from '@/types/custom';

import AiWineInfo from './AiWineInfo';
import ImageCarousel from './ImageCarousel';
import { Chip, MetricCard, WineImageFrame } from './ui/primitives';

interface Props {
    wine: TastingNote;
    onEdit: () => void;
    onDelete: () => void;
    isDeleting: boolean;
    onOptimizeImage?: () => void;
    isOptimizingImage?: boolean;
}

export default function WineDetailView({
    wine,
    onEdit,
    onDelete,
    isDeleting,
    onOptimizeImage,
    isOptimizingImage = false,
}: Props) {
    const router = useRouter();
    const [isGeneratingAi, setIsGeneratingAi] = useState(false);
    const wineType = wine.wine_type || '';
    const hasOptimizableImage = Boolean(wine.images?.some((image) => image.url) || wine.image_url);
    const imageSrc = wine.images?.[0]?.thumbnail_url || wine.images?.[0]?.url || wine.image_url || '';
    const region = [wine.country, wine.locality || wine.region].filter(Boolean).join(' / ');
    const varieties = [wine.main_variety, wine.other_varieties].filter(Boolean).join(', ');

    const isRed = wineType === '赤';
    const isWhite = wineType === '白';
    const isRose = wineType === 'ロゼ';
    const isOrange = wineType === 'オレンジ';
    const isSparklingWhite = wineType === '発泡白';
    const isSparklingRose = wineType === '発泡ロゼ';

    const renderScore = (value: number | undefined, labelFn: (v: number) => string) => {
        if (value === undefined || value === null) return '-';
        return `${round1(value)} (${labelFn(value)})`;
    };

    const getRimRatioLabel = (val: number | undefined) => {
        if (val === undefined || val === null) return '-';
        const v = round1(val);
        const comp = round1(10 - v);
        let labelLeft = '';
        let labelRight = '';
        if (isRed) {
            labelLeft = '紫';
            labelRight = 'オレンジ';
        } else if (isWhite || isSparklingWhite) {
            labelLeft = 'グリーン';
            labelRight = 'ゴールド';
        } else if (isRose || isSparklingRose) {
            labelLeft = 'ピンク';
            labelRight = 'オレンジ';
        } else if (isOrange) {
            labelLeft = '黄金';
            labelRight = 'ブロンズ';
        } else {
            labelLeft = '紫';
            labelRight = 'オレンジ';
        }
        return `${labelLeft} ${comp.toFixed(1)} : ${labelRight} ${v.toFixed(1)}`;
    };

    const handleGenerateAiExplanation = async () => {
        if (!wine.wine_name) {
            alert('ワイン名がないためAI解説を生成できません。');
            return;
        }

        setIsGeneratingAi(true);
        try {
            const input = createAiExplainerInputFromTastingNote(wine);
            const explanation = await generateVisualWineExplanation({
                name: input.wineName,
                producer: input.producer || undefined,
                vintage: input.vintage || undefined,
                country: input.country || undefined,
                locality: input.locality || undefined,
                referenceUrl: wine.reference_url || undefined,
                price: input.price || undefined,
            });
            const stored = await saveAiExplanation(
                {
                    generatedAt: new Date().toISOString(),
                    imageUrl: input.imageUrl,
                    input,
                    explanation,
                },
                getAiExplainerClientKey()
            );

            saveCurrentAiExplanationId(stored.id);
            router.push(`/ai-explainer/result?historyId=${encodeURIComponent(stored.id)}`);
        } catch (error) {
            console.error(error);
            alert('AI解説の生成に失敗しました。時間をおいてもう一度お試しください。');
        } finally {
            setIsGeneratingAi(false);
        }
    };

    return (
        <div className="mx-auto max-w-7xl px-4 py-6 pb-32 md:px-8 md:py-8">
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Link
                    href="/tasting-notes"
                    className="inline-flex items-center gap-2 text-sm font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
                >
                    <ArrowLeft size={16} />
                    一覧に戻る
                </Link>
                <span className="text-xs text-[var(--text-muted)]" suppressHydrationWarning>
                    記録作成日 {formatDate(wine.created_at)}
                </span>
            </div>

            <section className="grid gap-6 lg:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.45fr)]">
                <div className="space-y-3">
                    <div className="rounded-lg border border-[var(--border)] bg-[var(--card-bg)] p-3 shadow-[0_18px_60px_rgba(0,0,0,0.22)]">
                        {wine.images && wine.images.length > 0 ? (
                            <ImageCarousel images={wine.images} wineName={wine.wine_name || 'Wine'} />
                        ) : (
                            <WineImageFrame
                                src={imageSrc}
                                alt={wine.wine_name || 'ワインラベル'}
                                className="aspect-[3/4]"
                                imageClassName="object-contain p-4"
                                unoptimized={isProtectedImageUrl(imageSrc)}
                            />
                        )}
                    </div>

                    {hasOptimizableImage && onOptimizeImage ? (
                        <button
                            type="button"
                            onClick={onOptimizeImage}
                            disabled={isOptimizingImage}
                            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-[var(--color-gold)]/35 bg-[var(--color-gold-soft)] px-4 py-2 text-sm font-semibold text-[var(--text)] transition-colors hover:bg-[var(--surface-2)] disabled:opacity-50"
                        >
                            {isOptimizingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-[var(--color-gold)]" />}
                            AI画像補正
                        </button>
                    ) : null}
                </div>

                <div className="flex flex-col justify-between gap-6 rounded-lg border border-[var(--border)] bg-[var(--card-bg)] p-5 md:p-6">
                    <div>
                        <div className="mb-4 flex flex-wrap gap-2">
                            {wineType ? <Chip tone="wine">{wineType}</Chip> : null}
                            {wine.vintage ? <Chip tone="gold">{wine.vintage}</Chip> : null}
                            {wine.ai_explanation_id ? <Chip tone="gold">AI分析済み</Chip> : null}
                        </div>

                        <h1 className="font-wine text-3xl font-semibold leading-tight tracking-normal text-[var(--text)] md:text-5xl">
                            {wine.wine_name || '名称未設定'}
                        </h1>
                        {wine.producer ? (
                            <p className="mt-3 text-lg text-[var(--text-soft)]">{wine.producer}</p>
                        ) : null}
                        <p className="mt-4 max-w-3xl text-sm leading-6 text-[var(--text-muted)]">
                            {[region, varieties, wine.date ? `テイスティング: ${formatDate(wine.date)}` : ''].filter(Boolean).join(' · ') || '基本情報はまだ十分に入力されていません。'}
                        </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                        <MetricCard
                            label="総合評価"
                            value={wine.rating ? `★ ${round1(wine.rating)}` : '-'}
                            detail={wine.quality_score ? `品質 ${renderScore(wine.quality_score, qualityLabel)}` : '未評価'}
                            accent="gold"
                        />
                        <MetricCard
                            label="飲み頃"
                            value={<span className="text-xl">{wine.readiness || '-'}</span>}
                            detail={wine.vintage ? `${wine.vintage} vintage` : 'ヴィンテージ未設定'}
                            accent="neutral"
                        />
                        <MetricCard
                            label="価格"
                            value={wine.price ? `¥${wine.price.toLocaleString()}` : '-'}
                            detail={wine.place || '購入場所未設定'}
                            accent="neutral"
                        />
                    </div>

                    <div className="flex flex-wrap gap-2 border-t border-[var(--border-subtle)] pt-5">
                        <button
                            type="button"
                            onClick={handleGenerateAiExplanation}
                            disabled={isGeneratingAi || !wine.wine_name}
                            className={BUTTON_PRIMARY}
                        >
                            {isGeneratingAi ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                            AI解説を生成
                        </button>
                        <button type="button" onClick={onEdit} className={BUTTON_SECONDARY}>
                            <Pencil size={16} />
                            編集
                        </button>
                        <button
                            type="button"
                            onClick={onDelete}
                            disabled={isDeleting}
                            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[var(--color-error)]/35 bg-transparent px-4 py-2 text-sm font-semibold text-[var(--color-error)] transition-colors hover:bg-[var(--color-error)]/10 disabled:opacity-50"
                        >
                            {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                            {isDeleting ? '削除中...' : '削除'}
                        </button>
                    </div>
                </div>
            </section>

            {wine.ai_explanation_id ? (
                <section className="mt-6 rounded-lg border border-[var(--color-gold)]/35 bg-[var(--color-gold-soft)] p-4 md:flex md:items-center md:justify-between">
                    <div>
                        <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
                            <History size={16} className="text-[var(--color-gold)]" />
                            AI Analysis
                        </h2>
                        <p className="mt-1 text-sm text-[var(--text-soft)]">
                            このワインには生成済みのAI解説があります。自分の記録とは分けて、調査レポートとして確認できます。
                        </p>
                    </div>
                    <Link
                        href={`/ai-explainer/result?historyId=${encodeURIComponent(wine.ai_explanation_id)}`}
                        className={cn(BUTTON_SECONDARY, 'mt-4 md:mt-0')}
                    >
                        AI解説を見る
                        <ExternalLink size={15} />
                    </Link>
                </section>
            ) : null}

            <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]">
                <div className="space-y-8">
                    <RecordSection title="総評" description="自分の評価と飲んだ時の印象">
                        <div className="space-y-4">
                            {wine.notes ? (
                                <p className="whitespace-pre-wrap text-sm leading-7 text-[var(--text)]">{wine.notes}</p>
                            ) : (
                                <EmptyText>総評は未入力です。</EmptyText>
                            )}
                            {wine.vivino_url ? (
                                <a
                                    href={wine.vivino_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 text-sm font-medium text-[var(--primary)] hover:underline"
                                >
                                    Vivinoで見る
                                    <ExternalLink size={14} />
                                </a>
                            ) : null}
                        </div>
                    </RecordSection>

                    <RecordSection title="基本情報" description="購入・産地・品種などの記録">
                        <DefinitionGrid>
                            <InfoRow label="ヴィンテージ" value={wine.vintage} />
                            <InfoRow label="生産者" value={wine.producer} />
                            <InfoRow label="輸入元" value={wine.importer} />
                            <InfoRow label="国 / 地域" value={region} detail={wine.locality_vocab?.name} />
                            <InfoRow label="品種" value={varieties} />
                            <InfoRow label="価格" value={wine.price ? `¥${wine.price.toLocaleString()}` : ''} />
                            <InfoRow label="参考URL" value={wine.reference_url} link />
                        </DefinitionGrid>
                    </RecordSection>

                    <RecordSection title="外観" description="色調、濃淡、清澄度">
                        <DefinitionGrid>
                            <InfoRow label="濃淡" value={renderScore(wine.intensity, intensityLabel)} />
                            <InfoRow label="色調" value={renderScore(wine.color, (v) => colorLabel(v, wineType))} />
                            <InfoRow label="縁の色調" value={getRimRatioLabel(wine.rim_ratio)} />
                            <InfoRow label="清澄度" value={wine.clarity} />
                            <InfoRow label="輝き" value={wine.brightness} />
                            <InfoRow label="泡の強さ" value={wine.sparkle_intensity} />
                        </DefinitionGrid>
                        {wine.appearance_other ? <NoteText>{wine.appearance_other}</NoteText> : null}
                    </RecordSection>

                    <RecordSection title="香り" description="状態、強さ、アロマ、発達段階">
                        <DefinitionGrid>
                            <InfoRow label="コンディション" value={wine.nose_condition} />
                            <InfoRow label="強さ" value={renderScore(wine.nose_intensity, noseIntensityLabel)} />
                            <InfoRow label="熟成段階" value={wine.development} />
                            <InfoRow label="樽香" value={renderScore(wine.oak_aroma, oakAromaLabel)} />
                            {(isRed || isRose || isOrange) ? (
                                <>
                                    <InfoRow label="旧/新世界" value={renderScore(wine.old_new_world, worldLabel)} />
                                    <InfoRow label="果実の状態" value={renderScore(wine.fruits_maturity, fruitStateLabel)} />
                                </>
                            ) : null}
                            {isWhite ? <InfoRow label="ニュートラル/アロマティック" value={wine.aroma_neutrality ? `${round1(wine.aroma_neutrality)}` : ''} /> : null}
                        </DefinitionGrid>
                        {wine.aromas && wine.aromas.length > 0 ? (
                            <div className="mt-5">
                                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.06em] text-[var(--text-muted)]">Aromas</p>
                                <div className="flex flex-wrap gap-2">
                                    {wine.aromas.map((aroma) => (
                                        <Chip key={aroma}>{aroma}</Chip>
                                    ))}
                                </div>
                            </div>
                        ) : null}
                        {wine.aroma_other ? <NoteText>{wine.aroma_other}</NoteText> : null}
                    </RecordSection>

                    <RecordSection title="味わい" description="甘味、酸味、タンニン、ボディ、余韻">
                        <DefinitionGrid>
                            <InfoRow label="甘味" value={renderScore(wine.sweetness, (v) => palateElementLabel(v, 'sweetness'))} />
                            <InfoRow label="酸味" value={renderScore(wine.acidity_score, (v) => palateElementLabel(v, 'acidity'))} />
                            {(isRed || isOrange) ? <InfoRow label="タンニン" value={renderScore(wine.tannin_score, (v) => palateElementLabel(v, 'tannin'))} /> : null}
                            <InfoRow label="ボディ" value={renderScore(wine.body_score, (v) => palateElementLabel(v, 'body'))} />
                            <InfoRow label="余韻" value={renderScore(wine.finish_score, finishLenLabel)} />
                            <InfoRow label="アルコール度数" value={wine.alcohol_abv ? `${round1(wine.alcohol_abv)}%` : ''} />
                        </DefinitionGrid>
                        {wine.palate_notes ? <NoteText>{wine.palate_notes}</NoteText> : null}
                    </RecordSection>

                    {wine.additional_info ? (
                        <RecordSection title="補足情報">
                            <p className="whitespace-pre-wrap text-sm leading-7 text-[var(--text)]">{wine.additional_info}</p>
                        </RecordSection>
                    ) : null}
                </div>

                <aside className="lg:sticky lg:top-8 lg:self-start">
                    <AiWineInfo wine={wine} />
                </aside>
            </div>
        </div>
    );
}

function RecordSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
    return (
        <section className="border-t border-[var(--border)] pt-6 first:border-t-0 first:pt-0">
            <div className="mb-4">
                <h2 className="text-lg font-semibold text-[var(--text)]">{title}</h2>
                {description ? <p className="mt-1 text-sm text-[var(--text-muted)]">{description}</p> : null}
            </div>
            {children}
        </section>
    );
}

function DefinitionGrid({ children }: { children: ReactNode }) {
    return <dl className="grid gap-3 sm:grid-cols-2">{children}</dl>;
}

function InfoRow({ label, value, detail, link = false }: { label: string; value?: ReactNode; detail?: ReactNode; link?: boolean }) {
    const isEmpty = value === undefined || value === null || value === '';
    return (
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-3">
            <dt className="text-xs font-medium text-[var(--text-muted)]">{label}</dt>
            <dd className="mt-1 break-words text-sm font-medium text-[var(--text)]">
                {isEmpty ? (
                    '-'
                ) : link && typeof value === 'string' ? (
                    <a href={value} target="_blank" rel="noopener noreferrer" className="text-[var(--primary)] hover:underline">
                        {value}
                    </a>
                ) : (
                    value
                )}
            </dd>
            {detail ? <dd className="mt-1 text-xs text-[var(--text-muted)]">{detail}</dd> : null}
        </div>
    );
}

function EmptyText({ children }: { children: ReactNode }) {
    return <p className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-2)] px-4 py-5 text-sm text-[var(--text-muted)]">{children}</p>;
}

function NoteText({ children }: { children: ReactNode }) {
    return <p className="mt-4 whitespace-pre-wrap rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3 text-sm leading-7 text-[var(--text-soft)]">{children}</p>;
}

function formatDate(value?: string) {
    if (!value) return '-';

    const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnly) {
        return `${Number(dateOnly[1])}/${Number(dateOnly[2])}/${Number(dateOnly[3])}`;
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString('ja-JP');
}
