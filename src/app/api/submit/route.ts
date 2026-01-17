
import { NextRequest, NextResponse } from 'next/server';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { Client } from '@notionhq/client';
import type {
  BlockObjectRequest,
  CreatePageParameters,
} from '@notionhq/client/build/src/api-endpoints';
import { getSupabaseClient } from '@/lib/supabase';
import { createClient } from '@/utils/supabase/server';

import {
  round1,
  intensityLabel,
  rimRatioLabel,
  fruitStateLabel,
  oakAromaLabel,
  acidityLabel,
  tanninLabel,
  balanceLabel,
  finishLenLabel,
  worldLabel,
} from '@/lib/wineHelpers';

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic';

// Notion クライアント
const notion = new Client({ auth: process.env.NOTION_TOKEN! });
const NOTION_DB_ID = process.env.NOTION_DB_ID!;

// ---- 型安全なユーティリティ ----
type UnknownRecord = Record<string, unknown>;
const asString = (v: unknown): string | undefined =>
  v == null ? undefined : String(v);
const asNumber = (v: unknown): number | undefined => {
  if (v == null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};
const parsePrice = (v: unknown): number | null => {
  if (v == null) return null;
  const s = String(v).replace(/[^\d]/g, '');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};


// Google Sheets 追記処理（gid選択・ヘッダー自動拡張・配列で addRow／null 非許容対応）
async function appendToSheet(row: Record<string, unknown>): Promise<void> {
  const serviceAccountAuth = new JWT({
    email: process.env.GOOGLE_CLIENT_EMAIL!,
    key: process.env.GOOGLE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID!, serviceAccountAuth);
  await doc.loadInfo();

  // === シート選択：環境変数 GOOGLE_SHEET_GID（数値）を優先、なければ先頭シート ===
  const gidEnv = process.env.GOOGLE_SHEET_GID;
  const targetGid = gidEnv ? Number(gidEnv) : undefined;

  const sheet =
    targetGid != null && Number.isFinite(targetGid)
      ? (() => {
        const found = Object.values(doc.sheetsById).find(s => s.sheetId === targetGid);
        if (!found) throw new Error(`Sheet with gid=${targetGid} not found`);
        return found;
      })()
      : doc.sheetsByIndex[0];

  // === ヘッダー行の用意 ===
  try {
    await sheet.loadHeaderRow();
  } catch {
    await sheet.setHeaderRow(Object.keys(row));
  }

  const currentHeaders: string[] = sheet.headerValues ?? [];
  const incomingKeys = Object.keys(row);
  const mergedHeaders = Array.from(new Set([...currentHeaders, ...incomingKeys]));

  if (
    mergedHeaders.length !== currentHeaders.length ||
    mergedHeaders.some((h, i) => h !== currentHeaders[i])
  ) {
    await sheet.setHeaderRow(mergedHeaders);
  }

  // === セル整形（RowCellData は null 非対応なので null は使わない） ===
  type RowCell = string | number | boolean | Date; // ← null を含めない

  const serializeCell = (v: unknown): RowCell => {
    if (v == null) return '';                 // null/undefined は空文字に
    if (Array.isArray(v)) return v.join(', '); // 配列はカンマ連結
    if (v instanceof Date) return v;
    switch (typeof v) {
      case 'string':
      case 'number':
      case 'boolean':
        return v;
      default:
        try {
          return JSON.stringify(v);
        } catch {
          return String(v);
        }
    }
  };

  // createdAt を補完（無ければ ISO 付与）
  const enriched: Record<string, unknown> = {
    createdAt: new Date().toISOString(),
    ...row,
  };

  // ヘッダー順の配列に変換（RowCell[]）
  const values: RowCell[] = mergedHeaders.map(h => serializeCell(enriched[h]));

  // options を付けずに配列を渡すほうが型が安定
  await sheet.addRow(values);
}

async function appendToNotion(data: UnknownRecord) {
  // ========== properties（DB項目） ==========
  const props: CreatePageParameters['properties'] = {
    // タイトルは必須
    'Wine Name': {
      title: [{ type: 'text', text: { content: asString(data.wineName) ?? '' } }],
    },

    // 条件付きスプレッドで undefined を入れない
    ...(asString(data.date)
      ? { Date: { date: { start: asString(data.date)! } } }
      : {}),

    ...(asString(data.place)
      ? { Place: { rich_text: [{ type: 'text', text: { content: asString(data.place)! } }] } }
      : {}),

    ...(asString(data.imageUrl)
      ? {
        ImageURL: {
          files: [
            {
              type: 'external',
              name: 'image',
              external: { url: asString(data.imageUrl)! },
            },
          ],
        },
      }
      : {}),

    ...(asString(data.producer)
      ? { Producer: { rich_text: [{ type: 'text', text: { content: asString(data.producer)! } }] } }
      : {}),

    ...(asString(data.vintage)
      ? { Vintage: { rich_text: [{ type: 'text', text: { content: asString(data.vintage)! } }] } }
      : {}),

    ...(parsePrice(data.price) != null
      ? { 'Bottle Price': { number: parsePrice(data.price)! } }
      : {}),

    ...(asString(data.wineType)
      ? { Color: { select: { name: asString(data.wineType)! } } }
      : {}),

    ...(asString(data.country)
      ? { Country: { select: { name: asString(data.country)! } } }
      : {}),

    ...(asString(data.locality)
      ? { Region: { rich_text: [{ type: 'text', text: { content: asString(data.locality)! } }] } }
      : {}),

    ...(asString(data.mainVariety)
      ? { Variety: { select: { name: asString(data.mainVariety)! } } }
      : {}),

    ...(asString(data.vivinoUrl)
      ? { 'Vivino URL': { url: asString(data.vivinoUrl)! } }
      : {}),

    ...(typeof asNumber(data.rating) === 'number'
      ? { Rating: { number: round1(asNumber(data.rating)!) } }
      : {}),
  };

  // ========== 本文（children ブロック） ==========
  const blocks: BlockObjectRequest[] = [];

  const pushHeading = (text: string) =>
    blocks.push({
      type: 'heading_2',
      heading_2: { rich_text: [{ type: 'text', text: { content: text } }] },
    });

  const pushKV = (key: string, val: string | undefined) => {
    if (!val) return;
    blocks.push({
      type: 'paragraph',
      paragraph: { rich_text: [{ type: 'text', text: { content: `${key}: ${val}` } }] },
    });
  };

  const imageUrl = asString(data.imageUrl);
  if (imageUrl) {
    blocks.push({
      type: 'image',
      image: { type: 'external', external: { url: imageUrl } },
    });
  }

  //
  // === テイスティング情報 ===
  //
  pushHeading('テイスティング情報');
  pushKV('日付', asString(data.date));
  const priceNum = parsePrice(data.price);
  pushKV('ボトル価格', priceNum != null ? `${priceNum} 円` : undefined);
  pushKV('飲んだ/購入した場所', asString(data.place));

  //
  // === ワイン情報 ===
  //
  pushHeading('ワイン情報');
  pushKV('ワイン名', asString(data.wineName));
  pushKV('生産者', asString(data.producer));
  pushKV('国', asString(data.country));
  pushKV('地名', asString(data.locality));
  pushKV('主体の品種', asString(data.mainVariety));
  pushKV('その他の品種', asString(data.otherVarieties));
  pushKV('補足情報', asString(data.additionalInfo));
  pushKV('ヴィンテージ', asString(data.vintage));

  //
  // === 外観 ===
  //
  pushHeading('外観');
  {
    const v = asNumber(data.intensity);
    if (typeof v === 'number') {
      pushKV('濃淡', `${round1(v)} (${intensityLabel(v)})`);
    }
  }
  {
    const v = asNumber(data.rimRatio);
    if (typeof v === 'number') {
      pushKV('縁の色調', `${round1(v)} (${rimRatioLabel(v)})`);
    }
  }
  pushKV('清澄度', asString(data.clarity));
  pushKV('輝き', asString(data.brightness));
  pushKV('泡の強さ', asString(data.sparkleIntensity));
  pushKV('その他の外観の特徴', asString(data.appearanceOther));

  //
  // === 香り ===
  //
  pushHeading('香り');
  pushKV('香りの強さ', asString(data.noseIntensity));
  {
    const v = asNumber(data.oldNewWorld);
    if (typeof v === 'number') {
      pushKV('旧/新世界', `${round1(v)} (${worldLabel(v)})`);
    }
  }
  {
    const v = asNumber(data.fruitsMaturity);
    if (typeof v === 'number') {
      pushKV('果実の状態', `${round1(v)} (${fruitStateLabel(v)})`);
    }
  }
  pushKV('ニュートラル〜アロマティック', asString(data.aromaNeutrality));
  if (Array.isArray(data.aromas) && data.aromas.length > 0) {
    pushKV('印象', data.aromas.join(', '));
  }
  {
    const v = asNumber(data.oakAroma);
    if (typeof v === 'number') {
      pushKV('樽香', `${round1(v)} (${oakAromaLabel(v)})`);
    }
  }
  pushKV('その他のアロマ', asString(data.aromaOther));

  //
  // === 味わい ===
  //
  pushHeading('味わい');
  pushKV('甘味', asString(data.sweetness));
  {
    const v = asNumber(data.acidityScore);
    if (typeof v === 'number') {
      pushKV('酸味', `${round1(v)} (${acidityLabel(v)})`);
    }
  }
  {
    const v = asNumber(data.tanninScore);
    if (typeof v === 'number') {
      pushKV('タンニン', `${round1(v)} (${tanninLabel(v)})`);
    }
  }
  pushKV('ボディ', asString(data.body));
  pushKV('アルコール', asString(data.alcohol));
  {
    const v = asNumber(data.balanceScore);
    if (typeof v === 'number') {
      pushKV('バランス', `${round1(v)} (${balanceLabel(v)})`);
    }
  }
  {
    const v = asNumber(data.finishLen);
    if (typeof v === 'number') {
      pushKV('余韻の長さ', `${round1(v)} (${finishLenLabel(v)})`);
    }
  }
  {
    const v = asNumber(data.alcoholABV);
    if (typeof v === 'number') {
      pushKV('アルコール度数', `${round1(v)}%`);
    }
  }
  pushKV('味わいの補足', asString(data.palateNotes));

  //
  // === 総合評価 ===
  //
  pushHeading('総合評価');
  pushKV('評価コメント', asString(data.evaluation));
  {
    const v = asNumber(data.rating);
    if (typeof v === 'number') {
      pushKV('総合評価', `${round1(v)} ⭐️`);
    }
  }
  pushKV('コメント', asString(data.notes));
  pushKV('Vivino URL', asString(data.vivinoUrl));

  const page = await notion.pages.create({
    parent: { database_id: NOTION_DB_ID },
    properties: props,
    cover: imageUrl ? { type: 'external', external: { url: imageUrl } } : undefined,
    children: blocks,
  });

  return page;
}

// Supabaseに保存する関数（camelCaseをsnake_caseに変換）
async function appendToSupabase(data: UnknownRecord, userId?: string): Promise<{ id: string }> {
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

  // データを変換（空文字列やundefinedはnullに変換）
  for (const [key, value] of Object.entries(data)) {
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

  return { id: String(insertedData.id) };
}

export async function POST(req: NextRequest) {
  try {
    const data = (await req.json()) as UnknownRecord;

    // 0. ユーザー情報の取得
    const supabaseClient = await createClient();
    const { data: { user } } = await supabaseClient.auth.getUser();
    const userId = user?.id;

    // 1. まずSupabaseに保存
    const supabaseResult = await appendToSupabase(data, userId);

    // 2. その後、既存のNotion/Sheets連携を実行
    const row: Record<string, unknown> = { ...data, createdAt: new Date().toISOString() };

    await appendToSheet(row);
    await appendToNotion(data);

    return NextResponse.json({ ok: true, id: supabaseResult.id }, { status: 200 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('Submit Error:', err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
