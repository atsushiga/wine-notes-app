export interface TastingNote {
    id: number;
    wine_name: string;
    vintage?: number; // Changed to number based on sample data (2020)
    rating?: number;
    image_url?: string;
    created_at: string;
    user_id?: string;

    // Extended fields from inspection
    price?: number;
    place?: string;
    producer?: string;
    country?: string;
    region?: string;
    main_variety?: string;
    wine_type?: string;
    evaluation?: string;
    notes?: string;
}
