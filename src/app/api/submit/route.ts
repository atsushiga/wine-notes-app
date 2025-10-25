export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { Client } from '@notionhq/client';

import {
  round1,
  fruitStateLabel,
  oakAromaLabel,
  acidityLabel,
  tanninLabel,
  balanceLabel,
  finishLenLabel,
  appearanceFeatureLabel,
  worldLabel,
} from '@/lib/wineHelpers';


// Google Sheets クライアント
async function appendToSheet(row: Record<string, any>) {
    console.log('Loaded spreadsheet');
    
    const serviceAccountAuth = new JWT({
        email: process.env.GOOGLE_CLIENT_EMAIL!,
        key: process.env.GOOGLE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID!, serviceAccountAuth as any);
    await doc.loadInfo();
    console.log('Loaded spreadsheet:', doc.title);
    console.log('Sheet count:', doc.sheetCount);
    console.log('Sheet titles:', Object.keys(doc.sheetsByTitle));
    const sheet = doc.sheetsByIndex[0];

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

// Notion ページ作成
async function appendToNotion(data: any) {
    // === DBに入れるべき項目 ===
    const props: any = {
        // タイトル（必須）
        'Wine Name': { title: [{ type: 'text', text: { content: data.wineName || '' } }] },

        // 日付
        'Date': data.date ? { date: { start: data.date } } : undefined,

        // 飲んだ場所（自由記述: rich_text）
        'Place': data.place ? { rich_text: [{ type: 'text', text: { content: data.place } }] } : undefined,

        // 画像（URLを files 外部参照で）
        'ImageURL': data.imageUrl ? {
        files: [{ type: 'external', name: 'image', external: { url: data.imageUrl } }]
        } : undefined,

        'Producer': data.producer ? { rich_text: [{ type: 'text', text: { content: data.producer } }] } : undefined,

        'Vintage': data.vintage ? { rich_text: [{ type: 'text', text: { content: data.vintage } }] } : undefined,

        'Bottle Price': parsePrice(data.price) != null ? { number: parsePrice(data.price) } : undefined,

        // 色（セレクト）
        'Color': data.color ? { select: { name: data.color } } : undefined,

        // 国（セレクト）
        'Country': data.country ? { select: { name: data.country } } : undefined,

        // 地名（自由記述）
        'Region': data.locality ? { rich_text: [{ type: 'text', text: { content: data.locality } }] } : undefined,

        // 主体の品種（セレクト）
        'Variety': data.mainVariety ? { select: { name: data.mainVariety } } : undefined,

        // Vivino URL
        'Vivino URL': data.vivinoUrl ? { url: data.vivinoUrl } : undefined,

        // 総合評価（number）
        'Rating': (typeof data.rating === 'number') ? { number: round1(data.rating) } : undefined,

    };

    // undefined のプロパティは消す（Notion API に渡さない）
    for (const k of Object.keys(props)) {
        if (props[k] === undefined) delete props[k];
    }

        // === 本文（DB外）の要素を構造化して記載 ===
    // 数値→ラベルを併記（例：濃淡 4.2 → ガーネット）
    const lines: string[] = [];

    // 外観
    lines.push('## 外観');
    lines.push(`- 濃淡: ${round1(data.intensity)}（${appearanceFeatureLabel(data.intensity)}）`);
    if (typeof data.rimRatio === 'number') lines.push(`- 縁の色調（紫↔橙 比率）: ${round1(data.rimRatio)}/10`);
    if (data.clarity)     lines.push(`- 清澄度: ${data.clarity}`);
    if (data.brightness)  lines.push(`- 輝き: ${data.brightness}`);
    if (data.hue)         lines.push(`- 色調メモ: ${data.hue}`);
    if (data.sparkleIntensity) lines.push(`- 発泡: ${data.sparkleIntensity}`);
    if (data.appearanceOther)  lines.push(`- その他: ${data.appearanceOther}`);

    // 香り
    lines.push('\n## 香り');
    if (data.noseIntensity) lines.push(`- 強さ: ${data.noseIntensity}`);
    if (typeof data.oldNewWorld === 'number') lines.push(`- 旧/新世界: ${round1(data.oldNewWorld)}（${worldLabel(data.oldNewWorld)}）`);
    if (typeof data.fruitsMaturity === 'number') lines.push(`- 果実の状態: ${round1(data.fruitsMaturity)}（${fruitStateLabel(data.fruitsMaturity)}）`);
    if (typeof data.oakAroma === 'number') lines.push(`- 樽香: ${round1(data.oakAroma)}（${oakAromaLabel(data.oakAroma)}）`);
    if (Array.isArray(data.aromas) && data.aromas.length) lines.push(`- 香りの印象: ${data.aromas.join('、')}`);
    if (data.aromaOther) lines.push(`- その他のアロマ: ${data.aromaOther}`);

    // 味わい
    lines.push('\n## 味わい');
    if (data.sweetness) lines.push(`- 甘辛: ${data.sweetness}`);
    if (typeof data.acidityScore === 'number') lines.push(`- 酸味: ${round1(data.acidityScore)}（${acidityLabel(data.acidityScore)}）`);
    if (typeof data.tanninScore === 'number')  lines.push(`- タンニン分: ${round1(data.tanninScore)}（${tanninLabel(data.tanninScore)}）`);
    if (typeof data.balanceScore === 'number') lines.push(`- バランス: ${round1(data.balanceScore)}（${balanceLabel(data.balanceScore)}）`);
    if (typeof data.alcoholABV === 'number')   lines.push(`- アルコール: ${round1(data.alcoholABV)}%`);
    if (typeof data.finishLen === 'number')    lines.push(`- 余韻: ${Math.round(data.finishLen)}（${finishLenLabel(data.finishLen)}）`);
    if (data.palateNotes) lines.push(`- 補足: ${data.palateNotes}`);

    // その他
    lines.push('\n## メモ');
    if (data.additionalInfo) lines.push(`- 補足情報: ${data.additionalInfo}`);
    if (data.notes)          lines.push(`- ノート: ${data.notes}`);

    const bodyMarkdown = lines.join('\n');

    const page = await notion.pages.create({
    parent: { database_id: NOTION_DB_ID },
    properties: props,
    cover: data.imageUrl
        ? { type: 'external', external: { url: data.imageUrl } }
        : undefined,
    children: [
        // ① 画像ブロック（imageUrlが存在する場合のみ追加）
        data.imageUrl
        ? {
            object: 'block',
            type: 'image',
            image: {
                type: 'external',
                external: { url: data.imageUrl },
            },
            }
        : undefined,

        // ② 本文Markdown（paragraphブロック）
        {
        object: 'block',
        type: 'paragraph',
        paragraph: {
            rich_text: [
            {
                type: 'text',
                text: {
                content: bodyMarkdown,
                },
            },
            ],
        },
        },
    ].filter(Boolean) as any[], // ✅ undefinedを除去して型安全に
    });

    return page.id;
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