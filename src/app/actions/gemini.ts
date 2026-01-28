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
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

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
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

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

export async function searchWineDetails(wineId: number, query: { name: string; winery?: string; vintage?: string }) {
    if (!apiKey) {
        throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash",
        tools: [
            {
                googleSearch: {},
            } as any,
        ],
    });

    const prompt = `
    You are assisting a wine tasting note application.
    Search the web for reliable, professional information about the following wine and summarize it in Japanese.

    Wine:
    - Name: ${query.name}
    - Producer/Winery: ${query.winery || "Unknown"}
    - Vintage: ${query.vintage || "Unknown"}

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
