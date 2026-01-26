
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';
import { createClient } from '@/utils/supabase/server';
// import { appendToSheet, appendToNotion, UnknownRecord } from '@/app/actions/sync';

type UnknownRecord = Record<string, unknown>;

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic';

// Supabaseに保存する関数（camelCaseをsnake_caseに変換）
async function appendToSupabase(data: UnknownRecord, userId?: string, status?: string): Promise<{ id: string }> {
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
      additionalInfo: 'additional_info',
      sparkleIntensity: 'sparkle_intensity',
    };

    if (replacements[str]) {
      return replacements[str];
    }

    // 汎用的なcamelCase to snake_case変換
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  };

  const supabaseData: Record<string, unknown> = {};
  const imagesData = (data.images as any[]) || []; // Extract images array

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

  // user_idがあれば追加
  if (userId) {
    supabaseData['user_id'] = userId;
  }

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

  return { id: String(tastingNoteId) };
}

export async function POST(req: NextRequest) {
  try {
    const data = (await req.json()) as UnknownRecord;

    // 0. ユーザー情報の取得
    const supabaseClient = await createClient();
    const { data: { user } } = await supabaseClient.auth.getUser();
    const userId = user?.id;

    const status = (data.status as string) || 'published';

    // 1. まずSupabaseに保存
    const supabaseResult = await appendToSupabase(data, userId, status);

    // 2. その後、既存のNotion/Sheets連携を実行 (下書き以外の場合のみ)
    // Notion/Sheets sync removed.
    // if (status !== 'draft') { ... }

    return NextResponse.json({ ok: true, id: supabaseResult.id }, { status: 200 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('Submit Error:', err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
