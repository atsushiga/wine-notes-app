'use server';

import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import sharp from "sharp";

import { storage, BUCKET } from "@/lib/gcs";
import { COUNTRY_MAP } from "@/lib/geoUtils";
import { getSupabaseClient } from "@/lib/supabase";

const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const openaiApiKey = process.env.OPENAI_API_KEY;
const GEMINI_MODEL = process.env.GOOGLE_GENERATIVE_AI_MODEL || "gemini-2.5-flash";
const OPENAI_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
const OPENAI_IMAGE_QUALITY = (process.env.OPENAI_IMAGE_QUALITY || "high") as "low" | "medium" | "high" | "auto";
const ENABLE_VISUAL_IMAGE_GENERATION = process.env.GENERATE_VISUAL_WINE_IMAGES !== "false";

export interface WineImageAnalysis {
    wineName: string;
    producer: string;
    vintage: string;
    country: string;
    locality: string;
    locality_vocab_id?: number | null;
    price: number | null;
}

interface GeoCandidate {
    id: number;
    name: string;
    name_ja: string | null;
    level: string;
    country: string | null;
    parent_hint: string | null;
    similarity: number;
}

async function resolveLocality(countryJa: string, localityText: string): Promise<{ name: string; id: number } | null> {
    if (!localityText || localityText.trim().length === 0) return null;
    // Normalized search term
    const qNorm = localityText.trim().toLowerCase();

    // Resolve country filter
    let targetCountry: string | null = null;
    if (countryJa && COUNTRY_MAP[countryJa] !== undefined) {
        targetCountry = COUNTRY_MAP[countryJa]; // Can be null if 'その他'
    }

    const supabase = getSupabaseClient();

    try {
        // 1. Candidate Retrieval
        const { data: candidates, error } = await supabase.rpc('search_geo_vocab', {
            search_term: qNorm,
            target_country: targetCountry,
            max_results: 20
        });

        if (error || !candidates || candidates.length === 0) {
            console.warn("Locality resolution: No candidates or error", error);
            return null;
        }

        // 2. Gemini Re-ranking
        const genAI = new GoogleGenerativeAI(apiKey!);
        const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

        const candidateListJson = JSON.stringify(candidates.map((c: any) => ({
            id: c.id,
            primary_label: c.name_ja || c.name,
            name: c.name,
            level: c.level,
            parent_hint: c.parent_hint,
            country: c.country
        })));

        const prompt = `
        You must choose the best matching candidate from the provided list for the given locality.
        
        Input:
        - Extracted Locality: "${localityText}"
        - Extracted Country (JP): "${countryJa}" (Mapped: "${targetCountry || 'None'}")
        - Candidates:
        ${candidateListJson}

        Instructions:
        1. Compare the "Extracted Locality" with the "Candidates".
        2. Select the candidate that represents the same region.
        3. You MUST NOT invent regions or IDs. Select from the list only.
        4. If none match well, return selected_id: null.

        Return JSON ONLY:
        {
            "selected_id": number | null,
            "confidence": number, // 0.0 to 1.0
            "reason": "short explanation <= 200 chars"
        }
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text().replace(/```json/g, "").replace(/```/g, "").trim();
        const json = JSON.parse(text);

        if (json.selected_id) {
            const selected = candidates.find((c: any) => c.id === json.selected_id);
            if (selected) {
                // Return canonical label: prefer name_ja
                return {
                    name: selected.name_ja || selected.name,
                    id: selected.id
                };
            }
        }

        return null; // Fallback to original text if null returned

    } catch (e) {
        console.error("resolveLocality failed:", e);
        return null;
    }
}

export async function analyzeWineImage(imageUrl: string): Promise<WineImageAnalysis> {
    if (!apiKey) {
        throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set");
    }

    // Extract key from URL
    const urlParts = imageUrl.split('/api/images/');
    if (urlParts.length < 2) {
        throw new Error("Invalid image URL format.");
    }
    const key = decodeURIComponent(urlParts[1]);

    // Download image from GCS
    const file = storage.bucket(BUCKET).file(key);
    const [buffer] = await file.download();
    let mimeType = "image/jpeg";
    try {
        const [metadata] = await file.getMetadata();
        if (metadata.contentType) {
            mimeType = metadata.contentType;
        }
    } catch {
        // Fall back to JPEG; existing uploads are commonly JPG/JPEG.
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

    const prompt = `
    Analyze this wine label image and extract the following information.
    Return the result strictly as a valid JSON object.

    1. wineName: The full name of the wine. Format: "Original Name (Japanese Name)". **CRITICAL**: You MUST include the Japanese Katakana translation in parentheses. If it is not on the label, you MUST translate or transliterate it yourself. Example: "Bourgogne Hautes-Côtes de Nuits Blanc (ブルゴーニュ オート・コート・ド・ニュイ ブラン)".
    2. producer: The producer or winery name. Format: "Original Name (Japanese Name)". **CRITICAL**: Include Japanese Katakana translation.
    3. vintage: The vintage year (4 digits, e.g., "2020"). If non-vintage or not found, use "NV".
    4. country: The country of origin. Must be one of: 'フランス', 'イタリア', 'スペイン', 'ドイツ', 'オーストリア', 'スイス', 'アメリカ', 'カナダ', 'チリ', 'アルゼンチン', 'オーストラリア', 'ニュージーランド', '日本', '南アフリカ', 'ポルトガル', 'ギリシャ', 'ジョージア', 'その他'.
    5. locality: The region, district, village, or vineyard. Format: "Region/Subregion/Village" in Original language or English. **CRITICAL**: You MUST include the Japanese Katakana translation in parentheses. Example: "Bourgogne/Côtes de Nuits/Vosne Romanee(ヴォーヌ・ロマネ)".
    6. price: Estimate the market price in Japanese Yen (JPY) as a single integer number (e.g. 5000). Do not include "円" or commas. If unknown or rare, make a reasonable estimate based on the appellation and producer.

    JSON Keys:
    - wineName
    - producer
    - vintage
    - country
    - locality
    - price
    `;

    const result = await model.generateContent([
        prompt,
        {
            inlineData: {
                data: buffer.toString("base64"),
                mimeType,
            },
        },
    ]);

    const response = await result.response;
    const text = response.text();
    const cleanedText = text.replace(/```json/g, "").replace(/```/g, "").trim();

    const analysis = JSON.parse(cleanedText) as WineImageAnalysis;

    // --- Locality Resolution Step ---
    try {
        if (analysis.locality && analysis.country) {
            const result = await resolveLocality(analysis.country, analysis.locality);
            if (result) {
                console.log(`Locality resolved: "${analysis.locality}" -> "${result.name}" (ID: ${result.id})`);
                analysis.locality = result.name;
                analysis.locality_vocab_id = result.id;
            } else {
                console.log(`Locality resolution skipped or failed for "${analysis.locality}"`);
                // Keep original
            }
        }
    } catch (err) {
        console.error("Locality resolution error (non-blocking):", err);
    }

    return analysis;
}


export interface GroundingData {
    terroir_info?: string;
    producer_philosophy?: string;
    technical_details?: string;
    vintage_analysis?: string;
    search_result_tasting_note?: string;
}

export interface VisualWineExplanationRequest {
    name: string;
    producer?: string;
    vintage?: string;
    country?: string;
    locality?: string;
    referenceUrl?: string;
}

export interface VisualScale {
    label: string;
    value: number;
    lowLabel: string;
    highLabel: string;
    note: string;
}

export interface TerroirMapCallout {
    label: string;
    description: string;
    position?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
    icon?: "coast" | "mountain" | "river" | "soil" | "slope" | "climate";
}

export interface VisualImageAsset {
    url?: string;
    prompt?: string;
    caption: string;
    sourceTitle?: string;
    sourceUrl?: string;
    kind?: "source" | "generated" | "source-backed-generated";
}

export interface AromaVisual {
    label: string;
    family: "fruit" | "floral" | "spice" | "earth" | "herbal" | "oak" | "mineral" | "other";
    color: string;
    description: string;
}

export interface VisualWineExplanation {
    wine: {
        name: string;
        producer: string;
        vintage: string;
        country: string;
        region: string;
        grapeVarieties: string[];
        style: string;
        classification: string;
    };
    headline: string;
    lead: string;
    keyTakeaways: string[];
    terroir: {
        title: string;
        summary: string;
        climate: string;
        soil: string;
        mapHint: string;
        mapCallouts?: TerroirMapCallout[];
        influences: { title: string; description: string }[];
    };
    producerStory: {
        summary: string;
        philosophy: string;
        milestones: { year: string; title: string; description: string }[];
    };
    winemaking: {
        summary: string;
        steps: { label: string; description: string }[];
    };
    vintage: {
        summary: string;
        conditions: string[];
    };
    tasting: {
        overview: string;
        aroma: string[];
        aromaVisuals?: AromaVisual[];
        palate: string[];
        finish: string;
        scales: VisualScale[];
    };
    serving: {
        temperature: string;
        glass: string;
        decant: string;
        pairings: string[];
    };
    studyPoints: { title: string; description: string }[];
    sourceNotes: string[];
    sources?: { title: string; url?: string }[];
    visualAssets?: {
        producer?: VisualImageAsset;
        map?: VisualImageAsset;
        aromaBoard?: VisualImageAsset;
    };
}

function extractJsonObjectText(text: string) {
    const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");

    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
        throw new Error("Model response did not contain a JSON object.");
    }

    return cleaned.slice(firstBrace, lastBrace + 1);
}

function parseJsonText<T>(jsonText: string): T {
    return JSON.parse(jsonText) as T;
}

async function parseJsonFromModel<T>(text: string): Promise<T> {
    const jsonText = extractJsonObjectText(text);

    try {
        return parseJsonText<T>(jsonText);
    } catch (initialError) {
        const withoutTrailingCommas = jsonText.replace(/,\s*([}\]])/g, "$1");
        try {
            return parseJsonText<T>(withoutTrailingCommas);
        } catch {
            if (!apiKey) throw initialError;

            const genAI = new GoogleGenerativeAI(apiKey);
            const repairModel = genAI.getGenerativeModel({ model: GEMINI_MODEL });
            const repairResult = await repairModel.generateContent(`
Repair the following invalid JSON into strictly valid JSON.
Do not add, remove, summarize, translate, or reinterpret content.
Return only one JSON object, with no markdown fences.

${jsonText}
`);
            const repairResponse = await repairResult.response;
            const repairedText = repairResponse.text();
            return parseJsonText<T>(extractJsonObjectText(repairedText));
        }
    }
}

function extractGroundingSources(response: any): { title: string; url?: string }[] {
    const chunks = response?.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (!Array.isArray(chunks)) return [];

    const seen = new Set<string>();
    const sources: { title: string; url?: string }[] = [];

    for (const chunk of chunks) {
        const web = chunk?.web;
        const url = web?.uri || web?.url;
        const title = web?.title || url;
        if (!title) continue;

        const key = url || title;
        if (seen.has(key)) continue;
        seen.add(key);
        sources.push({ title, url });
    }

    return sources.slice(0, 8);
}

type VisualImageStyle = "editorial" | "photo";

function imagePromptBase(prompt: string, options: { allowText?: boolean; style?: VisualImageStyle } = {}) {
    const textRule = options.allowText
        ? "short, readable Japanese map labels and callout captions are allowed only for terrain features"
        : "no readable text and no labels";
    const styleRequirements = options.style === "photo"
        ? [
            "photorealistic overhead flat-lay photograph",
            "natural tabletop surface, soft daylight, realistic shadows, high detail",
            "premium wine tasting workshop reference image, not a digital illustration",
        ]
        : [
            "premium Japanese wine lecture handout visual",
            "clean editorial illustration, warm neutral background, burgundy and muted gold accents",
            "high visual clarity, balanced composition",
        ];

    return `${prompt}

Style requirements:
- ${styleRequirements.join("\n- ")}
- ${textRule}
- no logos or watermark`;
}

function openAIImageSize(width: number, height: number): "1024x1024" | "1536x1024" | "1024x1536" {
    if (Math.abs(width - height) < 160) return "1024x1024";
    return width > height ? "1536x1024" : "1024x1536";
}

async function generateCompressedOpenAIImageDataUrl(
    prompt: string,
    width = 1200,
    height = 760,
    options: { allowText?: boolean; style?: VisualImageStyle } = {}
): Promise<string | null> {
    if (!openaiApiKey || !ENABLE_VISUAL_IMAGE_GENERATION) return null;

    try {
        const openai = new OpenAI({ apiKey: openaiApiKey });
        const result = await openai.images.generate({
            model: OPENAI_IMAGE_MODEL,
            prompt: imagePromptBase(prompt, options),
            quality: OPENAI_IMAGE_QUALITY,
            size: openAIImageSize(width, height),
            output_format: "webp",
            output_compression: 86,
            n: 1,
        });
        const base64 = result.data?.[0]?.b64_json;

        if (!base64) return null;

        const original = Buffer.from(base64, "base64");
        const compressed = await sharp(original)
            .resize({ width, height, fit: "cover", withoutEnlargement: true })
            .webp({ quality: 82 })
            .toBuffer();

        return `data:image/webp;base64,${compressed.toString("base64")}`;
    } catch (error) {
        console.warn("Visual image generation failed:", error);
        return null;
    }
}

function buildTerroirMapPrompt(query: VisualWineExplanationRequest, data: VisualWineExplanation) {
    const regionLabel = [
        data.wine?.country || query.country,
        data.wine?.region || query.locality,
        data.terroir?.title,
    ]
        .filter(Boolean)
        .join(" / ");

    const fallbackCallouts: TerroirMapCallout[] = [];
    if (data.terroir?.climate) {
        fallbackCallouts.push({ label: "気候", description: data.terroir.climate });
    }
    if (data.terroir?.soil) {
        fallbackCallouts.push({ label: "土壌", description: data.terroir.soil });
    }
    if (Array.isArray(data.terroir?.influences)) {
        fallbackCallouts.push(
            ...data.terroir.influences.map((item) => ({
                label: item.title,
                description: item.description,
            }))
        );
    }

    const callouts = Array.isArray(data.terroir?.mapCallouts) && data.terroir.mapCallouts.length > 0
        ? data.terroir.mapCallouts
        : fallbackCallouts;

    const calloutLines = callouts
        .slice(0, 4)
        .map((item) => `- ${item.label}: ${item.description}`)
        .join("\n");

    return `Create a geographically grounded illustrated terroir map for ${regionLabel || wineLabelForPrompt(query)}.
Use the actual wine region as reference: recognizable relative position of coastlines, mountains or hills, valleys, rivers, lakes, important nearby towns, and appellation/vineyard context where relevant.
This must look like an editorial regional map, not a fantasy landscape and not a satellite photo. If the exact vineyard is unknown, show the broader appellation or locality context accurately.
Add 3 to 4 compact Japanese callout caption boxes inside the map, connected with fine leader lines to the relevant terrain areas. Use these callouts:
${calloutLines || "- 地形: 産地の位置関係\n- 気候: 熟度を支える条件\n- 土壌: 味わいの骨格"}
Also include a small north arrow, restrained contour lines, vineyard dots or terraces, and subtle color coding for terrain.`;
}

function buildProducerImagePrompt(
    query: VisualWineExplanationRequest,
    data: VisualWineExplanation,
    asset?: VisualImageAsset
) {
    const producer = data.wine?.producer || query.producer || query.name;
    const region = [data.wine?.country || query.country, data.wine?.region || query.locality]
        .filter(Boolean)
        .join(" / ");
    const sourceContext = [asset?.sourceTitle, asset?.sourceUrl, asset?.caption]
        .filter(Boolean)
        .join(" / ");

    return `${asset?.prompt || `Create a source-backed editorial image of the producer estate, winery building, cellar, and surrounding vineyards for ${producer}.`}
Producer: ${producer}
Region: ${region || "unknown wine region"}
Source context: ${sourceContext || "Use the researched producer story and region context from the page content."}
Make the image feel like a premium wine lecture handout: realistic editorial rendering, vineyard and winery context, no bottle label close-up, no logos, no readable brand marks, no invented people.`;
}

function buildAromaBoardPrompt(query: VisualWineExplanationRequest, data: VisualWineExplanation) {
    const visualAromas = Array.isArray(data.tasting?.aromaVisuals) && data.tasting.aromaVisuals.length > 0
        ? data.tasting.aromaVisuals.map((item) => item.label)
        : [];
    const textAromas = Array.isArray(data.tasting?.aroma) ? data.tasting.aroma : [];
    const aromaObjects = [...visualAromas, ...textAromas]
        .map((item) => item.split(/[、,（(]/)[0]?.trim())
        .filter(Boolean)
        .slice(0, 6);

    return `Create a photorealistic overhead flat-lay aroma image for ${wineLabelForPrompt(query)}.
Arrange these aroma references as real objects on a natural tabletop: ${aromaObjects.join(", ") || "red cherries, raspberries, rose petals, violets, dried herbs, forest floor, spice"}.
Use actual fruits, flowers, herbs, spices, soil/mineral cues, and subtle oak or tea elements when relevant.
Composition: objects neatly placed on a wood or stone table, viewed from directly above, soft window light, realistic shadows, tasting workshop mood.
No text, no labels, no hands, no bottles, no glasses, no logos, no artificial collage look.`;
}

export async function searchWineDetails(wineId: number, query: { name: string; winery?: string; vintage?: string; country?: string; locality?: string; referenceUrl?: string }) {
    if (!apiKey) {
        throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: GEMINI_MODEL,
        tools: [
            {
                googleSearch: {},
            } as any,
        ],
    });

    // Build reference URL instruction
    const referenceUrlInstruction = query.referenceUrl 
        ? `\n\n**CRITICAL - Reference URL (MUST USE):**
    The following URL has been provided as a reference source. You MUST access and reference this URL when searching for information:
    ${query.referenceUrl}
    
    When this URL is available, prioritize information from this source and incorporate it into your analysis. If the URL contains official producer information, technical sheets, or professional reviews, use that as your primary source.`
        : '';

    // Build location context
    const locationContext = (query.country || query.locality) 
        ? `\n\n**Location Context:**
    - Country: ${query.country || "Not specified"}
    - Region/Locality: ${query.locality || "Not specified"}
    
    Use this location information to help determine the appropriate Tier level (Tier1-Tier4) when exact wine information is not available. For example, if the locality is specified (e.g., "Margaux"), you can infer Tier1 (Appellation level) information even if specific producer details are unavailable.`
        : '';

    const prompt = `
    You are assisting a wine tasting note application.
    Search the web for reliable, professional information about the following wine and summarize it in Japanese.

    Wine:
    - Name: ${query.name}
    - Producer/Winery: ${query.winery || "Unknown"}
    - Vintage: ${query.vintage || "Unknown"}${locationContext}${referenceUrlInstruction}

    Goal:
    Create calm, factual “reference material” to support the user’s own tasting notes
    in a SAT / WSET Level 3 context.
    This content is NOT a conclusion or evaluation, but background information.

    --------------------------------------------------
    Critical writing rules (VERY IMPORTANT):
    - Do NOT use promotional or marketing language
    (e.g. 「素晴らしい」「最高」「圧倒的」「世界的に高評価」).
    - Avoid strong conclusions. Prefer cautious phrasing:
    「〜とされる」「〜が見られる」「〜と報告されている」「一般に〜の傾向」.
    - Never tell the user what they “should” taste or conclude.
    - When summarizing tasting notes, distinguish clearly between:
    a) professional reports found online
    b) general regional or stylistic tendencies
    - Use SAT / WSET-style descriptors where appropriate
    (e.g. Medium(+), Pronounced, Long),
    but only when supported by sources or clearly stated as typical style.
    - Keep each section concise and easy to scan.
    - Write in neutral, textbook-like Japanese suitable for exam study.

    --------------------------------------------------
    Fallback search policy (EXTREMELY IMPORTANT):

    If reliable information about the exact wine / producer / vintage
    cannot be found, broaden the scope step-by-step.

    Use this fallback order and DO NOT skip levels unless necessary:

    Tier 0: Exact wine + producer + vintage (most specific)
    Tier 1: Appellation / village / commune (e.g. Margaux AOC)
    Tier 2: Sub-region (e.g. Médoc, Haut-Médoc)
    Tier 3: Regional level (e.g. Bordeaux, Left Bank)
    Tier 4: Country or grape general style (last resort)

    **IMPORTANT - Using Location Information:**
    When country and/or locality information is provided, use it to make more accurate Tier determinations:
    - If locality is specified (e.g., "Margaux", "Napa Valley"), you can confidently use Tier1 (Appellation level) information
    - If only country is specified, use Tier2-Tier3 (Sub-regional or Regional level) information
    - This helps avoid falling back to Tier4 (country/grape general style) unnecessarily

    For EACH field, explicitly state the reference scope
    at the beginning of the text in Japanese, for example:

    「【参照範囲: Tier0（生産者・キュヴェ固有）】」
    「【参照範囲: Tier1（AOC: Margaux）】」
    「【参照範囲: Tier2（地域: Médoc）】」

    If a broader Tier is used, briefly explain why
    (e.g. lack of producer-specific primary sources).
    Never present Tier1–4 information as if it were Tier0 facts.

    --------------------------------------------------
    Field-specific accuracy guidelines (IMPORTANT):

    - terroir_info:
    Tier1–3 information is acceptable and often valuable.
    Start with a short defining sentence (what/where/who) before details.
    Focus on soil, climate, location, and their general implications.

    - producer_philosophy:
    Prefer Tier0 only.
    Start with a short defining sentence (what/where/who) before details.
    Describe producer history, positioning, and winemaking philosophy (if available).
    If unavailable, clearly state that producer-specific philosophy
    could not be confirmed and avoid speculation.

    - technical_details:
    Prefer Tier0.
    This section is especially important for interpreting the tasting note.
    Provide more detailed and informative content than other sections.

    Include, where possible:
        - grape varieties and vine age (if known)
        - yield level (low / controlled / typical, if reported)
        - fermentation vessel and temperature tendency
        - maceration length and extraction style
        - malolactic fermentation details
        - aging vessel type, size, duration, and new oak ratio
        - filtration / fining approach (if mentioned)
        - stylistic intention relevant to structure and aroma

    Avoid speculation, but do not be overly brief.
    This section may be longer and more descriptive than others.

    If unavailable, describe “commonly reported” or “typical” methods
    at the applicable Tier, clearly labeled as such.

    - vintage_analysis:
    Tier2–3 is acceptable and often appropriate.
    Use regional vintage reports when exact producer data is unavailable.

    - search_result_tasting_note:
    Prefer Tier0 professional tasting notes.
    Summarize professional tasting notes found online (aroma / palate / finish / structure).
    Briefly mention acidity, tannin, and finish length using SAT-style terms when reasonably supported.
    If unavailable, summarize commonly reported regional style,
    clearly labeled as general tendency.
    If reports vary, mention the range briefly.

    --------------------------------------------------
    Output format:

    Return STRICTLY a valid JSON object (no markdown, no code blocks)
    with EXACTLY the following keys:

    1. terroir_info
    2. producer_philosophy
    3. technical_details
    4. vintage_analysis
    5. search_result_tasting_note

    Each field must be a single Japanese text string.
    Do not use markdown or code blocks. Use plain text in a structured way.

    --------------------------------------------------
    Missing information handling:

    If information cannot be found even after applying the fallback policy,
    write a short Japanese explanation such as:

    「公開情報から一次ソースで確認できず
    （公式資料・信頼できる専門レビューが見当たらないため）」

    but still provide the most appropriate broader Tier information if possible.

    Overall tone reminder:
    This content functions as background material for study and interpretation,
    similar to a wine exam reference book.
    Clarity and usefulness are more important than brevity.
    `;


    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Clean up markdown code blocks if present
        const cleanedText = text.replace(/```json/g, "").replace(/```/g, "").trim();

        const data = JSON.parse(cleanedText) as GroundingData;
        return data;
    } catch (error: any) {
        console.error("Gemini Search Error Full:", error);
        throw new Error(`Failed to fetch wine details: ${error.message || String(error)}`);
    }
}

export async function generateVisualWineExplanation(query: VisualWineExplanationRequest): Promise<VisualWineExplanation> {
    if (!apiKey) {
        throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set");
    }

    if (!query.name || query.name.trim().length === 0) {
        throw new Error("Wine name is required.");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: GEMINI_MODEL,
        tools: [
            {
                googleSearch: {},
            } as any,
        ],
    });

    const prompt = `
    You are creating a Japanese visual wine lecture page for a tasting-note app.
    Use Google Search grounding to research reliable web pages, prioritizing official producer pages,
    technical sheets, importer pages, and professional wine references.

    Wine:
    - Name: ${query.name}
    - Producer: ${query.producer || "Unknown"}
    - Vintage: ${query.vintage || "Unknown"}
    - Country: ${query.country || "Unknown"}
    - Region/Locality: ${query.locality || "Unknown"}
    - User reference URL: ${query.referenceUrl || "None"}

    Content goal:
    Produce structured Japanese content for a visual HTML page similar to a premium wine lecture handout:
    concise headline, producer story, terroir, climate, winemaking, vintage, tasting profile,
    serving suggestions, study points, and source notes.

    Important accuracy rules:
    - Prefer exact wine + producer + vintage when available.
    - If exact data is insufficient, clearly broaden scope in sourceNotes:
      Tier0 exact wine/producer/vintage, Tier1 appellation/locality, Tier2 sub-region, Tier3 region, Tier4 country/grape.
    - Do not use promotional claims. Use calm, factual, educational Japanese.
    - For tasting profile, distinguish reported/professional notes from general regional tendencies.
    - If a value is inferred, say so in sourceNotes or the relevant note.
    - Keep all strings short enough for card-style UI. Avoid markdown.

    Scale rules:
    - tasting.scales must contain 5 to 7 items.
    - Each value must be an integer from 0 to 100.
    - Use labels such as 酸味, 果実の熟度, 樽の存在感, ボディ, タンニン, アルコール感, 余韻.

    Return STRICTLY valid JSON only, with this exact shape:
    {
      "wine": {
        "name": "string",
        "producer": "string",
        "vintage": "string",
        "country": "string",
        "region": "string",
        "grapeVarieties": ["string"],
        "style": "string",
        "classification": "string"
      },
      "headline": "string",
      "lead": "string",
      "keyTakeaways": ["string", "string", "string"],
      "terroir": {
        "title": "string",
        "summary": "string",
        "climate": "string",
        "soil": "string",
        "mapHint": "string",
        "mapCallouts": [
          {
            "label": "海風",
            "description": "短い地形・気候キャプション",
            "position": "top-left",
            "icon": "coast"
          }
        ],
        "influences": [{"title": "string", "description": "string"}]
      },
      "producerStory": {
        "summary": "string",
        "philosophy": "string",
        "milestones": [{"year": "string", "title": "string", "description": "string"}]
      },
      "winemaking": {
        "summary": "string",
        "steps": [{"label": "string", "description": "string"}]
      },
      "vintage": {
        "summary": "string",
        "conditions": ["string"]
      },
      "tasting": {
        "overview": "string",
        "aroma": ["string"],
        "aromaVisuals": [{"label": "string", "family": "fruit", "color": "#b91c1c", "description": "string"}],
        "palate": ["string"],
        "finish": "string",
        "scales": [{"label": "string", "value": 70, "lowLabel": "string", "highLabel": "string", "note": "string"}]
      },
      "serving": {
        "temperature": "string",
        "glass": "string",
        "decant": "string",
        "pairings": ["string"]
      },
      "studyPoints": [{"title": "string", "description": "string"}],
      "sourceNotes": ["string"],
      "sources": [{"title": "string", "url": "string"}],
      "visualAssets": {
        "producer": {
          "prompt": "source-backed editorial image prompt for the producer estate, winery, cellar, or vineyard",
          "caption": "string",
          "sourceTitle": "official or importer source title",
          "sourceUrl": "official or importer source url"
        },
        "map": {
          "prompt": "image generation prompt for a geographically grounded illustrated regional terroir map with Japanese callout captions",
          "caption": "string"
        },
        "aromaBoard": {
          "prompt": "photorealistic overhead flat-lay image prompt for 4-6 representative aroma objects on a tabletop",
          "caption": "string"
        }
      }
    }

    For visualAssets:
    - producer.sourceUrl should prefer the producer's official winery/about page, then importer page.
    - terroir.mapCallouts must contain 3 to 4 short terrain features suited for labels inside the map.
      Use positions from top-left, top-right, bottom-left, bottom-right without repeating when possible.
      Use icons from coast, mountain, river, soil, slope, climate.
      Keep label under 8 Japanese characters and description under 28 Japanese characters.
    - map.prompt must describe a geographically grounded illustrated map of the actual region or broader appellation.
      It should mention recognizable coastlines, mountain ranges, hills, rivers, lakes, towns, appellation boundaries,
      vineyard dots/terraces, and 3 to 4 short Japanese callout captions when relevant.
    - aromaBoard.prompt must name 4-6 real aroma objects from tasting.aromaVisuals.
      The image style should be photorealistic, overhead flat-lay, objects arranged on a wood or stone tabletop,
      with no text, no labels, no hands, no bottles, and no glasses.
    - aromaVisuals must contain 4 to 6 representative aromas that can be rendered as image tiles.
    `;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        const data = await parseJsonFromModel<VisualWineExplanation>(text);
        const groundedSources = extractGroundingSources(response);

        if ((!data.sources || data.sources.length === 0) && groundedSources.length > 0) {
            data.sources = groundedSources;
        }

        data.visualAssets = data.visualAssets || {};

        const producerAsset = data.visualAssets.producer;
        const terroirMapPrompt = buildTerroirMapPrompt(query, data);
        const producerImagePrompt = buildProducerImagePrompt(query, data, producerAsset);
        const aromaBoardPrompt = buildAromaBoardPrompt(query, data);
        const [mapImage, producerGeneratedImage, aromaBoardImage] = await Promise.all([
            generateCompressedOpenAIImageDataUrl(
                terroirMapPrompt,
                1200,
                760,
                { allowText: true, style: "editorial" }
            ),
            generateCompressedOpenAIImageDataUrl(
                producerImagePrompt,
                1200,
                760,
                { style: "editorial" }
            ),
            generateCompressedOpenAIImageDataUrl(
                aromaBoardPrompt,
                1200,
                620,
                { style: "photo" }
            ),
        ]);

        if (data.visualAssets.map) {
            data.visualAssets.map.prompt = terroirMapPrompt;
            data.visualAssets.map.url = mapImage || data.visualAssets.map.url;
            data.visualAssets.map.kind = mapImage ? "generated" : data.visualAssets.map.kind;
        } else if (mapImage) {
            data.visualAssets.map = {
                url: mapImage,
                prompt: terroirMapPrompt,
                caption: "AI生成による実在地域ベースのテロワールマップ",
                kind: "generated",
            };
        }

        if (producerAsset) {
            producerAsset.prompt = producerImagePrompt;
            if (producerGeneratedImage) {
                producerAsset.url = producerGeneratedImage;
                producerAsset.kind = "source-backed-generated";
            }
        } else if (producerGeneratedImage) {
            data.visualAssets.producer = {
                url: producerGeneratedImage,
                prompt: producerImagePrompt,
                caption: "公開情報をもとにしたAI生成の生産者イメージ",
                kind: "source-backed-generated",
            };
        }

        if (data.visualAssets.aromaBoard) {
            data.visualAssets.aromaBoard.prompt = aromaBoardPrompt;
            data.visualAssets.aromaBoard.url = aromaBoardImage || data.visualAssets.aromaBoard.url;
            data.visualAssets.aromaBoard.kind = aromaBoardImage ? "generated" : data.visualAssets.aromaBoard.kind;
        } else if (aromaBoardImage) {
            data.visualAssets.aromaBoard = {
                url: aromaBoardImage,
                prompt: aromaBoardPrompt,
                caption: "AI生成による代表的な香りのイメージボード",
                kind: "generated",
            };
        }

        return data;
    } catch (error: any) {
        console.error("Gemini Visual Explanation Error Full:", error);
        throw new Error(`Failed to generate visual wine explanation: ${error.message || String(error)}`);
    }
}

function wineLabelForPrompt(query: VisualWineExplanationRequest) {
    return [
        query.producer,
        query.name,
        query.vintage,
        query.country,
        query.locality,
    ].filter(Boolean).join(", ");
}

export async function saveGeminiData(wineId: number, data: GroundingData) {
    const supabase = await createClient();

    const { error } = await supabase
        .from("tasting_notes")
        .update({
            terroir_info: data.terroir_info,
            producer_philosophy: data.producer_philosophy,
            technical_details: data.technical_details,
            vintage_analysis: data.vintage_analysis,
            search_result_tasting_note: data.search_result_tasting_note,
        })
        .eq("id", wineId);

    if (error) {
        console.error("Supabase Save Error:", error);
        throw new Error("Failed to save data to database.");
    }

    revalidatePath(`/wines/${wineId}`);
}
