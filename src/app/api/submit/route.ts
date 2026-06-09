
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';
import { isAuthenticationRequiredError, requireAuthenticatedUser } from '@/lib/serverAuth';
// import { appendToSheet, appendToNotion, UnknownRecord } from '@/app/actions/sync';

type UnknownRecord = Record<string, unknown>;

interface WineImageInput {
  url: string;
  thumbnail_url?: string | null;
  storage_path?: string | null;
  display_order?: number | null;
}

function isWineImageInput(value: unknown): value is WineImageInput {
  if (!value || typeof value !== 'object') return false;
  const image = value as Record<string, unknown>;
  return typeof image.url === 'string';
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeUuid(value: unknown) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return UUID_PATTERN.test(trimmed) ? trimmed : null;
}

// Supabaseに保存する関数（camelCaseをsnake_caseに変換）
async function appendToSupabase(data: UnknownRecord, userId: string, status?: string): Promise<{ id: string }> {
  // camelCaseをsnake_caseに変換するヘルパー
  const toSnakeCase = (str: string): string => {
    // sat_で始まる項目は既にsnake_caseなので変換不要
    if (str.startsWith('sat_')) {
      return str;
    }

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
      referenceUrl: 'reference_url',
      additionalInfo: 'additional_info',
      sparkleIntensity: 'sparkle_intensity',
      localityVocabId: 'locality_vocab_id',
      aiExplanationId: 'ai_explanation_id',
    };

    if (replacements[str]) {
      return replacements[str];
    }

    // 汎用的なcamelCase to snake_case変換
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  };

  const supabaseData: Record<string, unknown> = {};
  const imagesData = Array.isArray(data.images)
    ? data.images.filter(isWineImageInput)
    : [];

  // データを変換（空文字列やundefinedはnullに変換）
  for (const [key, value] of Object.entries(data)) {
    if (key === 'images') continue; // Don't add 'images' column to tasting_notes

    const snakeKey = toSnakeCase(key);
    // 空文字列やundefinedはnullに変換（SupabaseのTEXT型で空文字列は許可されない場合があるため）
    if (value === '' || value === undefined) {
      supabaseData[snakeKey] = null;
    } else {
      supabaseData[snakeKey] = value;
    }
  }

  supabaseData['user_id'] = userId;

  // Status Handling
  if (status) {
    supabaseData['status'] = status;
  } else {
    supabaseData['status'] = 'published'; // Default
  }

  // created_atを追加（無ければ現在時刻）
  if (!supabaseData.created_at) {
    supabaseData.created_at = new Date().toISOString();
  }

  const aiExplanationId = normalizeUuid(supabaseData.ai_explanation_id);
  supabaseData.ai_explanation_id = aiExplanationId;

  const supabase = getSupabaseClient();

  const { data: insertedData, error } = await supabase
    .from('tasting_notes')
    .insert(supabaseData)
    .select('id')
    .single();

  if (error) {
    throw new Error(`Supabase insert error: ${error.message}`);
  }

  const tastingNoteId = insertedData.id;

  // Insert Images
  if (imagesData.length > 0) {
    const imagesToInsert = imagesData.map((img) => ({
      tasting_note_id: tastingNoteId,
      url: img.url,
      thumbnail_url: img.thumbnail_url,
      storage_path: img.storage_path,
      display_order: img.display_order ?? 0,
    }));

    const { error: imageError } = await supabase
      .from('wine_images')
      .insert(imagesToInsert);

    if (imageError) {
      console.error('Error inserting wine images:', imageError);
      // NOTE: We don't fail the whole request if image insert fails, but maybe we should warn?
    }
  }

  if (aiExplanationId) {
    const { error: linkError } = await supabase
      .from('ai_explanations')
      .update({ source_tasting_note_id: tastingNoteId })
      .eq('id', aiExplanationId);

    if (linkError) {
      console.error('Error linking AI explanation to tasting note:', linkError);
    }
  }

  return { id: String(tastingNoteId) };
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    const data = (await req.json()) as UnknownRecord;

    const status = (data.status as string) || 'published';

    // 1. まずSupabaseに保存
    const supabaseResult = await appendToSupabase(data, user.id, status);

    // 2. その後、既存のNotion/Sheets連携を実行 (下書き以外の場合のみ)
    // Notion/Sheets sync removed.
    // if (status !== 'draft') { ... }

    return NextResponse.json({ ok: true, id: supabaseResult.id }, { status: 200 });
  } catch (err: unknown) {
    if (isAuthenticationRequiredError(err)) {
      return NextResponse.json({ ok: false, error: 'Authentication required' }, { status: 401 });
    }

    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('Submit Error:', err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
