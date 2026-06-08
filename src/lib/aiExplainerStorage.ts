import type { VisualWineExplanation } from "@/app/actions/gemini";
import type { WineFormValues } from "@/components/WineForm";
import { SAT_AROMA_DEFINITIONS } from "@/constants/sat_aromas";
import type { TastingNote } from "@/types/custom";

export const AI_EXPLAINER_CURRENT_ID_KEY = "wine-ai-visual-explanation-current-id";
export const AI_EXPLAINER_CLIENT_KEY = "wine-ai-visual-explanation-client-key";
export const AI_EXPLAINER_RECORD_DRAFT_KEY = "wine-ai-visual-explanation-record-draft";
export const WINE_FORM_NEW_DRAFT_KEY = "wine-form-new";

export interface AiExplainerInput {
    wineName: string;
    producer: string;
    vintage: string;
    country: string;
    locality: string;
    imageUrl: string;
    price: string;
    sourceWineId?: number;
}

export interface StoredVisualExplanation {
    id: string;
    generatedAt: string;
    imageUrl: string;
    input: AiExplainerInput;
    explanation: VisualWineExplanation;
}

export interface AiExplainerHistoryItem {
    id: string;
    generatedAt: string;
    wineName: string;
    producer: string;
    vintage: string;
    country: string;
    locality: string;
    imageUrl: string;
    headline: string;
    price?: number | null;
    sourceWineId?: number;
}

function isBrowser() {
    return typeof window !== "undefined";
}

function compact(values: Array<string | null | undefined>) {
    return values.map((value) => value?.trim()).filter(Boolean) as string[];
}

function asList<T>(value: T[] | undefined | null): T[] {
    return Array.isArray(value) ? value : [];
}

function snapHalf(value: number) {
    return Math.round(value * 2) / 2;
}

function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

function scaleValueToTen(value: number | undefined | null) {
    if (typeof value !== "number" || !Number.isFinite(value)) return null;
    const normalized = value <= 10 ? value : value / 10;
    return snapHalf(clamp(normalized, 0, 10));
}

function scaleValueToFive(value: number | undefined | null) {
    const ten = scaleValueToTen(value);
    if (ten == null) return null;
    return snapHalf(clamp(1 + (ten / 10) * 4, 1, 5));
}

function parsePrice(value: string | number | null | undefined) {
    if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.round(value));
    const raw = String(value ?? "").replace(/[^\d]/g, "");
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
}

function hasJapaneseParenthetical(value: string | undefined | null) {
    return /[（(][^）)]*[\u3040-\u30ff\u3400-\u9fff][^）)]*[）)]/.test(value || "");
}

function preferAiSearchFormat(primary: string | undefined, fallback: string | undefined) {
    if (hasJapaneseParenthetical(primary)) return primary || "";
    if (hasJapaneseParenthetical(fallback)) return fallback || "";
    return primary || fallback || "";
}

function createClientKey() {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
        return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2, 18)}`;
}

export function getAiExplainerClientKey() {
    if (!isBrowser()) return null;

    const existing = localStorage.getItem(AI_EXPLAINER_CLIENT_KEY);
    if (existing) return existing;

    const next = createClientKey();
    localStorage.setItem(AI_EXPLAINER_CLIENT_KEY, next);
    return next;
}

export function saveCurrentAiExplanationId(id: string) {
    if (!isBrowser()) return;
    sessionStorage.setItem(AI_EXPLAINER_CURRENT_ID_KEY, id);
}

export function readCurrentAiExplanationId() {
    if (!isBrowser()) return null;
    return sessionStorage.getItem(AI_EXPLAINER_CURRENT_ID_KEY);
}

export function createAiExplainerInputFromTastingNote(wine: TastingNote): AiExplainerInput {
    const imageUrl = wine.images?.[0]?.url || wine.image_url || wine.images?.[0]?.thumbnail_url || "";

    return {
        wineName: wine.wine_name || "",
        producer: wine.producer || "",
        vintage: wine.vintage || "",
        country: wine.country || "",
        locality: wine.locality || wine.region || "",
        imageUrl,
        price: wine.price ? String(wine.price) : "",
        sourceWineId: wine.id,
    };
}

function todayDateString() {
    const date = new Date();
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}

const COUNTRY_MAP: Record<string, string> = {
    France: "フランス",
    Italy: "イタリア",
    Spain: "スペイン",
    Germany: "ドイツ",
    Austria: "オーストリア",
    Switzerland: "スイス",
    USA: "アメリカ",
    "United States": "アメリカ",
    Chile: "チリ",
    Argentina: "アルゼンチン",
    Australia: "オーストラリア",
    "New Zealand": "ニュージーランド",
    Japan: "日本",
    "South Africa": "南アフリカ",
    Portugal: "ポルトガル",
    Greece: "ギリシャ",
    Georgia: "ジョージア",
};

function normalizeCountry(country: string) {
    return COUNTRY_MAP[country] || country;
}

const GRAPE_RULES: Array<{ value: string; patterns: RegExp[] }> = [
    { value: "ピノ・ノワール", patterns: [/pinot noir/i, /ピノ[・\s-]?ノワール/] },
    { value: "カベルネ・ソーヴィニヨン", patterns: [/cabernet sauvignon/i, /カベルネ/] },
    { value: "メルロ", patterns: [/merlot/i, /メルロ/] },
    { value: "シラー/シラーズ", patterns: [/syrah/i, /shiraz/i, /シラー/] },
    { value: "サンジョヴェーゼ", patterns: [/sangiovese/i, /サンジョヴェーゼ/] },
    { value: "ネッビオーロ", patterns: [/nebbiolo/i, /ネッビオーロ/] },
    { value: "グルナッシュ", patterns: [/grenache/i, /garnacha/i, /グルナッシュ/] },
    { value: "ジンファンデル", patterns: [/zinfandel/i, /ジンファンデル/] },
    { value: "シャルドネ", patterns: [/chardonnay/i, /シャルドネ/] },
    { value: "ソーヴィニヨン・ブラン", patterns: [/sauvignon blanc/i, /ソ[ーォ]ヴィニヨン/] },
    { value: "リースリング", patterns: [/riesling/i, /リースリング/] },
    { value: "シュナン・ブラン", patterns: [/chenin blanc/i, /シュナン/] },
    { value: "ピノ・グリ", patterns: [/pinot gris/i, /pinot grigio/i, /ピノ[・\s-]?グリ/] },
    { value: "ヴィオニエ", patterns: [/viognier/i, /ヴィオニエ/] },
    { value: "ゲヴュルツトラミネール", patterns: [/gew[uü]rztraminer/i, /ゲヴュルツ/] },
    { value: "アルバリーニョ", patterns: [/albari[nñ]o/i, /アルバリーニョ/] },
];

function normalizeMainVariety(grapes: string[]) {
    const joined = grapes.join(" / ");
    return GRAPE_RULES.find((rule) => rule.patterns.some((pattern) => pattern.test(joined)))?.value || "";
}

function inferWineType(explanation: VisualWineExplanation): WineFormValues["wineType"] {
    const text = [
        explanation.wine.name,
        explanation.wine.style,
        explanation.headline,
        ...asList(explanation.wine.grapeVarieties),
    ].join(" ");

    if (/sparkling|champagne|cr[eé]mant|cava|prosecco|発泡|泡/i.test(text)) {
        return /ros[eé]|ロゼ/i.test(text) ? "発泡ロゼ" : "発泡白";
    }
    if (/orange|オレンジ/i.test(text)) return "オレンジ";
    if (/ros[eé]|ロゼ/i.test(text)) return "ロゼ";
    if (/white|blanc|bianco|シャルドネ|ソ[ーォ]ヴィニヨン|リースリング|白/i.test(text)) return "白";
    return "赤";
}

function tastingText(explanation: VisualWineExplanation) {
    return compact([
        explanation.wine.name,
        explanation.wine.producer,
        explanation.wine.style,
        explanation.headline,
        explanation.lead,
        explanation.tasting.overview,
        ...asList(explanation.tasting.aroma),
        ...asList(explanation.tasting.palate),
        explanation.tasting.finish,
        ...asList(explanation.tasting.scales).map((scale) => `${scale.label} ${scale.note}`),
    ]).join(" ");
}

function findScale(explanation: VisualWineExplanation, patterns: RegExp[], rejectPatterns: RegExp[] = []) {
    return asList(explanation.tasting.scales).find((scale) => {
        const text = `${scale.label} ${scale.note}`;
        return patterns.some((pattern) => pattern.test(text)) && !rejectPatterns.some((pattern) => pattern.test(text));
    });
}

function inferScaleTen(explanation: VisualWineExplanation, patterns: RegExp[], rejectPatterns: RegExp[] = []) {
    return scaleValueToTen(findScale(explanation, patterns, rejectPatterns)?.value);
}

function inferKeywordScore(text: string, rules: Array<{ score: number; patterns: RegExp[] }>) {
    return rules.find((rule) => rule.patterns.some((pattern) => pattern.test(text)))?.score ?? null;
}

function inferColorScore(wineType: WineFormValues["wineType"], text: string) {
    if (wineType === "白" || wineType === "発泡白") {
        return inferKeywordScore(text, [
            { score: 9, patterns: [/琥珀|褐色|アンバー|酸化/i] },
            { score: 7, patterns: [/黄金|ゴールド|熟成|蜂蜜|ハチミツ/i] },
            { score: 4, patterns: [/レモン|シトラス|柑橘|若い|フレッシュ/i] },
            { score: 2, patterns: [/緑|グリーン/i] },
        ]) ?? 4;
    }

    if (wineType === "ロゼ" || wineType === "発泡ロゼ" || wineType === "オレンジ") {
        return inferKeywordScore(text, [
            { score: 8, patterns: [/オレンジ|琥珀|アンバー/i] },
            { score: 5, patterns: [/サーモン/i] },
            { score: 3, patterns: [/ピンク|淡い/i] },
        ]) ?? 4.5;
    }

    return inferKeywordScore(text, [
        { score: 8, patterns: [/ガーネット|トーニー|レンガ|熟成|褐色/i] },
        { score: 5, patterns: [/ルビー|赤系/i] },
        { score: 2, patterns: [/紫|パープル|若い/i] },
    ]) ?? 4.5;
}

function inferAppearanceIntensity(explanation: VisualWineExplanation, wineType: WineFormValues["wineType"], text: string) {
    return inferScaleTen(explanation, [/濃淡|色の?濃|色調|外観/]) ?? inferKeywordScore(text, [
        { score: 7.5, patterns: [/濃い|深い|凝縮|黒系|フルボディ|力強/i] },
        { score: 5.5, patterns: [/中程度|ミディアム/i] },
        { score: 3.5, patterns: [/淡い|ライト|繊細|エレガント/i] },
    ]) ?? (wineType === "赤" ? 5.5 : 4);
}

function inferDevelopment(explanation: VisualWineExplanation, text: string): WineFormValues["development"] {
    if (/ピークを過ぎ|疲れ|枯れ/.test(text)) return "ピークを過ぎた/疲れている";
    if (/熟成した|第三アロマ|なめし革|皮革|タバコ|キノコ|ドライフルーツ|レーズン|蜂蜜|ハチミツ/.test(text)) return "熟成した";
    if (/熟成中|発展|瓶熟|ガーネット/.test(text)) return "熟成中";

    const vintage = Number.parseInt(explanation.wine.vintage || "", 10);
    if (Number.isFinite(vintage)) {
        const age = new Date().getFullYear() - vintage;
        if (age >= 12) return "熟成した";
        if (age >= 5) return "熟成中";
    }

    return "若い";
}

function inferOldNewWorld(country: string) {
    if (/フランス|イタリア|スペイン|ドイツ|オーストリア|ポルトガル|ギリシャ|ジョージア|France|Italy|Spain|Germany|Austria|Portugal|Greece|Georgia/i.test(country)) {
        return 2;
    }
    if (/アメリカ|チリ|アルゼンチン|オーストラリア|ニュージーランド|南アフリカ|USA|United States|Chile|Argentina|Australia|New Zealand|South Africa/i.test(country)) {
        return 4;
    }
    return null;
}

function inferFruitMaturity(text: string) {
    return inferKeywordScore(text, [
        { score: 5, patterns: [/ドライフルーツ|乾燥|レーズン|プルーン/i] },
        { score: 4.5, patterns: [/ジャム|コンフィチュール/i] },
        { score: 3.5, patterns: [/コンポート|煮込|焼いた|熟した/i] },
        { score: 2.5, patterns: [/完熟|リッチ/i] },
        { score: 1.5, patterns: [/フレッシュ|爽やか|若い|赤系果実|柑橘/i] },
    ]);
}

function inferAromaNeutrality(explanation: VisualWineExplanation, text: string) {
    const grapes = asList(explanation.wine.grapeVarieties).join(" ");
    if (/ゲヴュルツ|Gew[uü]rz|ヴィオニエ|Viognier|リースリング|Riesling|ソ[ーォ]ヴィニヨン|Sauvignon|ミュスカ|Muscat|アルバリーニョ|Albari[nñ]o|華やか|アロマティック/i.test(`${grapes} ${text}`)) {
        return 4.2;
    }
    if (/シャルドネ|Chardonnay|ピノ[・\s-]?グリ|Pinot Gris|Pinot Grigio|シュナン|Chenin|ニュートラル/i.test(`${grapes} ${text}`)) {
        return 2.4;
    }
    return null;
}

function inferOakAroma(explanation: VisualWineExplanation, text: string) {
    return scaleValueToFive(findScale(explanation, [/樽|オーク|oak/i])?.value) ?? inferKeywordScore(text, [
        { score: 4.5, patterns: [/強い樽|樽香が強|オークが強|ヴァニラ|バニラ|ココナッツ|トースト|スギ|焦がした木/i] },
        { score: 3.5, patterns: [/樽|オーク|クローヴ|ナツメグ|燻製|チョコレート|コーヒー/i] },
        { score: 2, patterns: [/控えめな樽|穏やかな樽|古樽/i] },
    ]);
}

function inferSweetness(text: string) {
    if (/極甘口/.test(text)) return 6;
    if (/中甘口/.test(text)) return 4;
    if (/中辛口/.test(text)) return 3;
    if (/甘口/.test(text)) return 5;
    if (/オフドライ/.test(text)) return 2;
    if (/辛口|ドライ/.test(text)) return 1;
    return 1;
}

function inferAlcoholAbv(text: string) {
    const match = text.match(/(\d{1,2}(?:\.\d)?)\s?%/);
    if (!match) return null;
    const value = Number(match[1]);
    return Number.isFinite(value) ? value : null;
}

function inferReadiness(text: string): WineFormValues["readiness"] {
    if (/ピークを過ぎ|疲れ/.test(text)) return "ピークを過ぎている";
    if (/若すぎ|硬い|閉じている/.test(text)) return "若すぎる";
    if (/熟成可能|熟成の余地|今飲めるが/.test(text)) return "今飲めるが熟成可能";
    if (/飲み頃|今がピーク/.test(text)) return "今が飲み頃";
    return "今飲めるが熟成可能";
}

const SAT_AROMA_TERMS = SAT_AROMA_DEFINITIONS.flatMap((layer) =>
    layer.categories.flatMap((category) => category.terms)
);

function inferStructuredAromas(explanation: VisualWineExplanation) {
    const aromaTexts = [
        ...asList(explanation.tasting.aroma),
        ...asList(explanation.tasting.aromaVisuals).flatMap((item) => [item.label, item.description]),
    ].map((item) => item.trim()).filter(Boolean);
    const selected = new Set<string>();

    for (const aromaText of aromaTexts) {
        for (const term of SAT_AROMA_TERMS) {
            if (aromaText.includes(term) || term.includes(aromaText)) {
                selected.add(term);
            }
        }
    }

    return Array.from(selected).slice(0, 14);
}

function section(title: string, body: string | string[] | undefined) {
    const lines = Array.isArray(body) ? body : body ? [body] : [];
    const text = compact(lines);
    if (text.length === 0) return "";
    return `【${title}】\n${text.join("\n")}`;
}

export function createWineFormDefaultsFromVisualExplanation(data: StoredVisualExplanation): Partial<WineFormValues> {
    const explanation = data.explanation;
    const wine = explanation.wine;
    const wineType = inferWineType(explanation);
    const grapes = asList(wine.grapeVarieties);
    const mainVariety = normalizeMainVariety(grapes);
    const otherVarieties = grapes.filter((grape) => grape !== mainVariety).join(", ");
    const source = asList(explanation.sources).find((item) => item.url);
    const imageUrl = data.imageUrl || data.input.imageUrl || "";
    const allText = tastingText(explanation);
    const acidityScore = inferScaleTen(explanation, [/酸味|酸/]) ?? inferKeywordScore(allText, [
        { score: 8, patterns: [/高い酸|酸が高|シャープ|フレッシュ|爽快|冷涼/i] },
        { score: 5, patterns: [/中程度の酸|酸は中程度|バランス/i] },
        { score: 3, patterns: [/低い酸|酸は穏やか|まろやか/i] },
    ]);
    const tanninScore = wineType === "白" || wineType === "発泡白" || wineType === "ロゼ" || wineType === "発泡ロゼ"
        ? null
        : inferScaleTen(explanation, [/タンニン/]) ?? inferKeywordScore(allText, [
            { score: 8, patterns: [/強いタンニン|堅牢|収斂|グリップ|骨格/i] },
            { score: 5, patterns: [/中程度のタンニン|シルキー|細やか/i] },
            { score: 3, patterns: [/穏やかなタンニン|柔らかいタンニン/i] },
        ]);
    const bodyScore = inferScaleTen(explanation, [/ボディ|重さ|厚み/]) ?? inferKeywordScore(allText, [
        { score: 8, patterns: [/フルボディ|厚み|凝縮|力強/i] },
        { score: 5, patterns: [/ミディアム|中程度/i] },
        { score: 3, patterns: [/ライト|軽やか|繊細/i] },
    ]);
    const finishScore = inferScaleTen(explanation, [/余韻|フィニッシュ/]) ?? inferKeywordScore(allText, [
        { score: 8, patterns: [/長い余韻|余韻が長|持続/i] },
        { score: 5, patterns: [/中程度の余韻|余韻は中程度/i] },
        { score: 3, patterns: [/短い余韻|軽い余韻/i] },
    ]);
    const noseIntensity = inferScaleTen(explanation, [/香り|アロマ|芳香/], [/樽|オーク/]) ?? inferKeywordScore(allText, [
        { score: 8, patterns: [/華やか|芳醇|強い香り|香りが強|豊かな香り/i] },
        { score: 5, patterns: [/中程度の香り|穏やか/i] },
        { score: 3, patterns: [/控えめ|繊細な香り/i] },
    ]);
    const price = parsePrice(data.input.price) ?? parsePrice(wine.marketPriceJpy);

    return {
        date: todayDateString(),
        aiExplanationId: data.id,
        price: price ? String(price) : "",
        imageUrl,
        images: imageUrl ? [{ url: imageUrl, display_order: 0 }] : [],
        wineType,
        wineName: preferAiSearchFormat(wine.name, data.input.wineName),
        producer: preferAiSearchFormat(wine.producer, data.input.producer),
        vintage: wine.vintage || data.input.vintage || "",
        country: normalizeCountry(wine.country || data.input.country || ""),
        locality: wine.region || data.input.locality || "",
        region: wine.region || data.input.locality || "",
        mainVariety,
        otherVarieties,
        referenceUrl: source?.url || "",
        additionalInfo: compact([
            "AI解説ページから作成",
            explanation.headline,
            explanation.lead,
            section("要点", asList(explanation.keyTakeaways)),
            section("サービス", [
                explanation.serving.temperature,
                explanation.serving.glass,
                explanation.serving.decant,
                asList(explanation.serving.pairings).join(" / "),
            ]),
        ]).join("\n\n"),
        color: inferColorScore(wineType, allText),
        intensity: inferAppearanceIntensity(explanation, wineType, allText),
        clarity: "澄んだ",
        brightness: "輝きのある",
        appearanceOther: compact([
            "AI解説から推定",
            wine.style,
            explanation.tasting.overview,
        ]).join("\n"),
        noseIntensity,
        noseCondition: "良好 (Clean)",
        development: inferDevelopment(explanation, allText),
        oldNewWorld: inferOldNewWorld(wine.country || data.input.country || ""),
        fruitsMaturity: inferFruitMaturity(allText),
        aromaNeutrality: inferAromaNeutrality(explanation, allText),
        oakAroma: inferOakAroma(explanation, allText),
        aromas: inferStructuredAromas(explanation),
        aromaOther: compact(asList(explanation.tasting.aroma)).join("\n"),
        sweetness: inferSweetness(allText),
        acidityScore,
        tanninScore,
        bodyScore,
        alcoholABV: inferAlcoholAbv(allText) ?? undefined,
        finishScore,
        palateNotes: compact([
            explanation.tasting.overview,
            section("味わい", asList(explanation.tasting.palate)),
            section("余韻", explanation.tasting.finish),
        ]).join("\n\n"),
        readiness: inferReadiness(allText),
        notes: "",
        terroir_info: compact([
            explanation.terroir.summary,
            section("気候", explanation.terroir.climate),
            section("土壌", explanation.terroir.soil),
            section("影響要因", asList(explanation.terroir.influences).map((item) => `${item.title}: ${item.description}`)),
        ]).join("\n\n"),
        producer_philosophy: compact([
            explanation.producerStory.summary,
            explanation.producerStory.philosophy,
        ]).join("\n\n"),
        technical_details: compact([
            explanation.winemaking.summary,
            section("工程", asList(explanation.winemaking.steps).map((item) => `${item.label}: ${item.description}`)),
        ]).join("\n\n"),
        vintage_analysis: compact([
            explanation.vintage.summary,
            section("コンディション", asList(explanation.vintage.conditions)),
        ]).join("\n\n"),
        search_result_tasting_note: compact([
            explanation.tasting.overview,
            section("香り", asList(explanation.tasting.aroma)),
            section("味わい", asList(explanation.tasting.palate)),
            section("余韻", explanation.tasting.finish),
            section("参照範囲", asList(explanation.sourceNotes)),
        ]).join("\n\n"),
        status: "published",
    };
}

export function saveRecordDraftFromVisualExplanation(data: StoredVisualExplanation) {
    if (!isBrowser()) return;

    const defaults = createWineFormDefaultsFromVisualExplanation(data);
    const serialized = JSON.stringify(defaults);
    sessionStorage.setItem(AI_EXPLAINER_RECORD_DRAFT_KEY, serialized);
    sessionStorage.removeItem(WINE_FORM_NEW_DRAFT_KEY);
}

function readJson<T>(key: string): T | null {
    if (!isBrowser()) return null;

    const raw = sessionStorage.getItem(key);
    if (!raw) return null;

    try {
        return JSON.parse(raw) as T;
    } catch (error) {
        console.error(`Failed to parse ${key}`, error);
        return null;
    }
}

export function consumeRecordDraftFromVisualExplanation(): Partial<WineFormValues> | null {
    const draft = readJson<Partial<WineFormValues>>(AI_EXPLAINER_RECORD_DRAFT_KEY);
    if (isBrowser()) {
        sessionStorage.removeItem(AI_EXPLAINER_RECORD_DRAFT_KEY);
        sessionStorage.removeItem(WINE_FORM_NEW_DRAFT_KEY);
    }
    return draft;
}
