'use server';

import { revalidatePath } from 'next/cache';
import type { AiExplainerHistoryItem, StoredVisualExplanation } from '@/lib/aiExplainerStorage';
import { getSupabaseClient } from '@/lib/supabase';
import { createClient } from '@/utils/supabase/server';

type SaveAiExplanationPayload = Omit<StoredVisualExplanation, 'id'> & {
    id?: string;
};

type AiExplanationRow = {
    id: string;
    user_id?: string | null;
    client_key?: string | null;
    source_tasting_note_id?: number | null;
    generated_at: string;
    input: StoredVisualExplanation['input'];
    explanation: StoredVisualExplanation['explanation'];
    image_url?: string | null;
    wine_name?: string | null;
    producer?: string | null;
    vintage?: string | null;
    country?: string | null;
    locality?: string | null;
    headline?: string | null;
    price?: number | null;
};

function normalizeClientKey(clientKey?: string | null) {
    const value = clientKey?.trim();
    if (!value) return null;
    return /^[a-zA-Z0-9_-]{16,80}$/.test(value) ? value : null;
}

function normalizePrice(value: string | number | null | undefined) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return Math.max(0, Math.round(value));
    }

    const raw = String(value ?? '').replace(/[^\d]/g, '');
    if (!raw) return null;

    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
}

async function getCurrentUserId() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id ?? null;
}

function assertOwner(row: AiExplanationRow, userId: string | null, clientKey: string | null) {
    if (userId && row.user_id === userId) return;
    if (clientKey && row.client_key === clientKey) return;
    throw new Error('AI explanation not found.');
}

function toStored(row: AiExplanationRow): StoredVisualExplanation {
    return {
        id: row.id,
        generatedAt: row.generated_at,
        imageUrl: row.image_url || row.input?.imageUrl || '',
        input: {
            wineName: row.input?.wineName || '',
            producer: row.input?.producer || '',
            vintage: row.input?.vintage || '',
            country: row.input?.country || '',
            locality: row.input?.locality || '',
            imageUrl: row.input?.imageUrl || row.image_url || '',
            price: row.input?.price || (row.price != null ? String(row.price) : row.explanation?.wine?.marketPriceJpy ? String(row.explanation.wine.marketPriceJpy) : ''),
            sourceWineId: row.input?.sourceWineId,
        },
        explanation: row.explanation,
    };
}

function toHistoryItem(row: AiExplanationRow): AiExplainerHistoryItem {
    return {
        id: row.id,
        generatedAt: row.generated_at,
        wineName: row.wine_name || row.explanation?.wine?.name || row.input?.wineName || '',
        producer: row.producer || row.explanation?.wine?.producer || row.input?.producer || '',
        vintage: row.vintage || row.explanation?.wine?.vintage || row.input?.vintage || '',
        country: row.country || row.explanation?.wine?.country || row.input?.country || '',
        locality: row.locality || row.explanation?.wine?.region || row.input?.locality || '',
        imageUrl: row.image_url || row.input?.imageUrl || '',
        headline: row.headline || row.explanation?.headline || '',
        price: row.price ?? normalizePrice(row.input?.price) ?? normalizePrice(row.explanation?.wine?.marketPriceJpy),
        sourceWineId: row.source_tasting_note_id || row.input?.sourceWineId,
    };
}

function formatAiExplanationTableError(error: { code?: string; message?: string } | null) {
    const message = error?.message || 'unknown error';
    if (error?.code === 'PGRST205' || message.includes('ai_explanations')) {
        return 'AI explanation save failed: ai_explanations table is not available. Apply infra/create_ai_explanations.sql to Supabase and reload the schema cache.';
    }
    return `AI explanation save failed: ${message}`;
}

async function linkSourceTastingNote(
    sourceWineId: number | undefined,
    aiExplanationId: string,
    userId: string | null,
) {
    if (!sourceWineId) return;

    const supabase = getSupabaseClient();
    let query = supabase
        .from('tasting_notes')
        .update({ ai_explanation_id: aiExplanationId })
        .eq('id', sourceWineId);

    if (userId) {
        query = query.eq('user_id', userId);
    }

    const { error } = await query;
    if (error) {
        console.error('linkSourceTastingNote error:', error);
    }
}

export async function saveAiExplanation(
    payload: SaveAiExplanationPayload,
    clientKeyValue?: string | null,
): Promise<StoredVisualExplanation> {
    const userId = await getCurrentUserId();
    const clientKey = normalizeClientKey(clientKeyValue);

    if (!userId && !clientKey) {
        throw new Error('AI explanation owner could not be identified.');
    }

    const supabase = getSupabaseClient();
    const id = payload.id || crypto.randomUUID();
    const generatedAt = payload.generatedAt || new Date().toISOString();
    const input = {
        ...payload.input,
        imageUrl: payload.imageUrl || payload.input.imageUrl || '',
    };
    const wine = payload.explanation.wine;

    const row = {
        id,
        user_id: userId,
        client_key: clientKey,
        source_tasting_note_id: input.sourceWineId ?? null,
        generated_at: generatedAt,
        input,
        explanation: payload.explanation,
        image_url: payload.imageUrl || input.imageUrl || null,
        wine_name: wine.name || input.wineName || null,
        producer: wine.producer || input.producer || null,
        vintage: wine.vintage || input.vintage || null,
        country: wine.country || input.country || null,
        locality: wine.region || input.locality || null,
        headline: payload.explanation.headline || null,
        price: normalizePrice(input.price) ?? normalizePrice(wine.marketPriceJpy),
        updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
        .from('ai_explanations')
        .upsert(row, { onConflict: 'id' })
        .select('*')
        .single();

    if (error || !data) {
        console.error('saveAiExplanation error:', error);
        throw new Error(formatAiExplanationTableError(error));
    }

    revalidatePath('/ai-explainer');
    revalidatePath('/ai-explainer/result');
    await linkSourceTastingNote(input.sourceWineId, id, userId);
    if (input.sourceWineId) {
        revalidatePath(`/wines/${input.sourceWineId}`);
        revalidatePath('/tasting-notes');
    }

    return toStored(data as AiExplanationRow);
}

export async function listAiExplanations(clientKeyValue?: string | null): Promise<AiExplainerHistoryItem[]> {
    const userId = await getCurrentUserId();
    const clientKey = normalizeClientKey(clientKeyValue);

    if (!userId && !clientKey) return [];

    const supabase = getSupabaseClient();
    let query = supabase
        .from('ai_explanations')
        .select('id,user_id,client_key,source_tasting_note_id,generated_at,input,explanation,image_url,wine_name,producer,vintage,country,locality,headline,price')
        .order('generated_at', { ascending: false });

    if (userId && clientKey) {
        query = query.or(`user_id.eq.${userId},client_key.eq.${clientKey}`);
    } else if (userId) {
        query = query.eq('user_id', userId);
    } else if (clientKey) {
        query = query.eq('client_key', clientKey);
    }

    const { data, error } = await query;

    if (error) {
        console.error('listAiExplanations error:', error);
        throw new Error(`AI explanation list failed: ${error.message}`);
    }

    return ((data as AiExplanationRow[] | null) || []).map(toHistoryItem);
}

export async function getAiExplanation(
    id: string,
    clientKeyValue?: string | null,
): Promise<StoredVisualExplanation | null> {
    const userId = await getCurrentUserId();
    const clientKey = normalizeClientKey(clientKeyValue);

    if (!id || (!userId && !clientKey)) return null;

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
        .from('ai_explanations')
        .select('*')
        .eq('id', id)
        .single();

    if (error || !data) {
        if (error?.code !== 'PGRST116') {
            console.error('getAiExplanation error:', error);
        }
        return null;
    }

    const row = data as AiExplanationRow;
    assertOwner(row, userId, clientKey);
    return toStored(row);
}
