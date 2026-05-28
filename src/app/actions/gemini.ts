'use server';

import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

import { storage, BUCKET } from "@/lib/gcs";
import { COUNTRY_MAP } from "@/lib/geoUtils";
import { getSupabaseClient } from "@/lib/supabase";

const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

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
        const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });

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

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });

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
                mimeType: "image/jpeg", // Assuming JPEG for simplicity
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

const voiceFillableFields = [
    'clarity',
    'brightness',
    'sparkleIntensity',
    'appearanceOther',
    'intensity',
    'color',
    'noseIntensity',
    'noseCondition',
    'development',
    'oldNewWorld',
    'fruitsMaturity',
    'aromaNeutrality',
    'oakAroma',
    'aromas',
    'aromaOther',
    'sweetness',
    'acidityScore',
    'tanninScore',
    'bodyScore',
    'alcoholABV',
    'finishScore',
    'palateNotes',
    'qualityScore',
    'readiness',
    'rating',
    'notes',
] as const;

type VoiceFillableField = typeof voiceFillableFields[number];
type VoiceUpdates = Partial<Record<VoiceFillableField, unknown>>;

export interface TastingTranscriptInterpretation {
    updates: VoiceUpdates;
    summary?: string;
}

const voiceAllowedFields = new Set<string>(voiceFillableFields);

const stringEnumValues: Partial<Record<VoiceFillableField, Set<string>>> = {
    clarity: new Set(['澄んだ', '深みのある', 'やや濁った', '濁った']),
    brightness: new Set(['輝きのある', '艶のある', 'モヤがかった']),
    sparkleIntensity: new Set(['弱い', 'やや弱い', '中程度', 'やや強い', '強い']),
    noseCondition: new Set(['不快 (Unclean)', '良好 (Clean)']),
    development: new Set(['若い', '熟成中', '熟成した', 'ピークを過ぎた/疲れている']),
    readiness: new Set(['若すぎる', '今飲めるが熟成可能', '今が飲み頃', '飲み頃を過ぎている']),
};

const numberRanges: Partial<Record<VoiceFillableField, [number, number]>> = {
    intensity: [0, 10],
    color: [0, 10],
    noseIntensity: [0, 10],
    oldNewWorld: [1, 5],
    fruitsMaturity: [1, 5],
    aromaNeutrality: [1, 5],
    oakAroma: [1, 5],
    sweetness: [1, 6],
    acidityScore: [0, 10],
    tanninScore: [0, 10],
    bodyScore: [0, 10],
    alcoholABV: [0, 100],
    finishScore: [0, 10],
    qualityScore: [0, 10],
    rating: [0, 5],
};

function parseJsonObject(text: string) {
    const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
}

function sanitizeVoiceUpdates(rawUpdates: unknown): VoiceUpdates {
    if (!rawUpdates || typeof rawUpdates !== 'object') return {};

    const updates: VoiceUpdates = {};

    for (const [key, value] of Object.entries(rawUpdates as Record<string, unknown>)) {
        if (!voiceAllowedFields.has(key) || value === null || value === undefined || value === '') continue;

        const field = key as VoiceFillableField;
        const enumValues = stringEnumValues[field];

        if (enumValues) {
            if (typeof value === 'string' && enumValues.has(value)) {
                updates[field] = value;
            }
            continue;
        }

        const range = numberRanges[field];
        if (range) {
            const numeric = Number(value);
            if (Number.isFinite(numeric) && numeric >= range[0] && numeric <= range[1]) {
                updates[field] = numeric;
            }
            continue;
        }

        if (field === 'aromas') {
            if (Array.isArray(value)) {
                const aromas = value
                    .filter((item): item is string => typeof item === 'string')
                    .map((item) => item.trim())
                    .filter(Boolean)
                    .slice(0, 20);

                if (aromas.length > 0) {
                    updates.aromas = aromas;
                }
            }
            continue;
        }

        if (typeof value === 'string') {
            const trimmed = value.trim();
            if (trimmed) {
                updates[field] = trimmed.slice(0, 2000);
            }
        }
    }

    return updates;
}

export async function interpretTastingTranscript(input: {
    transcript: string;
    recentText?: string;
    currentValues?: Record<string, unknown>;
}): Promise<TastingTranscriptInterpretation> {
    if (!apiKey) {
        throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set");
    }

    const transcript = input.transcript.trim();
    if (!transcript) {
        return { updates: {} };
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `
    You are helping fill a Japanese wine tasting note form from live speech transcription.
    Interpret only information that is clearly supported by the transcript.

    Important:
    - Return STRICT JSON only. No markdown.
    - Do not output fields outside the allowed field list.
    - Do not update basic information or wine information such as date, place, price, wineName, producer, country, locality, varieties, referenceUrl, importer, or additionalInfo.
    - Prefer preserving currentValues unless the recent transcript clearly corrects or refines them.
    - If the speaker is uncertain, do not output that field.
    - Text fields must be concise Japanese.
    - Numeric sensory fields use the app scales:
      - intensity/color/noseIntensity/acidityScore/tanninScore/bodyScore/finishScore/qualityScore: 0-10
      - oldNewWorld/fruitsMaturity/aromaNeutrality/oakAroma: 1-5
      - sweetness: 1-6
      - alcoholABV: percentage
      - rating: 0-5

    Allowed fields:
    ${voiceFillableFields.join(', ')}

    Enum values:
    - clarity: 澄んだ | 深みのある | やや濁った | 濁った
    - brightness: 輝きのある | 艶のある | モヤがかった
    - sparkleIntensity: 弱い | やや弱い | 中程度 | やや強い | 強い
    - noseCondition: 不快 (Unclean) | 良好 (Clean)
    - development: 若い | 熟成中 | 熟成した | ピークを過ぎた/疲れている
    - readiness: 若すぎる | 今飲めるが熟成可能 | 今が飲み頃 | 飲み頃を過ぎている

    Mapping guidance:
    - Use aromaOther for aroma descriptions if exact structured aroma names are uncertain.
    - Use palateNotes for taste and structure comments that are not direct scores.
    - Use notes for overall conclusion and personal comments.
    - For qualitative intensity terms, choose reasonable scale values:
      low/weak=2, medium(-)=4, medium=5, medium(+)=6.5, high/strong=8, pronounced=9.

    Current values:
    ${JSON.stringify(input.currentValues || {}, null, 2)}

    Recent transcript chunk:
    ${input.recentText || ''}

    Full transcript:
    ${transcript}

    Output format:
    {
      "updates": {
        "fieldName": "value"
      },
      "summary": "short Japanese summary of what was interpreted"
    }
    `;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const parsed = parseJsonObject(response.text()) as { updates?: unknown; summary?: unknown };

        return {
            updates: sanitizeVoiceUpdates(parsed.updates),
            summary: typeof parsed.summary === 'string' ? parsed.summary.slice(0, 500) : undefined,
        };
    } catch (error: any) {
        console.error("Gemini transcript interpretation error:", error);
        throw new Error(`Failed to interpret tasting transcript: ${error.message || String(error)}`);
    }
}

export async function searchWineDetails(wineId: number, query: { name: string; winery?: string; vintage?: string; country?: string; locality?: string; referenceUrl?: string }) {
    if (!apiKey) {
        throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: "gemini-3.5-flash",
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
