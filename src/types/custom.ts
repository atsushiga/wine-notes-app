export interface TastingNote {
    id: number;
    created_at: string;
    user_id?: string;
    status?: 'published' | 'draft';

    // Basic Info
    wine_name: string;
    producer?: string;
    importer?: string; // New field
    vintage?: string;
    price?: number;
    place?: string;
    date?: string;

    // Wine Type & Region
    wine_type?: string;
    country?: string;
    region?: string;
    locality?: string;
    locality_vocab_id?: number | null;

    // Varieties
    main_variety?: string;
    other_varieties?: string;

    // Appearance
    image_url?: string;
    color?: number; // Changed to number 0-10
    intensity?: number;
    rim_ratio?: number;
    clarity?: string;
    brightness?: string;
    sparkle_intensity?: string;
    appearance_other?: string;

    // Nose
    nose_intensity?: number; // Changed string -> number
    nose_condition?: string; // New: 'Clean' | 'Unclean'
    development?: string;    // New: 'Young' ...

    old_new_world?: number;
    fruits_maturity?: number;
    aroma_neutrality?: number;
    aromas?: string[]; // Structured data
    oak_aroma?: number;
    aroma_other?: string;

    // Palate
    sweetness?: number; // New (score)
    acidity_score?: number;
    tannin_score?: number;
    body_score?: number; // Renamed from balance_score
    alcohol_abv?: number;
    finish_score?: number; // New/Renamed from finish_len (length -> score)
    palate_notes?: string;
    // Removed old body/alcohol strings if they conflicts, keeping strictly to new fields + existing useful ones
    // finish_len was number, replacing with finish_score (number) for clarity as per prompt "finish_score"

    // Conclusion
    quality_score?: number; // New (score)
    readiness?: string;    // New
    rating?: number;       // Kept as personal preference
    notes?: string;
    vivino_url?: string;
    additional_info?: string;

    // AI / Grounding Info
    terroir_info?: string;
    producer_philosophy?: string;
    technical_details?: string;
    vintage_analysis?: string;
    search_result_tasting_note?: string;

    // SAT Fields (Deprecated/Removed as we integrated them into main fields)
    // sat_nose_intensity?: string; -> nose_intensity (number)
    // sat_acidity?: string; -> acidity_score (number)
    // sat_tannin?: string; -> tannin_score (number)
    // sat_finish?: string; -> finish_score (number)
    // sat_quality?: string; -> quality_score (number)

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
