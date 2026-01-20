export interface TastingNote {
    id: number;
    created_at: string;
    user_id?: string;

    // Basic Info
    wine_name: string;
    producer?: string;
    vintage?: string;
    price?: number;
    place?: string;
    date?: string;

    // Wine Type & Region
    wine_type?: string;
    country?: string;
    region?: string; // locality in form map to region in Notion, but schema might use 'locality' or 'region'
    locality?: string;

    // Varieties
    main_variety?: string;
    other_varieties?: string;

    // Appearance
    image_url?: string;
    intensity?: number;
    rim_ratio?: number;
    clarity?: string;
    brightness?: string;
    sparkle_intensity?: string;
    appearance_other?: string;

    // Nose
    nose_intensity?: string;
    old_new_world?: number;
    fruits_maturity?: number;
    aroma_neutrality?: number;
    aromas?: string[]; // Assuming it's stored as array
    oak_aroma?: number;
    aroma_other?: string;

    // Palate
    sweetness?: string;
    acidity_score?: number;
    tannin_score?: number;
    balance_score?: number;
    alcohol_abv?: number;
    finish_len?: number;
    palate_notes?: string;
    body?: string;     // In route.ts but not in form? found in `pushKV('ボディ', asString(data.body));`
    alcohol?: string;  // In route.ts text field?

    // Evaluation
    evaluation?: string;
    rating?: number;
    notes?: string;
    vivino_url?: string;
    additional_info?: string;

    // AI / Grounding Info
    terroir_info?: string;
    producer_philosophy?: string;
    technical_details?: string;
    vintage_analysis?: string;
    search_result_tasting_note?: string;

    // SAT Fields
    sat_nose_intensity?: string;
    sat_acidity?: string;
    sat_tannin?: string;
    sat_finish?: string;
    sat_quality?: string;

    // Images (1:N)
    images?: WineImage[];
}

export interface WineImage {
    id: string;
    tasting_note_id: number;
    url: string;
    thumbnail_url?: string;
    storage_path?: string;
    display_order: number;
    created_at?: string;
}
