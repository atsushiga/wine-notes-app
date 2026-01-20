'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TastingNote } from '@/types/custom';
import WineDetailView from '@/components/WineDetailView';
import WineForm, { WineFormValues } from '@/components/WineForm';
import { updateWine, deleteWine } from '@/app/actions/wine';

export default function WineDetailClient({ wine }: { wine: TastingNote }) {
    const router = useRouter();
    const [isEditing, setIsEditing] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

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
        if (!confirm('本当に削除しますか？この操作は取り消せません。\n※Google SheetsおよびNotionのデータは削除されません。')) return;

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

    // Mapping TastingNote (snake_case) -> WineFormValues (camelCase)
    const defaultValues: Partial<WineFormValues> = {
        date: wine.date || '',
        place: wine.place || '',
        price: wine.price ? String(wine.price) : '',
        imageUrl: wine.image_url || '',
        images: wine.images || [],

        // Cast strict enums if data exists, otherwise default or let form handle validation
        wineType: (wine.wine_type as any) || '赤',

        wineName: wine.wine_name || '',
        producer: wine.producer || '',
        country: wine.country || '',
        locality: wine.locality || '',
        region: wine.region || '',
        mainVariety: wine.main_variety || '',
        otherVarieties: wine.other_varieties || '',
        vintage: wine.vintage || '',
        additionalInfo: wine.additional_info || '',

        intensity: wine.intensity,
        rimRatio: wine.rim_ratio,
        clarity: wine.clarity || '',
        brightness: wine.brightness || '',
        sparkleIntensity: wine.sparkle_intensity || '',
        appearanceOther: wine.appearance_other || '',

        noseIntensity: wine.nose_intensity || '',
        oldNewWorld: wine.old_new_world,
        aromaNeutrality: wine.aroma_neutrality,
        fruitsMaturity: wine.fruits_maturity,
        oakAroma: wine.oak_aroma,
        aromas: wine.aromas || [],
        aromaOther: wine.aroma_other || '',

        sweetness: wine.sweetness || '',
        acidityScore: wine.acidity_score,
        tanninScore: wine.tannin_score,
        balanceScore: wine.balance_score,
        alcoholABV: wine.alcohol_abv,
        finishLen: wine.finish_len,
        palateNotes: wine.palate_notes || '',

        evaluation: wine.evaluation || '',
        rating: wine.rating || 0,
        notes: wine.notes || '',
        vivinoUrl: wine.vivino_url || '',

        // SAT
        sat_nose_intensity: wine.sat_nose_intensity as any,
        sat_acidity: wine.sat_acidity as any,
        sat_tannin: wine.sat_tannin as any,
        sat_finish: wine.sat_finish as any,
        sat_quality: wine.sat_quality as any,
    };

    if (isEditing) {
        return (
            <div className="max-w-4xl mx-auto p-4 md:p-8 pb-32">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold">情報の編集</h2>
                    <button
                        onClick={() => setIsEditing(false)}
                        className="text-sm text-gray-500 hover:text-gray-900 underline"
                    >
                        キャンセル
                    </button>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
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
        />
    );
}
