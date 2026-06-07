import type { VisualWineExplanation } from "@/app/actions/gemini";
import type { WineFormValues } from "@/components/WineForm";
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

function section(title: string, body: string | string[] | undefined) {
    const lines = Array.isArray(body) ? body : body ? [body] : [];
    const text = compact(lines);
    if (text.length === 0) return "";
    return `【${title}】\n${text.join("\n")}`;
}

export function createWineFormDefaultsFromVisualExplanation(data: StoredVisualExplanation): Partial<WineFormValues> {
    const explanation = data.explanation;
    const wine = explanation.wine;
    const grapes = asList(wine.grapeVarieties);
    const mainVariety = normalizeMainVariety(grapes);
    const otherVarieties = grapes.filter((grape) => grape !== mainVariety).join(", ");
    const source = asList(explanation.sources).find((item) => item.url);
    const imageUrl = data.imageUrl || data.input.imageUrl || "";

    return {
        date: todayDateString(),
        imageUrl,
        images: imageUrl ? [{ url: imageUrl, display_order: 0 }] : [],
        wineType: inferWineType(explanation),
        wineName: wine.name || data.input.wineName,
        producer: wine.producer || data.input.producer || "",
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
        aromaOther: compact(asList(explanation.tasting.aroma)).join("\n"),
        palateNotes: compact([
            explanation.tasting.overview,
            section("味わい", asList(explanation.tasting.palate)),
            section("余韻", explanation.tasting.finish),
        ]).join("\n\n"),
        notes: compact([
            explanation.headline,
            explanation.lead,
            section("学習ポイント", asList(explanation.studyPoints).map((item) => `${item.title}: ${item.description}`)),
        ]).join("\n\n"),
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
    sessionStorage.setItem(WINE_FORM_NEW_DRAFT_KEY, serialized);
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
    }
    return draft;
}
