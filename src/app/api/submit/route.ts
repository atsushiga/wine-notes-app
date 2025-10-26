export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { Client } from '@notionhq/client';
import type {
  BlockObjectRequest,
  CreatePageParameters,
} from '@notionhq/client/build/src/api-endpoints';

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

// Google Sheets クライアント関数
async function getSheetByGid(doc: GoogleSpreadsheet, gid: number) {
  await doc.loadInfo(); // 全シート情報を取得
  const sheet = Object.values(doc.sheetsById).find(s => s.sheetId === gid);
  if (!sheet) throw new Error(`Sheet with gid=${gid} not found`);
  return sheet;
}

// Google Sheets クライアント
async function appendToSheet(row: Record<string, unknown>) {
    console.log('Loaded spreadsheet');
    
    const serviceAccountAuth = new JWT({
        email: process.env.GOOGLE_CLIENT_EMAIL!,
        key: process.env.GOOGLE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID!, serviceAccountAuth);
    await doc.loadInfo();
    const sheet = await getSheetByGid(doc, 0); // ← gid（URL末尾の gid=XXXX 部分）

    const toCellValue = (v: any) => {
        if (Array.isArray(v)) return v.join(', ');     // 配列は「、」で連結
        if (v === null || v === undefined) return '';  // 空は空文字
        if (typeof v === 'object') return JSON.stringify(v); // オブジェクトはJSON文字列
        return v; // number / string / boolean はそのまま
      };
    
    const normalizedRow: Record<string, any> = Object.fromEntries(
        Object.entries(row).map(([k, v]) => [k, toCellValue(v)])
    );

    try {
        await sheet.loadHeaderRow();
    } catch {
        await sheet.setHeaderRow(Object.keys(row));
    }
    await sheet.addRow(normalizedRow);
    console.log('sheet added')
}

// Notion クライアント
// すでに: import { Client } from '@notionhq/client';
const notion = new Client({ auth: process.env.NOTION_TOKEN! });
const NOTION_DB_ID = process.env.NOTION_DB_ID!;

// price は "1,234" → 1234 の数値に
const parsePrice = (s?: string) => {
  if (!s) return undefined;
  const n = Number(String(s).replace(/,/g, ''));
  return Number.isFinite(n) ? n : undefined;
};

async function appendToNotion(data: any) {
    // === DBに入れるべき項目 ===
    const props: CreatePageParameters['properties'] = {
        // タイトル（必須）
        'Wine Name': { title: [{ type: 'text', text: { content: data.wineName || '' } }] },

        ...(data.date
        ? { Date: { date: { start: String(data.date) } } }
        : {}),

        ...(data.place
        ? { Place: { rich_text: [{ type: 'text', text: { content: String(data.place) } }] } }
        : {}),

        ...(data.imageUrl
        ? {
            ImageURL: {
                files: [
                { type: 'external', name: 'image', external: { url: String(data.imageUrl) } },
                ],
            },
            }
        : {}),

        ...(data.producer
        ? { Producer: { rich_text: [{ type: 'text', text: { content: String(data.producer) } }] } }
        : {}),

        ...(data.vintage
        ? { Vintage: { rich_text: [{ type: 'text', text: { content: String(data.vintage) } }] } }
        : {}),

        ...(parsePrice(data.price) != null
        ? { 'Bottle Price': { number: parsePrice(data.price)! } }
        : {}),

        // ※ Notion の DB 側で選択肢（name）が存在している必要があります
        ...(data.wineType
        ? { Color: { select: { name: String(data.wineType) } } }
        : {}),

        ...(data.country
        ? { Country: { select: { name: String(data.country) } } }
        : {}),

        ...(data.locality
        ? { Region: { rich_text: [{ type: 'text', text: { content: String(data.locality) } }] } }
        : {}),

        ...(data.mainVariety
        ? { Variety: { select: { name: String(data.mainVariety) } } }
        : {}),

        ...(data.vivinoUrl
        ? { 'Vivino URL': { url: String(data.vivinoUrl) } }
        : {}),

        ...(typeof data.rating === 'number'
        ? { Rating: { number: round1(Number(data.rating)) } }
        : {}),

    };

    // undefined のプロパティは消す（Notion API に渡さない）
    for (const k of Object.keys(props)) {
        if (props[k] === undefined) delete props[k];
    }

    // === 本文（DB外）の要素を構造化して記載 ===
    // 数値→ラベルを併記（例：濃淡 4.2 → ガーネット）
    // const lines: string[] = [];

    // // 外観
    // lines.push('## 外観');
    // lines.push(`- 濃淡: ${round1(data.intensity)}（${appearanceFeatureLabel(data.intensity)}）`);
    // if (typeof data.rimRatio === 'number') lines.push(`- 縁の色調（紫↔橙 比率）: ${round1(data.rimRatio)}/10`);
    // if (data.clarity)     lines.push(`- 清澄度: ${data.clarity}`);
    // if (data.brightness)  lines.push(`- 輝き: ${data.brightness}`);
    // if (data.hue)         lines.push(`- 色調メモ: ${data.hue}`);
    // if (data.sparkleIntensity) lines.push(`- 発泡: ${data.sparkleIntensity}`);
    // if (data.appearanceOther)  lines.push(`- その他: ${data.appearanceOther}`);

    // // 香り
    // lines.push('\n## 香り');
    // if (data.noseIntensity) lines.push(`- 強さ: ${data.noseIntensity}`);
    // if (typeof data.oldNewWorld === 'number') lines.push(`- 旧/新世界: ${round1(data.oldNewWorld)}（${worldLabel(data.oldNewWorld)}）`);
    // if (typeof data.fruitsMaturity === 'number') lines.push(`- 果実の状態: ${round1(data.fruitsMaturity)}（${fruitStateLabel(data.fruitsMaturity)}）`);
    // if (typeof data.oakAroma === 'number') lines.push(`- 樽香: ${round1(data.oakAroma)}（${oakAromaLabel(data.oakAroma)}）`);
    // if (Array.isArray(data.aromas) && data.aromas.length) lines.push(`- 香りの印象: ${data.aromas.join('、')}`);
    // if (data.aromaOther) lines.push(`- その他のアロマ: ${data.aromaOther}`);

    // 味わい
    // lines.push('\n## 味わい');
    // if (data.sweetness) lines.push(`- 甘辛: ${data.sweetness}`);
    // if (typeof data.acidityScore === 'number') lines.push(`- 酸味: ${round1(data.acidityScore)}（${acidityLabel(data.acidityScore)}）`);
    // if (typeof data.tanninScore === 'number')  lines.push(`- タンニン分: ${round1(data.tanninScore)}（${tanninLabel(data.tanninScore)}）`);
    // if (typeof data.balanceScore === 'number') lines.push(`- バランス: ${round1(data.balanceScore)}（${balanceLabel(data.balanceScore)}）`);
    // if (typeof data.alcoholABV === 'number')   lines.push(`- アルコール: ${round1(data.alcoholABV)}%`);
    // if (typeof data.finishLen === 'number')    lines.push(`- 余韻: ${Math.round(data.finishLen)}（${finishLenLabel(data.finishLen)}）`);
    // if (data.palateNotes) lines.push(`- 補足: ${data.palateNotes}`);

    // その他
    // lines.push('\n## メモ');
    // if (data.additionalInfo) lines.push(`- 補足情報: ${data.additionalInfo}`);
    // if (data.notes)          lines.push(`- ノート: ${data.notes}`);

    // const bodyMarkdown = lines.join('\n');
    const blocks: BlockObjectRequest[] = [];

    if (data.imageUrl) {
        blocks.push({
            type: 'image',
            image: { type: 'external', external: { url: data.imageUrl } },
        });
        }

        const addHeading = (text: string) =>
        blocks.push({
            type: 'heading_2',
            heading_2: { rich_text: [{ type: 'text', text: { content: text } }] },
        });

        const addKV = (key: string, val?: any) => {
        if (!val && val !== 0) return;
        blocks.push({
            object: 'block',
            type: 'paragraph',
            paragraph: {
            rich_text: [{ type: 'text', text: { content: `${key}: ${val}` } }],
            },
        });
    };

    //
    // === テイスティング情報 ===
    //
    addHeading('テイスティング情報');
    addKV('日付', data.date);
    addKV('ボトル価格', data.price ? `${data.price} 円` : '');
    addKV('飲んだ/購入した場所', data.place);

    //
    // === ワイン情報 ===
    //
    addHeading('ワイン情報');
    addKV('ワイン名', data.wineName);
    addKV('生産者', data.producer);
    addKV('国', data.country);
    addKV('地名', data.locality);
    addKV('主体の品種', data.mainVariety);
    addKV('その他の品種', data.otherVarieties);
    addKV('補足情報', data.additionalInfo);
    addKV('ヴィンテージ', data.vintage);

    //
    // === 外観 ===
    //
    addHeading('外観');
    if (data.intensity)
    addKV('濃淡', `${round1(data.intensity)} (${intensityLabel(Number(data.intensity))})`);
    if (data.rimRatio)
    addKV('縁の色調', `${round1(data.rimRatio)} (${rimRatioLabel(Number(data.rimRatio))})`);
    addKV('清澄度', data.clarity);
    addKV('輝き', data.brightness);
    addKV('泡の強さ', data.sparkleIntensity);
    addKV('その他の外観の特徴', data.appearanceOther);

    //
    // === 香り ===
    //
    addHeading('香り');
    addKV('香りの強さ', data.noseIntensity);
    if (data.oldNewWorld)
    addKV('旧/新世界', `${round1(data.oldNewWorld)} (${worldLabel(Number(data.oldNewWorld))})`);
    if (data.fruitsMaturity)
    addKV('果実の状態', `${round1(data.fruitsMaturity)} (${fruitStateLabel(Number(data.fruitsMaturity))})`);
    addKV('中立〜芳香', data.aromaNeutrality);
    if (Array.isArray(data.aromas) && data.aromas.length > 0)
    addKV('印象', data.aromas.join(', '));
    if (data.oakAroma)
    addKV('樽香', `${round1(data.oakAroma)} (${oakAromaLabel(Number(data.oakAroma))})`);
    addKV('その他のアロマ', data.aromaOther);

    //
    // === 味わい ===
    //
    addHeading('味わい');
    addKV('甘味', data.sweetness);
    if (data.acidityScore)
    addKV('酸味', `${round1(data.acidityScore)} (${acidityLabel(Number(data.acidityScore))})`);
    if (data.tanninScore)
    addKV('タンニン', `${round1(data.tanninScore)} (${tanninLabel(Number(data.tanninScore))})`);
    addKV('ボディ', data.body);
    addKV('アルコール', data.alcohol);
    if (data.balanceScore)
    addKV('バランス', `${round1(data.balanceScore)} (${balanceLabel(Number(data.balanceScore))})`);
    if (data.finishLen)
    addKV('余韻の長さ', `${round1(data.finishLen)} (${finishLenLabel(Number(data.finishLen))})`);
    if (data.alcoholABV)
    addKV('アルコール度数', `${data.alcoholABV}%`);
    addKV('味わいの補足', data.palateNotes);

    //
    // === 総合評価 ===
    //
    addHeading('総合評価');
    addKV('評価コメント', data.evaluation);
    if (data.rating)
    addKV('総合評価', `${round1(data.rating)} ⭐️`);
    addKV('コメント', data.notes);
    addKV('Vivino URL', data.vivinoUrl);


    const page = await notion.pages.create({
    parent: { database_id: NOTION_DB_ID },
    properties: props,
    cover: data.imageUrl
        ? { type: 'external', external: { url: data.imageUrl } }
        : undefined,
    children: blocks,
    });

    return page;
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const row = { ...body, createdAt: new Date().toISOString() };
        await appendToSheet(row);
        await appendToNotion(body);
        return NextResponse.json({ ok: true, id: row.createdAt });
    } catch (e: any) {
        console.error('Submit Error:', e);
        return NextResponse.json({ ok: false, error: e.message || 'unknown' }, { status: 500 });
    }
}