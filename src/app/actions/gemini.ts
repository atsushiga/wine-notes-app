'use server';

import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

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
            },
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
