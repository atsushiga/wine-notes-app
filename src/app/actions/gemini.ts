'use server';

import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

import { storage, BUCKET } from "@/lib/gcs";

const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

export interface WineImageAnalysis {
    wineName: string;
    producer: string;
    vintage: string;
    country: string;
    locality: string;
    price: number | null;
}

export async function analyzeWineImage(imageUrl: string): Promise<WineImageAnalysis> {
    if (!apiKey) {
        throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set");
    }

    // Extract key from URL
    // URL format: .../api/images/uploads/2024/01/123456_filename.jpg
    // or direct GCS URL. Assuming our API format:
    // We need to extract everything after /api/images/
    const urlParts = imageUrl.split('/api/images/');
    if (urlParts.length < 2) {
        throw new Error("Invalid image URL format.");
    }
    const key = decodeURIComponent(urlParts[1]);

    // Download image from GCS
    const file = storage.bucket(BUCKET).file(key);
    const [buffer] = await file.download();

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

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
                mimeType: "image/jpeg", // Assuming JPEG for simplicity, or we should detect
            },
        },
    ]);

    const response = await result.response;
    const text = response.text();
    const cleanedText = text.replace(/```json/g, "").replace(/```/g, "").trim();

    return JSON.parse(cleanedText) as WineImageAnalysis;
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
        model: "gemini-2.0-flash-exp",
        tools: [
            {
                googleSearch: {},
            } as any,
        ],
    });

    const prompt = `
    Please search for detailed information about the following wine:
    Name: ${query.name}
    Producer/Winery: ${query.winery || "Unknown"}
    Vintage: ${query.vintage || "Unknown"}

    I need professional and detailed information for the following 5 sections in Japanese (日本語).
    Return the result strictly as a valid JSON object with the keys exactly as listed below. Do not include markdown code blocks.

    1. terroir_info: Detailed description of the terroir (soil, climate, location) of the vineyard in Japanese.
    2. producer_philosophy: The producer's winemaking philosophy and history in Japanese.
    3. technical_details: Technical details like grape varieties, fermentation method, aging process (barrels, duration) in Japanese.
    4. vintage_analysis: Characteristics of this specific vintage (${query.vintage}) in that region in Japanese. If specific vintage info is hard to find, describe the general vintage characteristics of the region for that year.
    5. search_result_tasting_note: Professional tasting notes found online (aroma, palate, finish) in Japanese.

    JSON Keys:
    - terroir_info
    - producer_philosophy
    - technical_details
    - vintage_analysis
    - search_result_tasting_note
    
    If information is missing, provide a reasonable "Information not available" message for that field in Japanese, but try your best to find it.
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
