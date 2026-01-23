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
    bodyLabel,
    finishLenLabel,
    worldLabel,
    palateElementLabel,
    qualityLabel,
    noseIntensityLabel,
    colorLabel,
} from '@/lib/wineHelpers';

// Notion Client
const notion = new Client({ auth: process.env.NOTION_TOKEN! });
const NOTION_DB_ID = process.env.NOTION_DB_ID!;

// ---- Type Utilities ----
export type UnknownRecord = Record<string, unknown>;

export const asString = (v: unknown): string | undefined =>
    v == null ? undefined : String(v);

export const asNumber = (v: unknown): number | undefined => {
    if (v == null) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
};

export const parsePrice = (v: unknown): number | null => {
    if (v == null) return null;
    const s = String(v).replace(/[^\d]/g, '');
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
};

// Google Sheets Append Logic
export async function appendToSheet(row: Record<string, unknown>): Promise<void> {
    const serviceAccountAuth = new JWT({
        email: process.env.GOOGLE_CLIENT_EMAIL!,
        key: process.env.GOOGLE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID!, serviceAccountAuth);
    await doc.loadInfo();

    // Select Sheet by GID or first sheet
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

    // Prepare Header
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

    // Format Cells
    type RowCell = string | number | boolean | Date;

    const serializeCell = (v: unknown): RowCell => {
        if (v == null) return '';
        if (Array.isArray(v)) return v.join(', ');
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

    const enriched: Record<string, unknown> = {
        createdAt: new Date().toISOString(),
        ...row,
    };

    const values: RowCell[] = mergedHeaders.map(h => serializeCell(enriched[h]));

    await sheet.addRow(values);
}

// Notion Append Logic
export async function appendToNotion(data: UnknownRecord) {

    const toAbsoluteUrl = (url: string | undefined): string | undefined => {
        if (!url) return undefined;
        if (url.startsWith('http')) return url;
        const base = process.env.PUBLIC_BASE_URL ??
            (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
        const baseUrl = base.endsWith('/') ? base.slice(0, -1) : base;
        const path = url.startsWith('/') ? url : `/${url}`;
        return `${baseUrl}${path}`;
    };

    const rawImageUrl = asString(data.imageUrl);
    const imageUrl = toAbsoluteUrl(rawImageUrl);

    // ========== Properties ==========
    const props: CreatePageParameters['properties'] = {
        'Wine Name': {
            title: [{ type: 'text', text: { content: asString(data.wineName) ?? '' } }],
        },

        ...(asString(data.date)
            ? { Date: { date: { start: asString(data.date)! } } }
            : {}),

        ...(asString(data.place)
            ? { Place: { rich_text: [{ type: 'text', text: { content: asString(data.place)! } }] } }
            : {}),

        ...(imageUrl
            ? {
                ImageURL: {
                    files: [
                        {
                            type: 'external',
                            name: 'image',
                            external: { url: imageUrl },
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

    // ========== Blocks (Content) ==========
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

    if (imageUrl) {
        blocks.push({
            type: 'image',
            image: { type: 'external', external: { url: imageUrl } },
        });
    }

    // Tasting Info
    pushHeading('テイスティング情報');
    pushKV('日付', asString(data.date));
    const priceNum = parsePrice(data.price);
    pushKV('ボトル価格', priceNum != null ? `${priceNum} 円` : undefined);
    pushKV('飲んだ/購入した場所', asString(data.place));

    // Wine Info
    pushHeading('ワイン情報');
    pushKV('ワイン名', asString(data.wineName));
    pushKV('生産者', asString(data.producer));
    pushKV('輸入元', asString(data.importer));
    pushKV('国', asString(data.country));
    pushKV('地名', asString(data.locality));
    pushKV('主体の品種', asString(data.mainVariety));
    pushKV('その他の品種', asString(data.otherVarieties));
    pushKV('補足情報', asString(data.additionalInfo));
    pushKV('ヴィンテージ', asString(data.vintage));

    // Appearance
    pushHeading('外観');
    {
        const v = asNumber(data.intensity);
        if (typeof v === 'number') {
            pushKV('濃淡', `${round1(v)} (${intensityLabel(v)})`);
        }
    }
    {
        const v = asNumber(data.color);
        if (typeof v === 'number') {
            const type = asString(data.wineType) || '赤';
            pushKV('色調', `${round1(v)} (${colorLabel(v, type)})`);
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

    // Nose
    pushHeading('香り');
    pushKV('コンディション', asString(data.noseCondition));
    {
        const v = asNumber(data.noseIntensity);
        if (typeof v === 'number') {
            pushKV('香りの強さ', `${round1(v)} (${noseIntensityLabel(v)})`);
        }
    }
    pushKV('熟成段階', asString(data.development));

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

    // Palate
    pushHeading('味わい');
    {
        const v = asNumber(data.sweetness);
        if (typeof v === 'number') {
            pushKV('甘味', `${round1(v)} (${palateElementLabel(v, 'sweetness')})`);
        }
    }
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

    // Body / Balance
    {
        const v = asNumber(data.bodyScore);
        if (typeof v === 'number') {
            pushKV('ボディ', `${round1(v)} (${bodyLabel(v)})`);
        }
    }

    pushKV('アルコール', asString(data.alcohol));

    // Finish
    {
        const v = asNumber(data.finishScore);
        if (typeof v === 'number') {
            pushKV('余韻', `${round1(v)} (${finishLenLabel(v)})`);
        }
    }

    {
        const v = asNumber(data.alcoholABV);
        if (typeof v === 'number') {
            pushKV('アルコール度数', `${round1(v)}%`);
        }
    }
    pushKV('味わいの補足', asString(data.palateNotes));

    // Evaluation
    pushHeading('総合評価');
    {
        const v = asNumber(data.qualityScore);
        if (typeof v === 'number') {
            pushKV('品質', `SAT: ${round1(v)} (${qualityLabel(v)})`);
        }
    }
    pushKV('熟成の可能性', asString(data.readiness));

    pushKV('評価コメント', asString(data.evaluation)); // Legacy evaluation field? WineForm removed it.
    {
        const v = asNumber(data.rating);
        if (typeof v === 'number') {
            pushKV('総合評価(Personal)', `${round1(v)} ⭐️`);
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
