'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TastingNote, WineImage } from '@/types/custom';
import WineDetailView from '@/components/WineDetailView';
import WineForm, { WineFormValues, wineTypes } from '@/components/WineForm';
import { updateWine, deleteWine, updateWineImages } from '@/app/actions/wine';
import { optimizeWineImage } from '@/app/actions/gemini';

type WineType = WineFormValues['wineType'];
type NoseCondition = NonNullable<WineFormValues['noseCondition']>;
type Development = NonNullable<WineFormValues['development']>;

const noseConditionOptions = ['不快 (Unclean)', '良好 (Clean)'] as const satisfies readonly NoseCondition[];
const developmentOptions = ['若い', '熟成中', '熟成した', 'ピークを過ぎた/疲れている'] as const satisfies readonly Development[];

function oneOf<T extends string>(value: unknown, options: readonly T[], fallback: T): T {
    return typeof value === 'string' && options.includes(value as T) ? value as T : fallback;
}

export default function WineDetailClient({ wine }: { wine: TastingNote }) {
    const router = useRouter();
    const [isEditing, setIsEditing] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isOptimizingImage, setIsOptimizingImage] = useState(false);

    const handleUpdate = async (values: WineFormValues) => {
        setIsSubmitting(true);
        try {
            await updateWine(wine.id, values);
            setIsEditing(false);
        } catch (e) {
            console.error(e);
            alert(`更新に失敗しました: ${String(e)}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm('本当に削除しますか？この操作は取り消せません。')) return;

        setIsDeleting(true);
        try {
            await deleteWine(wine.id);
            // Manual redirect on success to avoid "NEXT_REDIRECT" error in try/catch
            router.push('/tasting-notes');
        } catch (e) {
            console.error(e);
            alert(`削除に失敗しました: ${String(e)}`);
            setIsDeleting(false);
        }
    };

    const handleOptimizeImage = async () => {
        const sortedImages = [...(wine.images || [])].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
        const targetUrl = sortedImages[0]?.url || wine.image_url;
        if (!targetUrl) return;

        setIsOptimizingImage(true);
        try {
            const result = await optimizeWineImage(targetUrl);
            const optimized = result.optimizedImage;
            const sourceImage: Partial<WineImage> = sortedImages[0] ?? {
                url: targetUrl,
                thumbnail_url: null,
                storage_path: null,
                display_order: 1,
            };
            const optimizedImage = {
                url: optimized.url,
                thumbnail_url: optimized.thumbnail_url,
                storage_path: optimized.storage_path,
                display_order: 0,
            };
            const remainingImages = sortedImages.slice(1).filter((image) => image.url !== sourceImage.url);
            const nextImages = [optimizedImage, sourceImage, ...remainingImages].map((image, index) => ({
                url: image.url!,
                thumbnail_url: image.thumbnail_url ?? null,
                storage_path: image.storage_path ?? null,
                display_order: index,
            }));

            await updateWineImages(wine.id, optimized.url, nextImages);
            router.refresh();
        } catch (e) {
            console.error(e);
            alert(`画像補正に失敗しました: ${String(e)}`);
        } finally {
            setIsOptimizingImage(false);
        }
    };

    // Mapping TastingNote (snake_case) -> WineFormValues (camelCase)
    // Convert date to YYYY-MM-DD format if it's a timestamp
    const formatDateForInput = (dateStr: string | undefined): string => {
        if (!dateStr) return '';
        // If it's already in YYYY-MM-DD format, return as is
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
        // If it's a timestamp, extract the date part
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return '';
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    };

    const defaultValues: Partial<WineFormValues> = {
        date: formatDateForInput(wine.date),
        place: wine.place || '',
        price: wine.price ? String(wine.price) : '',
        imageUrl: wine.image_url || '',
        images: wine.images || [],

        // Cast strict enums if data exists, otherwise default or let form handle validation
        wineType: oneOf<WineType>(wine.wine_type, wineTypes, '赤'),

        wineName: wine.wine_name || '',
        producer: wine.producer || '',
        country: wine.country || '',
        locality: wine.locality || '',
        region: wine.region || '',
        mainVariety: wine.main_variety || '',
        otherVarieties: wine.other_varieties || '',
        referenceUrl: wine.reference_url || '',
        vintage: wine.vintage || '',
        additionalInfo: wine.additional_info || '',
        importer: wine.importer || '',

        intensity: wine.intensity,
        color: wine.color ?? undefined,
        rimRatio: wine.rim_ratio,
        clarity: wine.clarity || '',
        brightness: wine.brightness || '',
        sparkleIntensity: wine.sparkle_intensity || '',
        appearanceOther: wine.appearance_other || '',

        noseIntensity: wine.nose_intensity,
        noseCondition: oneOf<NoseCondition>(wine.nose_condition, noseConditionOptions, '良好 (Clean)'),
        development: oneOf<Development>(wine.development, developmentOptions, '若い'),
        oldNewWorld: wine.old_new_world,
        aromaNeutrality: wine.aroma_neutrality,
        fruitsMaturity: wine.fruits_maturity,
        oakAroma: wine.oak_aroma,
        aromas: wine.aromas || [],
        aromaOther: wine.aroma_other || '',

        sweetness: wine.sweetness,
        acidityScore: wine.acidity_score,
        tanninScore: wine.tannin_score,
        bodyScore: wine.body_score,
        alcoholABV: wine.alcohol_abv,
        finishScore: wine.finish_score,
        palateNotes: wine.palate_notes || '',

        qualityScore: wine.quality_score,
        readiness: wine.readiness || '今飲めるが熟成可能',
        rating: wine.rating || 0,
        notes: wine.notes || '',
        vivinoUrl: wine.vivino_url || '',
        aiExplanationId: wine.ai_explanation_id || '',

        terroir_info: wine.terroir_info || '',
        producer_philosophy: wine.producer_philosophy || '',
        technical_details: wine.technical_details || '',
        vintage_analysis: wine.vintage_analysis || '',
        search_result_tasting_note: wine.search_result_tasting_note || '',
    };

    if (isEditing) {
        return (
            <div className="max-w-4xl mx-auto p-4 md:p-8 pb-32">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-[var(--text)]">情報の編集</h2>
                    <button
                        onClick={() => setIsEditing(false)}
                        className="text-sm text-[var(--text-muted)] hover:text-[var(--text)] underline"
                    >
                        キャンセル
                    </button>
                </div>
                <div className="bg-[var(--card-bg)] p-6 rounded-2xl shadow-sm border border-[var(--border)]">
                    <WineForm
                        defaultValues={defaultValues}
                        onSubmit={handleUpdate}
                        isSubmitting={isSubmitting}
                        submitLabel="更新内容を保存"
                    />
                </div>
            </div>
        );
    }

    return (
        <WineDetailView
            wine={wine}
            onEdit={() => setIsEditing(true)}
            onDelete={handleDelete}
            isDeleting={isDeleting}
            onOptimizeImage={handleOptimizeImage}
            isOptimizingImage={isOptimizingImage}
        />
    );
}
