'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { WineFormValues } from '@/components/WineForm';



// Helper to convert camelCase to snake_case for Supabase
const toSnakeCase = (str: string): string => {
    if (str.startsWith('sat_')) return str;
    const replacements: Record<string, string> = {
        alcoholABV: 'alcohol_abv',
        imageUrl: 'image_url',
        wineName: 'wine_name',
        vivinoUrl: 'vivino_url',
        createdAt: 'created_at',
        acidityScore: 'acidity_score',
        tanninScore: 'tannin_score',
        balanceScore: 'balance_score',
        finishLen: 'finish_len',
        rimRatio: 'rim_ratio',
        oldNewWorld: 'old_new_world',
        fruitsMaturity: 'fruits_maturity',
        aromaNeutrality: 'aroma_neutrality',
        oakAroma: 'oak_aroma',
        palateNotes: 'palate_notes',
        appearanceOther: 'appearance_other',
        aromaOther: 'aroma_other',
        wineType: 'wine_type',
        mainVariety: 'main_variety',
        otherVarieties: 'other_varieties',
        additionalInfo: 'additional_info',
        sparkleIntensity: 'sparkle_intensity',
    };
    if (replacements[str]) return replacements[str];
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
};

export async function updateWine(id: number, data: WineFormValues) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        throw new Error('Not authenticated');
    }

    // Check current status to see if we are switching from draft to published
    const { data: currentData, error: fetchError } = await supabase
        .from('tasting_notes')
        .select('status')
        .eq('id', id)
        .single();

    if (fetchError) {
        console.error('Error fetching current wine status:', fetchError);
        // non-fatal, proceed assuming simple update? Or maybe fatal. Let's proceed but warn.
    }

    const wasDraft = currentData?.status === 'draft';
    const newStatus = data.status || 'published';

    const supabaseData: Record<string, unknown> = {};
    const imagesData = (data.images as any[]) || [];

    for (const [key, value] of Object.entries(data)) {
        if (key === 'images') continue; // Don't add 'images' to tasting_notes update
        const snakeKey = toSnakeCase(key);
        if (value === '' || value === undefined) {
            supabaseData[snakeKey] = null;
        } else {
            supabaseData[snakeKey] = value;
        }
    }

    // Ensure status is set
    supabaseData['status'] = newStatus;

    const { error } = await supabase
        .from('tasting_notes')
        .update(supabaseData)
        .eq('id', id);

    if (error) {
        console.error('Update error:', error);
        throw new Error(`Update failed: ${error.message}`);
    }

    // Update Images: Replace strategy
    // 1. Delete existing
    const { error: deleteError } = await supabase
        .from('wine_images')
        .delete()
        .eq('tasting_note_id', id);

    if (deleteError) {
        console.error('Error clearing old images:', deleteError);
    }

    // 2. Insert new
    if (imagesData.length > 0) {
        const imagesToInsert = imagesData.map((img) => ({
            tasting_note_id: id,
            url: img.url,
            thumbnail_url: img.thumbnail_url,
            storage_path: img.storage_path,
            display_order: img.display_order ?? 0,
        }));

        const { error: insertError } = await supabase
            .from('wine_images')
            .insert(imagesToInsert);

        if (insertError) {
            console.error('Error inserting new images:', insertError);
        }
    }

    // External Sync Logic
    // Sync logic removed as per user request.
    // if (newStatus === 'published' && wasDraft) { ... }


    revalidatePath(`/wines/${id}`);
    revalidatePath('/tasting-notes');
}

export async function deleteWine(id: number) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        throw new Error('Not authenticated');
    }

    const { error } = await supabase
        .from('tasting_notes')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Delete error:', error);
        throw new Error(`Delete failed: ${error.message}`);
    }

    revalidatePath('/tasting-notes');
    return { success: true };
}

export async function bulkDeleteWines(ids: number[]) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        throw new Error('Not authenticated');
    }

    if (ids.length === 0) {
        return { success: true };
    }

    const { error } = await supabase
        .from('tasting_notes')
        .delete()
        .in('id', ids);

    if (error) {
        console.error('Bulk delete error:', error);
        throw new Error(`Bulk delete failed: ${error.message}`);
    }

    revalidatePath('/tasting-notes');
    return { success: true };
}
